// packages/renderer/src/pages/MappingMaintenancePage.tsx
import { useEffect, useMemo, useState } from 'react';
import {
  Title,
  Button,
  Stack,
  Loader,
  Alert,
  Table,
  TextInput,
  Group,
  Badge,
  ScrollArea,
} from '@mantine/core';

type MappingRow = import('../global').MappingRow;
type UpdateMappingRequest = import('../global').UpdateMappingRequest;
type UpdateMappingResponse = import('../global').UpdateMappingResponse;

interface RowEditState {
  sourceAPath: string;
  sourceBPath: string;
  errorA?: string;
  errorB?: string;
  dirty: boolean;
}

const validatePath = (p: string): string | null => {
  const isAbs = /^(?:[A-Za-z]:\\|\\\\|\/)/.test(p);
  if (!isAbs) return 'Path must be absolute';
  if (!p.toLowerCase().endsWith('.mp3')) return 'Path must end with .mp3';
  return null;
};

export function MappingMaintenancePage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<MappingRow[]>([]);
  const [edits, setEdits] = useState<Record<number, RowEditState>>({});
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await window.electronAPI.mappingsGetAll();
      if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Failed to load mappings');
      setRows(res.data);
      // Initialize edit state
      const init: Record<number, RowEditState> = {};
      for (const r of res.data) {
        init[r.id] = { sourceAPath: r.sourceAPath, sourceBPath: r.sourceBPath, dirty: false };
      }
      setEdits(init);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const dirtyCount = useMemo(() => Object.values(edits).filter(e => e.dirty).length, [edits]);

  const onChange = (id: number, field: 'sourceAPath'|'sourceBPath', value: string) => {
    setEdits(prev => {
      const next = { ...prev };
      const cur = next[id] ?? { sourceAPath: '', sourceBPath: '', dirty: false };
      const updated: RowEditState = { ...cur, [field]: value, dirty: true } as RowEditState;
      updated.errorA = validatePath(updated.sourceAPath) ?? undefined;
      updated.errorB = validatePath(updated.sourceBPath) ?? undefined;
      next[id] = updated;
      return next;
    });
  };

  const save = async () => {
    setSaving(true);
    setSaveMsg(null);
    try {
      const payload: UpdateMappingRequest[] = Object.entries(edits)
        .filter(([, e]) => e.dirty && !e.errorA && !e.errorB)
        .map(([id, e]) => ({ id: Number(id), sourceAPath: e.sourceAPath, sourceBPath: e.sourceBPath }));

      if (!payload.length) {
        setSaveMsg('Nothing to save.');
        return;
      }

      const res = await window.electronAPI.mappingsUpdatePaths(payload);
      if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Update failed');
      const data: UpdateMappingResponse = res.data;
      const ok = data.results.filter(r => r.ok).length;
      const failed = data.results.filter(r => !r.ok);
      setSaveMsg(`Updated ${ok} row(s).${failed.length ? ' Errors: ' + failed.map(f => `${f.id}: ${f.error}`).join('; ') : ''}`);
      await load();
    } catch (e: any) {
      setSaveMsg(`Error: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Stack p="md" gap="md">
      <Group justify="space-between">
        <Title order={2}>Mapping Maintenance</Title>
        <Button variant="subtle" onClick={() => load()} disabled={loading}>Reload</Button>
      </Group>

      {loading && <Loader />}
      {error && <Alert color="red">{error}</Alert>}

      {!loading && !error && (
        <>
          <Group gap="sm">
            <Button onClick={save} disabled={saving || dirtyCount === 0} loading={saving}>Save ({dirtyCount})</Button>
            {saveMsg && <Alert color={saveMsg.startsWith('Error') ? 'red' : 'green'}>{saveMsg}</Alert>}
          </Group>

          <ScrollArea h={460} mt="sm">
            <Table striped highlightOnHover withTableBorder>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Source A Path</th>
                  <th>Source B Path</th>
                  <th>Exists A</th>
                  <th>Exists B</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => {
                  const e = edits[r.id];
                  const errA = e?.errorA;
                  const errB = e?.errorB;
                  return (
                    <tr key={r.id}>
                      <td>{r.id}</td>
                      <td>
                        <TextInput
                          value={e?.sourceAPath ?? r.sourceAPath}
                          onChange={(ev) => onChange(r.id, 'sourceAPath', ev.currentTarget.value)}
                          error={errA}
                        />
                      </td>
                      <td>
                        <TextInput
                          value={e?.sourceBPath ?? r.sourceBPath}
                          onChange={(ev) => onChange(r.id, 'sourceBPath', ev.currentTarget.value)}
                          error={errB}
                        />
                      </td>
                      <td>
                        <Badge color={r.sourceAExists ? 'green' : 'red'}>{r.sourceAExists ? 'Yes' : 'No'}</Badge>
                      </td>
                      <td>
                        <Badge color={r.sourceBExists ? 'green' : 'red'}>{r.sourceBExists ? 'Yes' : 'No'}</Badge>
                      </td>
                    </tr>
                  );
                })}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={5}><Alert color="yellow">No mappings found.</Alert></td>
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