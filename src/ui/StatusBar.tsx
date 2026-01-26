/**
 * StatusBar Component
 *
 * Bottom bar showing keyboard shortcuts and context-specific info.
 *
 * Layout:
 * │  [q]uit  [1-3] switch view  {context-specific shortcuts}            │
 */
import React from 'react';
import { Box, Text } from 'ink';
import type { ViewType } from './Header.js';

export interface StatusBarProps {
  currentView: ViewType;
  isPaused: boolean;
}

interface ShortcutDef {
  hotkey: string;
  label: string;
}

function Shortcut({ hotkey, label }: ShortcutDef) {
  return (
    <Box marginRight={2}>
      <Text color="cyan">[{hotkey}]</Text>
      <Text color="gray">{label}</Text>
    </Box>
  );
}

/**
 * Get context-specific shortcuts based on current view
 */
function getContextShortcuts(view: ViewType, isPaused: boolean): ShortcutDef[] {
  const shortcuts: ShortcutDef[] = [];

  switch (view) {
    case 'monitor':
      shortcuts.push({ hotkey: 'j/k', label: 'navigate' });
      shortcuts.push({ hotkey: 'Enter', label: 'actions' });
      shortcuts.push({ hotkey: 'd', label: 'drafts' });
      shortcuts.push({ hotkey: 'r', label: 'retry' });
      break;
    case 'execute':
      shortcuts.push({ hotkey: 'c', label: 'cancel' });
      break;
    case 'plan':
      shortcuts.push({ hotkey: 'Enter', label: 'send' });
      break;
  }

  // Pause/resume is always shown
  shortcuts.push({ hotkey: 'p', label: isPaused ? 'resume' : 'pause' });

  return shortcuts;
}

export function StatusBar({ currentView, isPaused }: StatusBarProps) {
  const contextShortcuts = getContextShortcuts(currentView, isPaused);

  return (
    <Box borderStyle="single" borderTop={false} paddingX={1}>
      {/* Global shortcuts */}
      <Shortcut hotkey="q" label="quit" />
      <Shortcut hotkey="1-3" label="switch view" />
      <Shortcut hotkey="?" label="help" />

      {/* Separator */}
      <Text color="gray">│ </Text>

      {/* Context-specific shortcuts */}
      {contextShortcuts.map((shortcut, i) => (
        <Shortcut key={shortcut.hotkey} {...shortcut} />
      ))}
    </Box>
  );
}

export default StatusBar;
