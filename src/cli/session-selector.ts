/**
 * Session Selector
 *
 * Interactive prompt for selecting or creating chat sessions.
 * Supports arrow key navigation for better UX.
 */
import * as readline from 'readline';
import type { ChatSession } from '../planning/chat-history.js';
import { formatRelativeTime, formatDivider } from './output.js';

// =============================================================================
// Types
// =============================================================================

export interface SessionSelection {
  action: 'continue' | 'new' | 'exit';
  sessionId?: string; // Only set if action is 'continue'
}

// Sentinel value returned by interactiveSelect when user quits
const EXIT_SENTINEL = '__EXIT__';

// =============================================================================
// ANSI Helpers
// =============================================================================

const supportsColor = process.stdout.isTTY !== false;

function c(codes: string, text: string): string {
  if (!supportsColor) return text;
  return `\x1b[${codes}m${text}\x1b[0m`;
}

const bold = (s: string) => c('1', s);
const dim = (s: string) => c('2', s);
const green = (s: string) => c('32', s);
const cyan = (s: string) => c('36', s);
const inverse = (s: string) => c('7', s);

// ANSI escape codes
const CLEAR_LINE = '\x1b[2K';
const CURSOR_UP = (n: number) => `\x1b[${n}A`;
const CURSOR_DOWN = (n: number) => `\x1b[${n}B`;
const CURSOR_TO_START = '\r';
const HIDE_CURSOR = '\x1b[?25l';
const SHOW_CURSOR = '\x1b[?25h';

// =============================================================================
// Interactive Selector
// =============================================================================

interface SelectOption {
  label: string;
  value: string | null; // null for "new session"
  meta?: string;
}

async function interactiveSelect(
  title: string,
  options: SelectOption[],
  defaultIndex = 0
): Promise<string | null> {
  if (!process.stdin.isTTY) {
    // Fallback to simple number input if not a TTY
    return simpleSelect(title, options);
  }

  let selectedIndex = defaultIndex;

  // Render the menu
  const render = () => {
    // Move cursor up to redraw (except first render)
    process.stdout.write(CURSOR_TO_START);

    for (let i = 0; i < options.length; i++) {
      const opt = options[i];
      const isSelected = i === selectedIndex;
      const pointer = isSelected ? green('>') : ' ';
      const label = isSelected ? bold(opt.label) : opt.label;
      const meta = opt.meta ? ` ${dim(opt.meta)}` : '';

      process.stdout.write(CLEAR_LINE);
      console.log(`${pointer} ${label}${meta}`);
    }

    // Instructions
    process.stdout.write(CLEAR_LINE);
    console.log(dim('\n  ↑/↓ to move, Enter to select, q to quit'));
  };

  // Initial render
  console.log();
  console.log(bold(title));
  console.log(formatDivider(40));
  process.stdout.write(HIDE_CURSOR);
  render();

  return new Promise((resolve) => {
    // Enable raw mode for keypress detection
    if (process.stdin.setRawMode) {
      process.stdin.setRawMode(true);
    }
    process.stdin.resume();

    const cleanup = () => {
      process.stdout.write(SHOW_CURSOR);
      if (process.stdin.setRawMode) {
        process.stdin.setRawMode(false);
      }
      process.stdin.pause();
      process.stdin.removeListener('data', onKeypress);
    };

    const onKeypress = (data: Buffer) => {
      const key = data.toString();

      // Arrow up or k
      if (key === '\x1b[A' || key === 'k') {
        selectedIndex = selectedIndex > 0 ? selectedIndex - 1 : options.length - 1;
        // Move cursor up to redraw
        process.stdout.write(CURSOR_UP(options.length + 2));
        render();
      }
      // Arrow down or j
      else if (key === '\x1b[B' || key === 'j') {
        selectedIndex = selectedIndex < options.length - 1 ? selectedIndex + 1 : 0;
        process.stdout.write(CURSOR_UP(options.length + 2));
        render();
      }
      // Enter
      else if (key === '\r' || key === '\n') {
        cleanup();
        console.log(); // Extra newline after selection
        resolve(options[selectedIndex].value);
      }
      // q or Escape - exit the application
      else if (key === 'q' || key === '\x1b') {
        cleanup();
        console.log();
        resolve(EXIT_SENTINEL);
      }
      // Ctrl+C - exit immediately
      else if (key === '\x03') {
        cleanup();
        process.exit(0);
      }
    };

    process.stdin.on('data', onKeypress);
  });
}

// Fallback for non-TTY
async function simpleSelect(
  title: string,
  options: SelectOption[]
): Promise<string | null> {
  console.log();
  console.log(bold(title));
  console.log(formatDivider(40));

  options.forEach((opt, i) => {
    const meta = opt.meta ? ` ${dim(opt.meta)}` : '';
    console.log(`  ${dim(`[${i + 1}]`)} ${opt.label}${meta}`);
  });
  console.log();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`Select [1-${options.length}]: `, (answer) => {
      rl.close();
      const num = parseInt(answer.trim(), 10);
      if (num >= 1 && num <= options.length) {
        resolve(options[num - 1].value);
      } else {
        resolve(options[0].value);
      }
    });
  });
}

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
