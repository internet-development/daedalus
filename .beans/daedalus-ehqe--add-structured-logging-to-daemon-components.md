---
# daedalus-ehqe
title: Add structured logging to daemon components
status: in-progress
type: task
priority: normal
created_at: 2026-01-29T00:26:01Z
updated_at: 2026-01-29T06:23:41Z
parent: daedalus-pvpy
blocking:
    - daedalus-yft3
---

Replace console.log statements with structured Pino logging in scheduler, watcher, and agent-runner.

## Prerequisites
- Pino configured (daedalus-miti)
- AsyncLocalStorage context ready (daedalus-nw03)

## Components to Update

### 1. Scheduler (src/talos/scheduler.ts)
Replace console.log with:
```typescript
import { logger } from './logger.js';

const schedulerLogger = logger.child({ component: 'scheduler' });

// Log bean scheduling
schedulerLogger.info({ 
  beanId, 
  priority, 
  status 
}, 'Bean scheduled for execution');

// Log dependency resolution
schedulerLogger.debug({ 
  beanId, 
  blockedBy 
}, 'Checking dependencies');
```

### 2. Watcher (src/talos/watcher.ts)
```typescript
import { logger } from './logger.js';

const watcherLogger = logger.child({ component: 'watcher' });

// Log file changes
watcherLogger.info({ 
  filePath, 
  eventType 
}, 'File change detected');

// Log bean updates
watcherLogger.info({ 
  beanId, 
  changes 
}, 'Bean updated');
```

### 3. Agent Runner (src/talos/agent-runner.ts)
```typescript
import { logger } from './logger.js';
import { withContext } from './context.js';

const agentLogger = logger.child({ component: 'agent-runner' });

// Wrap execution in context
await withContext({ beanId }, async () => {
  agentLogger.info({ command, args }, 'Spawning agent');
  
  // ... spawn process
  
  agentLogger.info({ 
    exitCode, 
    duration 
  }, 'Agent execution completed');
});
```

## Migration Pattern

### Before:
```typescript
console.log('Bean scheduled:', beanId);
console.error('Error:', error);
```

### After:
```typescript
logger.info({ beanId }, 'Bean scheduled');
logger.error({ err: error, beanId }, 'Error occurred');
```

## Key Logging Events

### Scheduler
- Bean scheduled
- Bean dequeued for execution
- Dependencies resolved
- Priority adjusted

### Watcher
- File change detected
- Bean file created/updated/deleted
- Watch started/stopped

### Agent Runner
- Agent spawned
- Agent output received
- Agent completed/failed
- Timeout triggered

## Files to Modify
- `src/talos/scheduler.ts`
- `src/talos/watcher.ts`
- `src/talos/agent-runner.ts`

## Acceptance Criteria
- [x] All console.log replaced with logger calls
- [x] Structured context included in all logs
- [x] Component name in all logs (via child logger)
- [x] Errors logged with full context
- [x] Correlation IDs work across components
- [x] Logs are readable in both pretty and JSON modes

## Changelog

### Implemented
- Added structured Pino logging to scheduler.ts with child logger `{ component: 'scheduler' }`
- Added structured Pino logging to watcher.ts with child logger `{ component: 'watcher' }`
- Added structured Pino logging to agent-runner.ts with child logger `{ component: 'agent-runner' }`
- Wrapped agent execution in `withContext()` for automatic correlation ID propagation
- Created comprehensive test suite for daemon component logging patterns

### Files Modified
- `src/talos/scheduler.ts` - Added logging for enqueue, dequeue, start/stop, in-progress, complete, stuck, dependency checks
- `src/talos/watcher.ts` - Added logging for start/stop, file changes, bean create/update/delete, status/tag changes
- `src/talos/agent-runner.ts` - Added logging for spawn, completion, errors, cancellation with context wrapping
- `src/talos/daemon-logging.test.ts` - NEW: Test suite for daemon component logging patterns

### Deviations from Spec
- Used `getLogger()` instead of direct `logger` import (follows singleton pattern established in daedalus-miti)
- File change detection logged at debug level instead of info (reduces noise in production)
- Bean updates logged at debug level, only status/tag changes at info level (more practical)

### Decisions Made
- Log levels chosen based on operational importance:
  - `info`: Start/stop, bean lifecycle events (enqueue, complete, stuck), agent spawn/exit
  - `debug`: Dependency checks, file changes, skipped beans, internal state
  - `warn`: Stuck beans, force kill after grace period
  - `error`: All error conditions with full context
- Agent runner wraps entire `run()` method in `withContext()` for correlation ID propagation

### Known Limitations
- No console.log statements existed in these files to replace (they were already clean)
- Agent output events are not logged (would be too verbose, emitted via EventEmitter instead)