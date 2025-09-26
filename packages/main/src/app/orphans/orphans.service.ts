// packages/main/src/app/orphans/orphans.service.ts
import { Injectable, Logger } from '@nestjs/common';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import { ConfigService } from '../config/config.service';
import { PrismaService } from '../database/prisma.service';
import { FileSystemService } from '../services/file-system.service';
import { Mp3TagService } from '../services/mp3-tag.service';

export type OrphanType = 'UNMAPPED_A' | 'UNMAPPED_B' | 'MAPPED_A_MISSING' | 'MAPPED_B_MISSING';

export interface OrphanItem {
  type: OrphanType;
  mappingId?: number;
  sourceAPath?: string;
  sourceBPath?: string;
  aExists: boolean;
  bExists: boolean;
  inDjLibrary?: boolean; // only meaningful for A-side
}

export interface OrphanScanOptions {
  includeNonDj?: boolean; // default false
  /** If true, return ONLY rows where mapping exists but A is missing (and B exists). */
  onlyMappedAMissing?: boolean;
}

export interface CopySpec {
  from: 'A' | 'B';
  aPath: string; // absolute intended A path (existing or target)
  bPath: string; // absolute intended B path (existing or target)
}

@Injectable()
export class OrphansService {
  private readonly logger = new Logger(OrphansService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly fsSvc: FileSystemService,
    private readonly tagSvc: Mp3TagService,
  ) {}

  async scan(options: OrphanScanOptions = {}): Promise<OrphanItem[]> {
    const includeNonDj = options.includeNonDj ?? false;
    const onlyMappedAMissing = options.onlyMappedAMissing ?? false;
    const aRoot = this.config.getSourceAPath();
    const bRoot = this.config.getSourceBPath();
    if (!aRoot || !bRoot) throw new Error('Both Source A and Source B must be configured.');

    this.logger.log(`Scan orphans: includeNonDj=${includeNonDj}, onlyMappedAMissing=${onlyMappedAMissing}`);

    // DB mappings
    const mappings = await this.prisma.fileMappingState.findMany({
      select: { id: true, sourceAPath: true, sourceBPath: true },
    });
    const mappedA = new Set(mappings.map((m) => m.sourceAPath));
    const mappedB = new Set(mappings.map((m) => m.sourceBPath));

    // FS listings
    const [aFiles, bFiles] = await Promise.all([
      this.fsSvc.scanDirectory(aRoot),
      this.fsSvc.scanDirectory(bRoot),
    ]);
    const aSet = new Set(aFiles);
    const bSet = new Set(bFiles);

    // DJ membership map for A
    const sourceState = await this.prisma.sourceFileState.findMany({ select: { path: true, inDjLibrary: true } });
    const inDjMap = new Map(sourceState.map((s) => [s.path, s.inDjLibrary] as const));

    const result: OrphanItem[] = [];

    // If exclusively requesting MAPPED_A_MISSING, short-circuit and return only those
    if (onlyMappedAMissing) {
      for (const m of mappings) {
        const aExists = aSet.has(m.sourceAPath);
        const bExists = bSet.has(m.sourceBPath);
        if (!aExists && bExists) {
          const inDj = inDjMap.get(m.sourceAPath) ?? false;
          result.push({ type: 'MAPPED_A_MISSING', mappingId: m.id, sourceAPath: m.sourceAPath, sourceBPath: m.sourceBPath, aExists, bExists, inDjLibrary: inDj });
        }
      }
    } else {
      // 1) Mapped rows with missing side
      for (const m of mappings) {
        const aExists = aSet.has(m.sourceAPath);
        const bExists = bSet.has(m.sourceBPath);
        if (aExists && bExists) continue;
        const inDj = inDjMap.get(m.sourceAPath) ?? false;

        if (!aExists && bExists) {
          // Only if showing all; DJ-filter cannot be applied (A missing)
          if (includeNonDj) {
            result.push({ type: 'MAPPED_A_MISSING', mappingId: m.id, sourceAPath: m.sourceAPath, sourceBPath: m.sourceBPath, aExists, bExists, inDjLibrary: inDj });
          }
          continue;
        }
        if (aExists && !bExists) {
          if (includeNonDj || inDj) {
            result.push({ type: 'MAPPED_B_MISSING', mappingId: m.id, sourceAPath: m.sourceAPath, sourceBPath: m.sourceBPath, aExists, bExists, inDjLibrary: inDj });
          }
        }
      }

      // 2) Unmapped files
      // UNMAPPED_A
      for (const aPath of aSet) {
        if (mappedA.has(aPath)) continue;
        const inDj = inDjMap.get(aPath) ?? false;
        if (includeNonDj || inDj) {
          result.push({ type: 'UNMAPPED_A', aExists: true, bExists: false, sourceAPath: aPath, inDjLibrary: inDj });
        }
      }
      // UNMAPPED_B
      if (includeNonDj) {
        for (const bPath of bSet) {
          if (mappedB.has(bPath)) continue;
          result.push({ type: 'UNMAPPED_B', aExists: false, bExists: true, sourceBPath: bPath });
        }
      }
    }

    // order by type then path for stability
    const sorted = result.sort((x, y) => {
      if (x.type !== y.type) return x.type.localeCompare(y.type);
      const xp = x.sourceAPath ?? x.sourceBPath ?? '';
      const yp = y.sourceAPath ?? y.sourceBPath ?? '';
      return xp.localeCompare(yp);
    });
    const counts: Record<string, number> = {};
    for (const r of sorted) counts[r.type] = (counts[r.type] ?? 0) + 1;
    this.logger.debug(
      `Orphans scan result: total=${sorted.length} ` +
      `UNMAPPED_A=${counts['UNMAPPED_A'] ?? 0} ` +
      `UNMAPPED_B=${counts['UNMAPPED_B'] ?? 0} ` +
      `MAPPED_A_MISSING=${counts['MAPPED_A_MISSING'] ?? 0} ` +
      `MAPPED_B_MISSING=${counts['MAPPED_B_MISSING'] ?? 0}`,
    );
    return sorted;
  }

