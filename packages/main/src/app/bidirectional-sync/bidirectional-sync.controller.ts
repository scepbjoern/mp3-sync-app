import { Injectable, Logger, OnModuleInit, Controller } from '@nestjs/common';
import { ipcMain } from 'electron';
import { BidirectionalSyncService } from './bidirectional-sync.service';

interface IpcResponse<T = any> {
  success: boolean;
  data?: T;
  error?: { message: string };
}

@Injectable()
@Controller()
export class BidirectionalSyncController implements OnModuleInit {
  private readonly logger = new Logger(BidirectionalSyncController.name);

  constructor(private readonly sync: BidirectionalSyncService) {}

  onModuleInit() {
    ipcMain.handle(
      'sync:bidirectional',
      async (_evt, sourceAPath: string): Promise<IpcResponse<{
        updatedAtoB: string[];
        updatedBtoA: string[];
        conflicts: { tag: string; a: any; b: any }[];
      }>> => {
        this.logger.log(`Bidirectional sync requested for ${sourceAPath}`);
        try {
          const report = await this.sync.syncFile(sourceAPath);
          return { success: true, data: report };
        } catch (err: any) {
          this.logger.error('sync:bidirectional error', err);
          return { success: false, error: { message: err.message } };
        }
      }
    );
  }
}
