import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

@Injectable()
export class FileSystemService {
  private readonly logger = new Logger(FileSystemService.name);

   async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        return false;
      }
      this.logger.error(`Error checking if file exists: ${filePath}`, error);
      return false;
    }
  }

  async getFileTimestamp(filePath: string): Promise<Date | null> {
    try {
      const stats = await fs.stat(filePath);
      return stats.mtime;
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        return null;
      }
      this.logger.error(`Error getting file timestamp: ${filePath}`, error);
      return null;
    }
  }


  async scanDirectory(dirPath: string): Promise<string[]> {
    const mp3Files: string[] = [];
    try {
      const entries = await fs.readdir(dirPath);
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry);
        const stats = await fs.stat(fullPath);
        if (stats.isDirectory()) {
          const subDirFiles = await this.scanDirectory(fullPath);
          mp3Files.push(...subDirFiles);
        } else if (stats.isFile() && path.extname(entry).toLowerCase() === '.mp3') {
          mp3Files.push(fullPath);
        }
      }
    } catch (error) {
      this.logger.error(`Error scanning directory: ${dirPath}`, error);
      return [];
    }
    return mp3Files;
  }


}

