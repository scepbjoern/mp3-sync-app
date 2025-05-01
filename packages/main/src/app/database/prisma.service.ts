// packages/main/src/app/database/prisma.service.ts
import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
// REMOVED "extends PrismaClient"
// Still implement lifecycle hooks
export class PrismaService implements OnModuleInit {
  private readonly logger = new Logger(PrismaService.name);
  // Create a private instance of the actual PrismaClient
  private readonly prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient({
      // Optional: Configure Prisma Client logging, datasources etc. here
      // log: ['query', 'info', 'warn', 'error'],
    });
    this.logger.log('PrismaClient instance created by PrismaService.');
  }

  async onModuleInit() {
    this.logger.log('Connecting to the database via PrismaService...');
    try {
      // Call connect on the internal instance
      //await this.prisma.$connect();
      this.logger.log('Database connection established successfully via PrismaService.');
    } catch (error) {
      this.logger.error('Failed to connect to the database.', error);
      throw error; // Propagate error during startup
    }
  }

  // --- Provide access to the underlying client ---
  // Other services will inject PrismaService and call this getter
  // (or specific model getters) to perform DB operations.
  get client(): PrismaClient {
    return this.prisma;
  }

  // ---- Example of specific model getters (Alternative to exposing full client) ----
  /*
  get fileMappingState() {
     return this.prisma.fileMappingState;
  }
  get syncStateTag() {
     return this.prisma.syncStateTag;
  }
  */
  // Example usage in another service:
  // constructor(private prismaService: PrismaService) {}
  // async findMapping(id: number) {
  //    return this.prismaService.client.fileMappingState.findUnique({ where: { id } });
  // // OR if using model getters:
  // // return this.prismaService.fileMappingState.findUnique({ where: { id } });
  // }
}