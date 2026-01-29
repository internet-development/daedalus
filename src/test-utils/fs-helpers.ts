/**
 * File System Test Helpers
 *
 * Utilities for file system operations in tests.
 * These are NOT mocks - they work with real file system.
 */
import { mkdir, rm, readFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

/**
 * Creates a temporary directory for tests.
 *
 * @param prefix Prefix for the directory name (default: 'test-')
 * @returns Path to the created directory
 *
 * @example
 * const dir = await createTempDir('my-test-');
 * // Use dir for test files
 * await removeDir(dir); // Clean up
 */
export async function createTempDir(prefix = 'test-'): Promise<string> {
  const uniqueId = Date.now().toString(36) + Math.random().toString(36).slice(2);
  const dir = join(tmpdir(), `${prefix}${uniqueId}`);
  await mkdir(dir, { recursive: true });
  return dir;
}

/**
 * Recursively removes a directory and all its contents.
 *
 * @param dir Path to the directory to remove
 *
 * @example
 * await removeDir(tempDir);
 */
export async function removeDir(dir: string): Promise<void> {
  await rm(dir, { recursive: true, force: true });
}

/**
 * Reads a file and returns its content as a string.
 *
 * @param path Path to the file to read
 * @returns File content as string
 *
 * @example
 * const content = await readTestFile(join(dir, 'output.txt'));
 * expect(content).toContain('expected text');
 */
export async function readTestFile(path: string): Promise<string> {
  return readFile(path, 'utf-8');
}
