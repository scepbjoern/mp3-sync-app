// packages/main/src/app/app.module.ts
import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module'; // Import DatabaseModule
import { FileSystemModule } from './services/file-system.module';
import { Mp3TagModule } from './services/mp3-tag.module';
import { ConfigModule } from './config/config.module';
import { LoggerModule } from './logger/logger.module';

@Module({
  imports: [DatabaseModule,
    FileSystemModule,
    Mp3TagModule,
    ConfigModule,
  LoggerModule]
})
export class AppModule { }
