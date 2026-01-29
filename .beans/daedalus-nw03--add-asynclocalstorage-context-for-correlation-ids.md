---
# daedalus-nw03
title: Add AsyncLocalStorage context for correlation IDs
status: in-progress
type: task
priority: normal
created_at: 2026-01-29T00:25:47Z
updated_at: 2026-01-29T06:19:51Z
parent: daedalus-pvpy
blocking:
    - daedalus-ehqe
---

Implement AsyncLocalStorage pattern for automatic correlation ID and context injection in logs.

## Prerequisites
- Pino installed and configured (daedalus-miti)

## Purpose
Enable tracing of operations across async boundaries by automatically including:
- correlationId: Unique ID for each operation/request
- beanId: Current bean being processed
- component: Which part of the system is logging

## Implementation

### 1. Create Context Module
Create `src/talos/context.ts`:
```typescript
import { AsyncLocalStorage } from 'async_hooks';
import { nanoid } from 'nanoid';

interface ExecutionContext {
  correlationId: string;
  beanId?: string;
  component?: string;
}

export const executionContext = new AsyncLocalStorage<ExecutionContext>();

export function withContext<T>(
  context: Partial<ExecutionContext>,
  fn: () => Promise<T>
): Promise<T> {
  const correlationId = context.correlationId || nanoid();
  return executionContext.run({ correlationId, ...context }, fn);
}
```

### 2. Update Logger with Mixin
Modify `src/talos/logger.ts`:
```typescript
import { executionContext } from './context.js';

const logger = pino({
  // ... other config
  mixin() {
    const context = executionContext.getStore();
    return context || {};
  },
});
```

### 3. Usage Pattern
```typescript
import { withContext } from './context.js';
import { logger } from './logger.js';

// All logs within this context automatically include correlationId and beanId
await withContext({ beanId: 'daedalus-abc1' }, async () => {
  logger.info('Starting bean execution');
  await processBean();
  logger.info('Bean completed');
});
```

## Files to Create/Modify
- `src/talos/context.ts` (new)
- `src/talos/logger.ts` (update with mixin)
- `package.json` (add nanoid dependency)

## Testing
- [x] Create context and verify correlationId in logs
- [x] Verify beanId propagates through async calls
- [x] Verify nested contexts work correctly
- [x] Test context isolation between concurrent operations

## Acceptance Criteria
- [x] AsyncLocalStorage context module created
- [x] Logger automatically includes context in all logs
- [x] correlationId generated for each operation
- [x] beanId and component propagate correctly
- [x] Works with async/await and promises
- [x] No context leaks between operations

## Changelog

### Implemented
- Created `src/talos/context.ts` with AsyncLocalStorage-based execution context
- Added `withContext()` helper for wrapping async operations with context
- Added `getContext()` helper for safely accessing current context
- Updated `src/talos/logger.ts` with Pino mixin for automatic context injection
- Exported context module from `src/talos/index.ts`
- Added nanoid as direct dependency for correlation ID generation

### Files Modified
- `src/talos/context.ts` - NEW: AsyncLocalStorage context module
- `src/talos/context.test.ts` - NEW: 12 tests for context module
- `src/talos/logger.ts` - Added mixin for automatic context injection
- `src/talos/logger.test.ts` - Added 6 tests for context mixin integration
- `src/talos/index.ts` - Exported context module
- `package.json` - Added nanoid dependency

### Deviations from Spec
- None - implementation follows spec exactly

### Decisions Made
- Added `getContext()` helper (not in spec) for convenient access to context without handling undefined
- Used Pino's mixin feature as specified for automatic context injection

### Known Limitations
- None - all acceptance criteria met