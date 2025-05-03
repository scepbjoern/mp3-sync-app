// packages/renderer/src/store/config.store.ts
import { create } from 'zustand';

//
// ——— Data & Action Types —————————————————————————
//
export interface ConfigData {
  sourceAPath:       string | null;
  sourceBPath:       string | null;
  backupPath:        string | null;
  logFilePath:       string | null;
  logLevel:          string;
  bidirectionalTags: string[];
  tagsToSync:        'ALL' | string[];
}

export interface ScanState {
  isScanning:    boolean;
  scanError:     string | null;
  scannedFilesA: string[];
}

export interface ConfigState extends ConfigData, ScanState {
  isLoading: boolean;
  error:     string | null;
}

export interface ConfigActions {
  loadConfig:           () => Promise<void>;
  setSourceAPath:       (path: string | null) => Promise<void>;
  setSourceBPath:       (path: string | null) => Promise<void>;
  setBackupPath:        (path: string | null) => Promise<void>;
  setLogFilePath:       (path: string | null) => Promise<void>;
  setLogLevel:          (level: string)      => Promise<void>;
  setTagsToSync:        (tags: 'ALL' | string[]) => Promise<void>;
  setBidirectionalTags: (tags: string[])         => Promise<void>;
  setError:             (message: string | null) => void;
  scanSourceA:          () => Promise<void>;
}

//
// ——— Initial State ———————————————————————————————————
const initialState: ConfigState = {
  // loading/error
  isLoading:    false,
  error:        null,

  // config fields
  sourceAPath:       null,
  sourceBPath:       null,
  backupPath:        null,
  logFilePath:       null,
  logLevel:          'info',
  bidirectionalTags: [],
  tagsToSync:        'ALL',

  // scan state
  isScanning:    false,
  scanError:     null,
  scannedFilesA: [],
};

//
// ——— Store Definition ———————————————————————————————
export const useConfigStore = create<ConfigState & ConfigActions>((set, get) => ({
  ...initialState,

  // — Load the saved config from main —
  loadConfig: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await window.electronAPI.configGet();
      if (res.success && res.data) {
        set({
          sourceAPath:       res.data.sourceAPath       ?? null,
          sourceBPath:       res.data.sourceBPath       ?? null,
          backupPath:        res.data.backupPath        ?? null,
          logFilePath:       res.data.logFilePath       ?? null,
          logLevel:          res.data.logFilePath ? res.data.logFilePath : 'info',
          bidirectionalTags: res.data.bidirectionalTags ?? [],
          tagsToSync:        res.data.tagsToSync        ?? 'ALL',
          isLoading:         false,
        });
      } else {
        throw new Error(res.error?.message || 'Failed to load config');
      }
    } catch (e: any) {
      console.error('loadConfig error:', e);
      set({ error: e.message || 'Unknown error loading config', isLoading: false });
    }
  },

  // — Individual setters, all optimistic —
  setSourceAPath: async (p) => {
    set({ sourceAPath: p });
    try {
      const r = await window.electronAPI.configSetPaths({ sourceAPath: p });
      if (!r.success) throw new Error(r.error?.message);
    } catch (e: any) {
      console.error('setSourceAPath error:', e);
      set({ error: e.message || 'Error saving Source A path' });
    }
  },

  setSourceBPath: async (p) => {
    set({ sourceBPath: p });
    try {
      const r = await window.electronAPI.configSetPaths({ sourceBPath: p });
      if (!r.success) throw new Error(r.error?.message);
    } catch (e: any) {
      console.error('setSourceBPath error:', e);
      set({ error: e.message || 'Error saving Source B path' });
    }
  },

  setBackupPath: async (p) => {
    set({ backupPath: p });
    try {
      const r = await window.electronAPI.configSetPaths({ backupPath: p });
      if (!r.success) throw new Error(r.error?.message);
    } catch (e: any) {
      console.error('setBackupPath error:', e);
      set({ error: e.message || 'Error saving Backup path' });
    }
  },

  setLogFilePath: async (p) => {
    set({ logFilePath: p });
    try {
      const r = await window.electronAPI.configSetPaths({ logFilePath: p });
      if (!r.success) throw new Error(r.error?.message);
    } catch (e: any) {
      console.error('setLogFilePath error:', e);
      set({ error: e.message || 'Error saving Log File path' });
    }
  },

  setLogLevel: async (lvl) => {
    set({ logLevel: lvl });
    try {
      const r = await window.electronAPI.configSetLogLevel(lvl);
      if (!r.success) throw new Error(r.error?.message);
    } catch (e: any) {
      console.error('setLogLevel error:', e);
      set({ error: e.message || 'Error saving Log Level' });
    }
  },

  setTagsToSync: async (tags) => {
    set({ tagsToSync: tags });
    try {
      const r = await window.electronAPI.configSetTagsToSync(tags);
      if (!r.success) throw new Error(r.error?.message);
    } catch (e: any) {
      console.error('setTagsToSync error:', e);
      set({ error: e.message || 'Error saving Tags to Sync' });
    }
  },

  setBidirectionalTags: async (tags) => {
    const arr = Array.isArray(tags) ? tags : [];
    set({ bidirectionalTags: arr });
    try {
      const r = await window.electronAPI.configSetBidirectionalTags(arr);
      if (!r.success) throw new Error(r.error?.message);
    } catch (e: any) {
      console.error('setBidirectionalTags error:', e);
      set({ error: e.message || 'Error saving Bidirectional Tags' });
    }
  },

  setError: (msg) => {
    set({ error: msg });
  },

  // — Scan Source A folder for MP3s —
  scanSourceA: async () => {
    const dir = get().sourceAPath;
    if (!dir) {
      set({ isScanning: false, scanError: 'Source A path not set.', scannedFilesA: [] });
      return;
    }
    set({ isScanning: true, scanError: null, scannedFilesA: [] });
    try {
      const r = await window.electronAPI.scanDirectory(dir);
      if (r.success && r.data) {
        set({ scannedFilesA: r.data, isScanning: false });
      } else {
        throw new Error(r.error?.message);
      }
    } catch (e: any) {
      console.error('scanSourceA error:', e);
      set({ scanError: e.message || 'Error scanning directory.', isScanning: false });
    }
  },

  
}));
