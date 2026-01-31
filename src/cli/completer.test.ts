/**
 * Tests for Tab Completion
 *
 * Tests the completer function for slash command completion.
 */
import { describe, test, expect } from 'vitest';
import { COMMAND_NAMES } from './commands.js';
import { completer } from './completer.js';

// =============================================================================
// COMMAND_NAMES Export Tests
// =============================================================================

describe('COMMAND_NAMES', () => {
  test('exports array of command names', () => {
    expect(Array.isArray(COMMAND_NAMES)).toBe(true);
    expect(COMMAND_NAMES.length).toBeGreaterThan(0);
  });

  test('includes all primary commands with / prefix', () => {
    expect(COMMAND_NAMES).toContain('/help');
    expect(COMMAND_NAMES).toContain('/mode');
    expect(COMMAND_NAMES).toContain('/prompt');
    expect(COMMAND_NAMES).toContain('/start');
    expect(COMMAND_NAMES).toContain('/stop');
    expect(COMMAND_NAMES).toContain('/status');
    expect(COMMAND_NAMES).toContain('/sessions');
    expect(COMMAND_NAMES).toContain('/new');
    expect(COMMAND_NAMES).toContain('/clear');
    expect(COMMAND_NAMES).toContain('/beans');
    expect(COMMAND_NAMES).toContain('/quit');
  });

  test('includes /tree as alias for /beans', () => {
    expect(COMMAND_NAMES).toContain('/tree');
  });

  test('includes all aliases with / prefix', () => {
    expect(COMMAND_NAMES).toContain('/h');
    expect(COMMAND_NAMES).toContain('/?');
    expect(COMMAND_NAMES).toContain('/m');
    expect(COMMAND_NAMES).toContain('/p');
    expect(COMMAND_NAMES).toContain('/st');
    expect(COMMAND_NAMES).toContain('/ss');
    expect(COMMAND_NAMES).toContain('/n');
    expect(COMMAND_NAMES).toContain('/c');
    expect(COMMAND_NAMES).toContain('/t');
    expect(COMMAND_NAMES).toContain('/q');
    expect(COMMAND_NAMES).toContain('/exit');
  });
});

// =============================================================================
// Completer Function Tests
// =============================================================================

describe('completer', () => {
  describe('non-command input', () => {
    test('returns empty completions for regular text', () => {
      const [completions, original] = completer('hello world');
      expect(completions).toEqual([]);
      expect(original).toBe('hello world');
    });

    test('returns empty completions for empty string', () => {
      const [completions, original] = completer('');
      expect(completions).toEqual([]);
      expect(original).toBe('');
    });

    test('returns empty completions for text starting with space', () => {
      const [completions, original] = completer(' /help');
      expect(completions).toEqual([]);
      expect(original).toBe(' /help');
    });
  });

  describe('command completion', () => {
    test('/h completes to /help and /h', () => {
      const [completions, original] = completer('/h');
      expect(completions).toContain('/help');
      expect(completions).toContain('/h');
      expect(original).toBe('/h');
    });

    test('/s shows /start, /stop, /status, /sessions, /ss, /st', () => {
      const [completions, original] = completer('/s');
      expect(completions).toContain('/start');
      expect(completions).toContain('/stop');
      expect(completions).toContain('/status');
      expect(completions).toContain('/sessions');
      expect(completions).toContain('/ss');
      expect(completions).toContain('/st');
      expect(original).toBe('/s');
    });

    test('empty / shows all commands', () => {
      const [completions, original] = completer('/');
      expect(completions.length).toBe(COMMAND_NAMES.length);
      expect(original).toBe('/');
    });

    test('exact match still returns the command', () => {
      const [completions, original] = completer('/help');
      expect(completions).toContain('/help');
      expect(original).toBe('/help');
    });

    test('case-insensitive matching', () => {
      const [completions, original] = completer('/H');
      expect(completions).toContain('/help');
      expect(completions).toContain('/h');
      expect(original).toBe('/H');
    });

    test('no matches returns empty array', () => {
      const [completions, original] = completer('/xyz');
      expect(completions).toEqual([]);
      expect(original).toBe('/xyz');
    });

    test('/se completes to /sessions', () => {
      const [completions, original] = completer('/se');
      expect(completions).toContain('/sessions');
      expect(original).toBe('/se');
    });

    test('/qu completes to /quit', () => {
      const [completions, original] = completer('/qu');
      expect(completions).toContain('/quit');
      expect(original).toBe('/qu');
    });
  });
});
