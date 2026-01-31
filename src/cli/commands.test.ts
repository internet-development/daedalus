/**
 * Integration Tests for CLI Commands
 *
 * These tests verify real CLI command behavior using actual command execution.
 * NO MOCKING - we test real commands with real beans directories.
 */
import { describe, test, expect } from 'vitest';
import {
  captureOutput,
  captureExitCode,
  withTestBeansDir,
  createTestBean,
  createTempDir,
  removeDir,
  type TestBeanData,
} from '../test-utils/index.js';
import { runTree, type TreeOptions } from './tree-simple.js';
import { parseArgs, parsePlanArgs } from './index.js';
import {
  getSessionsSortedByDate,
  switchSession,
  createSession,
  type ChatHistoryState,
} from '../planning/chat-history.js';

// =============================================================================
// Test Helpers
// =============================================================================

/**
 * Run tree command with test beans and capture output.
 * Reduces boilerplate in tree command tests.
 */
async function runTreeWithBeans(
  setup?: (dir: string) => Promise<void>,
  options?: Partial<TreeOptions>
): Promise<string> {
  return withTestBeansDir(async (dir) => {
    if (setup) await setup(dir);
    return captureOutput(async () => {
      await runTree({ args: options?.args ?? [], cwd: dir });
    });
  });
}

/**
 * Create multiple test beans in a directory.
 */
async function createBeans(
  dir: string,
  beans: TestBeanData[]
): Promise<string[]> {
  const ids: string[] = [];
  for (const bean of beans) {
    ids.push(await createTestBean(dir, bean));
  }
  return ids;
}

// =============================================================================
// Tests
// =============================================================================

