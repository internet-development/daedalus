---
# daedalus-ehqe
title: Add structured logging to daemon components
status: todo
type: task
priority: normal
created_at: 2026-01-29T00:26:01Z
updated_at: 2026-01-29T00:26:19Z
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
- [ ] All console.log replaced with logger calls
- [ ] Structured context included in all logs
- [ ] Component name in all logs (via child logger)
- [ ] Errors logged with full context
- [ ] Correlation IDs work across components
- [ ] Logs are readable in both pretty and JSON modes