// packages/renderer/src/pages/SettingsPage.tsx
import React, { useEffect } from 'react';
import {
  Container,
  Title,
  Stack,
  Alert,
  LoadingOverlay,
  TextInput,
  Button,
  Text,
  Select,
  Anchor,
  SegmentedControl, 
  TagsInput,        
  Box               
} from '@mantine/core';
import { useConfigStore } from '../store/config.store';

export function SettingsPage() {
  // --- Select state and actions individually ---
  const isLoading = useConfigStore((state) => state.isLoading);
  const error = useConfigStore((state) => state.error);
  const sourceAPath = useConfigStore((state) => state.sourceAPath);
  const sourceBPath = useConfigStore((state) => state.sourceBPath);
  const backupPath = useConfigStore((state) => state.backupPath);
  const logFilePath = useConfigStore((state) => state.logFilePath);
  const logLevel = useConfigStore((state) => state.logLevel);
  const bidirectionalTags = useConfigStore((state) => state.bidirectionalTags);
  const tagsToSync = useConfigStore((state) => state.tagsToSync);

  // Actions
  const loadConfig = useConfigStore((state) => state.loadConfig);
  const setSourceAPath = useConfigStore((state) => state.setSourceAPath);
  const setSourceBPath = useConfigStore((state) => state.setSourceBPath);
  const setBackupPath = useConfigStore((state) => state.setBackupPath);
  const setLogFilePath = useConfigStore((state) => state.setLogFilePath);
  const setLogLevel = useConfigStore((state) => state.setLogLevel);
  const setTagsToSync = useConfigStore((state) => state.setTagsToSync); // <-- Added
  const setBidirectionalTags = useConfigStore((state) => state.setBidirectionalTags); // <-- Added
  const setError = useConfigStore((state) => state.setError);
  // --- End Selectors ---

  // Load config ONLY once when the component mounts
  useEffect(() => {
    console.log('SettingsPage mounted, calling loadConfig...');
    loadConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // <-- Use EMPTY dependency array to run only ONCE

  // --- Handler Functions ---
  const createBrowseHandler = (setterAction: (path: string | null) => Promise<void>, context: string) => async () => {
      console.log(`Browse for ${context}...`);
      setError(null);
      try {
          const response = await window.electronAPI.selectDirectory();
          if (response.success && response.data) {
              console.log(`${context} selected:`, response.data);
              await setterAction(response.data);
          } else if (!response.success) {
              console.error(`Error selecting directory for ${context}:`, response.error?.message);
              setError(response.error?.message || `Failed to open directory dialog for ${context}`);
          } else {
              console.log(`${context} selection cancelled.`);
          }
      } catch (e) {
          const message = e instanceof Error ? e.message : `Unknown error selecting directory for ${context}`;
          console.error(`Error during selectDirectory IPC call for ${context}:`, e);
          setError(message);
      }
  };

  const handleBrowseSourceA = createBrowseHandler(setSourceAPath, 'Source A');
  const handleBrowseSourceB = createBrowseHandler(setSourceBPath, 'Source B');
  const handleBrowseBackupPath = createBrowseHandler(setBackupPath, 'Backup Path');
  const handleBrowseLogPath = createBrowseHandler(setLogFilePath, 'Log File Path');

  const handleLogLevelChange = (value: string | null) => {
      if (value) {
          setError(null);
          setLogLevel(value);
      }
  };

  // Handler for TagsToSync mode change
  const handleSyncModeChange = (value: string) => { // Value is "ALL" or "SPECIFIC"
    setError(null);
    if (value === 'ALL') {
      setTagsToSync('ALL');
    } else {
      // When switching to SPECIFIC, initialize with empty array if current state is "ALL"
      if (tagsToSync === 'ALL') {
        setTagsToSync([]);
      } else {
        // If already an array, just change the mode variable (no state change needed here)
        // The component state 'syncMode' handles showing the input
      }
    }
  };

  // Handler for SPECIFIC tags to sync changes (from TagsInput)
  const handleSpecificTagsChange = (value: string[]) => {
     setError(null);
     setTagsToSync(value); // Update store and save via IPC action
  };

  // Handler for bidirectional tags changes (from TagsInput)
  const handleBidirectionalTagsChange = (value: string[]) => {
     setError(null);
     setBidirectionalTags(value); // Update store and save via IPC action
  }

  // Determine current sync mode for SegmentedControl
  const syncMode = typeof tagsToSync === 'string' && tagsToSync === 'ALL' ? 'ALL' : 'SPECIFIC';
  // Get current specific tags list (handle case where it's "ALL")
  const specificTagsValue = Array.isArray(tagsToSync) ? tagsToSync : [];

  // --- Handler for showing config file ---
  const handleShowConfigFile = async () => {
    console.log('Requesting to show config file in folder...');
    setError(null); // Clear errors
    try {
        const response = await window.electronAPI.showConfigFileInFolder();
        if (!response.success) {
            throw new Error(response.error?.message || 'Failed to show config file');
        }
        console.log('Show config file request sent successfully.');
    } catch (e) {
        const message = e instanceof Error ? e.message : 'Unknown error showing config file';
        console.error('Error showing config file:', e);
        setError(message); // Show error in UI
    }
}

  // --- End Handlers ---


  return (
    <Container size="md" py="lg">
      <LoadingOverlay visible={isLoading} overlayProps={{ radius: 'sm', blur: 2 }} />
      <Stack gap="xl"> {/* Increased gap slightly */}
        <Title order={2}>Application Settings</Title>

        {error && (
          <Alert title="Error" color="red" withCloseButton onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* --- Path Settings --- */}
        <TextInput
          label="Source A Path (Main Music Collection)"
          placeholder="Select the root folder for Source A"
          value={sourceAPath ?? ''}
          readOnly
          rightSection={ <Button size="xs" onClick={handleBrowseSourceA}>Browse...</Button> }
          rightSectionWidth={85}
        />
        <TextInput
          label="Source B Path (Target/Secondary Collection)"
          placeholder="Select the root folder for Source B"
          value={sourceBPath ?? ''}
          readOnly
          rightSection={ <Button size="xs" onClick={handleBrowseSourceB}>Browse...</Button> }
          rightSectionWidth={85}
        />
        <TextInput
          label="Backup Path (Before Tag Writes)"
          placeholder="Select folder for temporary backups"
          value={backupPath ?? ''}
          readOnly
          rightSection={ <Button size="xs" onClick={handleBrowseBackupPath}>Browse...</Button> }
          rightSectionWidth={85}
          description="Leave blank to use default location within app data."
        />
        <TextInput
          label="Log File Path"
          placeholder="Select location for the log file"
          value={logFilePath ?? ''}
          readOnly
          rightSection={ <Button size="xs" onClick={handleBrowseLogPath}>Browse...</Button> }
          rightSectionWidth={85}
          description="Leave blank to use default location within app data."
        />

        {/* --- Log Level Setting --- */}
        <Select
            label="File Log Level"
            placeholder="Select minimum level to log to file"
            value={logLevel}
            onChange={handleLogLevelChange}
            data={['error', 'warn', 'info', 'debug', 'silly']}
            allowDeselect={false}
        />

        {/* --- Tags to Synchronize --- */}
        <Box> {/* Use Box for grouping */}
            <Text size="sm" fw={500} mb="xs">Tags to Synchronize</Text>
            <SegmentedControl
              value={syncMode}
              onChange={handleSyncModeChange}
              data={[
                { label: 'Synchronize ALL Tags', value: 'ALL' },
                { label: 'Synchronize Only Specific Tags', value: 'SPECIFIC' },
              ]}
              fullWidth
              mb="sm" // Margin bottom if specific tags shown
            />
            {syncMode === 'SPECIFIC' && (
              <TagsInput
                // label="Specific Tags to Synchronize" // Label provided by Text above
                placeholder="Enter ID3 Frame IDs (e.g., TPE1, TIT2) and press Enter"
                description="Only these tags will be considered for A->B or bidirectional sync."
                value={specificTagsValue}
                onChange={handleSpecificTagsChange}
                clearable
              />
            )}
        </Box>

        {/* --- Bidirectional Tags --- */}
         <TagsInput
             label="Bidirectional Tags"
             placeholder="Enter ID3 Frame IDs (e.g., TKEY, TBP, TXXX:EnergyLevel)"
             description="These specific tags allow changes in Source B to sync back to Source A. Use TXXX:Description for custom tags."
             value={bidirectionalTags}
             onChange={handleBidirectionalTagsChange}
             clearable
          />

        {/* --- Link to show config file --- */}
        <Box mt="lg"> {/* Add some margin top */}
          <Anchor component="button" type="button" onClick={handleShowConfigFile} size="sm">
            Show configuration file location in Explorer
          </Anchor>
        </Box>
        {/* --- End Link --- */}

      </Stack>
    </Container>
  );
}

// Optional: Export if needed, e.g., for routing
// export default SettingsPage;