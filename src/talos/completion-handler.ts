/**
 * Completion Handler
 *
 * Handles post-execution tasks after an agent completes work on a bean.
 * This includes:
 * - Persisting output logs
 * - Updating bean status
 * - Checking for unchecked items in bean body
 * - Notifying the scheduler
 */
import { EventEmitter } from 'events';
import { writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { BeansClient } from './beans-client.js';

export interface CompletionResult {
  agentId: string;
  beanId: string;
  success: boolean;
  exitCode: number | null;
  output: string[];
}

export interface CompletionHandlerConfig {
  outputDir: string;
  autoComplete: boolean;
}

export class CompletionHandler extends EventEmitter {
  private config: CompletionHandlerConfig;
  private beansClient: BeansClient;

  constructor(
    beansClient: BeansClient,
    config: Partial<CompletionHandlerConfig> = {}
  ) {
    super();
    this.beansClient = beansClient;
    this.config = {
      outputDir: '.talos/output',
      autoComplete: false,
      ...config,
    };
  }

  /**
   * Handle agent completion
   */
  async handle(result: CompletionResult): Promise<void> {
    // Persist output
    await this.persistOutput(result);

    // Get bean to check status
    const bean = await this.beansClient.getBean(result.beanId);
    if (!bean) {
      this.emit('error', {
        beanId: result.beanId,
        error: new Error('Bean not found'),
      });
      return;
    }

    // Check if bean has unchecked items
    const hasUncheckedItems = this.hasUncheckedItems(bean.body);

    // Determine new status
    let newStatus = bean.status;

    if (result.success) {
      if (this.config.autoComplete && !hasUncheckedItems) {
        newStatus = 'completed';
      }
    } else {
      // Failed agents don't auto-complete, but we might want to mark as blocked
      this.emit('failed', {
        beanId: result.beanId,
        exitCode: result.exitCode,
      });
    }

    // Update bean status if changed
    if (newStatus !== bean.status) {
      await this.beansClient.updateStatus(result.beanId, newStatus);
      this.emit('status-updated', {
        beanId: result.beanId,
        oldStatus: bean.status,
        newStatus,
      });
    }

    this.emit('completed', {
      beanId: result.beanId,
      success: result.success,
      hasUncheckedItems,
    });
  }

  /**
   * Persist agent output to file
   */
  private async persistOutput(result: CompletionResult): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${result.beanId}-${timestamp}.log`;
    const filepath = join(this.config.outputDir, filename);

    try {
      await mkdir(dirname(filepath), { recursive: true });
      await writeFile(filepath, result.output.join(''), 'utf-8');
      this.emit('output-persisted', { beanId: result.beanId, filepath });
    } catch (error) {
      this.emit('error', {
        beanId: result.beanId,
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }

  /**
   * Check if bean body has unchecked markdown checkboxes
   */
  private hasUncheckedItems(body: string): boolean {
    // Match unchecked items: - [ ] or * [ ]
    const uncheckedPattern = /^[\s]*[-*]\s*\[\s*\]/m;
    return uncheckedPattern.test(body);
  }
}

export default CompletionHandler;
