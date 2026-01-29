/**
 * Input History Management
 *
 * Handles loading and saving readline input history to disk.
 */
import * as fs from 'fs/promises';
import * as path from 'path';

const MAX_HISTORY_SIZE = 1000;

/**
 * Load input history from disk.
 * Returns empty array if file doesn't exist.
 * Truncates to most recent 1000 lines if file is larger.
 */
export async function loadInputHistory(
  historyFile: string = '.talos/input-history'
): Promise<string[]> {
  try {
    const content = await fs.readFile(historyFile, 'utf-8');
    const lines = content
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    // Truncate to most recent 1000 lines
    if (lines.length > MAX_HISTORY_SIZE) {
      return lines.slice(lines.length - MAX_HISTORY_SIZE);
    }

    return lines;
  } catch (err: any) {
    // File doesn't exist or can't be read - return empty array
    if (err.code === 'ENOENT') {
      return [];
    }
    throw err;
  }
}

/**
 * Append a new input to the history file.
 * Creates the file and directory if they don't exist.
 * Skips empty inputs.
 * Truncates to 1000 lines if needed.
 */
export async function appendToHistory(
  input: string,
  historyFile: string = '.talos/input-history'
): Promise<void> {
  // Skip empty inputs
  if (!input.trim()) {
    return;
  }

  // Ensure directory exists
  const dir = path.dirname(historyFile);
  await fs.mkdir(dir, { recursive: true });

  // Load existing history
  const history = await loadInputHistory(historyFile);

  // Add new input
  history.push(input);

  // Truncate to max size
  const toSave =
    history.length > MAX_HISTORY_SIZE
      ? history.slice(history.length - MAX_HISTORY_SIZE)
      : history;

  // Write back to file
  await fs.writeFile(historyFile, toSave.join('\n') + '\n', 'utf-8');
}
