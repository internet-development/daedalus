/**
 * CLI Output Formatting
 *
 * Terminal output utilities with ANSI color codes.
 * Designed for the readline-based planning CLI.
 */
import type { ChatSession } from '../planning/chat-history.js';
import type { CustomPrompt } from '../planning/prompts.js';
import type { Bean } from '../talos/beans-client.js';
import type { PlanMode } from '../planning/planning-session.js';

// =============================================================================
// ANSI Color Constants
// =============================================================================

const COLORS = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  italic: '\x1b[3m',
  underline: '\x1b[4m',

  // Foreground
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',

  // Background
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
} as const;

// Check if colors are supported (not piped)
const supportsColor = process.stdout.isTTY !== false;

function c(color: keyof typeof COLORS, text: string): string {
  if (!supportsColor) return text;
  return `${COLORS[color]}${text}${COLORS.reset}`;
}

// =============================================================================
// Message Formatting
// =============================================================================

export function formatUserMessage(content: string): string {
  const prefix = c('green', c('bold', 'You: '));
  return `${prefix}${content}`;
}

export function formatAssistantMessage(content: string): string {
  const prefix = c('cyan', c('bold', 'Planner:'));
  // Indent all lines of content
  const indentedContent = content
    .split('\n')
    .map((line) => `  ${line}`)
    .join('\n');
  return `${prefix}\n${indentedContent}`;
}

export function formatSystemMessage(content: string): string {
  return c('yellow', c('dim', content));
}

export function formatError(message: string): string {
  const prefix = c('red', c('bold', 'Error: '));
  return `${prefix}${message}`;
}

// =============================================================================
// UI Elements
// =============================================================================

export function formatHeader(
  mode: string,
  daemonStatus: 'running' | 'stopped'
): string {
  const statusColor = daemonStatus === 'running' ? 'green' : 'gray';
  const statusText = c(statusColor, daemonStatus);
  const modeText = c('cyan', mode);

  const header = `Planning ${c('dim', '[')}Mode: ${modeText}${c('dim', ']')} ${c('dim', '[')}Daemon: ${statusText}${c('dim', ']')}`;
  const divider = formatDivider();

  return `${header}\n${divider}`;
}

export function formatPrompt(mode?: PlanMode): string {
  if (!mode || mode === 'new') {
    return c('green', '> ');
  }
  return `${c('dim', '[')}${c('cyan', mode)}${c('dim', ']')} ${c('green', '>')} `;
}

export function formatContinuationPrompt(): string {
  return c('dim', '... ');
}

export function formatDivider(width?: number): string {
  const termWidth = width ?? process.stdout.columns ?? 80;
  return c('dim', '─'.repeat(Math.min(termWidth, 80)));
}

// =============================================================================
// List Formatting
// =============================================================================

export function formatHelp(): string {
  const commands = [
    ['/help', 'Show this help message'],
    ['/mode [name]', 'Show or change planning mode'],
    ['/prompt [name]', 'Use a custom prompt'],
    ['/start', 'Start the Talos daemon'],
    ['/stop', 'Stop the Talos daemon'],
    ['/status', 'Show daemon status'],
    ['/sessions', 'List all sessions'],
    ['/new', 'Start a new session'],
    ['/clear', 'Clear current session'],
    ['/tree', 'Show beans tree'],
    ['/quit', 'Exit (AI names session)'],
  ];

  const lines = [
    c('bold', 'Commands:'),
    '',
    ...commands.map(([cmd, desc]) => `  ${c('cyan', cmd.padEnd(16))} ${desc}`),
    '',
    c('dim', 'Press Ctrl+C to cancel streaming, Ctrl+D or /quit to exit.'),
  ];

  return lines.join('\n');
}

export function formatSessionList(
  sessions: ChatSession[],
  currentId: string | null
): string {
  if (sessions.length === 0) {
    return c('dim', 'No sessions yet. Start typing to create one.');
  }

  // Sort by most recent first
  const sorted = [...sessions].sort((a, b) => b.updatedAt - a.updatedAt);

  const lines = [c('bold', 'Sessions:'), ''];

  sorted.forEach((session, index) => {
    const isCurrent = session.id === currentId;
    const marker = isCurrent ? c('green', '*') : ' ';
    const num = `[${index + 1}]`;
    const name = isCurrent ? c('bold', session.name) : session.name;
    const msgCount = `${session.messages.length} msg${session.messages.length !== 1 ? 's' : ''}`;
    const timeAgo = formatRelativeTime(session.updatedAt);

    lines.push(`${marker} ${c('dim', num)} ${name} ${c('dim', `(${msgCount}, ${timeAgo})`)}`);
  });

  return lines.join('\n');
}

