// packages/main/src/app/database/prisma.service.ts
import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Injectable service that manages the PrismaClient instance.
 * It connects to the database on module initialization and disconnects on module destruction.
 * By extending PrismaClient, this service instance itself can be used to make database queries.
 */
@Injectable()
export class PrismaService
  extends PrismaClient // Extend PrismaClient directly
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    // You can pass PrismaClient options here if needed, e.g., logging configuration
    // super({
    //   log: [
    //     { emit: 'event', level: 'query' },
    //     { emit: 'stdout', level: 'info' },
    //     { emit: 'stdout', level: 'warn' },
    //     { emit: 'stdout', level: 'error' },
    //   ],
    //   errorFormat: 'pretty',
    // });
    super(); // Call the parent PrismaClient constructor
  }

  /**
   * Called once the host module has been initialized.
   * Establishes the database connection.
   */
  async onModuleInit() {
    this.logger.log('Connecting to the database...');
    try {
      await this.$connect();
      this.logger.log('Database connection established successfully.');

      // Optional: Add listeners for Prisma events if using event-based logging
      // this.$on('query' as any, (e: any) => {
      //   this.logger.debug(`Query: ${e.query} Params: ${e.params} Duration: ${e.duration}ms`);
      // });

    } catch (error) {
      this.logger.error('Failed to connect to the database.', error);
      // Depending on your application's needs, you might want to handle this error more gracefully
      // or even prevent the application from starting.
      throw error; // Re-throw the error to potentially stop NestJS initialization
    }
  }

  /**
   * Called once the host module is about to be destroyed.
   * Closes the database connection.
   */
  async onModuleDestroy() {
    this.logger.log('Disconnecting from the database...');
    await this.$disconnect();
    this.logger.log('Database connection closed successfully.');
  }

  // By extending PrismaClient, all Prisma model methods (e.g., this.user.findUnique)
  // are directly available on instances of this PrismaService.
  // You don't need a separate method like `getClient()` or a public property.
  // Example usage in another service:
  // constructor(private prisma: PrismaService) {}
  // async findUser(id: number) {
  //   return this.prisma.user.findUnique({ where: { id } });
  // }
}
