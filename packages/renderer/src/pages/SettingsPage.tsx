import React, { useEffect } from 'react';
import {
  Container,
  Title,
  Stack,
  Alert,
  LoadingOverlay,
  TextInput,
  Button,
  Select,
  Anchor,
  SegmentedControl,
  TagsInput,
  Box,
} from '@mantine/core';
import { useConfigStore } from '../store/config.store';

export function SettingsPage() {
  // ─── State ───────────────────────────────
  const isLoading         = useConfigStore((s) => s.isLoading);
  const error             = useConfigStore((s) => s.error);
  const sourceAPath       = useConfigStore((s) => s.sourceAPath);
  const sourceBPath       = useConfigStore((s) => s.sourceBPath);
  const backupPath        = useConfigStore((s) => s.backupPath);
  const logFilePath       = useConfigStore((s) => s.logFilePath);
  const logLevel          = useConfigStore((s) => s.logLevel);
  const bidirectionalTags = useConfigStore((s) => s.bidirectionalTags);
  const tagsToSync        = useConfigStore((s) => s.tagsToSync);

  // ─── Actions ─────────────────────────────
  const loadConfig            = useConfigStore((s) => s.loadConfig);
  const setSourceAPath        = useConfigStore((s) => s.setSourceAPath);
  const setSourceBPath        = useConfigStore((s) => s.setSourceBPath);
  const setBackupPath         = useConfigStore((s) => s.setBackupPath);
  const setLogFilePath        = useConfigStore((s) => s.setLogFilePath);
  const setLogLevel           = useConfigStore((s) => s.setLogLevel);
  const setTagsToSync         = useConfigStore((s) => s.setTagsToSync);
  const setBidirectionalTags  = useConfigStore((s) => s.setBidirectionalTags);
  const setError              = useConfigStore((s) => s.setError);

  // ─── Load config on mount ─────────────────
  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  // ─── Dialog helper ─────────────────────────
  const browseDir =
    (setter: (p: string | null) => Promise<void>) =>
    async () => {
      setError(null);
      try {
        // returns string | null
        const dir = await window.electronAPI.selectDirectory();
        if (dir !== null) {
          await setter(dir);
        }
      } catch (e: any) {
        setError(e.message ?? 'Unknown error opening dialog');
      }
    };

  const handleBrowseSourceA    = browseDir(setSourceAPath);
  const handleBrowseSourceB    = browseDir(setSourceBPath);
  const handleBrowseBackupPath = browseDir(setBackupPath);
  const handleBrowseLogPath    = browseDir(setLogFilePath);

  // ─── Sync‐Mode ───────────────────────────
  const syncMode = tagsToSync === 'ALL' ? 'ALL' : 'SPECIFIC';

  return (
    <Container size="md" py="lg">
      <LoadingOverlay visible={isLoading} overlayProps={{ radius: 'sm', blur: 2 }} />
      <Stack gap="xl">
        <Title order={2}>Application Settings</Title>

        {error && (
          <Alert color="red" withCloseButton onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <TextInput
          label="Source A Path"
          placeholder="Select folder for Source A"
          readOnly
          value={sourceAPath ?? ''}
          rightSection={<Button size="xs" onClick={handleBrowseSourceA}>Browse…</Button>}
          rightSectionWidth={85}
        />

        <TextInput
          label="Source B Path"
          placeholder="Select folder for Source B"
          readOnly
          value={sourceBPath ?? ''}
          rightSection={<Button size="xs" onClick={handleBrowseSourceB}>Browse…</Button>}
          rightSectionWidth={85}
        />

        <TextInput
          label="Backup Path"
          placeholder="Select backup folder"
          readOnly
          value={backupPath ?? ''}
          rightSection={<Button size="xs" onClick={handleBrowseBackupPath}>Browse…</Button>}
          rightSectionWidth={85}
        />

        <TextInput
          label="Log File Path"
          placeholder="Select log file location"
          readOnly
          value={logFilePath ?? ''}
          rightSection={<Button size="xs" onClick={handleBrowseLogPath}>Browse…</Button>}
          rightSectionWidth={85}
        />

        <Select
          label="File Log Level"
          value={logLevel}
          onChange={(v) => v && setLogLevel(v)}
          data={['error', 'warn', 'info', 'debug', 'silly']}
          allowDeselect={false}
        />

        <Box>
          <SegmentedControl
            fullWidth
            value={syncMode}
            onChange={(v) => (v === 'ALL' ? setTagsToSync('ALL') : setTagsToSync([]))}
            data={[
              { label: 'Synchronize ALL Tags', value: 'ALL' },
              { label: 'Synchronize Specific Tags', value: 'SPECIFIC' },
            ]}
          />
          {syncMode === 'SPECIFIC' && (
            <TagsInput
              value={Array.isArray(tagsToSync) ? tagsToSync : []}
              onChange={setTagsToSync}
              placeholder="Enter ID3 frame IDs"
              clearable
            />
          )}
        </Box>

        <TagsInput
          label="Bidirectional Tags"
          placeholder="e.g. TKEY, TBP, TXXX:EnergyLevel"
          value={bidirectionalTags}
          onChange={setBidirectionalTags}
          clearable
        />

        <Box mt="lg">
          <Anchor component="button" size="sm" onClick={() => window.electronAPI.showConfigFileInFolder()}>
            Show configuration file in Explorer
          </Anchor>
        </Box>
      </Stack>
    </Container>
  );
}
