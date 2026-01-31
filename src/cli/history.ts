/**
 * History Command Module
 *
 * Implements /history and /hist commands for viewing past messages
 * in the current planning session.
 */
import type { ChatMessage } from '../planning/chat-history.js';
import { formatRelativeTime } from './output.js';

// =============================================================================
// ANSI Color Constants (matching output.ts)
// =============================================================================

const COLORS = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  italic: '\x1b[3m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  gray: '\x1b[90m',
} as const;

const supportsColor = process.stdout.isTTY !== false;

function c(color: keyof typeof COLORS, text: string): string {
  if (!supportsColor) return text;
  return `${COLORS[color]}${text}${COLORS.reset}`;
}

// =============================================================================
// Argument Parsing
// =============================================================================

const DEFAULT_COUNT = 10;
const MAX_CONTENT_LINES = 3;

export interface HistoryArgs {
  count: number;
}

/**
 * Parse the arguments string for /history command.
 *
 * - No args → default count (10)
 * - Numeric arg → that count
 * - "all" → Infinity (show all)
 * - Anything else → default count
 */
export function parseHistoryArgs(args: string): HistoryArgs {
  const trimmed = args.trim();

  if (!trimmed) {
    return { count: DEFAULT_COUNT };
  }

  if (trimmed.toLowerCase() === 'all') {
    return { count: Infinity };
  }

  const num = parseInt(trimmed, 10);
  if (!isNaN(num) && num > 0) {
    return { count: num };
  }

  return { count: DEFAULT_COUNT };
}

// =============================================================================
// Message Filtering
// =============================================================================

/**
 * Filter messages for history display.
 *
 * Omits assistant messages that have toolCalls but no content
 * (pure tool-call messages). Keeps messages with both content and toolCalls.
 */
export function filterHistoryMessages(messages: ChatMessage[]): ChatMessage[] {
  return messages.filter((msg) => {
    // Omit assistant messages with toolCalls but empty content
    if (
      msg.role === 'assistant' &&
      msg.toolCalls &&
      msg.toolCalls.length > 0 &&
      !msg.content
    ) {
      return false;
    }
    return true;
  });
}

// =============================================================================
// Display Formatting
// =============================================================================

/**
 * Truncate message content to MAX_CONTENT_LINES lines.
 * Adds "..." indicator if truncated.
 */
function truncateContent(content: string): string {
  const lines = content.split('\n');
  if (lines.length <= MAX_CONTENT_LINES) {
    return content;
  }
  return lines.slice(0, MAX_CONTENT_LINES).join('\n') + '\n...';
}

/**
 * Format a role label with appropriate color.
 */
function formatRole(role: ChatMessage['role']): string {
  switch (role) {
    case 'user':
      return c('cyan', c('bold', '[user]'));
    case 'assistant':
      return c('green', c('bold', '[assistant]'));
    case 'system':
      return c('dim', c('italic', '[system]'));
  }
}

/**
 * Format chat history messages for display.
 *
 * @param messages - Already-filtered messages to display
 * @param count - Max number of messages to show
 * @returns Formatted string for console output
 */
export function formatHistory(messages: ChatMessage[], count: number): string {
  if (messages.length === 0) {
    return c('dim', 'No messages in this session.');
  }

  // Slice to requested count (from the end)
  const isSliced = count < messages.length;
  const displayed = isSliced ? messages.slice(-count) : messages;
  const displayCount = displayed.length;

  // Header
  const countLabel = isSliced
    ? `last ${displayCount} messages`
    : `all ${displayCount} messages`;

  const lines: string[] = [];
  lines.push(
    c('dim', '── ') +
      c('bold', 'History') +
      c('dim', ` (${countLabel}) `) +
      c('dim', '─'.repeat(30))
  );
  lines.push('');

  // Format each message
  for (const msg of displayed) {
    const role = formatRole(msg.role);
    const timeAgo = c('dim', formatRelativeTime(msg.timestamp));

    lines.push(`${role} ${timeAgo}`);

    // Indent and truncate content
    const truncated = truncateContent(msg.content);
    const contentLines = truncated.split('\n');
    for (const line of contentLines) {
      if (msg.role === 'system') {
        lines.push(`  ${c('dim', line)}`);
      } else {
        lines.push(`  ${line}`);
      }
    }

    lines.push('');
  }

  return lines.join('\n');
}
