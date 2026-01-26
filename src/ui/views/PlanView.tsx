/**
 * PlanView
 *
 * Chat interface for creating/refining beans with AI.
 * This is a placeholder - full implementation in separate bean.
 */
import React from 'react';
import { Box, Text } from 'ink';

export function PlanView() {
  return (
    <Box flexDirection="column" padding={1}>
      <Text bold>Plan</Text>
      <Text dimColor>Chat interface for planning</Text>
      <Box marginTop={1}>
        <Text color="gray">Type to start planning...</Text>
      </Box>
    </Box>
  );
}

export default PlanView;
