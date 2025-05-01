// packages/main/src/preload.ts
import { contextBridge, ipcRenderer } from 'electron';

// Define the API structure we're exposing
const electronAPI = {
  // Keep existing example
  getVersion: () => ipcRenderer.invoke('app:get-version'),

  // --- Add Config Related Functions ---
  configGet: () => ipcRenderer.invoke('config:get'),
  configSetPaths: (paths: { // Define expected argument type
    sourceAPath?: string | null;
    sourceBPath?: string | null;
    databasePath?: string | null;
    backupPath?: string | null;
    logFilePath?: string | null;
  }) => ipcRenderer.invoke('config:setPaths', paths),
  configSetLogLevel: (level: string) => ipcRenderer.invoke('config:setLogLevel', level),
  selectDirectory: () => ipcRenderer.invoke('dialog:selectDirectory'),
  getAppPath: (name: 'userData' | 'logs' | 'backup' | 'db') => ipcRenderer.invoke('app:get-path', name),
  configSetTagsToSync: (tags: 'ALL' | string[]) => ipcRenderer.invoke('config:setTagsToSync', tags),
  configSetBidirectionalTags: (tags: string[]) => ipcRenderer.invoke('config:setBidirectionalTags', tags),
  showConfigFileInFolder: () => ipcRenderer.invoke('config:show-in-folder'),

  // --- Add future IPC functions here ---
  // e.g., scanDirectory: (dirPath) => ipcRenderer.invoke('filesystem:scan-directory', dirPath),
  // e.g., onSyncProgress: (callback) => ipcRenderer.on('sync:progress', (_event, payload) => callback(payload)), // Example listener
};

// Securely expose the API to the renderer process
try {
  contextBridge.exposeInMainWorld('electronAPI', electronAPI);
} catch (error) {
  console.error('Failed to expose electronAPI via contextBridge:', error);
}

// Export the type for use in the renderer's declaration file
export type ElectronAPI = typeof electronAPI;