/**
 * Async Testing Helpers
 *
 * Utilities for testing async operations.
 * These are NOT mocks - they work with real async behavior.
 */

/**
 * Sleep helper for tests.
 * Returns a promise that resolves after the specified milliseconds.
 *
 * @param ms Milliseconds to sleep
 * @returns Promise that resolves after delay
 *
 * @example
 * await sleep(100);
 * expect(someState).toBe('updated');
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Polls a condition until it returns true or times out.
 * Useful for waiting for async state changes.
 *
 * @param condition Function that returns boolean or Promise<boolean>
 * @param timeout Maximum time to wait in milliseconds (default: 5000)
 * @param interval Time between polls in milliseconds (default: 100)
 * @returns Promise that resolves when condition is true
 * @throws Error if condition not met within timeout
 *
 * @example
 * await waitUntil(() => queue.length > 0);
 * expect(queue[0]).toBe('expected-item');
 */
export async function waitUntil(
  condition: () => boolean | Promise<boolean>,
  timeout = 5000,
  interval = 100
): Promise<void> {
  const start = Date.now();

  while (Date.now() - start < timeout) {
    if (await condition()) {
      return;
    }
    await sleep(interval);
  }

  throw new Error(`Condition not met within ${timeout}ms`);
}
