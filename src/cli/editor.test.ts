/**
 * Tests for Editor Integration
 *
 * Tests the separator stripping logic and content building for the /edit command.
 * These test pure functions — no editor spawning or file I/O.
 */
import { describe, test, expect } from 'vitest';
import {
  stripSeparator,
  buildEditorContent,
  SEPARATOR_BOTTOM,
  SEPARATOR,
} from './editor.js';

// =============================================================================
// stripSeparator() Tests
// =============================================================================

describe('stripSeparator', () => {
  test('returns content below separator when separator is present', () => {
    const content = `Some agent message\n\n${SEPARATOR}\n\nUser message here`;
    const result = stripSeparator(content);
    expect(result).toBe('User message here');
  });

  test('returns null when content below separator is empty', () => {
    const content = `Some agent message\n\n${SEPARATOR}\n\n`;
    const result = stripSeparator(content);
    expect(result).toBeNull();
  });

  test('returns null when content below separator is only whitespace', () => {
    const content = `Some agent message\n\n${SEPARATOR}\n\n   \n  \n`;
    const result = stripSeparator(content);
    expect(result).toBeNull();
  });

  test('returns entire content when separator is not found (fallback)', () => {
    const content = 'User typed something without separator';
    const result = stripSeparator(content);
    expect(result).toBe('User typed something without separator');
  });

  test('returns null when content is empty and no separator', () => {
    const result = stripSeparator('');
    expect(result).toBeNull();
  });

  test('returns null when content is only whitespace and no separator', () => {
    const result = stripSeparator('   \n  \n  ');
    expect(result).toBeNull();
  });

  test('uses last occurrence of separator bottom line', () => {
    // Agent message contains the separator bottom line text
    const content = [
      `Here is the separator: ${SEPARATOR_BOTTOM}`,
      '',
      SEPARATOR,
      '',
      'Real user message',
    ].join('\n');

    const result = stripSeparator(content);
    expect(result).toBe('Real user message');
  });

  test('preserves multiline user content below separator', () => {
    const content = [
      'Agent message',
      '',
      SEPARATOR,
      '',
      'Line 1',
      'Line 2',
      'Line 3',
    ].join('\n');

    const result = stripSeparator(content);
    expect(result).toBe('Line 1\nLine 2\nLine 3');
  });

  test('ignores content user writes above separator', () => {
    const content = [
      'Agent message',
      'User added text above separator',
      '',
      SEPARATOR,
      '',
      'Actual user message',
    ].join('\n');

    const result = stripSeparator(content);
    expect(result).toBe('Actual user message');
  });
});

// =============================================================================
// buildEditorContent() Tests
// =============================================================================

describe('buildEditorContent', () => {
  test('includes agent message above separator when provided', () => {
    const content = buildEditorContent('Hello from agent');
    expect(content).toContain('Hello from agent');
    expect(content).toContain(SEPARATOR);
    // Agent message should come before separator
    const agentIndex = content.indexOf('Hello from agent');
    const separatorIndex = content.indexOf(SEPARATOR);
    expect(agentIndex).toBeLessThan(separatorIndex);
  });

  test('includes just separator when no agent message', () => {
    const content = buildEditorContent();
    expect(content).toContain(SEPARATOR);
    // Should not have agent message content before separator
    const separatorIndex = content.indexOf(SEPARATOR);
    const beforeSeparator = content.slice(0, separatorIndex).trim();
    expect(beforeSeparator).toBe('');
  });

  test('includes just separator when agent message is undefined', () => {
    const content = buildEditorContent(undefined);
    expect(content).toContain(SEPARATOR);
  });

  test('ends with newlines after separator for user input area', () => {
    const content = buildEditorContent('Agent says hi');
    // Content after separator should end with space for user to type
    expect(content.endsWith('\n')).toBe(true);
  });

  test('roundtrips correctly: build content then strip returns null (no user input)', () => {
    const content = buildEditorContent('Agent message here');
    const result = stripSeparator(content);
    expect(result).toBeNull();
  });

  test('roundtrips correctly: build content, add user text, strip returns user text', () => {
    const content = buildEditorContent('Agent message here');
    const withUserInput = content + 'User typed this';
    const result = stripSeparator(withUserInput);
    expect(result).toBe('User typed this');
  });
});
