import {
  Controller,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { app, ipcMain, dialog, shell } from 'electron';
import path from 'path';
import { FileSystemService } from '../services/file-system.service';
import {
  assertNonEmptyString,
  ipcFailure,
  ipcSuccess,
  IpcResponse,
} from '../ipc/ipc-response';

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
      try {
        const safePath = assertNonEmptyString(dirPath, 'Directory path');
        const fileList = await this.fileSystemService.scanDirectory(safePath);
        this.logger.log(`[${channel}] Found ${fileList.length} MP3 files`);
        return ipcSuccess(fileList);
      } catch (err) {
        this.logger.error(`[${channel}]`, err);
        return ipcFailure(err, 'Failed to scan directory');
      }
    });
  }

  private registerDialogHandlers() {
    // ─── select-directory ─────────────────────────────
    const selectChannel = 'dialog:select-directory';
    ipcMain.removeHandler(selectChannel);
    ipcMain.handle(selectChannel, async (): Promise<IpcResponse<string | null>> => {
      const result = await dialog.showOpenDialog({ properties: ['openDirectory'] });
      if (result.canceled || result.filePaths.length === 0) {
        return ipcSuccess(null);
      }
      return ipcSuccess(result.filePaths[0]);
    });

    // ─── show-config-file ───────────────────────────
    const showCfgChannel = 'dialog:show-config-file';
    ipcMain.removeHandler(showCfgChannel);
    ipcMain.handle(showCfgChannel, async (): Promise<IpcResponse<void>> => {
      const cfgPath = path.join(app.getPath('userData'), 'config.json');
      shell.showItemInFolder(cfgPath);
      return ipcSuccess();
    });

    this.logger.log('Dialog IPC handlers registered.');
  }
}
