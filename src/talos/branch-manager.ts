/**
 * Branch Manager
 *
 * Manages the branch-per-bean lifecycle:
 * - Hierarchical branch creation (ancestor chain auto-creation)
 * - Type-aware merge strategies (merge vs squash)
 * - Merge conflict detection and abort
 * - Git state recovery on daemon startup
 *
 * Branch naming: bean/{beanId}
 * Merge target: parent's branch (bean/{parentId}) or default branch
 */
import { EventEmitter } from 'events';
import type { BranchConfig, MergeStrategy } from '../config/index.js';
import type { Bean, BeanType } from './beans-client.js';
import {
  git,
  getCurrentBranch,
  branchExists,
  createBranch,
  checkoutBranch,
  deleteBranch,
  hasStagedChanges,
  isWorkingTreeDirty,
  commitChanges,
  mergeNoFf,
  mergeSquash,
  abortMerge,
  hasMergeHead,
  hasRebaseHead,
  validateBeanId,
} from './git.js';

// =============================================================================
// Types
// =============================================================================

export interface MergeResult {
  /** Whether the merge succeeded */
  success: boolean;
  /** Commit SHA if merge created a commit */
  commitSha?: string;
  /** Whether there was a merge conflict */
  conflict?: boolean;
  /** Error message if merge failed */
  error?: string;
}

/**
 * Callback to fetch a bean by ID (dependency injection)
 */
export type BeanFetcher = (id: string) => Promise<Bean | null>;

// =============================================================================
// Branch Manager
// =============================================================================

export class BranchManager extends EventEmitter {
  private config: BranchConfig;
  private cwd: string;

  constructor(config: BranchConfig, cwd?: string) {
    super();
    this.config = config;
    this.cwd = cwd ?? process.cwd();
  }

  // ===========================================================================
  // Branch Naming
  // ===========================================================================

  /**
   * Get the branch name for a bean ID.
   */
  getBranchName(beanId: string): string {
    return `bean/${beanId}`;
  }

  // ===========================================================================
  // Branch Creation (Hierarchical)
  // ===========================================================================

  /**
   * Ensure the bean's branch exists, creating the full ancestor chain if needed.
   * After this call, the working tree is on the bean's branch.
   *
   * @param bean The bean to create a branch for
   * @param fetchBean Callback to fetch beans by ID (for parent chain)
   * @throws Error if working tree is dirty
   */
  async ensureBeanBranch(bean: Bean, fetchBean: BeanFetcher): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    // Check for dirty working tree
    if (isWorkingTreeDirty(this.cwd)) {
      throw new Error(
        `Cannot create branch for ${bean.id}: working tree is dirty. ` +
          'Commit or stash changes first.'
      );
    }

    // Build the ancestor chain (top-down order)
    const ancestors = await this.buildAncestorChain(bean, fetchBean);

    // Ensure each ancestor's branch exists (top-down)
    for (const ancestor of ancestors) {
      const branchName = this.getBranchName(ancestor.id);
      if (!branchExists(branchName, this.cwd)) {
        const baseBranch = ancestor.parentId
          ? this.getBranchName(ancestor.parentId)
          : this.config.default_branch;
        createBranch(branchName, baseBranch, this.cwd);
      }
    }

    // Ensure the bean's own branch exists
    const beanBranch = this.getBranchName(bean.id);
    if (!branchExists(beanBranch, this.cwd)) {
      const baseBranch = bean.parentId
        ? this.getBranchName(bean.parentId)
        : this.config.default_branch;
      createBranch(beanBranch, baseBranch, this.cwd);
    }

