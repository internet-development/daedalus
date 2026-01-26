/**
 * ExecuteView
 *
 * Streaming agent output for running beans.
 * This is a placeholder - full implementation in separate bean.
 */
import React from 'react';
import { Box, Text } from 'ink';

export function ExecuteView() {
  return (
    <Box flexDirection="column" padding={1}>
      <Text bold>Execute</Text>
      <Text dimColor>Agent output stream</Text>
      <Box marginTop={1}>
        <Text color="gray">No agent running</Text>
      </Box>
    </Box>
  );
}

export default ExecuteView;
