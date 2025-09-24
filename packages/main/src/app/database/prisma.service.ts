// packages/main/src/app/database/prisma.service.ts

import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { closeSync, existsSync, mkdirSync, openSync } from 'node:fs';
import { dirname } from 'node:path';

import { ConfigService } from '../config/config.service';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);
  constructor(configService: ConfigService) {
    const databaseUrl = PrismaService.resolveDatabaseUrl(configService);
    super({
      datasources: {
        db: {
          url: databaseUrl,
        },
      },
      log: ['query', 'info', 'warn', 'error'],
    });

    this.logger.log(`PrismaClient constructed (SQLite URL: ${databaseUrl})`);
  }

  private static resolveDatabaseUrl(configService: ConfigService): string {
    const dbPath = configService.getDatabasePath();
    if (!dbPath) {
      throw new Error('Database path could not be resolved from configuration.');
    }

    try {
      mkdirSync(dirname(dbPath), { recursive: true });
    } catch (error) {
      throw new Error(`Failed to ensure database directory exists (${dbPath}): ${(error as Error).message}`);
    }

    const normalizedPath = dbPath.replace(/\\/g, '/');
    const dbUrl = `file:${normalizedPath}`;

    if (!existsSync(dbPath)) {
      closeSync(openSync(dbPath, 'a'));
    }

    return dbUrl;
  }

  async onModuleInit() {
    this.logger.log('Connecting to database…');
    await this.$connect();
    this.logger.log('Database connected');
  }

  async onModuleDestroy() {
    this.logger.log('Disconnecting from database…');
    await this.$disconnect();
    this.logger.log('Database disconnected');
  }
}
