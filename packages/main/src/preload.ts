// packages/main/src/preload.ts
import { contextBridge, ipcRenderer } from 'electron';

/* ─────────────────────────────────────────────────────────────
 *  Typen, die der Renderer sehen darf
 * ──────────────────────────────────────────────────────────── */

type PathsPayload = Partial<{
  sourceAPath: string | null;
  sourceBPath: string | null;
  databasePath: string | null;
  backupPath: string | null;
  logFilePath: string | null;
  playlistDirectory: string | null;
}>;

/* ─────────────────────────────────────────────────────────────
 *  Sicheres API-Objekt – wird im Renderer verfügbar
 *  unter  window.electronAPI
 * ──────────────────────────────────────────────────────────── */

const electronAPI = {
  /* --- App & Version ------------------------------------ */
  getVersion: () => ipcRenderer.invoke('app:get-version'),
  getAppPath: (name: 'userData' | 'logs' | 'backup' | 'db' | 'config') =>
    ipcRenderer.invoke('app:get-path', name),

  /* --- Konfiguration ------------------------------------ */
  configGet: () => ipcRenderer.invoke('config:get'),
  configSetPaths: (paths: PathsPayload) =>
    ipcRenderer.invoke('config:setPaths', paths),
  configSetLogLevel: (level: string) =>
    ipcRenderer.invoke('config:setLogLevel', level),
  configSetMirrorPattern: (pattern: string) =>
    ipcRenderer.invoke('config:setMirrorPattern', pattern),
  configSetTagsToSync: (tags: 'ALL' | string[]) =>
    ipcRenderer.invoke('config:setTagsToSync', tags),
  configSetBidirectionalTags: (tags: string[]) =>
    ipcRenderer.invoke('config:setBidirectionalTags', tags),

  /* --- Dateisystem -------------------------------------- */
  scanDirectory: (dirPath: string) =>
    ipcRenderer.invoke('filesystem:scan-directory', dirPath),

  /* --- Dialoge ------------------------------------------ */
  selectDirectory: async () => {
    const response = await ipcRenderer.invoke('dialog:select-directory');
    if (response?.success) {
      return response.data ?? null;
    }
    throw new Error(response?.error?.message ?? 'Failed to open directory dialog');
  },
  showConfigFileInFolder: () => ipcRenderer.invoke('dialog:show-config-file'),
  openPlaylistFolder: () => ipcRenderer.invoke('config:open-playlist-folder'),

  scanSourceFiles: () => ipcRenderer.invoke('scan:source-files'),
  getInLibraryFiles: () => ipcRenderer.invoke('get:in-library-files'),


  // Pairing
  getMappings:       () => ipcRenderer.invoke('pairing:get-mappings'),
  pairingSaveMappings: (entries: { sourceAPath: string; sourceBPath: string }[]) =>
    ipcRenderer.invoke('pairing:save-mappings', entries),
  pairingSubmitDecisions: (entries: { sourceAPath: string; sourceBPath: string }[]) =>
    ipcRenderer.invoke('pairing:submit-decisions', entries),
  pairingStartInitialScan: (options?: { includeNonDj?: boolean }) =>
    ipcRenderer.invoke('pairing:start-initial-scan', options),

  // Mapping Maintenance (UC5)
  mappingsGetAll: () => ipcRenderer.invoke('mappings:get-all'),
  mappingsUpdatePaths: (
    payload: { id: number; sourceAPath: string; sourceBPath: string }[],
  ) => ipcRenderer.invoke('mappings:update-paths', payload),

  previewSync:             () => ipcRenderer.invoke('sync:preview'),
  runSync:                 () => ipcRenderer.invoke('sync:run'),

  syncBidirectional: (sourceAPath: string) => ipcRenderer.invoke('sync:bidirectional', sourceAPath),

  // Orphans
  orphansScan:   (options?: { includeNonDj?: boolean; onlyMappedAMissing?: boolean }) => ipcRenderer.invoke('orphans:scan', options),
  orphansDelete: (paths: string[]) => ipcRenderer.invoke('orphans:delete', { paths }),
  orphansUnmap:  (ids: number[])  => ipcRenderer.invoke('orphans:unmap', { ids }),
  orphansCopy:   (specs: { from: 'A' | 'B'; aPath: string; bPath: string }[]) =>
    ipcRenderer.invoke('orphans:copy', { specs }),
  orphansComputeMirror: (aPath: string) => ipcRenderer.invoke('orphans:compute-mirror', { aPath }),

  // Reporting
  reportingListRuns: (filter?: { from?: string | Date; to?: string | Date }) =>
    ipcRenderer.invoke('reporting:list-runs', filter),
  reportingListChanges: (runId: number, filter?: { status?: 'APPLIED' | 'CONFLICT' | 'ALL'; tagQuery?: string; pathQuery?: string; page?: number; pageSize?: number }) =>
    ipcRenderer.invoke('reporting:list-changes', { runId, filter }),
  reportingGenerateConflictsM3U: (runId: number, options?: { source?: 'A'|'B'; includeHeader?: boolean; destDir?: string; fileName?: string }) =>
    ipcRenderer.invoke('reporting:conflicts-m3u-generate', { runId, ...(options || {}) }),

};

/* ─────────────────────────────────────────────────────────────
 *  API im Renderer exposen
 * ──────────────────────────────────────────────────────────── */
try {
  if (process.contextIsolated) {
    contextBridge.exposeInMainWorld('electronAPI', electronAPI);
  } else {
    // Dev-Modus: direkt anhängen
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    window.electronAPI = electronAPI;
  }
} catch (err) {
  console.error('Failed to expose electronAPI:', err);
}

/*  Typen für den Renderer — so kann ein d.ts-File
    `import type { ElectronAPI } from "…"`` verwenden.            */
export type ElectronAPI = typeof electronAPI;
