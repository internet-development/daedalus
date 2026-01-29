/**
 * Daemon Component Logging Tests
 *
 * Tests that scheduler, watcher, and agent-runner use structured logging
 * with proper context and component names.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'events';

// =============================================================================
// Test Helpers
// =============================================================================

/**
 * Create a mock stream that captures log output
 */
function createMockStream() {
  const chunks: string[] = [];
  return {
    chunks,
    stream: {
      write: (chunk: string) => {
        chunks.push(chunk);
        return true;
      },
    },
    getLogLines: () => chunks.map(c => JSON.parse(c)),
  };
}

// =============================================================================
// Scheduler Logging Tests
// =============================================================================

describe('Scheduler logging', () => {
  it('logs bean enqueue with component name', async () => {
    const { createLogger } = await import('./logger.js');
    const mock = createMockStream();
    
    // Create a logger with mock stream
    const logger = createLogger({
      destination: mock.stream as unknown as NodeJS.WritableStream,
    });
    const schedulerLogger = logger.child({ component: 'scheduler' });
    
    // Simulate what scheduler should log
    const beanId = 'daedalus-test1';
    const priority = 'high';
    schedulerLogger.info({ beanId, priority }, 'Bean enqueued');
    
    await new Promise(resolve => setTimeout(resolve, 10));
    
    const logs = mock.getLogLines();
    expect(logs.length).toBe(1);
    expect(logs[0].component).toBe('scheduler');
    expect(logs[0].beanId).toBe('daedalus-test1');
    expect(logs[0].priority).toBe('high');
    expect(logs[0].msg).toBe('Bean enqueued');
  });

  it('logs dependency check with debug level', async () => {
    const { createLogger } = await import('./logger.js');
    const mock = createMockStream();
    
    const logger = createLogger({
      level: 'debug',
      destination: mock.stream as unknown as NodeJS.WritableStream,
    });
    const schedulerLogger = logger.child({ component: 'scheduler' });
    
    const beanId = 'daedalus-test1';
    const blockedBy = ['daedalus-dep1', 'daedalus-dep2'];
    schedulerLogger.debug({ beanId, blockedBy }, 'Checking dependencies');
    
    await new Promise(resolve => setTimeout(resolve, 10));
    
    const logs = mock.getLogLines();
    expect(logs.length).toBe(1);
    expect(logs[0].level).toBe(20); // debug level
    expect(logs[0].blockedBy).toEqual(['daedalus-dep1', 'daedalus-dep2']);
  });

  it('logs bean stuck with reason', async () => {
    const { createLogger } = await import('./logger.js');
    const mock = createMockStream();
    
    const logger = createLogger({
      destination: mock.stream as unknown as NodeJS.WritableStream,
    });
    const schedulerLogger = logger.child({ component: 'scheduler' });
    
    const beanId = 'daedalus-test1';
    const reason = 'blocked';
    schedulerLogger.warn({ beanId, reason }, 'Bean marked as stuck');
    
    await new Promise(resolve => setTimeout(resolve, 10));
    
    const logs = mock.getLogLines();
    expect(logs.length).toBe(1);
    expect(logs[0].level).toBe(40); // warn level
    expect(logs[0].reason).toBe('blocked');
  });

  it('logs errors with full context', async () => {
    const { createLogger } = await import('./logger.js');
    const mock = createMockStream();
    
    const logger = createLogger({
      destination: mock.stream as unknown as NodeJS.WritableStream,
    });
    const schedulerLogger = logger.child({ component: 'scheduler' });
    
    const error = new Error('Worktree creation failed');
    const beanId = 'daedalus-test1';
    schedulerLogger.error({ err: error, beanId, context: 'worktree creation' }, 'Error occurred');
    
    await new Promise(resolve => setTimeout(resolve, 10));
    
    const logs = mock.getLogLines();
    expect(logs.length).toBe(1);
    expect(logs[0].level).toBe(50); // error level
    expect(logs[0].err.message).toBe('Worktree creation failed');
    expect(logs[0].beanId).toBe('daedalus-test1');
    expect(logs[0].context).toBe('worktree creation');
  });
});

// =============================================================================
// Watcher Logging Tests
// =============================================================================

