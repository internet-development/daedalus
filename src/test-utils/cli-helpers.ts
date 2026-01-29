/**
 * CLI Test Helpers
 *
 * Utilities for testing CLI commands.
 * These are NOT mocks - they capture real output from real commands.
 */
import { withTestBeansDir } from './beans-fixtures.js';

// =============================================================================
// Types
// =============================================================================

export interface CommandContext {
  beansDir: string;
}

// =============================================================================
// Output Capture
// =============================================================================

/**
 * Captures stdout during command execution.
 *
 * This captures real output from console.log and process.stdout.write,
 * NOT mocked output.
 *
 * @param fn The async function to execute
 * @returns The captured stdout as a string
 *
 * @example
 * const output = await captureOutput(async () => {
 *   console.log('Hello, World!');
 * });
 * expect(output).toContain('Hello, World!');
 */
export async function captureOutput(fn: () => Promise<void>): Promise<string> {
  // Save original functions
  const originalLog = console.log;
  const originalInfo = console.info;
  const originalWarn = console.warn;
  const originalError = console.error;
  let output = '';

  // Override console methods to capture output
  const capture = (...args: unknown[]) => {
    output +=
      args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ') +
      '\n';
  };

  console.log = capture;
  console.info = capture;
  console.warn = capture;
  console.error = capture;

  try {
    await fn();
    return output;
  } finally {
    // Restore original functions
    console.log = originalLog;
    console.info = originalInfo;
    console.warn = originalWarn;
    console.error = originalError;
  }
}

/**
 * Captures exit code from command execution.
 *
 * Intercepts process.exit() calls and returns the exit code
 * without actually exiting the process.
 *
 * @param fn The async function to execute
 * @returns The exit code (0 if no exit was called)
 *
 * @example
 * const code = await captureExitCode(async () => {
 *   process.exit(1);
 * });
 * expect(code).toBe(1);
 */
export async function captureExitCode(
  fn: () => Promise<void>
): Promise<number> {
  const originalExit = process.exit;
  let exitCode = 0;
  let exitCalled = false;

  (process.exit as unknown) = (code?: number): never => {
    exitCode = code ?? 0;
    exitCalled = true;
    throw new ExitInterrupt(exitCode);
  };

  try {
    await fn();
    return exitCode;
  } catch (e) {
    if (e instanceof ExitInterrupt) {
      return e.code;
    }
    throw e;
  } finally {
    process.exit = originalExit;
  }
}

/**
 * Internal error class to interrupt execution when process.exit is called.
 */
class ExitInterrupt extends Error {
  constructor(public readonly code: number) {
    super(`Process.exit(${code})`);
    this.name = 'ExitInterrupt';
  }
}

// =============================================================================
// Command Execution Helpers
// =============================================================================

/**
 * Runs a command handler with a test beans directory.
 *
 * Creates an isolated beans directory, runs the command, and cleans up.
 * This tests REAL command behavior, not mocked behavior.
 *
 * @param command The command handler function
 * @param setup Optional setup function to create test data
 * @returns The result from the command handler
 *
 * @example
 * const result = await runCommandWithTestBeans(
 *   (ctx) => handleTreeCommand(ctx),
 *   async (dir) => {
 *     await createTestBean(dir, { title: 'Test Bean' });
 *   }
 * );
 */
export async function runCommandWithTestBeans<T>(
  command: (ctx: CommandContext) => Promise<T>,
  setup?: (dir: string) => Promise<void>
): Promise<T> {
  return withTestBeansDir(async (dir) => {
    if (setup) await setup(dir);

    const ctx: CommandContext = {
      beansDir: dir,
    };

    return command(ctx);
  });
}

/**
 * Runs a command and captures its output.
 *
 * Combines runCommandWithTestBeans with captureOutput for convenience.
 *
 * @param command The command handler function
 * @param setup Optional setup function to create test data
 * @returns The captured stdout as a string
 *
 * @example
 * const output = await runCommandAndCaptureOutput(
 *   (ctx) => handleTreeCommand(ctx),
 *   async (dir) => {
 *     await createTestBean(dir, { title: 'Test Bean' });
 *   }
 * );
 * expect(output).toContain('Test Bean');
 */
export async function runCommandAndCaptureOutput(
  command: (ctx: CommandContext) => Promise<void>,
  setup?: (dir: string) => Promise<void>
): Promise<string> {
  return captureOutput(async () => {
    await runCommandWithTestBeans(command, setup);
  });
}
