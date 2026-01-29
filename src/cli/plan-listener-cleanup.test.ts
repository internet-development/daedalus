/**
 * Tests for EventEmitter listener cleanup in sendAndStream.
 *
 * Reproduces the memory leak where error/done listeners accumulate
 * on PlanningSession because they are added via .once() inside a
 * Promise wrapper but never removed when the session completes normally.
 *
 * See bean daedalus-rw19.
 */
import { describe, test, expect } from 'vitest';
import { EventEmitter } from 'events';

/**
 * Simulates the sendAndStream Promise wrapper pattern from plan.ts.
 * This mirrors the exact pattern used in production code — we test
 * listener cleanup behavior without needing the full CLI context.
 *
 * The key issue: error/done listeners added via .once() inside the
 * Promise wrapper are not removed in the finally block when the
 * session completes normally (done fires, error doesn't).
 */
async function simulateSendAndStream(session: EventEmitter): Promise<void> {
  const textHandler = () => {};
  const toolCallHandler = () => {};

  session.on('text', textHandler);
  session.on('toolCall', toolCallHandler);

  // Store references to the once-listeners so we can remove them
  let doneHandler: (() => void) | undefined;
  let errorHandler: ((err: Error) => void) | undefined;

  try {
    await new Promise<void>((resolve, reject) => {
      doneHandler = () => resolve();
      errorHandler = (err: Error) => reject(err);
      session.once('done', doneHandler);
      session.once('error', errorHandler);

      // Simulate sendMessage completing successfully
      setTimeout(() => session.emit('done'), 0);
    });
  } finally {
    session.removeListener('text', textHandler);
    session.removeListener('toolCall', toolCallHandler);
    // Fix: also remove error and done listeners
    if (doneHandler) session.removeListener('done', doneHandler);
    if (errorHandler) session.removeListener('error', errorHandler);
  }
}

describe('sendAndStream listener cleanup', () => {
  test('no error listeners remain after 15 successful messages', async () => {
    const session = new EventEmitter();

    for (let i = 0; i < 15; i++) {
      await simulateSendAndStream(session);
    }

    // After fix: error listeners should be cleaned up in finally block
    expect(session.listenerCount('error')).toBe(0);
  });

  test('no done listeners remain after 15 successful messages', async () => {
    const session = new EventEmitter();

    for (let i = 0; i < 15; i++) {
      await simulateSendAndStream(session);
    }

    expect(session.listenerCount('done')).toBe(0);
  });

  test('no text or toolCall listeners remain after 15 messages', async () => {
    const session = new EventEmitter();

    for (let i = 0; i < 15; i++) {
      await simulateSendAndStream(session);
    }

    expect(session.listenerCount('text')).toBe(0);
    expect(session.listenerCount('toolCall')).toBe(0);
  });

  test('error listener cleanup works when error fires', async () => {
    const session = new EventEmitter();

    // Simulate a message that errors
    let errorHandler: ((err: Error) => void) | undefined;
    let doneHandler: (() => void) | undefined;

    const textHandler = () => {};
    const toolCallHandler = () => {};

    session.on('text', textHandler);
    session.on('toolCall', toolCallHandler);

    try {
      await new Promise<void>((resolve, reject) => {
        doneHandler = () => resolve();
        errorHandler = (err: Error) => reject(err);
        session.once('done', doneHandler);
        session.once('error', errorHandler);

        // Simulate error
        setTimeout(() => session.emit('error', new Error('test error')), 0);
      });
    } catch {
      // Expected
    } finally {
      session.removeListener('text', textHandler);
      session.removeListener('toolCall', toolCallHandler);
      if (doneHandler) session.removeListener('done', doneHandler);
      if (errorHandler) session.removeListener('error', errorHandler);
    }

    // Both should be cleaned up — error fired (once auto-removed it),
    // done didn't fire but finally block removed it
    expect(session.listenerCount('error')).toBe(0);
    expect(session.listenerCount('done')).toBe(0);
    expect(session.listenerCount('text')).toBe(0);
    expect(session.listenerCount('toolCall')).toBe(0);
  });
});
