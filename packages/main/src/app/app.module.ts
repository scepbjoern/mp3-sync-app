// packages/main/src/app/app.module.ts
import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module'; // Import DatabaseModule

@Module({
  imports: [DatabaseModule], // Add DatabaseModule here
})
export class AppModule {}
