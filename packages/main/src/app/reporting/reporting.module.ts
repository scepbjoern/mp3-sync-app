// packages/main/src/app/reporting/reporting.module.ts
import { Module } from '@nestjs/common';
import { ReportingService } from './reporting.service';
import { DatabaseModule } from '../database/database.module';
import { ReportingController } from './reporting.controller';
import { M3UPlaylistService } from './m3u-playlist.service';
import { Mp3TagModule } from '../services/mp3-tag.module';

@Module({
  imports: [DatabaseModule, Mp3TagModule],
  providers: [ReportingService, M3UPlaylistService],
  controllers: [ReportingController],
  exports: [ReportingService, M3UPlaylistService],
})
export class ReportingModule {}
