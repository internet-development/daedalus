/**
 * Tests for Session Naming Module
 *
 * Tests the AI-powered session naming with fallback to heuristics.
 */
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ChatMessage } from '../planning/chat-history.js';
import {
  generateNameHeuristic,
  buildConversationContext,
  cleanSessionName,
  generateNameWithAI,
  generateSessionName,
} from './session-naming.js';

// =============================================================================
// Test Data
// =============================================================================

const createMessage = (
  role: 'user' | 'assistant',
  content: string,
  timestamp = Date.now()
): ChatMessage => ({
  role,
  content,
  timestamp,
});

const sampleMessages: ChatMessage[] = [
  createMessage('user', 'Help me implement a dark mode toggle'),
  createMessage('assistant', 'I can help you with that. First, let me understand your current setup.'),
  createMessage('user', 'I am using React with styled-components'),
  createMessage('assistant', 'Great! Here is how we can implement dark mode...'),
];

// =============================================================================
// Heuristic Naming Tests
// =============================================================================

describe('generateNameHeuristic', () => {
  test('returns first 5 words capitalized', () => {
    const messages = [createMessage('user', 'help me fix the login bug')];
    const name = generateNameHeuristic(messages);
    expect(name).toBe('Help Me Fix The Login');
  });

  test('handles messages with fewer than 5 words', () => {
    const messages = [createMessage('user', 'hello world')];
    const name = generateNameHeuristic(messages);
    expect(name).toBe('Hello World');
  });

  test('returns null for empty messages', () => {
    const name = generateNameHeuristic([]);
    expect(name).toBeNull();
  });

  test('returns null for messages with only assistant content', () => {
    const messages = [createMessage('assistant', 'How can I help you?')];
    const name = generateNameHeuristic(messages);
    expect(name).toBeNull();
  });

  test('truncates to 30 characters', () => {
    const messages = [
      createMessage('user', 'this is a very long message that should be truncated'),
    ];
    const name = generateNameHeuristic(messages);
    expect(name!.length).toBeLessThanOrEqual(30);
  });

  test('uses first user message only', () => {
    const messages = [
      createMessage('assistant', 'Hello!'),
      createMessage('user', 'first user message here'),
      createMessage('user', 'second user message'),
    ];
    const name = generateNameHeuristic(messages);
    expect(name).toBe('First User Message Here');
  });
});

// =============================================================================
// Conversation Context Tests
// =============================================================================

describe('buildConversationContext', () => {
  test('includes first 3 user messages', () => {
    const messages = [
      createMessage('user', 'message one'),
      createMessage('user', 'message two'),
      createMessage('user', 'message three'),
      createMessage('user', 'message four'),
    ];
    const context = buildConversationContext(messages);
    expect(context).toContain('User: message one');
    expect(context).toContain('User: message two');
    expect(context).toContain('User: message three');
    expect(context).not.toContain('User: message four');
  });

  test('includes first 2 assistant messages', () => {
    const messages = [
      createMessage('assistant', 'response one'),
      createMessage('assistant', 'response two'),
      createMessage('assistant', 'response three'),
    ];
    const context = buildConversationContext(messages);
    expect(context).toContain('Assistant: response one');
    expect(context).toContain('Assistant: response two');
    expect(context).not.toContain('Assistant: response three');
  });

  test('truncates long messages to 200 chars', () => {
    const longContent = 'a'.repeat(300);
    const messages = [createMessage('user', longContent)];
    const context = buildConversationContext(messages);
    expect(context.length).toBeLessThan(250); // 200 + "User: " prefix
  });

  test('returns empty string for empty messages', () => {
    const context = buildConversationContext([]);
    expect(context).toBe('');
  });

  test('interleaves user and assistant messages', () => {
    const context = buildConversationContext(sampleMessages);
    const lines = context.split('\n');
    // Should have user, assistant, user, assistant pattern
    expect(lines[0]).toContain('User:');
    expect(lines[1]).toContain('Assistant:');
    expect(lines[2]).toContain('User:');
    expect(lines[3]).toContain('Assistant:');
  });
});

// =============================================================================
// Clean Session Name Tests
// =============================================================================

