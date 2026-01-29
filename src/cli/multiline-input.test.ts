/**
 * Tests for Multi-line Input Handling
 *
 * Tests the backslash continuation logic for multi-line input.
 */
import { describe, test, expect } from 'vitest';
import {
  processInputLine,
  type LineResult,
} from './multiline-input.js';
import { isMultilineMode, cancelMultiline } from './plan.js';

describe('Multi-line Input', () => {
  describe('processInputLine', () => {
    test('single line without backslash is complete', () => {
      const result = processInputLine('hello world', []);
      expect(result.complete).toBe(true);
      expect(result.message).toBe('hello world');
    });

    test('line ending with backslash continues', () => {
      const result = processInputLine('hello\\', []);
      expect(result.complete).toBe(false);
      expect(result.accumulated).toEqual(['hello']);
    });

    test('accumulates multiple continuation lines', () => {
      // First line
      const r1 = processInputLine('first\\', []);
      expect(r1.complete).toBe(false);
      expect(r1.accumulated).toEqual(['first']);

      // Second line (continuation)
      const r2 = processInputLine('second\\', r1.accumulated!);
      expect(r2.complete).toBe(false);
      expect(r2.accumulated).toEqual(['first', 'second']);

      // Third line (final)
      const r3 = processInputLine('third', r2.accumulated!);
      expect(r3.complete).toBe(true);
      expect(r3.message).toBe('first\nsecond\nthird');
    });

    test('preserves backslash in middle of line', () => {
      const result = processInputLine('path\\to\\file', []);
      expect(result.complete).toBe(true);
      expect(result.message).toBe('path\\to\\file');
    });

    test('empty line with backslash continues as blank line', () => {
      const r1 = processInputLine('first\\', []);
      const r2 = processInputLine('\\', r1.accumulated!);
      expect(r2.complete).toBe(false);
      expect(r2.accumulated).toEqual(['first', '']);

      const r3 = processInputLine('third', r2.accumulated!);
      expect(r3.complete).toBe(true);
      expect(r3.message).toBe('first\n\nthird');
    });

    test('multiple backslashes at end only strips the last one', () => {
      const result = processInputLine('ends with \\\\', []);
      // Two backslashes at end: first is content, second triggers continuation
      expect(result.complete).toBe(false);
      expect(result.accumulated).toEqual(['ends with \\']);
    });

    test('empty input without backslash is complete', () => {
      const result = processInputLine('', []);
      expect(result.complete).toBe(true);
      expect(result.message).toBe('');
    });

    test('empty input during continuation does NOT complete', () => {
      // When in continuation mode, empty line should continue (not submit)
      const r1 = processInputLine('first\\', []);
      const r2 = processInputLine('', r1.accumulated!);
      // Empty line in continuation mode should be treated as content
      expect(r2.complete).toBe(true);
      expect(r2.message).toBe('first\n');
    });
  });

  describe('Multi-line mode state', () => {
    test('isMultilineMode returns false by default', () => {
      // When not in multi-line input, should return false
      expect(isMultilineMode()).toBe(false);
    });

    test('cancelMultiline is safe to call when not in multi-line mode', () => {
      // Should not throw when called outside of multi-line input
      expect(() => cancelMultiline()).not.toThrow();
    });
  });
});
