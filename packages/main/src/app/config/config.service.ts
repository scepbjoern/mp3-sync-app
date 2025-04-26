// packages/main/src/app/config/config.service.ts
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os'; // For temporary default paths

export interface AppConfig { // Export interface for potential use elsewhere
  databasePath: string | null;
  backupPath: string | null;
  sourceAPath: string | null;
  sourceBPath: string | null;
  tagsToSync: 'ALL' | string[];
  bidirectionalTags: string[];
  logFilePath: string | null;
  logLevel: string;
}

@Injectable()
export class ConfigService implements OnModuleInit {
    private config: AppConfig;
    private readonly configFilePath: string;
    private readonly defaultLogPath: string;
    private readonly defaultBackupPath: string;
    private readonly defaultDbPath: string;
    private readonly logger = new Logger(ConfigService.name);

    // Allow optional basePath override in constructor
    constructor(basePathOverride?: string) {
        let basePath: string;
        if (basePathOverride) {
            basePath = basePathOverride;
            // Use console.log here as logger might not be ready if another service calls this constructor early
            console.log(`[ConfigService Constructor] Using provided base path override: ${basePath}`);
        } else {
            // TODO: Properly inject actual userDataPath from Electron main.ts later.
            basePath = path.join(os.tmpdir(), 'mp3-sync-app-data'); // Default temporary path
            console.log(`[ConfigService Constructor] Using default base path: ${basePath}`);
        }

        this.configFilePath = path.join(basePath, 'config.json');
        this.defaultDbPath = path.join(basePath, 'sync_data.db');
        this.defaultBackupPath = path.join(basePath, 'backups');
        this.defaultLogPath = path.join(basePath, 'app.log');

        this.config = this.getDefaults(); // Initialize with defaults
        // Removed the log message here as logger isn't ready yet
    }

  // Use OnModuleInit to load saved config from file async, overriding defaults
  async onModuleInit(): Promise<void> {
    await this.loadConfigFromFile();
    this.logger.log('ConfigService onModuleInit: Attempted load from file complete.');
  }

