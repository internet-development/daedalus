/**
 * Logger Module
 *
 * Structured logging using Pino with support for:
 * - Multiple log levels (trace, debug, info, warn, error)
 * - Pretty printing for development
 * - JSON output for production
 * - Sensitive field redaction
 * - File and stdout destinations
 */
import pino, { Logger, LoggerOptions, DestinationStream } from 'pino';
import { createWriteStream } from 'fs';
import type { LoggingConfig } from '../config/index.js';

// =============================================================================
// Types
// =============================================================================

export interface CreateLoggerOptions {
  /** Log level (trace, debug, info, warn, error) */
  level?: 'trace' | 'debug' | 'info' | 'warn' | 'error';
  /** Enable pretty printing for development */
  prettyPrint?: boolean;
  /** Fields to redact from logs */
  redact?: string[];
  /** Destination: 'stdout', file path, or writable stream */
  destination?: string | NodeJS.WritableStream;
}

// =============================================================================
// Logger Factory
// =============================================================================

/**
 * Create a Pino logger with the given options
 */
export function createLogger(options: CreateLoggerOptions = {}): Logger {
  const {
    level = 'info',
    prettyPrint = false,
    redact = ['password', 'apiKey', 'token'],
    destination = 'stdout',
  } = options;

  // Build Pino options
  const pinoOptions: LoggerOptions = {
    level,
    redact: {
      paths: redact,
      censor: '[Redacted]',
    },
  };

  // Configure transport for pretty printing
  if (prettyPrint) {
    pinoOptions.transport = {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
      },
    };
  }

  // Determine destination
  let dest: DestinationStream | undefined;

  if (typeof destination === 'string') {
    if (destination === 'stdout') {
      // Use default stdout
      dest = undefined;
    } else {
      // File path - create write stream
      dest = createWriteStream(destination, { flags: 'a' }) as unknown as DestinationStream;
    }
  } else {
    // Custom writable stream
    dest = destination as unknown as DestinationStream;
  }

  // Create logger
  if (dest) {
    return pino(pinoOptions, dest);
  }
  return pino(pinoOptions);
}

/**
 * Create a logger from Talos configuration
 */
export function createLoggerFromConfig(config?: LoggingConfig): Logger {
  if (!config) {
    return createLogger();
  }

  return createLogger({
    level: config.level,
    prettyPrint: config.prettyPrint,
    redact: config.redact,
    destination: config.destination,
  });
}

// =============================================================================
// Singleton Logger
// =============================================================================

let _logger: Logger | null = null;

/**
 * Get the singleton logger instance
 * Creates with default config if not initialized
 */
export function getLogger(): Logger {
  if (!_logger) {
    _logger = createLogger();
  }
  return _logger;
}

/**
 * Initialize the singleton logger with config
 * Should be called once at application startup
 */
export function initLogger(config?: LoggingConfig): Logger {
  _logger = createLoggerFromConfig(config);
  return _logger;
}

/**
 * Default logger export for convenience
 */
export const logger = getLogger();
