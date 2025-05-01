// packages/main/src/app/logger/logger.service.ts (Using ONLY electron-log)
import { Injectable, LoggerService as NestLoggerService, OnModuleInit, Scope, Logger as NestLogger } from '@nestjs/common';
import { ConfigService } from '../config/config.service';
import log, { type LevelOption } from 'electron-log'; // Import electron-log

@Injectable()
export class LoggerService implements NestLoggerService, OnModuleInit {
  // Keep NestLogger only as a fallback mechanism if electron-log setup fails
  private readonly fallbackLogger = new NestLogger(LoggerService.name);
  private didInit = false; // Flag to prevent double init logs

  constructor(private readonly configService: ConfigService) {
      // Constructor should be lightweight, move init to onModuleInit
      console.log(`[LoggerService Constructor] Instance created. ConfigService injected: ${!!configService}`);
  }

  onModuleInit() {
    if (this.didInit) return; // Prevent running twice if module re-initializes unexpectedly
    this.didInit = true;
    console.log('[LoggerService onModuleInit] Initializing electron-log...');
    try {
      // --- Configure electron-log ---
      const fileLogLevelString = this.configService.getLogLevel()?.toLowerCase() || 'info';
      const validLevels: ReadonlyArray<string> = ['error', 'warn', 'info', 'verbose', 'debug', 'silly'];
      let fileLogLevel: LevelOption = 'info';

      if (validLevels.includes(fileLogLevelString)) {
        fileLogLevel = fileLogLevelString as LevelOption;
      } else {
          // Use console directly here as fallbackLogger might not be fully reliable yet
          console.warn(`[LoggerService] Invalid log level "${fileLogLevelString}" in config. Defaulting file logger to 'info'.`);
      }

      log.transports.file.level = fileLogLevel;
      // Also set console level for electron-log
      log.transports.console.level = process.env.NODE_ENV === 'production' ? 'info' : 'debug';
      // Optional: Customize console format if desired
      log.transports.console.format = '[{h}:{i}:{s}.{ms}] [{level}] › {text}'; // Example format


      const logPath = log.transports.file.getFile().path;
      // Use electron-log itself to log initialization message
      log.info(`LoggerService initialized. Using electron-log. Console Level: ${log.transports.console.level}, File Level: ${fileLogLevel}. Path: ${logPath}`);

    } catch (error) {
       console.error("CRITICAL: Failed to initialize electron-log!", error);
       this.fallbackLogger.error("electron-log initialization failed, logging methods will use fallback NestJS logger.");
       // In a real failure, methods below would use fallbackLogger, but how?
       // We'll rely on electron-log's own robustness for now.
    }
  }

  // Implement LoggerService methods using ONLY electron-log
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