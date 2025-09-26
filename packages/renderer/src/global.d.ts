// packages/renderer/src/global.d.ts

import type { ConfigData } from './store/config.store'; 

// These match exactly the shape you expose in preload.ts:
export interface ElectronConfigAPI {
  // Config
  configGet(): Promise<{ success: boolean; data?: Partial<ConfigData>; error?: { message: string } }>;
  configSetPaths(
    payload: Partial<Pick<ConfigData, 'sourceAPath' | 'sourceBPath' | 'backupPath' | 'logFilePath'>>
  ): Promise<{ success: boolean; error?: { message: string } }>;
  configSetLogLevel(level: string): Promise<{ success: boolean; error?: { message: string } }>;
  configSetMirrorPattern(pattern: string): Promise<{ success: boolean; error?: { message: string } }>;
  configSetTagsToSync(tags: 'ALL' | string[]): Promise<{ success: boolean; error?: { message: string } }>;
  configSetBidirectionalTags(tags: string[]): Promise<{ success: boolean; error?: { message: string } }>;

  // Filesystem
  scanDirectory(dir: string): Promise<{ success: boolean; data?: string[]; error?: { message: string } }>;

  // Dialogs
  selectDirectory(): Promise<string | null>;
  showConfigFileInFolder(): Promise<void>;

  // DJ-Library scan
  scanSourceFiles(): Promise<{ success: boolean; data?: { total: number; updated: number }; error?: { message: string } }>;
  getInLibraryFiles(): Promise<{ success: boolean; data?: { path: string; lastModifiedAt: string | null }[]; error?: { message: string } }>;

  // Pairing
  getMappings(): Promise<{ success: boolean; data?: { sourceAPath: string; sourceBPath: string }[]; error?: { message: string } }>;
  pairingSaveMappings(
    entries: { sourceAPath: string; sourceBPath: string }[]
  ): Promise<{ success: boolean; data?: { count: number }; error?: { message: string } }>;
  pairingSubmitDecisions(
    entries: { sourceAPath: string; sourceBPath: string }[]
  ): Promise<{ success: boolean; data?: { count: number }; error?: { message: string } }>;
  pairingStartInitialScan(
    options?: { includeNonDj?: boolean }
  ): Promise<{
    success: boolean;
    data?: PairingScanResult;
    error?: { message: string };
  }>;

  // Mapping Maintenance (UC5)
  mappingsGetAll(): Promise<{
    success: boolean;
    data?: MappingRow[];
    error?: { message: string };
  }>;
  mappingsUpdatePaths(
    payload: UpdateMappingRequest[]
  ): Promise<{
    success: boolean;
    data?: UpdateMappingResponse;
    error?: { message: string };
  }>;

  previewSync(): Promise<{ success: boolean; data?: PreviewEntry[]; error?: { message: string } }>;
  runSync():     Promise<{ success: boolean; data?: { applied: number; conflicts: { source: string; tag: string; a: any; b: any }[] }; error?: { message: string } }>;

  /**
       * Bidirectional sync for one file.
       * Returns updated‐A→B tags, updated‐B→A tags, and any conflicts.
       */
  syncBidirectional(
    sourceAPath: string
  ): Promise<{
    success: boolean;
    data?: {
      updatedAtoB: string[];
      updatedBtoA: string[];
      conflicts: Array<{ tag: string; a: any; b: any }>;
    };
    error?: { message: string };
  }>;

  // Orphans
  orphansScan(options?: { includeNonDj?: boolean; onlyMappedAMissing?: boolean }): Promise<{
    success: boolean;
    data?: OrphanItem[];
    error?: { message: string };
  }>;
  orphansDelete(paths: string[]): Promise<{
    success: boolean;
    data?: { deleted: number; errors: { path: string; error: string }[] };
    error?: { message: string };
  }>;
  orphansUnmap(ids: number[]): Promise<{
    success: boolean;
    data?: { unmapped: number; errors: { id: number; error: string }[] };
    error?: { message: string };
  }>;
  orphansCopy(specs: { from: 'A' | 'B'; aPath: string; bPath: string }[]): Promise<{
    success: boolean;
    data?: { copied: number; createdMappings: number; errors: { aPath: string; bPath: string; error: string }[] };
    error?: { message: string };
  }>;
  orphansComputeMirror(aPath: string): Promise<{
    success: boolean;
    data?: { dest: string };
    error?: { message: string };
  }>;

  // Reporting
  reportingListRuns(filter?: { from?: string | Date; to?: string | Date }): Promise<{
    success: boolean;
    data?: Array<{ id: number; startedAt: string; finishedAt: string | null; appliedCount: number; conflictCount: number }>;
    error?: { message: string };
  }>;
  reportingListChanges(runId: number, filter?: { status?: 'APPLIED' | 'CONFLICT' | 'ALL'; tagQuery?: string; pathQuery?: string; page?: number; pageSize?: number }): Promise<{
    success: boolean;
    data?: { total: number; page: number; pageSize: number; rows: Array<{ id: number; createdAt: string; mappingId: number | null; sourceAPath: string; sourceBPath: string; tag: string; status: 'APPLIED' | 'CONFLICT'; direction: 'A_TO_B' | 'B_TO_A' | null; fromValue: string | null; toValue: string | null }> };
    error?: { message: string };
  }>;
}

/** --- new shared preview‐sync type --- */
export interface PreviewEntry {
  sourcePath:     string;
  destPath:       string;
  pendingUpdates: PendingUpdateEntry[];
  conflicts?:     Array<{ tag: string; a: any; b: any }>;
}

export type SyncDirection = 'A_TO_B' | 'B_TO_A';

export interface PendingUpdateEntry {
  tag: string;
  from: any;
  to: any;
  direction: SyncDirection;
}

export type PairingMatchType = 'pattern' | 'tags';
export type UnmatchedReason = 'filtered' | 'no-dest' | 'ambiguous';

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

// Orphans types
export type OrphanType = 'UNMAPPED_A' | 'UNMAPPED_B' | 'MAPPED_A_MISSING' | 'MAPPED_B_MISSING';

export interface OrphanItem {
  type: OrphanType;
  mappingId?: number;
  sourceAPath?: string;
  sourceBPath?: string;
  aExists: boolean;
  bExists: boolean;
  inDjLibrary?: boolean;
}

// UC5 types
export interface MappingRow {
  id: number;
  sourceAPath: string;
  sourceBPath: string;
  sourceAExists: boolean;
  sourceBExists: boolean;
}

export interface UpdateMappingRequest {
  id: number;
  sourceAPath: string;
  sourceBPath: string;
}

export interface UpdateMappingResultItem {
  id: number;
  ok: boolean;
  error?: string;
}

export interface UpdateMappingResponse {
  updated: number;
  results: UpdateMappingResultItem[];
}

declare global {
  interface Window {
    electronAPI: ElectronConfigAPI;
  }
}

// Make this file a module (so import of ConfigData works above)
export {};
