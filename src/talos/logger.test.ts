/**
 * Logger Module Tests
 *
 * Tests for the Pino-based structured logging module.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// =============================================================================
// Test Helpers
// =============================================================================

function createTempDir(): string {
  const dir = join(tmpdir(), `talos-logger-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function cleanupTempDir(dir: string): void {
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
}

// =============================================================================
// Logger Creation Tests
// =============================================================================

describe('createLogger', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDir();
  });

  afterEach(() => {
    cleanupTempDir(tempDir);
  });

  it('creates a logger with default configuration', async () => {
    const { createLogger } = await import('./logger.js');
    const logger = createLogger();

    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.debug).toBe('function');
    expect(typeof logger.trace).toBe('function');
  });

  it('creates a logger with custom log level', async () => {
    const { createLogger } = await import('./logger.js');
    const logger = createLogger({ level: 'debug' });

    expect(logger.level).toBe('debug');
  });

  it('creates a logger with redaction configured', async () => {
    const { createLogger } = await import('./logger.js');
    const logger = createLogger({
      redact: ['password', 'secret'],
    });

    // Logger should be created successfully with redaction
    expect(logger).toBeDefined();
  });

  it('logs structured JSON by default', async () => {
    const { createLogger } = await import('./logger.js');
    
    // Capture output
    const chunks: string[] = [];
    const mockStream = {
      write: (chunk: string) => {
        chunks.push(chunk);
        return true;
      },
    };

    const logger = createLogger({
      destination: mockStream as unknown as NodeJS.WritableStream,
    });

    logger.info({ beanId: 'test-123' }, 'Test message');

    // Wait for async write
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(chunks.length).toBeGreaterThan(0);
    const logLine = JSON.parse(chunks[0]);
    expect(logLine.msg).toBe('Test message');
    expect(logLine.beanId).toBe('test-123');
    expect(logLine.level).toBe(30); // info level
  });

  it('redacts sensitive fields in output', async () => {
    const { createLogger } = await import('./logger.js');
    
    const chunks: string[] = [];
    const mockStream = {
      write: (chunk: string) => {
        chunks.push(chunk);
        return true;
      },
    };

    const logger = createLogger({
      redact: ['password', 'apiKey'],
      destination: mockStream as unknown as NodeJS.WritableStream,
    });

    logger.info({ password: 'secret123', apiKey: 'key456', safe: 'visible' }, 'Auth attempt');

    await new Promise(resolve => setTimeout(resolve, 10));

    expect(chunks.length).toBeGreaterThan(0);
    const logLine = JSON.parse(chunks[0]);
    expect(logLine.password).toBe('[Redacted]');
    expect(logLine.apiKey).toBe('[Redacted]');
    expect(logLine.safe).toBe('visible');
  });

  it('writes to file destination', async () => {
    const { createLogger } = await import('./logger.js');
    const logFile = join(tempDir, 'test.log');

    const logger = createLogger({
      destination: logFile,
    });

    logger.info({ test: true }, 'File log test');

    // Pino writes async, need to flush
    await new Promise(resolve => setTimeout(resolve, 100));

    const content = readFileSync(logFile, 'utf-8');
    expect(content).toContain('File log test');
    expect(content).toContain('"test":true');
  });
});

// =============================================================================
// Logger from Config Tests
// =============================================================================

describe('createLoggerFromConfig', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDir();
  });

  afterEach(() => {
    cleanupTempDir(tempDir);
  });

  it('creates logger from talos config', async () => {
    const { createLoggerFromConfig } = await import('./logger.js');
    
    const config = {
      level: 'warn' as const,
      prettyPrint: false,
      redact: ['token'],
      destination: 'stdout',
    };

    const logger = createLoggerFromConfig(config);

    expect(logger).toBeDefined();
    expect(logger.level).toBe('warn');
  });

  it('uses default config when not provided', async () => {
    const { createLoggerFromConfig } = await import('./logger.js');
    
    const logger = createLoggerFromConfig();

    expect(logger).toBeDefined();
    expect(logger.level).toBe('info');
  });
});

// =============================================================================
// Child Logger Tests
// =============================================================================

describe('child loggers', () => {
  it('creates child logger with additional context', async () => {
    const { createLogger } = await import('./logger.js');
    
    const chunks: string[] = [];
    const mockStream = {
      write: (chunk: string) => {
        chunks.push(chunk);
        return true;
      },
    };

    const logger = createLogger({
      destination: mockStream as unknown as NodeJS.WritableStream,
    });

    const childLogger = logger.child({ component: 'scheduler', beanId: 'abc-123' });
    childLogger.info('Task started');

    await new Promise(resolve => setTimeout(resolve, 10));

    expect(chunks.length).toBeGreaterThan(0);
    const logLine = JSON.parse(chunks[0]);
    expect(logLine.component).toBe('scheduler');
    expect(logLine.beanId).toBe('abc-123');
    expect(logLine.msg).toBe('Task started');
  });
});
