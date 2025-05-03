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
}>;

/* ─────────────────────────────────────────────────────────────
 *  Sicheres API-Objekt – wird im Renderer verfügbar
 *  unter  window.electronAPI
 * ──────────────────────────────────────────────────────────── */

const electronAPI = {
  /* --- App & Version ------------------------------------ */
  getVersion: () => ipcRenderer.invoke('app:get-version'),
  getAppPath: (name: 'userData' | 'logs' | 'backup' | 'db') =>
    ipcRenderer.invoke('app:get-path', name),

  /* --- Konfiguration ------------------------------------ */
  configGet: () => ipcRenderer.invoke('config:get'),
  configSetPaths: (paths: PathsPayload) =>
    ipcRenderer.invoke('config:setPaths', paths),
  configSetLogLevel: (level: string) =>
    ipcRenderer.invoke('config:setLogLevel', level),
  configSetTagsToSync: (tags: 'ALL' | string[]) =>
    ipcRenderer.invoke('config:setTagsToSync', tags),
  configSetBidirectionalTags: (tags: string[]) =>
    ipcRenderer.invoke('config:setBidirectionalTags', tags),

  /* --- Dateisystem -------------------------------------- */
  scanDirectory: (dirPath: string) =>
    ipcRenderer.invoke('filesystem:scan-directory', dirPath),

  /* --- Dialoge ------------------------------------------ */
  selectDirectory: () => ipcRenderer.invoke('dialog:select-directory'),
  showConfigFileInFolder: () => ipcRenderer.invoke('dialog:show-config-file'),

  scanSourceFiles: () => ipcRenderer.invoke('scan:source-files'),
  getInLibraryFiles: () => ipcRenderer.invoke('get:in-library-files'),


  // Pairing
  getMappings:       () => ipcRenderer.invoke('pairing:get-mappings'),
  pairingSaveMappings: (entries: { sourceAPath: string; sourceBPath: string }[]) =>
    ipcRenderer.invoke('pairing:save-mappings', entries),
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
