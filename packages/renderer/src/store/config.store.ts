// packages/renderer/src/store/config.store.ts
import { create } from 'zustand';

// --- Define the expected config structure LOCALLY ---
// Based on the data received from the 'config:get' IPC handler
// Only include fields the frontend store actually needs to manage.
interface ConfigData {
  sourceAPath: string | null;
  sourceBPath: string | null;
  backupPath: string | null;
  logFilePath: string | null;
  logLevel: string;
  bidirectionalTags: string[];
  tagsToSync: 'ALL' | string[];
}

// Define the store's state shape
interface ConfigState extends ConfigData {
  isLoading: boolean;
  error: string | null;
}

// Define the store's actions
interface ConfigActions {
  loadConfig: () => Promise<void>;
  setSourceAPath: (path: string | null) => Promise<void>;
  setSourceBPath: (path: string | null) => Promise<void>;
  setBackupPath: (path: string | null) => Promise<void>;
  setLogFilePath: (path: string | null) => Promise<void>;
  setLogLevel: (level: string) => Promise<void>;
  setError: (message: string | null) => void;
  setTagsToSync: (tags: 'ALL' | string[]) => Promise<void>;
  setBidirectionalTags: (tags: string[]) => Promise<void>;
}

// Define the initial state
const initialState: ConfigState = {
  isLoading: false,
  error: null,
  sourceAPath: null,
  sourceBPath: null,
  backupPath: null, // Consider if frontend needs direct access or just via app:get-path
  logFilePath: null, // Consider if frontend needs direct access or just via app:get-path
  logLevel: 'info', // Sensible default before loading
  bidirectionalTags: [],
  tagsToSync: 'ALL',
};

// Create the store
export const useConfigStore = create<ConfigState & ConfigActions>((set, get) => ({
  ...initialState,

  // --- Action to load config from backend ---
  loadConfig: async () => {
    set({ isLoading: true, error: null });
    try {
      // Call the globally exposed API from preload script
      const response = await window.electronAPI.configGet();
      if (response.success && response.data) {
        // Update state with relevant fields from the response data
        set({
          sourceAPath: response.data.sourceAPath ?? null,
          sourceBPath: response.data.sourceBPath ?? null,
          backupPath: response.data.backupPath ?? null, // Store if needed
          logFilePath: response.data.logFilePath ?? null, // Store if needed
          logLevel: response.data.logLevel ?? 'info',
          bidirectionalTags: response.data.bidirectionalTags ?? [],
          tagsToSync: response.data.tagsToSync ?? 'ALL',
          isLoading: false,
        });
      } else {
        throw new Error(response.error?.message || 'Failed to fetch config');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error loading config';
      set({ error: message, isLoading: false });
      console.error("Error loading config:", error);
    }
  },

  // --- Actions to set specific config values ---
  setSourceAPath: async (path: string | null) => {
    set({ sourceAPath: path }); // Optimistic UI update
    try {
      const response = await window.electronAPI.configSetPaths({ sourceAPath: path });
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to save Source A path');
      }
      // Optionally re-load config to confirm, or trust optimistic update
      // get().loadConfig(); // Example re-load
    } catch (error) {
       const message = error instanceof Error ? error.message : 'Unknown error saving Source A path';
       set({ error: message });
       console.error("Error setting Source A Path:", error);
       // Optional: Revert optimistic update if needed by re-loading config
    }
  },

  setLogLevel: async (level: string) => {
     set({ logLevel: level }); // Optimistic update
     try {
        const response = await window.electronAPI.configSetLogLevel(level);
        if (!response.success) {
           throw new Error(response.error?.message || 'Failed to save log level');
        }
     } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error saving log level';
        set({ error: message });
        console.error("Error setting Log Level:", error);
     }
  },

  setSourceBPath: async (path: string | null) => {
    set({ sourceBPath: path }); // Optimistic update
    try {
      // Call backend to save
      const response = await window.electronAPI.configSetPaths({ sourceBPath: path });
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to save Source B path');
      }
    } catch (error) {
       const message = error instanceof Error ? error.message : 'Unknown error saving Source B path';
       set({ error: message });
       console.error("Error setting Source B Path:", error);
       // Optional: Revert optimistic update by reloading config
       // get().loadConfig();
    }
  },

  setBackupPath: async (path: string | null) => {
    set({ backupPath: path }); // Optimistic UI update
    try {
      const response = await window.electronAPI.configSetPaths({ backupPath: path });
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to save Backup path');
      }
    } catch (error) {
       const message = error instanceof Error ? error.message : 'Unknown error saving Backup path';
       set({ error: message });
       console.error("Error setting Backup Path:", error);
    }
  },

  setLogFilePath: async (path: string | null) => {
    set({ logFilePath: path }); // Optimistic UI update
    try {
      const response = await window.electronAPI.configSetPaths({ logFilePath: path });
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to save Log File path');
      }
    } catch (error) {
       const message = error instanceof Error ? error.message : 'Unknown error saving Log File path';
       set({ error: message });
       console.error("Error setting Log File Path:", error);
    }
  },

  setError: (message: string | null) => {
    set({ error: message }); // Use the 'set' function provided by create
  },

  setTagsToSync: async (tags: 'ALL' | string[]) => {
    set({ tagsToSync: tags }); // Optimistic update
    try {
      const response = await window.electronAPI.configSetTagsToSync(tags);
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to save tags to sync');
      }
    } catch (error) {
       const message = error instanceof Error ? error.message : 'Unknown error saving tags to sync';
       set({ error: message });
       console.error("Error setting Tags to Sync:", error);
       // Optionally reload config to revert optimistic update
       // get().loadConfig();
    }
  },

  setBidirectionalTags: async (tags: string[]) => {
    // Ensure input is always an array, even if cleared
    const tagsToSave = Array.isArray(tags) ? tags : [];
    set({ bidirectionalTags: tagsToSave }); // Optimistic update
    try {
      const response = await window.electronAPI.configSetBidirectionalTags(tagsToSave);
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to save bidirectional tags');
      }
    } catch (error) {
       const message = error instanceof Error ? error.message : 'Unknown error saving bidirectional tags';
       set({ error: message });
       console.error("Error setting Bidirectional Tags:", error);
       // Optionally reload config
       // get().loadConfig();
    }
  },
}));

// Decide where to call loadConfig initially (e.g., App.tsx useEffect)