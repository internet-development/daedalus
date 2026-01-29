/**
 * Tests for event-helpers.ts
 *
 * These tests verify event testing utilities work correctly
 * using real EventEmitter instances.
 */
import { describe, test, expect } from 'vitest';
import { EventEmitter } from 'events';
import { waitForEvent, collectEvents } from './event-helpers.js';

describe('waitForEvent', () => {
  test('resolves when event is emitted', async () => {
    const emitter = new EventEmitter();

    // Start waiting for event
    const promise = waitForEvent<string>(emitter, 'test-event');

    // Emit the event after a short delay
    setTimeout(() => emitter.emit('test-event', 'hello'), 10);

    const result = await promise;
    expect(result).toBe('hello');
  });

  test('resolves with event data object', async () => {
    const emitter = new EventEmitter();

    const promise = waitForEvent<{ id: number; name: string }>(
      emitter,
      'data-event'
    );

    setTimeout(() => emitter.emit('data-event', { id: 1, name: 'test' }), 10);

    const result = await promise;
    expect(result).toEqual({ id: 1, name: 'test' });
  });

  test('rejects if event not emitted within timeout', async () => {
    const emitter = new EventEmitter();

    await expect(
      waitForEvent(emitter, 'never-emitted', 50)
    ).rejects.toThrow('Event never-emitted not emitted within 50ms');
  });

  test('uses default timeout of 5000ms', async () => {
    const emitter = new EventEmitter();

    // This test just verifies the function accepts no timeout
    // We don't actually wait 5 seconds
    const promise = waitForEvent(emitter, 'quick-event');
    setTimeout(() => emitter.emit('quick-event', 'fast'), 10);

    const result = await promise;
    expect(result).toBe('fast');
  });

  test('only captures first event emission', async () => {
    const emitter = new EventEmitter();

    const promise = waitForEvent<number>(emitter, 'multi-emit');

    setTimeout(() => {
      emitter.emit('multi-emit', 1);
      emitter.emit('multi-emit', 2);
      emitter.emit('multi-emit', 3);
    }, 10);

    const result = await promise;
    expect(result).toBe(1);
  });
});

describe('collectEvents', () => {
  test('collects all events emitted during async operation', async () => {
    const emitter = new EventEmitter();

    const events = await collectEvents<string>(emitter, 'log', async () => {
      emitter.emit('log', 'first');
      emitter.emit('log', 'second');
      emitter.emit('log', 'third');
    });

    expect(events).toEqual(['first', 'second', 'third']);
  });

  test('returns empty array if no events emitted', async () => {
    const emitter = new EventEmitter();

    const events = await collectEvents<string>(emitter, 'nothing', async () => {
      // Do nothing
    });

    expect(events).toEqual([]);
  });

  test('collects events with object data', async () => {
    const emitter = new EventEmitter();

    interface LogEvent {
      level: string;
      message: string;
    }

    const events = await collectEvents<LogEvent>(emitter, 'log', async () => {
      emitter.emit('log', { level: 'info', message: 'Starting' });
      emitter.emit('log', { level: 'warn', message: 'Warning' });
      emitter.emit('log', { level: 'error', message: 'Failed' });
    });

    expect(events).toHaveLength(3);
    expect(events[0]).toEqual({ level: 'info', message: 'Starting' });
    expect(events[2]).toEqual({ level: 'error', message: 'Failed' });
  });

  test('removes listener after operation completes', async () => {
    const emitter = new EventEmitter();

    await collectEvents<string>(emitter, 'test', async () => {
      emitter.emit('test', 'during');
    });

    // Verify listener was removed
    expect(emitter.listenerCount('test')).toBe(0);
  });

  test('removes listener even if operation throws', async () => {
    const emitter = new EventEmitter();

    await expect(
      collectEvents<string>(emitter, 'test', async () => {
        emitter.emit('test', 'before-error');
        throw new Error('Operation failed');
      })
    ).rejects.toThrow('Operation failed');

    // Verify listener was removed
    expect(emitter.listenerCount('test')).toBe(0);
  });

  test('only collects specified event type', async () => {
    const emitter = new EventEmitter();

    const events = await collectEvents<string>(emitter, 'target', async () => {
      emitter.emit('other', 'ignored');
      emitter.emit('target', 'collected');
      emitter.emit('another', 'also-ignored');
    });

    expect(events).toEqual(['collected']);
  });
});
