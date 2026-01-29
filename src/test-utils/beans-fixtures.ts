/**
 * Test Utilities for Beans Client Integration Tests
 *
 * These are NOT mocks - they create real bean files for testing
 * with the actual beans CLI.
 */
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomBytes } from 'crypto';
import { execSync } from 'child_process';
import { removeDir } from './fs-helpers.js';

// =============================================================================
// Types
// =============================================================================

export interface TestBeanData {
  id?: string;
  title: string;
  type?: 'milestone' | 'epic' | 'feature' | 'bug' | 'task';
  status?: 'draft' | 'todo' | 'in-progress' | 'completed' | 'scrapped';
  priority?: 'critical' | 'high' | 'normal' | 'low' | 'deferred';
  tags?: string[];
  body?: string;
  parent?: string;
  blocking?: string[];
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Generate a unique test bean ID
 */
function generateBeanId(): string {
  const prefix = 'test';
  const suffix = randomBytes(4).toString('hex').slice(0, 4);
  return `${prefix}-${suffix}`;
}

/**
 * Generate a slug from a title
 */
function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);
}

/**
 * Create a bean file with proper frontmatter format
 */
function createBeanContent(data: TestBeanData): string {
  const id = data.id ?? generateBeanId();
  const type = data.type ?? 'task';
  const status = data.status ?? 'todo';
  const priority = data.priority ?? 'normal';
  const tags = data.tags ?? [];
  const blocking = data.blocking ?? [];

  const lines: string[] = [
    '---',
    `id: ${id}`,
    `title: "${data.title}"`,
    `type: ${type}`,
    `status: ${status}`,
    `priority: ${priority}`,
  ];

  if (tags.length > 0) {
    lines.push(`tags: [${tags.map((t) => `"${t}"`).join(', ')}]`);
  } else {
    lines.push('tags: []');
  }

  if (data.parent) {
    lines.push(`parent: ${data.parent}`);
  }

  if (blocking.length > 0) {
    lines.push(`blocking: [${blocking.map((b) => `"${b}"`).join(', ')}]`);
  } else {
    lines.push('blocking: []');
  }

  lines.push('---');

  if (data.body) {
    lines.push('', data.body);
  }

  return lines.join('\n');
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Create a temporary beans project directory for testing.
 * Initializes a proper beans project with `beans init`.
 * @returns Path to the temporary project directory (not the .beans subdirectory)
 */
export async function createTempBeansDir(): Promise<string> {
  const uniqueId = randomBytes(8).toString('hex');
  const tempDir = join(tmpdir(), `beans-test-${uniqueId}`);
  await mkdir(tempDir, { recursive: true });

  // Initialize a proper beans project
  execSync('beans init', { cwd: tempDir, stdio: 'pipe' });

  return tempDir;
}

/**
 * Get the .beans subdirectory path for a project
 */
export function getBeansSubdir(projectDir: string): string {
  return join(projectDir, '.beans');
}

/**
 * Create a test bean file in the specified project directory.
 * The bean file is created in the .beans subdirectory.
 * @param projectDir The project directory (containing .beans)
 * @param data The bean data
 * @returns The bean ID
 */
export async function createTestBean(
  projectDir: string,
  data: TestBeanData
): Promise<string> {
  const id = data.id ?? generateBeanId();
  const slug = slugify(data.title);
  const filename = `${id}--${slug}.md`;
  const content = createBeanContent({ ...data, id });

  // Ensure .beans directory exists
  const beansDir = getBeansSubdir(projectDir);
  await mkdir(beansDir, { recursive: true });

  // Write the bean file
  const filePath = join(beansDir, filename);
  await writeFile(filePath, content, 'utf-8');

  return id;
}

/**
 * Clean up a test beans directory
 * @param dir The directory to remove
 */
export async function cleanupTestBeans(dir: string): Promise<void> {
  await removeDir(dir);
}

/**
 * Run a test with an isolated beans directory
 * Automatically creates and cleans up the directory
 * @param fn The test function to run
 */
export async function withTestBeansDir<T>(
  fn: (dir: string) => Promise<T>
): Promise<T> {
  const dir = await createTempBeansDir();
  try {
    return await fn(dir);
  } finally {
    await cleanupTestBeans(dir);
  }
}
