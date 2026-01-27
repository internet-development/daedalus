/**
 * Claude Code Provider
 *
 * Implements planning agent functionality using the `claude` CLI
 * instead of direct API calls. This allows users with Claude Code
 * subscriptions to use the planning agent without an API key.
 *
 * The provider spawns `claude --print --output-format stream-json --verbose`
 * and uses Claude Code's native tools (Read, Glob, Grep, Bash) for
 * codebase access. For beans operations, it instructs the agent to
 * use the `beans` CLI directly via Bash.
 *
 * Debug logging: Set DEBUG=claude-code-provider or DEBUG=* to enable
 */
import { spawn, type ChildProcess, execSync } from 'child_process';
import { EventEmitter } from 'events';
import { appendFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import type { PlanMode } from '../ui/views/PlanView.js';
import type { Bean } from '../talos/beans-client.js';
import { getPlanningAgentSystemPrompt } from './system-prompts.js';

// =============================================================================
// Debug Logging
// =============================================================================

const DEBUG_NAMESPACE = 'claude-code-provider';

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
 * Events emitted by the Claude Code provider during streaming
 */
export interface ClaudeCodeProviderEvents {
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
 * A single event from the Claude CLI stream-json output
 */
interface ClaudeStreamEvent {
  type: 'system' | 'assistant' | 'result' | 'user';
  subtype?: string;
  message?: {
    content?: Array<{ type: string; text?: string; name?: string; input?: unknown }>;
    role?: string;
    model?: string;
  };
  result?: string;
  session_id?: string;
}

/**
 * Options for creating a Claude Code provider
 */
export interface ClaudeCodeProviderOptions {
  /** Current planning mode */
  mode: PlanMode;
  /** Optional selected bean for context */
  selectedBean?: Bean | null;
  /** Abort signal for cancellation */
  abortSignal?: AbortSignal;
}

// =============================================================================
// CLI Validation
// =============================================================================

/**
 * Check if the `claude` CLI is available
 */
export function isClaudeCliAvailable(): boolean {
  try {
    execSync('which claude', { encoding: 'utf-8', stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the version of the installed claude CLI
 */
export function getClaudeCliVersion(): string | null {
  try {
    const result = execSync('claude --version', { encoding: 'utf-8', stdio: 'pipe' });
    return result.trim();
  } catch {
    return null;
  }
}

// =============================================================================
// Provider Validation
// =============================================================================

/**
 * Validation result for planning agent providers
 */
export interface ProviderValidationResult {
  valid: boolean;
  error?: string;
  hint?: string;
}

/**
 * Validate that the configured provider is usable.
 * 
 * - For 'claude_code': Check that `claude` CLI is installed
 * - For 'anthropic'/'claude': Check for ANTHROPIC_API_KEY
 * - For 'openai': Check for OPENAI_API_KEY
 * 
 * @param provider - The provider name from config
 * @returns Validation result with error and hint if invalid
 */
export function validateProvider(provider: string): ProviderValidationResult {
  const normalizedProvider = provider.toLowerCase();

  switch (normalizedProvider) {
    case 'claude_code': {
      if (!isClaudeCliAvailable()) {
        return {
          valid: false,
          error: 'Claude CLI not found',
          hint: 'Install Claude Code from https://claude.ai/download or change provider to "claude" with an API key',
        };
      }
      return { valid: true };
    }

    case 'anthropic':
    case 'claude': {
      if (!process.env.ANTHROPIC_API_KEY) {
        return {
          valid: false,
          error: 'ANTHROPIC_API_KEY not set',
          hint: 'Set ANTHROPIC_API_KEY environment variable or use provider "claude_code" with Claude Code subscription',
        };
      }
      return { valid: true };
    }

    case 'openai': {
      if (!process.env.OPENAI_API_KEY) {
        return {
          valid: false,
          error: 'OPENAI_API_KEY not set',
          hint: 'Set OPENAI_API_KEY environment variable',
        };
      }
      return { valid: true };
    }

    default:
      return {
        valid: false,
        error: `Unknown provider: ${provider}`,
        hint: 'Valid providers: claude, anthropic, openai, claude_code',
      };
  }
}

// =============================================================================
// Beans Instructions for System Prompt
// =============================================================================

/**
 * Instructions to append to the system prompt for beans operations.
 * Since we're using Claude Code's native tools, beans operations
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
 * Parse a line of stream-json output from the claude CLI
 */
function parseStreamEvent(line: string): ClaudeStreamEvent | null {
  if (!line.trim()) return null;
  
  try {
    return JSON.parse(line) as ClaudeStreamEvent;
  } catch {
    // Not valid JSON, skip
    return null;
  }
}

/**
 * Extract text content from an assistant message event
 */
function extractTextContent(event: ClaudeStreamEvent): string {
  if (event.type !== 'assistant' || !event.message?.content) {
    return '';
  }

  let text = '';
  for (const block of event.message.content) {
    if (block.type === 'text' && block.text) {
      text += block.text;
    }
  }
  return text;
}

/**
 * Extract tool calls from an assistant message event
 */
function extractToolCalls(
  event: ClaudeStreamEvent
): Array<{ name: string; args: Record<string, unknown> }> {
  if (event.type !== 'assistant' || !event.message?.content) {
    return [];
  }

  const toolCalls: Array<{ name: string; args: Record<string, unknown> }> = [];
  for (const block of event.message.content) {
    if (block.type === 'tool_use' && block.name) {
      toolCalls.push({
        name: block.name,
        args: (block.input as Record<string, unknown>) ?? {},
      });
    }
  }
  return toolCalls;
}

// =============================================================================
// Provider Class
// =============================================================================

/**
 * Claude Code Provider - streams responses from claude CLI
 *
 * @example
 * ```typescript
 * const provider = new ClaudeCodeProvider({
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
export class ClaudeCodeProvider extends EventEmitter {
  private mode: PlanMode;
  private selectedBean: Bean | null;
  private abortSignal?: AbortSignal;
  private process: ChildProcess | null = null;
  private fullContent = '';

  constructor(options: ClaudeCodeProviderOptions) {
    super();
    this.mode = options.mode;
    this.selectedBean = options.selectedBean ?? null;
    this.abortSignal = options.abortSignal;
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

    // Add the current message
    const fullPrompt = conversationContext
      ? `${conversationContext}\nUser: ${message}`
      : message;
    debug('send', 'Built full prompt', { promptLength: fullPrompt.length, prompt: fullPrompt.slice(0, 500) });

    // Build CLI arguments
    const args = [
      '--print',
      '--output-format', 'stream-json',
      '--verbose',
      '--append-system-prompt', fullSystemPrompt,
      '--allowedTools', 'Read,Glob,Grep,Bash',
      fullPrompt,
    ];
    debug('spawn', 'CLI arguments', { argsCount: args.length, args: args.map((a, i) => i === 5 ? '[system-prompt]' : a) });

    // Spawn the process
    return new Promise((resolve, reject) => {
      debug('spawn', 'Spawning claude process', { cwd: process.cwd() });

      this.process = spawn('claude', args, {
        cwd: process.cwd(),
        stdio: ['pipe', 'pipe', 'pipe'],
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

      // Handle stdout (stream-json events)
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
          debug('event', `Event #${eventCount}: ${event.type}${event.subtype ? '/' + event.subtype : ''}`, {
            type: event.type,
            subtype: event.subtype,
            hasMessage: !!event.message,
            hasResult: !!event.result,
          });

          // Handle assistant text
          if (event.type === 'assistant') {
            const text = extractTextContent(event);
            if (text) {
              debug('text', 'Extracted text from assistant message', { textLength: text.length, preview: text.slice(0, 100) });
              this.fullContent += text;
              this.emit('text', text);
            }

            // Handle tool calls
            const toolCalls = extractToolCalls(event);
            for (const tc of toolCalls) {
              debug('tool', `Tool call: ${tc.name}`, tc.args);
              this.emit('toolCall', tc);
            }
          }

          // Handle final result
          if (event.type === 'result') {
            debug('result', 'Received result event', { fullContentLength: this.fullContent.length });
            // Result event means we're done
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
          if (event?.type === 'assistant') {
            const text = extractTextContent(event);
            if (text) {
              this.fullContent += text;
              this.emit('text', text);
            }
          }
        }

        if (code !== 0 && code !== null) {
          const error = new Error(`claude process exited with code ${code}`);
          debug('error', 'Process exited with non-zero code', { code });
          this.emit('error', error);
          reject(error);
        } else {
          // Ensure done is emitted even if no result event
          if (this.fullContent) {
            debug('done', 'Emitting done (from close handler)', { fullContentLength: this.fullContent.length });
            this.emit('done', this.fullContent);
          } else {
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
 * Create a Claude Code provider for the planning agent
 *
 * @example
 * ```typescript
 * const provider = createClaudeCodeProvider({
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
export function createClaudeCodeProvider(
  options: ClaudeCodeProviderOptions
): ClaudeCodeProvider {
  return new ClaudeCodeProvider(options);
}

export default ClaudeCodeProvider;
