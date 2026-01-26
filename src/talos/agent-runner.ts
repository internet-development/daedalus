/**
 * Agent Runner
 *
 * Spawns and manages coding agents (opencode, claude, codex) with bean context
 * and manages their lifecycle.
 *
 * Features:
 * - Configurable backend (opencode, claude, codex)
 * - Prompt generation from bean body
 * - stdout/stderr streaming with timestamps via EventEmitter
 * - Cancellation support (SIGTERM → SIGKILL after grace period)
 * - Running time tracking
 * - No timeout (agents can run for hours)
 */
import { spawn, type ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import type { Bean } from './beans-client.js';

// =============================================================================
// Types
// =============================================================================

export interface AgentConfig {
  backend: 'opencode' | 'claude' | 'codex';
  opencode?: { model?: string };
  claude?: { model?: string; dangerously_skip_permissions?: boolean };
  codex?: { model?: string };
}

export interface OutputEvent {
  beanId: string;
  stream: 'stdout' | 'stderr';
  data: string;
  timestamp: number;
}

export interface ExitResult {
  code: number;
  signal?: string;
  duration: number; // ms
}

export interface AgentRunnerEvents {
  started: (bean: Bean) => void;
  output: (event: OutputEvent) => void;
  exit: (result: ExitResult) => void;
  error: (error: Error) => void;
}

// =============================================================================
// Prompt Generation
// =============================================================================

/**
 * Generate the prompt to send to the coding agent.
 * Includes full bean body with instructions for working on it.
 */
export function generatePrompt(bean: Bean): string {
  return `Implement the following task:

## ${bean.id}: ${bean.title}

${bean.body}

---

Instructions:
1. Read and understand the task above
2. Implement each checklist item in order
3. Update the bean's checklist as you complete items:
   \`beans update ${bean.id} --body "..."\`
4. If you encounter a blocker you cannot resolve:
   - Add the blocked tag: \`beans update ${bean.id} --tag blocked\`
   - Create a blocker bean: \`beans create "Blocker: ..." -t bug --blocking ${bean.id} -d "Description of why blocked"\`
   - Exit cleanly with code 0
5. When complete, exit with code 0`;
}

// =============================================================================
// Agent Runner Class
// =============================================================================

/** Grace period before SIGKILL after SIGTERM (ms) */
const KILL_GRACE_PERIOD = 5000;

export class AgentRunner extends EventEmitter {
  private config: AgentConfig;
  private process: ChildProcess | null = null;
  private runningBean: Bean | null = null;
  private startedAt: number | null = null;
  private killTimer: NodeJS.Timeout | null = null;

  constructor(config: AgentConfig) {
    super();
    this.config = config;
  }

  // ===========================================================================
  // Execution
  // ===========================================================================

  /**
   * Run an agent for a bean.
   * @param bean The bean to work on
   * @param worktreePath Optional working directory (for parallel execution)
   */
  run(bean: Bean, worktreePath?: string): void {
    if (this.process) {
      this.emit(
        'error',
        new Error(`Agent already running for bean ${this.runningBean?.id}`)
      );
      return;
    }

    const prompt = generatePrompt(bean);
    const { command, args } = this.buildCommand(prompt);
    const cwd = worktreePath ?? process.cwd();

    try {
      this.process = spawn(command, args, {
        cwd,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          FORCE_COLOR: '1',
        },
      });
    } catch (error) {
      this.emit(
        'error',
        error instanceof Error ? error : new Error(String(error))
      );
      return;
    }

    this.runningBean = bean;
    this.startedAt = Date.now();

    // Handle stdout
    this.process.stdout?.on('data', (data: Buffer) => {
      const event: OutputEvent = {
        beanId: bean.id,
        stream: 'stdout',
        data: data.toString(),
        timestamp: Date.now(),
      };
      this.emit('output', event);
    });

    // Handle stderr
    this.process.stderr?.on('data', (data: Buffer) => {
      const event: OutputEvent = {
        beanId: bean.id,
        stream: 'stderr',
        data: data.toString(),
        timestamp: Date.now(),
      };
      this.emit('output', event);
    });

    // Handle process exit
    this.process.on('close', (code, signal) => {
      this.clearKillTimer();
      const duration = this.startedAt ? Date.now() - this.startedAt : 0;

      const result: ExitResult = {
        code: code ?? -1,
        duration,
      };

      if (signal) {
        result.signal = signal;
      }

      this.cleanup();
      this.emit('exit', result);
    });

    // Handle spawn errors
    this.process.on('error', (error: Error) => {
      this.clearKillTimer();
      this.cleanup();
      this.emit('error', error);
    });

    // Emit started event
    this.emit('started', bean);
  }

  /**
   * Cancel the running agent.
   * Sends SIGTERM first, then SIGKILL after grace period.
   */
  async cancel(): Promise<void> {
    if (!this.process || !this.process.pid) {
      return;
    }

    return new Promise<void>((resolve) => {
      // Send SIGTERM
      this.process!.kill('SIGTERM');

      // Set up SIGKILL after grace period
      this.killTimer = setTimeout(() => {
        if (this.process && this.process.pid) {
          this.process.kill('SIGKILL');
        }
      }, KILL_GRACE_PERIOD);

      // Wait for process to exit
      this.process!.on('close', () => {
        this.clearKillTimer();
        resolve();
      });
    });
  }

  // ===========================================================================
  // State
  // ===========================================================================

  /**
   * Check if an agent is currently running.
   */
  isRunning(): boolean {
    return this.process !== null;
  }

  /**
   * Get the bean currently being worked on.
   */
  getRunningBean(): Bean | null {
    return this.runningBean;
  }

  /**
   * Get the timestamp when the current agent started.
   */
  getStartedAt(): number | null {
    return this.startedAt;
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  /**
   * Build the command and arguments for the configured backend.
   */
  private buildCommand(prompt: string): { command: string; args: string[] } {
    switch (this.config.backend) {
      case 'opencode': {
        const args = ['run', prompt];
        if (this.config.opencode?.model) {
          args.push('--model', this.config.opencode.model);
        }
        return { command: 'opencode', args };
      }

      case 'claude': {
        const args = ['-p', prompt];
        // Always skip permissions for autonomous execution
        if (this.config.claude?.dangerously_skip_permissions !== false) {
          args.push('--dangerously-skip-permissions');
        }
        if (this.config.claude?.model) {
          args.push('--model', this.config.claude.model);
        }
        return { command: 'claude', args };
      }

      case 'codex': {
        const args = [prompt];
        if (this.config.codex?.model) {
          args.push('--model', this.config.codex.model);
        }
        return { command: 'codex', args };
      }

      default:
        throw new Error(`Unknown backend: ${this.config.backend}`);
    }
  }

  /**
   * Clean up internal state after process exits.
   */
  private cleanup(): void {
    this.process = null;
    this.runningBean = null;
    this.startedAt = null;
  }

  /**
   * Clear the SIGKILL timer if set.
   */
  private clearKillTimer(): void {
    if (this.killTimer) {
      clearTimeout(this.killTimer);
      this.killTimer = null;
    }
  }
}

export default AgentRunner;
