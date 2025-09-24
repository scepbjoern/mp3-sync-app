import { Injectable, Logger, OnModuleInit, Controller } from '@nestjs/common';
import { ipcMain } from 'electron';
import { SyncService, PreviewEntry } from './sync.service';
import { ipcFailure, ipcSuccess, IpcResponse } from '../ipc/ipc-response';

@Injectable()
@Controller()
export class SyncController implements OnModuleInit {
  private readonly logger = new Logger(SyncController.name);

  constructor(private readonly sync: SyncService) {}

  onModuleInit() {
    ipcMain.handle('sync:preview', async (): Promise<IpcResponse<PreviewEntry[]>> => {
      try {
        const data = await this.sync.previewSync();
        return ipcSuccess(data);
      } catch (err) {
        this.logger.error('sync:preview failed', err);
        return ipcFailure(err, 'Failed to preview sync');
      }
    });

    ipcMain.handle('sync:run', async (): Promise<IpcResponse<{
      applied: number;
      conflicts: Array<{ source: string; tag: string; a: any; b: any }>;
    }>> => {
      try {
        const data = await this.sync.runSync();
        return ipcSuccess(data);
      } catch (err) {
        this.logger.error('sync:run failed', err);
        return ipcFailure(err, 'Failed to run sync');
      }
    });
  }
}
