/**
 * MonitorView
 *
 * Bean list grouped by status, queue information.
 * This is a placeholder - full implementation in separate bean.
 */
import React from 'react';
import { Box, Text } from 'ink';

export function MonitorView() {
  return (
    <Box flexDirection="column" padding={1}>
      <Text bold>Monitor</Text>
      <Text dimColor>Bean list and queue status</Text>
      <Box marginTop={1}>
        <Text color="gray">Monitoring beans...</Text>
      </Box>
    </Box>
  );
}

export default MonitorView;
