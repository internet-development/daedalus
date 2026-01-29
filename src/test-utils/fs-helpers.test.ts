/**
 * Tests for fs-helpers.ts
 *
 * These tests verify file system testing utilities work correctly
 * using real file system operations.
 */
import { describe, test, expect, afterEach } from 'vitest';
import { existsSync } from 'fs';
import { writeFile, rm } from 'fs/promises';
import { join } from 'path';
import { createTempDir, removeDir, readTestFile } from './fs-helpers.js';

// Track directories to clean up after tests
const dirsToCleanup: string[] = [];

afterEach(async () => {
  for (const dir of dirsToCleanup) {
    try {
      await rm(dir, { recursive: true, force: true });
    } catch {
      // Ignore errors
    }
  }
  dirsToCleanup.length = 0;
});

describe('createTempDir', () => {
  test('creates a temporary directory', async () => {
    const dir = await createTempDir();
    dirsToCleanup.push(dir);

    expect(existsSync(dir)).toBe(true);
  });

  test('uses default prefix "test-"', async () => {
    const dir = await createTempDir();
    dirsToCleanup.push(dir);

    expect(dir).toContain('test-');
  });

  test('uses custom prefix when provided', async () => {
    const dir = await createTempDir('custom-');
    dirsToCleanup.push(dir);

    expect(dir).toContain('custom-');
  });

  test('creates unique directories on each call', async () => {
    const dir1 = await createTempDir();
    const dir2 = await createTempDir();
    dirsToCleanup.push(dir1, dir2);

    expect(dir1).not.toBe(dir2);
  });
});

describe('removeDir', () => {
  test('removes directory and all contents', async () => {
    const dir = await createTempDir();

    // Create some files in the directory
    await writeFile(join(dir, 'file1.txt'), 'content1');
    await writeFile(join(dir, 'file2.txt'), 'content2');

    expect(existsSync(dir)).toBe(true);

    await removeDir(dir);

    expect(existsSync(dir)).toBe(false);
  });

  test('does not throw if directory does not exist', async () => {
    await expect(removeDir('/nonexistent/path')).resolves.not.toThrow();
  });

  test('removes nested directories', async () => {
    const dir = await createTempDir();
    const nestedDir = join(dir, 'nested', 'deep');

    // Create nested structure
    await createTempDir(); // This creates a flat dir, we need to manually create nested
    const { mkdir } = await import('fs/promises');
    await mkdir(nestedDir, { recursive: true });
    await writeFile(join(nestedDir, 'deep-file.txt'), 'deep content');

    await removeDir(dir);

    expect(existsSync(dir)).toBe(false);
  });
});

describe('readTestFile', () => {
  test('reads file content as string', async () => {
    const dir = await createTempDir();
    dirsToCleanup.push(dir);

    const filePath = join(dir, 'test.txt');
    await writeFile(filePath, 'Hello, World!');

    const content = await readTestFile(filePath);

    expect(content).toBe('Hello, World!');
  });

  test('reads file with multiple lines', async () => {
    const dir = await createTempDir();
    dirsToCleanup.push(dir);

    const filePath = join(dir, 'multiline.txt');
    await writeFile(filePath, 'Line 1\nLine 2\nLine 3');

    const content = await readTestFile(filePath);

    expect(content).toBe('Line 1\nLine 2\nLine 3');
  });

  test('reads file with unicode content', async () => {
    const dir = await createTempDir();
    dirsToCleanup.push(dir);

    const filePath = join(dir, 'unicode.txt');
    await writeFile(filePath, 'Hello 世界 🌍');

    const content = await readTestFile(filePath);

    expect(content).toBe('Hello 世界 🌍');
  });

  test('throws if file does not exist', async () => {
    await expect(readTestFile('/nonexistent/file.txt')).rejects.toThrow();
  });
});
