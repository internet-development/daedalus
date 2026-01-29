/**
 * Planning CLI Main Loop
 *
 * Interactive planning session that ties together the planning agent,
 * chat history, and command handlers.
 */
import * as readline from 'readline';
import { loadConfig } from '../config/index.js';
import {
  loadChatHistory,
  saveChatHistory,
  createSession,
  switchSession,
  addMessage,
  getCurrentSession,
  getSessionsSortedByDate,
  renameSession,
  type ChatMessage,
  type ChatHistoryState,
  type ToolCall,
} from '../planning/chat-history.js';
import { loadPrompts } from '../planning/prompts.js';
import { PlanningSession, type PlanMode } from '../planning/planning-session.js';
import { Talos } from '../talos/talos.js';
import {
  formatHeader,
  formatPrompt,
  formatContinuationPrompt,
  formatError,
  formatSessionList,
  formatToolCall,
} from './output.js';
import { processInputLine } from './multiline-input.js';
import { selectSession } from './session-selector.js';
import { handleCommand, isCommand, type CommandContext } from './commands.js';
import { loadInputHistory, appendToHistory } from './input-history.js';
import { completer } from './completer.js';
import { generateSessionName as generateSessionNameWithAI } from './session-naming.js';

// =============================================================================
// Types
// =============================================================================

export interface PlanOptions {
  mode?: PlanMode;
  prompt?: string;
  new?: boolean;
  list?: boolean;
  continue?: boolean;
}

// =============================================================================
// Spinner
// =============================================================================

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

interface Spinner {
  start: () => void;
  stop: () => void;
}

function createSpinner(): Spinner {
  let frameIndex = 0;
  let intervalId: NodeJS.Timeout | null = null;

  return {
    start() {
      if (intervalId) return;
      process.stdout.write('\x1b[36m' + SPINNER_FRAMES[0] + '\x1b[0m Thinking...');
      intervalId = setInterval(() => {
        frameIndex = (frameIndex + 1) % SPINNER_FRAMES.length;
        // Move cursor back, clear line, write new frame
        process.stdout.write('\r\x1b[36m' + SPINNER_FRAMES[frameIndex] + '\x1b[0m Thinking...');
      }, 80);
    },
    stop() {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
        // Clear the spinner line
        process.stdout.write('\r\x1b[K');
      }
    },
  };
}

// =============================================================================
// Main Entry Point
// =============================================================================

