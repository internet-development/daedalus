/**
 * Multi-line Input Handling
 *
 * Provides backslash continuation support for multi-line input.
 * A line ending with `\` continues to the next line.
 */

/**
 * Result of processing an input line.
 */
export interface LineResult {
  /** Whether the input is complete (no more lines needed) */
  complete: boolean;
  /** The final message (only set when complete) */
  message?: string;
  /** Accumulated lines so far (only set when not complete) */
  accumulated?: string[];
}

/**
 * Process a single line of input, handling backslash continuation.
 *
 * @param line - The current line of input
 * @param previousLines - Lines accumulated from previous continuations
 * @returns Result indicating if input is complete or needs more lines
 */
export function processInputLine(
  line: string,
  previousLines: string[]
): LineResult {
  // Check if line ends with backslash (continuation)
  if (line.endsWith('\\')) {
    // Strip the trailing backslash and accumulate
    const strippedLine = line.slice(0, -1);
    return {
      complete: false,
      accumulated: [...previousLines, strippedLine],
    };
  }

  // Line doesn't end with backslash - input is complete
  const allLines = [...previousLines, line];
  return {
    complete: true,
    message: allLines.join('\n'),
  };
}
