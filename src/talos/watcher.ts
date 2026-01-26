/**
 * Bean Watcher
 *
 * Watches the .beans/ directory for file changes and emits typed events
 * when beans are created, modified, or deleted.
 *
 * Features:
 * - Silent initial load with getBeans() for state access
 * - Events only emitted for changes AFTER start() resolves
 * - Status change detection via comparison with cached state
 * - Tag change detection for blocked/failed tags
 * - 100ms debounce for rapid file changes
 * - Handles file renames as delete + create
 */
import { watch, type FSWatcher } from 'chokidar';
import { EventEmitter } from 'events';
import { basename, extname, join } from 'path';
import {
  type Bean,
  type BeanStatus,
  listBeans,
  getBean as fetchBean,
  setCwd,
} from './beans-client.js';

// Re-export Bean and BeanStatus for convenience
export type { Bean, BeanStatus };

// =============================================================================
// Types
// =============================================================================

export interface BeanWatcherEvents {
  created: (bean: Bean) => void;
  updated: (bean: Bean, previous: Bean) => void;
  deleted: (beanId: string) => void;
  'status-changed': (bean: Bean, from: BeanStatus, to: BeanStatus) => void;
  'tags-changed': (bean: Bean, added: string[], removed: string[]) => void;
  error: (error: Error, filePath?: string) => void;
}

// =============================================================================
// BeanWatcher Class
// =============================================================================

export class BeanWatcher extends EventEmitter {
  private fsWatcher: FSWatcher | null = null;
  private beansDir: string;
  private cache: Map<string, Bean> = new Map();
  private isStarted: boolean = false;
  private pendingChanges: Map<string, NodeJS.Timeout> = new Map();
  private debounceMs: number = 100;

  constructor(beansPath: string = '.beans') {
    super();
    this.beansDir = beansPath;
  }

  // ===========================================================================
  // Lifecycle
  // ===========================================================================

  /**
   * Load initial state and start watching for changes.
   * Events are only emitted AFTER this method resolves.
   */
  async start(): Promise<void> {
    if (this.isStarted) {
      return;
    }

    // Set the working directory for beans CLI commands
    // Assumes beansDir is relative to cwd
    setCwd(process.cwd());

    // Load initial state silently (no events)
    await this.loadInitialState();

    // Start file watcher
    this.setupWatcher();

    this.isStarted = true;
  }

  /**
   * Stop watching and clean up resources.
   */
  stop(): void {
    // Cancel any pending debounced changes
    for (const timeout of this.pendingChanges.values()) {
      clearTimeout(timeout);
    }
    this.pendingChanges.clear();

    // Close file watcher
    if (this.fsWatcher) {
      this.fsWatcher.close();
      this.fsWatcher = null;
    }

    this.isStarted = false;
  }

  // ===========================================================================
  // State Access
  // ===========================================================================

  /**
   * Get all cached beans.
   * @returns Map of bean ID to Bean
   */
  getBeans(): Map<string, Bean> {
    return new Map(this.cache);
  }

  /**
   * Get a single bean by ID.
   * @returns Bean if found, null otherwise
   */
  getBean(id: string): Bean | null {
    return this.cache.get(id) ?? null;
  }

  // ===========================================================================
  // Private: Initial Load
  // ===========================================================================

  /**
   * Load all beans from the beans CLI into cache.
   * No events are emitted during this load.
   */
  private async loadInitialState(): Promise<void> {
    try {
      const beans = await listBeans();
      this.cache.clear();
      for (const bean of beans) {
        this.cache.set(bean.id, bean);
      }
    } catch (error) {
      // Emit error but don't throw - watcher can still run
      this.emit('error', error instanceof Error ? error : new Error(String(error)));
    }
  }

  // ===========================================================================
  // Private: File Watcher Setup
  // ===========================================================================