export async function runPlan(options: PlanOptions): Promise<void> {
  // 1. Load config
  const { config } = loadConfig();

  // 2. Load prompts
  const prompts = await loadPrompts();

  // 3. Load chat history
  let historyState = loadChatHistory();

  // 4. Handle --list flag
  if (options.list) {
    if (historyState.sessions.length === 0) {
      console.log('No sessions found.');
    } else {
      console.log(
        formatSessionList(
          getSessionsSortedByDate(historyState),
          historyState.currentSessionId
        )
      );
    }
    return;
  }

  // 5. Session selection
  if (options.new || historyState.sessions.length === 0) {
    historyState = createSession(historyState);
  } else if (options.continue) {
    // Continue most recent session (by updatedAt)
    const sortedSessions = getSessionsSortedByDate(historyState);
    if (sortedSessions.length > 0) {
      historyState = switchSession(historyState, sortedSessions[0].id);
    } else {
      // No sessions exist, create a new one (same as --new)
      historyState = createSession(historyState);
    }
  } else {
    const selection = await selectSession(
      historyState.sessions,
      historyState.currentSessionId
    );
    if (selection.action === 'new') {
      historyState = createSession(historyState);
    } else if (selection.sessionId) {
      historyState = switchSession(historyState, selection.sessionId);
    }
  }
  saveChatHistory(historyState);

  // 6. Initialize PlanningSession
  const session = new PlanningSession({
    config: config.planning_agent,
    expertsConfig: config.experts,
    mode: options.mode ?? 'new',
  });

  // 7. Handle --prompt flag
  let initialPrompt: string | null = null;
  if (options.prompt) {
    const prompt = prompts.find(
      (p) => p.name.toLowerCase() === options.prompt!.toLowerCase()
    );
    if (prompt) {
      initialPrompt = prompt.content;
    } else {
      console.log(formatError(`Unknown prompt: ${options.prompt}`));
    }
  }

  // 8. Load input history and create readline interface
  const inputHistory = await loadInputHistory();
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    history: inputHistory,
    historySize: 1000,
    removeHistoryDuplicates: true,
    completer,
  });

  // 9. Set up Talos (not started yet - manual start)
  let talos: Talos | null = null;

  // 10. Command context
  const ctx: CommandContext = {
    session,
    history: historyState,
    talos,
    prompts,
    saveHistory: () => {
      saveChatHistory(ctx.history);
    },
    startDaemon: async () => {
      if (!ctx.talos) {
        ctx.talos = new Talos();
        await ctx.talos.start();
      }
    },
    stopDaemon: async () => {
      if (ctx.talos) {
        await ctx.talos.stop();
        ctx.talos = null;
      }
    },
  };

  // 10b. Cancel state - shared between SIGINT handler and sendAndStream
  let streamCancelled = false;
  const markCancelled = () => {
    streamCancelled = true;
  };
  const resetCancelled = () => {
    streamCancelled = false;
  };
  const isCancelled = () => streamCancelled;

  // 11. Set up signal handlers
  setupSignalHandlers(ctx, rl, markCancelled);

  // 12. Print header
  console.log();
  console.log(formatHeader(session.getMode(), ctx.talos ? 'running' : 'stopped'));
  console.log();

  // 13. Main loop
  await mainLoop(rl, ctx, initialPrompt, isCancelled, resetCancelled);
}

// =============================================================================
// Main Loop
// =============================================================================

async function mainLoop(
  rl: readline.Interface,
  ctx: CommandContext,
  initialPrompt: string | null,
  isCancelled: () => boolean,
  resetCancelled: () => void
): Promise<void> {
  // Send initial prompt if provided
  if (initialPrompt) {
    await sendAndStream(initialPrompt, ctx, isCancelled, resetCancelled);
  }

  // Interactive loop
  while (true) {
    const input = await question(rl, formatPrompt(ctx.session.getMode()));

    if (!input.trim()) continue;

    // Append to input history (both commands and messages)
    await appendToHistory(input);

    // Check for command
    if (isCommand(input)) {
      const result = await handleCommand(input, ctx);

      switch (result.type) {
        case 'continue':
          break;

        case 'quit':
          if (result.generateName) {
            await generateSessionName(ctx);
          }
          rl.close();
          return;

        case 'send':
          await sendAndStream(result.message, ctx, isCancelled, resetCancelled);
          break;

        case 'update-history':
          ctx.history = result.state;
          ctx.saveHistory();
          break;

        case 'switch-session':
          ctx.history = switchSession(ctx.history, result.sessionId);
          ctx.saveHistory();
          console.log('Switched session.');
          break;

        case 'new-session':
          ctx.history = createSession(ctx.history);
          ctx.saveHistory();
          console.log('Created new session.');
          break;
      }
    } else {
      // Regular message
      await sendAndStream(input, ctx, isCancelled, resetCancelled);
    }
  }
}

// =============================================================================
// Send and Stream
// =============================================================================

