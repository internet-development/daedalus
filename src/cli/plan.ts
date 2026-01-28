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
  formatError,
  formatSessionList,
} from './output.js';
import { selectSession } from './session-selector.js';
import { handleCommand, isCommand, type CommandContext } from './commands.js';

// =============================================================================
// Types
// =============================================================================

export interface PlanOptions {
  mode?: PlanMode;
  prompt?: string;
  new?: boolean;
  list?: boolean;
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

  // 8. Create readline interface
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
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

  // 11. Set up signal handlers
  setupSignalHandlers(ctx, rl);

  // 12. Print header
  console.log();
  console.log(formatHeader(session.getMode(), ctx.talos ? 'running' : 'stopped'));
  console.log();

  // 13. Main loop
  await mainLoop(rl, ctx, initialPrompt);
}

// =============================================================================
// Main Loop
// =============================================================================

async function mainLoop(
  rl: readline.Interface,
  ctx: CommandContext,
  initialPrompt: string | null
): Promise<void> {
  // Send initial prompt if provided
  if (initialPrompt) {
    await sendAndStream(initialPrompt, ctx);
  }

  // Interactive loop
  while (true) {
    const input = await question(rl, formatPrompt());

    if (!input.trim()) continue;

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
          await sendAndStream(result.message, ctx);
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
      await sendAndStream(input, ctx);
    }
  }
}

// =============================================================================
// Send and Stream
// =============================================================================

async function sendAndStream(message: string, ctx: CommandContext): Promise<void> {
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

  // Start spinner while waiting for first response
  const spinner = createSpinner();
  spinner.start();

  const textHandler = (text: string) => {
    if (!hasOutput) {
      // Stop spinner and print prefix once at start
      spinner.stop();
      process.stdout.write('\x1b[36m\x1b[1mPlanner:\x1b[0m ');
      hasOutput = true;
    }
    process.stdout.write(text);
    fullContent += text;
  };

  const toolCallHandler = (tc: ToolCall) => {
    toolCalls.push(tc);
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
  }
}

// =============================================================================
// Signal Handlers
// =============================================================================

function setupSignalHandlers(ctx: CommandContext, rl: readline.Interface): void {
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

  // Handle Ctrl+C - first cancels stream, second exits
  process.on('SIGINT', () => {
    if (ctx.session.isStreaming()) {
      ctx.session.cancel();
      console.log('\n[Cancelled]');
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
    const name = await generateNameWithAI(currentSession.messages, ctx);
    if (name) {
      ctx.history = renameSession(ctx.history, currentSession.id, name);
      ctx.saveHistory();
      console.log(`Session named: ${name}`);
    }
  } catch {
    // Silently fail - not critical
  }
}

async function generateNameWithAI(
  messages: ChatMessage[],
  ctx: CommandContext
): Promise<string | null> {
  // Create a summary of the conversation for naming
  const userMessages = messages
    .filter((m) => m.role === 'user')
    .slice(0, 3)
    .map((m) => m.content.slice(0, 100))
    .join('\n');

  if (!userMessages.trim()) return null;

  // Use a quick one-shot call to generate a name
  // For simplicity, we'll generate a basic name from the first user message
  // A full implementation would use the AI, but that's complex for exit cleanup
  const firstMessage = messages.find((m) => m.role === 'user')?.content ?? '';
  const words = firstMessage.split(/\s+/).slice(0, 5);
  
  if (words.length === 0) return null;

  // Simple heuristic: capitalize first letter of each word
  return words
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
    .slice(0, 30);
}

// =============================================================================
// Utilities
// =============================================================================

function question(rl: readline.Interface, prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      resolve(answer);
    });
  });
}
