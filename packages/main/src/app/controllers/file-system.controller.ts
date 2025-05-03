import {
  Controller,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { app, ipcMain, dialog, shell } from 'electron';
import path from 'path';
import { FileSystemService } from '../services/file-system.service';

interface IpcResponse<T = any> {
  success: boolean;
  data?: T;
  error?: { message: string; code?: string };
}

@Injectable()
@Controller()
export class FileSystemController implements OnModuleInit {
  private readonly logger = new Logger(FileSystemController.name);

  constructor(private readonly fileSystemService: FileSystemService) {}

  onModuleInit() {
    this.registerScanDirectoryHandler();
    this.registerDialogHandlers();
  }

  private registerScanDirectoryHandler() {
    const channel = 'filesystem:scan-directory';
    ipcMain.removeHandler(channel);
    ipcMain.handle(channel, async (_evt, dirPath: string): Promise<IpcResponse<string[]>> => {
      this.logger.log(`[${channel}] Path: ${dirPath}`);
      if (!dirPath || typeof dirPath !== 'string') {
        const msg = 'Invalid directory path provided.';
        this.logger.warn(`[${channel}] ${msg}`);
        return { success: false, error: { message: msg } };
      }
      try {
        const fileList = await this.fileSystemService.scanDirectory(dirPath);
        this.logger.log(`[${channel}] Found ${fileList.length} MP3 files`);
        return { success: true, data: fileList };
      } catch (err: any) {
        this.logger.error(`[${channel}]`, err);
        return {
          success: false,
          error: { message: err?.message ?? 'Unknown scan error' },
        };
      }
    });
  }

  private registerDialogHandlers() {
    // ─── select-directory ─────────────────────────────
    const selectChannel = 'dialog:select-directory';
    ipcMain.removeHandler(selectChannel);
    ipcMain.handle(selectChannel, async () => {
      const result = await dialog.showOpenDialog({ properties: ['openDirectory'] });
      if (result.canceled || result.filePaths.length === 0) {
        return null;
      }
      return result.filePaths[0];
    });

    // ─── show-config-file ───────────────────────────
    const showCfgChannel = 'dialog:show-config-file';
    ipcMain.removeHandler(showCfgChannel);
    ipcMain.handle(showCfgChannel, async (): Promise<IpcResponse<void>> => {
      const cfgPath = path.join(app.getPath('userData'), 'config.json');
      shell.showItemInFolder(cfgPath);
      return { success: true };
    });

    this.logger.log('Dialog IPC handlers registered.');
  }
}
