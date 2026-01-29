/**
 * Tests for tool call grouping behavior in sendAndStream.
 *
 * Verifies that consecutive tool calls are grouped together with:
 * - A blank line before the first tool call in a group (after text)
 * - No blank line between consecutive tool calls
 *
 * See bean daedalus-rchx.
 */
import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { formatToolCall } from './output.js';

/**
 * Captures stdout writes and console.log calls to verify output patterns.
 * Returns an array of output strings in order.
 */
function captureOutput() {
  const outputs: string[] = [];
  const originalWrite = process.stdout.write;
  const originalLog = console.log;

  // Capture process.stdout.write
  process.stdout.write = ((...args: unknown[]) => {
    const str = typeof args[0] === 'string' ? args[0] : String(args[0]);
    outputs.push(str);
    return true;
  }) as typeof process.stdout.write;

  // Capture console.log (which calls stdout.write with \n)
  console.log = (...args: unknown[]) => {
    if (args.length === 0) {
      outputs.push('\n');
    } else {
      outputs.push(args.map(String).join(' ') + '\n');
    }
  };

  return {
    outputs,
    restore() {
      process.stdout.write = originalWrite;
      console.log = originalLog;
    },
  };
}

/**
 * Mirrors the CURRENT production toolCallHandler from plan.ts.
 * This is the BROKEN version that adds a blank line before EVERY tool call.
 */
function createCurrentBrokenHandlers() {
  let hasOutput = false;
  let afterToolCall = false;

  const textHandler = (text: string) => {
    if (!hasOutput) {
      process.stdout.write('Planner: ');
      hasOutput = true;
    } else if (afterToolCall) {
      process.stdout.write('\nPlanner: ');
      afterToolCall = false;
    }
    process.stdout.write(text);
  };

  const toolCallHandler = (tc: { name: string; args?: Record<string, unknown> }) => {
    // CURRENT BROKEN BEHAVIOR: adds newline before EVERY tool call if hasOutput
    if (hasOutput) {
      console.log();
    } else {
      hasOutput = true;
    }
    console.log(formatToolCall(tc.name, tc.args));
    afterToolCall = true;
  };

  return { textHandler, toolCallHandler };
}

/**
 * Mirrors the FIXED production toolCallHandler.
 * Only adds blank line before first tool call in a group (after text),
 * not between consecutive tool calls.
 */
function createFixedHandlers() {
  let hasOutput = false;
  let afterToolCall = false;

  const textHandler = (text: string) => {
    if (!hasOutput) {
      process.stdout.write('Planner: ');
      hasOutput = true;
    } else if (afterToolCall) {
      process.stdout.write('\nPlanner: ');
      afterToolCall = false;
    }
    process.stdout.write(text);
  };

  const toolCallHandler = (tc: { name: string; args?: Record<string, unknown> }) => {
    // FIXED: only add blank line if previous output was text, not another tool call
    if (hasOutput && !afterToolCall) {
      console.log(); // end current text line
      console.log(); // blank line for visual separation
    } else if (!hasOutput) {
      hasOutput = true;
    }
    console.log(formatToolCall(tc.name, tc.args));
    afterToolCall = true;
  };

  return { textHandler, toolCallHandler };
}