describe('Watcher logging', () => {
  it('logs file change detection with component name', async () => {
    const { createLogger } = await import('./logger.js');
    const mock = createMockStream();
    
    const logger = createLogger({
      level: 'debug',
      destination: mock.stream as unknown as NodeJS.WritableStream,
    });
    const watcherLogger = logger.child({ component: 'watcher' });
    
    const filePath = '.beans/daedalus-abc1--test.md';
    const eventType = 'change';
    watcherLogger.debug({ filePath, eventType }, 'File change detected');
    
    await new Promise(resolve => setTimeout(resolve, 10));
    
    const logs = mock.getLogLines();
    expect(logs.length).toBe(1);
    expect(logs[0].component).toBe('watcher');
    expect(logs[0].filePath).toBe('.beans/daedalus-abc1--test.md');
    expect(logs[0].eventType).toBe('change');
  });

  it('logs bean created event', async () => {
    const { createLogger } = await import('./logger.js');
    const mock = createMockStream();
    
    const logger = createLogger({
      destination: mock.stream as unknown as NodeJS.WritableStream,
    });
    const watcherLogger = logger.child({ component: 'watcher' });
    
    const beanId = 'daedalus-abc1';
    const title = 'New task';
    watcherLogger.info({ beanId, title }, 'Bean created');
    
    await new Promise(resolve => setTimeout(resolve, 10));
    
    const logs = mock.getLogLines();
    expect(logs.length).toBe(1);
    expect(logs[0].msg).toBe('Bean created');
    expect(logs[0].beanId).toBe('daedalus-abc1');
  });

  it('logs status change with from/to', async () => {
    const { createLogger } = await import('./logger.js');
    const mock = createMockStream();
    
    const logger = createLogger({
      destination: mock.stream as unknown as NodeJS.WritableStream,
    });
    const watcherLogger = logger.child({ component: 'watcher' });
    
    const beanId = 'daedalus-abc1';
    const from = 'todo';
    const to = 'in-progress';
    watcherLogger.info({ beanId, from, to }, 'Bean status changed');
    
    await new Promise(resolve => setTimeout(resolve, 10));
    
    const logs = mock.getLogLines();
    expect(logs.length).toBe(1);
    expect(logs[0].from).toBe('todo');
    expect(logs[0].to).toBe('in-progress');
  });

  it('logs watch start/stop', async () => {
    const { createLogger } = await import('./logger.js');
    const mock = createMockStream();
    
    const logger = createLogger({
      destination: mock.stream as unknown as NodeJS.WritableStream,
    });
    const watcherLogger = logger.child({ component: 'watcher' });
    
    const beansDir = '.beans';
    watcherLogger.info({ beansDir }, 'Watch started');
    watcherLogger.info({ beansDir }, 'Watch stopped');
    
    await new Promise(resolve => setTimeout(resolve, 10));
    
    const logs = mock.getLogLines();
    expect(logs.length).toBe(2);
    expect(logs[0].msg).toBe('Watch started');
    expect(logs[1].msg).toBe('Watch stopped');
  });
});

// =============================================================================
// Agent Runner Logging Tests
// =============================================================================

