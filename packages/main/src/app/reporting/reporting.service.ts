// packages/main/src/app/reporting/reporting.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

export type ChangeStatus = 'APPLIED' | 'CONFLICT';
export type ChangeDirection = 'A_TO_B' | 'B_TO_A' | null;

export interface ListRunsFilter {
  from?: Date;
  to?: Date;
}

export interface RunSummary {
  id: number;
  startedAt: Date;
  finishedAt: Date | null;
  appliedCount: number;
  conflictCount: number;
}

export interface RunChangeFilter {
  status?: ChangeStatus | 'ALL';
  tagQuery?: string; // substring match (case-insensitive)
  pathQuery?: string; // substring match on source or dest paths
  page?: number; // 1-based
  pageSize?: number; // default 100
}

@Injectable()
export class ReportingService {
  private readonly logger = new Logger(ReportingService.name);

  constructor(private readonly prisma: PrismaService) {}

  async startRun(): Promise<number> {
    const run = await this.prisma.syncRun.create({ data: {} });
    this.logger.log(`Reporting: started run ${run.id}`);
    return run.id;
  }

  async finishRun(runId: number, applied: number, conflicts: number): Promise<void> {
    await this.prisma.syncRun.update({
      where: { id: runId },
      data: { finishedAt: new Date(), appliedCount: applied, conflictCount: conflicts },
    });
    this.logger.log(`Reporting: finished run ${runId} (applied=${applied}, conflicts=${conflicts})`);
  }

  async recordApplied(params: {
    runId: number;
    mappingId: number | null;
    sourceAPath: string;
    sourceBPath: string;
    tag: string;
    direction: Exclude<ChangeDirection, null>;
    fromValue: string | null;
    toValue: string | null;
  }): Promise<void> {
    await this.prisma.syncChange.create({
      data: {
        runId: params.runId,
        mappingId: params.mappingId ?? null,
        sourceAPath: params.sourceAPath,
        sourceBPath: params.sourceBPath,
        tag: params.tag,
        direction: params.direction,
        status: 'APPLIED',
        fromValue: params.fromValue ?? null,
        toValue: params.toValue ?? null,
      },
    });
  }

  async recordConflict(params: {
    runId: number;
    mappingId: number | null;
    sourceAPath: string;
    sourceBPath: string;
    tag: string;
    aValue: string | null;
    bValue: string | null;
  }): Promise<void> {
    await this.prisma.syncChange.create({
      data: {
        runId: params.runId,
        mappingId: params.mappingId ?? null,
        sourceAPath: params.sourceAPath,
        sourceBPath: params.sourceBPath,
        tag: params.tag,
        direction: null,
        status: 'CONFLICT',
        fromValue: params.aValue,
        toValue: params.bValue,
      },
    });
  }

  async listRuns(filter: ListRunsFilter = {}): Promise<RunSummary[]> {
    const where: any = {};
    if (filter.from || filter.to) {
      where.startedAt = {} as any;
      if (filter.from) (where.startedAt as any).gte = filter.from;
      if (filter.to) (where.startedAt as any).lte = filter.to;
    }
    const runs = await this.prisma.syncRun.findMany({
      where,
      orderBy: { startedAt: 'desc' },
      select: { id: true, startedAt: true, finishedAt: true, appliedCount: true, conflictCount: true },
    });
    return runs;
  }

  async getRunChanges(runId: number, filter: RunChangeFilter = {}) {
    const pageSize = Math.max(1, Math.min(1000, filter.pageSize ?? 100));
    const page = Math.max(1, filter.page ?? 1);

    const where: any = { runId };
    if (filter.status && filter.status !== 'ALL') {
      where.status = filter.status;
    }
    if (filter.tagQuery && filter.tagQuery.trim() !== '') {
      where.tag = { contains: filter.tagQuery, mode: 'insensitive' };
    }
    if (filter.pathQuery && filter.pathQuery.trim() !== '') {
      const q = filter.pathQuery;
      // emulate OR on two fields
      where.AND = [
        {
          OR: [
            { sourceAPath: { contains: q, mode: 'insensitive' } },
            { sourceBPath: { contains: q, mode: 'insensitive' } },
          ],
        },
      ];
    }

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.syncChange.count({ where }),
      this.prisma.syncChange.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          createdAt: true,
          mappingId: true,
          sourceAPath: true,
          sourceBPath: true,
          tag: true,
          status: true,
          direction: true,
          fromValue: true,
          toValue: true,
        },
      }),
    ]);

    return { total, page, pageSize, rows };
  }
}
