// packages/main/src/app/controllers/pairing.controller.ts
import { Controller, Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ipcMain } from 'electron';
import { PrismaService } from '../database/prisma.service';

interface IpcResponse<T = any> {
  success: boolean;
  data?: T;
  error?: { message: string };
}

@Injectable()
@Controller()
export class PairingController implements OnModuleInit {
  private readonly logger = new Logger(PairingController.name);

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    // 1) Existierende Mappings abfragen
    ipcMain.handle('pairing:get-mappings', async (): Promise<IpcResponse<{ sourceAPath: string; sourceBPath: string }[]>> => {
      try {
        const rows = await this.prisma.fileMappingState.findMany({
          select: { sourceAPath: true, sourceBPath: true },
        });
        return { success: true, data: rows };
      } catch (err: any) {
        this.logger.error('pairing:get-mappings error', err);
        return { success: false, error: { message: err.message } };
      }
    });

    // 2) Bestehender Save-Handler (bereits vorhanden)
    // ipcMain.handle('pairing:save-mappings', …)

    this.logger.log('Pairing IPC handlers registered.');
  }
}
