import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  base: './',
  optimizeDeps: {
    include: ['react', 'react-dom', 'react/jsx-runtime'],
  },
  resolve: {                       
    preserveSymlinks: true,    
    dedupe: ['react', 'react-dom'],
    alias: [
      {
        find: 'react',
        replacement: path.resolve(__dirname, '../../node_modules/.pnpm/react@19.1.0/node_modules/react')
      },
      {
        find: 'react-dom',
        // Replace with the ACTUAL PATH to the react-dom directory found in step 1
        replacement: path.resolve(__dirname, '../../node_modules/.pnpm/react-dom@19.1.0/node_modules/react-dom')
      },
      // We might need to add aliases for other failing dependencies like 'clsx', '@mantine/core' etc. if this works for react/react-dom
    ]
  },
  server: {                     // <--- ADD THIS SECTION
    fs: {                       // <---
      // Allow serving files from one level up to the project root
      allow: ['../..'],         // <--- Allow workspace root access
    }                           // <---
  }
});
