// packages/renderer/src/App.tsx
import { AppShell, Burger, Group, NavLink, ScrollArea, Title } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { HashRouter, Routes, Route, Link } from 'react-router-dom'; // Use HashRouter for Electron
import { IconGauge, IconSettings, IconAdjustments, IconHistory, IconLink } from '@tabler/icons-react'; // Example icons

// Import your page components
import { SettingsPage } from './pages/SettingsPage';
import { DashboardPage } from './pages/DashboardPage';
import { PairingPage } from './pages/PairingPage';
import { MappingMaintenancePage } from './pages/MappingMaintenancePage';
import { SyncReportsPage } from './pages/SyncReportsPage';

function App() {
  const [opened, { toggle }] = useDisclosure();

  // Define navigation links
  const navLinks = [
    { icon: IconGauge, label: 'Dashboard / Sync', to: '/' },
    { icon: IconLink, label: 'Initial Pairing', to: '/pairing' },
    { icon: IconAdjustments, label: 'Edit Mappings', to: '/mappings' },
    { icon: IconHistory, label: 'Sync Reports', to: '/reports' },
    { icon: IconSettings, label: 'Settings', to: '/settings' },
  ];

  return (
    // Use HashRouter for Electron path compatibility
    <HashRouter>
      <AppShell
        padding="md"
        header={{ height: 60 }}
        navbar={{ width: 250, breakpoint: 'sm', collapsed: { mobile: !opened } }}
      >
        {/* Header */}
        <AppShell.Header>
          <Group h="100%" px="md">
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
            <Title order={3}>MP3 Tag Synchronizer</Title>
          </Group>
        </AppShell.Header>

        {/* Navbar (Navigation) */}
        <AppShell.Navbar p="md">
           <ScrollArea h="100%">
                {navLinks.map((link) => (
                <NavLink
                    key={link.label}
                    label={link.label}
                    leftSection={<link.icon size="1rem" stroke={1.5} />}
                    component={Link} // Use React Router Link component
                    to={link.to}     // Target route
                    onClick={toggle} // Close navbar on mobile after click
                    // Active highlighting might need additional logic depending on router version
                />
                ))}
           </ScrollArea>
        </AppShell.Navbar>

        {/* Main Content Area */}
        <AppShell.Main>
          {/* Define Routes */}
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/pairing" element={<PairingPage />} />
            <Route path="/mappings" element={<MappingMaintenancePage />} />
            <Route path="/reports" element={<SyncReportsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            {/* Add other routes or nested routes as needed */}
          </Routes>
        </AppShell.Main>
      </AppShell>
    </HashRouter>
  );
}

export default App;