async function sendAndStream(
  message: string,
  ctx: CommandContext,
  isCancelled: () => boolean,
  resetCancelled: () => void
): Promise<void> {
  // Add user message to history (readline already echoed the input)
  ctx.history = addMessage(ctx.history, {
    role: 'user',
    content: message,
    timestamp: Date.now(),
  });
  ctx.saveHistory();

  // Add blank line after user input
  console.log();

  // Set up streaming output
  let fullContent = '';
  const toolCalls: ToolCall[] = [];

  // Track if we've started writing output
  let hasOutput = false;
  // Track if we just finished a tool call (need newline before next text)
  let afterToolCall = false;

  // Start spinner while waiting for first response
  const spinner = createSpinner();
  spinner.start();

  const textHandler = (text: string) => {
    if (!hasOutput) {
      // Stop spinner and print prefix once at start
      spinner.stop();
      process.stdout.write('\x1b[36m\x1b[1mPlanner:\x1b[0m ');
      hasOutput = true;
    } else if (afterToolCall) {
      // Add newline after tool call before resuming text
      process.stdout.write('\n\x1b[36m\x1b[1mPlanner:\x1b[0m ');
      afterToolCall = false;
    }
    process.stdout.write(text);
    fullContent += text;
  };

  const toolCallHandler = (tc: ToolCall) => {
    toolCalls.push(tc);
    
    // Stop spinner if still running
    spinner.stop();
    
    // Add newline before tool call if text was streaming
    if (hasOutput) {
      console.log();
    } else {
      hasOutput = true;
    }
    
    // Display tool call indicator
    console.log(formatToolCall(tc.name, tc.args));
    
    // Mark that we're after a tool call
    afterToolCall = true;
  };

  ctx.session.on('text', textHandler);
  ctx.session.on('toolCall', toolCallHandler);

  // Wait for completion
  try {
    await new Promise<void>((resolve, reject) => {
      ctx.session.once('done', () => resolve());
      ctx.session.once('error', (err) => reject(err));

      // Send message
      const messages = getCurrentSession(ctx.history)?.messages ?? [];
      ctx.session.sendMessage(message, messages).catch(reject);
    });

    // Check if cancelled
    if (isCancelled()) {
      // Handle cancellation output
      // First, clear the ^C that the terminal echoed by moving to start of line and clearing
      if (hasOutput) {
        // Streaming had started - the ^C appears after the text
        // Move cursor back 2 chars (^C) and clear to end of line, then append [Cancelled]
        process.stdout.write('\x1b[2D\x1b[K \x1b[33m[Cancelled]\x1b[0m\n\n');
      } else {
        // Still on spinner - spinner.stop() clears the line with \r\x1b[K
        // The ^C appears after "Thinking...", so we clear and rewrite
        spinner.stop();
        process.stdout.write('\x1b[33m[Cancelled]\x1b[0m\n\n');
      }
      // Don't save cancelled response to history
      return;
    }

    // Stop spinner if still running (no output case)
    spinner.stop();

    // Add newlines after streaming
    if (hasOutput) {
      console.log();
      console.log();
    }

    // Add assistant message to history
    ctx.history = addMessage(ctx.history, {
      role: 'assistant',
      content: fullContent,
      timestamp: Date.now(),
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    });
    ctx.saveHistory();
  } catch (err) {
    // Check if this was a cancellation
    if (isCancelled()) {
      // Handle cancellation output
      // First, clear the ^C that the terminal echoed
      if (hasOutput) {
        // Streaming had started - the ^C appears after the text
        // Move cursor back 2 chars (^C) and clear to end of line, then append [Cancelled]
        process.stdout.write('\x1b[2D\x1b[K \x1b[33m[Cancelled]\x1b[0m\n\n');
      } else {
        // Still on spinner - spinner.stop() clears the line with \r\x1b[K
        spinner.stop();
        process.stdout.write('\x1b[33m[Cancelled]\x1b[0m\n\n');
      }
      // Don't save cancelled response to history
      return;
    }

    // Stop spinner
    spinner.stop();

    // Add newline if we had partial output
    if (hasOutput) {
      console.log();
    }

    const errMessage = err instanceof Error ? err.message : String(err);
    console.log(formatError(errMessage));
    console.log();
  } finally {
    // Remove listeners for next message
    ctx.session.removeListener('text', textHandler);
    ctx.session.removeListener('toolCall', toolCallHandler);
    // Reset cancelled state for next message
    resetCancelled();
  }
}

