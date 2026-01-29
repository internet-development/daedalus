/**
 * Tests for beans-fixtures.ts
 *
 * These tests verify that our test utilities work correctly
 * by using real file system operations.
 */
import { describe, test, expect, afterEach } from 'vitest';
import { existsSync } from 'fs';
import { readFile, readdir, rm } from 'fs/promises';
import { join } from 'path';
import {
  createTestBean,
  createTempBeansDir,
  cleanupTestBeans,
  withTestBeansDir,
  getBeansSubdir,
} from './beans-fixtures.js';

// Track directories to clean up after tests
const dirsToCleanup: string[] = [];

afterEach(async () => {
  // Clean up any directories created during tests
  for (const dir of dirsToCleanup) {
    try {
      await rm(dir, { recursive: true, force: true });
    } catch {
      // Ignore errors
    }
  }
  dirsToCleanup.length = 0;
});

describe('createTempBeansDir', () => {
  test('creates a temporary directory with .beans subdirectory', async () => {
    const dir = await createTempBeansDir();
    dirsToCleanup.push(dir);

    expect(existsSync(dir)).toBe(true);
    expect(existsSync(getBeansSubdir(dir))).toBe(true);
  });

  test('creates unique directories on each call', async () => {
    const dir1 = await createTempBeansDir();
    const dir2 = await createTempBeansDir();
    dirsToCleanup.push(dir1, dir2);

    expect(dir1).not.toBe(dir2);
  });
});

describe('createTestBean', () => {
  test('creates a bean file with correct frontmatter', async () => {
    const dir = await createTempBeansDir();
    dirsToCleanup.push(dir);

    const id = await createTestBean(dir, {
      title: 'Test Bean Title',
      type: 'task',
      status: 'todo',
      priority: 'high',
    });

    // Find the created file
    const beansDir = getBeansSubdir(dir);
    const files = await readdir(beansDir);
    const beanFile = files.find((f) => f.startsWith(id));
    expect(beanFile).toBeDefined();

    // Read and verify content
    const content = await readFile(join(beansDir, beanFile!), 'utf-8');
    expect(content).toContain(`id: ${id}`);
    expect(content).toContain('title: "Test Bean Title"');
    expect(content).toContain('type: task');
    expect(content).toContain('status: todo');
    expect(content).toContain('priority: high');
  });

  test('returns the bean ID', async () => {
    const dir = await createTempBeansDir();
    dirsToCleanup.push(dir);

    const id = await createTestBean(dir, { title: 'My Bean' });

    expect(id).toMatch(/^test-[a-f0-9]{4}$/);
  });

  test('uses provided ID when specified', async () => {
    const dir = await createTempBeansDir();
    dirsToCleanup.push(dir);

    const id = await createTestBean(dir, {
      id: 'custom-id',
      title: 'Custom ID Bean',
    });

    expect(id).toBe('custom-id');

    const beansDir = getBeansSubdir(dir);
    const files = await readdir(beansDir);
    expect(files.some((f) => f.startsWith('custom-id'))).toBe(true);
  });

  test('includes body content when provided', async () => {
    const dir = await createTempBeansDir();
    dirsToCleanup.push(dir);

    const id = await createTestBean(dir, {
      title: 'Bean with Body',
      body: 'This is the body content.\n\nWith multiple paragraphs.',
    });

    const beansDir = getBeansSubdir(dir);
    const files = await readdir(beansDir);
    const beanFile = files.find((f) => f.startsWith(id));
    const content = await readFile(join(beansDir, beanFile!), 'utf-8');

    expect(content).toContain('This is the body content.');
    expect(content).toContain('With multiple paragraphs.');
  });

  test('includes tags when provided', async () => {
    const dir = await createTempBeansDir();
    dirsToCleanup.push(dir);

    const id = await createTestBean(dir, {
      title: 'Tagged Bean',
      tags: ['urgent', 'frontend'],
    });

    const beansDir = getBeansSubdir(dir);
    const files = await readdir(beansDir);
    const beanFile = files.find((f) => f.startsWith(id));
    const content = await readFile(join(beansDir, beanFile!), 'utf-8');

    expect(content).toContain('tags: ["urgent", "frontend"]');
  });

  test('includes parent when provided', async () => {
    const dir = await createTempBeansDir();
    dirsToCleanup.push(dir);

    const id = await createTestBean(dir, {
      title: 'Child Bean',
      parent: 'parent-bean-id',
    });

    const beansDir = getBeansSubdir(dir);
    const files = await readdir(beansDir);
    const beanFile = files.find((f) => f.startsWith(id));
    const content = await readFile(join(beansDir, beanFile!), 'utf-8');

    expect(content).toContain('parent: parent-bean-id');
  });

  test('includes blocking when provided', async () => {
    const dir = await createTempBeansDir();
    dirsToCleanup.push(dir);

    const id = await createTestBean(dir, {
      title: 'Blocking Bean',
      blocking: ['blocked-1', 'blocked-2'],
    });

    const beansDir = getBeansSubdir(dir);
    const files = await readdir(beansDir);
    const beanFile = files.find((f) => f.startsWith(id));
    const content = await readFile(join(beansDir, beanFile!), 'utf-8');

    expect(content).toContain('blocking: ["blocked-1", "blocked-2"]');
  });
});

describe('cleanupTestBeans', () => {
  test('removes the directory and all contents', async () => {
    const dir = await createTempBeansDir();
    await createTestBean(dir, { title: 'Bean to Delete' });

    expect(existsSync(dir)).toBe(true);

    await cleanupTestBeans(dir);

    expect(existsSync(dir)).toBe(false);
  });

  test('does not throw if directory does not exist', async () => {
    await expect(cleanupTestBeans('/nonexistent/path')).resolves.not.toThrow();
  });
});

describe('withTestBeansDir', () => {
  test('provides a temporary directory to the callback', async () => {
    let capturedDir: string | null = null;

    await withTestBeansDir(async (dir) => {
      capturedDir = dir;
      expect(existsSync(dir)).toBe(true);
      expect(existsSync(getBeansSubdir(dir))).toBe(true);
    });

    expect(capturedDir).not.toBeNull();
  });

  test('cleans up directory after callback completes', async () => {
    let capturedDir: string | null = null;

    await withTestBeansDir(async (dir) => {
      capturedDir = dir;
      await createTestBean(dir, { title: 'Temporary Bean' });
    });

    expect(existsSync(capturedDir!)).toBe(false);
  });

  test('cleans up directory even if callback throws', async () => {
    let capturedDir: string | null = null;

    await expect(
      withTestBeansDir(async (dir) => {
        capturedDir = dir;
        throw new Error('Test error');
      })
    ).rejects.toThrow('Test error');

    expect(existsSync(capturedDir!)).toBe(false);
  });

  test('returns the value from the callback', async () => {
    const result = await withTestBeansDir(async (dir) => {
      await createTestBean(dir, { title: 'Result Bean' });
      return 'success';
    });

    expect(result).toBe('success');
  });
});
