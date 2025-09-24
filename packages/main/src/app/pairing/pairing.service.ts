// packages/main/src/app/pairing/pairing.service.ts
import { Injectable, Logger } from '@nestjs/common';
import path from 'node:path';

import { ConfigService } from '../config/config.service';
import { PrismaService } from '../database/prisma.service';
import { FileSystemService } from '../services/file-system.service';
import { Mp3TagService } from '../services/mp3-tag.service';

interface MappingEntry {
  sourceAPath: string;
  sourceBPath: string;
}

const TAG_KEYS: string[] = ['TLEN', 'TPE1', 'TALB', 'TIT2'];

export type PairingMatchType = 'pattern' | 'tags';
export type UnmatchedReason = 'filtered' | 'no-dest' | 'ambiguous';

export interface PairingScanOptions {
  includeNonDj?: boolean;
}

export interface PairingSuggestion {
  sourcePath: string;
  sourceName: string;
  inDjLibrary: boolean;
  suggestedDestPath: string;
  matchType: PairingMatchType;
}

export interface UnmatchedSourceEntry {
  sourcePath: string;
  sourceName: string;
  inDjLibrary: boolean;
  reason: UnmatchedReason;
  candidateDestPaths?: string[];
}

export interface PairingScanResult {
  suggestions: PairingSuggestion[];
  unmatchedSource: UnmatchedSourceEntry[];
  unmatchedDest: string[];
}

