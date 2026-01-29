import { describe, test, expect } from 'vitest';
import { toSlug } from './string-helpers.js';

describe('toSlug', () => {
  test('converts basic string to lowercase slug', () => {
    expect(toSlug('My Feature Title')).toBe('my-feature-title');
  });

  test('removes special characters and punctuation', () => {
    expect(toSlug('Fix Bug #123')).toBe('fix-bug-123');
    expect(toSlug('Add CLI Support!')).toBe('add-cli-support');
    expect(toSlug('Hello, World?')).toBe('hello-world');
  });

  test('handles multiple spaces and whitespace', () => {
    expect(toSlug('Multiple   Spaces')).toBe('multiple-spaces');
    expect(toSlug('  Leading and Trailing  ')).toBe('leading-and-trailing');
    expect(toSlug('Tabs\tand\nnewlines')).toBe('tabs-and-newlines');
  });

  test('handles empty strings and edge cases', () => {
    expect(toSlug('')).toBe('');
    expect(toSlug('   ')).toBe('');
    expect(toSlug('---')).toBe('');
  });
});
