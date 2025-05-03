// packages/main/src/app/services/tag-transformer.module.ts
import { Module } from '@nestjs/common';
import { TagTransformerService } from './tag-transformer.service';

@Module({
  providers: [TagTransformerService],
  exports:   [TagTransformerService],
})
export class TagTransformerModule {}
