// packages/renderer/src/pages/OrphansPage.tsx
import { useEffect, useState } from 'react';
import { Alert, Badge, Button, Checkbox, Group, Loader, ScrollArea, Stack, Switch, Table, Text } from '@mantine/core';
import type { OrphanItem } from '../global';

interface ConfigLike {
  sourceAPath: string | null;
  sourceBPath: string | null;
}

function toWin(p: string) { return p.replace(/\//g, '\\'); }
function toNorm(p: string) { return p.replace(/\\/g, '/'); }

function mirrorPath(aPath: string, aRoot: string, bRoot: string): string {
  const aPathNorm = toNorm(aPath);
  const aRootNorm = toNorm(aRoot);
  const aLower = aPathNorm.toLowerCase();
  const rootLower = aRootNorm.toLowerCase();
  if (aLower.startsWith(rootLower)) {
    let rel = aPathNorm.slice(aRootNorm.length);
    if (rel.startsWith('/')) rel = rel.slice(1);
    const dest = toWin(`${toNorm(bRoot)}/${rel}`);
    return dest;
  }
  // Fallback: place under bRoot with just filename
  const fname = aPathNorm.split('/').pop() || 'unknown.mp3';
  return toWin(`${toNorm(bRoot)}/${fname}`);
}

export function OrphansPage() {
  const [includeNonDj, setIncludeNonDj] = useState(false);
  const [onlyMappedAMissing, setOnlyMappedAMissing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<OrphanItem[]>([]);
  const [cfg, setCfg] = useState<ConfigLike>({ sourceAPath: null, sourceBPath: null });
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      try {
        const res = await window.electronAPI.configGet();
        if (res.success && res.data) {
          setCfg({ sourceAPath: res.data.sourceAPath ?? null, sourceBPath: res.data.sourceBPath ?? null });
        }
      } catch (e) {
        // noop
      }
    })();
  }, []);

  const scan = async () => {
    setLoading(true); setError(null);
    try {
      const options = onlyMappedAMissing ? { onlyMappedAMissing: true } : { includeNonDj };
      const res = await window.electronAPI.orphansScan(options as any);
      if (!res.success || !res.data) throw new Error(res.error?.message ?? 'scan failed');
      setRows(res.data);
      setSelectedKeys(new Set());
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // initial scan
    scan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // re-scan when toggles change
    scan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [includeNonDj, onlyMappedAMissing]);

  const onDelete = async (path: string) => {
    setLoading(true); setError(null);
    try {
      const res = await window.electronAPI.orphansDelete([path]);
      if (!res.success) throw new Error(res.error?.message ?? 'delete failed');
      await scan();
    } catch (e: any) {
      setError(e?.message ?? String(e));
      setLoading(false);
    }
  };

  const onUnmap = async (id: number) => {
    setLoading(true); setError(null);
    try {
      const res = await window.electronAPI.orphansUnmap([id]);
      if (!res.success) throw new Error(res.error?.message ?? 'unmap failed');
      await scan();
    } catch (e: any) {
      setError(e?.message ?? String(e));
      setLoading(false);
    }
  };

  const onCopyMirrorAtoB = async (aPath: string) => {
    if (!cfg.sourceAPath || !cfg.sourceBPath) { setError('Configure Source A/B first'); return; }
    const dest = mirrorPath(aPath, cfg.sourceAPath, cfg.sourceBPath);
    await onCopy([{ from: 'A', aPath, bPath: dest }]);
  };

  const onCopyToMapped = async (aPath: string, bPath: string, from: 'A' | 'B') => {
    await onCopy([{ from, aPath, bPath }]);
  };

  const onCopy = async (specs: { from: 'A'|'B'; aPath: string; bPath: string }[]) => {
    setLoading(true); setError(null);
    try {
      const res = await window.electronAPI.orphansCopy(specs);
      if (!res.success) throw new Error(res.error?.message ?? 'copy failed');
      await scan();
    } catch (e: any) {
      setError(e?.message ?? String(e));
      setLoading(false);
    }
  };

  const rowsView = rows.map((o, idx) => {
    const a = o.sourceAPath ?? '';
    const b = o.sourceBPath ?? '';
    const key = `${o.type}|${o.mappingId ?? idx}|${a}|${b}`;
    const checked = selectedKeys.has(key);
    const toggle = () => {
      setSelectedKeys((prev) => {
        const next = new Set(prev);
        if (next.has(key)) next.delete(key); else next.add(key);
        return next;
      });
    };
    return (
      <tr key={`${o.type}-${o.mappingId ?? idx}`}>
        <td>
          <Checkbox checked={checked} onChange={toggle} />
        </td>
        <td>
          <Group gap="xs">
            <Badge variant="light" color={o.type.includes('UNMAPPED') ? 'gray' : 'yellow'}>{o.type}</Badge>
            {typeof o.inDjLibrary === 'boolean' && (
              <Badge size="xs" color={o.inDjLibrary ? 'green' : 'gray'}>{o.inDjLibrary ? 'DJ' : 'non-DJ'}</Badge>
            )}
          </Group>
        </td>
        <td>
          {a && (<Text size="xs" title={a}>A: {a}</Text>)}
          {b && (<Text size="xs" title={b}>B: {b}</Text>)}
        </td>
        <td>
          <Group gap="xs">
            {o.type === 'UNMAPPED_A' && (
              <>
                <Button size="xs" variant="light" onClick={() => onCopyMirrorAtoB(a)}>Copy A→B (mirror)</Button>
                <Button size="xs" color="red" variant="light" onClick={() => onDelete(a)}>Delete A</Button>
              </>
            )}
            {o.type === 'UNMAPPED_B' && (
              <Button size="xs" color="red" variant="light" onClick={() => onDelete(b)}>Delete B</Button>
            )}
            {o.type === 'MAPPED_B_MISSING' && (
              <>
                <Button size="xs" variant="light" onClick={() => onCopyToMapped(a, b, 'A')}>Copy A→B (mapped)</Button>
                {typeof o.mappingId === 'number' && (
                  <Button size="xs" color="orange" variant="light" onClick={() => onUnmap(o.mappingId!)}>Unmap</Button>
                )}
              </>
            )}
            {o.type === 'MAPPED_A_MISSING' && (
              <>
                <Button size="xs" variant="light" onClick={() => onCopyToMapped(a, b, 'B')}>Copy B→A (mapped)</Button>
                {typeof o.mappingId === 'number' && (
                  <Button size="xs" color="orange" variant="light" onClick={() => onUnmap(o.mappingId!)}>Unmap</Button>
                )}
              </>
            )}
          </Group>
        </td>
      </tr>
    );
  });

  // Bulk helpers
  const selectedItems = rows.filter((o, idx) => selectedKeys.has(`${o.type}|${o.mappingId ?? idx}|${o.sourceAPath ?? ''}|${o.sourceBPath ?? ''}`));
  const anySelected = selectedItems.length > 0;
  const aPathsSelected = selectedItems.map(s => s.sourceAPath).filter((p): p is string => !!p);
  const bPathsSelected = selectedItems.map(s => s.sourceBPath).filter((p): p is string => !!p);
  const idsSelected    = selectedItems.map(s => s.mappingId).filter((id): id is number => typeof id === 'number');
  const canBulkDeleteA = aPathsSelected.length > 0;
  const canBulkDeleteB = bPathsSelected.length > 0;
  const canBulkUnmap   = idsSelected.length > 0;
  const canBulkCopyMirrorAtoB = selectedItems.some(s => s.type === 'UNMAPPED_A');
  const canBulkCopyAtoBMapped = selectedItems.some(s => s.type === 'MAPPED_B_MISSING');
  const canBulkCopyBtoAMapped = selectedItems.some(s => s.type === 'MAPPED_A_MISSING');

  const selectAllChecked = rows.length > 0 && selectedItems.length === rows.length;
  const onToggleSelectAll = () => {
    setSelectedKeys((prev) => {
      if (selectAllChecked) return new Set();
      const next = new Set<string>();
      rows.forEach((o, idx) => next.add(`${o.type}|${o.mappingId ?? idx}|${o.sourceAPath ?? ''}|${o.sourceBPath ?? ''}`));
      return next;
    });
  };

  const bulkDeleteA = async () => {
    if (!canBulkDeleteA) return;
    setLoading(true); setError(null);
    try {
      const res = await window.electronAPI.orphansDelete(aPathsSelected);
      if (!res.success) throw new Error(res.error?.message ?? 'bulk delete A failed');
      await scan();
    } catch (e: any) { setError(e?.message ?? String(e)); setLoading(false); }
  };
  const bulkDeleteB = async () => {
    if (!canBulkDeleteB) return;
    setLoading(true); setError(null);
    try {
      const res = await window.electronAPI.orphansDelete(bPathsSelected);
      if (!res.success) throw new Error(res.error?.message ?? 'bulk delete B failed');
      await scan();
    } catch (e: any) { setError(e?.message ?? String(e)); setLoading(false); }
  };
  const bulkUnmap = async () => {
    if (!canBulkUnmap) return;
    setLoading(true); setError(null);
    try {
      const res = await window.electronAPI.orphansUnmap(idsSelected);
      if (!res.success) throw new Error(res.error?.message ?? 'bulk unmap failed');
      await scan();
    } catch (e: any) { setError(e?.message ?? String(e)); setLoading(false); }
  };
  const bulkCopyMirrorAtoB = async () => {
    if (!canBulkCopyMirrorAtoB) return;
    if (!cfg.sourceAPath || !cfg.sourceBPath) { setError('Configure Source A/B first'); return; }
    const specs: { from: 'A'|'B'; aPath: string; bPath: string }[] = [];
    for (const s of selectedItems) {
      if (s.type !== 'UNMAPPED_A' || !s.sourceAPath) continue;
      const dest = mirrorPath(s.sourceAPath, cfg.sourceAPath, cfg.sourceBPath);
      specs.push({ from: 'A', aPath: s.sourceAPath, bPath: dest });
    }
    if (specs.length === 0) return;
    await onCopy(specs);
  };
  const bulkCopyAtoBMapped = async () => {
    if (!canBulkCopyAtoBMapped) return;
    const specs: { from: 'A'|'B'; aPath: string; bPath: string }[] = [];
    for (const s of selectedItems) {
      if (s.type !== 'MAPPED_B_MISSING' || !s.sourceAPath || !s.sourceBPath) continue;
      specs.push({ from: 'A', aPath: s.sourceAPath, bPath: s.sourceBPath });
    }
    if (specs.length === 0) return;
    await onCopy(specs);
  };
  const bulkCopyBtoAMapped = async () => {
    if (!canBulkCopyBtoAMapped) return;
    const specs: { from: 'A'|'B'; aPath: string; bPath: string }[] = [];
    for (const s of selectedItems) {
      if (s.type !== 'MAPPED_A_MISSING' || !s.sourceAPath || !s.sourceBPath) continue;
      specs.push({ from: 'B', aPath: s.sourceAPath, bPath: s.sourceBPath });
    }
    if (specs.length === 0) return;
    await onCopy(specs);
  };

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Group>
          <Button onClick={scan} disabled={loading} leftSection={loading ? <Loader size="xs"/> : undefined}>Scan</Button>
          <Switch
            checked={includeNonDj}
            onChange={(e) => setIncludeNonDj(e.currentTarget.checked)}
            label="Show all (include non DJ)"
          />
          <Switch
            checked={onlyMappedAMissing}
            onChange={(e) => setOnlyMappedAMissing(e.currentTarget.checked)}
            label="Only MAPPED_A_MISSING"
          />
        </Group>
        <Group>
          <Checkbox
            checked={selectAllChecked}
            onChange={onToggleSelectAll}
            label="Select all"
          />
        </Group>
      </Group>

      {error && <Alert color="red">{error}</Alert>}

      <ScrollArea h={440}>
        <Table stickyHeader stickyHeaderOffset={0} highlightOnHover>
          <thead>
            <tr>
              <th>Select</th>
              <th>Type</th>
              <th>Paths</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rowsView}
          </tbody>
        </Table>
      </ScrollArea>

      {/* Bulk actions */}
      <Group>
        <Button size="xs" color="red" variant="light" disabled={!canBulkDeleteA} onClick={bulkDeleteA}>
          Bulk Delete A
        </Button>
        <Button size="xs" color="red" variant="light" disabled={!canBulkDeleteB} onClick={bulkDeleteB}>
          Bulk Delete B
        </Button>
        <Button size="xs" color="orange" variant="light" disabled={!canBulkUnmap} onClick={bulkUnmap}>
          Bulk Unmap
        </Button>
        <Button size="xs" variant="light" disabled={!canBulkCopyMirrorAtoB} onClick={bulkCopyMirrorAtoB}>
          Bulk Copy A→B (mirror)
        </Button>
        <Button size="xs" variant="light" disabled={!canBulkCopyAtoBMapped} onClick={bulkCopyAtoBMapped}>
          Bulk Copy A→B (mapped)
        </Button>
        <Button size="xs" variant="light" disabled={!canBulkCopyBtoAMapped} onClick={bulkCopyBtoAMapped}>
          Bulk Copy B→A (mapped)
        </Button>
      </Group>
    </Stack>
  );
}
