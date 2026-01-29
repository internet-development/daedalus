/**
 * Tests for spinner utilities.
 *
 * Tests the SPINNERS constant, createSpinner(), createToolSpinner(),
 * and formatToolCallLine() functions.
 *
 * See bean daedalus-pjmp.
 */
import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  SPINNERS,
  type SpinnerName,
  createSpinner,
  createToolSpinner,
  formatToolCallLine,
} from './spinner.js';

// =============================================================================
// Helpers
// =============================================================================

const stripAnsi = (str: string) => str.replace(/\x1b\[[0-9;]*m/g, '');

/**
 * Captures process.stdout.write calls for testing spinner output.
 */
function captureStdout() {
  const writes: string[] = [];
  const originalWrite = process.stdout.write;

  process.stdout.write = ((...args: unknown[]) => {
    const str = typeof args[0] === 'string' ? args[0] : String(args[0]);
    writes.push(str);
    return true;
  }) as typeof process.stdout.write;

  return {
    writes,
    restore() {
      process.stdout.write = originalWrite;
    },
  };
}

// =============================================================================
// SPINNERS constant
// =============================================================================

describe('SPINNERS constant', () => {
  test('contains dots spinner with correct frames', () => {
    expect(SPINNERS.dots).toBeDefined();
    expect(SPINNERS.dots.frames).toEqual(['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']);
    expect(SPINNERS.dots.interval).toBe(80);
  });

  test('contains moon spinner', () => {
    expect(SPINNERS.moon).toBeDefined();
    expect(SPINNERS.moon.frames).toHaveLength(8);
    expect(SPINNERS.moon.interval).toBe(80);
  });

  test('contains clock spinner', () => {
    expect(SPINNERS.clock).toBeDefined();
    expect(SPINNERS.clock.frames).toHaveLength(12);
    expect(SPINNERS.clock.interval).toBe(100);
  });

  test('contains earth spinner', () => {
    expect(SPINNERS.earth).toBeDefined();
    expect(SPINNERS.earth.frames).toHaveLength(3);
    expect(SPINNERS.earth.interval).toBe(180);
  });

  test('contains arc spinner', () => {
    expect(SPINNERS.arc).toBeDefined();
    expect(SPINNERS.arc.frames).toEqual(['◜', '◠', '◝', '◞', '◡', '◟']);
    expect(SPINNERS.arc.interval).toBe(100);
  });

  test('all spinners have non-empty frames and positive intervals', () => {
    for (const [name, spinner] of Object.entries(SPINNERS)) {
      expect(spinner.frames.length, `${name} should have frames`).toBeGreaterThan(0);
      expect(spinner.interval, `${name} should have positive interval`).toBeGreaterThan(0);
    }
  });
});

// =============================================================================
// createSpinner()
// =============================================================================

describe('createSpinner', () => {
  let capture: ReturnType<typeof captureStdout>;

  beforeEach(() => {
    vi.useFakeTimers();
    capture = captureStdout();
  });

  afterEach(() => {
    capture.restore();
    vi.useRealTimers();
  });

  test('defaults to dots spinner', () => {
    const spinner = createSpinner();
    spinner.start();

    // First frame should be written immediately
    const firstWrite = capture.writes[0];
    expect(stripAnsi(firstWrite)).toContain('⠋');
    expect(stripAnsi(firstWrite)).toContain('Thinking...');

    spinner.stop();
  });

  test('accepts a spinner name parameter', () => {
    const spinner = createSpinner('arc');
    spinner.start();

    const firstWrite = capture.writes[0];
    expect(stripAnsi(firstWrite)).toContain('◜');

    spinner.stop();
  });

  test('animates through frames on interval', () => {
    const spinner = createSpinner('dots');
    spinner.start();

    // Initial frame
    expect(stripAnsi(capture.writes[0])).toContain('⠋');

    // Advance one interval (80ms for dots)
    vi.advanceTimersByTime(80);

    // Should have written a second frame
    const secondWrite = capture.writes[capture.writes.length - 1];
    expect(stripAnsi(secondWrite)).toContain('⠙');

    spinner.stop();
  });

  test('stop clears the spinner line', () => {
    const spinner = createSpinner();
    spinner.start();
    spinner.stop();

    // Last write should clear the line (\r\x1b[K)
    const lastWrite = capture.writes[capture.writes.length - 1];
    expect(lastWrite).toContain('\r');
    expect(lastWrite).toContain('\x1b[K');
  });

  test('stop is idempotent', () => {
    const spinner = createSpinner();
    spinner.start();
    spinner.stop();
    const writesAfterFirstStop = capture.writes.length;
    spinner.stop(); // second stop should be no-op
    expect(capture.writes.length).toBe(writesAfterFirstStop);
  });

  test('start is idempotent when already running', () => {
    const spinner = createSpinner();
    spinner.start();
    const writesAfterFirstStart = capture.writes.length;
    spinner.start(); // second start should be no-op
    expect(capture.writes.length).toBe(writesAfterFirstStart);

    spinner.stop();
  });
});

// =============================================================================
// formatToolCallLine()
// =============================================================================

describe('formatToolCallLine', () => {
  test('formats running state with spinner frame', () => {
    const line = formatToolCallLine('Bash', 'git status', '⠋');
    const plain = stripAnsi(line);
    expect(plain).toBe('  [Bash] ⠋ git status');
  });

  test('formats success state with checkmark', () => {
    const line = formatToolCallLine('Bash', 'git status', '✓');
    const plain = stripAnsi(line);
    expect(plain).toBe('  [Bash] ✓ git status');
  });

  test('formats error state with cross', () => {
    const line = formatToolCallLine('Bash', 'git status', '✗');
    const plain = stripAnsi(line);
    expect(plain).toBe('  [Bash] ✗ git status');
  });

  test('truncates long commands', () => {
    const longCmd = 'a'.repeat(200);
    const line = formatToolCallLine('Bash', longCmd, '⠋');
    const plain = stripAnsi(line);
    expect(plain.length).toBeLessThan(160);
    expect(plain).toContain('...');
  });

  test('handles empty args string', () => {
    const line = formatToolCallLine('Read', '', '⠋');
    const plain = stripAnsi(line);
    expect(plain).toBe('  [Read] ⠋');
  });
});

// =============================================================================
// createToolSpinner()
// =============================================================================

describe('createToolSpinner', () => {
  let capture: ReturnType<typeof captureStdout>;

  beforeEach(() => {
    vi.useFakeTimers();
    capture = captureStdout();
  });

  afterEach(() => {
    capture.restore();
    vi.useRealTimers();
  });

  test('shows tool name and command immediately on creation', () => {
    const toolSpinner = createToolSpinner('Bash', 'git status');

    // Should have written the initial line
    expect(capture.writes.length).toBeGreaterThan(0);
    const output = capture.writes.join('');
    const plain = stripAnsi(output);
    expect(plain).toContain('[Bash]');
    expect(plain).toContain('git status');
    expect(plain).toContain('⠋'); // first spinner frame

    toolSpinner.stop(true);
  });

  test('animates spinner frames', () => {
    const toolSpinner = createToolSpinner('Bash', 'git status');

    // Advance time to trigger animation
    vi.advanceTimersByTime(80);

    // Should have updated with next frame
    const allOutput = capture.writes.join('');
    const plain = stripAnsi(allOutput);
    expect(plain).toContain('⠙'); // second frame

    toolSpinner.stop(true);
  });

  test('stop(true) shows success indicator ✓', () => {
    const toolSpinner = createToolSpinner('Bash', 'git status');
    toolSpinner.stop(true);

    const lastWrites = capture.writes.slice(-2).join('');
    const plain = stripAnsi(lastWrites);
    expect(plain).toContain('✓');
    expect(plain).toContain('[Bash]');
    expect(plain).toContain('git status');
  });

  test('stop(false) shows error indicator ✗', () => {
    const toolSpinner = createToolSpinner('Bash', 'git status');
    toolSpinner.stop(false);

    const lastWrites = capture.writes.slice(-2).join('');
    const plain = stripAnsi(lastWrites);
    expect(plain).toContain('✗');
    expect(plain).toContain('[Bash]');
  });

  test('stop writes a newline after the final line', () => {
    const toolSpinner = createToolSpinner('Bash', 'git status');
    toolSpinner.stop(true);

    // The very last write should end with newline
    const lastWrite = capture.writes[capture.writes.length - 1];
    expect(lastWrite).toContain('\n');
  });

  test('stop is idempotent', () => {
    const toolSpinner = createToolSpinner('Bash', 'git status');
    toolSpinner.stop(true);
    const writesAfterFirstStop = capture.writes.length;
    toolSpinner.stop(true);
    expect(capture.writes.length).toBe(writesAfterFirstStop);
  });

  test('uses \r to overwrite the line during animation', () => {
    const toolSpinner = createToolSpinner('Bash', 'git status');

    vi.advanceTimersByTime(80);

    // Animation writes should use \r to return to start of line
    const animationWrites = capture.writes.slice(1); // skip initial write
    const hasCarriageReturn = animationWrites.some(w => w.includes('\r'));
    expect(hasCarriageReturn).toBe(true);

    toolSpinner.stop(true);
  });

  test('works with Read tool and file path', () => {
    const toolSpinner = createToolSpinner('Read', '/src/cli/output.ts');
    toolSpinner.stop(true);

    const output = capture.writes.join('');
    const plain = stripAnsi(output);
    expect(plain).toContain('[Read]');
    expect(plain).toContain('/src/cli/output.ts');
  });
});
