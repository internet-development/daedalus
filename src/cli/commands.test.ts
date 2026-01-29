/**
 * Integration Tests for CLI Commands
 *
 * These tests verify real CLI command behavior using actual command execution.
 * NO MOCKING - we test real commands with real beans directories.
 */
import { describe, test, expect } from 'vitest';
import {
  captureOutput,
  withTestBeansDir,
  createTestBean,
} from '../test-utils/index.js';
import { runTree } from './tree-simple.js';

describe('CLI Commands', () => {
  describe('/tree command', () => {
    test('shows empty message for no beans', async () => {
      await withTestBeansDir(async (dir) => {
        const output = await captureOutput(async () => {
          await runTree({ args: [], cwd: dir });
        });

        expect(output).toContain('No active beans found');
      });
    });

    test('displays single bean correctly', async () => {
      await withTestBeansDir(async (dir) => {
        // Create a test bean
        const beanId = await createTestBean(dir, {
          title: 'Test Bean',
          type: 'task',
          status: 'todo',
        });

        const output = await captureOutput(async () => {
          await runTree({ args: [], cwd: dir });
        });

        expect(output).toContain('Test Bean');
        expect(output).toContain(beanId);
      });
    });

    test('displays parent-child hierarchy', async () => {
      await withTestBeansDir(async (dir) => {
        // Create parent bean
        const parentId = await createTestBean(dir, {
          id: 'parent-001',
          title: 'Parent Bean',
          type: 'epic',
          status: 'todo',
        });

        // Create child bean
        await createTestBean(dir, {
          id: 'child-001',
          title: 'Child Bean',
          type: 'task',
          status: 'todo',
          parent: parentId,
        });

        const output = await captureOutput(async () => {
          await runTree({ args: [], cwd: dir });
        });

        expect(output).toContain('Parent Bean');
        expect(output).toContain('Child Bean');
        // Child should be indented under parent (tree structure)
        expect(output).toMatch(/Parent Bean[\s\S]*Child Bean/);
      });
    });

    test('shows help with --help flag', async () => {
      const output = await captureOutput(async () => {
        await runTree({ args: ['--help'] });
      });

      expect(output).toContain('Usage:');
      expect(output).toContain('daedalus tree');
      expect(output).toContain('--help');
    });

    test('excludes completed beans by default', async () => {
      await withTestBeansDir(async (dir) => {
        // Create a completed bean
        await createTestBean(dir, {
          title: 'Completed Bean',
          type: 'task',
          status: 'completed',
        });

        // Create an active bean
        await createTestBean(dir, {
          title: 'Active Bean',
          type: 'task',
          status: 'todo',
        });

        const output = await captureOutput(async () => {
          await runTree({ args: [], cwd: dir });
        });

        expect(output).toContain('Active Bean');
        expect(output).not.toContain('Completed Bean');
      });
    });
  });
});
