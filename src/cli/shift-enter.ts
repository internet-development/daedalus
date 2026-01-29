/**
 * Shift+Enter Escape Sequence Handling
 *
 * Detects and translates terminal-specific Shift+Enter escape sequences
 * into a continuation marker that the multi-line input system can handle.
 *
 * Different terminals send different escape sequences for Shift+Enter:
 * - Ghostty/xterm: \x1b[27;2;13~ (CSI 27;2;13~)
 * - Konsole:       \x1bOM        (ESC O M, legacy VT100)
 * - Some xterms:   \x1b[13;2~   (CSI 13;2~)
 * - iTerm2:        Usually \n    (configured correctly)
 *
 * @see https://github.com/ghostty-org/ghostty/discussions/7780
 * @see https://github.com/anthropics/claude-code/issues/2115
 */

/**
 * Marker string used to replace Shift+Enter escape sequences.
 * This is a backslash followed by carriage return, which triggers
 * readline line submission AND the existing backslash-continuation
 * logic in processInputLine.
 */
export const SHIFT_ENTER_MARKER = '\\\r';

/**
 * Known Shift+Enter escape sequences from various terminals.
 * Order matters: longer sequences should be checked first to avoid
 * partial matches.
 */
const SHIFT_ENTER_SEQUENCES: string[] = [
  '\x1b[27;2;13~', // Ghostty, some xterm variants (CSI 27;2;13~)
  '\x1b[13;2~',    // Some other terminals (CSI 13;2~)
  '\x1bOM',         // Konsole (ESC O M, legacy VT100)
];

/**
 * Check if a buffer contains any known Shift+Enter escape sequence.
 */
export function containsShiftEnter(data: Buffer): boolean {
  const str = data.toString();
  return SHIFT_ENTER_SEQUENCES.some((seq) => str.includes(seq));
}

/**
 * Translate all known Shift+Enter escape sequences in a buffer
 * to the continuation marker.
 *
 * Returns a new Buffer with escape sequences replaced.
 * Non-matching data is passed through unchanged.
 */
export function translateShiftEnter(data: Buffer): Buffer {
  let str = data.toString();

  for (const seq of SHIFT_ENTER_SEQUENCES) {
    // Replace all occurrences of this sequence
    while (str.includes(seq)) {
      str = str.replace(seq, SHIFT_ENTER_MARKER);
    }
  }

  return Buffer.from(str);
}
