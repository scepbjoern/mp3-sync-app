// packages/main/src/app/services/file-system.module.ts
import { Module } from '@nestjs/common';
import { FileSystemService } from './file-system.service';
import { FileSystemController } from '../controllers/file-system.controller'; // <-- Import

@Module({
  providers: [FileSystemService],
  exports: [FileSystemService],
  controllers: [FileSystemController], // <-- Add controller
})
export class FileSystemModule {}