  async deleteFiles(paths: string[]): Promise<{ deleted: number; errors: { path: string; error: string }[] }> {
    this.logger.log(`Deleting ${paths.length} file(s)`);
    let deleted = 0;
    const errors: { path: string; error: string }[] = [];
    for (const p of paths) {
      try {
        await fs.unlink(p);
        deleted++;
      } catch (e: any) {
        errors.push({ path: p, error: e?.message ?? String(e) });
      }
    }
    this.logger.log(`Delete complete: deleted=${deleted}, errors=${errors.length}`);
    return { deleted, errors };
  }

  async unmap(ids: number[]): Promise<{ unmapped: number; errors: { id: number; error: string }[] }> {
    this.logger.log(`Unmapping ${ids.length} mapping(s)`);
    let unmapped = 0;
    const errors: { id: number; error: string }[] = [];
    for (const id of ids) {
      try {
        await this.prisma.fileMappingState.delete({ where: { id } });
        unmapped++;
      } catch (e: any) {
        errors.push({ id, error: e?.message ?? String(e) });
      }
    }
    this.logger.log(`Unmap complete: unmapped=${unmapped}, errors=${errors.length}`);
    return { unmapped, errors };
  }

  async copy(specs: CopySpec[]): Promise<{ copied: number; createdMappings: number; errors: { aPath: string; bPath: string; error: string }[] }> {
    this.logger.log(`Copying ${specs.length} spec(s)`);
    let copied = 0;
    let createdMappings = 0;
    const errors: { aPath: string; bPath: string; error: string }[] = [];

    for (const s of specs) {
      try {
        const fromPath = s.from === 'A' ? s.aPath : s.bPath;
        let toPath   = s.from === 'A' ? s.bPath : s.aPath;
        if (s.from === 'A' && (!toPath || toPath.trim().length === 0)) {
          toPath = await this.computeMirrorDestination(s.aPath);
        }
        const toDir = path.dirname(toPath);
        await fs.mkdir(toDir, { recursive: true });
        await fs.copyFile(fromPath, toPath);
        copied++;

        // create mapping if missing
        const existing = await this.prisma.fileMappingState.findUnique({ where: { sourceAPath: s.aPath } });
        if (!existing) {
          await this.prisma.fileMappingState.create({ data: { sourceAPath: s.aPath, sourceBPath: toPath } });
          createdMappings++;
        }
      } catch (e: any) {
        errors.push({ aPath: s.aPath, bPath: s.bPath, error: e?.message ?? String(e) });
      }
    }

    this.logger.log(`Copy complete: copied=${copied}, createdMappings=${createdMappings}, errors=${errors.length}`);
    return { copied, createdMappings, errors };
  }

