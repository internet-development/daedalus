/**
 * Tests for async-helpers.ts
 *
 * These tests verify async testing utilities work correctly.
 */
import { describe, test, expect } from 'vitest';
import { waitUntil, sleep } from './async-helpers.js';

describe('sleep', () => {
  test('resolves after specified milliseconds', async () => {
    const start = Date.now();
    await sleep(50);
    const elapsed = Date.now() - start;

    // Allow some tolerance for timing
    expect(elapsed).toBeGreaterThanOrEqual(45);
    expect(elapsed).toBeLessThan(100);
  });

  test('resolves with undefined', async () => {
    const result = await sleep(10);
    expect(result).toBeUndefined();
  });
});

describe('waitUntil', () => {
  test('resolves immediately if condition is true', async () => {
    const start = Date.now();
    await waitUntil(() => true);
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(50);
  });

  test('polls until condition becomes true', async () => {
    let counter = 0;

    await waitUntil(() => {
      counter++;
      return counter >= 3;
    });

    expect(counter).toBe(3);
  });

  test('works with async condition', async () => {
    let counter = 0;

    await waitUntil(async () => {
      counter++;
      await sleep(10);
      return counter >= 2;
    });

    expect(counter).toBe(2);
  });

  test('rejects if condition not met within timeout', async () => {
    await expect(
      waitUntil(() => false, 50, 10)
    ).rejects.toThrow('Condition not met within 50ms');
  });

  test('uses default timeout of 5000ms', async () => {
    // This test just verifies the function accepts no timeout
    // We don't actually wait 5 seconds
    let resolved = false;
    setTimeout(() => {
      resolved = true;
    }, 20);

    await waitUntil(() => resolved);
    expect(resolved).toBe(true);
  });

  test('uses custom interval for polling', async () => {
    let checkCount = 0;
    const start = Date.now();

    await waitUntil(
      () => {
        checkCount++;
        return checkCount >= 3;
      },
      1000,
      50 // 50ms interval
    );

    const elapsed = Date.now() - start;

    // Should take at least 100ms (2 intervals of 50ms)
    expect(elapsed).toBeGreaterThanOrEqual(90);
    expect(checkCount).toBe(3);
  });

  test('stops polling after condition is met', async () => {
    let checkCount = 0;

    await waitUntil(() => {
      checkCount++;
      return true;
    });

    // Wait a bit to ensure no more polling
    await sleep(50);

    expect(checkCount).toBe(1);
  });
});
