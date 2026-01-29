---
# daedalus-yft3
title: Document logging best practices
status: completed
type: task
priority: normal
created_at: 2026-01-29T00:26:14Z
updated_at: 2026-01-29T06:32:51Z
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
- [x] Logging documentation created
- [x] Examples are clear and practical
- [x] Best practices documented
- [x] Configuration documented
- [x] AGENTS.md updated with logging guidelines

## Changelog

### Implemented
- Created comprehensive logging documentation at `docs/logging.md`
- Updated AGENTS.md with logging section and best practices
- Added logging.md to README.md documentation table

### Files Modified
- `docs/logging.md` - NEW: Comprehensive logging documentation
- `AGENTS.md` - Added Logging section with examples and key patterns
- `README.md` - Added logging.md to documentation table

### Deviations from Spec
- None - all deliverables implemented as specified

### Decisions Made
- Organized docs/logging.md with clear sections: Why Pino, Basic Usage, Log Levels, Child Loggers, Correlation IDs, Logging Errors, Redaction, Configuration, Best Practices Summary, Common Patterns
- Included practical code examples for each pattern
- Added a table for log levels with when-to-use guidance
- Included both development and production output examples

### Known Limitations
- None