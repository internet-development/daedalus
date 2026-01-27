/**
 * ExecuteView
 *
 * Streaming agent output for running beans.
 *
 * Features:
 * - Real-time ANSI output rendering
 * - Auto-scroll to bottom with manual scroll-back
 * - Bean title/ID header with elapsed time
 * - Cancel shortcut (c) to abort
 * - Show last completed bean when nothing running
 * - Output buffering to avoid flicker
 */
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Box, Text, useInput, useStdout } from 'ink';
import { useTalos } from '../TalosContext.js';
import type { OutputEvent } from '../../talos/agent-runner.js';
import type { Bean } from '../../talos/beans-client.js';
import type { RunningBean } from '../../talos/talos.js';

// =============================================================================
// Types
// =============================================================================

interface OutputState {
  beanId: string;
  beanTitle: string;
  lines: string[];
  startedAt: number | null;
  completedAt: number | null;
  isCompleted: boolean;
}

// =============================================================================
// Constants
// =============================================================================

const SCROLL_BUFFER = 5; // Lines to keep visible when scrolling up
const BUFFER_INTERVAL_MS = 50; // Buffer output for smoother rendering

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Format elapsed time in human-readable form
 */
function formatElapsed(startedAt: number, endTime?: number): string {
  const now = endTime ?? Date.now();
  const elapsed = now - startedAt;
  const seconds = Math.floor(elapsed / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

/**
 * Format "completed X ago" time
 */
function formatTimeAgo(timestamp: number): string {
  const now = Date.now();
  const elapsed = now - timestamp;
  const seconds = Math.floor(elapsed / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ago`;
  }
  if (minutes > 0) {
    return `${minutes}m ago`;
  }
  return 'just now';
}

/**
 * Split text into lines, handling CRLF and CR
 */
function splitIntoLines(text: string): string[] {
  return text.split(/\r?\n|\r/);
}

// =============================================================================
// OutputPane Component
// =============================================================================

interface OutputPaneProps {
  lines: string[];
  scrollOffset: number;
  visibleHeight: number;
}

function OutputPane({ lines, scrollOffset, visibleHeight }: OutputPaneProps) {
  // Calculate which lines to show
  const startLine = scrollOffset;
  const endLine = Math.min(startLine + visibleHeight, lines.length);
  const visibleLines = lines.slice(startLine, endLine);

  return (
    <Box flexDirection="column" flexGrow={1} overflow="hidden">
      {visibleLines.map((line, i) => (
        <Text key={startLine + i} wrap="truncate">
          {line || ' '}
        </Text>
      ))}
      {/* Fill remaining space with empty lines */}
      {visibleLines.length < visibleHeight &&
        Array.from({ length: visibleHeight - visibleLines.length }).map((_, i) => (
          <Text key={`empty-${i}`}> </Text>
        ))}
    </Box>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function ExecuteView() {
  const talos = useTalos();
  const { stdout } = useStdout();

  // Output state
  const [outputState, setOutputState] = useState<OutputState | null>(null);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [autoScroll, setAutoScroll] = useState(true);
  const [elapsedTick, setElapsedTick] = useState(0);

  // Output buffer for smoother rendering
  const outputBufferRef = useRef<string[]>([]);
  const bufferTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Calculate dimensions
  const terminalHeight = stdout?.rows ?? 24;
  const terminalWidth = stdout?.columns ?? 80;
  // Header (2 lines) + footer hints (1 line) + some padding
  const visibleHeight = Math.max(terminalHeight - 8, 5);

  // Flush the output buffer
  const flushBuffer = useCallback(() => {
    if (outputBufferRef.current.length === 0) return;

    const newData = outputBufferRef.current.join('');
    outputBufferRef.current = [];

    setOutputState((prev) => {
      if (!prev) return prev;

      // Split new data into lines and merge with existing
      const newLines = splitIntoLines(newData);
      const updatedLines = [...prev.lines];

      // Handle partial line continuation
      if (updatedLines.length > 0 && newLines.length > 0) {
        // Append to last line if it didn't end with newline
        const lastLine = updatedLines[updatedLines.length - 1];
        if (newData.startsWith(newLines[0]) && !newData.startsWith('\n')) {
          updatedLines[updatedLines.length - 1] = lastLine + newLines[0];
          newLines.shift();
        }
      }

      // Add remaining new lines
      updatedLines.push(...newLines);

      return {
        ...prev,
        lines: updatedLines,
      };
    });
  }, []);

  // Buffer output to avoid flicker
  const bufferOutput = useCallback(
    (data: string) => {
      outputBufferRef.current.push(data);

      // Set up timer to flush buffer
      if (!bufferTimerRef.current) {
        bufferTimerRef.current = setTimeout(() => {
          bufferTimerRef.current = null;
          flushBuffer();
        }, BUFFER_INTERVAL_MS);
      }
    },
    [flushBuffer]
  );

  // Initialize state from current Talos state
  useEffect(() => {
    const inProgress = talos.getInProgress();

    if (inProgress.size > 0) {
      // Show currently running bean
      const [, running] = [...inProgress.entries()][0];
      const existingOutput = talos.getOutput(running.bean.id);

      setOutputState({
        beanId: running.bean.id,
        beanTitle: running.bean.title,
        lines: existingOutput ? splitIntoLines(existingOutput) : [],
        startedAt: running.startedAt,
        completedAt: null,
        isCompleted: false,
      });
    } else {
      // Show last completed bean (if any)
      const recentlyCompleted = talos.getRecentlyCompleted();
      if (recentlyCompleted.length > 0) {
        const lastBean = recentlyCompleted[0];
        const output = talos.getOutput(lastBean.id);

        setOutputState({
          beanId: lastBean.id,
          beanTitle: lastBean.title,
          lines: output ? splitIntoLines(output) : ['(No output recorded)'],
          startedAt: null,
          completedAt: new Date(lastBean.updatedAt).getTime(),
          isCompleted: true,
        });
      } else {
        setOutputState(null);
      }
    }
  }, [talos]);

  // Subscribe to Talos events
  useEffect(() => {
    const handleOutput = (event: OutputEvent) => {
      bufferOutput(event.data);
    };

    const handleBeanStarted = (bean: Bean) => {
      // Clear buffer and reset state for new bean
      outputBufferRef.current = [];
      if (bufferTimerRef.current) {
        clearTimeout(bufferTimerRef.current);
        bufferTimerRef.current = null;
      }

      setOutputState({
        beanId: bean.id,
        beanTitle: bean.title,
        lines: [],
        startedAt: Date.now(),
        completedAt: null,
        isCompleted: false,
      });
      setScrollOffset(0);
      setAutoScroll(true);
    };

    const handleBeanCompleted = (bean: Bean) => {
      // Flush any remaining buffer
      flushBuffer();

      setOutputState((prev) => {
        if (!prev || prev.beanId !== bean.id) return prev;
        return {
          ...prev,
          completedAt: Date.now(),
          isCompleted: true,
        };
      });
    };

    const handleBeanBlocked = (bean: Bean) => {
      // Same handling as completed
      flushBuffer();

      setOutputState((prev) => {
        if (!prev || prev.beanId !== bean.id) return prev;
        return {
          ...prev,
          completedAt: Date.now(),
          isCompleted: true,
        };
      });
    };

    const handleBeanFailed = (bean: Bean) => {
      // Same handling as completed
      flushBuffer();

      setOutputState((prev) => {
        if (!prev || prev.beanId !== bean.id) return prev;
        return {
          ...prev,
          completedAt: Date.now(),
          isCompleted: true,
        };
      });
    };

    talos.on('output', handleOutput);
    talos.on('bean-started', handleBeanStarted);
    talos.on('bean-completed', handleBeanCompleted);
    talos.on('bean-blocked', handleBeanBlocked);
    talos.on('bean-failed', handleBeanFailed);

    return () => {
      talos.off('output', handleOutput);
      talos.off('bean-started', handleBeanStarted);
      talos.off('bean-completed', handleBeanCompleted);
      talos.off('bean-blocked', handleBeanBlocked);
      talos.off('bean-failed', handleBeanFailed);

      // Clean up buffer timer
      if (bufferTimerRef.current) {
        clearTimeout(bufferTimerRef.current);
      }
    };
  }, [talos, bufferOutput, flushBuffer]);

  // Timer for elapsed time updates
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedTick((t) => t + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Auto-scroll when new output arrives
  useEffect(() => {
    if (autoScroll && outputState) {
      const maxScroll = Math.max(0, outputState.lines.length - visibleHeight);
      setScrollOffset(maxScroll);
    }
  }, [outputState?.lines.length, autoScroll, visibleHeight]);

  // Keyboard input
  useInput((input, key) => {
    if (!outputState) return;

    const maxScroll = Math.max(0, outputState.lines.length - visibleHeight);

    // Cancel running bean
    if (input === 'c' && !outputState.isCompleted) {
      talos.cancel(outputState.beanId);
      return;
    }

    // Scroll up
    if (key.upArrow || input === 'k') {
      setAutoScroll(false);
      setScrollOffset((s) => Math.max(0, s - 1));
      return;
    }

    // Scroll down
    if (key.downArrow || input === 'j') {
      const newOffset = scrollOffset + 1;
      if (newOffset >= maxScroll) {
        setAutoScroll(true);
      }
      setScrollOffset(Math.min(maxScroll, newOffset));
      return;
    }

    // Jump to top
    if (input === 'g') {
      setAutoScroll(false);
      setScrollOffset(0);
      return;
    }

    // Jump to bottom
    if (input === 'G') {
      setAutoScroll(true);
      setScrollOffset(maxScroll);
      return;
    }

    // Page up
    if (key.pageUp) {
      setAutoScroll(false);
      setScrollOffset((s) => Math.max(0, s - visibleHeight + SCROLL_BUFFER));
      return;
    }

    // Page down
    if (key.pageDown) {
      const newOffset = scrollOffset + visibleHeight - SCROLL_BUFFER;
      if (newOffset >= maxScroll) {
        setAutoScroll(true);
      }
      setScrollOffset(Math.min(maxScroll, newOffset));
      return;
    }
  });

  // Build elapsed/completed time string
  const timeText = useMemo(() => {
    if (!outputState) return '';

    if (outputState.isCompleted && outputState.completedAt) {
      return `Completed ${formatTimeAgo(outputState.completedAt)}`;
    }

    if (outputState.startedAt) {
      return formatElapsed(outputState.startedAt);
    }

    return '';
  }, [outputState, elapsedTick]);

  // Scroll position indicator
  const scrollIndicator = useMemo(() => {
    if (!outputState || outputState.lines.length <= visibleHeight) {
      return '';
    }

    const maxScroll = Math.max(0, outputState.lines.length - visibleHeight);
    if (maxScroll === 0) return '';

    const percentage = Math.round((scrollOffset / maxScroll) * 100);
    return autoScroll ? '(auto)' : `(${percentage}%)`;
  }, [outputState, scrollOffset, visibleHeight, autoScroll]);

  // Empty state
  if (!outputState) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold>Execute</Text>
        <Text dimColor>Agent output stream</Text>
        <Box marginTop={1}>
          <Text color="gray">No agent running and no recent output</Text>
        </Box>
      </Box>
    );
  }

  // Get running state for UI hints
  const isRunning = !outputState.isCompleted;

  return (
    <Box flexDirection="column" paddingX={1} flexGrow={1}>
      {/* Header: Bean ID and title */}
      <Box marginBottom={0}>
        <Text color="cyan" bold>
          {outputState.beanId.replace('beans-', '')}
        </Text>
        <Text bold>: {outputState.beanTitle}</Text>

        {/* Status indicator */}
        <Box flexGrow={1} />
        {outputState.isCompleted ? (
          <Text color="green">Completed</Text>
        ) : (
          <Text color="green">Running</Text>
        )}

        {/* Time */}
        {timeText && (
          <Text color="gray"> {timeText}</Text>
        )}
      </Box>

      {/* Separator line */}
      <Text color="gray">{'─'.repeat(Math.min(terminalWidth - 4, 80))}</Text>

      {/* Output pane */}
      <OutputPane
        lines={outputState.lines}
        scrollOffset={scrollOffset}
        visibleHeight={visibleHeight}
      />

      {/* Footer hints */}
      <Box
        borderStyle="single"
        borderLeft={false}
        borderRight={false}
        borderBottom={false}
        paddingTop={0}
      >
        <Text color="gray">
          <Text color="cyan">[j/k]</Text> scroll{' '}
          <Text color="cyan">[g/G]</Text> top/bottom{' '}
          {scrollIndicator && <Text color="gray">{scrollIndicator} </Text>}
          {isRunning && (
            <>
              <Text color="cyan">[c]</Text> cancel{' '}
            </>
          )}
          <Text color="cyan">[Esc]</Text> back
        </Text>
      </Box>
    </Box>
  );
}

export default ExecuteView;
