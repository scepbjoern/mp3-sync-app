// packages/main/src/app/logger/logger.service.ts (Restore Full Implementation)
import { Injectable, LoggerService as NestLoggerService, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '../config/config.service';
import pino, { Logger as PinoLogger } from 'pino';

@Injectable()
export class LoggerService implements NestLoggerService, OnModuleInit {
  // Use definite assignment assertion '!' as it's initialized in onModuleInit
  private pinoLogger!: PinoLogger;

  // Inject ConfigService - Make sure it's private again if you made it public for testing
  constructor(private readonly configService: ConfigService) {}

  // Initialize Pino logger here, AFTER ConfigService is ready
  onModuleInit() {
    const isProduction = process.env.NODE_ENV === 'production';
    // Get values from the now-initialized ConfigService
    const fileLogLevel = this.configService.getLogLevel() || 'info';
    const logFilePath = this.configService.getLogFilePath(); // Uses default path if null in config

    if (!logFilePath) {
      console.error("CRITICAL: Log file path is not configured. File logging disabled.");
      // Fallback to basic console logger
      this.pinoLogger = pino({ level: isProduction ? 'info' : 'debug' });
      this.pinoLogger.warn('File logging disabled due to missing logFilePath.');
      return;
    }

    const targets: pino.TransportTargetOptions[] = [];

    // Console Target
    targets.push({
      target: isProduction ? 'pino/file' : 'pino-pretty', // Use pino-pretty only in dev
      level: isProduction ? 'info' : 'debug', // Console level
      options: isProduction
        ? { destination: 1 } // stdout (JSON format)
        : { // pino-pretty options
            colorize: true,
            translateTime: 'SYS:yyyy-mm-dd HH:MM:ss.l',
            ignore: 'pid,hostname',
          },
    });

    // File Target
    targets.push({
      target: 'pino/file',
      level: fileLogLevel, // Use level from config for the file
      options: {
        destination: logFilePath,
        mkdir: true, // Create directory if needed
        append: true, // Append to log file
      },
    });

    this.pinoLogger = pino({
      level: 'trace', // Set base pino level low; transport levels control actual output
      transport: { targets },
    });

    this.pinoLogger.info(`Logger initialized. Console Level: ${isProduction ? 'info' : 'debug'}, File Level: ${fileLogLevel}, File Path: ${logFilePath}`);
  }

  // --- LoggerService Interface Methods ---
  log(message: any, context?: string) {
    // Check if pinoLogger is initialized before using (extra safety)
    if (!this.pinoLogger) return console.log(`[${context || ''}] ${message}`); // Fallback if init failed
    if (context) { this.pinoLogger.info({ context }, message); }
    else { this.pinoLogger.info(message); }
  }

  error(message: any, trace?: string, context?: string) {
    if (!this.pinoLogger) return console.error(`[${context || ''}] ${message}`, trace);
    // Pass context/trace object to pino
    this.pinoLogger.error({ context, trace }, message);
  }

  warn(message: any, context?: string) {
    if (!this.pinoLogger) return console.warn(`[${context || ''}] ${message}`);
    if (context) { this.pinoLogger.warn({ context }, message); }
    else { this.pinoLogger.warn(message); }
  }

  debug(message: any, context?: string) {
    if (!this.pinoLogger) return console.debug(`[${context || ''}] ${message}`);
    if (context) { this.pinoLogger.debug({ context }, message); }
    else { this.pinoLogger.debug(message); }
  }

  verbose(message: any, context?: string) {
    if (!this.pinoLogger) return console.log(`[${context || ''}] ${message}`);
    // Map NestJS 'verbose' to pino's 'trace' level
    if (context) { this.pinoLogger.trace({ context }, message); }
    else { this.pinoLogger.trace(message); }
  }
  // --- End Interface Methods ---
}