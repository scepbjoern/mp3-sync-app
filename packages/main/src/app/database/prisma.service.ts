// packages/main/src/app/database/prisma.service.ts

import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { closeSync, existsSync, mkdirSync, openSync, copyFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { ConfigService } from '../config/config.service';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);
  private readonly dbPath: string;
  constructor(configService: ConfigService) {
    // Prepare database file before Prisma connects
    const dbPathLocal = configService.getDatabasePath();
    if (!dbPathLocal) {
      throw new Error('Database path could not be resolved from configuration.');
    }

    // Ensure directory exists and copy template on first run
    try {
      mkdirSync(dirname(dbPathLocal), { recursive: true });
    } catch (error) {
      throw new Error(`Failed to ensure database directory exists (${dbPathLocal}): ${(error as Error).message}`);
    }

    try {
      const needInitialize = !existsSync(dbPathLocal) || (existsSync(dbPathLocal) && (statSync(dbPathLocal).size ?? 0) < 1024);
      if (needInitialize) {
        const templatePath = resolve(__dirname, 'resources', 'db', 'template.db');
        if (existsSync(templatePath)) {
          copyFileSync(templatePath, dbPathLocal);
        } else if (!existsSync(dbPathLocal)) {
          closeSync(openSync(dbPathLocal, 'a'));
        }
      }
    } catch {
      if (!existsSync(dbPathLocal)) {
        closeSync(openSync(dbPathLocal, 'a'));
      }
    }

    const normalizedPath = dbPathLocal.replace(/\\/g, '/');
    const databaseUrl = `file:${normalizedPath}`;
    super({
      datasources: {
        db: {
          url: databaseUrl,
        },
      },
      log: ['query', 'info', 'warn', 'error'],
    });

    this.dbPath = dbPathLocal;
    this.logger.log(`PrismaClient constructed (SQLite URL: ${databaseUrl})`);
  }

  // URL resolution now handled in constructor

  async onModuleInit() {
    this.logger.log('Connecting to database…');
    await this.$connect();
    this.logger.log('Database connected');

    // Verify core tables exist, otherwise self-heal with the bundled template DB
    try {
      const rows = await this.$queryRawUnsafe<Array<{ name: string }>>(
        "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('SourceFileState','FileMappingState','SyncRun','SyncChange')"
      );
      const have = new Set(rows.map(r => r.name));
      const required = ['SourceFileState', 'FileMappingState', 'SyncRun', 'SyncChange'];
      const missing = required.filter(t => !have.has(t));
      if (missing.length > 0) {
        this.logger.warn(`Database schema missing tables: ${missing.join(', ')}. Attempting to initialize from template…`);
        await this.$disconnect();
        let repaired = false;
        try {
          const templatePath = resolve(__dirname, 'resources', 'db', 'template.db');
          if (existsSync(templatePath)) {
            copyFileSync(templatePath, this.dbPath);
            this.logger.log('Template database copied to user database path.');
            repaired = true;
          } else {
            this.logger.warn(`Template database not found at ${templatePath}. Falling back to SQL-based initialization.`);
          }
        } catch (e) {
          this.logger.error('Failed to apply template database:', e);
        }

        if (!repaired) {
          try {
            await this.$connect();
            await this.initializeSchemaFallback();
            repaired = true;
          } catch (e) {
            this.logger.error('SQL-based schema initialization failed:', e);
          } finally {
            await this.$disconnect();
          }
        }

        await this.$connect();
        this.logger.log('Reconnected after database initialization.');
      }
    } catch (e) {
      this.logger.warn(`Schema verification failed; continuing. Error: ${(e as Error).message}`);
    }
  }

  private async initializeSchemaFallback() {
    this.logger.warn('Initializing schema using SQL fallback…');
    const statements: string[] = [
      // SourceFileState
      `CREATE TABLE IF NOT EXISTS SourceFileState (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        path TEXT NOT NULL UNIQUE,
        lastModifiedAt DATETIME,
        inDjLibrary BOOLEAN NOT NULL DEFAULT 0,
        djLastChecked DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE INDEX IF NOT EXISTS SourceFileState_inDjLibrary_idx ON SourceFileState (inDjLibrary)`,
      `CREATE INDEX IF NOT EXISTS SourceFileState_lastModifiedAt_idx ON SourceFileState (lastModifiedAt)`,

      // FileMappingState
      `CREATE TABLE IF NOT EXISTS FileMappingState (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sourceAPath TEXT NOT NULL UNIQUE,
        sourceBPath TEXT NOT NULL UNIQUE,
        mappingCreatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        artist TEXT,
        title TEXT,
        sourceALastModified DATETIME,
        sourceBLastModified DATETIME,
        lastSyncTimestamp DATETIME
      )`,
      `CREATE INDEX IF NOT EXISTS FileMappingState_lastSyncTimestamp_idx ON FileMappingState (lastSyncTimestamp)`,
      `CREATE INDEX IF NOT EXISTS FileMappingState_artist_idx ON FileMappingState (artist)`,
      `CREATE INDEX IF NOT EXISTS FileMappingState_title_idx ON FileMappingState (title)`,

      // SyncStateTag
      `CREATE TABLE IF NOT EXISTS SyncStateTag (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fileMappingStateId INTEGER NOT NULL,
        tagName TEXT NOT NULL,
        sourceAValue TEXT,
        sourceBValue TEXT,
        CONSTRAINT SyncStateTag_fileMappingStateId_fkey FOREIGN KEY (fileMappingStateId) REFERENCES FileMappingState (id) ON DELETE CASCADE,
        CONSTRAINT SyncStateTag_unique UNIQUE (fileMappingStateId, tagName)
      )`,
      `CREATE INDEX IF NOT EXISTS SyncStateTag_fileMappingStateId_idx ON SyncStateTag (fileMappingStateId)`,

      // SyncRun
      `CREATE TABLE IF NOT EXISTS SyncRun (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        startedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        finishedAt DATETIME,
        appliedCount INTEGER NOT NULL DEFAULT 0,
        conflictCount INTEGER NOT NULL DEFAULT 0
      )`,
      `CREATE INDEX IF NOT EXISTS SyncRun_startedAt_idx ON SyncRun (startedAt)`,

      // SyncChange
      `CREATE TABLE IF NOT EXISTS SyncChange (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        runId INTEGER NOT NULL,
        mappingId INTEGER,
        sourceAPath TEXT NOT NULL,
        sourceBPath TEXT NOT NULL,
        tag TEXT NOT NULL,
        direction TEXT,
        status TEXT NOT NULL,
        fromValue TEXT,
        toValue TEXT,
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT SyncChange_runId_fkey FOREIGN KEY (runId) REFERENCES SyncRun (id) ON DELETE CASCADE
      )`,
      `CREATE INDEX IF NOT EXISTS SyncChange_runId_idx ON SyncChange (runId)`,
      `CREATE INDEX IF NOT EXISTS SyncChange_tag_idx ON SyncChange (tag)`,
      `CREATE INDEX IF NOT EXISTS SyncChange_status_idx ON SyncChange (status)`
    ];

    for (const stmt of statements) {
      await this.$executeRawUnsafe(stmt);
    }
    this.logger.log('SQL fallback schema initialization completed.');
  }

  async onModuleDestroy() {
    this.logger.log('Disconnecting from database…');
    await this.$disconnect();
    this.logger.log('Database disconnected');
  }
}