describe('AgentRunner logging', () => {
  it('logs agent spawn with command and args', async () => {
    const { createLogger } = await import('./logger.js');
    const mock = createMockStream();
    
    const logger = createLogger({
      destination: mock.stream as unknown as NodeJS.WritableStream,
    });
    const agentLogger = logger.child({ component: 'agent-runner' });
    
    const command = 'claude';
    const args = ['-p', 'test prompt'];
    const beanId = 'daedalus-abc1';
    agentLogger.info({ command, args, beanId }, 'Spawning agent');
    
    await new Promise(resolve => setTimeout(resolve, 10));
    
    const logs = mock.getLogLines();
    expect(logs.length).toBe(1);
    expect(logs[0].component).toBe('agent-runner');
    expect(logs[0].command).toBe('claude');
    expect(logs[0].args).toEqual(['-p', 'test prompt']);
    expect(logs[0].beanId).toBe('daedalus-abc1');
  });

  it('logs agent completion with exit code and duration', async () => {
    const { createLogger } = await import('./logger.js');
    const mock = createMockStream();
    
    const logger = createLogger({
      destination: mock.stream as unknown as NodeJS.WritableStream,
    });
    const agentLogger = logger.child({ component: 'agent-runner' });
    
    const exitCode = 0;
    const duration = 12345;
    const beanId = 'daedalus-abc1';
    agentLogger.info({ exitCode, duration, beanId }, 'Agent execution completed');
    
    await new Promise(resolve => setTimeout(resolve, 10));
    
    const logs = mock.getLogLines();
    expect(logs.length).toBe(1);
    expect(logs[0].exitCode).toBe(0);
    expect(logs[0].duration).toBe(12345);
  });

  it('logs agent failure with error details', async () => {
    const { createLogger } = await import('./logger.js');
    const mock = createMockStream();
    
    const logger = createLogger({
      destination: mock.stream as unknown as NodeJS.WritableStream,
    });
    const agentLogger = logger.child({ component: 'agent-runner' });
    
    const error = new Error('Spawn failed: command not found');
    const beanId = 'daedalus-abc1';
    agentLogger.error({ err: error, beanId }, 'Agent spawn failed');
    
    await new Promise(resolve => setTimeout(resolve, 10));
    
    const logs = mock.getLogLines();
    expect(logs.length).toBe(1);
    expect(logs[0].level).toBe(50); // error
    expect(logs[0].err.message).toBe('Spawn failed: command not found');
  });

  it('logs cancellation with signal', async () => {
    const { createLogger } = await import('./logger.js');
    const mock = createMockStream();
    
    const logger = createLogger({
      destination: mock.stream as unknown as NodeJS.WritableStream,
    });
    const agentLogger = logger.child({ component: 'agent-runner' });
    
    const signal = 'SIGTERM';
    const beanId = 'daedalus-abc1';
    const duration = 5000;
    agentLogger.info({ signal, beanId, duration, cancelled: true }, 'Agent cancelled');
    
    await new Promise(resolve => setTimeout(resolve, 10));
    
    const logs = mock.getLogLines();
    expect(logs.length).toBe(1);
    expect(logs[0].signal).toBe('SIGTERM');
    expect(logs[0].cancelled).toBe(true);
  });
});

// =============================================================================
// Context Integration Tests
// =============================================================================

describe('Logging with execution context', () => {
  it('includes correlationId from context in all logs', async () => {
    const { createLogger } = await import('./logger.js');
    const { withContext } = await import('./context.js');
    const mock = createMockStream();
    
    const logger = createLogger({
      destination: mock.stream as unknown as NodeJS.WritableStream,
    });
    const schedulerLogger = logger.child({ component: 'scheduler' });
    
    await withContext({ correlationId: 'test-corr-123', beanId: 'daedalus-abc1' }, async () => {
      schedulerLogger.info('Processing bean');
      await new Promise(resolve => setTimeout(resolve, 10));
    });
    
    const logs = mock.getLogLines();
    expect(logs.length).toBe(1);
    expect(logs[0].correlationId).toBe('test-corr-123');
    expect(logs[0].beanId).toBe('daedalus-abc1');
    expect(logs[0].component).toBe('scheduler');
  });

  it('correlationId propagates across async operations', async () => {
    const { createLogger } = await import('./logger.js');
    const { withContext } = await import('./context.js');
    const mock = createMockStream();
    
    const logger = createLogger({
      destination: mock.stream as unknown as NodeJS.WritableStream,
    });
    const schedulerLogger = logger.child({ component: 'scheduler' });
    const agentLogger = logger.child({ component: 'agent-runner' });
    
    await withContext({ correlationId: 'trace-456' }, async () => {
      schedulerLogger.info('Scheduling bean');
      
      // Simulate async handoff to agent runner
      await new Promise(resolve => setTimeout(resolve, 5));
      agentLogger.info('Starting agent');
      
      await new Promise(resolve => setTimeout(resolve, 10));
    });
    
    const logs = mock.getLogLines();
    expect(logs.length).toBe(2);
    
    // Both logs should have the same correlationId
    expect(logs[0].correlationId).toBe('trace-456');
    expect(logs[1].correlationId).toBe('trace-456');
    
    // But different components
    expect(logs[0].component).toBe('scheduler');
    expect(logs[1].component).toBe('agent-runner');
  });
});
