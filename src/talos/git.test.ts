/**
 * Git Operations Tests
 *
 * Tests for the centralized git module that uses execFileSync
 * for shell-injection-safe git operations.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { execFileSync } from 'child_process';
import { tmpdir } from 'os';
import {
  git,
  gitSafe,
  hasStagedChanges,
  getCurrentBranch,
  branchExists,
  createBranch,
  checkoutBranch,
  mergeNoFf,
  mergeSquash,
  abortMerge,
  deleteBranch,
  hasMergeHead,
  hasRebaseHead,
  isWorkingTreeDirty,
  commitChanges,
  validateBeanId,
} from './git.js';

// =============================================================================
// Test Helpers
// =============================================================================

function createTempGitRepo(): string {
  const dir = join(
    tmpdir(),
    `git-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
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
  // Create initial commit so we have a branch
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

// =============================================================================
// Tests
// =============================================================================

describe('git module', () => {
  let repoDir: string;

  beforeEach(() => {
    repoDir = createTempGitRepo();
  });

  afterEach(() => {
    cleanupDir(repoDir);
  });

  // ===========================================================================
  // validateBeanId
  // ===========================================================================

  describe('validateBeanId', () => {
    it('accepts valid bean IDs', () => {
      expect(validateBeanId('daedalus-8jow')).toBe(true);
      expect(validateBeanId('daedalus-xfh9')).toBe(true);
      expect(validateBeanId('my-bean-123')).toBe(true);
    });

    it('rejects IDs with shell metacharacters', () => {
      expect(validateBeanId('bean; rm -rf /')).toBe(false);
      expect(validateBeanId('bean$(whoami)')).toBe(false);
      expect(validateBeanId('bean`id`')).toBe(false);
      expect(validateBeanId('bean|cat')).toBe(false);
      expect(validateBeanId('bean&echo')).toBe(false);
      expect(validateBeanId('bean\nid')).toBe(false);
    });

    it('rejects empty strings', () => {
      expect(validateBeanId('')).toBe(false);
    });
  });

  // ===========================================================================
  // git (low-level)
  // ===========================================================================

  describe('git', () => {
    it('executes git commands and returns stdout', () => {
      const result = git(['rev-parse', '--abbrev-ref', 'HEAD'], repoDir);
      // Git init creates 'main' or 'master' depending on config
      expect(['main', 'master']).toContain(result);
    });

    it('throws on invalid git commands', () => {
      expect(() => git(['invalid-command'], repoDir)).toThrow();
    });

    it('uses execFileSync (no shell interpretation)', () => {
      // This would be dangerous with execSync but safe with execFileSync
      // The argument is passed as a literal, not interpreted by shell
      expect(() =>
        git(['rev-parse', '--verify', 'refs/heads/$(whoami)'], repoDir)
      ).toThrow(); // Branch doesn't exist, but no shell injection
    });
  });

  // ===========================================================================
  // gitSafe (with bean ID validation)
  // ===========================================================================

  describe('gitSafe', () => {
    it('rejects commands with invalid bean IDs in branch names', () => {
      expect(() =>
        gitSafe(['checkout', '-b', 'bean/evil; rm -rf /'], repoDir)
      ).toThrow(/Invalid bean ID/);
    });
  });

  // ===========================================================================
  // Branch operations
  // ===========================================================================

  describe('getCurrentBranch', () => {
    it('returns the current branch name', () => {
      const branch = getCurrentBranch(repoDir);
      expect(['main', 'master']).toContain(branch);
    });
  });

  describe('branchExists', () => {
    it('returns true for existing branches', () => {
      const defaultBranch = getCurrentBranch(repoDir);
      expect(branchExists(defaultBranch, repoDir)).toBe(true);
    });

    it('returns false for non-existing branches', () => {
      expect(branchExists('nonexistent-branch', repoDir)).toBe(false);
    });
  });

  describe('createBranch', () => {
    it('creates a new branch from the current HEAD', () => {
      createBranch('bean/test-branch', undefined, repoDir);
      expect(branchExists('bean/test-branch', repoDir)).toBe(true);
    });

    it('creates a branch from a specified base', () => {
      const defaultBranch = getCurrentBranch(repoDir);
      createBranch('bean/from-base', defaultBranch, repoDir);
      expect(branchExists('bean/from-base', repoDir)).toBe(true);
    });

    it('throws if branch already exists', () => {
      createBranch('bean/duplicate', undefined, repoDir);
      expect(() => createBranch('bean/duplicate', undefined, repoDir)).toThrow();
    });
  });

  describe('checkoutBranch', () => {
    it('switches to an existing branch', () => {
      createBranch('bean/checkout-test', undefined, repoDir);
      checkoutBranch('bean/checkout-test', repoDir);
      expect(getCurrentBranch(repoDir)).toBe('bean/checkout-test');
    });
  });

  describe('deleteBranch', () => {
    it('deletes a merged branch', () => {
      createBranch('bean/to-delete', undefined, repoDir);
      deleteBranch('bean/to-delete', repoDir);
      expect(branchExists('bean/to-delete', repoDir)).toBe(false);
    });

    it('force deletes an unmerged branch', () => {
      createBranch('bean/unmerged', undefined, repoDir);
      checkoutBranch('bean/unmerged', repoDir);
      writeFileSync(join(repoDir, 'new-file.txt'), 'content');
      execFileSync('git', ['add', '.'], { cwd: repoDir, stdio: 'pipe' });
      execFileSync('git', ['commit', '-m', 'new commit'], {
        cwd: repoDir,
        stdio: 'pipe',
      });
      const defaultBranch = execFileSync(
        'git',
        ['rev-parse', '--abbrev-ref', 'HEAD'],
        { cwd: repoDir, encoding: 'utf-8', stdio: 'pipe' }
      ).trim();
      // Switch back to default branch first
      const branches = execFileSync('git', ['branch'], {
        cwd: repoDir,
        encoding: 'utf-8',
        stdio: 'pipe',
      });
      const otherBranch = branches
        .split('\n')
        .map((b) => b.trim().replace('* ', ''))
        .find((b) => b && b !== 'bean/unmerged');
      if (otherBranch) {
        checkoutBranch(otherBranch, repoDir);
      }
      deleteBranch('bean/unmerged', repoDir);
      expect(branchExists('bean/unmerged', repoDir)).toBe(false);
    });
  });

  // ===========================================================================
  // Staged changes
  // ===========================================================================

  describe('hasStagedChanges', () => {
    it('returns false when no staged changes', () => {
      expect(hasStagedChanges(repoDir)).toBe(false);
    });

    it('returns true when there are staged changes', () => {
      writeFileSync(join(repoDir, 'new-file.txt'), 'content');
      execFileSync('git', ['add', 'new-file.txt'], {
        cwd: repoDir,
        stdio: 'pipe',
      });
      expect(hasStagedChanges(repoDir)).toBe(true);
    });
  });

  // ===========================================================================
  // Working tree dirty check
  // ===========================================================================

  describe('isWorkingTreeDirty', () => {
    it('returns false for clean working tree', () => {
      expect(isWorkingTreeDirty(repoDir)).toBe(false);
    });

    it('returns true for unstaged changes', () => {
      writeFileSync(join(repoDir, 'README.md'), 'modified\n');
      expect(isWorkingTreeDirty(repoDir)).toBe(true);
    });

    it('returns true for staged changes', () => {
      writeFileSync(join(repoDir, 'new.txt'), 'new');
      execFileSync('git', ['add', 'new.txt'], {
        cwd: repoDir,
        stdio: 'pipe',
      });
      expect(isWorkingTreeDirty(repoDir)).toBe(true);
    });
  });

  // ===========================================================================
  // Commit
  // ===========================================================================

  describe('commitChanges', () => {
    it('commits staged changes and returns SHA', () => {
      writeFileSync(join(repoDir, 'file.txt'), 'content');
      execFileSync('git', ['add', 'file.txt'], {
        cwd: repoDir,
        stdio: 'pipe',
      });
      const sha = commitChanges('test commit', repoDir);
      expect(sha).toMatch(/^[0-9a-f]{40}$/);
    });

    it('handles commit messages with special characters', () => {
      writeFileSync(join(repoDir, 'file.txt'), 'content');
      execFileSync('git', ['add', 'file.txt'], {
        cwd: repoDir,
        stdio: 'pipe',
      });
      const sha = commitChanges(
        "feat(scope): message with 'quotes' and $pecial chars",
        repoDir
      );
      expect(sha).toMatch(/^[0-9a-f]{40}$/);
    });

    it('handles multi-line commit messages', () => {
      writeFileSync(join(repoDir, 'file.txt'), 'content');
      execFileSync('git', ['add', 'file.txt'], {
        cwd: repoDir,
        stdio: 'pipe',
      });
      const sha = commitChanges(
        'feat: title\n\nBody paragraph\n\nBean: daedalus-abc1',
        repoDir
      );
      expect(sha).toMatch(/^[0-9a-f]{40}$/);

      // Verify the message was preserved
      const msg = execFileSync(
        'git',
        ['log', '-1', '--format=%B'],
        { cwd: repoDir, encoding: 'utf-8', stdio: 'pipe' }
      ).trim();
      expect(msg).toContain('feat: title');
      expect(msg).toContain('Body paragraph');
      expect(msg).toContain('Bean: daedalus-abc1');
    });
  });

  // ===========================================================================
  // Merge operations
  // ===========================================================================

  describe('mergeNoFf', () => {
    it('merges a branch with --no-ff creating a merge commit', () => {
      const defaultBranch = getCurrentBranch(repoDir);

      // Create feature branch with a commit
      createBranch('bean/feature', undefined, repoDir);
      checkoutBranch('bean/feature', repoDir);
      writeFileSync(join(repoDir, 'feature.txt'), 'feature');
      execFileSync('git', ['add', '.'], { cwd: repoDir, stdio: 'pipe' });
      execFileSync('git', ['commit', '-m', 'add feature'], {
        cwd: repoDir,
        stdio: 'pipe',
      });

      // Switch back and merge
      checkoutBranch(defaultBranch, repoDir);
      mergeNoFf('bean/feature', 'Merge feature', repoDir);

      // Verify merge commit exists
      const log = execFileSync(
        'git',
        ['log', '--oneline', '-3'],
        { cwd: repoDir, encoding: 'utf-8', stdio: 'pipe' }
      );
      expect(log).toContain('Merge feature');
    });
  });

  describe('mergeSquash', () => {
    it('squash-merges a branch into current', () => {
      const defaultBranch = getCurrentBranch(repoDir);

      // Create task branch with multiple commits
      createBranch('bean/task', undefined, repoDir);
      checkoutBranch('bean/task', repoDir);
      writeFileSync(join(repoDir, 'task1.txt'), 'task1');
      execFileSync('git', ['add', '.'], { cwd: repoDir, stdio: 'pipe' });
      execFileSync('git', ['commit', '-m', 'task commit 1'], {
        cwd: repoDir,
        stdio: 'pipe',
      });
      writeFileSync(join(repoDir, 'task2.txt'), 'task2');
      execFileSync('git', ['add', '.'], { cwd: repoDir, stdio: 'pipe' });
      execFileSync('git', ['commit', '-m', 'task commit 2'], {
        cwd: repoDir,
        stdio: 'pipe',
      });

      // Switch back and squash merge
      checkoutBranch(defaultBranch, repoDir);
      mergeSquash('bean/task', repoDir);

      // Changes should be staged but not committed
      expect(hasStagedChanges(repoDir)).toBe(true);

      // Commit the squashed changes
      const sha = commitChanges('chore: squashed task', repoDir);
      expect(sha).toMatch(/^[0-9a-f]{40}$/);

      // Verify only one new commit (not two)
      const log = execFileSync(
        'git',
        ['log', '--oneline', '-3'],
        { cwd: repoDir, encoding: 'utf-8', stdio: 'pipe' }
      );
      expect(log).toContain('chore: squashed task');
      expect(log).not.toContain('task commit 1');
      expect(log).not.toContain('task commit 2');
    });
  });

  // ===========================================================================
  // Merge conflict handling
  // ===========================================================================

  describe('merge conflict handling', () => {
    it('abortMerge aborts an in-progress merge', () => {
      const defaultBranch = getCurrentBranch(repoDir);

      // Create conflicting branches
      createBranch('bean/conflict-a', undefined, repoDir);
      checkoutBranch('bean/conflict-a', repoDir);
      writeFileSync(join(repoDir, 'conflict.txt'), 'version A');
      execFileSync('git', ['add', '.'], { cwd: repoDir, stdio: 'pipe' });
      execFileSync('git', ['commit', '-m', 'version A'], {
        cwd: repoDir,
        stdio: 'pipe',
      });

      checkoutBranch(defaultBranch, repoDir);
      createBranch('bean/conflict-b', undefined, repoDir);
      checkoutBranch('bean/conflict-b', repoDir);
      writeFileSync(join(repoDir, 'conflict.txt'), 'version B');
      execFileSync('git', ['add', '.'], { cwd: repoDir, stdio: 'pipe' });
      execFileSync('git', ['commit', '-m', 'version B'], {
        cwd: repoDir,
        stdio: 'pipe',
      });

      // Merge A into B (should conflict)
      try {
        execFileSync('git', ['merge', 'bean/conflict-a'], {
          cwd: repoDir,
          stdio: 'pipe',
        });
      } catch {
        // Expected conflict
      }

      // Should have MERGE_HEAD
      expect(hasMergeHead(repoDir)).toBe(true);

      // Abort
      abortMerge(repoDir);

      // Should no longer have MERGE_HEAD
      expect(hasMergeHead(repoDir)).toBe(false);
    });
  });

  // ===========================================================================
  // State detection
  // ===========================================================================

  describe('hasMergeHead', () => {
    it('returns false when not in merge state', () => {
      expect(hasMergeHead(repoDir)).toBe(false);
    });
  });

  describe('hasRebaseHead', () => {
    it('returns false when not in rebase state', () => {
      expect(hasRebaseHead(repoDir)).toBe(false);
    });
  });
});
