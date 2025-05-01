// packages/main/src/app/config/config.service.ts (Corrected)
import { Injectable, Logger, Optional } from '@nestjs/common'; // Removed OnModuleInit
import * as fsSync from 'node:fs'; // Use synchronous fs for constructor load
import * as fs from 'node:fs/promises'; // Use async fs for saving later
import * as path from 'node:path';
import * as os from 'node:os';

export interface AppConfig {
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
export class ConfigService {
  private readonly config: AppConfig; // Guaranteed set by constructor
  private readonly configFilePath: string;
  private readonly defaultLogPath: string;
  private readonly defaultBackupPath: string;
  private readonly defaultDbPath: string;
  private readonly logger = new Logger(ConfigService.name);

  constructor(@Optional() basePathOverride?: string) {
    let basePath: string;
    if (basePathOverride) {
        basePath = basePathOverride;
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

    // Load Config Synchronously in constructor
    this.config = this.loadConfigFromFileSync();
    this.logger.log('ConfigService Initialized and config loaded/defaults set.');
  }

  // Helper for default structure and values - MUST be defined before use in constructor
  private getDefaults(): AppConfig {
    return {
      databasePath: null,
      backupPath: null,
      logFilePath: null,
      sourceAPath: null,
      sourceBPath: null,
      tagsToSync: 'ALL',
      bidirectionalTags: ["TKEY", "TBP", "TXXX:EnergyLevel"],
      logLevel: 'info',
    };
  }

  // Synchronous loading method called ONLY from constructor
  private loadConfigFromFileSync(): AppConfig {
    const defaults = this.getDefaults(); // Call the correctly defined method
    try {
      // Ensure directory exists synchronously before reading
      try { fsSync.mkdirSync(path.dirname(this.configFilePath), { recursive: true }); } catch {}

      const configFileContent = fsSync.readFileSync(this.configFilePath, 'utf-8');
      const loadedConfig = JSON.parse(configFileContent);
      this.logger.log(`Config loaded successfully from ${this.configFilePath}`);
      // Merge loaded OVER defaults
      return { ...defaults, ...loadedConfig };
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        this.logger.log(`Config file not found at ${this.configFilePath}. Saving defaults.`);
        this.saveConfigInternalSync(defaults); // Save defaults synchronously
        return defaults;
      } else {
        this.logger.error(`Error loading/parsing sync config from ${this.configFilePath}. Using defaults.`, error);
        return defaults; // Return defaults on other errors
      }
    }
  }

   // Internal synchronous save used only during initial load if file missing
   private saveConfigInternalSync(configToSave: AppConfig): boolean {
      try {
         fsSync.mkdirSync(path.dirname(this.configFilePath), { recursive: true });
         // Use synchronous writeFileSync here
         fsSync.writeFileSync(this.configFilePath, JSON.stringify(configToSave, null, 2), 'utf-8');
         return true;
      } catch (error) {
         this.logger.error(`Error saving initial default config sync to ${this.configFilePath}`, error);
         return false;
      }
   }

  // Public save remains async using fs/promises
  async saveConfig(): Promise<boolean> {
    try {
       // Use async writeFile from fs/promises here
       await fs.writeFile(this.configFilePath, JSON.stringify(this.config, null, 2), { encoding: 'utf-8' }); // Pass encoding in options object
       this.logger.log(`Config saved to ${this.configFilePath}`);
       return true;
     } catch (error) {
       this.logger.error(`Error saving config to ${this.configFilePath}`, error);
       return false;
     }
  }

   // --- Getters ---
   // No need for ensureConfigLoaded as config is set in constructor
  public getDatabasePath(): string { return this.config.databasePath ?? this.defaultDbPath; }
  public getBackupPath(): string { return this.config.backupPath ?? this.defaultBackupPath; }
  public getLogFilePath(): string { return this.config.logFilePath ?? this.defaultLogPath; }
  public getSourceAPath(): string | null { return this.config.sourceAPath; }
  public getSourceBPath(): string | null { return this.config.sourceBPath; }
  public getTagsToSync(): 'ALL' | string[] { return this.config.tagsToSync; }
  public getBidirectionalTags(): string[] { return this.config.bidirectionalTags; }
  public getLogLevel(): string { return this.config.logLevel; }


  // --- Setters ---
  public async setSourceAPath(pathValue: string | null): Promise<void> { this.config.sourceAPath = pathValue; await this.saveConfig(); }
  public async setSourceBPath(pathValue: string | null): Promise<void> { this.config.sourceBPath = pathValue; await this.saveConfig(); }
  public async setDatabasePath(pathValue: string | null): Promise<void> { this.config.databasePath = pathValue; await this.saveConfig(); }
  public async setBackupPath(pathValue: string | null): Promise<void> { this.config.backupPath = pathValue; await this.saveConfig(); }
  public async setLogFilePath(pathValue: string | null): Promise<void> { this.config.logFilePath = pathValue; await this.saveConfig(); }
  public async setLogLevel(level: string): Promise<void> { this.config.logLevel = level; await this.saveConfig(); }
  public async setTagsToSync(tags: 'ALL' | string[]): Promise<void> { this.config.tagsToSync = tags; await this.saveConfig(); }
  public async setBidirectionalTags(tags: string[]): Promise<void> { this.config.bidirectionalTags = tags; await this.saveConfig(); }
}