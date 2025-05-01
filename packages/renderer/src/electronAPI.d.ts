// packages/renderer/src/electronAPI.d.ts
// Import the type structure from the preload script
import type { ElectronAPI as MainElectronAPI } from '../../main/src/preload';

// Augment the global Window interface
declare global {
  interface Window {
    electronAPI: MainElectronAPI;
  }
}

// Optional: You might need to export something empty if your tsconfig requires it
// export {};