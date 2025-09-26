import { Module } from '@nestjs/common';
import { SyncService } from './sync.service';
import { SyncController } from './sync.controller';
import { FileSystemModule } from '../services/file-system.module';
import { Mp3TagModule } from '../services/mp3-tag.module';
import { TagTransformerModule } from '../services/tag-transformer.module';
import { PairingModule } from '../pairing/pairing.module';
import { SourceFileStateModule } from '../source-file-state/source-file-state.module';
import { BackupCoordinatorModule } from '../services/backup-coordinator.module';

@Module({
  imports: [
    FileSystemModule,
    Mp3TagModule,
    TagTransformerModule,
    PairingModule,
    SourceFileStateModule,
    BackupCoordinatorModule,
  ],
  providers: [SyncService],
  controllers: [SyncController],
})
export class SyncModule {}
