/**
 * Tests for CLI Output Formatting
 *
 * Tests for terminal output utilities.
 */
import { describe, test, expect } from 'vitest';
import { formatContinuationPrompt, formatPrompt } from './output.js';

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
});
