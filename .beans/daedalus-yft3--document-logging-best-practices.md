---
# daedalus-yft3
title: Document logging best practices
status: todo
type: task
created_at: 2026-01-29T00:26:14Z
updated_at: 2026-01-29T00:26:14Z
parent: daedalus-pvpy
---

Create documentation for logging patterns and best practices in Daedalus.

## Prerequisites
- Logging implemented in components (daedalus-ehqe)

## Deliverables

### 1. Create docs/logging.md

Include:
- Why we use Pino
- Basic usage examples
- Structured logging patterns
- Child logger usage
- Correlation ID pattern
- Configuration options
- Development vs production modes

### 2. Update AGENTS.md

Add logging section:
```markdown
## Logging

Use structured logging with Pino:

```typescript
import { logger } from './talos/logger.js';

// Good: Structured with context
logger.info({ beanId, status }, 'Bean status changed');

// Bad: Unstructured
logger.info(`Bean ${beanId} status: ${status}`);

// Use child loggers for components
const myLogger = logger.child({ component: 'my-component' });
```

### 3. Add Examples

Common patterns:
- Logging bean operations
- Logging errors with context
- Using correlation IDs
- Creating child loggers
- Redacting sensitive data

## Best Practices to Document

1. **Always include context**
   - beanId for bean operations
   - filePath for file operations
   - exitCode for process completion

2. **Use appropriate log levels**
   - debug: Detailed diagnostic info
   - info: General informational messages
   - warn: Warning messages
   - error: Error messages

3. **Log errors properly**
   ```typescript
   logger.error({ err: error, beanId }, 'Operation failed');
   ```

4. **Use child loggers for components**
   ```typescript
   const componentLogger = logger.child({ component: 'scheduler' });
   ```

5. **Wrap operations in context**
   ```typescript
   await withContext({ beanId }, async () => {
     // All logs here include beanId
   });
   ```

## Files to Create/Modify
- `docs/logging.md` (new)
- `AGENTS.md` (update)
- `README.md` (add logging section)

## Acceptance Criteria
- [ ] Logging documentation created
- [ ] Examples are clear and practical
- [ ] Best practices documented
- [ ] Configuration documented
- [ ] AGENTS.md updated with logging guidelines