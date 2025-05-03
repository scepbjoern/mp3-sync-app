// packages/main/src/app/database/prisma.service.ts

import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      // any PrismaClientOptions here
      log: ['query', 'info', 'warn', 'error'],
    });
    this.logger.log('PrismaClient constructed');
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
