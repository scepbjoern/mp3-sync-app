// packages/main/src/app/orphans/orphans.module.ts
import { Module } from '@nestjs/common';
import { OrphansService } from './orphans.service';
import { OrphansController } from './orphans.controller';
import { ConfigModule } from '../config/config.module';
import { DatabaseModule } from '../database/database.module';
import { FileSystemModule } from '../services/file-system.module';
import { Mp3TagModule } from '../services/mp3-tag.module';

@Module({
  imports: [ConfigModule, DatabaseModule, FileSystemModule, Mp3TagModule],
  providers: [OrphansService],
  controllers: [OrphansController],
  exports: [OrphansService],
})
export class OrphansModule {}
