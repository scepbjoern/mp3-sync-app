// packages/renderer/vite.config.ts (Simplified)
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// import path from 'node:path'; // No longer needed

export default defineConfig({
  plugins: [react()],
  base: './',
  // optimizeDeps: { // <-- Remove or comment out
  //   include: ['react', 'react-dom', 'react/jsx-runtime'],
  // },
  // resolve: { // <-- Remove or comment out 'resolve' section
  //   preserveSymlinks: true,
  //   dedupe: ['react', 'react-dom'],
  //   alias: [ /* ... */ ]
  // },
  server: {
    fs: {
      allow: ['../..'], // Keep this for now
    }
  }
});