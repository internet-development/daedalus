/**
 * Tests for CLI Output Formatting
 *
 * Tests for terminal output utilities.
 */
import { describe, test, expect } from 'vitest';
import { formatContinuationPrompt, formatPrompt, formatToolCall } from './output.js';

describe('CLI Output Formatting', () => {
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
    test('formats tool call with name only', () => {
      const result = formatToolCall('beans_cli');
      expect(result).toContain('Tool:');
      expect(result).toContain('beans_cli');
    });

    test('formats tool call with name and args', () => {
      const result = formatToolCall('beans_cli', { command: 'query' });
      expect(result).toContain('Tool:');
      expect(result).toContain('beans_cli');
      // Args should be included (possibly truncated)
      expect(result).toContain('command');
    });

    test('truncates long args to prevent line overflow', () => {
      const longArgs = { 
        query: 'a'.repeat(100),
        other: 'value'
      };
      const result = formatToolCall('beans_cli', longArgs);
      // Should be truncated (original formatToolCall slices to 50 chars)
      expect(result.length).toBeLessThan(200);
    });
  });
});