// =============================================================================
// Signal Handlers
// =============================================================================

function setupSignalHandlers(
  ctx: CommandContext,
  rl: readline.Interface,
  markCancelled: () => void
): void {
  let isExiting = false;

  const cleanup = async () => {
    if (isExiting) return;
    isExiting = true;

    console.log();

    // Generate session name before exit
    await generateSessionName(ctx);

    // Stop daemon if running
    if (ctx.talos) {
      console.log('Stopping daemon...');
      await ctx.talos.stop();
    }

    rl.close();
    process.exit(0);
  };

  // Handle Ctrl+C - cancels stream, multi-line input, or exits
  process.on('SIGINT', () => {
    if (ctx.session.isStreaming()) {
      // Mark as cancelled - sendAndStream will handle the output
      markCancelled();
      ctx.session.cancel();
      // Don't print anything here - let sendAndStream handle it cleanly
    } else if (isMultilineMode()) {
      cancelMultiline();
      // Re-prompt will happen in the main loop
    } else {
      cleanup();
    }
  });

  process.on('SIGTERM', cleanup);

  // Handle readline close (Ctrl+D)
  rl.on('close', () => {
    if (!isExiting) {
      cleanup();
    }
  });
}

// =============================================================================
// Session Name Generation
// =============================================================================

async function generateSessionName(ctx: CommandContext): Promise<void> {
  const currentSession = getCurrentSession(ctx.history);
  if (!currentSession) return;

  // Only generate if using default name
  if (!currentSession.name.startsWith('Session ')) return;

  // Need at least a few messages
  if (currentSession.messages.length < 2) return;

  console.log('Generating session name...');

  try {
    const name = await generateSessionNameWithAI(currentSession.messages);
    if (name) {
      ctx.history = renameSession(ctx.history, currentSession.id, name);
      ctx.saveHistory();
      console.log(`Session named: ${name}`);
    }
  } catch {
    // Silently fail - not critical
  }
}

// =============================================================================
// Utilities
// =============================================================================

/** Tracks whether we're currently in multi-line input mode */
let isInMultilineInput = false;

/** Callback to cancel multi-line input on Ctrl+C */
let cancelMultilineInput: (() => void) | null = null;

/**
 * Check if currently in multi-line input mode.
 * Used by signal handlers to determine Ctrl+C behavior.
 */
export function isMultilineMode(): boolean {
  return isInMultilineInput;
}

/**
 * Cancel multi-line input and return to normal prompt.
 * Called by signal handlers on Ctrl+C during multi-line input.
 */
export function cancelMultiline(): void {
  if (cancelMultilineInput) {
    cancelMultilineInput();
  }
}

/**
 * Prompt for input with multi-line support via backslash continuation.
 * A line ending with `\` continues to the next line.
 * Ctrl+C during multi-line input cancels and returns empty string.
 */
async function question(rl: readline.Interface, prompt: string): Promise<string> {
  let accumulated: string[] = [];
  let currentPrompt = prompt;
  let cancelled = false;

  // Set up cancellation handler
  cancelMultilineInput = () => {
    cancelled = true;
    // Clear the current line and show cancellation message
    process.stdout.write('\n[Multi-line input cancelled]\n');
  };

  try {
    while (true) {
      // Update multi-line state
      isInMultilineInput = accumulated.length > 0;

      const line = await new Promise<string>((resolve) => {
        rl.question(currentPrompt, resolve);
      });

      // Check if cancelled during input
      if (cancelled) {
        return '';
      }

      const result = processInputLine(line, accumulated);

      if (result.complete) {
        return result.message!;
      }

      // Continue accumulating
      accumulated = result.accumulated!;
      currentPrompt = formatContinuationPrompt();
    }
  } finally {
    // Reset state
    isInMultilineInput = false;
    cancelMultilineInput = null;
  }
}
