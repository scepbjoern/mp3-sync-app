// packages/renderer/src/pages/SyncPage.tsx
import { Table, ScrollArea, Text } from '@mantine/core';
import { useSyncStore } from '../store/sync.store';

export function SyncPage() {
  const { syncReport } = useSyncStore();

  return (
    <ScrollArea h={400}>
      <Table highlightOnHover>
        <thead>
          <tr>
            <th>File</th>
            <th>Tag</th>
            <th>Change</th>
            <th>Conflict?</th>
          </tr>
        </thead>
        <tbody>
          {syncReport.flatMap((entry) =>
            entry.pendingUpdates.map((chg) => {
              const isConflict = entry.conflicts?.some(c => c.tag === chg.tag) ?? false;
              return (
                <tr key={`${entry.filePath}-${chg.tag}`}>
                  <td>
                    <Text size="xs" title={entry.filePath}>
                      {entry.filePath.split(/[\\/]/).pop()}
                    </Text>
                  </td>
                  <td>{chg.tag}</td>
                  <td>
                    {String(chg.from)} → {String(chg.to)}
                  </td>
                  <td>
                    {isConflict
                      ? <Text color="orange">Conflict</Text>
                      : null}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </Table>
    </ScrollArea>
  );
}
