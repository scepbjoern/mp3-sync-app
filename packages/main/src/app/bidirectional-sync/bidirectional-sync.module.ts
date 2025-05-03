// packages/main/src/app/bidirectional-sync/bidirectional-sync.module.ts
import { Module } from '@nestjs/common';
import { BidirectionalSyncService }     from './bidirectional-sync.service';
import { BidirectionalSyncController }  from './bidirectional-sync.controller';
import { Mp3TagModule }                 from '../services/mp3-tag.module';
import { FileSystemModule }             from '../services/file-system.module';
import { ConfigModule }                 from '../config/config.module';
import { DatabaseModule }               from '../database/database.module';         // provides PrismaService
import { SourceFileStateModule }        from '../source-file-state/source-file-state.module';

@Module({
  imports: [
    Mp3TagModule,           // so Mp3TagService is available
    FileSystemModule,       // so FileSystemService is available
    ConfigModule,           // so ConfigService is available
    DatabaseModule,         // so PrismaService is available
    SourceFileStateModule,  // so listInLibrary/scanAndUpdate is available
  ],
  providers:   [BidirectionalSyncService],
  controllers: [BidirectionalSyncController],
  exports: [BidirectionalSyncService],
})
export class BidirectionalSyncModule {}