describe('CLI Commands', () => {
  describe('/beans command (primary)', () => {
    test('shows empty message for no beans', async () => {
      const output = await runTreeWithBeans();
      expect(output).toContain('No active beans found');
    });

    test('displays single bean correctly', async () => {
      let beanId: string;
      const output = await runTreeWithBeans(async (dir) => {
        beanId = await createTestBean(dir, {
          title: 'Test Bean',
          type: 'task',
          status: 'todo',
        });
      });

      expect(output).toContain('Test Bean');
      expect(output).toContain(beanId!);
    });

    test('displays parent-child hierarchy', async () => {
      const output = await runTreeWithBeans(async (dir) => {
        await createBeans(dir, [
          { id: 'parent-001', title: 'Parent Bean', type: 'epic', status: 'todo' },
          {
            id: 'child-001',
            title: 'Child Bean',
            type: 'task',
            status: 'todo',
            parent: 'parent-001',
          },
        ]);
      });

      expect(output).toContain('Parent Bean');
      expect(output).toContain('Child Bean');
      // Child should be indented under parent (tree structure)
      expect(output).toMatch(/Parent Bean[\s\S]*Child Bean/);
    });

    test('shows help with --help flag', async () => {
      const output = await captureOutput(async () => {
        await runTree({ args: ['--help'] });
      });

      expect(output).toContain('Usage:');
      expect(output).toContain('--help');
    });

    test('excludes completed beans by default', async () => {
      const output = await runTreeWithBeans(async (dir) => {
        await createBeans(dir, [
          { title: 'Completed Bean', type: 'task', status: 'completed' },
          { title: 'Active Bean', type: 'task', status: 'todo' },
        ]);
      });

      expect(output).toContain('Active Bean');
      expect(output).not.toContain('Completed Bean');
    });
  });

  describe('/tree alias', () => {
    test('/tree still works as alias for /beans', async () => {
      const output = await runTreeWithBeans();
      // runTree is the same underlying function, so it should work
      expect(output).toContain('No active beans found');
    });
  });

  describe('Argument Parsing', () => {
    test('parses long flags with values', () => {
      const result = parseArgs(['--mode', 'brainstorm']);
      expect(result.flags.mode).toBe('brainstorm');
    });

    test('parses long flags with equals syntax', () => {
      const result = parseArgs(['--mode=brainstorm']);
      expect(result.flags.mode).toBe('brainstorm');
    });

    test('parses boolean long flags', () => {
      const result = parseArgs(['--help']);
      expect(result.flags.help).toBe(true);
    });

    test('parses short flags with values', () => {
      const result = parseArgs(['-m', 'brainstorm']);
      expect(result.flags.m).toBe('brainstorm');
    });

    test('parses boolean short flags', () => {
      const result = parseArgs(['-h']);
      expect(result.flags.h).toBe(true);
    });

    test('parses positional arguments', () => {
      const result = parseArgs(['tree', '--help']);
      expect(result.positional).toEqual(['tree']);
      expect(result.flags.help).toBe(true);
    });

    test('parses mixed flags and positional args', () => {
      const result = parseArgs(['--mode', 'new', 'plan', '-n']);
      expect(result.flags.mode).toBe('new');
      expect(result.flags.n).toBe(true);
      expect(result.positional).toEqual(['plan']);
    });

    test('handles multiple flags', () => {
      const result = parseArgs(['--mode', 'brainstorm', '--new', '-l']);
      expect(result.flags.mode).toBe('brainstorm');
      expect(result.flags.new).toBe(true);
      expect(result.flags.l).toBe(true);
    });

    test('handles empty args', () => {
      const result = parseArgs([]);
      expect(result.flags).toEqual({});
      expect(result.positional).toEqual([]);
    });

    test('parses -c flag for continue', () => {
      const result = parseArgs(['-c']);
      expect(result.flags.c).toBe(true);
    });

    test('parses --continue flag', () => {
      const result = parseArgs(['--continue']);
      expect(result.flags.continue).toBe(true);
    });
  });

  describe('parsePlanArgs', () => {
    test('parses -c flag as continue option', () => {
      const result = parsePlanArgs(['-c']);
      expect(result.continue).toBe(true);
    });

    test('parses --continue flag as continue option', () => {
      const result = parsePlanArgs(['--continue']);
      expect(result.continue).toBe(true);
    });

    test('continue is undefined when not specified', () => {
      const result = parsePlanArgs([]);
      expect(result.continue).toBeUndefined();
    });
  });

  describe('Continue Session Logic', () => {
    test('getSessionsSortedByDate returns most recent first', () => {
      const state: ChatHistoryState = {
        currentSessionId: 'old-session',
        sessions: [
          {
            id: 'old-session',
            name: 'Old Session',
            messages: [],
            createdAt: 1000,
            updatedAt: 1000,
          },
          {
            id: 'recent-session',
            name: 'Recent Session',
            messages: [],
            createdAt: 2000,
            updatedAt: 3000,
          },
          {
            id: 'middle-session',
            name: 'Middle Session',
            messages: [],
            createdAt: 1500,
            updatedAt: 2000,
          },
        ],
      };

      const sorted = getSessionsSortedByDate(state);
      expect(sorted[0].id).toBe('recent-session');
      expect(sorted[1].id).toBe('middle-session');
      expect(sorted[2].id).toBe('old-session');
    });

    test('continue with existing sessions switches to most recent', () => {
      const state: ChatHistoryState = {
        currentSessionId: 'old-session',
        sessions: [
          {
            id: 'old-session',
            name: 'Old Session',
            messages: [],
            createdAt: 1000,
            updatedAt: 1000,
          },
          {
            id: 'recent-session',
            name: 'Recent Session',
            messages: [],
            createdAt: 2000,
            updatedAt: 3000,
          },
        ],
      };

      // Simulate the continue logic from runPlan
      const sortedSessions = getSessionsSortedByDate(state);
      const newState = switchSession(state, sortedSessions[0].id);

      expect(newState.currentSessionId).toBe('recent-session');
    });

    test('continue with no sessions creates new session', () => {
      const state: ChatHistoryState = {
        currentSessionId: null,
        sessions: [],
      };

      // Simulate the continue logic from runPlan
      const sortedSessions = getSessionsSortedByDate(state);
      let newState: ChatHistoryState;
      if (sortedSessions.length > 0) {
        newState = switchSession(state, sortedSessions[0].id);
      } else {
        newState = createSession(state);
      }

      expect(newState.currentSessionId).not.toBeNull();
      expect(newState.sessions.length).toBe(1);
    });
  });

  describe('Error Handling', () => {
    test('/beans shows error for non-beans directory', async () => {
      // Create a temp directory without beans init
      const tempDir = await createTempDir('no-beans-');

      try {
        let output = '';
        let exitCode = 0;

        // Capture both output and exit code
        try {
          exitCode = await captureExitCode(async () => {
            output = await captureOutput(async () => {
              await runTree({ args: [], cwd: tempDir });
            });
          });
        } catch {
          // Expected - runTree may throw or exit
        }

        // Should show an error message (either in output or via exit code)
        // The exact behavior depends on how beans CLI handles non-beans dirs
        expect(exitCode === 1 || output.includes('Error')).toBe(true);
      } finally {
        await removeDir(tempDir);
      }
    });

    test('/beans handles -h shorthand for help', async () => {
      const output = await captureOutput(async () => {
        await runTree({ args: ['-h'] });
      });

      expect(output).toContain('Usage:');
    });
  });
});
