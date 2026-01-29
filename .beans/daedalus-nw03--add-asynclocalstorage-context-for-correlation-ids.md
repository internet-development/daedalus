---
# daedalus-nw03
title: Add AsyncLocalStorage context for correlation IDs
status: todo
type: task
priority: normal
created_at: 2026-01-29T00:25:47Z
updated_at: 2026-01-29T00:26:19Z
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
- [ ] Create context and verify correlationId in logs
- [ ] Verify beanId propagates through async calls
- [ ] Verify nested contexts work correctly
- [ ] Test context isolation between concurrent operations

## Acceptance Criteria
- [ ] AsyncLocalStorage context module created
- [ ] Logger automatically includes context in all logs
- [ ] correlationId generated for each operation
- [ ] beanId and component propagate correctly
- [ ] Works with async/await and promises
- [ ] No context leaks between operations