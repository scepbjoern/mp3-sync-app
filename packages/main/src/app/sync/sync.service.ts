// packages/main/src/app/sync/sync.service.ts
import { Injectable, Logger }   from '@nestjs/common';
import { FileSystemService }     from '../services/file-system.service';
import { Mp3TagService }         from '../services/mp3-tag.service';
import { TagTransformerService } from '../services/tag-transformer.service';
import { PairingService }        from '../pairing/pairing.service';
import { SourceFileStateService} from '../source-file-state/source-file-state.service';
import { PrismaService }         from '../database/prisma.service';
import { ConfigService }         from '../config/config.service';

export interface PreviewEntry {
  sourcePath:     string;
  destPath:       string;
  pendingUpdates: Array<{ tag: string; from: any; to: any }>;
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

      // ← use the existing transformAll method
      const transformed = this.transformer.transformAll(srcTags);

      const mtimeA = (await this.fs.getFileTimestamp(src)) || new Date(0);
      const mtimeB = (await this.fs.getFileTimestamp(dst)) || new Date(0);

      const changes:  PreviewEntry['pendingUpdates'] = [];
      const conflicts: PreviewEntry['conflicts']      = [];

      for (const [tag, to] of Object.entries(transformed)) {
        const from = dstTags[tag] ?? null;
        const isBi = this.config.getBidirectionalTags().includes(tag);

        if (isBi) {
          if (firstSync) {
            if (to !== from) conflicts.push({ tag, a: to, b: from });
          } else {
            const aChanged = mtimeA > lastSyncTime;
            const bChanged = mtimeB > lastSyncTime;

            if (aChanged && bChanged && to !== from) {
              conflicts.push({ tag, a: to, b: from });
            } else if (aChanged && to !== from) {
              changes.push({ tag, from, to });
            } else if (bChanged && to !== from) {
              changes.push({ tag, from: to, to: from });
            }
          }
        } else {
          if (to !== from) changes.push({ tag, from, to });
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
    const preview = await this.previewSync();
    let applied   = 0;
    const conflicts: Array<{ source:string; tag:string; a:any; b:any }> = [];

    for (const entry of preview) {
      if (entry.conflicts) {
        entry.conflicts.forEach(c => conflicts.push({ source: entry.sourcePath, ...c }));
        continue;
      }
      if (!entry.pendingUpdates.length) continue;

      const toWrite: Record<string, any> = {};
      entry.pendingUpdates.forEach(({ tag, to }) => {
        toWrite[tag] = to;
      });

      await this.tags.writeTags(entry.destPath, toWrite);
      applied++;
    }

    // bump lastSyncTimestamp on all updated mappings
    const now = new Date();
    await Promise.all(
      preview
        .filter(e => !e.conflicts && e.pendingUpdates.length)
        .map(e =>
          this.prisma.fileMappingState.update({
            where: { sourceAPath: e.sourcePath },
            data:  { lastSyncTimestamp: now },
          })
        )
    );

    this.logger.log(`runSync applied ${applied}, conflicts ${conflicts.length}`);
    return { applied, conflicts };
  }
}
