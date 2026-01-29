/**
 * Beans Client Integration Tests
 *
 * These tests use the REAL beans CLI with isolated test directories.
 * NO MOCKING - we test actual behavior.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createTempBeansDir,
  createTestBean,
  cleanupTestBeans,
  withTestBeansDir,
} from '../test-utils/beans-fixtures.js';
import {
  listBeans,
  getBean,
  updateBeanStatus,
  setCwd,
  getCwd,
  BeansCliError,
} from './beans-client.js';

describe('BeansClient Integration', () => {
  let testDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    // Save original cwd
    originalCwd = getCwd();

    // Create isolated test directory with beans init
    testDir = await createTempBeansDir();

    // Point beans client to test directory
    setCwd(testDir);
  });

  afterEach(async () => {
    // Restore original cwd
    setCwd(originalCwd);

    // Clean up test directory
    await cleanupTestBeans(testDir);
  });

  describe('listBeans()', () => {
    it('returns empty array for empty beans directory', async () => {
      const beans = await listBeans();
      expect(beans).toEqual([]);
    });

    it('returns single bean when one exists', async () => {
      // Create a test bean
      const beanId = await createTestBean(testDir, {
        title: 'Test Bean',
        type: 'task',
        status: 'todo',
      });

      const beans = await listBeans();

      expect(beans).toHaveLength(1);
      expect(beans[0].id).toBe(beanId);
      expect(beans[0].title).toBe('Test Bean');
      expect(beans[0].type).toBe('task');
      expect(beans[0].status).toBe('todo');
    });

    it('returns multiple beans', async () => {
      await createTestBean(testDir, { title: 'Bean One' });
      await createTestBean(testDir, { title: 'Bean Two' });
      await createTestBean(testDir, { title: 'Bean Three' });

      const beans = await listBeans();

      expect(beans).toHaveLength(3);
      const titles = beans.map((b) => b.title).sort();
      expect(titles).toEqual(['Bean One', 'Bean Three', 'Bean Two']);
    });

    it('filters beans by status', async () => {
      await createTestBean(testDir, { title: 'Todo Bean', status: 'todo' });
      await createTestBean(testDir, {
        title: 'In Progress Bean',
        status: 'in-progress',
      });
      await createTestBean(testDir, {
        title: 'Completed Bean',
        status: 'completed',
      });

      const todoBeans = await listBeans({ status: ['todo'] });

      expect(todoBeans).toHaveLength(1);
      expect(todoBeans[0].title).toBe('Todo Bean');
    });

    it('filters beans by type', async () => {
      await createTestBean(testDir, { title: 'Task Bean', type: 'task' });
      await createTestBean(testDir, { title: 'Bug Bean', type: 'bug' });
      await createTestBean(testDir, { title: 'Feature Bean', type: 'feature' });

      const bugBeans = await listBeans({ type: ['bug'] });

      expect(bugBeans).toHaveLength(1);
      expect(bugBeans[0].title).toBe('Bug Bean');
    });
  });

  describe('getBean()', () => {
    it('returns null for non-existent bean', async () => {
      const bean = await getBean('non-existent-id');
      expect(bean).toBeNull();
    });

    it('returns bean by ID', async () => {
      const beanId = await createTestBean(testDir, {
        title: 'Specific Bean',
        type: 'feature',
        status: 'in-progress',
        priority: 'high',
      });

      const bean = await getBean(beanId);

      expect(bean).not.toBeNull();
      expect(bean?.id).toBe(beanId);
      expect(bean?.title).toBe('Specific Bean');
      expect(bean?.type).toBe('feature');
      expect(bean?.status).toBe('in-progress');
      expect(bean?.priority).toBe('high');
    });

    it('returns bean with body content', async () => {
      const beanId = await createTestBean(testDir, {
        title: 'Bean With Body',
        body: 'This is the body content.\n\nWith multiple paragraphs.',
      });

      const bean = await getBean(beanId);

      expect(bean?.body).toContain('This is the body content.');
      expect(bean?.body).toContain('With multiple paragraphs.');
    });
  });

  describe('updateBeanStatus()', () => {
    it('updates bean status', async () => {
      const beanId = await createTestBean(testDir, {
        title: 'Status Test Bean',
        status: 'todo',
      });

      // Verify initial status
      let bean = await getBean(beanId);
      expect(bean?.status).toBe('todo');

      // Update status
      const updated = await updateBeanStatus(beanId, 'in-progress');

      expect(updated.status).toBe('in-progress');

      // Verify persisted
      bean = await getBean(beanId);
      expect(bean?.status).toBe('in-progress');
    });

    it('throws error for non-existent bean', async () => {
      await expect(
        updateBeanStatus('non-existent-id', 'completed')
      ).rejects.toThrow();
    });
  });

  describe('withTestBeansDir helper', () => {
    it('provides isolated directory and cleans up', async () => {
      let capturedDir: string | null = null;

      await withTestBeansDir(async (dir) => {
        capturedDir = dir;

        // Should be able to use beans CLI
        setCwd(dir);
        const beans = await listBeans();
        expect(beans).toEqual([]);

        // Create a bean
        await createTestBean(dir, { title: 'Temp Bean' });
        const afterCreate = await listBeans();
        expect(afterCreate).toHaveLength(1);
      });

      // Directory should be cleaned up
      expect(capturedDir).not.toBeNull();
      // We can't easily verify cleanup without fs access, but the helper should work
    });
  });

  describe('error handling', () => {
    it('throws BeansCliError for invalid directory', async () => {
      setCwd('/nonexistent/path/that/does/not/exist');

      await expect(listBeans()).rejects.toThrow(BeansCliError);
    });
  });
});
