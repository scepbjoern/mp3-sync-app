// packages/main/src/app/pairing/pairing.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

interface MappingEntry {
  sourceAPath: string;
  sourceBPath: string;
}

@Injectable()
export class PairingService {
  private readonly logger = new Logger(PairingService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Upsert each mapping into FileMappingState. Returns count saved. */
  async upsertMappings(entries: MappingEntry[]): Promise<number> {
    let count = 0;
    for (const { sourceAPath, sourceBPath } of entries) {
        await this.prisma.fileMappingState.upsert({
        where: { sourceAPath },
        create: { sourceAPath, sourceBPath },
        update: { sourceBPath },
      });
      count++;
    }
    this.logger.log(`Upserted ${count} mappings`);
    return count;
  }

  async getMappings(): Promise<{ sourceAPath: string; sourceBPath: string }[]> {
    return this.prisma.fileMappingState.findMany({
      select: { sourceAPath: true, sourceBPath: true },
    });
  }

  async saveMappings(entries: { sourceAPath: string; sourceBPath: string }[]): Promise<{ count: number }> {
    // hier z.B. upsert pro Eintrag …
    let count = 0;
    for (const e of entries) {
      await this.prisma.fileMappingState.upsert({
        where: { sourceAPath: e.sourceAPath },
        create: e,
        update: { sourceBPath: e.sourceBPath },
      });
      count++;
    }
    return { count };
  }
}
