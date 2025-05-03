// packages/renderer/src/main.tsx
import '@mantine/core/styles.css';  // ← hier kommen alle Mantine-Global-Styles
import { createRoot } from 'react-dom/client';
import { MantineProvider } from '@mantine/core';
import App from './App';

createRoot(document.getElementById('root') as HTMLElement).render(
  <MantineProvider>
    <App />
  </MantineProvider>
);
