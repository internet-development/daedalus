import { describe, test, expect } from 'vitest';
import { toSlug } from './string-helpers.js';

describe('toSlug', () => {
  test('converts basic string to lowercase slug', () => {
    expect(toSlug('My Feature Title')).toBe('my-feature-title');
  });
});
