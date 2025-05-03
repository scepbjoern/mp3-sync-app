// packages/main/src/app/pairing/pairing.controller.ts
import { Controller, Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ipcMain } from 'electron';
import { PairingService } from './pairing.service';

interface IpcResponse<T = any> {
  success: boolean;
  data?: T;
  error?: { message: string };
}

@Injectable()
@Controller()
export class PairingController implements OnModuleInit {
  private readonly logger = new Logger(PairingController.name);

  constructor(private readonly pairing: PairingService) {}

  onModuleInit() {
    ipcMain.handle(
      'pairing:save-mappings',
      async (_evt, entries: { sourceAPath: string; sourceBPath: string }[]): Promise<IpcResponse<{ count: number }>> => {
        this.logger.log(`Saving ${entries.length} mappings…`);
        try {
          const count = await this.pairing.upsertMappings(entries);
          return { success: true, data: { count } };
        } catch (err: any) {
          this.logger.error('pairing:save-mappings error', err);
          return { success: false, error: { message: err.message } };
        }
      },
    );

    ipcMain.handle('pairing:get-mappings', async (): Promise<IpcResponse<{ sourceAPath: string; sourceBPath: string }[]>> => {
        try {
          const mappings = await this.pairing.getMappings();
          return { success: true, data: mappings };
        } catch (err: any) {
          this.logger.error('Error in pairing:get-mappings', err);
          return { success: false, error: { message: err.message } };
        }
      });

  }
}
