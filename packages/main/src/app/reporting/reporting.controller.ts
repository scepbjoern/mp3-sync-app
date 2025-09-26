// packages/main/src/app/reporting/reporting.controller.ts
import { Controller, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ipcMain } from 'electron';
import { ipcSuccess, ipcFailure, IpcResponse } from '../ipc/ipc-response';
import { ReportingService, ListRunsFilter, RunChangeFilter } from './reporting.service';

@Injectable()
@Controller()
export class ReportingController implements OnModuleInit {
  private readonly logger = new Logger(ReportingController.name);
  constructor(private readonly reporting: ReportingService) {}

  onModuleInit() {
    ipcMain.handle('reporting:list-runs', async (_evt, filter?: Partial<ListRunsFilter>): Promise<IpcResponse<any>> => {
      try {
        const data = await this.reporting.listRuns({
          from: filter?.from ? new Date(filter.from) : undefined,
          to: filter?.to ? new Date(filter.to) : undefined,
        });
        return ipcSuccess(data);
      } catch (err) {
        this.logger.error('reporting:list-runs failed', err);
        return ipcFailure(err, 'Failed to list sync runs');
      }
    });

    ipcMain.handle('reporting:list-changes', async (_evt, payload: { runId: number; filter?: RunChangeFilter }): Promise<IpcResponse<any>> => {
      try {
        if (!payload || typeof payload.runId !== 'number') {
          throw new Error('runId is required');
        }
        const data = await this.reporting.getRunChanges(payload.runId, payload.filter ?? {});
        return ipcSuccess(data);
      } catch (err) {
        this.logger.error('reporting:list-changes failed', err);
        return ipcFailure(err, 'Failed to list run changes');
      }
    });
  }
}
