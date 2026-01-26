/**
 * Talos Orchestrator
 *
 * Main daemon class that ties together all components: watcher, scheduler,
 * runner, and completion handler. Provides a unified API for the TUI.
 *
 * Features:
 * - Initialize all components on startup
 * - Wire up event handlers between components
 * - Load configuration from talos.yml
 * - Unified API for TUI
 * - Graceful shutdown
 * - Crash recovery (detect orphaned in-progress beans)
 * - Output persistence to .talos/output/{bean-id}.log
 */
import { EventEmitter } from 'events';
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from 'fs';
import { join, dirname } from 'path';
import {
  loadConfig,
  type TalosConfig,
  type ConfigResult,
  type DiscoveredPaths,
} from '../config/index.js';
import { BeanWatcher } from './watcher.js';
import { Scheduler } from './scheduler.js';
import {
  AgentRunner,
  type OutputEvent,
  type ExitResult,
  type AgentConfig,
} from './agent-runner.js';
import { CompletionHandler, type CompletionResult } from './completion-handler.js';
import {
  type Bean,
  type BeanStatus,
  listBeans,
  getBean,
  updateBeanTags,
  createBean,
  isStuck,
  setCwd,
} from './beans-client.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Bean currently being executed
 */
export interface RunningBean {
  bean: Bean;
  startedAt: number;
  worktreePath?: string;
}

/**
 * Events emitted by the Talos orchestrator
 */
export interface TalosEvents {
  'bean-started': (bean: Bean) => void;
  'bean-completed': (bean: Bean) => void;
  'bean-blocked': (bean: Bean, blocker?: Bean) => void;
  'bean-failed': (bean: Bean, error: Error) => void;
  'output': (data: OutputEvent) => void;
  'queue-changed': (queue: Bean[]) => void;
  'error': (error: Error) => void;
}

// =============================================================================
// Talos Class
// =============================================================================

export class Talos extends EventEmitter {
  // Configuration
  private config: TalosConfig;
  private paths: DiscoveredPaths;

  // Components
  private watcher: BeanWatcher;
  private scheduler: Scheduler;
  private runner: AgentRunner;
  private completionHandler: CompletionHandler;

  // State
  private running: boolean = false;
  private paused: boolean = false;
  private inProgress: Map<string, RunningBean> = new Map();
  private recentlyCompleted: Bean[] = [];
  private outputDir: string;

  constructor(configPath?: string) {
    super();

    // Load configuration
    const startDir = configPath ? dirname(configPath) : process.cwd();
    const { config, paths } = loadConfig(startDir);
    this.config = config;
    this.paths = paths;

    // Set working directory for beans CLI
    setCwd(paths.projectRoot);

    // Initialize output directory
    this.outputDir = join(paths.projectRoot, '.talos', 'output');

    // Initialize components
    this.watcher = new BeanWatcher(paths.beansPath);

    this.scheduler = new Scheduler({
      maxParallel: config.scheduler.max_parallel,
      pollInterval: config.scheduler.poll_interval,
    });

    // Build agent config from TalosConfig
    const agentConfig: AgentConfig = {
      backend: config.agent.backend,
      opencode: config.agent.opencode,
      claude: config.agent.claude,
      codex: config.agent.codex,
    };
    this.runner = new AgentRunner(agentConfig);

    this.completionHandler = new CompletionHandler(config);

    // Wire up event handlers
    this.wireEvents();
  }

  // ===========================================================================
  // Lifecycle
  // ===========================================================================

  /**
   * Start the Talos daemon
   */
  async start(): Promise<void> {
    if (this.running) {
      return;
    }

    // Ensure output directory exists
    this.ensureOutputDir();

    // Start watcher (loads initial bean state)
    await this.watcher.start();

    // Detect orphaned in-progress beans (crash recovery)
    await this.detectOrphanedBeans();

    // Auto-enqueue on startup if configured
    if (this.config.scheduler.auto_enqueue_on_startup) {
      await this.enqueueActionableBeans();
    }

    // Start scheduler
    this.scheduler.start();

    this.running = true;
  }

  /**
   * Stop the Talos daemon gracefully
   */
  async stop(): Promise<void> {
    if (!this.running) {
      return;
    }

    // Stop scheduler (no new beans will be started)
    this.scheduler.stop();

    // Stop watcher
    this.watcher.stop();

    // Wait for running agent to complete (if any)
    if (this.runner.isRunning()) {
      await this.runner.cancel();
    }

    this.running = false;
  }

