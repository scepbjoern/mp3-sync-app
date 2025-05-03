import { Injectable, Logger } from '@nestjs/common';
import { FileSystemService } from '../services/file-system.service';
import { Mp3TagService } from '../services/mp3-tag.service';
import { PrismaService } from '../database/prisma.service';
import { ConfigService }      from '../config/config.service';

@Injectable()
export class SourceFileStateService {
  private readonly logger = new Logger(SourceFileStateService.name);

  constructor(
    private readonly fsService: FileSystemService,
    private readonly tagService: Mp3TagService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Scan all .mp3 under Source A, upsert each into SourceFileState,
   * only re-reading the DJ tag on newly added or modified files.
   */
  async scanAndUpdate(): Promise<{ total: number; updated: number }> {
    const cfg = this.config.getConfig();
    const root = cfg.sourceAPath;
    if (!root) throw new Error('Source A path not configured');

    const allFiles = await this.fsService.scanDirectory(root);
    let updatedCount = 0;

    for (const filePath of allFiles) {
      // 1) get file mtime
      const mtime = await this.fsService.getFileTimestamp(filePath);
      if (!mtime) continue;

      // 2) lookup existing record
      const existing = await this.prisma.sourceFileState.findUnique({
        where: { path: filePath },
      });

      // 3) decide if we must re-read the DJ tag
      let shouldReadTag = false;
      if (!existing) {
        shouldReadTag = true;
      } else if (!existing.lastModifiedAt
          || existing.lastModifiedAt.getTime() !== mtime.getTime()) {
        shouldReadTag = true;
      }

      if (!shouldReadTag) continue;

      // 4) read the TXXX/DJBIBLIOTHEK tag
      const tags = await this.tagService.readTags(filePath, ['TXXX:DJBIBLIOTHEK']);
      const raw = tags['TXXX:DJBIBLIOTHEK'];
      const inDjLibrary = typeof raw === 'string' && raw.toLowerCase() !== 'nein';

      // 5) upsert
      if (existing) {
        await this.prisma.sourceFileState.update({
          where: { path: filePath },
          data: {
            lastModifiedAt: mtime,
            inDjLibrary,
            djLastChecked: new Date(),
          },
        });
      } else {
        await this.prisma.sourceFileState.create({
          data: {
            path: filePath,
            lastModifiedAt: mtime,
            inDjLibrary,
            djLastChecked: new Date(),
          },
        });
      }

      updatedCount++;
    }

    return { total: allFiles.length, updated: updatedCount };
  }

  async listInLibrary(): Promise<{ path: string; lastModifiedAt: Date | null }[]> {
    return this.prisma.sourceFileState.findMany({
      where: { inDjLibrary: true },
      select: { path: true, lastModifiedAt: true },
    });
  }
}