  // Make loadConfigFromFile private as it's called by onModuleInit
  private async loadConfigFromFile(): Promise<void> {
     if (!this.configFilePath) {
         this.logger.error("Config file path not set before loading.");
         this.config = this.getDefaults();
         return;
     }
     try {
       // Ensure directory exists before reading/writing
       await fs.mkdir(path.dirname(this.configFilePath), { recursive: true });
       const configFileContent = await fs.readFile(this.configFilePath, 'utf-8');
       // --- DIAGNOSTIC LOG ---
       console.log(`DEBUG[ConfigService]: Read raw content from ${this.configFilePath}: ${configFileContent}`);
       // --- END DIAGNOSTIC LOG ---
       const loadedConfig = JSON.parse(configFileContent);
       // --- DIAGNOSTIC LOG ---
       console.log(`DEBUG[ConfigService]: Parsed config from file:`, loadedConfig);
       // --- END DIAGNOSTIC LOG ---
       // Merge loaded config OVER defaults that were set in constructor
       this.config = { ...this.getDefaults(), ...loadedConfig };
       // --- DIAGNOSTIC LOG ---
       console.log(`DEBUG[ConfigService]: Merged config state:`, this.config);
       // --- END DIAGNOSTIC LOG ---
       this.logger.log(`Config loaded successfully from ${this.configFilePath}`);
     } catch (error) {
       // Check specifically for file not found to load defaults
       if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
         this.logger.log(`Config file not found at ${this.configFilePath}. Saving current defaults.`);
         // Config already holds defaults from constructor, just save them
         // --- DIAGNOSTIC LOG ---
         console.log(`DEBUG[ConfigService]: Setting defaults due to ENOENT:`, this.config);
         // --- END DIAGNOSTIC LOG ---
         await this.saveConfigInternal(); // Save defaults if file doesn't exist
       } else {
         // Handle JSON parse errors or other read errors
         this.logger.error(`Error loading/parsing config from ${this.configFilePath}. Using defaults already set.`, error);
         // Keep defaults already set in constructor
         this.config = this.getDefaults(); // Ensure config holds defaults on other errors too
         // --- DIAGNOSTIC LOG ---
         console.log(`DEBUG[ConfigService]: Setting defaults due to other error:`, this.config);
         // --- END DIAGNOSTIC LOG ---
       }
     }
   }

   // Helper for default structure and values
   private getDefaults(): AppConfig {
     return {
       databasePath: null, // Null means use the default path variable later
       backupPath: null,
       logFilePath: null,
       sourceAPath: null,
       sourceBPath: null,
       tagsToSync: 'ALL',
       bidirectionalTags: ["TKEY", "TBP", "TXXX:EnergyLevel"], // Example defaults
       logLevel: 'info', // Default log level
     };
   }

   // Internal save - uses current state of this.config
   private async saveConfigInternal(): Promise<boolean> {
      // No need to check null this.config as it's set in constructor
      try {
         await fs.mkdir(path.dirname(this.configFilePath), { recursive: true });
         await fs.writeFile(this.configFilePath, JSON.stringify(this.config, null, 2), 'utf-8');
         return true;
      } catch (error) {
         this.logger.error(`Error saving config internally to ${this.configFilePath}`, error);
         return false;
      }
   }

   async saveConfig(): Promise<boolean> {
     // No need to check null this.config
     const success = await this.saveConfigInternal();
     if (success) {
         this.logger.log(`Config saved to ${this.configFilePath}`);
     }
     return success;
   }

   // --- Getters ---
   // Simplified check: config object always exists after constructor.
   private ensureConfigLoaded(operation: string = 'access'): AppConfig {
      if (!this.config) {
          // This state should now be unreachable if constructor ran.
          const errorMsg = `ConfigService: Configuration accessed (${operation}) but this.config is null! This indicates an issue during instantiation.`;
          this.logger.error(errorMsg);
          throw new Error(errorMsg);
      }
      return this.config;
   }

  // Return actual configured path OR the calculated default path if config value is null
  public getDatabasePath(): string { return this.ensureConfigLoaded('getDatabasePath').databasePath ?? this.defaultDbPath; }
  public getBackupPath(): string { return this.ensureConfigLoaded('getBackupPath').backupPath ?? this.defaultBackupPath; }
  public getLogFilePath(): string { return this.ensureConfigLoaded('getLogFilePath').logFilePath ?? this.defaultLogPath; }

  // Return value directly from config (can be null)
  public getSourceAPath(): string | null { return this.ensureConfigLoaded('getSourceAPath').sourceAPath; }
  public getSourceBPath(): string | null { return this.ensureConfigLoaded('getSourceBPath').sourceBPath; }
  public getTagsToSync(): 'ALL' | string[] { return this.ensureConfigLoaded('getTagsToSync').tagsToSync; }
  public getBidirectionalTags(): string[] { return this.ensureConfigLoaded('getBidirectionalTags').bidirectionalTags; }
  public getLogLevel(): string { return this.ensureConfigLoaded('getLogLevel').logLevel; }


  // --- Setters ---
  // Config guaranteed to exist
  public async setSourceAPath(pathValue: string | null): Promise<void> { this.ensureConfigLoaded('setSourceAPath').sourceAPath = pathValue; await this.saveConfig(); }
  public async setSourceBPath(pathValue: string | null): Promise<void> { this.ensureConfigLoaded('setSourceBPath').sourceBPath = pathValue; await this.saveConfig(); }
  public async setDatabasePath(pathValue: string | null): Promise<void> { this.ensureConfigLoaded('setDatabasePath').databasePath = pathValue; await this.saveConfig(); }
  public async setBackupPath(pathValue: string | null): Promise<void> { this.ensureConfigLoaded('setBackupPath').backupPath = pathValue; await this.saveConfig(); }
  public async setLogFilePath(pathValue: string | null): Promise<void> { this.ensureConfigLoaded('setLogFilePath').logFilePath = pathValue; await this.saveConfig(); }
  public async setLogLevel(level: string): Promise<void> { this.ensureConfigLoaded('setLogLevel').logLevel = level; await this.saveConfig(); }
  public async setTagsToSync(tags: 'ALL' | string[]): Promise<void> { this.ensureConfigLoaded('setTagsToSync').tagsToSync = tags; await this.saveConfig(); }
  public async setBidirectionalTags(tags: string[]): Promise<void> { this.ensureConfigLoaded('setBidirectionalTags').bidirectionalTags = tags; await this.saveConfig(); }
}