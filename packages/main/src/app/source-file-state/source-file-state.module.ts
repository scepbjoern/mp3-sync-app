// packages/main/src/app/source-file-state/source-file-state.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule }         from '../config/config.module';
import { DatabaseModule }       from '../database/database.module';
import { FileSystemModule }     from '../services/file-system.module';
import { Mp3TagModule }         from '../services/mp3-tag.module';

import { SourceFileStateService } from './source-file-state.service';
import { SourceFileController }   from './source-file.controller';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,    // <-- must pull in PrismaService
    FileSystemModule,
    Mp3TagModule,
  ],
  providers: [SourceFileStateService],
  controllers: [SourceFileController],
  exports: [SourceFileStateService],
})
export class SourceFileStateModule {}
