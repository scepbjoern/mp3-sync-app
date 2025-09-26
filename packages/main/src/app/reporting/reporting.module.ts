// packages/main/src/app/reporting/reporting.module.ts
import { Module } from '@nestjs/common';
import { ReportingService } from './reporting.service';
import { DatabaseModule } from '../database/database.module';
import { ReportingController } from './reporting.controller';

@Module({
  imports: [DatabaseModule],
  providers: [ReportingService],
  controllers: [ReportingController],
  exports: [ReportingService],
})
export class ReportingModule {}
