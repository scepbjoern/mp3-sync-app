// packages/renderer/src/App.tsx
import { AppShell, Title } from '@mantine/core';

function App() {
  return (
    <AppShell padding="md">
      <AppShell.Header>
        <Title order={3} p="sm">MP3 Sync App</Title>
      </AppShell.Header>
      <AppShell.Main>
        <Title order={1}>Hello Electron + React + Mantine!</Title>
        {/* UI content will go here */}
      </AppShell.Main>
    </AppShell>
  );
}

export default App;