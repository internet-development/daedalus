---
# daedalus-miti
title: Install and configure Pino logging framework
status: todo
type: task
priority: normal
created_at: 2026-01-29T00:25:34Z
updated_at: 2026-01-29T00:26:22Z
parent: daedalus-pvpy
blocking:
    - daedalus-nw03
    - daedalus-ehqe
---

Install Pino and pino-pretty, configure for development and production modes.

## Prerequisites
- Research completed (daedalus-99yj) ✓

## Tasks

### 1. Install Dependencies
```bash
npm install pino pino-pretty
```

### 2. Add Logging Config to talos.yml Schema
Update `src/config/index.ts`:
```typescript
logging: z.object({
  level: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  prettyPrint: z.boolean().default(false),
  redact: z.array(z.string()).default(['password', 'apiKey', 'token']),
  destination: z.string().default('stdout'),
}).optional(),
```

### 3. Create Logger Module
Create `src/talos/logger.ts`:
- Load config from talos.yml
- Create base logger with redaction
- Support pretty printing for dev mode
- Export singleton logger instance

### 4. Test Configuration
- Test with prettyPrint: true (development)
- Test with prettyPrint: false (production JSON)
- Test redaction works for sensitive fields
- Test different log levels

## Files to Create/Modify
- `src/talos/logger.ts` (new)
- `src/config/index.ts` (update schema)
- `talos.yml` (add logging section)
- `package.json` (dependencies)

## Acceptance Criteria
- [ ] Pino installed and working
- [ ] Config schema includes logging section
- [ ] Logger module exports configured instance
- [ ] Pretty printing works in dev mode
- [ ] JSON output works in production mode
- [ ] Redaction works for sensitive fields
- [ ] Can set log level via config

## Example Usage
```typescript
import { logger } from './talos/logger.js';

logger.info({ beanId: 'abc' }, 'Bean scheduled');
logger.error({ err: error }, 'Failed');
```