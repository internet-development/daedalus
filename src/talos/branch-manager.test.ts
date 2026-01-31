/**
 * Branch Manager Tests
 *
 * Tests for hierarchical branch creation, type-aware merge strategies,
 * and branch lifecycle management.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { execFileSync } from 'child_process';
import { tmpdir } from 'os';
import { BranchManager } from './branch-manager.js';
import type { BranchConfig } from '../config/index.js';
import type { Bean, BeanType } from './beans-client.js';

// =============================================================================
// Test Helpers
// =============================================================================

function createTempGitRepo(): string {
  const dir = join(
    tmpdir(),
    `branch-mgr-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
  mkdirSync(dir, { recursive: true });
  execFileSync('git', ['init'], { cwd: dir, stdio: 'pipe' });
  execFileSync('git', ['config', 'user.email', 'test@test.com'], {
    cwd: dir,
    stdio: 'pipe',
  });
  execFileSync('git', ['config', 'user.name', 'Test'], {
    cwd: dir,
    stdio: 'pipe',
  });
  writeFileSync(join(dir, 'README.md'), '# Test\n');
  execFileSync('git', ['add', '.'], { cwd: dir, stdio: 'pipe' });
  execFileSync('git', ['commit', '-m', 'initial'], {
    cwd: dir,
    stdio: 'pipe',
  });
  return dir;
}

function cleanupDir(dir: string): void {
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    // Ignore
  }
}

function makeBean(overrides: Partial<Bean> & { id: string }): Bean {
  return {
    slug: overrides.id,
    title: `Bean ${overrides.id}`,
    status: 'todo',
    type: 'task',
    priority: 'normal',
    tags: [],
    body: '',
    blockingIds: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function getDefaultBranchConfig(): BranchConfig {
  return {
    enabled: true,
    delete_after_merge: true,
    default_branch: 'main',
    merge_strategy: {
      milestone: 'merge',
      epic: 'merge',
      feature: 'merge',
      task: 'squash',
      bug: 'squash',
    },
  };
}

function getCurrentBranch(cwd: string): string {
  return execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
    cwd,
    encoding: 'utf-8',
    stdio: 'pipe',
  }).trim();
}

function branchExists(branch: string, cwd: string): boolean {
  try {
    execFileSync('git', ['rev-parse', '--verify', `refs/heads/${branch}`], {
      cwd,
      stdio: 'pipe',
    });
    return true;
  } catch {
    return false;
  }
}

function getLog(cwd: string, count: number = 5): string {
  return execFileSync('git', ['log', '--oneline', `-${count}`], {
    cwd,
    encoding: 'utf-8',
    stdio: 'pipe',
  }).trim();
}

// =============================================================================
// Tests
// =============================================================================

describe('BranchManager', () => {
  let repoDir: string;
  let config: BranchConfig;

  beforeEach(() => {
    repoDir = createTempGitRepo();
    config = getDefaultBranchConfig();
  });

  afterEach(() => {
    cleanupDir(repoDir);
  });

  // ===========================================================================
  // Branch creation
  // ===========================================================================

  describe('ensureBeanBranch', () => {
    it('creates a bean branch from default branch when no parent', async () => {
      const mgr = new BranchManager(config, repoDir);
      const bean = makeBean({ id: 'daedalus-abc1', type: 'feature' });

      // Mock: no parent
      const fetchBean = async () => null;

      await mgr.ensureBeanBranch(bean, fetchBean);

      expect(branchExists('bean/daedalus-abc1', repoDir)).toBe(true);
      expect(getCurrentBranch(repoDir)).toBe('bean/daedalus-abc1');
    });

    it('creates a bean branch from parent branch', async () => {
      const mgr = new BranchManager(config, repoDir);

      const parent = makeBean({
        id: 'daedalus-parent',
        type: 'feature',
      });
      const child = makeBean({
        id: 'daedalus-child',
        type: 'task',
        parentId: 'daedalus-parent',
      });

      const fetchBean = async (id: string) => {
        if (id === 'daedalus-parent') return parent;
        return null;
      };

      await mgr.ensureBeanBranch(child, fetchBean);

      expect(branchExists('bean/daedalus-parent', repoDir)).toBe(true);
      expect(branchExists('bean/daedalus-child', repoDir)).toBe(true);
      expect(getCurrentBranch(repoDir)).toBe('bean/daedalus-child');
    });

    it('creates ancestor chain for deeply nested beans', async () => {
      const mgr = new BranchManager(config, repoDir);

      const grandparent = makeBean({
        id: 'daedalus-gp',
        type: 'epic',
      });
      const parent = makeBean({
        id: 'daedalus-parent',
        type: 'feature',
        parentId: 'daedalus-gp',
      });
      const child = makeBean({
        id: 'daedalus-child',
        type: 'task',
        parentId: 'daedalus-parent',
      });

      const fetchBean = async (id: string) => {
        if (id === 'daedalus-gp') return grandparent;
        if (id === 'daedalus-parent') return parent;
        return null;
      };

      await mgr.ensureBeanBranch(child, fetchBean);

      expect(branchExists('bean/daedalus-gp', repoDir)).toBe(true);
      expect(branchExists('bean/daedalus-parent', repoDir)).toBe(true);
      expect(branchExists('bean/daedalus-child', repoDir)).toBe(true);
      expect(getCurrentBranch(repoDir)).toBe('bean/daedalus-child');
    });

    it('reuses existing ancestor branches', async () => {
      const mgr = new BranchManager(config, repoDir);

      // Pre-create parent branch
      execFileSync('git', ['branch', 'bean/daedalus-parent'], {
        cwd: repoDir,
        stdio: 'pipe',
      });

      const parent = makeBean({
        id: 'daedalus-parent',
        type: 'feature',
      });
      const child = makeBean({
        id: 'daedalus-child',
        type: 'task',
        parentId: 'daedalus-parent',
      });

      const fetchBean = async (id: string) => {
        if (id === 'daedalus-parent') return parent;
        return null;
      };

      // Should not throw even though parent branch already exists
      await mgr.ensureBeanBranch(child, fetchBean);

      expect(branchExists('bean/daedalus-child', repoDir)).toBe(true);
      expect(getCurrentBranch(repoDir)).toBe('bean/daedalus-child');
    });

    it('reuses existing bean branch (idempotent)', async () => {
      const mgr = new BranchManager(config, repoDir);
      const bean = makeBean({ id: 'daedalus-abc1', type: 'task' });
      const fetchBean = async () => null;

      // Create branch first time
      await mgr.ensureBeanBranch(bean, fetchBean);
      expect(getCurrentBranch(repoDir)).toBe('bean/daedalus-abc1');

      // Switch away
      execFileSync('git', ['checkout', 'main'], {
        cwd: repoDir,
        stdio: 'pipe',
      });

      // Should just checkout, not fail
      await mgr.ensureBeanBranch(bean, fetchBean);
      expect(getCurrentBranch(repoDir)).toBe('bean/daedalus-abc1');
    });

    it('does nothing when branching is disabled', async () => {
      config.enabled = false;
      const mgr = new BranchManager(config, repoDir);
      const bean = makeBean({ id: 'daedalus-abc1', type: 'task' });
      const fetchBean = async () => null;

      const defaultBranch = getCurrentBranch(repoDir);
      await mgr.ensureBeanBranch(bean, fetchBean);

      // Should stay on current branch
      expect(getCurrentBranch(repoDir)).toBe(defaultBranch);
      expect(branchExists('bean/daedalus-abc1', repoDir)).toBe(false);
    });
  });

  // ===========================================================================
  // Merge target resolution
  // ===========================================================================

  describe('getMergeTarget', () => {
    it('returns parent branch for beans with parents', async () => {
      const mgr = new BranchManager(config, repoDir);
      const bean = makeBean({
        id: 'daedalus-child',
        type: 'task',
        parentId: 'daedalus-parent',
      });

      const target = mgr.getMergeTarget(bean);
      expect(target).toBe('bean/daedalus-parent');
    });

    it('returns default branch for top-level beans', async () => {
      const mgr = new BranchManager(config, repoDir);
      const bean = makeBean({ id: 'daedalus-top', type: 'feature' });

      const target = mgr.getMergeTarget(bean);
      expect(target).toBe('main');
    });

    it('uses configured default branch', async () => {
      config.default_branch = 'develop';
      const mgr = new BranchManager(config, repoDir);
      const bean = makeBean({ id: 'daedalus-top', type: 'feature' });

      const target = mgr.getMergeTarget(bean);
      expect(target).toBe('develop');
    });
  });

  // ===========================================================================
  // Merge strategy resolution
  // ===========================================================================

  describe('getMergeStrategy', () => {
    it('returns squash for task beans', () => {
      const mgr = new BranchManager(config, repoDir);
      expect(mgr.getMergeStrategy('task')).toBe('squash');
    });

    it('returns squash for bug beans', () => {
      const mgr = new BranchManager(config, repoDir);
      expect(mgr.getMergeStrategy('bug')).toBe('squash');
    });

    it('returns merge for feature beans', () => {
      const mgr = new BranchManager(config, repoDir);
      expect(mgr.getMergeStrategy('feature')).toBe('merge');
    });

    it('returns merge for epic beans', () => {
      const mgr = new BranchManager(config, repoDir);
      expect(mgr.getMergeStrategy('epic')).toBe('merge');
    });

    it('returns merge for milestone beans', () => {
      const mgr = new BranchManager(config, repoDir);
      expect(mgr.getMergeStrategy('milestone')).toBe('merge');
    });

    it('respects custom strategy overrides', () => {
      config.merge_strategy.task = 'merge';
      const mgr = new BranchManager(config, repoDir);
      expect(mgr.getMergeStrategy('task')).toBe('merge');
    });
  });

  // ===========================================================================
  // Type-aware merge
  // ===========================================================================

  describe('mergeBeanBranch', () => {
    it('squash-merges task branches with commit message', async () => {
      const mgr = new BranchManager(config, repoDir);
      const bean = makeBean({ id: 'daedalus-task1', type: 'task' });
      const fetchBean = async () => null;

      // Create and work on bean branch
      await mgr.ensureBeanBranch(bean, fetchBean);
      writeFileSync(join(repoDir, 'task-work.txt'), 'task work');
      execFileSync('git', ['add', '.'], { cwd: repoDir, stdio: 'pipe' });
      execFileSync('git', ['commit', '-m', 'wip: task work'], {
        cwd: repoDir,
        stdio: 'pipe',
      });

      // Merge back
      const result = await mgr.mergeBeanBranch(
        bean,
        'chore: squashed task\n\nBean: daedalus-task1'
      );

      expect(result.success).toBe(true);
      expect(result.commitSha).toMatch(/^[0-9a-f]{40}$/);
      expect(getCurrentBranch(repoDir)).toBe('main');

      // Verify squash: the wip commit should not appear in main's log
      const log = getLog(repoDir);
      expect(log).toContain('chore: squashed task');
      expect(log).not.toContain('wip: task work');
    });

    it('merge-commits feature branches preserving history', async () => {
      const mgr = new BranchManager(config, repoDir);
      const bean = makeBean({ id: 'daedalus-feat1', type: 'feature' });
      const fetchBean = async () => null;

      // Create and work on bean branch
      await mgr.ensureBeanBranch(bean, fetchBean);
      writeFileSync(join(repoDir, 'feature-work.txt'), 'feature work');
      execFileSync('git', ['add', '.'], { cwd: repoDir, stdio: 'pipe' });
      execFileSync('git', ['commit', '-m', 'feat: feature work'], {
        cwd: repoDir,
        stdio: 'pipe',
      });

      // Merge back
      const result = await mgr.mergeBeanBranch(
        bean,
        'feat: merge feature\n\nBean: daedalus-feat1'
      );

      expect(result.success).toBe(true);
      expect(getCurrentBranch(repoDir)).toBe('main');

      // Verify merge commit: the original commit should appear in history
      const log = getLog(repoDir);
      expect(log).toContain('feat: merge feature');
      expect(log).toContain('feat: feature work');
    });

    it('merges into parent branch (not default branch)', async () => {
      const mgr = new BranchManager(config, repoDir);

      const parent = makeBean({
        id: 'daedalus-parent',
        type: 'feature',
      });
      const child = makeBean({
        id: 'daedalus-child',
        type: 'task',
        parentId: 'daedalus-parent',
      });

      const fetchBean = async (id: string) => {
        if (id === 'daedalus-parent') return parent;
        return null;
      };

      // Create parent branch
      await mgr.ensureBeanBranch(parent, fetchBean);
      // Switch to main to create child
      execFileSync('git', ['checkout', 'main'], {
        cwd: repoDir,
        stdio: 'pipe',
      });

      // Create child branch from parent
      await mgr.ensureBeanBranch(child, fetchBean);
      writeFileSync(join(repoDir, 'child-work.txt'), 'child work');
      execFileSync('git', ['add', '.'], { cwd: repoDir, stdio: 'pipe' });
      execFileSync('git', ['commit', '-m', 'wip: child work'], {
        cwd: repoDir,
        stdio: 'pipe',
      });

      // Merge child into parent
      const result = await mgr.mergeBeanBranch(
        child,
        'chore: child task\n\nBean: daedalus-child'
      );

      expect(result.success).toBe(true);
      // Should be on parent branch after merge
      expect(getCurrentBranch(repoDir)).toBe('bean/daedalus-parent');
    });

    it('deletes bean branch after merge when configured', async () => {
      config.delete_after_merge = true;
      const mgr = new BranchManager(config, repoDir);
      const bean = makeBean({ id: 'daedalus-del1', type: 'task' });
      const fetchBean = async () => null;

      await mgr.ensureBeanBranch(bean, fetchBean);
      writeFileSync(join(repoDir, 'work.txt'), 'work');
      execFileSync('git', ['add', '.'], { cwd: repoDir, stdio: 'pipe' });
      execFileSync('git', ['commit', '-m', 'work'], {
        cwd: repoDir,
        stdio: 'pipe',
      });

      await mgr.mergeBeanBranch(bean, 'chore: done');

      expect(branchExists('bean/daedalus-del1', repoDir)).toBe(false);
    });

    it('keeps bean branch after merge when configured', async () => {
      config.delete_after_merge = false;
      const mgr = new BranchManager(config, repoDir);
      const bean = makeBean({ id: 'daedalus-keep1', type: 'task' });
      const fetchBean = async () => null;

      await mgr.ensureBeanBranch(bean, fetchBean);
      writeFileSync(join(repoDir, 'work.txt'), 'work');
      execFileSync('git', ['add', '.'], { cwd: repoDir, stdio: 'pipe' });
      execFileSync('git', ['commit', '-m', 'work'], {
        cwd: repoDir,
        stdio: 'pipe',
      });

      await mgr.mergeBeanBranch(bean, 'chore: done');

      expect(branchExists('bean/daedalus-keep1', repoDir)).toBe(true);
    });
  });

  // ===========================================================================
  // Merge conflict handling
  // ===========================================================================

  describe('merge conflict handling', () => {
    it('returns conflict result and aborts merge on conflict', async () => {
      const mgr = new BranchManager(config, repoDir);
      const bean = makeBean({ id: 'daedalus-conflict', type: 'task' });
      const fetchBean = async () => null;

      // Create bean branch
      await mgr.ensureBeanBranch(bean, fetchBean);
      writeFileSync(join(repoDir, 'conflict.txt'), 'bean version');
      execFileSync('git', ['add', '.'], { cwd: repoDir, stdio: 'pipe' });
      execFileSync('git', ['commit', '-m', 'bean change'], {
        cwd: repoDir,
        stdio: 'pipe',
      });

      // Create conflicting change on main
      execFileSync('git', ['checkout', 'main'], {
        cwd: repoDir,
        stdio: 'pipe',
      });
      writeFileSync(join(repoDir, 'conflict.txt'), 'main version');
      execFileSync('git', ['add', '.'], { cwd: repoDir, stdio: 'pipe' });
      execFileSync('git', ['commit', '-m', 'main change'], {
        cwd: repoDir,
        stdio: 'pipe',
      });

      // Switch back to bean branch for merge
      execFileSync('git', ['checkout', 'bean/daedalus-conflict'], {
        cwd: repoDir,
        stdio: 'pipe',
      });

      // Attempt merge - should detect conflict
      const result = await mgr.mergeBeanBranch(bean, 'chore: should conflict');

      expect(result.success).toBe(false);
      expect(result.conflict).toBe(true);
    });
  });

  // ===========================================================================
  // Dirty working tree
  // ===========================================================================

  describe('dirty working tree detection', () => {
    it('throws when working tree is dirty during branch creation', async () => {
      const mgr = new BranchManager(config, repoDir);
      const bean = makeBean({ id: 'daedalus-dirty', type: 'task' });
      const fetchBean = async () => null;

      // Create uncommitted changes
      writeFileSync(join(repoDir, 'dirty.txt'), 'uncommitted');

      await expect(mgr.ensureBeanBranch(bean, fetchBean)).rejects.toThrow(
        /dirty/i
      );
    });
  });

  // ===========================================================================
  // Git state recovery
  // ===========================================================================

  describe('recoverGitState', () => {
    it('aborts in-progress merge on recovery', () => {
      const mgr = new BranchManager(config, repoDir);

      // Create a merge conflict state
      execFileSync('git', ['branch', 'conflict-branch'], {
        cwd: repoDir,
        stdio: 'pipe',
      });
      execFileSync('git', ['checkout', 'conflict-branch'], {
        cwd: repoDir,
        stdio: 'pipe',
      });
      writeFileSync(join(repoDir, 'file.txt'), 'branch version');
      execFileSync('git', ['add', '.'], { cwd: repoDir, stdio: 'pipe' });
      execFileSync('git', ['commit', '-m', 'branch'], {
        cwd: repoDir,
        stdio: 'pipe',
      });
      execFileSync('git', ['checkout', 'main'], {
        cwd: repoDir,
        stdio: 'pipe',
      });
      writeFileSync(join(repoDir, 'file.txt'), 'main version');
      execFileSync('git', ['add', '.'], { cwd: repoDir, stdio: 'pipe' });
      execFileSync('git', ['commit', '-m', 'main'], {
        cwd: repoDir,
        stdio: 'pipe',
      });

      try {
        execFileSync('git', ['merge', 'conflict-branch'], {
          cwd: repoDir,
          stdio: 'pipe',
        });
      } catch {
        // Expected conflict
      }

      // Should recover
      const recovered = mgr.recoverGitState();
      expect(recovered).toBe(true);
    });

    it('returns false when no recovery needed', () => {
      const mgr = new BranchManager(config, repoDir);
      const recovered = mgr.recoverGitState();
      expect(recovered).toBe(false);
    });
  });

  // ===========================================================================
  // Branch name helpers
  // ===========================================================================

  describe('getBranchName', () => {
    it('returns bean/{id} format', () => {
      const mgr = new BranchManager(config, repoDir);
      expect(mgr.getBranchName('daedalus-abc1')).toBe('bean/daedalus-abc1');
    });
  });
});
