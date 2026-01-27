/**
 * App Component
 *
 * Main Ink application shell with view routing, keyboard shortcuts, and layout.
 * Uses Talos events for real-time updates.
 *
 * Layout:
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │  DAEDALUS                        [Monitor] [Execute] [Plan]    ⚡ N  │
 * ├─────────────────────────────────────────────────────────────────────┤
 * │                                                                     │
 * │  {Current View Content}                                             │
 * │                                                                     │
 * ├─────────────────────────────────────────────────────────────────────┤
 * │  [q]uit  [1-3] switch view  {context-specific shortcuts}            │
 * └─────────────────────────────────────────────────────────────────────┘
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Box, Text, useApp, useInput, useStdout } from 'ink';
import { Header, type ViewType } from './Header.js';
import { StatusBar } from './StatusBar.js';
import { useTalos } from './TalosContext.js';
import { MonitorView, ExecuteView, PlanView } from './views/index.js';

export interface AppProps {
  initialView?: ViewType;
}

export function App({ initialView }: AppProps) {
  const { exit } = useApp();
  const talos = useTalos();
  const { stdout } = useStdout();

  // Determine smart default view: Execute if agent running, else Monitor
  const getDefaultView = useCallback((): ViewType => {
    const inProgress = talos.getInProgress();
    return inProgress.size > 0 ? 'execute' : 'monitor';
  }, [talos]);

  const [view, setView] = useState<ViewType>(initialView ?? getDefaultView());
  const [queueCount, setQueueCount] = useState(talos.getQueue().length);
  const [runningCount, setRunningCount] = useState(talos.getInProgress().size);
  const [stuckCount, setStuckCount] = useState(talos.getStuck().length);
  const [isPaused, setIsPaused] = useState(talos.isPaused());
  const [showHelp, setShowHelp] = useState(false);

  // Subscribe to Talos events
  useEffect(() => {
    const handleQueueChanged = () => {
      setQueueCount(talos.getQueue().length);
      setRunningCount(talos.getInProgress().size);
      setStuckCount(talos.getStuck().length);
    };

    const handleBeanStarted = () => {
      // Auto-switch to Execute view when an agent starts
      setView('execute');
      setRunningCount(talos.getInProgress().size);
    };

    const handleBeanCompleted = () => {
      setRunningCount(talos.getInProgress().size);
      setStuckCount(talos.getStuck().length);
    };

    const handleBeanBlocked = () => {
      setRunningCount(talos.getInProgress().size);
      setStuckCount(talos.getStuck().length);
    };

    const handleBeanFailed = () => {
      setRunningCount(talos.getInProgress().size);
      setStuckCount(talos.getStuck().length);
    };

    talos.on('queue-changed', handleQueueChanged);
    talos.on('bean-started', handleBeanStarted);
    talos.on('bean-completed', handleBeanCompleted);
    talos.on('bean-blocked', handleBeanBlocked);
    talos.on('bean-failed', handleBeanFailed);

    return () => {
      talos.off('queue-changed', handleQueueChanged);
      talos.off('bean-started', handleBeanStarted);
      talos.off('bean-completed', handleBeanCompleted);
      talos.off('bean-blocked', handleBeanBlocked);
      talos.off('bean-failed', handleBeanFailed);
    };
  }, [talos]);

  // Handle keyboard input
  useInput((input, key) => {
    // Help toggle
    if (input === '?') {
      setShowHelp((prev) => !prev);
      return;
    }

    // Close help with any key
    if (showHelp) {
      setShowHelp(false);
      return;
    }

    // Quit
    if (input === 'q' || (key.ctrl && input === 'c')) {
      handleQuit();
      return;
    }

    // View switching
    if (input === '1') setView('monitor');
    if (input === '2') setView('execute');
    if (input === '3') setView('plan');

    // Pause/resume
    if (input === 'p') {
      if (talos.isPaused()) {
        talos.resume();
        setIsPaused(false);
      } else {
        talos.pause();
        setIsPaused(true);
      }
    }
  });

  // Graceful shutdown
  const handleQuit = useCallback(async () => {
    await talos.stop();
    exit();
  }, [talos, exit]);

  // Get terminal height for full-height layout
  const terminalHeight = stdout?.rows ?? 24;
  // Header (3) + StatusBar (2) + borders
  const contentHeight = Math.max(terminalHeight - 5, 10);

  // Render help overlay
  if (showHelp) {
    return (
      <Box flexDirection="column" height={terminalHeight}>
        <Header currentView={view} queueCount={queueCount} runningCount={runningCount} stuckCount={stuckCount} isPaused={isPaused} />
        <Box
          flexDirection="column"
          borderStyle="single"
          borderTop={false}
          borderBottom={false}
          height={contentHeight}
          padding={1}
        >
          <Text bold color="cyan">
            Keyboard Shortcuts
          </Text>
          <Box marginTop={1} flexDirection="column">
            <Text>
              <Text color="cyan">[q]</Text> Quit application
            </Text>
            <Text>
              <Text color="cyan">[1]</Text> Monitor view
            </Text>
            <Text>
              <Text color="cyan">[2]</Text> Execute view
            </Text>
            <Text>
              <Text color="cyan">[3]</Text> Plan view
            </Text>
            <Text>
              <Text color="cyan">[p]</Text> Pause/resume execution
            </Text>
            <Text>
              <Text color="cyan">[?]</Text> Toggle this help
            </Text>
          </Box>
          <Box marginTop={2}>
            <Text dimColor>Press any key to close</Text>
          </Box>
        </Box>
        <StatusBar currentView={view} isPaused={isPaused} />
      </Box>
    );
  }

  return (
    <Box flexDirection="column" height={terminalHeight}>
      <Header currentView={view} queueCount={queueCount} runningCount={runningCount} stuckCount={stuckCount} isPaused={isPaused} />

      {/* Main content area */}
      <Box
        flexDirection="column"
        flexGrow={1}
        borderStyle="single"
        borderTop={false}
        borderBottom={false}
        height={contentHeight}
      >
        {view === 'monitor' && <MonitorView />}
        {view === 'execute' && <ExecuteView />}
        {view === 'plan' && <PlanView />}
      </Box>

      <StatusBar currentView={view} isPaused={isPaused} />
    </Box>
  );
}

export default App;
