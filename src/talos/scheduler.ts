/**
 * Scheduler
 *
 * Priority-based scheduler that manages the execution queue, respecting
 * bean dependencies (blockedBy relationships) and configurable concurrency.
 *
 * Features:
 * - Priority queue sorted by priority level → created date
 * - Dependency checking via blockedBy relationships
 * - Stuck bean detection (blocked/failed tags)
 * - Configurable max parallelism
 * - Git worktree management for parallel mode
 */
import { EventEmitter } from 'events';
import { existsSync } from 'fs';
import { join } from 'path';
import type { Bean } from './beans-client.js';
import { getBlockedBy, isStuck } from './beans-client.js';
import { getLogger } from './logger.js';
import {
  createWorktree as gitCreateWorktree,
  branchExists,
} from './git.js';

// Create child logger for scheduler component
const log = getLogger().child({ component: 'scheduler' });

// =============================================================================
// Types
// =============================================================================

export interface SchedulerConfig {
  maxParallel: number; // default: 1
  pollInterval: number; // ms, default: 1000
  worktreeBase?: string; // default: '.worktrees'
}

export interface SchedulerEvents {
  'bean-ready': (bean: Bean, worktreePath?: string) => void;
  'queue:updated': (queueLength: number) => void;
  'bean:in-progress': (beanId: string, worktreePath?: string) => void;
  'bean:completed': (beanId: string) => void;
  'bean:stuck': (beanId: string, reason: 'blocked' | 'failed') => void;
  error: (error: Error, context?: string) => void;
}

/** Priority level numeric values (lower = higher priority) */
const PRIORITY_VALUES: Record<string, number> = {
  critical: 0,
  high: 1,
  normal: 2,
  low: 3,
  deferred: 4,
};

// =============================================================================
// Scheduler Class
// =============================================================================

export class Scheduler extends EventEmitter {
  private queue: Bean[] = [];
  private inProgress: Map<string, { bean: Bean; worktreePath?: string }> =
    new Map();
  private stuckBeans: Set<string> = new Set();
  private config: SchedulerConfig;
  private pollTimer: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;

  constructor(config: Partial<SchedulerConfig> = {}) {
    super();
    this.config = {
      maxParallel: config.maxParallel ?? 1,
      pollInterval: config.pollInterval ?? 1000,
      worktreeBase: config.worktreeBase ?? '.worktrees',
    };
  }

  // ===========================================================================
  // Lifecycle
  // ===========================================================================

