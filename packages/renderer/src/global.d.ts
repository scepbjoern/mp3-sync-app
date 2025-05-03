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

  previewSync(): Promise<{
    success: boolean;
    data?: PreviewEntry[];
    error?: { message: string };
  }>;

  /** Run actual sync: returns how many applied and any conflicts */
  runSync(): Promise<{
    success: boolean;
    data?: { applied: number; conflicts: Array<{ source: string; tag: string; a: any; b: any }> };
    error?: { message: string };
  }>;

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
}

/** --- new shared preview‐sync type --- */
export interface PreviewEntry {
  filePath: string;
  pendingUpdates: { tag: string; from: any; to: any }[];
  applied?: number;           // ← number instead of string[]
  conflicts?: { tag: string; a: any; b: any }[];
}

declare global {
  interface Window {
    electronAPI: ElectronConfigAPI;
  }
}

// Make this file a module (so import of ConfigData works above)
export {};
