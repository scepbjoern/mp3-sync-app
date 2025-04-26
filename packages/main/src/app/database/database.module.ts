// packages/main/src/app/database/database.module.ts
import { Module, Global } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global() // Make PrismaService available globally without importing DatabaseModule everywhere
@Module({
  providers: [PrismaService],
  exports: [PrismaService], // Export PrismaService so other modules can import DatabaseModule and use it
})
export class DatabaseModule {}
