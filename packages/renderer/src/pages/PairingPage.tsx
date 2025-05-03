// packages/renderer/src/pages/PairingPage.tsx
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  Title, Button, Stack, Loader, Alert, ScrollArea,
  Table, Checkbox, Text, Group,
} from '@mantine/core';
import { useConfigStore } from '../store/config.store';

interface FileEntry { path: string; lastModifiedAt: string | null; }
interface Suggestion { sourcePath: string; sourceName: string; destPath: string | null; destName: string | null; }

export function PairingPage() {
  const sourceAPath = useConfigStore(s => s.sourceAPath)!;
  const sourceBPath = useConfigStore(s => s.sourceBPath)!;

  const [srcList , setSrcList ] = useState<FileEntry[]>([]);
  const [dstList , setDstList ] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error  , setError  ] = useState<string | null>(null);

  // bereits gespeicherte Mappings
  const [existing, setExisting] = useState<Set<string>>(new Set());

  const [selected  , setSelected   ] = useState<Set<string>>(new Set());
  const [saving    , setSaving     ] = useState(false);
  const [saveResult, setSaveResult] = useState<string | null>(null);

  // 1) Quelle, Ziel & existierende Mappings laden
  useEffect(() => {
    if (!sourceAPath || !sourceBPath) {
      setError('Bitte beider Pfade in den Settings setzen.');
      return;
    }
    (async () => {
      setLoading(true);
      setError(null);
      try {
        // a) In-Library Files
        const resA = await window.electronAPI.getMappings(); // hier holen wir jetzt auch die existierenden Mappings
        // resA.data enthält alle gespeicherten pairs
        if (!resA.success || !resA.data) throw new Error(resA.error?.message);
        const mapped = new Set(
          resA.data.map((r: { sourceAPath: string; sourceBPath: string }) => r.sourceAPath)
        );
        setExisting(mapped);

        const resLib = await window.electronAPI.getInLibraryFiles();
        if (!resLib.success || !resLib.data) throw new Error(resLib.error?.message);
        setSrcList(resLib.data);

        // b) Destination scannen
        const resB = await window.electronAPI.scanDirectory(sourceBPath);
        if (!resB.success || !resB.data) throw new Error(resB.error?.message);
        setDstList(resB.data.map(p => ({ path: p, lastModifiedAt: null })));

        // c) Vorauswahl: bereits gespeicherte Einträge markieren
        setSelected(new Set(mapped));
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [sourceAPath, sourceBPath]);

  // 2) Matching-Logik wie gehabt…
  const suggestions: Suggestion[] = useMemo(() => {
    const destMap = new Map<string, FileEntry>();
    dstList.forEach(d => destMap.set(d.path.split(/[\\/]/).pop()!.toLowerCase(), d));
    const regex = /^(\d+)_([^_]+)_(.+)\.mp3$/i;
    return srcList.map(src => {
      const srcName = src.path.split(/[\\/]/).pop()!;
      const m = regex.exec(srcName);
      if (m) {
        const [, track, artist, title] = m;
        const destName = `${artist}_${track}_${title}.mp3`;
        const match = destMap.get(destName.toLowerCase());
        return { sourcePath: src.path, sourceName: srcName, destPath: match?.path ?? null, destName: match ? destName : null };
      }
      return { sourcePath: src.path, sourceName: srcName, destPath: null, destName: null };
    });
  }, [srcList, dstList]);

  const allMatches = suggestions.filter(s => s.destPath).map(s => s.sourcePath);

  const toggle = useCallback((src: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(src) ? next.delete(src) : next.add(src);
      return next;
    });
  }, []);

  const selectAll = () => setSelected(new Set(allMatches));
  const clearAll  = () => setSelected(new Set());

  // 3) Speichern
  const saveMappings = async () => {
    setSaving(true);
    setSaveResult(null);
    const toSave = suggestions
      .filter(s => selected.has(s.sourcePath) && s.destPath)
      .map(s => ({ sourceAPath: s.sourcePath, sourceBPath: s.destPath! }));
    try {
      const res = await window.electronAPI.pairingSaveMappings(toSave);
      if (res.success && res.data) {
        setSaveResult(`Es wurden ${res.data.count} Mappings gespeichert.`);
        // Update existing & reset Selection
        setExisting(prev => new Set([...prev, ...toSave.map(t => t.sourceAPath)]));
        setSelected(new Set());
      } else {
        throw new Error(res.error?.message || 'Speichern fehlgeschlagen');
      }
    } catch (e: any) {
      setSaveResult(`Fehler: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <Stack align="center" justify="center" style={{ height: 300 }}><Loader/></Stack>;
  }

  return (
    <Stack p="md" gap="lg">
      <Title order={2}>Initial Pairing</Title>
      {error && <Alert color="red">{error}</Alert>}

      <Group gap="xs">
        <Button onClick={selectAll} disabled={!allMatches.length}>Alle Matches auswählen ({allMatches.length})</Button>
        <Button variant="outline" onClick={clearAll} disabled={!selected.size}>Auswahl aufheben</Button>
      </Group>

      <Button fullWidth mt="sm" onClick={saveMappings} disabled={saving || !selected.size} loading={saving}>
        Speichere {selected.size} Mapping(s)
      </Button>
      {saveResult && <Alert mt="sm" color={saveResult.startsWith('Fehler') ? 'red' : 'green'}>{saveResult}</Alert>}

      <ScrollArea h={400} mt="md">
        <Table highlightOnHover>
          <thead>
            <tr>
              <th style={{ width: 40 }}>
                <Checkbox
                  indeterminate={selected.size > 0 && selected.size < allMatches.length}
                  checked={allMatches.length > 0 && selected.size === allMatches.length}
                  onChange={e => e.currentTarget.checked ? selectAll() : clearAll()}
                />
              </th>
              <th>Source Datei</th>
              <th>Vorgeschlagene Destination</th>
            </tr>
          </thead>
          <tbody>
            {suggestions.map(s => {
              const isExisting = existing.has(s.sourcePath);
              return (
                <tr key={s.sourcePath} style={isExisting ? { opacity: 0.5 } : undefined}>
                  <td>
                    <Checkbox
                      disabled={!s.destPath || isExisting}
                      checked={selected.has(s.sourcePath)}
                      onChange={() => toggle(s.sourcePath)}
                    />
                  </td>
                  <td title={s.sourcePath}>{s.sourceName}</td>
                  <td>{s.destName ?? <Text c="dimmed">— kein Match —</Text>}</td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </ScrollArea>
    </Stack>
  );
}
