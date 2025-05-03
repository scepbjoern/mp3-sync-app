// packages/main/src/app/bidirectional-sync/bidirectional-sync.service.ts
import { Injectable } from '@nestjs/common';
import { Mp3TagService }   from '../services/mp3-tag.service';
// import { FileSystemService } from '../services/file-system.service';  <-- REMOVE
import { PrismaService }   from '../database/prisma.service';
import { ConfigService }   from '../config/config.service';

interface Conflict { tag: string; a: any; b: any; }

@Injectable()
export class BidirectionalSyncService {
  constructor(
    private tagService: Mp3TagService,
    private prisma:    PrismaService,
    private config:    ConfigService,
  ) {}

  async syncFile(filePath: string): Promise<{
    updatedAtoB: string[];
    updatedBtoA: string[];
    conflicts:   Conflict[];
  }> {
    const bidir = this.config.getBidirectionalTags(); // string[]

    // use prisma.fileMappingState, not .client.fileMappingState
    const record = await this.prisma.fileMappingState.findUnique({
      where: { sourceAPath: filePath },
    });
    if (!record) throw new Error(`No mapping for ${filePath}`);
    const dest = record.sourceBPath!;

    const tagsA = await this.tagService.readTags(filePath, bidir);
    const tagsB = await this.tagService.readTags(dest,    bidir);

    // use prisma.syncStateTag, not .client.syncStateTag
    const syncTags = await this.prisma.syncStateTag.findMany({
      where: { fileMappingStateId: record.id },
    });

    const report = {
      updatedAtoB: [] as string[],
      updatedBtoA: [] as string[],
      conflicts:   [] as Conflict[],
    };

    for (const tag of bidir) {
      // annotate `s` so it's not `any`
      const entry = syncTags.find((s) => s.tagName === tag);
      const lastA = entry?.sourceAValue ?? null;
      const lastB = entry?.sourceBValue ?? null;
      const curA  = tagsA[tag] ?? null;
      const curB  = tagsB[tag] ?? null;

      const aChanged = curA !== lastA;
      const bChanged = curB !== lastB;

      if (aChanged && !bChanged) {
        await this.tagService.writeTags(dest,    { [tag]: curA });
        report.updatedAtoB.push(tag);
      } else if (!aChanged && bChanged) {
        await this.tagService.writeTags(filePath, { [tag]: curB });
        report.updatedBtoA.push(tag);
      } else if (aChanged && bChanged && curA !== curB) {
        report.conflicts.push({ tag, a: curA, b: curB });
      }

      // again use prisma.syncStateTag
      await this.prisma.syncStateTag.upsert({
        where: {
          fileMappingStateId_tagName: {
            fileMappingStateId: record.id,
            tagName:            tag,
          },
        },
        create: {
          fileMappingStateId: record.id,
          tagName:            tag,
          sourceAValue:       String(curA),
          sourceBValue:       String(curB),
        },
        update: {
          sourceAValue: String(curA),
          sourceBValue: String(curB),
        },
      });
    }

    await this.prisma.fileMappingState.update({
      where: { id: record.id },
      data:  { lastSyncTimestamp: new Date() },
    });

    return report;
  }
}
