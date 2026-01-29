# Logging in Daedalus

Daedalus uses [Pino](https://getpino.io/) for structured logging. This document covers logging patterns, best practices, and configuration.

## Why Pino?

We chose Pino for several reasons:

1. **Performance** - Pino is one of the fastest Node.js loggers, with minimal overhead in production
2. **Structured logging** - JSON output by default, making logs machine-parseable
3. **Child loggers** - Easy to add context that propagates to all subsequent logs
4. **Pretty printing** - Human-readable output for development
5. **Redaction** - Built-in support for hiding sensitive fields

## Basic Usage

### Import the Logger

```typescript
import { logger } from './talos/logger.js';

// Simple logging
logger.info('Application started');
logger.debug('Processing item');
logger.warn('Deprecated feature used');
logger.error('Operation failed');
```

### Structured Logging (Preferred)

Always include context as the first argument:

```typescript
// Good: Structured with context
logger.info({ beanId, status }, 'Bean status changed');
logger.error({ err: error, beanId, operation: 'update' }, 'Failed to update bean');

// Bad: Unstructured string interpolation
logger.info(`Bean ${beanId} status: ${status}`);  // Don't do this
```

Structured logging makes it easy to:
- Filter logs by field values
- Aggregate and analyze logs
- Search for specific operations

## Log Levels

Use appropriate log levels for different types of messages:

| Level | When to Use | Example |
|-------|-------------|---------|
| `trace` | Very detailed diagnostic info | Function entry/exit, loop iterations |
| `debug` | Diagnostic info for debugging | Variable values, state changes |
| `info` | General informational messages | Operation started/completed, status changes |
| `warn` | Warning conditions | Deprecated usage, recoverable errors |
| `error` | Error conditions | Failed operations, exceptions |

```typescript
logger.trace({ args }, 'Entering processBean');
logger.debug({ queueLength: 5 }, 'Current queue state');
logger.info({ beanId }, 'Bean execution started');
logger.warn({ feature: 'oldApi' }, 'Deprecated API used');
logger.error({ err, beanId }, 'Bean execution failed');
```

## Child Loggers

Use child loggers to add persistent context for a component or operation:

```typescript
import { logger } from './talos/logger.js';

// Create a child logger for your component
const componentLogger = logger.child({ component: 'scheduler' });

// All logs from this logger include { component: 'scheduler' }
componentLogger.info('Scheduler started');
componentLogger.debug({ queueSize: 10 }, 'Queue status');
```

### Component Pattern

Each daemon module should create its own child logger:

```typescript
// In scheduler.ts
const log = logger.child({ component: 'scheduler' });

export class Scheduler extends EventEmitter {
  enqueue(bean: Bean) {
    log.info({ beanId: bean.id }, 'Bean enqueued');
  }
}

// In agent-runner.ts
const log = logger.child({ component: 'agent-runner' });

export class AgentRunner extends EventEmitter {
  spawn(bean: Bean) {
    log.info({ beanId: bean.id }, 'Spawning agent');
  }
}
```

## Correlation IDs

Daedalus uses AsyncLocalStorage to automatically inject correlation IDs into logs, enabling tracing across async boundaries.

### Using withContext

```typescript
import { withContext } from './talos/context.js';
import { logger } from './talos/logger.js';

// Wrap an operation in a context
await withContext({ beanId: 'daedalus-abc1' }, async () => {
  // All logs here automatically include beanId and correlationId
  logger.info('Starting bean execution');
  
  await someAsyncOperation();
  
  // Even nested async calls include the context
  logger.info('Bean completed');
});
```

### How It Works

The logger uses a Pino mixin that automatically includes the current execution context:

```typescript
// In logger.ts
mixin() {
  const context = executionContext.getStore();
  return context || {};
}
```

This means every log automatically includes:
- `correlationId` - Unique ID for tracing the operation
- `beanId` - If set in the context
- `component` - If set in the context

### Getting Current Context

```typescript
import { getContext } from './talos/context.js';

const ctx = getContext();
console.log(ctx.correlationId);  // Current correlation ID
console.log(ctx.beanId);         // Current bean ID (if set)
```

## Logging Errors

Always log errors with the `err` key for proper serialization:

```typescript
try {
  await riskyOperation();
} catch (error) {
  // Good: Use 'err' key for error objects
  logger.error({ err: error, beanId, operation: 'riskyOperation' }, 'Operation failed');
}
```

Pino automatically extracts:
- Error message
- Stack trace
- Error name/type

## Redacting Sensitive Data

The logger automatically redacts sensitive fields:

```typescript
// These fields are redacted by default
logger.info({ password: 'secret123' }, 'User login');
// Output: { password: '[Redacted]', msg: 'User login' }

logger.info({ apiKey: 'sk-xxx' }, 'API call');
// Output: { apiKey: '[Redacted]', msg: 'API call' }
```

Default redacted fields:
- `password`
- `apiKey`
- `token`
- `secret` (if configured)

Configure additional fields in `talos.yml`:

```yaml
logging:
  redact:
    - password
    - apiKey
    - token
    - secret
    - credentials
```

## Configuration

Configure logging in `talos.yml`:

```yaml
logging:
  # Log level: trace, debug, info, warn, error
  level: info
  
  # Pretty print for development (human-readable output)
  prettyPrint: true
  
  # Fields to redact from logs
  redact:
    - password
    - apiKey
    - token
  
  # Destination: stdout or file path
  destination: stdout
```

### Development vs Production

**Development** (`prettyPrint: true`):
```
[12:34:56] INFO (scheduler): Bean enqueued
    beanId: "daedalus-abc1"
    correlationId: "abc123xyz"
```

**Production** (`prettyPrint: false`):
```json
{"level":30,"time":1234567890,"component":"scheduler","beanId":"daedalus-abc1","correlationId":"abc123xyz","msg":"Bean enqueued"}
```

### Log to File

```yaml
logging:
  destination: .talos/logs/talos.log
```

## Programmatic Configuration

For testing or custom setups:

```typescript
import { createLogger, initLogger } from './talos/logger.js';

// Create a custom logger
const customLogger = createLogger({
  level: 'debug',
  prettyPrint: true,
  redact: ['password', 'secret'],
  destination: 'stdout',
});

// Or initialize the singleton with config
initLogger({
  level: 'debug',
  prettyPrint: true,
});
```

## Best Practices Summary

1. **Always include context** - Use structured logging with relevant fields
2. **Use appropriate levels** - Don't log everything at `info`
3. **Create child loggers** - One per component for automatic context
4. **Use correlation IDs** - Wrap operations with `withContext`
5. **Log errors properly** - Use `{ err: error }` for error objects
6. **Don't log sensitive data** - Configure redaction for secrets
7. **Be concise** - Log messages should be short and descriptive

## Common Patterns

### Bean Operations

```typescript
const log = logger.child({ component: 'bean-processor' });

async function processBean(bean: Bean) {
  await withContext({ beanId: bean.id }, async () => {
    log.info({ status: bean.status }, 'Processing bean');
    
    try {
      await execute(bean);
      log.info('Bean completed successfully');
    } catch (error) {
      log.error({ err: error }, 'Bean processing failed');
      throw error;
    }
  });
}
```

### File Operations

```typescript
log.debug({ filePath, operation: 'read' }, 'Reading file');
log.info({ filePath, bytesWritten: 1024 }, 'File written');
log.error({ err, filePath }, 'Failed to read file');
```

### Process Lifecycle

```typescript
log.info({ pid: process.pid }, 'Agent spawned');
log.info({ exitCode: 0, duration: 5000 }, 'Agent completed');
log.error({ exitCode: 1, signal: 'SIGTERM' }, 'Agent terminated');
```

### Queue Operations

```typescript
log.debug({ queueSize: queue.length }, 'Queue status');
log.info({ beanId, position: 3 }, 'Bean added to queue');
log.info({ beanId }, 'Bean dequeued for processing');
```
