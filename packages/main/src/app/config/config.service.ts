// packages/main/src/app/config/config.service.ts

import { Injectable, Logger, Optional } from '@nestjs/common';
import { app } from 'electron';
import * as fsSync from 'node:fs';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';

interface ConfigEnv extends NodeJS.ProcessEnv {
  MP3_SYNC_DATA_DIR?: string;
  MP3_SYNC_CONFIG_FILE?: string;
  MP3_SYNC_DB_PATH?: string;
  MP3_SYNC_BACKUP_DIR?: string;
  MP3_SYNC_LOG_FILE?: string;
}

export interface AppConfig {
  databasePath:      string | null;
  backupPath:        string | null;
  sourceAPath:       string | null;
  sourceBPath:       string | null;
  tagsToSync:        'ALL' | string[];
  bidirectionalTags: string[];
  logFilePath:       string | null;
  logLevel:          string;
  mirrorPattern:     string; // A->B copy mirror pattern
  playlistDirectory: string | null;
}

@Injectable()
export class ConfigService {
  private config: AppConfig;
  private readonly configFilePath: string;
  private readonly defaultLogPath: string;
  private readonly defaultBackupPath: string;
  private readonly defaultDbPath: string;
  private readonly defaultPlaylistPath: string;
  private readonly logger = new Logger(ConfigService.name);
  private readonly env: ConfigEnv;

  constructor(@Optional() basePathOverride?: string) {
    this.env = process.env;
    const basePath = basePathOverride ?? this.resolveBasePath();

    this.configFilePath = this.resolveConfigPath(basePath);
    this.defaultDbPath    = this.resolveDbPath(basePath);
    this.defaultBackupPath = this.resolveBackupPath(basePath);
    this.defaultLogPath   = this.resolveLogPath(basePath);
    this.defaultPlaylistPath = this.resolvePlaylistPath(basePath);

    this.logger.log(`Config base path set to ${basePath}`);
    this.config = this.loadConfigFromFileSync();
    this.logger.log('ConfigService initialized');
  }

  private resolveBasePath(): string {
    if (this.env.MP3_SYNC_DATA_DIR) {
      return this.ensureAbsolutePath(this.env.MP3_SYNC_DATA_DIR, 'MP3_SYNC_DATA_DIR');
    }
    if (app && typeof app.getPath === 'function') {
      try {
        return app.getPath('userData');
      } catch (error) {
        this.logger.warn(`Failed to resolve userData path via Electron, falling back to temp dir: ${(error as Error).message}`);
      }
    }
    return path.join(os.tmpdir(), 'mp3-sync-app-data');
  }

  private resolveConfigPath(basePath: string): string {
    if (this.env.MP3_SYNC_CONFIG_FILE) {
      return this.ensureAbsolutePath(this.env.MP3_SYNC_CONFIG_FILE, 'MP3_SYNC_CONFIG_FILE');
    }
    return path.join(basePath, 'config.json');
  }

  private resolveDbPath(basePath: string): string {
    const dbOverride = this.env.MP3_SYNC_DB_PATH;
    return dbOverride
      ? this.ensureAbsolutePath(dbOverride, 'MP3_SYNC_DB_PATH')
      : path.join(basePath, 'mp3-sync-app-sync_data.db');
  }

  private resolveBackupPath(basePath: string): string {
    const backupOverride = this.env.MP3_SYNC_BACKUP_DIR;
    return backupOverride
      ? this.ensureAbsolutePath(backupOverride, 'MP3_SYNC_BACKUP_DIR')
      : path.join(basePath, 'mp3-sync-app-backups');
  }

  private resolveLogPath(basePath: string): string {
    const logOverride = this.env.MP3_SYNC_LOG_FILE;
    return logOverride
      ? this.ensureAbsolutePath(logOverride, 'MP3_SYNC_LOG_FILE')
      : path.join(basePath, 'mp3-sync-app.log');
  }

  private resolvePlaylistPath(basePath: string): string {
    return path.join(basePath, 'playlists');
  }

  private ensureAbsolutePath(value: string, envKey: keyof ConfigEnv | 'MP3_SYNC_CONFIG_FILE'): string {
    if (!path.isAbsolute(value)) {
      throw new Error(`${envKey} must be an absolute path. Got: ${value}`);
    }
    return value;
  }

  private getDefaults(): AppConfig {
    return {
      databasePath:      null,
      backupPath:        null,
      sourceAPath:       null,
      sourceBPath:       null,
      tagsToSync:        'ALL',
      bidirectionalTags: ['TKEY', 'TBPM', 'TXXX:EnergyLevel'],
      logFilePath:       null,
      logLevel:          'info',
      mirrorPattern:     '$Left(<DJBIBLIOTHEK>,4)\\<DJBIBLIOTHEK>\\<TPE1>_[<TPOS>-]<TRCK>_<TIT2>',
      playlistDirectory: null,
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
  getPlaylistDirectory(): string {
    return this.config.playlistDirectory ?? this.defaultPlaylistPath;
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
  getMirrorPattern(): string {
    return this.config.mirrorPattern;
  }

  getConfigFilePath(): string {
    return this.configFilePath;
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
  async setPlaylistDirectory(v: string | null) {
    this.config.playlistDirectory = v;
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
  async setMirrorPattern(v: string) {
    // Allow empty? Require string
    this.config.mirrorPattern = typeof v === 'string' ? v : this.getDefaults().mirrorPattern;
    await this.persist();
  }
}
