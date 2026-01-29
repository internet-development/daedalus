/**
 * Tests for CLI Output Formatting
 *
 * Tests for terminal output utilities.
 */
import { describe, test, expect } from 'vitest';
import { formatContinuationPrompt, formatPrompt, formatToolCall } from './output.js';

describe('CLI Output Formatting', () => {
  describe('formatPrompt', () => {
    // Helper to strip ANSI codes for easier testing
    const stripAnsi = (str: string) => str.replace(/\x1b\[[0-9;]*m/g, '');

    test('returns plain "> " for default mode (new)', () => {
      const result = formatPrompt('new');
      const plain = stripAnsi(result);
      // Should be just "> " without mode indicator
      expect(plain).toBe('> ');
    });

    test('returns plain "> " when mode is undefined', () => {
      const result = formatPrompt();
      const plain = stripAnsi(result);
      // Should be just "> " without mode indicator
      expect(plain).toBe('> ');
    });

    test('returns "[brainstorm] > " for brainstorm mode', () => {
      const result = formatPrompt('brainstorm');
      const plain = stripAnsi(result);
      expect(plain).toBe('[brainstorm] > ');
    });

    test('returns "[breakdown] > " for breakdown mode', () => {
      const result = formatPrompt('breakdown');
      const plain = stripAnsi(result);
      expect(plain).toBe('[breakdown] > ');
    });

    test('returns "[refine] > " for refine mode', () => {
      const result = formatPrompt('refine');
      const plain = stripAnsi(result);
      expect(plain).toBe('[refine] > ');
    });

    test('returns "[critique] > " for critique mode', () => {
      const result = formatPrompt('critique');
      const plain = stripAnsi(result);
      expect(plain).toBe('[critique] > ');
    });

    test('returns "[sweep] > " for sweep mode', () => {
      const result = formatPrompt('sweep');
      const plain = stripAnsi(result);
      expect(plain).toBe('[sweep] > ');
    });
  });

  describe('formatContinuationPrompt', () => {
    test('returns dim "... " for multi-line continuation', () => {
      const result = formatContinuationPrompt();
      // Should contain "... " (with trailing space)
      expect(result).toContain('... ');
    });

    test('is visually distinct from regular prompt', () => {
      const regularPrompt = formatPrompt();
      const continuationPrompt = formatContinuationPrompt();
      
      // They should be different
      expect(continuationPrompt).not.toBe(regularPrompt);
      // Continuation should have "..." not ">"
      expect(continuationPrompt).toContain('...');
      expect(regularPrompt).toContain('>');
    });
  });

  describe('formatToolCall', () => {
    // Helper to strip ANSI codes for easier testing
    const stripAnsi = (str: string) => str.replace(/\x1b\[[0-9;]*m/g, '');

    test('formats tool call with name only (no args)', () => {
      const result = formatToolCall('beans_cli');
      const plain = stripAnsi(result);
      // Name gets capitalized for display
      expect(plain).toContain('[Tool: Beans_cli]');
    });

    // --- Bash tool: show command directly ---

    test('shows command string for Bash tool', () => {
      const result = formatToolCall('Bash', { command: 'beans create "Fix login bug" -t bug -s todo' });
      const plain = stripAnsi(result);
      expect(plain).toBe('  [Tool: Bash] beans create "Fix login bug" -t bug -s todo');
    });

    test('shows command string for mcp_bash tool', () => {
      const result = formatToolCall('mcp_bash', { command: 'git status', description: 'Check git status' });
      const plain = stripAnsi(result);
      expect(plain).toBe('  [Tool: Bash] git status');
    });

    test('truncates very long Bash commands with ellipsis', () => {
      const longCommand = 'beans query \'{ beans(filter: { status: ["todo", "in-progress"], isBlocked: false }) { id title type priority body } }\' ' + 'a'.repeat(200);
      const result = formatToolCall('Bash', { command: longCommand });
      const plain = stripAnsi(result);
      // Should be truncated but show more than 50 chars
      expect(plain.length).toBeLessThan(160);
      expect(plain).toContain('...');
      expect(plain).toContain('[Tool: Bash]');
    });

    // --- Read/Write tools: show file path ---

    test('shows file path for Read tool', () => {
      const result = formatToolCall('Read', { filePath: '/src/cli/output.ts' });
      const plain = stripAnsi(result);
      expect(plain).toBe('  [Tool: Read] /src/cli/output.ts');
    });

    test('shows file path for Write tool', () => {
      const result = formatToolCall('Write', { filePath: '/src/cli/output.ts', content: 'lots of content...' });
      const plain = stripAnsi(result);
      expect(plain).toBe('  [Tool: Write] /src/cli/output.ts');
    });

    // --- Edit tool: show file path ---

    test('shows file path for Edit tool', () => {
      const result = formatToolCall('Edit', { filePath: '/src/cli/output.ts', oldString: 'foo', newString: 'bar' });
      const plain = stripAnsi(result);
      expect(plain).toBe('  [Tool: Edit] /src/cli/output.ts');
    });

    // --- Glob/Grep tools: show pattern ---

    test('shows pattern for Glob tool', () => {
      const result = formatToolCall('Glob', { pattern: '**/*.ts' });
      const plain = stripAnsi(result);
      expect(plain).toBe('  [Tool: Glob] **/*.ts');
    });

    test('shows pattern for Grep tool', () => {
      const result = formatToolCall('Grep', { pattern: 'formatToolCall', include: '*.ts' });
      const plain = stripAnsi(result);
      expect(plain).toBe('  [Tool: Grep] formatToolCall');
    });

    // --- Task tool: show description ---

    test('shows description for Task tool', () => {
      const result = formatToolCall('Task', { description: 'Explore codebase', prompt: 'Find all test files...' });
      const plain = stripAnsi(result);
      expect(plain).toBe('  [Tool: Task] Explore codebase');
    });

    // --- WebFetch tool: show URL ---

    test('shows URL for WebFetch tool', () => {
      const result = formatToolCall('WebFetch', { url: 'https://example.com/api', format: 'markdown' });
      const plain = stripAnsi(result);
      expect(plain).toBe('  [Tool: WebFetch] https://example.com/api');
    });

    // --- Unknown tools: show key args in readable format ---

    test('shows key args for unknown tools', () => {
      const result = formatToolCall('custom_tool', { action: 'deploy', target: 'production' });
      const plain = stripAnsi(result);
      // Name gets capitalized for display
      expect(plain).toContain('[Tool: Custom_tool]');
      expect(plain).toContain('action=deploy');
      expect(plain).toContain('target=production');
    });

    test('truncates long arg values for unknown tools', () => {
      const result = formatToolCall('custom_tool', { data: 'x'.repeat(200) });
      const plain = stripAnsi(result);
      expect(plain.length).toBeLessThan(160);
      expect(plain).toContain('...');
    });

    // --- mcp_ prefix stripping ---

    test('strips mcp_ prefix from tool names for display', () => {
      const result = formatToolCall('mcp_read', { filePath: '/src/foo.ts' });
      const plain = stripAnsi(result);
      expect(plain).toBe('  [Tool: Read] /src/foo.ts');
    });

    test('strips mcp_ prefix from grep tool', () => {
      const result = formatToolCall('mcp_grep', { pattern: 'hello' });
      const plain = stripAnsi(result);
      expect(plain).toBe('  [Tool: Grep] hello');
    });
  });
});
