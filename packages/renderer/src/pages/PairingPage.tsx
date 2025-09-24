// packages/renderer/src/pages/PairingPage.tsx
import { useCallback, useEffect, useState } from 'react';
import {
  Title,
  Button,
  Stack,
  Loader,
  Alert,
  ScrollArea,
  Table,
  Checkbox,
  Text,
  Group,
  Badge,
  Switch,
  Divider,
} from '@mantine/core';
import { useConfigStore } from '../store/config.store';

type PairingSuggestion = import('../global').PairingSuggestion;
type PairingScanResult = import('../global').PairingScanResult;
type UnmatchedSourceEntry = import('../global').UnmatchedSourceEntry;

export function PairingPage() {
  const sourceAPath = useConfigStore((s) => s.sourceAPath);
  const sourceBPath = useConfigStore((s) => s.sourceBPath);

  const [showOnlyDj, setShowOnlyDj] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<PairingScanResult | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<string | null>(null);

  const suggestions: PairingSuggestion[] = scanResult?.suggestions ?? [];
  const unmatchedSource: UnmatchedSourceEntry[] = scanResult?.unmatchedSource ?? [];
  const unmatchedDest: string[] = scanResult?.unmatchedDest ?? [];

  const runScan = useCallback(async () => {
    const includeNonDj = !showOnlyDj;
    if (!sourceAPath || !sourceBPath) {
      setError('Bitte Source A und Source B Pfade in den Einstellungen setzen.');
      setScanResult(null);
      setSelected(new Set());
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await window.electronAPI.pairingStartInitialScan({ includeNonDj });
      if (!res.success || !res.data) {
        throw new Error(res.error?.message ?? 'Pairing-Scan fehlgeschlagen');
      }
      setScanResult(res.data);
      setSelected(new Set(res.data.suggestions.map((s) => s.sourcePath)));
    } catch (err: any) {
      setError(err?.message ?? String(err));
      setScanResult(null);
      setSelected(new Set());
    } finally {
      setLoading(false);
    }
  }, [showOnlyDj, sourceAPath, sourceBPath]);

  useEffect(() => {
    if (sourceAPath && sourceBPath) {
      void runScan();
    }
  }, [sourceAPath, sourceBPath, runScan]);

  const toggleSelection = (src: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(src)) {
        next.delete(src);
      } else {
        next.add(src);
      }
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(suggestions.map((s) => s.sourcePath)));
  const clearAll = () => setSelected(new Set());

  const saveMappings = async () => {
    setSaving(true);
    setSaveResult(null);

    const toSave = suggestions
      .filter((s) => selected.has(s.sourcePath))
      .map((s) => ({ sourceAPath: s.sourcePath, sourceBPath: s.suggestedDestPath }));

    try {
      const res = await window.electronAPI.pairingSubmitDecisions(toSave);
      if (!res.success || !res.data) {
        throw new Error(res.error?.message ?? 'Speichern fehlgeschlagen');
      }
      setSaveResult(`Es wurden ${res.data.count} Mappings gespeichert.`);
      await runScan();
    } catch (err: any) {
      setSaveResult(`Fehler: ${err?.message ?? String(err)}`);
    } finally {
      setSaving(false);
    }
  };

  if (!sourceAPath || !sourceBPath) {
    return (
      <Stack p="md" gap="lg">
        <Title order={2}>Initial Pairing</Title>
        <Alert color="red">Bitte zuerst Source A und Source B Pfade in den Einstellungen hinterlegen.</Alert>
      </Stack>
    );
  }

  return (
    <Stack p="md" gap="lg">
      <Title order={2}>Initial Pairing</Title>

      <Group justify="space-between" align="center">
        <Switch
          label="Only show DJ-Library files"
          checked={showOnlyDj}
          onChange={(event) => setShowOnlyDj(event.currentTarget.checked)}
        />
        <Group gap="xs">
          <Button variant="subtle" onClick={() => runScan()} disabled={loading}>
            Neu scannen
          </Button>
        </Group>
      </Group>

      {loading && (
        <Stack align="center" justify="center" style={{ height: 200 }}>
          <Loader />
        </Stack>
      )}

      {error && !loading && <Alert color="red">{error}</Alert>}

      {!loading && !error && (
        <>
          <Group gap="md">
            <Text size="sm">Vorgeschlagene Paare: {suggestions.length}</Text>
            <Text size="sm">Unmatched Source: {unmatchedSource.length}</Text>
            <Text size="sm">Unmatched Destination: {unmatchedDest.length}</Text>
          </Group>

          {unmatchedSource.length > 0 && (
            <Alert color="yellow" title="Nicht zugeordnete Source-Dateien">
              <Text size="sm">
                {unmatchedSource.slice(0, 5).map((entry) => entry.sourceName).join(', ') || 'Keine Details verfügbar.'}
                {unmatchedSource.length > 5 && ` … (+${unmatchedSource.length - 5} weitere)`}
              </Text>
              <Text size="sm" c="dimmed">
                Dateien können gefiltert sein, keinen Kandidaten haben oder mehrere Kandidaten besitzen.
              </Text>
            </Alert>
          )}

          {unmatchedDest.length > 0 && (
            <Alert color="blue" title="Unzugeordnete Destination-Dateien">
              <Text size="sm">
                {unmatchedDest.slice(0, 5).map((p) => pathName(p)).join(', ') || 'Keine Details verfügbar.'}
                {unmatchedDest.length > 5 && ` … (+${unmatchedDest.length - 5} weitere)`}
              </Text>
            </Alert>
          )}

          <Group gap="xs">
            <Button onClick={selectAll} disabled={suggestions.length === 0}>
              Alle auswählen ({suggestions.length})
            </Button>
            <Button variant="outline" onClick={clearAll} disabled={selected.size === 0}>
              Auswahl aufheben
            </Button>
          </Group>

          <Button
            fullWidth
            mt="sm"
            onClick={saveMappings}
            disabled={saving || selected.size === 0}
            loading={saving}
          >
            Speichere {selected.size} Mapping(s)
          </Button>
          {saveResult && (
            <Alert mt="sm" color={saveResult.startsWith('Fehler') ? 'red' : 'green'}>
              {saveResult}
            </Alert>
          )}

          <Divider label="Vorschläge" mt="md" />

          <ScrollArea h={400} mt="sm">
            <Table highlightOnHover striped>
              <thead>
                <tr>
                  <th style={{ width: 36 }}>
                    <Checkbox
                      indeterminate={selected.size > 0 && selected.size < suggestions.length}
                      checked={suggestions.length > 0 && selected.size === suggestions.length}
                      onChange={(event) => (event.currentTarget.checked ? selectAll() : clearAll())}
                    />
                  </th>
                  <th>Source</th>
                  <th>DJ-Library</th>
                  <th>Destination</th>
                  <th>Match</th>
                </tr>
              </thead>
              <tbody>
                {suggestions.map((suggestion) => (
                  <tr key={suggestion.sourcePath}>
                    <td>
                      <Checkbox
                        checked={selected.has(suggestion.sourcePath)}
                        onChange={() => toggleSelection(suggestion.sourcePath)}
                      />
                    </td>
                    <td title={suggestion.sourcePath}>
                      <Text size="sm" fw={500}>
                        {suggestion.sourceName}
                      </Text>
                    </td>
                    <td>
                      <Badge color={suggestion.inDjLibrary ? 'green' : 'gray'}>
                        {suggestion.inDjLibrary ? 'Ja' : 'Nein'}
                      </Badge>
                    </td>
                    <td title={suggestion.suggestedDestPath}>
                      <Text size="sm">{pathName(suggestion.suggestedDestPath)}</Text>
                    </td>
                    <td>
                      <Badge color={suggestion.matchType === 'pattern' ? 'blue' : 'orange'}>
                        {suggestion.matchType === 'pattern' ? 'Pattern' : 'Tags'}
                      </Badge>
                    </td>
                  </tr>
                ))}
                {suggestions.length === 0 && (
                  <tr>
                    <td colSpan={5}>
                      <Text size="sm" c="dimmed" ta="center">
                        Keine Vorschläge gefunden.
                      </Text>
                    </td>
                  </tr>
                )}
              </tbody>
            </Table>
          </ScrollArea>
        </>
      )}
    </Stack>
  );
}

function pathName(fullPath?: string): string {
  if (!fullPath) return '—';
  const parts = fullPath.split(/[/\\]/);
  return parts[parts.length - 1] ?? fullPath;
}