describe('cleanSessionName', () => {
  test('trims whitespace', () => {
    expect(cleanSessionName('  hello world  ')).toBe('hello world');
  });

  test('removes surrounding double quotes', () => {
    expect(cleanSessionName('"Dark Mode Toggle"')).toBe('Dark Mode Toggle');
  });

  test('removes surrounding single quotes', () => {
    expect(cleanSessionName("'Dark Mode Toggle'")).toBe('Dark Mode Toggle');
  });

  test('removes emoji', () => {
    expect(cleanSessionName('Dark Mode 🌙 Toggle')).toBe('Dark Mode Toggle');
  });

  test('removes special characters', () => {
    expect(cleanSessionName('Dark Mode: Toggle!')).toBe('Dark Mode Toggle');
  });

  test('keeps hyphens', () => {
    expect(cleanSessionName('Dark-Mode Toggle')).toBe('Dark-Mode Toggle');
  });

  test('collapses multiple spaces', () => {
    expect(cleanSessionName('Dark   Mode   Toggle')).toBe('Dark Mode Toggle');
  });

  test('truncates to 30 characters', () => {
    const longName = 'This Is A Very Long Session Name That Should Be Truncated';
    const cleaned = cleanSessionName(longName);
    expect(cleaned.length).toBeLessThanOrEqual(30);
  });

  test('handles empty string', () => {
    expect(cleanSessionName('')).toBe('');
  });

  test('handles string with only special characters', () => {
    expect(cleanSessionName('🎉🎊🎈')).toBe('');
  });
});

// =============================================================================
// AI Naming Tests (Integration)
// =============================================================================

describe('generateNameWithAI', () => {
  // Skip these tests if no API key is available
  const hasApiKey = !!process.env.ANTHROPIC_API_KEY;

  test.skipIf(!hasApiKey)('generates a name from conversation', async () => {
    const name = await generateNameWithAI(sampleMessages, { timeout: 10000 });
    
    // Should return a non-empty string
    expect(name).toBeTruthy();
    expect(typeof name).toBe('string');
    
    // Should be within length limits
    expect(name!.length).toBeLessThanOrEqual(30);
    
    // Should not contain emoji or special chars
    expect(name).not.toMatch(/[^\w\s-]/);
  }, 15000);

  test('returns null for empty messages', async () => {
    const name = await generateNameWithAI([]);
    expect(name).toBeNull();
  });

  test('returns null for messages with only whitespace content', async () => {
    const messages = [createMessage('user', '   ')];
    const name = await generateNameWithAI(messages);
    expect(name).toBeNull();
  });

  test.skipIf(!hasApiKey)('respects timeout', async () => {
    // Use a very short timeout that should fail
    const name = await generateNameWithAI(sampleMessages, { timeout: 1 });
    expect(name).toBeNull();
  });
});

// =============================================================================
// Main Function Tests
// =============================================================================

describe('generateSessionName', () => {
  test('falls back to heuristic when AI is unavailable', async () => {
    // Without API key, should fall back to heuristic
    const messages = [createMessage('user', 'help me with dark mode')];
    const name = await generateSessionName(messages, { timeout: 1 });
    
    // Should get heuristic result
    expect(name).toBe('Help Me With Dark Mode');
  });

  test('returns null for empty messages', async () => {
    const name = await generateSessionName([]);
    expect(name).toBeNull();
  });

  test('returns null for assistant-only messages', async () => {
    const messages = [createMessage('assistant', 'How can I help?')];
    const name = await generateSessionName(messages);
    expect(name).toBeNull();
  });
});

// =============================================================================
// Edge Cases
// =============================================================================

describe('Edge Cases', () => {
  test('handles messages with newlines', () => {
    const messages = [createMessage('user', 'line one\nline two\nline three')];
    const name = generateNameHeuristic(messages);
    expect(name).toBeTruthy();
  });

  test('handles messages with tabs', () => {
    const messages = [createMessage('user', 'word1\tword2\tword3')];
    const name = generateNameHeuristic(messages);
    expect(name).toBeTruthy();
  });

  test('handles unicode characters', () => {
    const messages = [createMessage('user', 'café résumé naïve')];
    const name = generateNameHeuristic(messages);
    // Should handle accented characters
    expect(name).toBeTruthy();
  });

  test('handles very short messages', () => {
    const messages = [createMessage('user', 'hi')];
    const name = generateNameHeuristic(messages);
    expect(name).toBe('Hi');
  });

  test('handles single character message', () => {
    const messages = [createMessage('user', 'x')];
    const name = generateNameHeuristic(messages);
    expect(name).toBe('X');
  });
});
