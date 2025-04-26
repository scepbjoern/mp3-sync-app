import { Module } from '@nestjs/common';
import { Mp3TagService } from './mp3-tag.service';

@Module({
  imports: [],
  providers: [Mp3TagService],
  exports: [Mp3TagService],
})
export class Mp3TagModule {}
