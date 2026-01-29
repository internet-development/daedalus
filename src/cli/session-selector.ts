/**
 * Session Selector
 *
 * Interactive prompt for selecting or creating chat sessions.
 * Supports arrow key navigation for better UX.
 */
import * as readline from 'readline';
import type { ChatSession } from '../planning/chat-history.js';
import { formatRelativeTime } from './output.js';
import {
  interactiveSelect,
  EXIT_SENTINEL,
  type SelectOption,
} from './interactive-select.js';

// =============================================================================
// Types
// =============================================================================

export interface SessionSelection {
  action: 'continue' | 'new' | 'exit';
  sessionId?: string; // Only set if action is 'continue'
}

// =============================================================================
// ANSI Helpers (kept for selectSession formatting)
// =============================================================================

const supportsColor = process.stdout.isTTY !== false;

function c(codes: string, text: string): string {
  if (!supportsColor) return text;
  return `\x1b[${codes}m${text}\x1b[0m`;
}

const cyan = (s: string) => c('36', s);

// =============================================================================
// Main Function
// =============================================================================

export async function selectSession(
  sessions: ChatSession[],
  currentSessionId: string | null
): Promise<SessionSelection> {
  // Handle empty sessions
  if (sessions.length === 0) {
    return { action: 'new' };
  }

  // Sort sessions by updatedAt descending (most recent first)
  const sorted = [...sessions].sort((a, b) => b.updatedAt - a.updatedAt);

  // Build options - start with "new session" at top for easy access
  const options: SelectOption[] = [
    {
      label: cyan('Start new session'),
      value: null,
    },
  ];

  // Add existing sessions after "new session"
  sorted.forEach((session) => {
    const msgCount = `${session.messages.length} msg${session.messages.length !== 1 ? 's' : ''}`;
    const timeAgo = formatRelativeTime(session.updatedAt);
    const current = session.id === currentSessionId ? ' (current)' : '';

    options.push({
      label: session.name + current,
      value: session.id,
      meta: `${msgCount}, ${timeAgo}`,
    });
  });

  // Calculate default index:
  // - If current session exists: default to its index (+1 due to "new session" at index 0)
  // - If no current session but sessions exist: default to most recent (index 1)
  // - If no sessions: default to "Start new session" (index 0) - handled by early return above
  let defaultIndex = 1; // Default to most recent session (first session after "new")
  if (currentSessionId) {
    const currentIdx = sorted.findIndex((s) => s.id === currentSessionId);
    if (currentIdx >= 0) {
      defaultIndex = currentIdx + 1; // +1 because "new session" is at index 0
    }
  }

  const result = await interactiveSelect(
    'Planning Sessions',
    options,
    defaultIndex >= 0 ? defaultIndex : 0
  );

  if (result === EXIT_SENTINEL) {
    return { action: 'exit' };
  }

  if (result === null) {
    return { action: 'new' };
  }

  return { action: 'continue', sessionId: result };
}

/**
 * Simple prompt that just asks for a session number from a list.
 * Returns the session ID or null for new session.
 */
export async function promptSessionNumber(
  sessions: ChatSession[],
  message: string
): Promise<string | null> {
  if (sessions.length === 0) {
    return null;
  }

  const sorted = [...sessions].sort((a, b) => b.updatedAt - a.updatedAt);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(message, (answer) => {
      rl.close();
      const num = parseInt(answer.trim(), 10);

      if (num >= 1 && num <= sorted.length) {
        resolve(sorted[num - 1].id);
      } else {
        resolve(null);
      }
    });
  });
}