  // ===========================================================================
  // State Accessors
  // ===========================================================================

  /**
   * Get the current queue
   */
  getQueue(): Bean[] {
    return this.scheduler.getQueue();
  }

  /**
   * Get beans currently in progress
   */
  getInProgress(): Map<string, RunningBean> {
    return new Map(this.inProgress);
  }

  /**
   * Get stuck beans (with 'blocked' or 'failed' tags)
   */
  getStuck(): Bean[] {
    const allBeans = this.watcher.getBeans();
    const stuckBeans: Bean[] = [];

    for (const bean of allBeans.values()) {
      if (isStuck(bean)) {
        stuckBeans.push(bean);
      }
    }

    return stuckBeans;
  }

  /**
   * Get recently completed beans (last 5)
   */
  getRecentlyCompleted(): Bean[] {
    return [...this.recentlyCompleted];
  }

  /**
   * Get persisted output for a bean
   */
  getOutput(beanId: string): string | null {
    const outputPath = this.getOutputPath(beanId);
    if (!existsSync(outputPath)) {
      return null;
    }
    try {
      return readFileSync(outputPath, 'utf-8');
    } catch {
      return null;
    }
  }

  /**
   * Check if the daemon is paused
   */
  isPaused(): boolean {
    return this.paused;
  }

  /**
   * Get the loaded configuration
   */
  getConfig(): TalosConfig {
    return this.config;
  }

  /**
   * Get discovered paths
   */
  getPaths(): DiscoveredPaths {
    return this.paths;
  }

  // ===========================================================================
  // Control Methods
  // ===========================================================================

  /**
   * Pause scheduling (no new beans will be started)
   */
  pause(): void {
    this.paused = true;
    this.scheduler.stop();
  }

  /**
   * Resume scheduling
   */
  resume(): void {
    this.paused = false;
    this.scheduler.start();
  }

  /**
   * Cancel a running agent
   */
  async cancel(beanId: string): Promise<void> {
    const runningBean = this.inProgress.get(beanId);
    if (!runningBean) {
      return;
    }

    // Cancel the runner
    await this.runner.cancel();

    // Mark as failed (cancelled)
    const bean = await getBean(beanId);
    if (bean) {
      await updateBeanTags(beanId, ['failed']);
      await createBean({
        title: `Cancelled: ${bean.title}`,
        type: 'bug',
        status: 'todo',
        blocking: [beanId],
        body: `Agent was manually cancelled while working on ${beanId}.`,
      });
    }

    // Clean up
    this.inProgress.delete(beanId);
    this.scheduler.markComplete(beanId);
  }

  /**
   * Retry a stuck bean
   * 1. Remove 'blocked' or 'failed' tag
   * 2. Re-enqueue at front of queue
   */
  async retry(beanId: string): Promise<void> {
    const bean = await getBean(beanId);
    if (!bean) {
      this.emit('error', new Error(`Bean not found: ${beanId}`));
      return;
    }

    // Remove stuck tags
    const tagsToRemove: string[] = [];
    if (bean.tags.includes('blocked')) {
      tagsToRemove.push('blocked');
    }
    if (bean.tags.includes('failed')) {
      tagsToRemove.push('failed');
    }

    if (tagsToRemove.length > 0) {
      await updateBeanTags(beanId, undefined, tagsToRemove);
    }

    // Clear stuck status in scheduler
    this.scheduler.clearStuck(beanId);

    // Re-fetch bean with updated tags
    const updatedBean = await getBean(beanId);
    if (updatedBean) {
      // Enqueue at front (by setting high priority temporarily)
      // For now, just enqueue - the priority system will handle ordering
      this.scheduler.enqueue(updatedBean);
      this.emit('queue-changed', this.scheduler.getQueue());
    }
  }

  // ===========================================================================
  // Event Wiring
  // ===========================================================================

  /**
   * Wire up event handlers between components
   */
  private wireEvents(): void {
    // Watcher events → Scheduler
    this.wireWatcherEvents();

    // Scheduler 'bean-ready' → Runner
    this.wireSchedulerEvents();

    // Runner events → Output persistence & Completion handler
    this.wireRunnerEvents();

    // Completion handler events → Talos events
    this.wireCompletionEvents();
  }

