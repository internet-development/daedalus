/**
 * Daedalus Main App Component
 *
 * This is the root Ink component for the Talos daemon UI.
 * It manages the overall application state and renders the main interface.
 */
import React, { useState, useEffect } from 'react';
import { Box, Text, useApp, useInput } from 'ink';

export interface AppProps {
  initialView?: 'dashboard' | 'beans' | 'output';
}

export function App({ initialView = 'dashboard' }: AppProps) {
  const { exit } = useApp();
  const [view, setView] = useState(initialView);

  useInput((input, key) => {
    // Global keybindings
    if (input === 'q' || (key.ctrl && input === 'c')) {
      exit();
    }

    // View switching
    if (input === '1') setView('dashboard');
    if (input === '2') setView('beans');
    if (input === '3') setView('output');
  });

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">
          Daedalus
        </Text>
        <Text color="gray"> v2.0.0 </Text>
        <Text dimColor>| Talos Daemon</Text>
      </Box>

      <Box marginBottom={1}>
        <Text dimColor>
          [1] Dashboard [2] Beans [3] Output [q] Quit
        </Text>
      </Box>

      <Box flexDirection="column" borderStyle="single" padding={1}>
        {view === 'dashboard' && <DashboardView />}
        {view === 'beans' && <BeansView />}
        {view === 'output' && <OutputView />}
      </Box>
    </Box>
  );
}

function DashboardView() {
  return (
    <Box flexDirection="column">
      <Text bold>Dashboard</Text>
      <Text dimColor>Talos daemon status and agent overview</Text>
      <Box marginTop={1}>
        <Text color="yellow">No agents running</Text>
      </Box>
    </Box>
  );
}

function BeansView() {
  return (
    <Box flexDirection="column">
      <Text bold>Beans</Text>
      <Text dimColor>Issue tracker integration</Text>
      <Box marginTop={1}>
        <Text color="gray">Run `beans query` to see issues</Text>
      </Box>
    </Box>
  );
}

function OutputView() {
  return (
    <Box flexDirection="column">
      <Text bold>Output</Text>
      <Text dimColor>Agent output logs</Text>
      <Box marginTop={1}>
        <Text color="gray">No output captured yet</Text>
      </Box>
    </Box>
  );
}

export default App;
