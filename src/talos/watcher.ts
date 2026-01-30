/**
 * File System Watcher
 *
 * Watches the .beans/ directory for changes and emits events
 * when beans are created, updated, or deleted.
 */
import { watch, type FSWatcher } from 'chokidar';
import { EventEmitter } from 'events';
import { basename, extname } from 'path';

export interface WatcherEvents {
  'bean:created': (beanId: string, path: string) => void;
  'bean:updated': (beanId: string, path: string) => void;
  'bean:deleted': (beanId: string, path: string) => void;
  error: (error: Error) => void;
}

export class Watcher extends EventEmitter {
  private fsWatcher: FSWatcher | null = null;
  private beansDir: string;

  constructor(beansDir: string = '.beans') {
    super();
    this.beansDir = beansDir;
  }

  /**
   * Start watching the beans directory
   */
  start(): void {
    if (this.fsWatcher) {
      return;
    }

    this.fsWatcher = watch(`${this.beansDir}/**/*.md`, {
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 50,
      },
    });

    this.fsWatcher
      .on('add', (path) => {
        const beanId = this.extractBeanId(path);
        if (beanId) {
          this.emit('bean:created', beanId, path);
        }
      })
      .on('change', (path) => {
        const beanId = this.extractBeanId(path);
        if (beanId) {
          this.emit('bean:updated', beanId, path);
        }
      })
      .on('unlink', (path) => {
        const beanId = this.extractBeanId(path);
        if (beanId) {
          this.emit('bean:deleted', beanId, path);
        }
      })
      .on('error', (error) => {
        this.emit('error', error);
      });
  }

  /**
   * Stop watching
   */
  async stop(): Promise<void> {
    if (this.fsWatcher) {
      await this.fsWatcher.close();
      this.fsWatcher = null;
    }
  }

  /**
   * Extract bean ID from file path
   * Bean files are named: {id}--{slug}.md
   */
  private extractBeanId(path: string): string | null {
    const filename = basename(path, extname(path));
    const match = filename.match(/^(daedalus-[a-z0-9]+)--/);
    return match ? match[1] : null;
  }
}

export default Watcher;
