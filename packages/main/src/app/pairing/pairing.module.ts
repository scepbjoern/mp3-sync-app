// packages/main/src/app/pairing/pairing.module.ts
import { Module } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { PairingService } from './pairing.service';
import { PairingController } from './pairing.controller';

@Module({
  providers: [PairingService, PrismaService],
  controllers: [PairingController],
  exports: [PairingService],
})
export class PairingModule {}