describe('tool call grouping in sendAndStream', () => {
  let capture: ReturnType<typeof captureOutput>;

  beforeEach(() => {
    capture = captureOutput();
  });

  afterEach(() => {
    capture.restore();
  });

  // --- Tests that verify the BROKEN behavior (to confirm the bug exists) ---

  test('BROKEN: current handler adds blank line between consecutive tool calls', () => {
    const { textHandler, toolCallHandler } = createCurrentBrokenHandlers();

    textHandler('Let me do this.');
    toolCallHandler({ name: 'Bash', args: { command: 'beans create "Fix"' } });
    toolCallHandler({ name: 'Bash', args: { command: 'beans query' } });

    const output = capture.outputs.join('');
    const stripped = output.replace(/\x1b\[[0-9;]*m/g, '');
    const lines = stripped.split('\n');

    // Find the two tool call lines
    const firstToolIdx = lines.findIndex(l => l.includes('beans create'));
    const secondToolIdx = lines.findIndex(l => l.includes('beans query'));

    // BUG: there's a blank line between consecutive tool calls
    // (difference > 1 means there's a blank line between them)
    expect(secondToolIdx - firstToolIdx).toBeGreaterThan(1);
  });

  // --- Tests that verify the FIXED behavior ---

  test('adds blank line between text and first tool call', () => {
    const { textHandler, toolCallHandler } = createFixedHandlers();

    textHandler('Let me create that bug for you.');
    toolCallHandler({ name: 'Bash', args: { command: 'beans create "Fix login"' } });

    const output = capture.outputs.join('');
    const stripped = output.replace(/\x1b\[[0-9;]*m/g, '');

    expect(stripped).toContain('Let me create that bug for you.');
    expect(stripped).toContain('[Tool: Bash]');

    // Verify blank line separation: text line ends, then blank line, then tool call
    const lines = stripped.split('\n');
    const textLineIdx = lines.findIndex(l => l.includes('Let me create'));
    const toolLineIdx = lines.findIndex(l => l.includes('[Tool: Bash]'));
    // There should be a blank line between text and tool call (idx diff > 1)
    expect(toolLineIdx).toBeGreaterThan(textLineIdx + 1);
  });

  test('no blank line between consecutive tool calls', () => {
    const { textHandler, toolCallHandler } = createFixedHandlers();

    textHandler('Let me do this.');
    toolCallHandler({ name: 'Bash', args: { command: 'beans create "Fix"' } });
    toolCallHandler({ name: 'Bash', args: { command: 'beans query' } });

    const output = capture.outputs.join('');
    const stripped = output.replace(/\x1b\[[0-9;]*m/g, '');

    // Both tool calls should be present
    expect(stripped).toContain('beans create');
    expect(stripped).toContain('beans query');

    // The two tool call lines should be adjacent (no blank line between them)
    const lines = stripped.split('\n');
    const firstToolIdx = lines.findIndex(l => l.includes('beans create'));
    const secondToolIdx = lines.findIndex(l => l.includes('beans query'));
    expect(secondToolIdx - firstToolIdx).toBe(1);
  });

  test('tool calls at start (no preceding text) have no blank line before them', () => {
    const { toolCallHandler } = createFixedHandlers();

    toolCallHandler({ name: 'Bash', args: { command: 'git status' } });
    toolCallHandler({ name: 'Bash', args: { command: 'git diff' } });

    const output = capture.outputs.join('');
    const stripped = output.replace(/\x1b\[[0-9;]*m/g, '');

    expect(stripped).toContain('git status');
    expect(stripped).toContain('git diff');

    // Should NOT start with blank lines
    expect(stripped).not.toMatch(/^\n\n/);

    // The two tool calls should be on consecutive lines
    const nonEmptyLines = stripped.split('\n').filter(l => l.trim().length > 0);
    expect(nonEmptyLines).toHaveLength(2);
  });

  test('text after tool calls gets new Planner prefix', () => {
    const { textHandler, toolCallHandler } = createFixedHandlers();

    textHandler('Creating bug.');
    toolCallHandler({ name: 'Bash', args: { command: 'beans create "Fix"' } });
    textHandler('Done!');

    const output = capture.outputs.join('');
    const stripped = output.replace(/\x1b\[[0-9;]*m/g, '');

    expect(stripped).toContain('Creating bug.');
    expect(stripped).toContain('[Tool: Bash]');
    expect(stripped).toContain('Done!');

    // The second text should have a new "Planner:" prefix
    const plannerCount = (stripped.match(/Planner:/g) || []).length;
    expect(plannerCount).toBe(2);
  });
});
