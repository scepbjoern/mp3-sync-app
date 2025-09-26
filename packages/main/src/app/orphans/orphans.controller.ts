// packages/main/src/app/orphans/orphans.controller.ts
import { Controller, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ipcMain } from 'electron';
import { OrphansService, OrphanScanOptions, CopySpec, OrphanItem } from './orphans.service';
import { ipcSuccess, ipcFailure, IpcResponse } from '../ipc/ipc-response';

@Injectable()
@Controller()
export class OrphansController implements OnModuleInit {
  private readonly logger = new Logger(OrphansController.name);

  constructor(private readonly svc: OrphansService) {}

  onModuleInit() {
    ipcMain.handle('orphans:scan', async (_evt, options?: OrphanScanOptions): Promise<IpcResponse<OrphanItem[]>> => {
      try {
        const data = await this.svc.scan(options ?? {});
        return ipcSuccess(data);
      } catch (err) {
        this.logger.error('orphans:scan failed', err);
        return ipcFailure(err, 'Failed to scan orphans');
      }
    });

    ipcMain.handle('orphans:delete', async (_evt, payload: { paths: string[] }): Promise<IpcResponse<{ deleted: number; errors: { path: string; error: string }[] }>> => {
      try {
        const { paths } = payload ?? { paths: [] };
        const data = await this.svc.deleteFiles(paths);
        return ipcSuccess(data);
      } catch (err) {
        this.logger.error('orphans:delete failed', err);
        return ipcFailure(err, 'Failed to delete files');
      }
    });

    ipcMain.handle('orphans:unmap', async (_evt, payload: { ids: number[] }): Promise<IpcResponse<{ unmapped: number; errors: { id: number; error: string }[] }>> => {
      try {
        const { ids } = payload ?? { ids: [] };
        const data = await this.svc.unmap(ids);
        return ipcSuccess(data);
      } catch (err) {
        this.logger.error('orphans:unmap failed', err);
        return ipcFailure(err, 'Failed to unmap');
      }
    });

    ipcMain.handle('orphans:copy', async (_evt, payload: { specs: CopySpec[] }): Promise<IpcResponse<{ copied: number; createdMappings: number; errors: { aPath: string; bPath: string; error: string }[] }>> => {
      try {
        const { specs } = payload ?? { specs: [] };
        const data = await this.svc.copy(specs);
        return ipcSuccess(data);
      } catch (err) {
        this.logger.error('orphans:copy failed', err);
        return ipcFailure(err, 'Failed to copy files');
      }
    });

    ipcMain.handle('orphans:compute-mirror', async (_evt, payload: { aPath: string }): Promise<IpcResponse<{ dest: string }>> => {
      try {
        const aPath = payload?.aPath;
        if (typeof aPath !== 'string' || aPath.trim().length === 0) {
          throw new Error('aPath is required');
        }
        const dest = await this.svc.computeMirrorDestination(aPath);
        return ipcSuccess({ dest });
      } catch (err) {
        this.logger.error('orphans:compute-mirror failed', err);
        return ipcFailure(err, 'Failed to compute mirror destination');
      }
    });
  }
}
