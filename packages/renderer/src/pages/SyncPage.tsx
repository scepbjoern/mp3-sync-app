// packages/renderer/src/pages/SyncPage.tsx
import {
  Button,
  Stack,
  Group,
  Text,
  Table,
  ScrollArea,
  Alert,
} from '@mantine/core';
import { useSyncStore } from '../store/sync.store';

export function SyncPage() {
  // Aktionen + State aus dem Sync‑Store
  const previewSync = useSyncStore((s) => s.preview);
  const runSync     = useSyncStore((s) => s.run);
  const clearReport = useSyncStore((s) => s.clearReport);
  const { isSyncing, syncError, syncReport } = useSyncStore();

  /* ──────────────────────────────
   * Zeilen für Tabelle vorbereiten
   * ───────────────────────────── */
  const rows = syncReport.flatMap((entry) => {
    const srcName = entry.sourcePath.split(/[\\/]/).pop()!;
    const dstName = entry.destPath.split(/[\\/]/).pop()!;

    // 1) Normale (nicht‑konfliktäre) Updates
    const pendingRows = entry.pendingUpdates.map((chg) => (
      <tr key={`${entry.sourcePath}-upd-${chg.tag}`}>
        <td>
          <Text size="xs" title={entry.sourcePath}>
            {srcName}
          </Text>
          <Text size="xs" c="dimmed" title={entry.destPath}>
            {dstName}
          </Text>
        </td>
        <td>{chg.tag}</td>
        <td>
          {String(chg.from)} → {String(chg.to)}
        </td>
        <td />
      </tr>
    ));

    // 2) Conflicts
    const conflictRows =
      (entry.conflicts ?? []).map((c) => (
        <tr
          key={`${entry.sourcePath}-conf-${c.tag}`}
          style={{ background: 'var(--mantine-color-yellow-light)' }}
        >
          <td>
            <Text size="xs" title={entry.sourcePath}>
              {srcName}
            </Text>
            <Text size="xs" c="dimmed" title={entry.destPath}>
              {dstName}
            </Text>
          </td>
          <td>{c.tag}</td>
          <td>
            {String(c.a)} ↔ {String(c.b)}
          </td>
          <td>
            <Text c="orange">Conflict</Text>
          </td>
        </tr>
      ));

    return [...pendingRows, ...conflictRows];
  });

  /* ────────────────────────────── */

  return (
    <Stack gap="lg">
      {/* Buttons */}
      <Group gap="sm">
        <Button onClick={previewSync} loading={isSyncing}>
          Preview Sync
        </Button>
        <Button
          onClick={runSync}
          loading={isSyncing}
          disabled={syncReport.length === 0}
        >
          Run Sync
        </Button>
        <Button variant="outline" onClick={clearReport}>
          Clear Report
        </Button>
      </Group>

      {/* Fehlerausgabe */}
      {syncError && <Alert color="red">{syncError}</Alert>}

      {/* Ergebnis‑Info */}
      {syncReport.length > 0 && (
        <Text size="sm">
          {syncReport.length} file
          {syncReport.length > 1 ? 's' : ''} pending – siehe Tabelle.
        </Text>
      )}

      {/* Tabelle */}
      <ScrollArea h={400}>
        <Table highlightOnHover>
          <thead>
            <tr>
              <th>Source ↔ Dest</th>
              <th>Tag</th>
              <th>Change / Values</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>{rows}</tbody>
        </Table>
      </ScrollArea>
    </Stack>
  );
}
