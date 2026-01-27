/**
 * Header Component
 *
 * Top bar showing app title, view tabs, and queue status indicator.
 *
 * Layout:
 * │  DAEDALUS                        [Monitor] [Execute] [Plan]    ⚡ N  │
 */
import React from 'react';
import { Box, Text } from 'ink';

export type ViewType = 'monitor' | 'execute' | 'plan';

export interface HeaderProps {
  currentView: ViewType;
  queueCount: number;
  runningCount: number;
  stuckCount: number;
  isPaused: boolean;
}

interface TabProps {
  label: string;
  hotkey: string;
  isActive: boolean;
}

function Tab({ label, hotkey, isActive }: TabProps) {
  return (
    <Box marginLeft={1}>
      <Text color={isActive ? 'cyan' : 'gray'} bold={isActive}>
        [{hotkey}]
      </Text>
      <Text color={isActive ? 'cyan' : 'gray'} bold={isActive}>
        {' '}
        {label}
      </Text>
    </Box>
  );
}

export function Header({ currentView, queueCount, runningCount, stuckCount, isPaused }: HeaderProps) {
  return (
    <Box
      borderStyle="single"
      borderBottom={false}
      paddingX={1}
      justifyContent="space-between"
    >
      {/* Left: App Title + Status Summary */}
      <Box>
        <Text bold color="cyan">
          DAEDALUS
        </Text>
        {isPaused && (
          <Text color="yellow" bold>
            {' '}
            [PAUSED]
          </Text>
        )}
        <Text color="gray"> | </Text>
        <Text color="gray">{queueCount} todo</Text>
        <Text color="gray"> · </Text>
        <Text color={runningCount > 0 ? 'green' : 'gray'}>{runningCount} running</Text>
        <Text color="gray"> · </Text>
        <Text color={stuckCount > 0 ? 'yellow' : 'gray'}>{stuckCount} stuck</Text>
      </Box>

      {/* Center: View Tabs */}
      <Box>
        <Tab label="Monitor" hotkey="1" isActive={currentView === 'monitor'} />
        <Tab label="Execute" hotkey="2" isActive={currentView === 'execute'} />
        <Tab label="Plan" hotkey="3" isActive={currentView === 'plan'} />
      </Box>

      {/* Right: Queue Status (keep for backwards compat, shows running indicator) */}
      <Box>
        {runningCount > 0 ? (
          <Text color="green">
            <Text bold>▶</Text>
          </Text>
        ) : queueCount > 0 ? (
          <Text color="green">
            <Text bold>⚡</Text>
          </Text>
        ) : (
          <Text color="gray">○</Text>
        )}
      </Box>
    </Box>
  );
}

export default Header;
