/**
 * CLI Command Handlers
 *
 * Implements all /command handlers for the interactive planning session.
 */
import type { PlanningSession, PlanMode } from '../planning/planning-session.js';
import type { ChatHistoryState } from '../planning/chat-history.js';
import { clearMessages, getCurrentSession } from '../planning/chat-history.js';
import type { Talos } from '../talos/talos.js';
import type { CustomPrompt } from '../planning/prompts.js';
import {
  formatHelp,
  formatPromptList,
  formatStatus,
  formatError,
} from './output.js';
import { parseHistoryArgs, filterHistoryMessages, formatHistory } from './history.js';
import { selectSession } from './session-selector.js';
import { runTree } from './tree-simple.js';
import { openEditor } from './editor.js';
import {
  interactiveSelect,
  EXIT_SENTINEL,
  type SelectOption,
} from './interactive-select.js';

// =============================================================================
// Command Names for Tab Completion
// =============================================================================

/**
 * All command names and aliases with / prefix.
 * Used for tab completion in the readline interface.
 */
export const COMMAND_NAMES: string[] = [
  // Primary commands
  '/help',
  '/mode',
  '/prompt',
  '/edit',
  '/start',
  '/stop',
  '/status',
  '/sessions',
  '/new',
  '/clear',
  '/beans',
  '/history',
  '/quit',
  // Aliases
  '/h',
  '/?',
  '/m',
  '/p',
  '/e',
  '/st',
  '/ss',
  '/n',
  '/c',
  '/tree',
  '/t',
  '/hist',
  '/q',
  '/exit',
];

// =============================================================================
// Types
// =============================================================================

export interface CommandContext {
  session: PlanningSession;
  history: ChatHistoryState;
  talos: Talos | null;
  prompts: CustomPrompt[];
  saveHistory: () => void;
  startDaemon: () => Promise<void>;
  stopDaemon: () => Promise<void>;
  /** Mutable readline output — mute during interactive select to prevent character echo. See daedalus-rbhm. */
  rlOutput: { mute: () => void; unmute: () => void };
}

export type CommandResult =
  | { type: 'continue' }
  | { type: 'quit'; generateName: boolean }
  | { type: 'send'; message: string }
  | { type: 'update-history'; state: ChatHistoryState }
  | { type: 'switch-session'; sessionId: string }
  | { type: 'new-session' };

// =============================================================================
// Mode Validation
// =============================================================================

const VALID_MODES: PlanMode[] = [
  'new',
  'refine',
  'critique',
  'sweep',
  'brainstorm',
  'breakdown',
];

const MODE_DESCRIPTIONS: Record<PlanMode, string> = {
  new: 'Create new beans through guided conversation',
  refine: 'Improve and clarify existing draft beans',
  critique: 'Run expert review on draft beans',
  sweep: 'Check consistency across related beans',
  brainstorm: 'Explore design options with Socratic questioning',
  breakdown: 'Decompose work into actionable child beans',
};

function isValidMode(mode: string): mode is PlanMode {
  return VALID_MODES.includes(mode as PlanMode);
}

// =============================================================================
// Main Handler
// =============================================================================

export async function handleCommand(
  input: string,
  ctx: CommandContext
): Promise<CommandResult> {
  const trimmed = input.trim();

  // Parse command and args
  const match = trimmed.match(/^\/(\S+)(?:\s+(.*))?$/);
  if (!match) {
    // Not a command
    return { type: 'continue' };
  }

  const [, command, args = ''] = match;
  const cmdLower = command.toLowerCase();

  switch (cmdLower) {
    case 'help':
    case 'h':
    case '?':
      return handleHelp();

    case 'mode':
    case 'm':
      return await handleMode(args, ctx);

    case 'prompt':
    case 'p':
      return await handlePrompt(args, ctx);

    case 'edit':
    case 'e':
      return handleEdit(ctx);

    case 'start':
      return await handleStart(ctx);

    case 'stop':
      return await handleStop(ctx);

    case 'status':
    case 'st':
      return handleStatus(ctx);

    case 'sessions':
    case 'ss':
      return await handleSessions(ctx);

    case 'new':
    case 'n':
      return handleNew();

    case 'clear':
    case 'c':
      return handleClear(ctx);

    case 'beans':
    case 'tree':
    case 't':
      return await handleBeans(args);

    case 'history':
    case 'hist':
      return handleHistory(args, ctx);

    case 'quit':
    case 'q':
    case 'exit':
      return handleQuit();

    default:
      console.log(formatError(`Unknown command: /${command}`));
      console.log('Type /help to see available commands.');
      return { type: 'continue' };
  }
}

/**
 * Check if input is a command (starts with /)
 */
export function isCommand(input: string): boolean {
  return input.trim().startsWith('/');
}

// =============================================================================
// Command Handlers
// =============================================================================

function handleHelp(): CommandResult {
  console.log(formatHelp());
  return { type: 'continue' };
}

async function handleMode(args: string, ctx: CommandContext): Promise<CommandResult> {
  if (!args.trim()) {
    // Interactive mode selection
    const options: SelectOption[] = VALID_MODES.map((mode) => ({
      label: mode,
      value: mode,
      meta: MODE_DESCRIPTIONS[mode],
    }));

    const currentIndex = VALID_MODES.indexOf(ctx.session.getMode());

    // Mute readline output to prevent character echo during interactive select.
    // The parent readline interface echoes raw keypresses (j/k) to stdout
    // unless its output is suppressed. See daedalus-rbhm.
    ctx.rlOutput.mute();
    let result: string | null;
    try {
      result = await interactiveSelect(
        'Planning Modes',
        options,
        currentIndex >= 0 ? currentIndex : 0
      );
    } finally {
      ctx.rlOutput.unmute();
    }

    if (result === EXIT_SENTINEL || result === null) {
      return { type: 'continue' };
    }

    if (isValidMode(result)) {
      ctx.session.setMode(result);
      console.log(`Switched to mode: ${result}`);
    }

    return { type: 'continue' };
  }

  // Direct mode switch (existing behavior)
  const mode = args.trim().toLowerCase();
  if (!isValidMode(mode)) {
    console.log(formatError(`Unknown mode: ${args}`));
    console.log('Use /mode to see available modes.');
    return { type: 'continue' };
  }

  ctx.session.setMode(mode);
  console.log(`Switched to mode: ${mode}`);
  return { type: 'continue' };
}

