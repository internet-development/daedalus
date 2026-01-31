/**
 * Completion Handler
 *
 * Handles post-execution tasks after an agent completes work on a bean:
 * - Detecting completion type (success, blocked, failed/crashed)
 * - Type-aware merge strategies (squash for tasks/bugs, merge for features/epics)
 * - Hierarchical branch merging (into parent's branch, not main)
 * - Committing staged changes (sequential mode or worktree merge)
 * - Updating bean status
 * - Creating blocker beans when needed
 * - Emitting events for UI updates
 */
import { EventEmitter } from 'events';
import { readFile } from 'fs/promises';
import type { TalosConfig, MergeStrategy } from '../config/index.js';
import {
  extractScope,
  formatCommitMessage,
  getMergeStrategy,
} from '../config/index.js';
import { formatSquashCommitMessage } from '../utils/changelog.js';
import {
  type Bean,
  getBean,
  updateBeanStatus,
  updateBeanTags,
  createBean,
  listBeans,
} from './beans-client.js';
import type { BeanExecutionContext } from './scheduler.js';
import {
  git,
  hasStagedChanges,
  getCurrentBranch,
  commitChanges,
  mergeNoFf,
  mergeSquash,
  abortMerge,
  deleteBranch,
  removeWorktree,
  checkoutBranch,
} from './git.js';

// =============================================================================
// Types
// =============================================================================

export interface CompletionResult {
  /** What happened (not bean status!) */
  outcome: 'completed' | 'blocked' | 'failed';
  /** If changes were committed */
  commitSha?: string;
  /** If blocker bean was created */
  blockerBeanId?: string;
  /** If failed, the error message */
  error?: string;
}

export interface CompletionHandlerOptions {
  /** Skip actual git operations (for testing) */
  dryRun?: boolean;
}

export interface CompletionHandlerEvents {
  'bean-completed': (data: { beanId: string; commitSha?: string }) => void;
  'bean-blocked': (data: { beanId: string; blockerBeanId?: string }) => void;
  'bean-failed': (data: { beanId: string; exitCode: number; error: string }) => void;
  'branch:merge-failed': (data: { beanId: string; branchName: string; baseBranch: string }) => void;
  error: (error: Error) => void;
}

// =============================================================================
// Git Helpers (delegated to centralized git module)
// =============================================================================

/**
 * Push to remote (if configured)
 */
function pushToRemote(cwd?: string): void {
  const branch = getCurrentBranch(cwd);
  git(['push', 'origin', branch], cwd);
}

// =============================================================================
// Output Parsing
// =============================================================================

/**
 * Extract last N lines from output file for error reporting
 */
async function getLastOutputLines(
  outputPath: string,
  lines: number = 50
): Promise<string> {
  try {
    const content = await readFile(outputPath, 'utf-8');
    const allLines = content.split('\n');
    const lastLines = allLines.slice(-lines);
    return lastLines.join('\n');
  } catch {
    return '(Unable to read output file)';
  }
}

// =============================================================================
// Completion Handler Class
// =============================================================================

export class CompletionHandler extends EventEmitter {
  private config: TalosConfig;
  private options: CompletionHandlerOptions;
  private errorsEpicId: string | null = null;

  constructor(config: TalosConfig, options: CompletionHandlerOptions = {}) {
    super();
    this.config = config;
    this.options = options;
  }

  /**
   * Set the Errors epic ID for parenting crash/blocker beans
   */
  setErrorsEpicId(epicId: string | null): void {
    this.errorsEpicId = epicId;
  }

  /**
   * Handle completion based on exit code and bean state.
   * @param bean The bean that was being worked on
   * @param exitCode Agent exit code (0 = success)
   * @param outputPath Path to agent output file
   * @param context Execution context from scheduler (branch info, worktree path)
   */
  async handleCompletion(
    bean: Bean,
    exitCode: number,
    outputPath: string,
    context: BeanExecutionContext = {}
  ): Promise<CompletionResult> {
    // Re-fetch bean to check for tags added by agent
    const currentBean = await getBean(bean.id);
    if (!currentBean) {
      const error = `Bean not found: ${bean.id}`;
      this.emit('error', new Error(error));
      return { outcome: 'failed', error };
    }

    // Determine completion type
    if (exitCode !== 0) {
      // Agent crashed or errored
      return this.handleFailure(currentBean, exitCode, outputPath, context.worktreePath);
    }

    // Check if agent added 'blocked' tag
    if (currentBean.tags.includes('blocked')) {
      return this.handleBlocked(currentBean, context.worktreePath);
    }

    // Success!
    return this.handleSuccess(currentBean, context);
  }

