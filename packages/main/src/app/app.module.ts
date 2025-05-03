// packages/main/src/app/app.module.ts
import { Module } from '@nestjs/common';

import { ConfigModule }           from './config/config.module';
import { LoggerModule }           from './logger/logger.module';
import { DatabaseModule }         from './database/database.module';
import { FileSystemModule }       from './services/file-system.module';
import { Mp3TagModule }           from './services/mp3-tag.module';
import { SourceFileStateModule }  from './source-file-state/source-file-state.module';
import { PairingModule }          from './pairing/pairing.module';

@Module({
  imports: [
    // Globale Config (lädt ConfigService + ConfigController)
    ConfigModule,

    // Logging (LoggerService)
    LoggerModule,

    // Datenbank (PrismaService)
    DatabaseModule,

    // Dateisystem-Scan (FileSystemService + FileSystemController)
    FileSystemModule,

    // MP3-Tag-Service (Mp3TagService)
    Mp3TagModule,

    // Source-File-State (SourceFileStateService + Controller)
    SourceFileStateModule,

    // Initial-Pairing (PairingService + PairingController)
    PairingModule,
  ],
})
export class AppModule {}