    // Checkout the bean's branch
    checkoutBranch(beanBranch, this.cwd);
  }

  /**
   * Build the ancestor chain for a bean (top-down order).
   * Walks up the parent chain and returns ancestors from root to immediate parent.
   */
  private async buildAncestorChain(
    bean: Bean,
    fetchBean: BeanFetcher
  ): Promise<Bean[]> {
    const ancestors: Bean[] = [];
    let currentParentId = bean.parentId;

    while (currentParentId) {
      const parent = await fetchBean(currentParentId);
      if (!parent) break;
      ancestors.unshift(parent); // Prepend to get top-down order
      currentParentId = parent.parentId;
    }

    return ancestors;
  }

  // ===========================================================================
  // Merge Strategy
  // ===========================================================================

  /**
   * Get the merge strategy for a bean type.
   */
  getMergeStrategy(beanType: BeanType): MergeStrategy {
    return this.config.merge_strategy[beanType];
  }

  /**
   * Get the merge target branch for a bean.
   * Returns parent's branch or default branch if no parent.
   */
  getMergeTarget(bean: Bean): string {
    if (bean.parentId) {
      return this.getBranchName(bean.parentId);
    }
    return this.config.default_branch;
  }

  // ===========================================================================
  // Type-Aware Merge
  // ===========================================================================

  /**
   * Merge a bean's branch into its target using the type-aware strategy.
   *
   * @param bean The bean whose branch to merge
   * @param commitMessage Commit message for squash merges or merge commit
   * @returns MergeResult with success/failure info
   */
  async mergeBeanBranch(
    bean: Bean,
    commitMessage: string
  ): Promise<MergeResult> {
    if (!this.config.enabled) {
      return { success: true };
    }

    const beanBranch = this.getBranchName(bean.id);
    const targetBranch = this.getMergeTarget(bean);
    const strategy = this.getMergeStrategy(bean.type);

    try {
      // Checkout the target branch
      checkoutBranch(targetBranch, this.cwd);

      if (strategy === 'squash') {
        return this.doSquashMerge(beanBranch, commitMessage, bean);
      } else {
        return this.doMergeCommit(beanBranch, commitMessage, bean);
      }
    } catch (error) {
      // Check if this is a merge conflict (--no-ff creates MERGE_HEAD)
      if (hasMergeHead(this.cwd)) {
        abortMerge(this.cwd);
        this.emit('branch:merge-failed', {
          beanId: bean.id,
          targetBranch,
          reason: 'conflict',
        });
        return {
          success: false,
          conflict: true,
          error: `Merge conflict merging ${beanBranch} into ${targetBranch}`,
        };
      }

      // Check for unmerged files (squash conflicts don't create MERGE_HEAD)
      if (this.hasUnmergedFiles()) {
        try {
          git(['reset', '--hard', 'HEAD'], this.cwd);
        } catch {
          // Best effort
        }
        return {
          success: false,
          conflict: true,
          error: `Merge conflict merging ${beanBranch} into ${targetBranch}`,
        };
      }

      return {
        success: false,
        error:
          error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Perform a squash merge (for task/bug beans).
   */
  private doSquashMerge(
    beanBranch: string,
    commitMessage: string,
    bean: Bean
  ): MergeResult {
    try {
      mergeSquash(beanBranch, this.cwd);
    } catch (error) {
      // Squash merge conflicts don't create MERGE_HEAD, they just leave
      // conflicted files in the working tree. Check for unmerged files.
      if (this.hasUnmergedFiles()) {
        // Reset the working tree to clean state
        try {
          git(['reset', '--hard', 'HEAD'], this.cwd);
        } catch {
          // Best effort cleanup
        }
        this.emit('branch:merge-failed', {
          beanId: bean.id,
          targetBranch: this.getMergeTarget(bean),
          reason: 'conflict',
        });
        return {
          success: false,
          conflict: true,
          error: `Merge conflict during squash of ${beanBranch}`,
        };
      }
      throw error;
    }

    // Squash merge stages changes but doesn't commit
    if (hasStagedChanges(this.cwd)) {
      const sha = commitChanges(commitMessage, this.cwd);
      this.maybeDeleteBranch(beanBranch);
      return { success: true, commitSha: sha };
    }

    // No changes to merge (branches were identical)
    this.maybeDeleteBranch(beanBranch);
    return { success: true };
  }

  /**
   * Check if there are unmerged files (merge conflict markers).
   */
  private hasUnmergedFiles(): boolean {
    try {
      const output = git(['diff', '--name-only', '--diff-filter=U'], this.cwd);
      return output.length > 0;
    } catch {
      // Also check via ls-files
      try {
        const output = git(['ls-files', '--unmerged'], this.cwd);
        return output.length > 0;
      } catch {
        return false;
      }
    }
  }

  /**
   * Perform a --no-ff merge (for feature/epic/milestone beans).
   */
  private doMergeCommit(
    beanBranch: string,
    commitMessage: string,
    bean: Bean
  ): MergeResult {
    try {
      mergeNoFf(beanBranch, commitMessage, this.cwd);
    } catch (error) {
      // Check for conflict
      if (hasMergeHead(this.cwd)) {
        abortMerge(this.cwd);
        return {
          success: false,
          conflict: true,
          error: `Merge conflict during merge of ${beanBranch}`,
        };
      }
      throw error;
    }

    const sha = git(['rev-parse', 'HEAD'], this.cwd);
    this.maybeDeleteBranch(beanBranch);
    return { success: true, commitSha: sha };
  }

  /**
   * Delete the bean branch if configured to do so.
   */
  private maybeDeleteBranch(branch: string): void {
    if (this.config.delete_after_merge) {
      try {
        deleteBranch(branch, this.cwd);
      } catch {
        // Non-fatal: branch cleanup failure
        this.emit('warning', `Failed to delete branch ${branch}`);
      }
    }
  }

  // ===========================================================================
  // Git State Recovery
  // ===========================================================================

  /**
   * Recover from interrupted git operations on daemon startup.
   * Detects MERGE_HEAD or REBASE_HEAD and aborts.
   * @returns true if recovery was performed
   */
  recoverGitState(): boolean {
    let recovered = false;

    if (hasMergeHead(this.cwd)) {
      try {
        abortMerge(this.cwd);
        recovered = true;
        this.emit('recovery', 'Aborted interrupted merge');
      } catch {
        // Best effort
      }
    }

    if (hasRebaseHead(this.cwd)) {
      try {
        git(['rebase', '--abort'], this.cwd);
        recovered = true;
        this.emit('recovery', 'Aborted interrupted rebase');
      } catch {
        // Best effort
      }
    }

    return recovered;
  }
}

export default BranchManager;