  // ===========================================================================
  // Success Handling
  // ===========================================================================

  /**
   * Handle successful completion (exit code 0, no blocked tag)
   */
  private async handleSuccess(
    bean: Bean,
    context: BeanExecutionContext
  ): Promise<CompletionResult> {
    const result: CompletionResult = { outcome: 'completed' };

    try {
      // Update bean status to completed
      await updateBeanStatus(bean.id, 'completed');

      // Handle git operations if configured
      if (this.config.on_complete.auto_commit && !this.options.dryRun) {
        if (context.branchName && context.baseBranch) {
          // Branch mode: merge into parent branch using type-aware strategy
          result.commitSha = await this.mergeBeanBranch(bean, context);
        } else if (hasStagedChanges(context.worktreePath)) {
          // Legacy mode (no branching): commit directly
          const scope = await extractScope(bean, getBean);
          const message = formatCommitMessage(
            bean,
            scope,
            this.config.on_complete.commit_style
          );
          result.commitSha = commitChanges(message, context.worktreePath);
        }

        // Push if configured
        if (this.config.on_complete.push) {
          pushToRemote(context.worktreePath);
        }
      }

      this.emit('bean-completed', {
        beanId: bean.id,
        commitSha: result.commitSha,
      });

      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      result.error = err.message;
      this.emit('error', err);
      return result;
    }
  }

  // ===========================================================================
  // Type-Aware Merge
  // ===========================================================================

  /**
   * Merge a branch using the specified strategy.
   *
   * - `squash`: `git merge --squash` + `git commit -m <message>` (single clean commit)
   * - `merge`: `git merge --no-ff -m <message>` (preserves commit history)
   *
   * @returns The resulting commit SHA
   */
  private mergeByStrategy(
    branchName: string,
    strategy: MergeStrategy,
    commitMessage: string,
    cwd?: string
  ): string {
    switch (strategy) {
      case 'squash':
        // Squash merge stages changes but does NOT commit
        mergeSquash(branchName, cwd);
        // Commit with our formatted message (includes changelog)
        commitChanges(commitMessage, cwd);
        return git(['rev-parse', 'HEAD'], cwd);

      case 'merge':
        // Merge commit preserves full history
        mergeNoFf(branchName, commitMessage, cwd);
        return git(['rev-parse', 'HEAD'], cwd);
    }
  }

  /**
   * Unified merge method for both sequential and parallel modes.
   *
   * Steps:
   * 1. Commit any remaining staged changes on the bean branch
   * 2. Checkout the merge target (baseBranch from context)
   * 3. Merge using type-aware strategy (squash or merge)
   * 4. Handle merge conflicts (abort + emit event + mark blocked)
   * 5. Clean up branch and worktree
   *
   * @returns The resulting commit SHA on the target branch
   */
  private async mergeBeanBranch(
    bean: Bean,
    context: BeanExecutionContext
  ): Promise<string> {
    const { branchName, baseBranch, worktreePath } = context;
    if (!branchName || !baseBranch) {
      throw new Error('Branch context missing for merge');
    }

    const strategy = getMergeStrategy(bean.type, this.config.branch);
    const cwd = worktreePath;

    // Commit any remaining staged changes on the bean branch
    if (hasStagedChanges(cwd)) {
      const scope = await extractScope(bean, getBean);
      const message = formatCommitMessage(
        bean,
        scope,
        this.config.on_complete.commit_style
      );
      commitChanges(message, cwd);
    }

    // Checkout the merge target (parent's branch or default_branch)
    checkoutBranch(baseBranch, cwd);

    // Build commit message based on strategy
    const scope = await extractScope(bean, getBean);
    const commitMessage =
      strategy === 'squash'
        ? formatSquashCommitMessage(
            bean,
            scope,
            this.config.on_complete.commit_style
          )
        : formatCommitMessage(
            bean,
            scope,
            this.config.on_complete.commit_style
          );

    // Merge with conflict handling
    try {
      const sha = this.mergeByStrategy(branchName, strategy, commitMessage, cwd);

      // Clean up branch
      if (this.config.branch.delete_after_merge) {
        try {
          deleteBranch(branchName, cwd);
        } catch {
          // Non-fatal: branch may already be deleted or is checked out elsewhere
        }
      }

      // Clean up worktree (parallel mode)
      if (worktreePath) {
        try {
          removeWorktree(worktreePath);
        } catch {
          // Non-fatal: worktree cleanup failure
        }
      }

      return sha;
    } catch (error) {
      // Merge failed (likely conflict) — abort and mark blocked
      try {
        abortMerge(cwd);
      } catch {
        /* already clean */
      }

      // Mark bean as blocked instead of completed
      await updateBeanStatus(bean.id, 'in-progress');
      await updateBeanTags(bean.id, ['blocked']);

      this.emit('branch:merge-failed', {
        beanId: bean.id,
        branchName,
        baseBranch,
      });

      throw new Error(
        `Merge conflict: ${branchName} into ${baseBranch}. Bean marked as blocked.`
      );
    }
  }

