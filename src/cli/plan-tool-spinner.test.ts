/**
 * Tests for tool spinner integration in sendAndStream.
 *
 * Verifies that tool spinners show during tool execution and
 * transition correctly between Thinking → tool → Thinking states.
 *
 * See bean daedalus-pjmp.
 */
import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { formatToolCallLine } from './spinner.js';
import { formatToolArgs } from './output.js';

// =============================================================================
// Helpers
// =============================================================================

const stripAnsi = (str: string) => str.replace(/\x1b\[[0-9;]*m/g, '');

/**
 * Captures stdout writes and console.log calls to verify output patterns.
 */
function captureOutput() {
  const outputs: string[] = [];
  const originalWrite = process.stdout.write;
  const originalLog = console.log;

  process.stdout.write = ((...args: unknown[]) => {
    const str = typeof args[0] === 'string' ? args[0] : String(args[0]);
    outputs.push(str);
    return true;
  }) as typeof process.stdout.write;

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

// =============================================================================
// formatToolArgs (exported from output.ts for tool spinner use)
// =============================================================================

describe('formatToolArgs (exported for tool spinner)', () => {
  test('extracts command from Bash tool', () => {
    const result = formatToolArgs('Bash', { command: 'git status' });
    expect(result).toBe('git status');
  });

  test('extracts filePath from Read tool', () => {
    const result = formatToolArgs('Read', { filePath: '/src/foo.ts' });
    expect(result).toBe('/src/foo.ts');
  });

  test('extracts pattern from Grep tool', () => {
    const result = formatToolArgs('Grep', { pattern: 'hello' });
    expect(result).toBe('hello');
  });

  test('handles mcp_ prefix', () => {
    const result = formatToolArgs('mcp_bash', { command: 'ls -la' });
    expect(result).toBe('ls -la');
  });

  test('returns empty string for no args', () => {
    const result = formatToolArgs('Bash');
    expect(result).toBe('');
  });
});

// =============================================================================
// formatToolCallLine dynamic width
// =============================================================================

describe('formatToolCallLine dynamic terminal width', () => {
  const originalColumns = process.stdout.columns;

  afterEach(() => {
    Object.defineProperty(process.stdout, 'columns', {
      value: originalColumns,
      writable: true,
      configurable: true,
    });
  });

  test('truncates args based on terminal width, not hardcoded 120', () => {
    // Set a narrow terminal (60 cols)
    Object.defineProperty(process.stdout, 'columns', {
      value: 60,
      writable: true,
      configurable: true,
    });

    const longArgs = 'a'.repeat(200);
    const result = formatToolCallLine('Bash', longArgs, '✓');
    const plain = stripAnsi(result);

    // With 60 cols, prefix "  [Bash] ✓ " is 11 chars
    // So args should be truncated to fit within ~49 chars
    // Total line should not exceed 60 chars
    expect(plain.length).toBeLessThanOrEqual(60);
  });

  test('uses wider truncation for wider terminals', () => {
    Object.defineProperty(process.stdout, 'columns', {
      value: 200,
      writable: true,
      configurable: true,
    });

    const longArgs = 'a'.repeat(180);
    const result = formatToolCallLine('Bash', longArgs, '✓');
    const plain = stripAnsi(result);

    // With 200 cols, should allow much more than 120 chars of args
    // Prefix "  [Bash] ✓ " is 11 chars, so args can be up to 189
    expect(plain.length).toBeLessThanOrEqual(200);
    // Should be longer than what 120-char hardcoded limit would produce
    // With hardcoded 120: prefix(11) + 120 = 131 max
    expect(plain.length).toBeGreaterThan(131);
  });

  test('enforces minimum args width of 20', () => {
    // Set an extremely narrow terminal
    Object.defineProperty(process.stdout, 'columns', {
      value: 10,
      writable: true,
      configurable: true,
    });

    const longArgs = 'a'.repeat(50);
    const result = formatToolCallLine('Bash', longArgs, '✓');
    const plain = stripAnsi(result);

    // Even with tiny terminal, args should get at least 20 chars
    // Prefix "  [Bash] ✓ " = 11, plus at least 20 for args = 31 min
    // The args portion (after prefix) should be at least 20 chars
    const prefixEnd = plain.indexOf('✓') + 2; // "✓ "
    const argsText = plain.slice(prefixEnd);
    expect(argsText.length).toBeGreaterThanOrEqual(20);
  });

  test('defaults to 120 columns when terminal width unavailable', () => {
    Object.defineProperty(process.stdout, 'columns', {
      value: undefined,
      writable: true,
      configurable: true,
    });

    const longArgs = 'a'.repeat(200);
    const result = formatToolCallLine('Bash', longArgs, '✓');
    const plain = stripAnsi(result);

    // Should behave as if 120 cols
    // Prefix "  [Bash] ✓ " = 11, args max = 120 - 11 = 109
    // Total = 11 + 109 = 120
    expect(plain.length).toBeLessThanOrEqual(120);
  });
});

// =============================================================================
// Tool spinner transition simulation
// =============================================================================

/**
 * Simulates the sendAndStream handler flow with tool spinners.
 * This mirrors the production code in plan.ts to verify behavior.
 */
function createHandlersWithToolSpinner() {
  let hasOutput = false;
  let afterToolCall = false;
  let activeToolSpinner: { stop: (success: boolean) => void } | null = null;

  const textHandler = (text: string) => {
    // Stop any active tool spinner (tool completed successfully)
    if (activeToolSpinner) {
      activeToolSpinner.stop(true);
      activeToolSpinner = null;
    }

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
    // Stop any active tool spinner from previous tool (success)
    if (activeToolSpinner) {
      activeToolSpinner.stop(true);
      activeToolSpinner = null;
    }

    // Add blank line before first tool call in a group (after text)
    if (hasOutput && !afterToolCall) {
      process.stdout.write('\n');
      process.stdout.write('\n');
    } else if (!hasOutput) {
      hasOutput = true;
    }

    // Start tool spinner
    const toolName = tc.name.startsWith('mcp_')
      ? tc.name.slice(4).charAt(0).toUpperCase() + tc.name.slice(5)
      : tc.name.charAt(0).toUpperCase() + tc.name.slice(1);
    const argsStr = formatToolArgs(tc.name, tc.args);

    // Simulate tool spinner (simplified - just write the line)
    process.stdout.write(formatToolCallLine(toolName, argsStr, '⠋'));
    activeToolSpinner = {
      stop(success: boolean) {
        const indicator = success ? '✓' : '✗';
        process.stdout.write('\r' + formatToolCallLine(toolName, argsStr, indicator) + '\n');
      },
    };

    afterToolCall = true;
  };

  const doneHandler = () => {
    // Stop any active tool spinner
    if (activeToolSpinner) {
      activeToolSpinner.stop(true);
      activeToolSpinner = null;
    }
  };

  return { textHandler, toolCallHandler, doneHandler };
}

describe('tool spinner transitions', () => {
  let capture: ReturnType<typeof captureOutput>;

  beforeEach(() => {
    capture = captureOutput();
  });

  afterEach(() => {
    capture.restore();
  });

  test('tool spinner shows running indicator on tool call', () => {
    const { toolCallHandler, doneHandler } = createHandlersWithToolSpinner();

    toolCallHandler({ name: 'Bash', args: { command: 'git status' } });
    doneHandler();

    const output = capture.outputs.join('');
    const plain = stripAnsi(output);
    // Should show spinner frame initially
    expect(plain).toContain('[Bash] ⠋ git status');
    // Should show success on done
    expect(plain).toContain('[Bash] ✓ git status');
  });

  test('tool spinner stops with ✓ when text arrives after tool', () => {
    const { textHandler, toolCallHandler } = createHandlersWithToolSpinner();

    toolCallHandler({ name: 'Bash', args: { command: 'git status' } });
    textHandler('Here are the results.');

    const output = capture.outputs.join('');
    const plain = stripAnsi(output);
    expect(plain).toContain('[Bash] ✓ git status');
    expect(plain).toContain('Here are the results.');
  });

  test('previous tool spinner stops when next tool call arrives', () => {
    const { toolCallHandler, doneHandler } = createHandlersWithToolSpinner();

    toolCallHandler({ name: 'Bash', args: { command: 'git status' } });
    toolCallHandler({ name: 'Read', args: { filePath: '/src/foo.ts' } });
    doneHandler();

    const output = capture.outputs.join('');
    const plain = stripAnsi(output);
    // First tool should show success (stopped by second tool)
    expect(plain).toContain('[Bash] ✓ git status');
    // Second tool should also show success (stopped by done)
    expect(plain).toContain('[Read] ✓ /src/foo.ts');
  });

  test('text → tool → text transition shows correct sequence', () => {
    const { textHandler, toolCallHandler } = createHandlersWithToolSpinner();

    textHandler('Let me check.');
    toolCallHandler({ name: 'Bash', args: { command: 'git status' } });
    textHandler('Done!');

    const output = capture.outputs.join('');
    const plain = stripAnsi(output);

    // Should have: text, blank line, tool running, tool done, text
    expect(plain).toContain('Let me check.');
    expect(plain).toContain('[Bash] ⠋ git status');
    expect(plain).toContain('[Bash] ✓ git status');
    expect(plain).toContain('Done!');
  });

  test('tool at start (no preceding text) works correctly', () => {
    const { toolCallHandler, doneHandler } = createHandlersWithToolSpinner();

    toolCallHandler({ name: 'Bash', args: { command: 'beans query' } });
    doneHandler();

    const output = capture.outputs.join('');
    const plain = stripAnsi(output);
    expect(plain).toContain('[Bash] ⠋ beans query');
    expect(plain).toContain('[Bash] ✓ beans query');
  });

  test('done handler stops active tool spinner', () => {
    const { toolCallHandler, doneHandler } = createHandlersWithToolSpinner();

    toolCallHandler({ name: 'Bash', args: { command: 'git status' } });
    doneHandler();

    const output = capture.outputs.join('');
    const plain = stripAnsi(output);
    expect(plain).toContain('✓');
  });
});
