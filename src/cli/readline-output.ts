/**
 * Mutable Output Stream for Readline
 *
 * Provides a Writable stream that can be muted/unmuted to prevent
 * readline's cursor management from interfering with direct stdout
 * writes (e.g., spinner animations using \r for in-place updates).
 *
 * When readline is created with `output: process.stdout`, it intercepts
 * all writes for cursor tracking. This causes spinner \r-based updates
 * to print on new lines instead of updating in-place.
 *
 * Solution: Create readline with `output: mutableStream` instead.
 * During streaming/spinner output, mute the stream so readline's
 * internal writes are silently discarded. Unmute when returning to
 * the interactive prompt.
 *
 * See bean daedalus-8b67.
 */
import { Writable } from 'stream';

// =============================================================================
// Types
// =============================================================================

export interface MutableOutput {
  /** The writable stream to pass to readline's `output` option */
  stream: Writable;
  /** Mute the stream — writes are silently discarded */
  mute: () => void;
  /** Unmute the stream — writes forward to process.stdout */
  unmute: () => void;
}

// =============================================================================
// Implementation
// =============================================================================

/**
 * Create a mutable output stream that forwards to process.stdout.
 *
 * By default, writes are forwarded (unmuted). Call `mute()` before
 * streaming/spinner operations and `unmute()` when returning to
 * the interactive prompt.
 *
 * @returns MutableOutput with stream, mute(), and unmute() methods
 */
export function createMutableOutput(): MutableOutput {
  let muted = false;

  const stream = new Writable({
    write(chunk: Buffer | string, encoding: BufferEncoding, callback: (error?: Error | null) => void) {
      if (muted) {
        callback();
        return;
      }
      process.stdout.write(chunk, encoding, callback);
    },
  });

  return {
    stream,
    mute() {
      muted = true;
    },
    unmute() {
      muted = false;
    },
  };
}