  // ===========================================================================
  // Blocked Handling
  // ===========================================================================

  /**
   * Handle blocked state (agent added 'blocked' tag)
   */
  private async handleBlocked(
    bean: Bean,
    worktreePath?: string
  ): Promise<CompletionResult> {
    const result: CompletionResult = { outcome: 'blocked' };

    try {
      // Check if agent created a blocker bean
      const existingBlockers = await listBeans({
        isBlocked: false,
        excludeStatus: ['completed', 'scrapped'],
      });

      // Find beans that are blocking this bean
      const blockingThisBean = existingBlockers.filter(
        (b) => b.blockingIds.includes(bean.id)
      );

      // If no blocker bean exists and config says to create one
      if (blockingThisBean.length === 0 && this.config.on_blocked.create_blocker_bean) {
        const blockerBean = await createBean({
          title: `Blocker: ${bean.title}`,
          type: 'bug',
          status: 'todo',
          blocking: [bean.id],
          parent: this.errorsEpicId ?? undefined,
          body: `Agent reported being blocked while working on ${bean.id}.\n\nCheck agent output for details about what caused the block.`,
        });
        result.blockerBeanId = blockerBean.id;
      } else if (blockingThisBean.length > 0) {
        // Use the first existing blocker
        result.blockerBeanId = blockingThisBean[0].id;
      }

      // Keep worktree for inspection (don't delete)
      // Note: Bean status stays 'in-progress', only the tag indicates blocked state

      this.emit('bean-blocked', {
        beanId: bean.id,
        blockerBeanId: result.blockerBeanId,
      });

      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      result.error = err.message;
      this.emit('error', err);
      return result;
    }
  }

  // ===========================================================================
  // Failure Handling
  // ===========================================================================

  /**
   * Handle failure (non-zero exit code)
   */
  private async handleFailure(
    bean: Bean,
    exitCode: number,
    outputPath: string,
    worktreePath?: string
  ): Promise<CompletionResult> {
    const result: CompletionResult = {
      outcome: 'failed',
      error: `Agent exited with code ${exitCode}`,
    };

    try {
      // Add 'failed' tag to the bean
      await updateBeanTags(bean.id, ['failed']);

      // Get last output for error details
      const lastOutput = await getLastOutputLines(outputPath);

      // Create error bean with crash details
      const errorBean = await createBean({
        title: `Crash: ${bean.title}`,
        type: 'bug',
        status: 'todo',
        priority: 'high',
        blocking: [bean.id],
        parent: this.errorsEpicId ?? undefined,
        body: `Agent crashed while working on ${bean.id}.

## Exit Code
${exitCode}

## Last Output
\`\`\`
${lastOutput}
\`\`\`

## Context
- Bean: ${bean.id}
- Title: ${bean.title}
- Type: ${bean.type}`,
      });

      result.blockerBeanId = errorBean.id;

      // Keep worktree for debugging (don't delete)
      // Note: Bean status stays 'in-progress', only the tag indicates failed state

      this.emit('bean-failed', {
        beanId: bean.id,
        exitCode,
        error: result.error!,
      });

      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      result.error = `${result.error}; Additionally failed to handle: ${err.message}`;
      this.emit('error', err);
      return result;
    }
  }

  // ===========================================================================
  // Dry Run Support
  // ===========================================================================

  /**
   * Check if running in dry-run mode
   */
  isDryRun(): boolean {
    return this.options.dryRun ?? false;
  }

  /**
   * Update dry-run setting
   */
  setDryRun(dryRun: boolean): void {
    this.options.dryRun = dryRun;
  }
}

export default CompletionHandler;
