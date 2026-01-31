/**
 * Git Operations Module
 *
 * Centralized, shell-injection-safe git operations using execFileSync.
 * All git commands go through this module to prevent shell injection attacks.
 *
 * Key security properties:
 * - Uses execFileSync (no shell interpretation of arguments)
 * - Validates bean IDs before use in branch names
 * - Commit messages passed via -m flag to execFileSync (no shell escaping needed)
 */
import { execFileSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';

// =============================================================================
// Validation
// =============================================================================

/**
 * Validate a bean ID for safe use in branch names.
 * Only allows alphanumeric, hyphens, and underscores.
 */
export function validateBeanId(id: string): boolean {
  if (!id || id.length === 0) return false;
  return /^[a-zA-Z0-9_-]+$/.test(id);
}

/**
 * Assert a bean ID is valid, throwing if not.
 */
function assertValidBeanId(id: string): void {
  if (!validateBeanId(id)) {
    throw new Error(`Invalid bean ID for branch name: "${id}"`);
  }
}

// =============================================================================
// Low-level Git Execution
// =============================================================================

/**
 * Execute a git command using execFileSync (no shell interpretation).
 * @param args Git command arguments (e.g., ['status', '--porcelain'])
 * @param cwd Working directory
 * @returns stdout trimmed
 * @throws Error if git command fails
 */
export function git(args: string[], cwd?: string): string {
  try {
    const result = execFileSync('git', args, {
      cwd: cwd ?? process.cwd(),
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return result.trim();
  } catch (error: unknown) {
    const err = error as { message?: string; stderr?: Buffer | string };
    const stderr =
      typeof err.stderr === 'string'
        ? err.stderr
        : err.stderr?.toString() ?? '';
    throw new Error(`Git command failed: git ${args.join(' ')}\n${stderr}`);
  }
}

/**
 * Execute a git command with bean ID validation on branch-name arguments.
 * Validates any argument that looks like a bean branch name (bean/...).
 * @throws Error if any bean ID in branch names is invalid
 */
export function gitSafe(args: string[], cwd?: string): string {
  // Validate any bean/ branch references
  for (const arg of args) {
    if (arg.startsWith('bean/')) {
      const beanId = arg.slice('bean/'.length);
      assertValidBeanId(beanId);
    }
  }
  return git(args, cwd);
}

// =============================================================================
// Branch Operations
// =============================================================================

/**
 * Get the current branch name.
 */
export function getCurrentBranch(cwd?: string): string {
  return git(['rev-parse', '--abbrev-ref', 'HEAD'], cwd);
}

/**
 * Check if a branch exists locally.
 */
export function branchExists(branch: string, cwd?: string): boolean {
  try {
    git(['rev-parse', '--verify', `refs/heads/${branch}`], cwd);
    return true;
  } catch {
    return false;
  }
}

/**
 * Create a new branch.
 * @param branch Branch name to create
 * @param base Base branch/ref to create from (defaults to HEAD)
 * @param cwd Working directory
 */
export function createBranch(
  branch: string,
  base?: string,
  cwd?: string
): void {
  const args = ['branch', branch];
  if (base) {
    args.push(base);
  }
  git(args, cwd);
}

/**
 * Checkout an existing branch.
 */
export function checkoutBranch(branch: string, cwd?: string): void {
  git(['checkout', branch], cwd);
}

/**
 * Delete a branch (tries -d first, then -D for force).
 */
export function deleteBranch(branch: string, cwd?: string): void {
  try {
    git(['branch', '-d', branch], cwd);
  } catch {
    git(['branch', '-D', branch], cwd);
  }
}

// =============================================================================
// Working Tree State
// =============================================================================

/**
 * Check if there are staged changes.
 */
export function hasStagedChanges(cwd?: string): boolean {
  try {
    const diff = git(['diff', '--cached', '--name-only'], cwd);
    return diff.length > 0;
  } catch {
    return false;
  }
}

/**
 * Check if the working tree has any changes (staged or unstaged).
 */
export function isWorkingTreeDirty(cwd?: string): boolean {
  try {
    const status = git(['status', '--porcelain'], cwd);
    return status.length > 0;
  } catch {
    return false;
  }
}

// =============================================================================
// Commit Operations
// =============================================================================

/**
 * Commit staged changes with the given message.
 * Uses execFileSync with -m flag — no shell escaping needed.
 * @returns The full commit SHA
 */
export function commitChanges(message: string, cwd?: string): string {
  git(['commit', '-m', message], cwd);
  return git(['rev-parse', 'HEAD'], cwd);
}

// =============================================================================
// Merge Operations
// =============================================================================

/**
 * Merge a branch with --no-ff (creates merge commit, preserves history).
 * Used for feature/epic/milestone beans.
 * @param branch Branch to merge
 * @param message Merge commit message
 * @param cwd Working directory
 */
export function mergeNoFf(
  branch: string,
  message: string,
  cwd?: string
): void {
  git(['merge', '--no-ff', '-m', message, branch], cwd);
}

/**
 * Squash-merge a branch (stages changes but does NOT commit).
 * Used for task/bug beans. Caller must commit after.
 * @param branch Branch to squash-merge
 * @param cwd Working directory
 */
export function mergeSquash(branch: string, cwd?: string): void {
  git(['merge', '--squash', branch], cwd);
}

/**
 * Abort an in-progress merge.
 */
export function abortMerge(cwd?: string): void {
  git(['merge', '--abort'], cwd);
}

// =============================================================================
// Git State Detection
// =============================================================================

/**
 * Check if we're in the middle of a merge (MERGE_HEAD exists).
 */
export function hasMergeHead(cwd?: string): boolean {
  const gitDir = getGitDir(cwd);
  if (!gitDir) return false;
  return existsSync(join(gitDir, 'MERGE_HEAD'));
}

/**
 * Check if we're in the middle of a rebase (rebase-merge or rebase-apply exists).
 */
export function hasRebaseHead(cwd?: string): boolean {
  const gitDir = getGitDir(cwd);
  if (!gitDir) return false;
  return (
    existsSync(join(gitDir, 'rebase-merge')) ||
    existsSync(join(gitDir, 'rebase-apply'))
  );
}

/**
 * Get the absolute .git directory path (handles worktrees).
 */
function getGitDir(cwd?: string): string | null {
  try {
    return git(['rev-parse', '--absolute-git-dir'], cwd);
  } catch {
    return null;
  }
}

// =============================================================================
// Worktree Operations
// =============================================================================

/**
 * Create a git worktree.
 * @param worktreePath Path for the worktree
 * @param branch Branch to checkout in worktree
 * @param createBranch If true, creates a new branch
 * @param cwd Working directory
 */
export function createWorktree(
  worktreePath: string,
  branch: string,
  createNewBranch: boolean = true,
  cwd?: string
): void {
  if (createNewBranch) {
    git(['worktree', 'add', worktreePath, '-b', branch], cwd);
  } else {
    git(['worktree', 'add', worktreePath, branch], cwd);
  }
}

/**
 * Remove a git worktree.
 */
export function removeWorktree(worktreePath: string, cwd?: string): void {
  git(['worktree', 'remove', worktreePath, '--force'], cwd);
}
