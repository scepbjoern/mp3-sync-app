// packages/main/src/app/pairing/pairing.controller.ts
import { Controller, Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ipcMain } from 'electron';
import {
  PairingScanOptions,
  PairingScanResult,
  PairingService,
  MappingRow,
  UpdateMappingRequest,
  UpdateMappingResponse,
} from './pairing.service';
import { IpcResponse, ipcSuccess, ipcFailure } from '../ipc/ipc-response';

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
      'pairing:start-initial-scan',
      async (_evt, options: PairingScanOptions = {}): Promise<IpcResponse<PairingScanResult>> => {
        this.logger.log(`Initial pairing scan requested (includeNonDj=${options.includeNonDj ?? false})`);
        try {
          const result = await this.pairing.initialScan(options);
          return ipcSuccess(result);
        } catch (error: unknown) {
          this.logger.error('pairing:start-initial-scan error', error);
          return ipcFailure(error, toErrorMessage(error));
        }
      },
    );

    ipcMain.handle(
      'pairing:save-mappings',
      async (_evt, entries: PairingEntry[]): Promise<IpcResponse<{ count: number }>> => {
        this.logger.log(`Saving ${entries.length} mappings…`);
        try {
          const count = await this.pairing.upsertMappings(entries);
          return ipcSuccess({ count });
        } catch (error: unknown) {
          this.logger.error('pairing:save-mappings error', error);
          return ipcFailure(error, toErrorMessage(error));
        }
      },
    );

    ipcMain.handle(
      'pairing:submit-decisions',
      async (_evt, entries: PairingEntry[]): Promise<IpcResponse<{ count: number }>> => {
        this.logger.log(`Submit decisions: ${entries.length} entries…`);
        try {
          const count = await this.pairing.upsertMappings(entries);
          return ipcSuccess({ count });
        } catch (error: unknown) {
          this.logger.error('pairing:submit-decisions error', error);
          return ipcFailure(error, toErrorMessage(error));
        }
      },
    );

    ipcMain.handle('pairing:get-mappings', async (): Promise<IpcResponse<PairingEntry[]>> => {
      try {
        const mappings = await this.pairing.getMappings();
        return ipcSuccess(mappings);
      } catch (error: unknown) {
        this.logger.error('Error in pairing:get-mappings', error);
        return ipcFailure(error, toErrorMessage(error));
      }
    });

    // UC5: Mapping Maintenance
    ipcMain.handle('mappings:get-all', async (): Promise<IpcResponse<MappingRow[]>> => {
      try {
        const data = await this.pairing.getAllMappingsDetailed();
        return ipcSuccess(data);
      } catch (error: unknown) {
        this.logger.error('mappings:get-all error', error);
        return ipcFailure(error, toErrorMessage(error));
      }
    });

    ipcMain.handle(
      'mappings:update-paths',
      async (_evt, payload: UpdateMappingRequest[]): Promise<IpcResponse<UpdateMappingResponse>> => {
        try {
          const data = await this.pairing.updatePaths(payload);
          return ipcSuccess(data);
        } catch (error: unknown) {
          this.logger.error('mappings:update-paths error', error);
          return ipcFailure(error, toErrorMessage(error));
        }
      },
    );

  }
}