  /**
   * Set up chokidar to watch for file changes in the beans directory.
   */
  private setupWatcher(): void {
    // Watch the directory, not a glob pattern (more reliable on macOS)
    this.fsWatcher = watch(this.beansDir, {
      persistent: true,
      ignoreInitial: true,
      // Use function-based ignore (works better in chokidar 4.x)
      ignored: (path: string) => {
        // Ignore .index directory
        if (path.includes('.index')) return true;
        // Ignore hidden files (but not the beans dir itself)
        const name = path.split('/').pop() ?? '';
        if (name.startsWith('.') && name !== basename(this.beansDir)) return true;
        return false;
      },
    });

    this.fsWatcher
      .on('add', (path) => this.handleFileChange(path, 'add'))
      .on('change', (path) => this.handleFileChange(path, 'change'))
      .on('unlink', (path) => this.handleFileChange(path, 'unlink'))
      .on('error', (error) => {
        this.emit('error', error instanceof Error ? error : new Error(String(error)));
      });
  }

  // ===========================================================================
  // Private: Change Handling
  // ===========================================================================

  /**
   * Handle a file change event with debouncing.
   * Multiple rapid changes to the same file are collapsed into one.
   */
  private handleFileChange(
    filePath: string,
    eventType: 'add' | 'change' | 'unlink'
  ): void {
    // Only process .md files
    if (!filePath.endsWith('.md')) {
      return;
    }

    const beanId = this.extractBeanId(filePath);
    if (!beanId) {
      return; // Not a valid bean file
    }

    // Cancel any pending change for this file
    const existingTimeout = this.pendingChanges.get(filePath);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Schedule the change processing
    const timeout = setTimeout(() => {
      this.pendingChanges.delete(filePath);
      this.processFileChange(filePath, beanId, eventType);
    }, this.debounceMs);

    this.pendingChanges.set(filePath, timeout);
  }

  /**
   * Process a debounced file change.
   */
  private async processFileChange(
    filePath: string,
    beanId: string,
    eventType: 'add' | 'change' | 'unlink'
  ): Promise<void> {
    try {
      if (eventType === 'unlink') {
        // File deleted
        const previous = this.cache.get(beanId);
        if (previous) {
          this.cache.delete(beanId);
          this.emit('deleted', beanId);
        }
        return;
      }

      // File added or changed - fetch fresh bean data
      const bean = await fetchBean(beanId);
      if (!bean) {
        // Bean was deleted between file change and fetch
        const previous = this.cache.get(beanId);
        if (previous) {
          this.cache.delete(beanId);
          this.emit('deleted', beanId);
        }
        return;
      }

      const previous = this.cache.get(beanId);

      if (!previous) {
        // New bean created
        this.cache.set(beanId, bean);
        this.emit('created', bean);
        return;
      }

      // Bean updated - check for specific changes
      this.cache.set(beanId, bean);

      // Always emit 'updated' for any change
      this.emit('updated', bean, previous);

      // Check for status change
      if (previous.status !== bean.status) {
        this.emit('status-changed', bean, previous.status, bean.status);
      }

      // Check for tag changes
      const { added, removed } = this.computeTagChanges(previous.tags, bean.tags);
      if (added.length > 0 || removed.length > 0) {
        this.emit('tags-changed', bean, added, removed);
      }
    } catch (error) {
      this.emit(
        'error',
        error instanceof Error ? error : new Error(String(error)),
        filePath
      );
    }
  }

  // ===========================================================================
  // Private: Utilities
  // ===========================================================================

  /**
   * Extract bean ID from file path.
   * Bean files are named: {id}--{slug}.md or just {id}.md
   */
  private extractBeanId(filePath: string): string | null {
    const filename = basename(filePath, extname(filePath));

    // Match pattern: daedalus-{nanoid}--{slug} or just daedalus-{nanoid}
    const match = filename.match(/^(daedalus-[a-z0-9]+)/);
    return match ? match[1] : null;
  }

  /**
   * Compute which tags were added and removed between two tag arrays.
   */
  private computeTagChanges(
    oldTags: string[],
    newTags: string[]
  ): { added: string[]; removed: string[] } {
    const oldSet = new Set(oldTags);
    const newSet = new Set(newTags);

    const added = newTags.filter((tag) => !oldSet.has(tag));
    const removed = oldTags.filter((tag) => !newSet.has(tag));

    return { added, removed };
  }
}

// ===========================================================================
// Legacy Export (for backwards compatibility)
// ===========================================================================

/**
 * @deprecated Use BeanWatcher instead
 */
export class Watcher extends BeanWatcher {}

export default BeanWatcher;
