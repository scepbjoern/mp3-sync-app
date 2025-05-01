// packages/main/src/app/logger/logger.module.ts (Simplified)
import { Module } from '@nestjs/common';
import { LoggerService } from './logger.service';
// ConfigModule is Global

@Module({
  providers: [LoggerService],
  exports: [LoggerService],
})
export class LoggerModule {}