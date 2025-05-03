import { Controller, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ipcMain } from 'electron';
import { SourceFileStateService } from '../source-file-state/source-file-state.service';

interface IpcResponse<T = any> {
  success: boolean;
  data?: T;
  error?: { message: string };
}

@Injectable()
@Controller()
export class SourceFileController implements OnModuleInit {
  private readonly logger = new Logger(SourceFileController.name);

  constructor(private readonly stateService: SourceFileStateService) {}

  onModuleInit() {
    const channel = 'scan:source-files';
    ipcMain.removeHandler(channel);
    ipcMain.handle(channel, async (): Promise<IpcResponse<{ total: number; updated: number }>> => {
      this.logger.log(`IPC ${channel} invoked`);
      try {
        const result = await this.stateService.scanAndUpdate();
        return { success: true, data: result };
      } catch (err: any) {
        this.logger.error(`${channel} error`, err);
        return { success: false, error: { message: err.message } };
      }
    });

    ipcMain.handle(
      'get:in-library-files',
      async (): Promise<IpcResponse<{ path: string; lastModifiedAt: Date | null }[]>> => {
        this.logger.log('IPC get:in-library-files');
        try {
          const list = await this.stateService.listInLibrary();
          return { success: true, data: list };
        } catch (err: any) {
          this.logger.error('get:in-library-files error', err);
          return { success: false, error: { message: err.message } };
        }
      },
    );
  }
}
