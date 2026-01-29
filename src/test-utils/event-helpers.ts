/**
 * Event Testing Helpers
 *
 * Utilities for testing EventEmitter-based code.
 * These are NOT mocks - they work with real EventEmitter instances.
 */
import { EventEmitter } from 'events';

/**
 * Waits for an event to be emitted, returns event data.
 * Rejects if event is not emitted within timeout.
 *
 * @param emitter The EventEmitter to listen on
 * @param event The event name to wait for
 * @param timeout Maximum time to wait in milliseconds (default: 5000)
 * @returns Promise that resolves with the event data
 *
 * @example
 * const data = await waitForEvent(watcher, 'bean:created');
 * expect(data.id).toBe('expected-id');
 */
export async function waitForEvent<T>(
  emitter: EventEmitter,
  event: string,
  timeout = 5000
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Event ${event} not emitted within ${timeout}ms`));
    }, timeout);

    emitter.once(event, (data: T) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

/**
 * Collects all events emitted during an async operation.
 * Automatically removes listener after operation completes.
 *
 * @param emitter The EventEmitter to listen on
 * @param event The event name to collect
 * @param fn The async operation to run
 * @returns Array of all event data collected
 *
 * @example
 * const events = await collectEvents(scheduler, 'bean:scheduled', async () => {
 *   await scheduler.processQueue();
 * });
 * expect(events).toHaveLength(3);
 */
export async function collectEvents<T>(
  emitter: EventEmitter,
  event: string,
  fn: () => Promise<void>
): Promise<T[]> {
  const events: T[] = [];
  const handler = (data: T) => events.push(data);

  emitter.on(event, handler);
  try {
    await fn();
    return events;
  } finally {
    emitter.off(event, handler);
  }
}
