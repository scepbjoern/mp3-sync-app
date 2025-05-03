// packages/main/src/app/config/config.service.ts

import { Injectable, Logger, Optional } from '@nestjs/common';
import * as fsSync from 'node:fs';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';

export interface AppConfig {
  databasePath:      string | null;
  backupPath:        string | null;
  sourceAPath:       string | null;
  sourceBPath:       string | null;
  tagsToSync:        'ALL' | string[];
  bidirectionalTags: string[];
  logFilePath:       string | null;
  logLevel:          string;
}

@Injectable()
export class ConfigService {
  private config: AppConfig;
  private readonly configFilePath: string;
  private readonly defaultLogPath: string;
  private readonly defaultBackupPath: string;
  private readonly defaultDbPath: string;
  private readonly logger = new Logger(ConfigService.name);

  constructor(@Optional() basePathOverride?: string) {
    const basePath = basePathOverride
      ? basePathOverride
      : path.join(os.tmpdir(), 'mp3-sync-app-data');

    this.configFilePath = path.join(basePath, 'config.json');
    this.defaultDbPath    = path.join(basePath, 'sync_data.db');
    this.defaultBackupPath = path.join(basePath, 'backups');
    this.defaultLogPath   = path.join(basePath, 'app.log');

    this.config = this.loadConfigFromFileSync();
    this.logger.log('ConfigService initialized');
  }

  private getDefaults(): AppConfig {
    return {
      databasePath:      null,
      backupPath:        null,
      sourceAPath:       null,
      sourceBPath:       null,
      tagsToSync:        'ALL',
      bidirectionalTags: ['TKEY', 'TBP', 'TXXX:EnergyLevel'],
      logFilePath:       null,
      logLevel:          'info',
    };
  }

  private loadConfigFromFileSync(): AppConfig {
    const defaults = this.getDefaults();
    try {
      fsSync.mkdirSync(path.dirname(this.configFilePath), { recursive: true });
      const raw = fsSync.readFileSync(this.configFilePath, 'utf-8');
      const loaded = JSON.parse(raw) as Partial<AppConfig>;
      this.logger.log(`Loaded config from ${this.configFilePath}`);
      return { ...defaults, ...loaded };
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        this.logger.log(`No config found, writing defaults to ${this.configFilePath}`);
        this.saveConfigInternalSync(defaults);
      } else {
        this.logger.error(`Failed to read config, using defaults`, err);
      }
      return defaults;
    }
  }

  private saveConfigInternalSync(cfg: AppConfig) {
    try {
      fsSync.mkdirSync(path.dirname(this.configFilePath), { recursive: true });
      fsSync.writeFileSync(this.configFilePath, JSON.stringify(cfg, null, 2), 'utf-8');
      this.logger.log(`Wrote default config to ${this.configFilePath}`);
    } catch (err) {
      this.logger.error(`Failed to write default config`, err);
    }
  }

  private async persist(): Promise<void> {
    try {
      await fs.writeFile(
        this.configFilePath,
        JSON.stringify(this.config, null, 2),
        'utf-8',
      );
      this.logger.log(`Saved config to ${this.configFilePath}`);
    } catch (err) {
      this.logger.error(`Error saving config to ${this.configFilePath}`, err);
    }
  }

  // ─── Public API ─────────────────────────────────────────────

  getConfig(): AppConfig {
    return { ...this.config };
  }

  getDatabasePath(): string {
    return this.config.databasePath ?? this.defaultDbPath;
  }
  getBackupPath(): string {
    return this.config.backupPath ?? this.defaultBackupPath;
  }
  getLogFilePath(): string {
    return this.config.logFilePath ?? this.defaultLogPath;
  }
  getSourceAPath(): string | null {
    return this.config.sourceAPath;
  }
  getSourceBPath(): string | null {
    return this.config.sourceBPath;
  }
  getTagsToSync(): 'ALL' | string[] {
    return this.config.tagsToSync;
  }
  getBidirectionalTags(): string[] {
    return this.config.bidirectionalTags;
  }
  getLogLevel(): string {
    return this.config.logLevel;
  }

  async setDatabasePath(v: string | null) {
    this.config.databasePath = v;
    await this.persist();
  }
  async setBackupPath(v: string | null) {
    this.config.backupPath = v;
    await this.persist();
  }
  async setLogFilePath(v: string | null) {
    this.config.logFilePath = v;
    await this.persist();
  }
  async setSourceAPath(v: string | null) {
    this.config.sourceAPath = v;
    await this.persist();
  }
  async setSourceBPath(v: string | null) {
    this.config.sourceBPath = v;
    await this.persist();
  }
  async setTagsToSync(v: 'ALL' | string[]) {
    this.config.tagsToSync = v;
    await this.persist();
  }
  async setBidirectionalTags(v: string[]) {
    this.config.bidirectionalTags = v;
    await this.persist();
  }
  async setLogLevel(v: string) {
    this.config.logLevel = v;
    await this.persist();
  }
}
