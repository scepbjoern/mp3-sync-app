// packages/renderer/src/App.tsx
import { AppShell, Title } from '@mantine/core';
import { SettingsPage } from './pages/SettingsPage'; // Import the new page

function App() {
  return (
    <AppShell padding="md">
      <AppShell.Header>
        <Title order={3} p="sm">MP3 Sync App</Title>
      </AppShell.Header>
      <AppShell.Main>
        {/* Render the SettingsPage instead of placeholder */}
        <SettingsPage />
      </AppShell.Main>
    </AppShell>
  );
}

export default App;