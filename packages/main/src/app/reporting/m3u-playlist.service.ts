// packages/main/src/app/reporting/m3u-playlist.service.ts
import { Injectable, Logger } from '@nestjs/common';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import { PrismaService } from '../database/prisma.service';
import { ConfigService } from '../config/config.service';
import { Mp3TagService } from '../services/mp3-tag.service';

export interface ConflictM3UOptions {
  source?: 'A' | 'B';
  includeHeader?: boolean; // default true
  destDir?: string;        // default: <configDir>/playlists
  fileName?: string;       // default: conflicts-run-<id>-<A|B>.m3u
}

@Injectable()
export class M3UPlaylistService {
  private readonly logger = new Logger(M3UPlaylistService.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private tags: Mp3TagService,
  ) {}

  async generateConflictM3U(runId: number, options: ConflictM3UOptions = {}): Promise<{ filePath: string; count: number }> {
    const source = options.source ?? 'A';
    const includeHeader = options.includeHeader !== false;

    const rows = await this.prisma.syncChange.findMany({
      where: { runId, status: 'CONFLICT' },
      select: { sourceAPath: true, sourceBPath: true },
      orderBy: { createdAt: 'asc' },
    });

    const unique = new Set<string>();
    for (const r of rows) {
      const p = source === 'A' ? r.sourceAPath : r.sourceBPath;
      if (p) unique.add(p);
    }
    const list = Array.from(unique.values());

    const baseDir = options.destDir ?? this.config.getPlaylistDirectory();
    await fs.mkdir(baseDir, { recursive: true });
    const fileName = options.fileName ?? `conflicts-run-${runId}-${source}.m3u`;
    const filePath = path.join(baseDir, fileName);

    const lines: string[] = [];
    if (includeHeader) lines.push('#EXTM3U');

    for (const p of list) {
      const extinf = await this.buildExtInf(p);
      if (extinf) lines.push(`#EXTINF:-1,${extinf}`);
      else if (includeHeader) lines.push('#EXTINF:-1,');
      lines.push(p);
    }

    const content = lines.join('\n') + (lines.length ? '\n' : '');
    await fs.writeFile(filePath, content, 'utf-8');
    this.logger.log(`Wrote conflict M3U (${list.length} paths) to ${filePath}`);

    return { filePath, count: list.length };
  }

  private async buildExtInf(filePath: string): Promise<string | null> {
    try {
      const tags = await this.tags.readTags(filePath, ['TPE1', 'TIT2']);
      const artist = (tags?.TPE1 && String(tags.TPE1).trim()) || '';
      const title = (tags?.TIT2 && String(tags.TIT2).trim()) || '';
      if (!artist && !title) return null;
      if (artist && title) return `${artist} - ${title}`;
      return artist || title;
    } catch (err) {
      this.logger.warn(`Failed to read tags for ${filePath}: ${(err as Error).message}`);
      return null;
    }
  }
}
