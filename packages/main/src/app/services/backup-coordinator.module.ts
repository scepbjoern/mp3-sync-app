// packages/main/src/app/services/backup-coordinator.module.ts
import { Module } from '@nestjs/common';
import { BackupCoordinatorService } from './backup-coordinator.service';

@Module({
  providers: [BackupCoordinatorService],
  exports: [BackupCoordinatorService],
})
export class BackupCoordinatorModule {}