  /**
   * Start the scheduler poll loop.
   * This will check for eligible beans at regular intervals.
   */
  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    log.info({ 
      maxParallel: this.config.maxParallel,
      pollInterval: this.config.pollInterval 
    }, 'Scheduler started');
    this.scheduleNextPoll();
  }

  /**
   * Stop the scheduler poll loop.
   */
  stop(): void {
    this.isRunning = false;
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
    log.info('Scheduler stopped');
  }

  // ===========================================================================
  // Queue Management
  // ===========================================================================

  /**
   * Add a bean to the queue.
   * Skips if bean is already queued or in progress.
   */
  enqueue(bean: Bean): void {
    // Skip if already in queue
    if (this.queue.some((b) => b.id === bean.id)) {
      log.debug({ beanId: bean.id }, 'Bean already in queue, skipping');
      return;
    }

    // Skip if already in progress
    if (this.inProgress.has(bean.id)) {
      log.debug({ beanId: bean.id }, 'Bean already in progress, skipping');
      return;
    }

    // Skip if marked as stuck
    if (this.stuckBeans.has(bean.id)) {
      log.debug({ beanId: bean.id }, 'Bean is stuck, skipping');
      return;
    }

    this.queue.push(bean);
    this.sortQueue();
    log.info({ 
      beanId: bean.id, 
      priority: bean.priority,
      queueLength: this.queue.length 
    }, 'Bean enqueued');
    this.emit('queue:updated', this.queue.length);
  }

  /**
   * Remove a bean from the queue by ID.
   */
  dequeue(beanId: string): void {
    const index = this.queue.findIndex((b) => b.id === beanId);
    if (index !== -1) {
      this.queue.splice(index, 1);
      log.debug({ beanId, queueLength: this.queue.length }, 'Bean dequeued');
      this.emit('queue:updated', this.queue.length);
    }
  }

  /**
   * Get the current queue (copy).
   */
  getQueue(): Bean[] {
    return [...this.queue];
  }

  /**
   * Update a bean in the queue (re-sort after priority/status change).
   */
  updateBean(bean: Bean): void {
    const index = this.queue.findIndex((b) => b.id === bean.id);
    if (index !== -1) {
      this.queue[index] = bean;
      this.sortQueue();
    }
  }

  // ===========================================================================
  // Execution Control
  // ===========================================================================

  /**
   * Get the next eligible bean that can be executed.
   * Returns null if no bean is eligible or capacity is full.
   *
   * A bean is eligible if:
   * - Not blocked by incomplete beans (blockedBy check)
   * - Does not have 'blocked' or 'failed' tags
   * - Concurrency limit not reached
   */
  async getNextEligible(): Promise<Bean | null> {
    // Check capacity
    if (this.inProgress.size >= this.config.maxParallel) {
      log.debug({ 
        inProgress: this.inProgress.size, 
        maxParallel: this.config.maxParallel 
      }, 'At capacity, no eligible beans');
      return null;
    }

    // Find first eligible bean
    for (let i = 0; i < this.queue.length; i++) {
      const bean = this.queue[i];

      // Skip stuck beans
      if (isStuck(bean)) {
        const reason = bean.tags.includes('blocked') ? 'blocked' : 'failed';
        log.debug({ beanId: bean.id, reason }, 'Bean is stuck, marking');
        this.markStuck(bean.id, reason);
        continue;
      }

      // Check blocking dependencies
      const blockers = await this.getActiveBlockers(bean.id);
      if (blockers.length > 0) {
        log.debug({ 
          beanId: bean.id, 
          blockedBy: blockers.map(b => b.id) 
        }, 'Bean blocked by dependencies');
        continue;
      }

      // Found an eligible bean - remove from queue
      this.queue.splice(i, 1);
      log.info({ 
        beanId: bean.id, 
        priority: bean.priority 
      }, 'Bean ready for execution');
      this.emit('queue:updated', this.queue.length);
      return bean;
    }

    return null;
  }

  /**
   * Mark a bean as in-progress.
   * If in parallel mode (maxParallel > 1), creates a git worktree.
   */
  async markInProgress(beanId: string): Promise<string | undefined> {
    const bean = this.queue.find((b) => b.id === beanId);
    if (!bean) {
      log.debug({ beanId }, 'Bean not found in queue for markInProgress');
      return undefined;
    }

    // Remove from queue
    this.dequeue(beanId);

    let worktreePath: string | undefined;

    // Create worktree if in parallel mode
    if (this.config.maxParallel > 1) {
      try {
        log.debug({ beanId }, 'Creating worktree for parallel execution');
        worktreePath = await this.createWorktree(beanId);
        log.info({ beanId, worktreePath }, 'Worktree created');
      } catch (error) {
        log.error({ 
          err: error instanceof Error ? error : new Error(String(error)),
          beanId,
          context: 'worktree creation'
        }, 'Failed to create worktree');
        this.emit(
          'error',
          error instanceof Error ? error : new Error(String(error)),
          `worktree creation for ${beanId}`
        );
        // Re-add to queue on failure
        this.enqueue(bean);
        return undefined;
      }
    }

    this.inProgress.set(beanId, { bean, worktreePath });
    log.info({ 
      beanId, 
      worktreePath,
      inProgressCount: this.inProgress.size 
    }, 'Bean marked in-progress');
    this.emit('bean:in-progress', beanId, worktreePath);
    return worktreePath;
  }

  /**
   * Mark a bean as in-progress with a provided bean object.
   * Used when the bean was already removed from queue by getNextEligible().
   */
  async markBeanInProgress(bean: Bean): Promise<string | undefined> {
    let worktreePath: string | undefined;

    // Create worktree if in parallel mode
    if (this.config.maxParallel > 1) {
      try {
        log.debug({ beanId: bean.id }, 'Creating worktree for parallel execution');
        worktreePath = await this.createWorktree(bean.id);
        log.info({ beanId: bean.id, worktreePath }, 'Worktree created');
      } catch (error) {
        log.error({ 
          err: error instanceof Error ? error : new Error(String(error)),
          beanId: bean.id,
          context: 'worktree creation'
        }, 'Failed to create worktree');
        this.emit(
          'error',
          error instanceof Error ? error : new Error(String(error)),
          `worktree creation for ${bean.id}`
        );
        // Re-add to queue on failure
        this.enqueue(bean);
        return undefined;
      }
    }

    this.inProgress.set(bean.id, { bean, worktreePath });
    log.info({ 
      beanId: bean.id, 
      worktreePath,
      inProgressCount: this.inProgress.size 
    }, 'Bean marked in-progress');
    this.emit('bean:in-progress', bean.id, worktreePath);
    return worktreePath;
  }

  /**
   * Mark a bean as completed (frees up concurrency slot).
   * Note: Worktree cleanup is handled by CompletionHandler.
   */
  markComplete(beanId: string): void {
    this.inProgress.delete(beanId);
    this.stuckBeans.delete(beanId); // Allow retry if it was stuck before
    log.info({ beanId, inProgressCount: this.inProgress.size }, 'Bean completed');
    this.emit('bean:completed', beanId);
  }

  /**
   * Mark a bean as stuck (blocked or failed tag).
   * The bean will be skipped in future scheduling until un-stuck.
   */
  markStuck(beanId: string, reason: 'blocked' | 'failed' = 'blocked'): void {
    // Remove from queue if present
    this.dequeue(beanId);

    // Remove from in-progress if present
    this.inProgress.delete(beanId);

    // Add to stuck set
    this.stuckBeans.add(beanId);

    log.warn({ beanId, reason }, 'Bean marked as stuck');
    this.emit('bean:stuck', beanId, reason);
  }

  /**
   * Clear stuck status for a bean (allow retry).
   */
  clearStuck(beanId: string): void {
    this.stuckBeans.delete(beanId);
    log.info({ beanId }, 'Bean unstuck, eligible for retry');
  }

  // ===========================================================================
  // Worktree Management (parallel mode only)
  // ===========================================================================

  /**
   * Get the worktree path for a bean if it exists.
   * Returns null if in sequential mode or worktree doesn't exist.
   */
  getWorktreePath(beanId: string): string | null {
    // Sequential mode - no worktrees
    if (this.config.maxParallel <= 1) {
      return null;
    }

    const entry = this.inProgress.get(beanId);
    if (entry?.worktreePath) {
      return entry.worktreePath;
    }

    // Check if worktree exists on disk (might be from previous run)
    const expectedPath = join(this.config.worktreeBase!, beanId);
    if (existsSync(expectedPath)) {
      return expectedPath;
    }

    return null;
  }

  // ===========================================================================
  // Configuration
  // ===========================================================================

  /**
   * Update the max parallel configuration.
   */
  setMaxParallel(n: number): void {
    if (n < 1) {
      throw new Error('maxParallel must be at least 1');
    }
    this.config.maxParallel = n;
  }

  /**
   * Get current state for debugging/monitoring.
   */
  getState(): {
    queued: number;
    inProgress: number;
    stuck: number;
    maxParallel: number;
  } {
    return {
      queued: this.queue.length,
      inProgress: this.inProgress.size,
      stuck: this.stuckBeans.size,
      maxParallel: this.config.maxParallel,
    };
  }

  /**
   * Get in-progress beans (for status display).
   */
  getInProgress(): Map<string, { bean: Bean; worktreePath?: string }> {
    return new Map(this.inProgress);
  }

  /**
   * Clear all state (queue, in-progress, stuck).
   */
  clear(): void {
    this.queue = [];
    this.inProgress.clear();
    this.stuckBeans.clear();
    this.emit('queue:updated', 0);
  }

  // ===========================================================================
  // Private: Priority Queue
  // ===========================================================================

  /**
   * Sort the queue by priority (lower value = higher priority), then by createdAt.
   */
  private sortQueue(): void {
    this.queue.sort((a, b) => {
      // Compare by priority first
      const priorityA = PRIORITY_VALUES[a.priority] ?? PRIORITY_VALUES.normal;
      const priorityB = PRIORITY_VALUES[b.priority] ?? PRIORITY_VALUES.normal;

      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }

      // Same priority - compare by creation date (older first)
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return dateA - dateB;
    });
  }

  // ===========================================================================
  // Private: Dependency Resolution
  // ===========================================================================

  /**
   * Get active blockers for a bean (beans that are blocking and not completed).
   */
  private async getActiveBlockers(beanId: string): Promise<Bean[]> {
    try {
      const blockers = await getBlockedBy(beanId);
      if (blockers.length > 0) {
        log.debug({ 
          beanId, 
          blockedBy: blockers.map(b => b.id) 
        }, 'Found active blockers');
      }
      return blockers;
    } catch (error) {
      log.error({ 
        err: error instanceof Error ? error : new Error(String(error)),
        beanId,
        context: 'dependency check'
      }, 'Error checking dependencies');
      this.emit(
        'error',
        error instanceof Error ? error : new Error(String(error)),
        `dependency check for ${beanId}`
      );
      // On error, treat as blocked (safer)
      return [{ id: 'error' } as Bean];
    }
  }

  // ===========================================================================
  // Private: Git Worktree Management
  // ===========================================================================

  /**
   * Create a git worktree for a bean.
   * Uses execFileSync via centralized git module (shell-injection safe).
   * @throws Error if worktree creation fails
   */
  private async createWorktree(beanId: string): Promise<string> {
    const worktreePath = join(this.config.worktreeBase!, beanId);
    const branchName = `bean/${beanId}`;

    // Check if worktree already exists
    if (existsSync(worktreePath)) {
      return worktreePath;
    }

    try {
      // Create the worktree with a new branch
      gitCreateWorktree(worktreePath, branchName, true);
      return worktreePath;
    } catch {
      // Branch might already exist - try without creating new branch
      try {
        gitCreateWorktree(worktreePath, branchName, false);
        return worktreePath;
      } catch (finalError) {
        throw new Error(
          `Failed to create worktree for ${beanId}: ${finalError}`
        );
      }
    }
  }

  // ===========================================================================
  // Private: Poll Loop
  // ===========================================================================

  /**
   * Schedule the next poll iteration.
   */
  private scheduleNextPoll(): void {
    if (!this.isRunning) return;

    this.pollTimer = setTimeout(async () => {
      await this.pollForReady();
      this.scheduleNextPoll();
    }, this.config.pollInterval);
  }

  /**
   * Check for and emit ready beans.
   */
  private async pollForReady(): Promise<void> {
    // Keep getting eligible beans until capacity is full or queue is empty
    while (this.inProgress.size < this.config.maxParallel) {
      const bean = await this.getNextEligible();
      if (!bean) break;

      // Mark as in-progress and get worktree path
      const worktreePath = await this.markBeanInProgress(bean);

      // Emit bean-ready event
      this.emit('bean-ready', bean, worktreePath);
    }
  }
}

export default Scheduler;
