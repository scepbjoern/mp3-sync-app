import { Injectable, Logger } from '@nestjs/common';
import { FileSystemService } from '../services/file-system.service';
import { Mp3TagService } from '../services/mp3-tag.service';
import { TagTransformerService } from '../services/tag-transformer.service';
import { PairingService } from '../pairing/pairing.service';
import { SourceFileStateService } from '../source-file-state/source-file-state.service';

export interface PreviewEntry {
  sourcePath: string;
  destPath:   string;
  changes:    Array<{ tag: string; from: any; to: any }>;
  conflict?:  Array<{ tag: string; a: any; b: any }>;
}

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    private fs: FileSystemService,
    private tags: Mp3TagService,
    private transformer: TagTransformerService,
    private pairing: PairingService,
    private state: SourceFileStateService,
  ) {}

  /** Build a preview of all sync‐able files + their tag‐changes */
  async previewSync(): Promise<PreviewEntry[]> {
    // 1) get all in–library source files
    const inLib = await this.state.listInLibrary(); // [{ path, lastModifiedAt }]
    // 2) get current mappings
    const mappings = await this.pairing.getMappings();  // [{ sourceAPath, sourceBPath }]
    const map = new Map(mappings.map(m => [m.sourceAPath, m.sourceBPath]));

    const preview: PreviewEntry[] = [];
    for (const { path: src } of inLib) {
      const dst = map.get(src);
      if (!dst) continue;
      // 3) read tags
      const srcTags = await this.tags.readTags(src, this.transformer.allTagKeys);
      const dstTags = await this.tags.readTags(dst, this.transformer.allTagKeys);
      // 4) transform source tags
      const transformed = this.transformer.transformAll(srcTags);
      // 5) compare
      const changes: PreviewEntry['changes'] = [];
      const conflicts: PreviewEntry['conflict'] = [];
      for (const [tag, to] of Object.entries(transformed)) {
        const from = dstTags[tag];
        const isBi = this.transformer.isBidirectional(tag);
        if (isBi) {
          // bidirectional: decide newer-wins
          if (from != null && from !== to) {
            const srcMtime = await this.fs.getFileTimestamp(src);
            const dstMtime = await this.fs.getFileTimestamp(dst);
            if (srcMtime && dstMtime) {
              if (srcMtime > dstMtime) {
                changes.push({ tag, from, to });
              } else if (dstMtime > srcMtime) {
                changes.push({ tag, from: to, to: from });
              } else {
                conflicts.push({ tag, a: to, b: from });
              }
            }
          }
        } else {
          // one-way: if different, always update B
          if (from !== to) changes.push({ tag, from, to });
        }
      }
      preview.push({ sourcePath: src, destPath: dst, changes, conflict: conflicts.length ? conflicts : undefined });
    }
    return preview;
  }

  /** Actually apply all non-conflicting changes */
  async runSync(): Promise<{
    applied: number;
    conflicts: Array<{ source: string; tag: string; a: any; b: any }>;
  }> {
    const preview = await this.previewSync();
    let applied = 0;
    const conflicts: Array<{ source: string; tag: string; a: any; b: any }> = [];

    for (const entry of preview) {
      if (entry.conflict) {
        for (const c of entry.conflict) {
          conflicts.push({ source: entry.sourcePath, tag: c.tag, a: c.a, b: c.b });
        }
        continue;
      }
      if (!entry.changes.length) continue;
      // build a tag‐object for node‐id3
      const toWrite: Record<string, any> = {};
      for (const { tag, to } of entry.changes) {
        toWrite[tag] = to;
      }
      await this.tags.writeTags(entry.destPath, toWrite);
      applied++;
    }
    this.logger.log(`runSync applied ${applied}, conflicts ${conflicts.length}`);
    return { applied, conflicts };
  }
}
