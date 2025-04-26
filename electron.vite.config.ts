// electron.vite.config.ts (REVISED - Add Renderer Input)
import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react' // Ensure root dev dependency: pnpm add -D -w @vitejs/plugin-react

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      lib: {
        entry: resolve('packages/main/src/main.ts'),
      },
      rollupOptions: {
        output: {
          format: 'cjs',
          // nodeCtx: 'node', // Removed as it caused TS errors previously
        },
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      lib: {
        entry: resolve('packages/main/src/preload.ts'),
      },
      rollupOptions: {
        output: {
          format: 'cjs',
          // nodeCtx: 'node', // Removed as it caused TS errors previously
        }
      }
    }
  },
  renderer: {
    // Define the root directory for the renderer source code
    root: resolve('packages/renderer/'),
    // ADD the build configuration required by electron-vite:
    build: {                 // <--- ADD THIS SECTION
      rollupOptions: {         // <---
        input: resolve('packages/renderer/index.html'), // <--- Point to index.html
      },                       // <---
    },                         // <--- END ADDED SECTION
    // Note: electron-vite should still pick up and use
    // packages/renderer/vite.config.ts for Vite-specific settings
    // like plugins, resolve options, server options etc. based on the 'root'.
  }
})