// packages/main/src/app/sync/sync.service.ts
import { Injectable, Logger }   from '@nestjs/common';
import { FileSystemService }     from '../services/file-system.service';
import { Mp3TagService }         from '../services/mp3-tag.service';
import { TagTransformerService } from '../services/tag-transformer.service';
import { PairingService }        from '../pairing/pairing.service';
import { SourceFileStateService} from '../source-file-state/source-file-state.service';
import { PrismaService }         from '../database/prisma.service';
import { ConfigService }         from '../config/config.service';
import { BackupCoordinatorService } from '../services/backup-coordinator.service';
import { ReportingService } from '../reporting/reporting.service';

export type SyncDirection = 'A_TO_B' | 'B_TO_A';

export interface PendingUpdateEntry {
  tag: string;
  from: any;
  to: any;
  direction: SyncDirection;
}

export interface PreviewEntry {
  sourcePath:     string;
  destPath:       string;
  pendingUpdates: PendingUpdateEntry[];
  conflicts?:     Array<{ tag: string; a: any; b: any }>;
}

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    private fs:           FileSystemService,
    private tags:         Mp3TagService,
    private transformer:  TagTransformerService,
    private pairing:      PairingService,
    private state:        SourceFileStateService,
    private prisma:       PrismaService,
    private config:       ConfigService,
    private backup:       BackupCoordinatorService,
    private reporting:    ReportingService,
  ) {}

  private getAllReadKeys(): string[] {
    const bidir = this.config.getBidirectionalTags();
    const multi = ['TCON','TCMP','TCOM'];
    const commentFrames = [
      'COMM',
      'TXXX:energylevel',
      'TXXX:kaufmonat',
      'TXXX:kaufgrund',
      'TXXX:kaufort',
      'TXXX:livegesehen',
    ];
    return Array.from(new Set([...bidir, ...multi, ...commentFrames]));
  }

  private isTagAllowed(tag: string): boolean {
    const t = this.config.getTagsToSync();
    return t === 'ALL' || t.includes(tag);
  }

  private normDb(v: any): string | null {
    if (v === null || v === undefined) return null;
    if (typeof v === 'string') return v;
    try { return JSON.stringify(v); } catch { return String(v); }
  }

  /** Build a preview of all sync‐able files + their tag‐changes */
  async previewSync(): Promise<PreviewEntry[]> {
    const inLib    = await this.state.listInLibrary();
    const mappings = await this.pairing.getMappings();
    const mapB     = new Map(mappings.map(m => [m.sourceAPath, m.sourceBPath]));
    const keys     = this.getAllReadKeys();

    const preview: PreviewEntry[] = [];

    for (const { path: src } of inLib) {
      const dst = mapB.get(src);
      if (!dst) continue;

      const row = await this.prisma.fileMappingState.findUnique({
        where:  { sourceAPath: src },
        select: { lastSyncTimestamp: true }
      });
      const lastSyncTime = row?.lastSyncTimestamp ?? new Date(0);
      const firstSync    = !row?.lastSyncTimestamp;

      const srcTags = await this.tags.readTags(src, keys);
      const dstTags = await this.tags.readTags(dst, keys);

      // ← use the existing transformAll method to compute normalized A-values for one-way tags
      const transformed = this.transformer.transformAll({ ...srcTags });

      const mtimeA = (await this.fs.getFileTimestamp(src)) || new Date(0);
      const mtimeB = (await this.fs.getFileTimestamp(dst)) || new Date(0);

      const changes:  PreviewEntry['pendingUpdates'] = [];
      const conflicts: PreviewEntry['conflicts']      = [];

      const relevant = new Set<string>([
        ...Object.keys(srcTags),
        ...Object.keys(dstTags),
        ...Object.keys(transformed),
      ]);

      for (const tag of relevant) {
        if (!this.isTagAllowed(tag)) continue;
        const curA = srcTags[tag] ?? null;
        const curB = dstTags[tag] ?? null;
        const isBi = this.config.getBidirectionalTags().includes(tag);

        if (isBi) {
          if (firstSync) {
            if (curA !== curB) conflicts.push({ tag, a: curA, b: curB });
          } else {
            const aChanged = mtimeA > lastSyncTime;
            const bChanged = mtimeB > lastSyncTime;

            if (aChanged && bChanged && curA !== curB) {
              conflicts.push({ tag, a: curA, b: curB });
            } else if (aChanged && curA !== curB) {
              changes.push({ tag, from: curB, to: curA, direction: 'A_TO_B' });
            } else if (bChanged && curA !== curB) {
              changes.push({ tag, from: curA, to: curB, direction: 'B_TO_A' });
            }
          }
        } else {
          // one-way A->B: write transformed A value if present, otherwise raw A (can be null → delete)
          let toVal: any = Object.prototype.hasOwnProperty.call(transformed, tag)
            ? (transformed as any)[tag]
            : curA;
          if (toVal !== curB) changes.push({ tag, from: curB, to: toVal ?? null, direction: 'A_TO_B' });
        }
      }

      if (changes.length || conflicts.length) {
        preview.push({
          sourcePath:     src,
          destPath:       dst,
          pendingUpdates: changes,
          conflicts:      conflicts.length ? conflicts : undefined,
        });
      }
    }

    return preview;
  }

  /** Actually apply all non-conflicting changes */
  async runSync(): Promise<{
    applied:   number;
    conflicts: Array<{ source: string; tag: string; a: any; b: any }>;
  }> {
    const runId = await this.reporting.startRun();
    const inLib    = await this.state.listInLibrary();
    const mappings = await this.pairing.getMappings();
    const mapB     = new Map(mappings.map(m => [m.sourceAPath, m.sourceBPath]));

    let applied   = 0;
    const conflicts: Array<{ source:string; tag:string; a:any; b:any }> = [];
    const now = new Date();

    for (const { path: src } of inLib) {
      const dst = mapB.get(src);
      if (!dst) continue;

      const record = await this.prisma.fileMappingState.findUnique({
        where:  { sourceAPath: src },
        select: { id: true, lastSyncTimestamp: true },
      });
      const lastSyncTime = record?.lastSyncTimestamp ?? new Date(0);
      const firstSync    = !record?.lastSyncTimestamp;

      const keys   = this.getAllReadKeys();
      const srcTags = await this.tags.readTags(src, keys);
      const dstTags = await this.tags.readTags(dst, keys);
      const transformed = this.transformer.transformAll({ ...srcTags });

      const mtimeA = (await this.fs.getFileTimestamp(src)) || new Date(0);
      const mtimeB = (await this.fs.getFileTimestamp(dst)) || new Date(0);

      const writeToA: Record<string, any> = {};
      const writeToB: Record<string, any> = {};
      const appliedItemsA: Array<{ tag: string; fromValue: any; toValue: any }> = [];
      const appliedItemsB: Array<{ tag: string; fromValue: any; toValue: any }> = [];

      const processedTags = new Set<string>();

      const relevant = new Set<string>([
        ...Object.keys(srcTags),
        ...Object.keys(dstTags),
        ...Object.keys(transformed),
      ]);

      for (const tag of relevant) {
        if (!this.isTagAllowed(tag)) continue;
        processedTags.add(tag);
        const curA = srcTags[tag] ?? null;
        const curB = dstTags[tag] ?? null;
        const isBi = this.config.getBidirectionalTags().includes(tag);

        if (isBi) {
          if (firstSync) {
            if (curA !== curB) conflicts.push({ source: src, tag, a: curA, b: curB });
          } else {
            const aChanged = mtimeA > lastSyncTime;
            const bChanged = mtimeB > lastSyncTime;
            if (aChanged && bChanged && curA !== curB) {
              conflicts.push({ source: src, tag, a: curA, b: curB });
            } else if (aChanged && curA !== curB) {
              writeToB[tag] = curA; // raw A wins → may be null (delete)
              appliedItemsB.push({ tag, fromValue: curB, toValue: curA });
            } else if (bChanged && curA !== curB) {
              writeToA[tag] = curB; // raw B wins → may be null (delete)
              appliedItemsA.push({ tag, fromValue: curA, toValue: curB });
            }
          }
        } else {
          // one-way A->B: write transformed A value if present, otherwise raw A (can be null → delete)
          let toVal: any = Object.prototype.hasOwnProperty.call(transformed, tag)
            ? (transformed as any)[tag]
            : curA;
          if (toVal !== curB) {
            writeToB[tag] = toVal ?? null;
            appliedItemsB.push({ tag, fromValue: curB, toValue: toVal ?? null });
          }
        }
      }

      let fileApplied = false;
      if (Object.keys(writeToB).length > 0) {
        await this.backup.backupFile(dst);
        await this.tags.writeTags(dst, writeToB);
        fileApplied = true;
        applied += Object.keys(writeToB).length;
        // Reporting applied A->B
        for (const item of appliedItemsB) {
          await this.reporting.recordApplied({
            runId,
            mappingId: record?.id ?? null,
            sourceAPath: src,
            sourceBPath: dst,
            tag: item.tag,
            direction: 'A_TO_B',
            fromValue: this.normDb(item.fromValue),
            toValue: this.normDb(item.toValue),
          });
        }
      }
      if (Object.keys(writeToA).length > 0) {
        await this.backup.backupFile(src);
        await this.tags.writeTags(src, writeToA);
        fileApplied = true;
        applied += Object.keys(writeToA).length;
        // Reporting applied B->A
        for (const item of appliedItemsA) {
          await this.reporting.recordApplied({
            runId,
            mappingId: record?.id ?? null,
            sourceAPath: src,
            sourceBPath: dst,
            tag: item.tag,
            direction: 'B_TO_A',
            fromValue: this.normDb(item.fromValue),
            toValue: this.normDb(item.toValue),
          });
        }
      }

      // Update SyncStateTag for processed tags with post-write values
      if (record) {
        for (const tag of processedTags) {
          const newA = tag in writeToA ? writeToA[tag] : (srcTags[tag] ?? null);
          const newB = tag in writeToB ? writeToB[tag] : (dstTags[tag] ?? null);
          await this.prisma.syncStateTag.upsert({
            where: {
              fileMappingStateId_tagName: {
                fileMappingStateId: record.id,
                tagName: tag,
              },
            },
            create: {
              fileMappingStateId: record.id,
              tagName: tag,
              sourceAValue: this.normDb(newA),
              sourceBValue: this.normDb(newB),
            },
            update: {
              sourceAValue: this.normDb(newA),
              sourceBValue: this.normDb(newB),
            },
          });
        }
      }

      // Update mapping metadata if anything was written
      if (fileApplied && record) {
        const helper = await this.tags.readTags(dst, ['TPE1','TIT2']);
        await this.prisma.fileMappingState.update({
          where: { id: record.id },
          data:  {
            lastSyncTimestamp: now,
            artist: helper?.TPE1 ?? null,
            title:  helper?.TIT2 ?? null,
            sourceALastModified: mtimeA,
            sourceBLastModified: mtimeB,
          },
        });
      }

      // Report conflicts for this file (if any)
      if (conflicts.length > 0) {
        for (const c of conflicts.filter(x => x.source === src)) {
          await this.reporting.recordConflict({
            runId,
            mappingId: record?.id ?? null,
            sourceAPath: src,
            sourceBPath: dst,
            tag: c.tag,
            aValue: this.normDb(c.a),
            bValue: this.normDb(c.b),
          });
        }
      }
    }

    await this.reporting.finishRun(runId, applied, conflicts.length);
    this.logger.log(`runSync applied ${applied}, conflicts ${conflicts.length}`);
    return { applied, conflicts };
  }
}
