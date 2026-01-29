/**
 * OpenCode Provider
 *
 * Implements planning agent functionality using the `opencode` CLI
 * instead of direct API calls. This allows users with OpenCode
 * to use the planning agent with OpenCode's native tools and model routing.
 *
 * The provider spawns `opencode run --format json -m <model>`
 * and uses OpenCode's native tools (Read, Glob, Grep, Bash) for
 * codebase access. For beans operations, it instructs the agent to
 * use the `beans` CLI directly via Bash.
 *
 * Debug logging: Set DEBUG=opencode-provider or DEBUG=* to enable
 */
import { spawn, type ChildProcess, execSync } from 'child_process';
import { EventEmitter } from 'events';
import { appendFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import type { PlanMode } from './planning-session.js';
import type { Bean } from '../talos/beans-client.js';
import { getPlanningAgentSystemPrompt } from './system-prompts.js';

// =============================================================================
// Debug Logging
// =============================================================================

const DEBUG_NAMESPACE = 'opencode-provider';

/**
 * Check if debug logging is enabled
 */
function isDebugEnabled(): boolean {
  const debugEnv = process.env.DEBUG ?? '';
  if (!debugEnv) return false;
  if (debugEnv === '*') return true;
  return debugEnv.split(',').some((ns) => ns.trim() === DEBUG_NAMESPACE || ns.trim() === 'planning');
}

/**
 * Get the debug log file path
 */
function getDebugLogPath(): string {
  const talosDir = join(process.cwd(), '.talos');
  if (!existsSync(talosDir)) {
    mkdirSync(talosDir, { recursive: true });
  }
  return join(talosDir, 'planning-agent.log');
}

/**
 * Log a debug message to .talos/planning-agent.log
 */
function debug(category: string, message: string, data?: unknown): void {
  if (!isDebugEnabled()) return;

  const timestamp = new Date().toISOString();
  let logLine = `[${timestamp}] [${category}] ${message}`;

  if (data !== undefined) {
    try {
      const dataStr = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
      // Truncate very long data
      const truncated = dataStr.length > 2000 ? dataStr.slice(0, 2000) + '... (truncated)' : dataStr;
      logLine += `\n${truncated}`;
    } catch {
      logLine += `\n[unable to stringify data]`;
    }
  }

  logLine += '\n';

  try {
    appendFileSync(getDebugLogPath(), logLine);
  } catch {
    // Silently ignore logging errors
  }
}

// =============================================================================
// Types
// =============================================================================

/**
 * Events emitted by the OpenCode provider during streaming
 */
export interface OpenCodeProviderEvents {
  /** Raw text content from the assistant */
  text: (content: string) => void;
  /** Tool call was made */
  toolCall: (call: { name: string; args: Record<string, unknown> }) => void;
  /** Streaming completed */
  done: (fullContent: string) => void;
  /** Error occurred */
  error: (error: Error) => void;
}

/**
 * A single event from the OpenCode JSON output
 */
interface OpenCodeStreamEvent {
  type: 'text' | 'tool_use' | 'step_finish';
  part: {
    text?: string;
    tool?: string;
    state?: {
      status: string;
      input?: Record<string, unknown>;
      output?: string;
    };
    reason?: 'stop' | 'tool-calls';
  };
}

/**
 * Options for creating an OpenCode provider
 */
export interface OpenCodeProviderOptions {
  /** Current planning mode */
  mode: PlanMode;
  /** Optional selected bean for context */
  selectedBean?: Bean | null;
  /** Abort signal for cancellation */
  abortSignal?: AbortSignal;
  /** Model to use (defaults to anthropic/claude-sonnet-4-20250514) */
  model?: string;
}

// =============================================================================
// CLI Validation
// =============================================================================

/**
 * Check if the `opencode` CLI is available
 */
export function isOpenCodeAvailable(): boolean {
  try {
    execSync('which opencode', { encoding: 'utf-8', stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the version of the installed opencode CLI
 */
export function getOpenCodeVersion(): string | null {
  try {
    const result = execSync('opencode --version', { encoding: 'utf-8', stdio: 'pipe' });
    return result.trim();
  } catch {
    return null;
  }
}

// =============================================================================
// Beans Instructions for System Prompt
// =============================================================================

/**
 * Instructions to append to the system prompt for beans operations.
 * Since we're using OpenCode's native tools, beans operations
 * must be done via the Bash tool.
 */
const BEANS_INSTRUCTIONS = `
## Beans Operations via Bash

You have access to the \`beans\` CLI for managing issues/tasks. Use the Bash tool to run these commands:

### Query beans
\`\`\`bash
beans query '{ beans { id title status type } }'
beans query '{ bean(id: "beans-abc") { title body } }'
\`\`\`

### Create beans
\`\`\`bash
beans create "Title" -t <type> -d "Description" -s draft
# Types: milestone, epic, feature, bug, task
# Statuses: draft, todo, in-progress, completed, scrapped
\`\`\`

### Update beans
\`\`\`bash
beans update <bean-id> --status <status>
beans update <bean-id> --body "New body content"
beans update <bean-id> --parent <parent-id>
beans update <bean-id> --blocking <other-id>
\`\`\`

### Relationship management
\`\`\`bash
beans update <bean-id> --parent <parent-id>    # Set parent
beans update <bean-id> --remove-parent         # Remove parent
beans update <bean-id> --blocking <other-id>   # Add blocking
beans update <bean-id> --remove-blocking <id>  # Remove blocking
\`\`\`

Always use the beans CLI for issue tracking operations.
`;

// =============================================================================
// Stream Parser
// =============================================================================

/**
 * Parse a line of JSON output from the opencode CLI
 */
function parseStreamEvent(line: string): OpenCodeStreamEvent | null {
  if (!line.trim()) return null;
  
  try {
    return JSON.parse(line) as OpenCodeStreamEvent;
  } catch {
    // Not valid JSON, skip
    return null;
  }
}

// =============================================================================
// Provider Class
// =============================================================================

/**
 * OpenCode Provider - streams responses from opencode CLI
 *
 * @example
 * ```typescript
 * const provider = new OpenCodeProvider({
 *   mode: 'brainstorm',
 *   selectedBean: null,
 * });
 *
 * provider.on('text', (content) => console.log(content));
 * provider.on('done', (fullContent) => console.log('Done:', fullContent));
 *
 * await provider.send('Help me plan a new feature', chatHistory);
 * ```
 */
export class OpenCodeProvider extends EventEmitter {
  private mode: PlanMode;
  private selectedBean: Bean | null;
  private abortSignal?: AbortSignal;
  private model: string;
  private process: ChildProcess | null = null;
  private fullContent = '';

  constructor(options: OpenCodeProviderOptions) {
    super();
    this.mode = options.mode;
    this.selectedBean = options.selectedBean ?? null;
    this.abortSignal = options.abortSignal;
    this.model = options.model ?? 'anthropic/claude-sonnet-4-20250514';
  }

  /**
   * Send a message to the planning agent and stream the response
   */
  async send(
    message: string,
    history: Array<{ role: string; content: string }>
  ): Promise<void> {
    debug('send', 'Starting send()', { mode: this.mode, messageLength: message.length, historyLength: history.length });

    // Build the full prompt with history
    const systemPrompt = getPlanningAgentSystemPrompt(this.mode, this.selectedBean);
    const fullSystemPrompt = systemPrompt + BEANS_INSTRUCTIONS;
    debug('send', 'Built system prompt', { systemPromptLength: fullSystemPrompt.length });

    // Build conversation history as text
    let conversationContext = '';
    for (const msg of history) {
      if (msg.role === 'user') {
        conversationContext += `\nUser: ${msg.content}\n`;
      } else if (msg.role === 'assistant') {
        conversationContext += `\nAssistant: ${msg.content}\n`;
      }
    }

    // Inject system prompt as prefix (OpenCode doesn't have --append-system-prompt)
    const systemPromptPrefix = `<system>\n${fullSystemPrompt}\n</system>\n\n`;
    
    // Add the current message
    const fullPrompt = conversationContext
      ? `${systemPromptPrefix}${conversationContext}\nUser: ${message}`
      : `${systemPromptPrefix}${message}`;
    debug('send', 'Built full prompt', { promptLength: fullPrompt.length, prompt: fullPrompt.slice(0, 500) });

    // Build CLI arguments
    const args = [
      'run',
      '--format', 'json',
      '-m', this.model,
      fullPrompt,
    ];
    debug('spawn', 'CLI arguments', { argsCount: args.length, model: this.model });

    // Spawn the process
    return new Promise((resolve, reject) => {
      debug('spawn', 'Spawning opencode process', { cwd: process.cwd() });

      this.process = spawn('opencode', args, {
        cwd: process.cwd(),
        stdio: ['ignore', 'pipe', 'pipe'],
        env: {
          ...process.env,
          FORCE_COLOR: '0', // Disable colors for clean parsing
        },
      });

      debug('spawn', 'Process spawned', { pid: this.process.pid });

      // Handle abort signal
      if (this.abortSignal) {
        this.abortSignal.addEventListener('abort', () => {
          this.cancel();
        });
      }

      let buffer = '';
      this.fullContent = '';
      let eventCount = 0;
      let stdoutChunks = 0;
      let doneEmitted = false;

      // Handle stdout (JSON events)
      this.process.stdout?.on('data', (data: Buffer) => {
        stdoutChunks++;
        const chunk = data.toString();
        debug('stdout', `Received chunk #${stdoutChunks}`, { length: chunk.length, preview: chunk.slice(0, 200) });

        buffer += chunk;

        // Process complete lines
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? ''; // Keep incomplete line in buffer

        for (const line of lines) {
          const event = parseStreamEvent(line);
          if (!event) {
            if (line.trim()) {
              debug('parse', 'Failed to parse line', line.slice(0, 200));
            }
            continue;
          }

          eventCount++;
          debug('event', `Event #${eventCount}: ${event.type}`, {
            type: event.type,
            hasPart: !!event.part,
          });

          // Handle text events
          if (event.type === 'text' && event.part.text) {
            const text = event.part.text;
            debug('text', 'Received text', { textLength: text.length, preview: text.slice(0, 50) });
            this.fullContent += text;
            this.emit('text', text);
          }

          // Handle tool use events
          if (event.type === 'tool_use' && event.part.tool && event.part.state) {
            const toolName = event.part.tool;
            const toolArgs = event.part.state.input ?? {};
            debug('tool', `Tool call: ${toolName}`, toolArgs);
            this.emit('toolCall', { name: toolName, args: toolArgs });
          }

          // Handle step finish with reason 'stop'
          if (event.type === 'step_finish' && event.part.reason === 'stop' && !doneEmitted) {
            debug('result', 'Received step_finish with stop', { fullContentLength: this.fullContent.length });
            doneEmitted = true;
            this.emit('done', this.fullContent);
          }
        }
      });

      // Handle stderr (usually empty or errors)
      this.process.stderr?.on('data', (data: Buffer) => {
        const text = data.toString();
        debug('stderr', 'Received stderr', text);
        // Only emit errors for actual errors, not warnings
        if (text.includes('Error:') || text.includes('error:')) {
          debug('error', 'Emitting error from stderr', text);
          this.emit('error', new Error(text));
        }
      });

      // Handle process exit
      this.process.on('close', (code) => {
        debug('close', 'Process closed', { code, fullContentLength: this.fullContent.length, eventCount, stdoutChunks });
        this.process = null;

        // Process any remaining buffer
        if (buffer.trim()) {
          debug('close', 'Processing remaining buffer', { bufferLength: buffer.length });
          const event = parseStreamEvent(buffer);
          if (event?.type === 'text' && event.part.text) {
            this.fullContent += event.part.text;
            this.emit('text', event.part.text);
          }
        }

        if (code !== 0 && code !== null) {
          const error = new Error(`opencode process exited with code ${code}`);
          debug('error', 'Process exited with non-zero code', { code });
          this.emit('error', error);
          reject(error);
        } else {
          // Ensure done is emitted even if no step_finish event (but only once)
          if (this.fullContent && !doneEmitted) {
            debug('done', 'Emitting done (from close handler)', { fullContentLength: this.fullContent.length });
            doneEmitted = true;
            this.emit('done', this.fullContent);
          } else if (!this.fullContent) {
            debug('warn', 'Process completed but no content was extracted', { eventCount, stdoutChunks });
          }
          resolve();
        }
      });

      // Handle spawn errors
      this.process.on('error', (error: Error) => {
        debug('error', 'Spawn error', { message: error.message, name: error.name });
        this.process = null;
        this.emit('error', error);
        reject(error);
      });
    });
  }

  /**
   * Cancel the current stream
   */
  cancel(): void {
    if (this.process && !this.process.killed) {
      this.process.kill('SIGTERM');
      // Force kill after grace period
      setTimeout(() => {
        if (this.process && !this.process.killed) {
          this.process.kill('SIGKILL');
        }
      }, 3000);
    }
  }

  /**
   * Check if currently streaming
   */
  isActive(): boolean {
    return this.process !== null;
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create an OpenCode provider for the planning agent
 *
 * @example
 * ```typescript
 * const provider = createOpenCodeProvider({
 *   mode: 'new',
 *   selectedBean: null,
 * });
 *
 * let fullText = '';
 * provider.on('text', (text) => {
 *   fullText += text;
 *   process.stdout.write(text);
 * });
 *
 * await provider.send('Help me plan a new feature', []);
 * ```
 */
export function createOpenCodeProvider(
  options: OpenCodeProviderOptions
): OpenCodeProvider {
  return new OpenCodeProvider(options);
}

export default OpenCodeProvider;
