// packages/main/src/app/app.module.ts (Test Logger + Config Only)
import { Module } from '@nestjs/common';
// import { DatabaseModule } from './database/database.module'; // Keep Commented
// import { FileSystemModule } from './services/file-system.module'; // Keep Commented
// import { Mp3TagModule } from './services/mp3-tag.module'; // Keep Commented
import { ConfigModule } from './config/config.module'; // Keep Imported (or rely on @Global)
import { LoggerModule } from './logger/logger.module'; // <-- UNCOMMENT THIS

@Module({
  imports: [
      ConfigModule, // Keep Imported
      LoggerModule, // <-- UNCOMMENT THIS
      // DatabaseModule,
      // FileSystemModule,
      // Mp3TagModule,
  ],
  controllers: [], // Keep empty for now
  providers: [],
})
export class AppModule {}