  /**
   * Wire watcher events to scheduler
   */
  private wireWatcherEvents(): void {
    // New bean created
    this.watcher.on('created', (bean: Bean) => {
      if (this.shouldEnqueue(bean)) {
        this.scheduler.enqueue(bean);
        this.emit('queue-changed', this.scheduler.getQueue());
      }
    });

    // Bean updated
    this.watcher.on('updated', (bean: Bean) => {
      // Update bean in queue if it's there
      this.scheduler.updateBean(bean);

      // Check if bean became actionable
      if (this.shouldEnqueue(bean)) {
        this.scheduler.enqueue(bean);
        this.emit('queue-changed', this.scheduler.getQueue());
      }
    });

    // Bean deleted
    this.watcher.on('deleted', (beanId: string) => {
      this.scheduler.dequeue(beanId);
      this.emit('queue-changed', this.scheduler.getQueue());
    });

    // Status changed
    this.watcher.on('status-changed', (bean: Bean, from: BeanStatus, to: BeanStatus) => {
      // If bean is completed or scrapped, remove from queue
      if (to === 'completed' || to === 'scrapped') {
        this.scheduler.dequeue(bean.id);
        this.emit('queue-changed', this.scheduler.getQueue());
      }
    });

    // Tags changed (blocked/failed detection)
    this.watcher.on('tags-changed', (bean: Bean, added: string[], removed: string[]) => {
      // If bean became stuck, mark it in scheduler
      if (added.includes('blocked') || added.includes('failed')) {
        const reason = added.includes('blocked') ? 'blocked' : 'failed';
        this.scheduler.markStuck(bean.id, reason);
      }

      // If stuck tags were removed, clear stuck status
      if (removed.includes('blocked') || removed.includes('failed')) {
        this.scheduler.clearStuck(bean.id);
      }
    });

    // Watcher errors
    this.watcher.on('error', (error: Error) => {
      this.emit('error', error);
    });
  }

  /**
   * Wire scheduler events to runner
   */
  private wireSchedulerEvents(): void {
    // Bean is ready to be worked on
    this.scheduler.on('bean-ready', async (bean: Bean, worktreePath?: string) => {
      // Skip if paused
      if (this.paused) {
        // Re-enqueue for later
        this.scheduler.enqueue(bean);
        return;
      }

      // Track in-progress
      this.inProgress.set(bean.id, {
        bean,
        startedAt: Date.now(),
        worktreePath,
      });

      // Clear previous output file
      this.clearOutput(bean.id);

      // Start the agent
      this.runner.run(bean, worktreePath);
    });

    // Queue updated
    this.scheduler.on('queue:updated', () => {
      this.emit('queue-changed', this.scheduler.getQueue());
    });

    // Scheduler errors
    this.scheduler.on('error', (error: Error) => {
      this.emit('error', error);
    });
  }

  /**
   * Wire runner events
   */
  private wireRunnerEvents(): void {
    // Agent started
    this.runner.on('started', (bean: Bean) => {
      this.emit('bean-started', bean);
    });

    // Agent output
    this.runner.on('output', (event: OutputEvent) => {
      // Persist output to file
      this.appendOutput(event.beanId, event.data);

      // Emit for UI
      this.emit('output', event);
    });

    // Agent exited
    this.runner.on('exit', async (result: ExitResult) => {
      const runningBean = this.findRunningBean();
      if (!runningBean) {
        return;
      }

      const { bean, worktreePath } = runningBean;
      const outputPath = this.getOutputPath(bean.id);

      // Handle completion
      const completionResult = await this.completionHandler.handleCompletion(
        bean,
        result.code,
        outputPath,
        worktreePath
      );

      // Update internal state based on outcome
      this.handleCompletionResult(bean, completionResult);
    });

    // Agent errors
    this.runner.on('error', (error: Error) => {
      this.emit('error', error);
    });
  }

  /**
   * Wire completion handler events
   */
  private wireCompletionEvents(): void {
    // Bean completed successfully
    this.completionHandler.on('bean-completed', async ({ beanId }) => {
      const bean = await getBean(beanId);
      if (bean) {
        // Add to recently completed
        this.addToRecentlyCompleted(bean);
        this.emit('bean-completed', bean);
      }
    });

    // Bean blocked
    this.completionHandler.on('bean-blocked', async ({ beanId, blockerBeanId }) => {
      const bean = await getBean(beanId);
      const blocker = blockerBeanId ? await getBean(blockerBeanId) : undefined;
      if (bean) {
        this.emit('bean-blocked', bean, blocker ?? undefined);
      }
    });

    // Bean failed
    this.completionHandler.on('bean-failed', async ({ beanId, error }) => {
      const bean = await getBean(beanId);
      if (bean) {
        this.emit('bean-failed', bean, new Error(error));
      }
    });

    // Completion handler errors
    this.completionHandler.on('error', (error: Error) => {
      this.emit('error', error);
    });
  }

