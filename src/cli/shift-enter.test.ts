/**
 * Tests for Shift+Enter escape sequence handling
 *
 * Tests the detection and translation of terminal-specific Shift+Enter
 * escape sequences into newline continuation markers.
 */
import { describe, test, expect } from 'vitest';
import {
  containsShiftEnter,
  translateShiftEnter,
  SHIFT_ENTER_MARKER,
} from './shift-enter.js';

describe('Shift+Enter Escape Sequence Handling', () => {
  describe('containsShiftEnter', () => {
    test('detects Ghostty/xterm Shift+Enter sequence', () => {
      // Ghostty sends \x1b[27;2;13~ for Shift+Enter
      const data = Buffer.from('\x1b[27;2;13~');
      expect(containsShiftEnter(data)).toBe(true);
    });

    test('detects Konsole legacy VT100 Shift+Enter sequence', () => {
      // Konsole sends \x1bOM (ESC O M) for Shift+Enter
      const data = Buffer.from('\x1bOM');
      expect(containsShiftEnter(data)).toBe(true);
    });

    test('detects alternate xterm Shift+Enter sequence', () => {
      // Some terminals send \x1b[13;2~
      const data = Buffer.from('\x1b[13;2~');
      expect(containsShiftEnter(data)).toBe(true);
    });

    test('does not detect normal Enter', () => {
      const data = Buffer.from('\r');
      expect(containsShiftEnter(data)).toBe(false);
    });

    test('does not detect normal text', () => {
      const data = Buffer.from('hello world');
      expect(containsShiftEnter(data)).toBe(false);
    });

    test('does not detect other escape sequences', () => {
      // Arrow up
      const data = Buffer.from('\x1b[A');
      expect(containsShiftEnter(data)).toBe(false);
    });

    test('detects Shift+Enter embedded in other data', () => {
      // Text before and after the escape sequence
      const data = Buffer.from('hello\x1b[27;2;13~world');
      expect(containsShiftEnter(data)).toBe(true);
    });
  });

  describe('translateShiftEnter', () => {
    test('translates Ghostty sequence to marker + newline', () => {
      const data = Buffer.from('\x1b[27;2;13~');
      const result = translateShiftEnter(data);
      // Should replace the escape sequence with backslash + CR
      // so readline submits the line, and processInputLine sees continuation
      expect(result.toString()).toBe(SHIFT_ENTER_MARKER);
    });

    test('translates Konsole sequence to marker + newline', () => {
      const data = Buffer.from('\x1bOM');
      const result = translateShiftEnter(data);
      expect(result.toString()).toBe(SHIFT_ENTER_MARKER);
    });

    test('translates alternate xterm sequence to marker + newline', () => {
      const data = Buffer.from('\x1b[13;2~');
      const result = translateShiftEnter(data);
      expect(result.toString()).toBe(SHIFT_ENTER_MARKER);
    });

    test('preserves normal text unchanged', () => {
      const data = Buffer.from('hello world');
      const result = translateShiftEnter(data);
      expect(result.toString()).toBe('hello world');
    });

    test('preserves normal Enter unchanged', () => {
      const data = Buffer.from('\r');
      const result = translateShiftEnter(data);
      expect(result.toString()).toBe('\r');
    });

    test('preserves other escape sequences unchanged', () => {
      const data = Buffer.from('\x1b[A');
      const result = translateShiftEnter(data);
      expect(result.toString()).toBe('\x1b[A');
    });

    test('translates Shift+Enter embedded in text', () => {
      const data = Buffer.from('hello\x1b[27;2;13~world');
      const result = translateShiftEnter(data);
      expect(result.toString()).toBe('hello' + SHIFT_ENTER_MARKER + 'world');
    });

    test('translates multiple Shift+Enter sequences', () => {
      const data = Buffer.from('\x1b[27;2;13~\x1b[27;2;13~');
      const result = translateShiftEnter(data);
      expect(result.toString()).toBe(SHIFT_ENTER_MARKER + SHIFT_ENTER_MARKER);
    });

    test('handles mixed escape sequences', () => {
      // Ghostty sequence followed by Konsole sequence
      const data = Buffer.from('\x1b[27;2;13~\x1bOM');
      const result = translateShiftEnter(data);
      expect(result.toString()).toBe(SHIFT_ENTER_MARKER + SHIFT_ENTER_MARKER);
    });
  });
});
