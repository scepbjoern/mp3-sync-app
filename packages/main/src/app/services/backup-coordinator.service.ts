// packages/main/src/app/services/backup-coordinator.service.ts
import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { ConfigService } from '../config/config.service';

@Injectable()
export class BackupCoordinatorService {
  private readonly logger = new Logger(BackupCoordinatorService.name);

  constructor(private readonly config: ConfigService) {}

  /** Copies file to backup folder, preserving relative path under a dated subfolder */
  async backupFile(absFilePath: string): Promise<string | null> {
    try {
      const backupBase = this.config.getBackupPath();
      const datePart = new Date().toISOString().replace(/[:.]/g, '-');
      // Flatten drive letter for Windows into folder name
      const normalized = absFilePath.replace(/^[A-Za-z]:\\?/, (m) => m.replace(':', '')); // E.g., C: -> C
      const relLike = normalized.replace(/^[\\/]+/, '');
      const targetDir = path.join(backupBase, datePart, path.dirname(relLike));
      await fs.mkdir(targetDir, { recursive: true });
      const targetPath = path.join(targetDir, path.basename(absFilePath));
      await fs.copyFile(absFilePath, targetPath);
      this.logger.debug(`Backed up ${absFilePath} -> ${targetPath}`);
      return targetPath;
    } catch (err) {
      this.logger.warn(`Backup failed for ${absFilePath}: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
  }
}