@Injectable()
export class PairingService {
  private readonly logger = new Logger(PairingService.name);
  private readonly reversePattern = /^(\d+)_([^_]+)_(.+)\.mp3$/i;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly fileSystem: FileSystemService,
    private readonly tagService: Mp3TagService,
  ) {}

  /** Upsert each mapping into FileMappingState. Returns count saved. */
  async upsertMappings(entries: MappingEntry[]): Promise<number> {
    let count = 0;
    for (const { sourceAPath, sourceBPath } of entries) {
      await this.prisma.fileMappingState.upsert({
        where: { sourceAPath },
        create: { sourceAPath, sourceBPath },
        update: { sourceBPath },
      });
      count++;
    }
    this.logger.log(`Upserted ${count} mappings`);
    return count;
  }

  async getMappings(): Promise<{ sourceAPath: string; sourceBPath: string }[]> {
    return this.prisma.fileMappingState.findMany({
      select: { sourceAPath: true, sourceBPath: true },
    });
  }

  async saveMappings(entries: { sourceAPath: string; sourceBPath: string }[]): Promise<{ count: number }> {
    let count = 0;
    for (const e of entries) {
      await this.prisma.fileMappingState.upsert({
        where: { sourceAPath: e.sourceAPath },
        create: e,
        update: { sourceBPath: e.sourceBPath },
      });
      count++;
    }
    return { count };
  }

  async initialScan(options: PairingScanOptions = {}): Promise<PairingScanResult> {
    const includeNonDj = options.includeNonDj ?? false;

    const sourceAPath = this.config.getSourceAPath();
    const sourceBPath = this.config.getSourceBPath();

    if (!sourceAPath || !sourceBPath) {
      throw new Error('Source A and Source B paths must be configured before running the pairing scan.');
    }

    this.logger.log(`Starting pairing scan (includeNonDj=${includeNonDj})`);

    const existingMappings = await this.prisma.fileMappingState.findMany({
      select: { sourceAPath: true, sourceBPath: true },
    });
    const mappedA = new Set(existingMappings.map((m) => m.sourceAPath));
    const mappedB = new Set(existingMappings.map((m) => m.sourceBPath));

    const sourceAFiles = await this.fileSystem.scanDirectory(sourceAPath);
    const sourceBFiles = await this.fileSystem.scanDirectory(sourceBPath);

    const destCandidates = sourceBFiles.filter((p) => !mappedB.has(p));
    const destNameMap = new Map<string, string[]>();
    for (const destPath of destCandidates) {
      const destName = path.basename(destPath).toLowerCase();
      const list = destNameMap.get(destName) ?? [];
      list.push(destPath);
      destNameMap.set(destName, list);
    }

    const unmatchedDest = new Set(destCandidates);

    const destTagMap = new Map<string, string[]>();
    const destTagKeyByPath = new Map<string, string>();
    for (const destPath of destCandidates) {
      try {
        const tags = await this.tagService.readTags(destPath, TAG_KEYS);
        const key = this.buildTagKey(tags);
        if (!key) continue;
        const arr = destTagMap.get(key) ?? [];
        arr.push(destPath);
        destTagMap.set(key, arr);
        destTagKeyByPath.set(destPath, key);
      } catch (error) {
        this.logger.warn(`Failed to read tags for destination file ${destPath}: ${(error as Error).message}`);
      }
    }

    const sourceState = await this.prisma.sourceFileState.findMany({
      select: { path: true, inDjLibrary: true },
    });
    const sourceDjMap = new Map(sourceState.map((s) => [s.path, s.inDjLibrary] as const));

    const suggestions: PairingSuggestion[] = [];
    const unmatchedSource: UnmatchedSourceEntry[] = [];

    for (const sourcePath of sourceAFiles) {
      if (mappedA.has(sourcePath)) {
        continue;
      }

      const inDjLibrary = sourceDjMap.get(sourcePath) ?? false;
      const sourceName = path.basename(sourcePath);

      if (!includeNonDj && !inDjLibrary) {
        unmatchedSource.push({
          sourcePath,
          sourceName,
          inDjLibrary,
          reason: 'filtered',
        });
        continue;
      }

      const patternSuggestion = this.tryPatternMatch(sourceName, destNameMap, unmatchedDest, destTagMap, destTagKeyByPath);
      if (patternSuggestion) {
        suggestions.push({
          sourcePath,
          sourceName,
          inDjLibrary,
          suggestedDestPath: patternSuggestion,
          matchType: 'pattern',
        });
        continue;
      }

      const tagSuggestion = await this.tryTagMatch(sourcePath, destTagMap, destTagKeyByPath, unmatchedDest);

      if (tagSuggestion && tagSuggestion.type === 'exact') {
        suggestions.push({
          sourcePath,
          sourceName,
          inDjLibrary,
          suggestedDestPath: tagSuggestion.destPath,
          matchType: 'tags',
        });
        continue;
      }

      if (tagSuggestion && tagSuggestion.type === 'ambiguous') {
        unmatchedSource.push({
          sourcePath,
          sourceName,
          inDjLibrary,
          reason: 'ambiguous',
          candidateDestPaths: tagSuggestion.candidates,
        });
      } else {
        unmatchedSource.push({
          sourcePath,
          sourceName,
          inDjLibrary,
          reason: 'no-dest',
        });
      }
    }

    const result: PairingScanResult = {
      suggestions,
      unmatchedSource,
      unmatchedDest: Array.from(unmatchedDest).sort((a, b) => a.localeCompare(b)),
    };

    this.logger.log(`Pairing scan finished. Suggestions=${suggestions.length}, unmatchedSource=${unmatchedSource.length}, unmatchedDest=${result.unmatchedDest.length}`);
    return result;
  }

  private tryPatternMatch(
    sourceName: string,
    destNameMap: Map<string, string[]>,
    unmatchedDest: Set<string>,
    destTagMap: Map<string, string[]>,
    destTagKeyByPath: Map<string, string>,
  ): string | null {
    const match = this.reversePattern.exec(sourceName);
    if (!match) {
      return null;
    }

    const [, track, artist, title] = match;
    const expectedDestName = `${artist}_${track}_${title}.mp3`.toLowerCase();
    const candidates = destNameMap.get(expectedDestName)?.filter((p) => unmatchedDest.has(p)) ?? [];

    if (candidates.length === 1) {
      const destPath = candidates[0];
      this.removeDestination(destPath, destNameMap, destTagMap, destTagKeyByPath);
      unmatchedDest.delete(destPath);
      return destPath;
    }

    return null;
  }

  private async tryTagMatch(
    sourcePath: string,
    destTagMap: Map<string, string[]>,
    destTagKeyByPath: Map<string, string>,
    unmatchedDest: Set<string>,
  ): Promise<{ type: 'exact'; destPath: string } | { type: 'ambiguous'; candidates: string[] } | null> {
    const tags = await this.tagService.readTags(sourcePath, TAG_KEYS as unknown as string[]);
    const key = this.buildTagKey(tags);
    if (!key) {
      return null;
    }

    const candidates = (destTagMap.get(key) ?? []).filter((p) => unmatchedDest.has(p));

    if (candidates.length === 1) {
      const destPath = candidates[0];
      this.removeDestination(destPath, undefined, destTagMap, destTagKeyByPath);
      unmatchedDest.delete(destPath);
      return { type: 'exact', destPath };
    }

    if (candidates.length > 1) {
      return { type: 'ambiguous', candidates };
    }

    return null;
  }

  private buildTagKey(tags: Record<string, any>): string | null {
    const values = TAG_KEYS.map((key) => this.normalizeTagValue(tags[key] ?? tags[key.toLowerCase()]));
    if (values.some((v) => v === null)) {
      return null;
    }
    return values.join('|');
  }

  private normalizeTagValue(value: any): string | null {
    if (value === undefined || value === null) {
      return null;
    }
    if (Array.isArray(value)) {
      value = value.join(' ');
    }
    const str = String(value).trim();
    return str.length > 0 ? str.toLowerCase() : null;
  }

  private removeDestination(
    destPath: string,
    destNameMap: Map<string, string[]> | undefined,
    destTagMap: Map<string, string[]>,
    destTagKeyByPath: Map<string, string>,
  ) {
    if (destNameMap) {
      const name = path.basename(destPath).toLowerCase();
      const list = destNameMap.get(name);
      if (list) {
        const index = list.indexOf(destPath);
        if (index >= 0) {
          list.splice(index, 1);
        }
        if (list.length === 0) {
          destNameMap.delete(name);
        }
      }
    }

    const tagKey = destTagKeyByPath.get(destPath);
    if (tagKey) {
      const tagList = destTagMap.get(tagKey);
      if (tagList) {
        const index = tagList.indexOf(destPath);
        if (index >= 0) {
          tagList.splice(index, 1);
        }
        if (tagList.length === 0) {
          destTagMap.delete(tagKey);
        }
      }
      destTagKeyByPath.delete(destPath);
    }
  }
}
