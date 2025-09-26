// packages/main/src/app/orphans/orphans.service.ts
import { Injectable, Logger } from '@nestjs/common';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import { ConfigService } from '../config/config.service';
import { PrismaService } from '../database/prisma.service';
import { FileSystemService } from '../services/file-system.service';

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
        const toPath   = s.from === 'A' ? s.bPath : s.aPath;
        const toDir = path.dirname(toPath);
        await fs.mkdir(toDir, { recursive: true });
        await fs.copyFile(fromPath, toPath);
        copied++;

        // create mapping if missing
        const existing = await this.prisma.fileMappingState.findUnique({ where: { sourceAPath: s.aPath } });
        if (!existing) {
          await this.prisma.fileMappingState.create({ data: { sourceAPath: s.aPath, sourceBPath: s.bPath } });
          createdMappings++;
        }
      } catch (e: any) {
        errors.push({ aPath: s.aPath, bPath: s.bPath, error: e?.message ?? String(e) });
      }
    }

    this.logger.log(`Copy complete: copied=${copied}, createdMappings=${createdMappings}, errors=${errors.length}`);
    return { copied, createdMappings, errors };
  }
}