async function handlePrompt(args: string, ctx: CommandContext): Promise<CommandResult> {
  if (!args.trim()) {
    if (ctx.prompts.length === 0) {
      console.log('No custom prompts found. Create prompts in .talos/prompts/');
      return { type: 'continue' };
    }

    // Interactive prompt selection
    const options: SelectOption[] = ctx.prompts.map((p) => ({
      label: p.name,
      value: p.name,
      meta: p.description ?? '(no description)',
    }));

    // Mute readline output to prevent character echo during interactive select.
    // See daedalus-rbhm.
    ctx.rlOutput.mute();
    let result: string | null;
    try {
      result = await interactiveSelect('Available Prompts', options, 0);
    } finally {
      ctx.rlOutput.unmute();
    }

    if (result === EXIT_SENTINEL || result === null) {
      return { type: 'continue' };
    }

    const prompt = ctx.prompts.find(
      (p) => p.name === result
    );

    if (prompt) {
      return { type: 'send', message: prompt.content };
    }

    return { type: 'continue' };
  }

  // Direct prompt usage (existing behavior)
  const promptName = args.trim().toLowerCase();
  const prompt = ctx.prompts.find(
    (p) => p.name.toLowerCase() === promptName
  );

  if (!prompt) {
    console.log(formatError(`Unknown prompt: ${args}`));
    console.log('Use /prompt to see available prompts.');
    return { type: 'continue' };
  }

  return { type: 'send', message: prompt.content };
}

async function handleStart(ctx: CommandContext): Promise<CommandResult> {
  if (ctx.talos) {
    console.log('Daemon is already running.');
    return { type: 'continue' };
  }

  console.log('Starting daemon...');
  try {
    await ctx.startDaemon();
    console.log('Daemon started.');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.log(formatError(`Failed to start daemon: ${message}`));
  }
  return { type: 'continue' };
}

async function handleStop(ctx: CommandContext): Promise<CommandResult> {
  if (!ctx.talos) {
    console.log('Daemon is not running.');
    return { type: 'continue' };
  }

  console.log('Stopping daemon...');
  try {
    await ctx.stopDaemon();
    console.log('Daemon stopped.');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.log(formatError(`Failed to stop daemon: ${message}`));
  }
  return { type: 'continue' };
}

function handleStatus(ctx: CommandContext): CommandResult {
  if (!ctx.talos) {
    console.log(formatStatus(false, [], [], []));
    return { type: 'continue' };
  }

  const queue = ctx.talos.getQueue();
  const running = Array.from(ctx.talos.getInProgress().values()).map(
    (r) => r.bean
  );
  const stuck = ctx.talos.getStuck();

  console.log(formatStatus(true, queue, running, stuck));
  return { type: 'continue' };
}

async function handleSessions(ctx: CommandContext): Promise<CommandResult> {
  // Mute readline output to prevent character echo during interactive select.
  // See daedalus-rbhm.
  ctx.rlOutput.mute();
  let selection;
  try {
    selection = await selectSession(
      ctx.history.sessions,
      ctx.history.currentSessionId
    );
  } finally {
    ctx.rlOutput.unmute();
  }

  if (selection.action === 'exit') {
    return { type: 'quit', generateName: true };
  }

  if (selection.action === 'new') {
    return { type: 'new-session' };
  }

  if (selection.sessionId) {
    return { type: 'switch-session', sessionId: selection.sessionId };
  }

  return { type: 'continue' };
}

function handleNew(): CommandResult {
  return { type: 'new-session' };
}

function handleClear(ctx: CommandContext): CommandResult {
  const newState = clearMessages(ctx.history);
  console.log('Session cleared.');
  return { type: 'update-history', state: newState };
}

async function handleBeans(args: string): Promise<CommandResult> {
  const treeArgs = args.trim() ? args.trim().split(/\s+/) : [];

  try {
    await runTree({ args: treeArgs });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.log(formatError(`Failed to run beans: ${message}`));
  }

  return { type: 'continue' };
}

function handleHistory(args: string, ctx: CommandContext): CommandResult {
  const session = getCurrentSession(ctx.history);
  const messages = session?.messages ?? [];

  if (messages.length === 0) {
    console.log('\x1b[2mNo messages in this session.\x1b[0m');
    return { type: 'continue' };
  }

  const { count } = parseHistoryArgs(args);
  const filtered = filterHistoryMessages(messages);
  console.log(formatHistory(filtered, count));
  return { type: 'continue' };
}

function handleEdit(ctx: CommandContext): CommandResult {
  // Get last agent message from chat history for context
  const session = getCurrentSession(ctx.history);
  const messages = session?.messages ?? [];
  const lastAgentMessage = [...messages]
    .reverse()
    .find((m) => m.role === 'assistant');

  const content = openEditor({
    agentMessage: lastAgentMessage?.content,
  });

  if (!content) {
    console.log('Editor cancelled or empty message — not sent.');
    return { type: 'continue' };
  }

  return { type: 'send', message: content };
}

function handleQuit(): CommandResult {
  return { type: 'quit', generateName: true };
}
