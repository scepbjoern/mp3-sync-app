// packages/main/src/app/pairing/pairing.module.ts
import { Module } from '@nestjs/common';

import { ConfigModule } from '../config/config.module';
import { PrismaService } from '../database/prisma.service';
import { FileSystemModule } from '../services/file-system.module';
import { Mp3TagModule } from '../services/mp3-tag.module';
import { PairingService } from './pairing.service';
import { PairingController } from './pairing.controller';

@Module({
  imports: [ConfigModule, FileSystemModule, Mp3TagModule],
  providers: [PairingService, PrismaService],
  controllers: [PairingController],
  exports: [PairingService],
})
export class PairingModule {}
