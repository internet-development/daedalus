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
  updateBeanStatus,
  updateBeanTags,
  createBean,
  isStuck,
  isReviewModeType,
  getIncompleteChildren,
  addBlockingRelationship,
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
  private errorsEpicId: string | null = null;

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

    // Find or create Errors epic for organizing crash/blocker beans
    await this.ensureErrorsEpic();

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
   *
   * On stop:
   * - Reverts any running bean's status to 'todo' (available for future runs)
   * - Does NOT create any crash/cancelled beans
   * - Bean will be picked up on next daemon run
   */
  async stop(): Promise<void> {
    if (!this.running) {
      return;
    }

    // Stop scheduler (no new beans will be started)
    this.scheduler.stop();

    // Stop watcher
    this.watcher.stop();

    // Handle any running agent
    if (this.runner.isRunning()) {
      // Find the running bean and remove from inProgress BEFORE cancel
      const runningBean = this.findRunningBean();
      if (runningBean) {
        this.inProgress.delete(runningBean.bean.id);

        // Cancel the runner (doesn't emit 'exit' event)
        await this.runner.cancel();

        // Revert bean status to 'todo' so it can be picked up on next run
        await updateBeanStatus(runningBean.bean.id, 'todo');
      } else {
        // No bean tracked but runner is running - just cancel
        await this.runner.cancel();
      }
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
   *
   * On cancellation:
   * - Reverts bean status to 'todo' (available for future runs)
   * - Does NOT create a "Cancelled: ..." bean
   * - Does NOT add 'failed' tag
   * - Removes from scheduler queue (no auto-retry in current session)
   * - User can manually retry with 'r' key
   */
  async cancel(beanId: string): Promise<void> {
    const runningBean = this.inProgress.get(beanId);
    if (!runningBean) {
      return;
    }

    // Remove from inProgress BEFORE calling cancel to prevent race conditions
    this.inProgress.delete(beanId);

    // Cancel the runner and get result (doesn't emit 'exit' event)
    const result = await this.runner.cancel();

    // Revert bean status to 'todo' so it can be picked up on next run
    await updateBeanStatus(beanId, 'todo');

    // Clean up scheduler state (prevents auto-retry in current session)
    this.scheduler.markComplete(beanId);

    // Emit queue changed
    this.emit('queue-changed', this.scheduler.getQueue());
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
    this.watcher.on('created', async (bean: Bean) => {
      if (this.shouldEnqueue(bean)) {
        // Set up blocking for epics/milestones
        await this.setupEpicBlocking(bean);
        this.scheduler.enqueue(bean);
        this.emit('queue-changed', this.scheduler.getQueue());
      }
    });

    // Bean updated
    this.watcher.on('updated', async (bean: Bean) => {
      // Update bean in queue if it's there
      this.scheduler.updateBean(bean);

      // Check if bean became actionable
      if (this.shouldEnqueue(bean)) {
        // Set up blocking for epics/milestones
        await this.setupEpicBlocking(bean);
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

    // Agent errors (e.g., spawn failure - command not found)
    this.runner.on('error', async (error: Error) => {
      const runningBean = this.findRunningBean();
      if (runningBean) {
        const { bean, worktreePath } = runningBean;

        // Write error to output file so crash bean has context
        this.appendOutput(bean.id, `Spawn error: ${error.message}\n`);

        // Clean up in-progress state
        this.inProgress.delete(bean.id);

        // Handle as crash (exit code -1 indicates spawn failure)
        const completionResult = await this.completionHandler.handleCompletion(
          bean,
          -1,
          this.getOutputPath(bean.id),
          worktreePath
        );

        this.handleCompletionResult(bean, completionResult);
      }

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
   * Set up blocking relationships for epic/milestone beans.
   * Each incomplete child blocks the parent, so the parent can only be
   * worked on (in review mode) when all children are complete.
   */
  private async setupEpicBlocking(bean: Bean): Promise<void> {
    // Only process epics and milestones
    if (!isReviewModeType(bean.type)) {
      return;
    }

    try {
      // Get all incomplete children
      const incompleteChildren = await getIncompleteChildren(bean.id);

      // Add blocking relationship: each child blocks the parent
      for (const child of incompleteChildren) {
        // Check if the child already has this blocking relationship
        if (!child.blockingIds.includes(bean.id)) {
          await addBlockingRelationship(child.id, bean.id);
        }
      }
    } catch (error) {
      // Log but don't fail - blocking is optional optimization
      this.emit('error', error instanceof Error ? error : new Error(String(error)));
    }
  }

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
        parent: this.errorsEpicId ?? undefined,
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
   * Find or create the Errors epic for organizing crash/blocker beans
   */
  private async ensureErrorsEpic(): Promise<void> {
    try {
      // Search for existing Errors epic
      const existing = await listBeans({ type: ['epic'], search: 'Errors' });
      const errorsEpic = existing.find((b) => b.title === 'Errors');

      if (errorsEpic) {
        this.errorsEpicId = errorsEpic.id;
      } else {
        // Create new Errors epic
        const newEpic = await createBean({
          title: 'Errors',
          type: 'epic',
          status: 'todo',
          body: 'Container for crash and blocker beans created by Talos.',
        });
        this.errorsEpicId = newEpic.id;
      }

      // Pass to completion handler so it can use it for crash/blocker beans
      this.completionHandler.setErrorsEpicId(this.errorsEpicId);
    } catch (error) {
      // Log but don't fail - errors epic is optional
      this.emit('error', error instanceof Error ? error : new Error(String(error)));
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