  // ===========================================================================
  // Private Helpers
  // ===========================================================================

  /**
   * Handle completion result and update internal state
   */
  private handleCompletionResult(bean: Bean, result: CompletionResult): void {
    // Remove from in-progress
    this.inProgress.delete(bean.id);

    // Tell scheduler it's done
    this.scheduler.markComplete(bean.id);

    // Emit queue changed
    this.emit('queue-changed', this.scheduler.getQueue());
  }

  /**
   * Find the currently running bean (there should be only one in sequential mode)
   */
  private findRunningBean(): RunningBean | undefined {
    // In sequential mode, there's only one
    for (const running of this.inProgress.values()) {
      return running;
    }
    return undefined;
  }

  /**
   * Check if a bean should be enqueued
   */
  private shouldEnqueue(bean: Bean): boolean {
    // Only enqueue beans that are todo or in-progress (without stuck tags)
    if (bean.status !== 'todo' && bean.status !== 'in-progress') {
      return false;
    }

    // Don't enqueue stuck beans
    if (isStuck(bean)) {
      return false;
    }

    // Don't enqueue if already in queue or in progress
    const queue = this.scheduler.getQueue();
    if (queue.some((b) => b.id === bean.id)) {
      return false;
    }
    if (this.inProgress.has(bean.id)) {
      return false;
    }

    return true;
  }

  /**
   * Enqueue all actionable beans on startup
   */
  private async enqueueActionableBeans(): Promise<void> {
    const beans = await listBeans({
      status: ['todo'],
      excludeTags: ['blocked', 'failed'],
    });

    for (const bean of beans) {
      this.scheduler.enqueue(bean);
    }

    this.emit('queue-changed', this.scheduler.getQueue());
  }

  /**
   * Detect orphaned in-progress beans (crash recovery)
   */
  private async detectOrphanedBeans(): Promise<void> {
    const inProgressBeans = await listBeans({
      status: ['in-progress'],
    });

    for (const bean of inProgressBeans) {
      // Skip beans that are already marked as stuck
      if (isStuck(bean)) {
        continue;
      }

      // This bean was in-progress but no agent is running
      // Mark it as failed and create a blocker
      await updateBeanTags(bean.id, ['failed']);
      await createBean({
        title: `Crash: ${bean.title}`,
        type: 'bug',
        status: 'todo',
        priority: 'high',
        blocking: [bean.id],
        body: `Bean was found in 'in-progress' status on startup but no agent was running.
This likely indicates a crash or unexpected termination.

Manual review required before retrying.

Bean: ${bean.id}
Title: ${bean.title}`,
      });

      // Mark as stuck in scheduler
      this.scheduler.markStuck(bean.id, 'failed');
    }
  }

  /**
   * Add a bean to the recently completed list (max 5)
   */
  private addToRecentlyCompleted(bean: Bean): void {
    // Add to front
    this.recentlyCompleted.unshift(bean);

    // Keep only last 5
    if (this.recentlyCompleted.length > 5) {
      this.recentlyCompleted = this.recentlyCompleted.slice(0, 5);
    }
  }

  // ===========================================================================
  // Output Persistence
  // ===========================================================================

  /**
   * Ensure output directory exists
   */
  private ensureOutputDir(): void {
    if (!existsSync(this.outputDir)) {
      mkdirSync(this.outputDir, { recursive: true });
    }
  }

  /**
   * Get the output file path for a bean
   */
  private getOutputPath(beanId: string): string {
    return join(this.outputDir, `${beanId}.log`);
  }

  /**
   * Clear output file for a bean
   */
  private clearOutput(beanId: string): void {
    const outputPath = this.getOutputPath(beanId);
    try {
      writeFileSync(outputPath, '');
    } catch {
      // Ignore errors
    }
  }

  /**
   * Append output to the file for a bean
   */
  private appendOutput(beanId: string, data: string): void {
    const outputPath = this.getOutputPath(beanId);
    try {
      appendFileSync(outputPath, data);
    } catch {
      // Ignore errors
    }
  }
}

export default Talos;