  // ─────────────────────────────────────────────────────────────
  // Mirror path computation (A -> B) with pattern
  // Pattern supports:
  //  - Static text
  //  - Directory separators '\' (or '/')
  //  - Placeholders: <TAG> where TAG is an ID3 frame (e.g., TPE1) or a TXXX name (e.g., DJBIBLIOTHEK)
  //  - $Left(<TAG>,n) -> left n chars of TAG value
  //  - Optional groups: [ ... ] included only if all placeholders inside resolve to non-empty strings
  // Special formatting:
  //  - TRCK and TPOS values: '' if empty; if '02/11' -> '02'; numbers padded to 2 digits
  // Sanitization: invalid NTFS chars replaced with '_', and path length checked (< 240)
  async computeMirrorDestination(aPath: string): Promise<string> {
    const bRoot = this.config.getSourceBPath();
    if (!bRoot) throw new Error('Source B path not configured');

    const pattern = this.config.getMirrorPattern();
    const tagsNeeded = this.extractTagNamesFromPattern(pattern);
    // Map placeholder names to real frame keys for reading
    const frameIds = tagsNeeded.map((name) => this.placeholderToFrame(name));
    const uniqueFrameIds = Array.from(new Set(frameIds));
    const tagMap = await this.tagSvc.readTags(aPath, uniqueFrameIds);

    // Build a mapping from placeholder name -> value string
    const valueByName = new Map<string, string>();
    for (const name of tagsNeeded) {
      const frameId = this.placeholderToFrame(name);
      const raw = (tagMap as any)[frameId];
      const val = this.normalizeTagValue(name, raw);
      valueByName.set(name, val);
    }

    // First, process $Left() functions
    let expanded = pattern.replace(/\$Left\(<([^>]+)>,\s*(\d+)\)/g, (_m, tagName: string, nStr: string) => {
      const n = parseInt(nStr, 10) || 0;
      const base = valueByName.get(tagName) ?? '';
      return base.substring(0, Math.max(0, n));
    });

    // Replace placeholders <TAG>
    expanded = expanded.replace(/<([^>]+)>/g, (_m, tagName: string) => {
      return valueByName.get(tagName) ?? '';
    });

    // Handle optional groups [ ... ]
    expanded = expanded.replace(/\[([^\]]+)\]/g, (_m, inner: string) => {
      // Determine if this group should be kept: if any placeholder within had non-empty value
      const placeholders = Array.from(inner.matchAll(/<([^>]+)>/g)).map((mm) => mm[1]);
      let keep = false;
      if (placeholders.length === 0) {
        // If no placeholders, keep if inner has any non-whitespace character
        keep = inner.trim().length > 0;
      } else {
        for (const p of placeholders) {
          const v = valueByName.get(p) ?? '';
          if (v !== '') { keep = true; break; }
        }
      }
      return keep ? inner : '';
    });

    // Normalize separators to win32 and split
    const rel = expanded.replace(/[\/]+/g, '\\');
    const segments = rel.split('\\').filter((s) => s.length > 0);
    if (segments.length === 0) throw new Error('Mirror pattern produced empty path');
    // Ensure filename has .mp3 extension
    const last = segments[segments.length - 1];
    if (!/\.(mp3)$/i.test(last)) {
      segments[segments.length - 1] = `${last}.mp3`;
    }

    // Sanitize each segment for NTFS
    const sanitized = segments.map((s, i) => this.sanitizeSegment(s, i === segments.length - 1));
    if (!sanitized[sanitized.length - 1]) throw new Error('Mirror pattern produced empty file name');

    // Build final path
    const winPath = require('node:path').win32;
    const dest = winPath.join(bRoot, ...sanitized);
    if (dest.length > 240) {
      throw new Error(`Destination path too long (${dest.length} chars)`);
    }
    return dest;
  }

  private extractTagNamesFromPattern(pattern: string): string[] {
    const names = new Set<string>();
    for (const m of pattern.matchAll(/<([^>]+)>/g)) {
      names.add(m[1]);
    }
    for (const m of pattern.matchAll(/\$Left\(<([^>]+)>,\s*\d+\)/g)) {
      names.add(m[1]);
    }
    return Array.from(names);
  }

  private placeholderToFrame(name: string): string {
    // If name already looks like TXXX:desc keep as is
    if (/^TXXX:/i.test(name)) return name;
    // If plain common frame like TPE1, TIT2, TRCK, TPOS etc
    if (/^[A-Z0-9]{3,4}$/i.test(name)) return name.toUpperCase();
    // Otherwise treat as TXXX:<name>
    return `TXXX:${name}`;
  }

  private normalizeTagValue(name: string, raw: any): string {
    const key = name.toUpperCase();
    if (raw === undefined || raw === null) return '';
    let val = '';
    if (typeof raw === 'string') val = raw.trim();
    else if (Array.isArray(raw)) val = raw.join(' ').trim();
    else if (typeof raw === 'object' && raw !== null && 'text' in raw) val = String((raw as any).text ?? '').trim();
    else val = String(raw ?? '').trim();

    // Special cases
    if (key === 'TRCK' || key === 'TPOS') {
      if (!val) return '';
      const left = val.split('/')[0]?.trim() ?? '';
      if (!left) return '';
      const num = parseInt(left, 10);
      if (isNaN(num)) return '';
      return num < 10 ? `0${num}` : String(num);
    }
    return val;
  }

  private sanitizeSegment(seg: string, isFileName: boolean): string {
    // Replace invalid NTFS characters
    let s = seg.replace(/[<>:"/\\|?*]/g, '_');
    // Remove control chars
    s = s.replace(/[\x00-\x1F]/g, '_');
    // Trim trailing spaces and dots (not allowed for file/dir names)
    s = s.replace(/[\s.]+$/g, '');
    // Prevent reserved names
    const reserved = new Set(['CON','PRN','AUX','NUL','COM1','COM2','COM3','COM4','COM5','COM6','COM7','COM8','COM9','LPT1','LPT2','LPT3','LPT4','LPT5','LPT6','LPT7','LPT8','LPT9']);
    if (reserved.has(s.toUpperCase())) {
      s = `_${s}`;
    }
    // Very short name fallback
    if (s.length === 0) s = isFileName ? 'untitled.mp3' : '_';
    return s;
  }
}
