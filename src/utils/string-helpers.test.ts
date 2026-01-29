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

  test('handles Unicode characters', () => {
    expect(toSlug('Café au Lait')).toBe('caf-au-lait');
    expect(toSlug('日本語')).toBe('');
    expect(toSlug('Über Cool')).toBe('ber-cool');
    expect(toSlug('naïve résumé')).toBe('nave-rsum');
  });

  test('respects maximum length limit', () => {
    const longTitle = 'This is a very long title that should be truncated';
    expect(toSlug(longTitle, { maxLength: 20 })).toBe('this-is-a-very-long');
    expect(toSlug(longTitle, { maxLength: 10 })).toBe('this-is-a');
    // Should not cut in the middle of a word if possible
    expect(toSlug('Hello World', { maxLength: 8 })).toBe('hello');
  });

  test('preserves existing hyphens in input', () => {
    expect(toSlug('pre-existing-slug')).toBe('pre-existing-slug');
    expect(toSlug('kebab-case-title')).toBe('kebab-case-title');
  });

  test('handles numbers correctly', () => {
    expect(toSlug('Version 2.0')).toBe('version-20');
    expect(toSlug('123 Numbers First')).toBe('123-numbers-first');
    expect(toSlug('Test123Test')).toBe('test123test');
  });
});