export function formatModeList(currentMode: PlanMode): string {
  const modes: Array<{ name: PlanMode; desc: string }> = [
    { name: 'new', desc: 'Create new beans through guided conversation' },
    { name: 'refine', desc: 'Improve and clarify existing draft beans' },
    { name: 'critique', desc: 'Run expert review on draft beans' },
    { name: 'sweep', desc: 'Check consistency across related beans' },
    { name: 'brainstorm', desc: 'Explore design options with Socratic questioning' },
    { name: 'breakdown', desc: 'Decompose work into actionable child beans' },
  ];

  const lines = [c('bold', 'Planning Modes:'), ''];

  for (const { name, desc } of modes) {
    const isCurrent = name === currentMode;
    const marker = isCurrent ? c('green', '*') : ' ';
    const modeName = isCurrent ? c('bold', name) : name;
    lines.push(`${marker} ${c('cyan', modeName.padEnd(12))} ${c('dim', desc)}`);
  }

  return lines.join('\n');
}

export function formatPromptList(prompts: CustomPrompt[]): string {
  if (prompts.length === 0) {
    return c('dim', 'No custom prompts found. Create prompts in .talos/prompts/');
  }

  const lines = [c('bold', 'Available Prompts:'), ''];

  for (const prompt of prompts) {
    const name = c('cyan', prompt.name.padEnd(16));
    const desc = prompt.description ?? c('dim', '(no description)');
    const defaultMarker = prompt.isDefault ? c('dim', ' [default]') : '';
    lines.push(`  ${name} ${desc}${defaultMarker}`);
  }

  return lines.join('\n');
}

export function formatStatus(
  daemonRunning: boolean,
  queue: Bean[],
  running: Bean[],
  stuck: Bean[]
): string {
  const status = daemonRunning
    ? c('green', 'running')
    : c('gray', 'stopped');

  const lines = [
    c('bold', 'Daemon Status:') + ` ${status}`,
    '',
  ];

  if (!daemonRunning) {
    lines.push(c('dim', 'Use /start to start the daemon.'));
    return lines.join('\n');
  }

  // Queue summary
  if (queue.length > 0) {
    lines.push(`${c('yellow', 'Queued:')} ${queue.length} bean${queue.length !== 1 ? 's' : ''}`);
    for (const bean of queue.slice(0, 3)) {
      lines.push(`  - ${bean.id}: ${bean.title}`);
    }
    if (queue.length > 3) {
      lines.push(c('dim', `  ... and ${queue.length - 3} more`));
    }
  }

  // Running
  if (running.length > 0) {
    lines.push(`${c('cyan', 'Running:')} ${running.length} bean${running.length !== 1 ? 's' : ''}`);
    for (const bean of running) {
      lines.push(`  - ${bean.id}: ${bean.title}`);
    }
  }

  // Stuck
  if (stuck.length > 0) {
    lines.push(`${c('red', 'Stuck:')} ${stuck.length} bean${stuck.length !== 1 ? 's' : ''}`);
    for (const bean of stuck) {
      lines.push(`  - ${bean.id}: ${bean.title}`);
    }
  }

  // Idle state
  if (queue.length === 0 && running.length === 0 && stuck.length === 0) {
    lines.push(c('dim', 'No beans in queue. Daemon is idle.'));
  }

  return lines.join('\n');
}

// =============================================================================
// Helpers
// =============================================================================

export function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

export function wrapText(
  text: string,
  width: number,
  indent = 0
): string {
  const indentStr = ' '.repeat(indent);
  const effectiveWidth = width - indent;

  if (effectiveWidth <= 0) return text;

  const lines: string[] = [];
  const paragraphs = text.split('\n');

  for (const paragraph of paragraphs) {
    if (paragraph.length <= effectiveWidth) {
      lines.push(indentStr + paragraph);
      continue;
    }

    const words = paragraph.split(' ');
    let currentLine = '';

    for (const word of words) {
      if (currentLine.length + word.length + 1 <= effectiveWidth) {
        currentLine += (currentLine ? ' ' : '') + word;
      } else {
        if (currentLine) {
          lines.push(indentStr + currentLine);
        }
        currentLine = word;
      }
    }

    if (currentLine) {
      lines.push(indentStr + currentLine);
    }
  }

  return lines.join('\n');
}

// =============================================================================
// Streaming Output
// =============================================================================

export function formatStreamingPrefix(): string {
  return c('cyan', c('bold', 'Planner: '));
}

export function formatToolCall(name: string, args?: Record<string, unknown>): string {
  const argsStr = args ? ` ${c('dim', JSON.stringify(args).slice(0, 50))}` : '';
  return c('yellow', `  [Tool: ${name}${argsStr}]`);
}
