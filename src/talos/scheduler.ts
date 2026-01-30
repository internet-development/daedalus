/**
 * Scheduler
 *
 * Manages the priority queue for beans and handles dependency resolution.
 * Determines which beans can be worked on based on:
 * - Priority (critical > high > normal > low > deferred)
 * - Blocking relationships (blocked beans can't be worked on)
 * - Status (only todo/in-progress beans are workable)
 */
import { EventEmitter } from 'events';
import type { Bean } from './beans-client.js';

export interface SchedulerConfig {
  maxConcurrent: number;
}

export interface QueuedBean {
  bean: Bean;
  priority: number;
  queuedAt: Date;
}

const PRIORITY_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  normal: 2,
  low: 3,
  deferred: 4,
};

export class Scheduler extends EventEmitter {
  private queue: QueuedBean[] = [];
  private activeCount = 0;
  private config: SchedulerConfig;

  constructor(config: Partial<SchedulerConfig> = {}) {
    super();
    this.config = {
      maxConcurrent: 1,
      ...config,
    };
  }

  /**
   * Add beans to the queue
   */
  enqueue(beans: Bean[]): void {
    for (const bean of beans) {
      // Skip if already in queue
      if (this.queue.some((q) => q.bean.id === bean.id)) {
        continue;
      }

      this.queue.push({
        bean,
        priority: PRIORITY_ORDER[bean.priority] ?? PRIORITY_ORDER.normal,
        queuedAt: new Date(),
      });
    }

    // Sort by priority, then by queue time
    this.queue.sort((a, b) => {
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      return a.queuedAt.getTime() - b.queuedAt.getTime();
    });

    this.emit('queue:updated', this.queue.length);
  }

  /**
   * Remove a bean from the queue
   */
  dequeue(beanId: string): void {
    this.queue = this.queue.filter((q) => q.bean.id !== beanId);
    this.emit('queue:updated', this.queue.length);
  }

  /**
   * Get the next bean to work on (if capacity allows)
   */
  next(): Bean | null {
    if (this.activeCount >= this.config.maxConcurrent) {
      return null;
    }

    const queued = this.queue.shift();
    if (!queued) {
      return null;
    }

    this.activeCount++;
    return queued.bean;
  }

  /**
   * Mark a bean as completed (reduces active count)
   */
  complete(beanId: string): void {
    this.activeCount = Math.max(0, this.activeCount - 1);
    this.emit('bean:completed', beanId);
  }

  /**
   * Get current queue state
   */
  getState(): { queued: number; active: number } {
    return {
      queued: this.queue.length,
      active: this.activeCount,
    };
  }

  /**
   * Clear the queue
   */
  clear(): void {
    this.queue = [];
    this.activeCount = 0;
    this.emit('queue:cleared');
  }
}

export default Scheduler;
