/**
 * Completion Handler
 *
 * Handles post-execution tasks after an agent completes work on a bean:
 * - Detecting completion type (success, blocked, failed/crashed)
 * - Committing staged changes (sequential mode or worktree merge)
 * - Updating bean status
 * - Creating blocker beans when needed
 * - Emitting events for UI updates
 */
import { EventEmitter } from 'events';
import { execSync } from 'child_process';
import { readFile } from 'fs/promises';
import type { TalosConfig, CommitStyleConfig } from '../config/index.js';
import {
  beanTypeToCommitType,
  extractScope,
  formatCommitMessage,
} from '../config/index.js';
import {
  type Bean,
  getBean,
  updateBeanStatus,
  updateBeanTags,
  createBean,
  listBeans,
} from './beans-client.js';

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
  error: (error: Error) => void;
}

// =============================================================================
// Git Helpers
// =============================================================================

/**
 * Execute a git command and return stdout
 * @param args Git command arguments
 * @param cwd Working directory (optional)
 * @returns stdout trimmed
 * @throws Error if git command fails
 */
function git(args: string[], cwd?: string): string {
  const command = `git ${args.join(' ')}`;
  try {
    const result = execSync(command, {
      cwd: cwd ?? process.cwd(),
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return result.trim();
  } catch (error: unknown) {
    const err = error as { message?: string; stderr?: Buffer | string };
    const stderr = err.stderr?.toString() ?? '';
    throw new Error(`Git command failed: ${command}\n${stderr}`);
  }
}

/**
 * Check if there are staged changes
 */
function hasStagedChanges(cwd?: string): boolean {
  try {
    const diff = git(['diff', '--cached', '--name-only'], cwd);
    return diff.length > 0;
  } catch {
    return false;
  }
}

/**
 * Get the current branch name
 */
function getCurrentBranch(cwd?: string): string {
  return git(['rev-parse', '--abbrev-ref', 'HEAD'], cwd);
}

/**
 * Check if we're in a worktree (not the main working directory)
 */
function isWorktree(cwd?: string): boolean {
  try {
    const gitDir = git(['rev-parse', '--git-dir'], cwd);
    // Worktrees have .git files pointing to main .git directory
    return gitDir.includes('.git/worktrees/');
  } catch {
    return false;
  }
}

/**
 * Commit staged changes with the given message
 * @returns The commit SHA
 */
function commitChanges(message: string, cwd?: string): string {
  // Write commit message to temp file to avoid shell escaping issues
  const escapedMessage = message.replace(/'/g, "'\\''");
  git(['commit', '-m', `'${escapedMessage}'`], cwd);
  return git(['rev-parse', 'HEAD'], cwd);
}

/**
 * Push to remote (if configured)
 */
function pushToRemote(cwd?: string): void {
  const branch = getCurrentBranch(cwd);
  git(['push', 'origin', branch], cwd);
}

/**
 * Merge a branch into the current branch
 * @param branch Branch to merge
 * @param cwd Working directory
 * @returns true if merge succeeded
 */
function mergeBranch(branch: string, cwd?: string): boolean {
  try {
    git(['merge', '--ff-only', branch], cwd);
    return true;
  } catch {
    // Non-fast-forward, try regular merge
    try {
      git(['merge', '--no-edit', branch], cwd);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Delete a branch
 */
function deleteBranch(branch: string, cwd?: string): void {
  try {
    git(['branch', '-d', branch], cwd);
  } catch {
    // Force delete if needed
    git(['branch', '-D', branch], cwd);
  }
}

/**
 * Remove a worktree
 */
function removeWorktree(worktreePath: string, cwd?: string): void {
  git(['worktree', 'remove', worktreePath, '--force'], cwd);
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

  constructor(config: TalosConfig, options: CompletionHandlerOptions = {}) {
    super();
    this.config = config;
    this.options = options;
  }

  /**
   * Handle completion based on exit code and bean state
   */
  async handleCompletion(
    bean: Bean,
    exitCode: number,
    outputPath: string,
    worktreePath?: string
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
      return this.handleFailure(currentBean, exitCode, outputPath, worktreePath);
    }

    // Check if agent added 'blocked' tag
    if (currentBean.tags.includes('blocked')) {
      return this.handleBlocked(currentBean, worktreePath);
    }

    // Success!
    return this.handleSuccess(currentBean, worktreePath);
  }

  // ===========================================================================
  // Success Handling
  // ===========================================================================

  /**
   * Handle successful completion (exit code 0, no blocked tag)
   */
  private async handleSuccess(
    bean: Bean,
    worktreePath?: string
  ): Promise<CompletionResult> {
    const result: CompletionResult = { outcome: 'completed' };
    const isParallel = worktreePath !== undefined;
    const cwd = worktreePath;

    try {
      // Update bean status to completed
      await updateBeanStatus(bean.id, 'completed');

      // Handle git commit if configured and there are staged changes
      if (this.config.on_complete.auto_commit && !this.options.dryRun) {
        if (hasStagedChanges(cwd)) {
          // Build commit message
          const scope = await extractScope(bean, getBean);
          const message = formatCommitMessage(
            bean,
            scope,
            this.config.on_complete.commit_style
          );

          if (isParallel) {
            // Parallel mode: commit in worktree, merge to main
            result.commitSha = await this.commitAndMerge(message, worktreePath!);
          } else {
            // Sequential mode: commit directly
            result.commitSha = commitChanges(message, cwd);
          }

          // Push if configured
          if (this.config.on_complete.push) {
            pushToRemote();
          }
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

  /**
   * Commit in worktree and merge to main branch
   */
  private async commitAndMerge(
    message: string,
    worktreePath: string
  ): Promise<string> {
    // Get the worktree branch name
    const worktreeBranch = getCurrentBranch(worktreePath);
    
    // Commit in worktree
    const commitSha = commitChanges(message, worktreePath);
    
    // Switch to main working directory and merge
    const mainBranch = getCurrentBranch();
    
    // Merge worktree branch to main
    const merged = mergeBranch(worktreeBranch);
    if (!merged) {
      throw new Error(
        `Failed to merge ${worktreeBranch} into ${mainBranch}. Manual resolution required.`
      );
    }

    // Clean up worktree and branch
    try {
      removeWorktree(worktreePath);
      deleteBranch(worktreeBranch);
    } catch {
      // Non-fatal, log warning
      this.emit('error', new Error(`Warning: Failed to clean up worktree ${worktreePath}`));
    }

    return commitSha;
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
