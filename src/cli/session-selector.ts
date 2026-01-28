/**
 * Session Selector
 *
 * Interactive prompt for selecting or creating chat sessions.
 */
import * as readline from 'readline';
import type { ChatSession } from '../planning/chat-history.js';
import { formatRelativeTime, formatDivider } from './output.js';

// =============================================================================
// Types
// =============================================================================

export interface SessionSelection {
  action: 'continue' | 'new';
  sessionId?: string; // Only set if action is 'continue'
}

// =============================================================================
// ANSI Helpers (inline to avoid circular deps)
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

  // Display header
  console.log();
  console.log(bold('Planning Sessions'));
  console.log(formatDivider(40));

  // Display sessions
  sorted.forEach((session, index) => {
    const isCurrent = session.id === currentSessionId;
    const marker = isCurrent ? green('*') : ' ';
    const num = `[${index + 1}]`;
    const name = isCurrent ? bold(session.name) : session.name;
    const msgCount = `${session.messages.length} msg${session.messages.length !== 1 ? 's' : ''}`;
    const timeAgo = formatRelativeTime(session.updatedAt);

    console.log(`${marker} ${dim(num)} ${name} ${dim(`(${msgCount}, ${timeAgo})`)}`);
  });

  // Add "new session" option
  const newOptionNum = sorted.length + 1;
  console.log(`  ${dim(`[${newOptionNum}]`)} ${cyan('Start new session')}`);
  console.log();

  // Create readline interface
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  // Prompt for selection
  return new Promise((resolve) => {
    const prompt = () => {
      rl.question(`Select [1-${newOptionNum}]: `, (answer) => {
        const trimmed = answer.trim();

        // Handle empty input - default to most recent session
        if (trimmed === '' && sorted.length > 0) {
          rl.close();
          resolve({ action: 'continue', sessionId: sorted[0].id });
          return;
        }

        const num = parseInt(trimmed, 10);

        if (num >= 1 && num <= sorted.length) {
          // Selected an existing session
          rl.close();
          resolve({ action: 'continue', sessionId: sorted[num - 1].id });
        } else if (num === newOptionNum) {
          // Selected "new session"
          rl.close();
          resolve({ action: 'new' });
        } else {
          // Invalid input
          console.log(dim('Invalid selection, try again.'));
          prompt();
        }
      });
    };

    // Handle Ctrl+C
    rl.on('close', () => {
      // If closed without selection, default to new session
    });

    prompt();
  });
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
