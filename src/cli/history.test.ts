/**
 * Tests for /history command
 *
 * Tests the command parser, message filtering, and display formatting.
 */
import { describe, test, expect } from 'vitest';
import type { ChatMessage } from '../planning/chat-history.js';
import { formatHistory, filterHistoryMessages, parseHistoryArgs } from './history.js';
import { COMMAND_NAMES } from './commands.js';
import { formatHelp } from './output.js';

// Helper to strip ANSI codes for easier testing
const stripAnsi = (str: string) => str.replace(/\x1b\[[0-9;]*m/g, '');

// =============================================================================
// Test Data Helpers
// =============================================================================

function makeMessage(
  role: ChatMessage['role'],
  content: string,
  minutesAgo: number,
  toolCalls?: ChatMessage['toolCalls']
): ChatMessage {
  return {
    role,
    content,
    timestamp: Date.now() - minutesAgo * 60 * 1000,
    toolCalls,
  };
}

// =============================================================================
// Command Registration
// =============================================================================

describe('Command Registration', () => {
  test('/history is in COMMAND_NAMES', () => {
    expect(COMMAND_NAMES).toContain('/history');
  });

  test('/hist alias is in COMMAND_NAMES', () => {
    expect(COMMAND_NAMES).toContain('/hist');
  });

  test('/history appears in help output', () => {
    const help = stripAnsi(formatHelp());
    expect(help).toContain('/history');
    expect(help).toContain('Show recent messages');
  });
});

// =============================================================================
// parseHistoryArgs
// =============================================================================

describe('parseHistoryArgs', () => {
  test('returns default count (10) when no args', () => {
    const result = parseHistoryArgs('');
    expect(result).toEqual({ count: 10 });
  });

  test('returns default count for whitespace-only args', () => {
    const result = parseHistoryArgs('   ');
    expect(result).toEqual({ count: 10 });
  });

  test('parses numeric arg as count', () => {
    const result = parseHistoryArgs('5');
    expect(result).toEqual({ count: 5 });
  });

  test('parses "all" as Infinity count', () => {
    const result = parseHistoryArgs('all');
    expect(result).toEqual({ count: Infinity });
  });

  test('parses "all" case-insensitively', () => {
    const result = parseHistoryArgs('ALL');
    expect(result).toEqual({ count: Infinity });
  });

  test('returns default for non-numeric, non-all args', () => {
    const result = parseHistoryArgs('foo');
    expect(result).toEqual({ count: 10 });
  });

  test('parses arg with surrounding whitespace', () => {
    const result = parseHistoryArgs('  20  ');
    expect(result).toEqual({ count: 20 });
  });
});

// =============================================================================
// filterHistoryMessages
// =============================================================================

describe('filterHistoryMessages', () => {
  test('passes through user messages', () => {
    const messages = [makeMessage('user', 'hello', 5)];
    const result = filterHistoryMessages(messages);
    expect(result).toHaveLength(1);
    expect(result[0].content).toBe('hello');
  });

  test('passes through assistant messages with content and no tool calls', () => {
    const messages = [makeMessage('assistant', 'Sure, let me help', 3)];
    const result = filterHistoryMessages(messages);
    expect(result).toHaveLength(1);
  });

  test('passes through system messages', () => {
    const messages = [makeMessage('system', 'System prompt', 10)];
    const result = filterHistoryMessages(messages);
    expect(result).toHaveLength(1);
  });

  test('omits assistant messages with toolCalls but no content', () => {
    const messages = [
      makeMessage('assistant', '', 3, [
        { name: 'bash', args: { command: 'ls' } },
      ]),
    ];
    const result = filterHistoryMessages(messages);
    expect(result).toHaveLength(0);
  });

  test('keeps assistant messages with both content and toolCalls', () => {
    const messages = [
      makeMessage('assistant', 'Let me check that', 3, [
        { name: 'bash', args: { command: 'ls' } },
      ]),
    ];
    const result = filterHistoryMessages(messages);
    expect(result).toHaveLength(1);
    expect(result[0].content).toBe('Let me check that');
  });

  test('handles mixed messages correctly', () => {
    const messages = [
      makeMessage('user', 'hello', 10),
      makeMessage('assistant', '', 9, [{ name: 'bash' }]),  // should be filtered
      makeMessage('assistant', 'Here is the result', 8),
      makeMessage('user', 'thanks', 7),
      makeMessage('assistant', 'Also check this', 6, [{ name: 'read' }]),  // has content, keep
    ];
    const result = filterHistoryMessages(messages);
    expect(result).toHaveLength(4);
    expect(result.map((m) => m.content)).toEqual([
      'hello',
      'Here is the result',
      'thanks',
      'Also check this',
    ]);
  });
});

// =============================================================================
// formatHistory
// =============================================================================

describe('formatHistory', () => {
  test('shows "No messages in this session" for empty messages', () => {
    const result = formatHistory([], 10);
    const plain = stripAnsi(result);
    expect(plain).toContain('No messages in this session');
  });

  test('shows header with message count', () => {
    const messages = [
      makeMessage('user', 'hello', 5),
      makeMessage('assistant', 'hi there', 4),
    ];
    const result = formatHistory(messages, 10);
    const plain = stripAnsi(result);
    expect(plain).toContain('History');
    expect(plain).toContain('2 messages');
  });

  test('shows "last N messages" when slicing', () => {
    const messages = [
      makeMessage('user', 'first', 10),
      makeMessage('user', 'second', 5),
      makeMessage('user', 'third', 1),
    ];
    const result = formatHistory(messages, 2);
    const plain = stripAnsi(result);
    expect(plain).toContain('last 2 messages');
    // Should only show the last 2
    expect(plain).not.toContain('first');
    expect(plain).toContain('second');
    expect(plain).toContain('third');
  });

  test('shows "all N messages" when count >= total', () => {
    const messages = [
      makeMessage('user', 'hello', 5),
    ];
    const result = formatHistory(messages, 10);
    const plain = stripAnsi(result);
    expect(plain).toContain('all 1 messages');
  });

  test('formats user messages with [user] role label', () => {
    const messages = [makeMessage('user', 'hello world', 5)];
    const result = formatHistory(messages, 10);
    const plain = stripAnsi(result);
    expect(plain).toContain('[user]');
    expect(plain).toContain('hello world');
  });

  test('formats assistant messages with [assistant] role label', () => {
    const messages = [makeMessage('assistant', 'I can help', 3)];
    const result = formatHistory(messages, 10);
    const plain = stripAnsi(result);
    expect(plain).toContain('[assistant]');
    expect(plain).toContain('I can help');
  });

  test('formats system messages with [system] role label', () => {
    const messages = [makeMessage('system', 'System initialized', 10)];
    const result = formatHistory(messages, 10);
    const plain = stripAnsi(result);
    expect(plain).toContain('[system]');
    expect(plain).toContain('System initialized');
  });

  test('shows relative timestamps', () => {
    const messages = [makeMessage('user', 'hello', 3)];
    const result = formatHistory(messages, 10);
    const plain = stripAnsi(result);
    expect(plain).toContain('3m ago');
  });

  test('truncates long messages to ~3 lines', () => {
    const longContent = 'Line one of the message\nLine two of the message\nLine three of the message\nLine four should be cut\nLine five should be cut';
    const messages = [makeMessage('user', longContent, 5)];
    const result = formatHistory(messages, 10);
    const plain = stripAnsi(result);
    expect(plain).toContain('Line one');
    expect(plain).toContain('Line two');
    expect(plain).toContain('Line three');
    expect(plain).toContain('...');
    expect(plain).not.toContain('Line four');
    expect(plain).not.toContain('Line five');
  });

  test('does not truncate short messages', () => {
    const messages = [makeMessage('user', 'short message', 5)];
    const result = formatHistory(messages, 10);
    const plain = stripAnsi(result);
    expect(plain).toContain('short message');
    // Should not have truncation indicator for short messages
    // (only check that the content is there, not that "..." is absent,
    // since "..." might appear in the divider)
  });

  test('indents message content', () => {
    const messages = [makeMessage('user', 'hello', 5)];
    const result = formatHistory(messages, 10);
    // Content should be indented (starts with spaces)
    expect(result).toMatch(/\n {2}hello/);
  });
});
