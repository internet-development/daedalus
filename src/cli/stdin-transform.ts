/**
 * Stdin Transform Stream
 *
 * Creates a Transform stream that intercepts stdin data and translates
 * known Shift+Enter escape sequences before they reach readline.
 *
 * This allows readline to continue functioning normally (with history,
 * completion, cursor movement, etc.) while properly handling Shift+Enter
 * as a continuation signal for multi-line input.
 */
import { Transform, type TransformCallback } from 'stream';
import { translateShiftEnter, containsShiftEnter } from './shift-enter.js';

/**
 * Create a Transform stream that translates Shift+Enter escape sequences.
 *
 * The stream intercepts raw stdin data and replaces known Shift+Enter
 * escape sequences with a backslash + CR marker. This triggers readline's
 * line submission while the backslash triggers the existing multi-line
 * continuation logic in processInputLine.
 *
 * All other data passes through unchanged, preserving readline's normal
 * behavior (arrow keys, history, tab completion, etc.).
 */
export function createShiftEnterTransform(): Transform {
  return new Transform({
    transform(chunk: Buffer, _encoding: string, callback: TransformCallback) {
      if (containsShiftEnter(chunk)) {
        callback(null, translateShiftEnter(chunk));
      } else {
        // Fast path: pass through unchanged
        callback(null, chunk);
      }
    },
  });
}
