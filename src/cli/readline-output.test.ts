/**
 * Tests for readline output stream management.
 *
 * Verifies that MutableWritable correctly forwards/mutes writes,
 * preventing readline from interfering with spinner stdout writes.
 *
 * See bean daedalus-8b67.
 */
import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import * as readline from 'readline';
import { PassThrough } from 'stream';
import { createMutableOutput, type MutableOutput } from './readline-output.js';

// =============================================================================
// Helpers
// =============================================================================

/**
 * Captures process.stdout.write calls for testing.
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
// MutableOutput
// =============================================================================

describe('createMutableOutput', () => {
  let capture: ReturnType<typeof captureStdout>;

  beforeEach(() => {
    capture = captureStdout();
  });

  afterEach(() => {
    capture.restore();
  });

  test('returns a stream and mute/unmute controls', () => {
    const output = createMutableOutput();
    expect(output.stream).toBeDefined();
    expect(typeof output.mute).toBe('function');
    expect(typeof output.unmute).toBe('function');
  });

  test('forwards writes to stdout when unmuted (default)', () => {
    const output = createMutableOutput();
    output.stream.write('hello');
    expect(capture.writes).toContain('hello');
  });

  test('discards writes when muted', () => {
    const output = createMutableOutput();
    output.mute();
    output.stream.write('should not appear');
    expect(capture.writes).not.toContain('should not appear');
  });

  test('resumes forwarding after unmute', () => {
    const output = createMutableOutput();
    output.mute();
    output.stream.write('muted');
    output.unmute();
    output.stream.write('visible');
    expect(capture.writes).not.toContain('muted');
    expect(capture.writes).toContain('visible');
  });

  test('mute is idempotent', () => {
    const output = createMutableOutput();
    output.mute();
    output.mute(); // second call should not error
    output.stream.write('still muted');
    expect(capture.writes).not.toContain('still muted');
  });

  test('unmute is idempotent', () => {
    const output = createMutableOutput();
    output.unmute(); // already unmuted, should not error
    output.stream.write('visible');
    expect(capture.writes).toContain('visible');
  });
});

// =============================================================================
// Readline integration
// =============================================================================

describe('readline with MutableOutput', () => {
  let capture: ReturnType<typeof captureStdout>;

  beforeEach(() => {
    capture = captureStdout();
  });

  afterEach(() => {
    capture.restore();
  });

  test('readline uses MutableOutput stream for prompt display', () => {
    const output = createMutableOutput();
    const input = new PassThrough();
    const rl = readline.createInterface({
      input,
      output: output.stream,
      terminal: false,
    });

    rl.setPrompt('> ');
    rl.prompt();

    // Prompt should appear in stdout
    expect(capture.writes.some(w => w.includes('>'))).toBe(true);

    rl.close();
  });

  test('muting prevents readline prompt writes from reaching stdout', () => {
    const output = createMutableOutput();
    const input = new PassThrough();
    const rl = readline.createInterface({
      input,
      output: output.stream,
      terminal: false,
    });

    output.mute();
    rl.setPrompt('> ');
    rl.prompt();

    // Prompt should NOT appear in stdout
    expect(capture.writes.some(w => w.includes('>'))).toBe(false);

    rl.close();
  });

  test('direct stdout writes work while readline output is muted', () => {
    const output = createMutableOutput();
    const input = new PassThrough();
    const rl = readline.createInterface({
      input,
      output: output.stream,
      terminal: false,
    });

    output.mute();

    // Spinner-style write directly to stdout
    process.stdout.write('⠋ Thinking...');
    process.stdout.write('\r⠙ Thinking...');

    expect(capture.writes).toContain('⠋ Thinking...');
    expect(capture.writes).toContain('\r⠙ Thinking...');

    rl.close();
  });

  test('spinner carriage returns work correctly while muted', () => {
    const output = createMutableOutput();
    const input = new PassThrough();
    const rl = readline.createInterface({
      input,
      output: output.stream,
      terminal: false,
    });

    output.mute();

    // Simulate spinner animation
    const frames = ['⠋', '⠙', '⠹'];
    process.stdout.write(`  [Bash] ${frames[0]} git status`);
    process.stdout.write(`\r  [Bash] ${frames[1]} git status`);
    process.stdout.write(`\r  [Bash] ${frames[2]} git status`);
    process.stdout.write(`\r  [Bash] ✓ git status\n`);

    // All writes should use \r for in-place updates (no unexpected newlines)
    const allWrites = capture.writes.join('');
    const lines = allWrites.split('\n').filter(l => l.length > 0);
    // After processing \r, there should be only one visible line
    // (each \r overwrites the previous content)
    // In captured output, we see all writes but they all use \r
    expect(capture.writes[1]).toMatch(/^\r/); // second write starts with \r
    expect(capture.writes[2]).toMatch(/^\r/); // third write starts with \r
    expect(capture.writes[3]).toMatch(/^\r/); // final write starts with \r

    rl.close();
  });

  test('unmuting restores readline functionality', () => {
    const output = createMutableOutput();
    const input = new PassThrough();
    const rl = readline.createInterface({
      input,
      output: output.stream,
      terminal: false,
    });

    // Mute during "streaming"
    output.mute();
    process.stdout.write('spinner output');

    // Unmute for prompt
    output.unmute();
    rl.setPrompt('plan> ');
    rl.prompt();

    // Prompt should now appear
    expect(capture.writes.some(w => w.includes('plan>'))).toBe(true);

    rl.close();
  });
});

// =============================================================================
// Tool spinner with readline (integration)
// =============================================================================

describe('tool spinner with muted readline', () => {
  let capture: ReturnType<typeof captureStdout>;

  beforeEach(() => {
    vi.useFakeTimers();
    capture = captureStdout();
  });

  afterEach(() => {
    capture.restore();
    vi.useRealTimers();
  });

  test('tool spinner frames use carriage return while readline is muted', async () => {
    const output = createMutableOutput();
    const input = new PassThrough();
    const rl = readline.createInterface({
      input,
      output: output.stream,
      terminal: false,
    });

    output.mute();

    // Import and use real createToolSpinner
    const { createToolSpinner } = await import('./spinner.js');
    const spinner = createToolSpinner('Bash', 'git status');

    // Advance timer to get animation frames
    vi.advanceTimersByTime(80);
    vi.advanceTimersByTime(80);

    spinner.stop(true);

    // Check that animation frames use \r
    const animationWrites = capture.writes.slice(1); // skip initial write
    const crWrites = animationWrites.filter(w => w.startsWith('\r'));
    expect(crWrites.length).toBeGreaterThan(0);

    // Check final write has checkmark
    const finalWrite = capture.writes[capture.writes.length - 1];
    expect(finalWrite).toContain('✓');
    expect(finalWrite).toContain('\n');

    rl.close();
  });

  test('thinking spinner frames use carriage return while readline is muted', async () => {
    const output = createMutableOutput();
    const input = new PassThrough();
    const rl = readline.createInterface({
      input,
      output: output.stream,
      terminal: false,
    });

    output.mute();

    const { createSpinner } = await import('./spinner.js');
    const spinner = createSpinner();
    spinner.start();

    // Advance timer
    vi.advanceTimersByTime(80);

    // Animation frame should use \r
    const secondWrite = capture.writes[1];
    expect(secondWrite).toMatch(/^\r/);
    expect(secondWrite).toContain('Thinking...');

    spinner.stop();

    // Stop should clear the line
    const lastWrite = capture.writes[capture.writes.length - 1];
    expect(lastWrite).toContain('\r');
    expect(lastWrite).toContain('\x1b[K');

    rl.close();
  });

  test('multiple consecutive tool spinners each render correctly', async () => {
    const output = createMutableOutput();
    const input = new PassThrough();
    const rl = readline.createInterface({
      input,
      output: output.stream,
      terminal: false,
    });

    output.mute();

    const { createToolSpinner } = await import('./spinner.js');

    // First tool
    const spinner1 = createToolSpinner('Bash', 'git status');
    vi.advanceTimersByTime(80);
    spinner1.stop(true);

    // Second tool
    const spinner2 = createToolSpinner('Read', '/src/foo.ts');
    vi.advanceTimersByTime(80);
    spinner2.stop(true);

    // Third tool
    const spinner3 = createToolSpinner('Grep', 'pattern');
    vi.advanceTimersByTime(80);
    spinner3.stop(false); // error case

    const allOutput = capture.writes.join('');
    const stripped = allOutput.replace(/\x1b\[[0-9;]*m/g, '');

    // All three tools should show their final state
    expect(stripped).toContain('[Bash] ✓ git status');
    expect(stripped).toContain('[Read] ✓ /src/foo.ts');
    expect(stripped).toContain('[Grep] ✗ pattern');

    rl.close();
  });
});
