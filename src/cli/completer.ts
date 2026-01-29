/**
 * Tab Completion for Slash Commands
 *
 * Provides tab completion for /commands in the readline interface.
 */
import { COMMAND_NAMES } from './commands.js';

/**
 * Completer function for readline.
 *
 * @param line - The current input line
 * @returns [completions, originalSubstring] tuple
 *
 * @example
 * completer('/se') // returns [['/sessions', '/status'], '/se']
 * completer('hello') // returns [[], 'hello']
 */
export function completer(line: string): [string[], string] {
  // Only complete lines starting with /
  if (!line.startsWith('/')) {
    return [[], line];
  }

  // Filter commands that start with the typed prefix (case-insensitive)
  const prefix = line.toLowerCase();
  const matches = COMMAND_NAMES.filter((cmd) =>
    cmd.toLowerCase().startsWith(prefix)
  );

  return [matches, line];
}
