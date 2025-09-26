// packages/renderer/src/pages/SyncReportsPage.tsx
import { useEffect, useState } from 'react';
import { Alert, Button, Group, Loader, Pagination, ScrollArea, Select, Stack, Table, Text, TextInput, Title } from '@mantine/core';

type RunSummary = { id: number; startedAt: string; finishedAt: string | null; appliedCount: number; conflictCount: number };
type ChangeRow = { id: number; createdAt: string; mappingId: number | null; sourceAPath: string; sourceBPath: string; tag: string; status: 'APPLIED' | 'CONFLICT'; direction: 'A_TO_B' | 'B_TO_A' | null; fromValue: string | null; toValue: string | null };

export function SyncReportsPage() {
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [runsLoading, setRunsLoading] = useState(false);
  const [runsError, setRunsError] = useState<string | null>(null);

  const [selectedRunId, setSelectedRunId] = useState<number | null>(null);

  const [statusFilter, setStatusFilter] = useState<'ALL' | 'APPLIED' | 'CONFLICT'>('ALL');
  const [tagQuery, setTagQuery] = useState('');
  const [pathQuery, setPathQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);

  const [changes, setChanges] = useState<ChangeRow[]>([]);
  const [changesTotal, setChangesTotal] = useState(0);
  const [changesLoading, setChangesLoading] = useState(false);
  const [changesError, setChangesError] = useState<string | null>(null);

  const loadRuns = async () => {
    setRunsLoading(true); setRunsError(null);
    try {
      const res = await window.electronAPI.reportingListRuns();
      if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Failed to load runs');
      setRuns(res.data);
      if (!selectedRunId && res.data.length > 0) setSelectedRunId(res.data[0].id);
    } catch (e: any) {
      setRunsError(e?.message ?? String(e));
    } finally {
      setRunsLoading(false);
    }
  };

  const loadChanges = async () => {
    if (!selectedRunId) { setChanges([]); setChangesTotal(0); return; }
    setChangesLoading(true); setChangesError(null);
    try {
      const res = await window.electronAPI.reportingListChanges(selectedRunId, { status: statusFilter, tagQuery, pathQuery, page, pageSize });
      if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Failed to load changes');
      setChanges(res.data.rows);
      setChangesTotal(res.data.total);
    } catch (e: any) {
      setChangesError(e?.message ?? String(e));
    } finally {
      setChangesLoading(false);
    }
  };

  useEffect(() => {
    loadRuns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // when selected run or filters change
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRunId, statusFilter, tagQuery, pathQuery, pageSize]);

  useEffect(() => {
    loadChanges();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRunId, statusFilter, tagQuery, pathQuery, page, pageSize]);

  const runRows = runs.map((r) => {
    const isSel = r.id === selectedRunId;
    return (
      <tr key={r.id} style={{ backgroundColor: isSel ? 'rgba(0, 128, 255, 0.08)' : undefined, cursor: 'pointer' }} onClick={() => setSelectedRunId(r.id)}>
        <td><Text size="sm">{r.id}</Text></td>
        <td><Text size="sm">{new Date(r.startedAt).toLocaleString()}</Text></td>
        <td><Text size="sm">{r.finishedAt ? new Date(r.finishedAt).toLocaleString() : '-'}</Text></td>
        <td><Text size="sm">{r.appliedCount}</Text></td>
        <td><Text size="sm" c={r.conflictCount > 0 ? 'red' : undefined}>{r.conflictCount}</Text></td>
      </tr>
    );
  });

  const changeRows = changes.map((c) => (
    <tr key={c.id}>
      <td><Text size="xs">{new Date(c.createdAt).toLocaleString()}</Text></td>
      <td><Text size="xs">{c.status}{c.direction ? `/${c.direction}` : ''}</Text></td>
      <td><Text size="xs">{c.tag}</Text></td>
      <td><Text size="xs" lineClamp={2} title={c.sourceAPath}>{c.sourceAPath}</Text></td>
      <td><Text size="xs" lineClamp={2} title={c.sourceBPath}>{c.sourceBPath}</Text></td>
      <td><Text size="xs" lineClamp={2} title={c.fromValue ?? ''}>{c.fromValue ?? ''}</Text></td>
      <td><Text size="xs" lineClamp={2} title={c.toValue ?? ''}>{c.toValue ?? ''}</Text></td>
    </tr>
  ));

  const totalPages = Math.max(1, Math.ceil(changesTotal / pageSize));

  return (
    <Stack p="md" gap="md">
      <Group justify="space-between">
        <Title order={2}>Sync Reports</Title>
        <Group>
          <Button onClick={loadRuns} leftSection={runsLoading ? <Loader size="xs"/> : undefined} disabled={runsLoading}>Reload Runs</Button>
        </Group>
      </Group>

      {runsError && <Alert color="red" onClose={() => setRunsError(null)} withCloseButton>{runsError}</Alert>}

      <Group align="flex-start" grow>
        <Stack gap="xs" style={{ minWidth: 380, maxWidth: 520 }}>
          <Text fw={600}>Runs</Text>
          <ScrollArea h={320}>
            <Table striped highlightOnHover withRowBorders={false} stickyHeader stickyHeaderOffset={0}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>ID</Table.Th>
                  <Table.Th>Started</Table.Th>
                  <Table.Th>Finished</Table.Th>
                  <Table.Th>Applied</Table.Th>
                  <Table.Th>Conflicts</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {runRows}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        </Stack>

        <Stack gap="xs" style={{ flex: 1 }}>
          <Group>
            <Select
              label="Status"
              w={160}
              value={statusFilter}
              data={[{ value: 'ALL', label: 'ALL' }, { value: 'APPLIED', label: 'APPLIED' }, { value: 'CONFLICT', label: 'CONFLICT' }]}
              onChange={(v) => setStatusFilter((v as any) ?? 'ALL')}
            />
            <TextInput label="Tag contains" value={tagQuery} onChange={(e) => setTagQuery(e.currentTarget.value)} w={200} />
            <TextInput label="Path contains" value={pathQuery} onChange={(e) => setPathQuery(e.currentTarget.value)} w={280} />
            <Select
              label="Page size"
              w={120}
              value={String(pageSize)}
              data={[{ value: '50', label: '50' }, { value: '100', label: '100' }, { value: '200', label: '200' }]}
              onChange={(v) => setPageSize(parseInt(v || '100', 10))}
            />
            <Button onClick={() => loadChanges()} leftSection={changesLoading ? <Loader size="xs"/> : undefined} disabled={changesLoading || !selectedRunId}>Apply Filters</Button>
          </Group>

          {changesError && <Alert color="red" onClose={() => setChangesError(null)} withCloseButton>{changesError}</Alert>}

          <ScrollArea h={420}>
            <Table striped highlightOnHover stickyHeader stickyHeaderOffset={0}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Time</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Tag</Table.Th>
                  <Table.Th>Source A</Table.Th>
                  <Table.Th>Source B</Table.Th>
                  <Table.Th>From</Table.Th>
                  <Table.Th>To</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {changeRows}
              </Table.Tbody>
            </Table>
          </ScrollArea>

          <Group justify="space-between" align="center">
            <Text size="sm">Total: {changesTotal}</Text>
            <Pagination total={totalPages} value={page} onChange={setPage} />
          </Group>
        </Stack>
      </Group>
    </Stack>
  );
}