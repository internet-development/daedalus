/**
 * Daedalus Main Entry Point
 *
 * Initializes Talos daemon and renders the Ink TUI application.
 * Exports the main App component wrapped with TalosProvider.
 */
import React, { useState, useEffect } from 'react';
import { Box, Text, render } from 'ink';
import { Talos } from './talos/talos.js';
import { App, TalosProvider, type ViewType } from './ui/index.js';

export interface DaedalusAppProps {
  initialView?: ViewType;
}

/**
 * Loading screen shown while Talos initializes
 */
function LoadingScreen() {
  const [dots, setDots] = useState('');

  useEffect(() => {
    const interval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? '' : prev + '.'));
    }, 300);
    return () => clearInterval(interval);
  }, []);

  return (
    <Box flexDirection="column" padding={2}>
      <Text bold color="cyan">
        DAEDALUS
      </Text>
      <Box marginTop={1}>
        <Text color="gray">Initializing Talos{dots}</Text>
      </Box>
    </Box>
  );
}

/**
 * Error screen shown when Talos fails to initialize
 */
function ErrorScreen({ error }: { error: Error }) {
  return (
    <Box flexDirection="column" padding={2}>
      <Text bold color="red">
        Failed to initialize Talos
      </Text>
      <Box marginTop={1}>
        <Text color="gray">{error.message}</Text>
      </Box>
    </Box>
  );
}

/**
 * Root component that handles Talos initialization
 */
export function DaedalusApp({ initialView }: DaedalusAppProps) {
  const [state, setState] = useState<
    | { status: 'loading' }
    | { status: 'ready'; talos: Talos }
    | { status: 'error'; error: Error }
  >({ status: 'loading' });

  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        const talos = new Talos();
        await talos.start();

        if (mounted) {
          setState({ status: 'ready', talos });
        }
      } catch (err) {
        if (mounted) {
          setState({
            status: 'error',
            error: err instanceof Error ? err : new Error(String(err)),
          });
        }
      }
    }

    init();

    return () => {
      mounted = false;
    };
  }, []);

  if (state.status === 'loading') {
    return <LoadingScreen />;
  }

  if (state.status === 'error') {
    return <ErrorScreen error={state.error} />;
  }

  return (
    <TalosProvider talos={state.talos}>
      <App initialView={initialView} />
    </TalosProvider>
  );
}

// Re-export components for external use
export { App } from './ui/index.js';
export type { ViewType } from './ui/index.js';

export default DaedalusApp;
