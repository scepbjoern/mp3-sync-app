// packages/main/src/preload.ts
import { contextBridge, ipcRenderer } from 'electron';

// Define the API structure
const electronAPI = {
  getVersion: () => ipcRenderer.invoke('app:get-version'),
  // Add other IPC functions here as needed...
  // e.g., requestScan: () => ipcRenderer.invoke('filesystem:request-scan'),
};

// Expose the API securely
try {
  contextBridge.exposeInMainWorld('electronAPI', electronAPI);
} catch (error) {
  console.error('Failed to expose electronAPI via contextBridge:', error);
}

// Define the type globally for renderer process (optional but helpful)
export type ElectronAPI = typeof electronAPI;