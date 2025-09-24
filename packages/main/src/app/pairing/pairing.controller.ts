// packages/main/src/app/pairing/pairing.controller.ts
import { Controller, Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ipcMain } from 'electron';
import { PairingService } from './pairing.service';

interface IpcResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: { message: string };
}

type PairingEntry = {
  sourceAPath: string;
  sourceBPath: string;
};

const toErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return typeof error === 'string' ? error : 'Unknown error';
};

@Injectable()
@Controller()
export class PairingController implements OnModuleInit {
  private readonly logger = new Logger(PairingController.name);

  constructor(private readonly pairing: PairingService) {}

  onModuleInit() {
    ipcMain.handle(
      'pairing:save-mappings',
      async (_evt, entries: PairingEntry[]): Promise<IpcResponse<{ count: number }>> => {
        this.logger.log(`Saving ${entries.length} mappings…`);
        try {
          const count = await this.pairing.upsertMappings(entries);
          return { success: true, data: { count } };
        } catch (error: unknown) {
          this.logger.error('pairing:save-mappings error', error);
          return { success: false, error: { message: toErrorMessage(error) } };
        }
      },
    );

    ipcMain.handle('pairing:get-mappings', async (): Promise<IpcResponse<PairingEntry[]>> => {
        try {
          const mappings = await this.pairing.getMappings();
          return { success: true, data: mappings };
        } catch (error: unknown) {
          this.logger.error('Error in pairing:get-mappings', error);
          return { success: false, error: { message: toErrorMessage(error) } };
        }
      });

  }
}
