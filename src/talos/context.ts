/**
 * Execution Context Module
 *
 * Provides AsyncLocalStorage-based context for automatic correlation ID
 * and context injection in logs. Enables tracing of operations across
 * async boundaries.
 */
import { AsyncLocalStorage } from 'async_hooks';
import { nanoid } from 'nanoid';

// =============================================================================
// Types
// =============================================================================

export interface ExecutionContext {
  /** Unique ID for tracing this operation across async boundaries */
  correlationId: string;
  /** Current bean being processed */
  beanId?: string;
  /** Which part of the system is logging */
  component?: string;
}

// =============================================================================
// AsyncLocalStorage Instance
// =============================================================================

/**
 * AsyncLocalStorage instance for execution context.
 * Automatically propagates context through async calls.
 */
export const executionContext = new AsyncLocalStorage<ExecutionContext>();

// =============================================================================
// Context Helpers
// =============================================================================

/**
 * Execute a function within an execution context.
 * Automatically generates a correlationId if not provided.
 *
 * @param context - Partial context to set (correlationId auto-generated if missing)
 * @param fn - Async function to execute within the context
 * @returns The result of the wrapped function
 *
 * @example
 * ```typescript
 * await withContext({ beanId: 'daedalus-abc1' }, async () => {
 *   logger.info('Starting bean execution');
 *   await processBean();
 *   logger.info('Bean completed');
 * });
 * ```
 */
export function withContext<T>(
  context: Partial<ExecutionContext>,
  fn: () => Promise<T>
): Promise<T> {
  const correlationId = context.correlationId || nanoid();
  return executionContext.run({ correlationId, ...context }, fn);
}

/**
 * Get the current execution context, or an empty object if none is set.
 * Useful for accessing context without needing to handle undefined.
 *
 * @returns The current context or an empty object
 */
export function getContext(): Partial<ExecutionContext> {
  return executionContext.getStore() || {};
}
