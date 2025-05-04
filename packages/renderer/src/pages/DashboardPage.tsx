import { useCallback, useState } from 'react';
import {
  Title,
  Button,
  Stack,
  List,
  Text,
  Loader,
  Alert,
  ScrollArea,
  Code,
} from '@mantine/core';
import { useConfigStore } from '../store/config.store';

export function DashboardPage() {
  const sourceAPath   = useConfigStore((s) => s.sourceAPath);
  const sourceBPath   = useConfigStore((s) => s.sourceBPath);
  const isScanning    = useConfigStore((s) => s.isScanning);
  const scanError     = useConfigStore((s) => s.scanError);
  const scannedFilesA = useConfigStore((s) => s.scannedFilesA);

  const scanSourceA   = useConfigStore((s) => s.scanSourceA);
  const setError      = useConfigStore((s) => s.setError);
  const clearScanError = useCallback(() => setError(null), [setError]);

  // ─── DJ-Library scan state ────────────────────────────
  const [djScanLoading, setDjScanLoading] = useState(false);
  const [djScanResult,  setDjScanResult]  = useState<{ total: number; updated: number } | null>(null);
  const [djScanError,   setDjScanError]   = useState<string | null>(null);

  const handleDjScan = async () => {
    setDjScanError(null);
    setDjScanResult(null);
    setDjScanLoading(true);
    try {
      const res = await window.electronAPI.scanSourceFiles();
      if (res.success && res.data) {
        setDjScanResult(res.data);
      } else {
        throw new Error(res.error?.message || 'Unknown scan error');
      }
    } catch (err: any) {
      setDjScanError(err.message);
    } finally {
      setDjScanLoading(false);
    }
  };

  return (
    <Stack>
      <Title order={2}>Dashboard / Sync Status</Title>

      <Text size="sm">
        Source A: <Code>{sourceAPath || 'Not Set'}</Code>
      </Text>
      <Text size="sm">
        Source B: <Code>{sourceBPath || 'Not Set'}</Code>
      </Text>

      {/* ─── Scan Source A ──────────────────────────────── */}
      <Stack mt="lg" gap="sm">
        <Title order={4}>Scan Source A Files</Title>
        <Button w={200} onClick={scanSourceA} loading={isScanning} disabled={!sourceAPath}>
          Scan Source A
        </Button>
        {isScanning && <Loader size="sm" mt="xs" />}
        {scanError && (
          <Alert color="orange" mt="sm" withCloseButton onClose={clearScanError}>
            {scanError}
          </Alert>
        )}
        {!isScanning && scannedFilesA.length > 0 && (
          <>
            <Text size="sm" mt="sm">
              Found {scannedFilesA.length} {scannedFilesA.length === 1 ? 'file' : 'files'}:
            </Text>
            <ScrollArea h={300} mt="xs" style={{ border: '1px solid var(--mantine-color-gray-3)' }}>
              <List size="xs" p="xs">
                {scannedFilesA.map((fp) => (
                  <List.Item key={fp} title={fp}>
                    <Text size="xs" truncate>{fp.split(/[\\/]/).pop()}</Text>
                  </List.Item>
                ))}
              </List>
            </ScrollArea>
          </>
        )}
      </Stack>

      {/* ─── DJ-Library Scan ─────────────────────────────── */}
      <Stack mt="xl" gap="sm">
        <Title order={4}>Scan DJ-Library Membership</Title>
        <Button
          w={200}
          onClick={handleDjScan}
          loading={djScanLoading}
          disabled={!sourceAPath}
        >
          Scan DJ Library
        </Button>
        {djScanLoading && <Loader size="sm" mt="xs" />}
        {djScanError && (
          <Alert color="red" mt="sm" withCloseButton onClose={() => setDjScanError(null)}>
            {djScanError}
          </Alert>
        )}
        {djScanResult && (
          <Text size="sm" mt="sm">
            Scanned {djScanResult.total} files; updated {djScanResult.updated} records.
          </Text>
        )}
      </Stack>
    </Stack>
  );
}
