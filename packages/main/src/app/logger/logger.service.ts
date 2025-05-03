// packages/main/src/app/logger/logger.service.ts (Using ONLY electron-log)
import { Injectable, LoggerService as NestLoggerService, OnModuleInit, Logger as NestLogger } from '@nestjs/common';
import { ConfigService } from '../config/config.service';
import log, { type LevelOption } from 'electron-log'; // Import electron-log

@Injectable()
export class LoggerService implements NestLoggerService, OnModuleInit {
  private readonly fallbackLogger = new NestLogger(LoggerService.name);
  private didInit = false;

  constructor(private readonly configService: ConfigService) {
    console.log(`[LoggerService Constructor] Instance created. ConfigService injected: ${!!configService}`);
  }

  onModuleInit() {
    if (this.didInit) return;
    this.didInit = true;
    console.log('[LoggerService onModuleInit] Initializing electron-log...');
    try {
      // --- Configure electron-log ---
      const fileLogLevelString = this.configService.getLogLevel()?.toLowerCase() || 'info';
      const validLevels: ReadonlyArray<string> = ['error', 'warn', 'info', 'verbose', 'debug', 'silly'];
      let validatedFileLogLevel: LevelOption = 'info';

      if (validLevels.includes(fileLogLevelString)) {
          validatedFileLogLevel = fileLogLevelString as LevelOption;
      } else {
          console.warn(`[LoggerService] Invalid log level "${fileLogLevelString}" in config. Defaulting file logger to 'info'.`);
      }

      log.transports.file.level = validatedFileLogLevel;
      log.transports.console.level = process.env.NODE_ENV === 'production' ? 'info' : 'debug';
      log.transports.console.format = '[{h}:{i}:{s}.{ms}] [{level}] {text}'; // Example format


      const logPath = log.transports.file.getFile().path;
      log.info(`LoggerService initialized. Using electron-log. Console Level: ${log.transports.console.level}, File Level: ${validatedFileLogLevel}. Path: ${logPath}`);

    } catch (error) {
       console.error("CRITICAL: Failed to initialize electron-log!", error);
       this.fallbackLogger.error("electron-log initialization failed, logging methods will use fallback NestJS logger.");
    }
  }

  // --- Implement LoggerService methods using ONLY electron-log ---
  log(message: any, context?: string) {
    log.info(context ? `[${context}] ${message}` : message);
  }

  error(message: any, trace?: string | Error, context?: string) {
    const prefix = context ? `[${context}] ` : '';
    if (message instanceof Error) { log.error(prefix, message); }
    else if (trace instanceof Error) { log.error(prefix + message, trace); }
    else if (typeof trace === 'string' && trace.length > 0) { log.error(prefix + message + '\nTrace: ' + trace); }
    else { log.error(prefix + message); }
  }

  warn(message: any, context?: string) {
    log.warn(context ? `[${context}] ${message}` : message);
  }

  debug(message: any, context?: string) {
    log.debug(context ? `[${context}] ${message}` : message);
  }

  verbose(message: any, context?: string) {
    log.verbose(context ? `[${context}] ${message}` : message);
  }
}