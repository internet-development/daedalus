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
