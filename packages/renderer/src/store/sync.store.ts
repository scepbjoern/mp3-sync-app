import { create } from 'zustand';
import type { PreviewEntry } from '../global';

interface SyncState {
  isSyncing:   boolean;
  syncError:   string | null;
  syncReport:  PreviewEntry[];
}

interface SyncActions {
  preview:     () => Promise<void>;
  run:         () => Promise<void>;
  clearReport: () => void;
}

export const useSyncStore = create<SyncState & SyncActions>((set) => ({
  isSyncing:   false,
  syncError:   null,
  syncReport:  [],

  preview: async () => {
    set({ isSyncing: true, syncError: null });
    try {
      const res = await window.electronAPI.previewSync();
      if (!res.success || !res.data) {
        throw new Error(res.error?.message ?? 'Preview failed');
      }
      set({ syncReport: res.data });
    } catch (err: any) {
      set({ syncError: err.message });
    } finally {
      set({ isSyncing: false });
    }
  },

  run: async () => {
    set({ isSyncing: true, syncError: null });
    try {
      const res = await window.electronAPI.runSync();
      if (!res.success || !res.data) {
        throw new Error(res.error?.message ?? 'Sync failed');
      }
      // we can merge results into the report if desired:
      set((s) => ({
        syncReport: s.syncReport.map((e) => ({
          ...e,
          applied: res.data!.applied,
          conflicts: res.data!.conflicts,
        })),
      }));
    } catch (err: any) {
      set({ syncError: err.message });
    } finally {
      set({ isSyncing: false });
    }
  },

  clearReport: () => set({ syncReport: [], syncError: null }),
}));
