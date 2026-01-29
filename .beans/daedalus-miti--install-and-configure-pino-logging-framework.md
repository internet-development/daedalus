---
# daedalus-miti
title: Install and configure Pino logging framework
status: in-progress
type: task
priority: normal
created_at: 2026-01-29T00:25:34Z
updated_at: 2026-01-29T06:09:20Z
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
- [x] Pino installed and working
- [x] Config schema includes logging section
- [x] Logger module exports configured instance
- [x] Pretty printing works in dev mode
- [x] JSON output works in production mode
- [x] Redaction works for sensitive fields
- [x] Can set log level via config

## Example Usage
```typescript
import { logger } from './talos/logger.js';

logger.info({ beanId: 'abc' }, 'Bean scheduled');
logger.error({ err: error }, 'Failed');
```

## Changelog

### Implemented
- Installed pino and pino-pretty npm packages
- Added LoggingConfigSchema to src/config/index.ts with level, prettyPrint, redact, and destination fields
- Created src/talos/logger.ts with createLogger, createLoggerFromConfig, initLogger, getLogger, and singleton logger export
- Added logging section to talos.yml with development-friendly defaults (prettyPrint: true)
- Added comprehensive test suite in src/talos/logger.test.ts (9 tests)
- Exported logger functions from src/talos/index.ts

### Files Modified
- `package.json` - Added pino and pino-pretty dependencies
- `src/config/index.ts` - Added LoggingConfigSchema and exports
- `src/config/index.test.ts` - Added logging configuration tests (6 new tests)
- `src/talos/logger.ts` - NEW: Pino-based logger module
- `src/talos/logger.test.ts` - NEW: Logger test suite
- `src/talos/index.ts` - Added logger exports
- `talos.yml` - Added logging configuration section

### Deviations from Spec
- Added 'trace' log level (spec only mentioned debug/info/warn/error) - Pino supports trace and it's useful for detailed debugging
- Schema uses `.default({})` instead of `.optional()` - ensures logging config always exists with defaults
- Added singleton pattern (getLogger, initLogger) not in original spec - provides convenient global logger access

### Decisions Made
- Used pino's built-in redaction with `[Redacted]` censor string for clarity
- Pretty printing uses pino-pretty transport with colorize and human-readable timestamps
- File destination uses append mode ('a' flag) to preserve existing logs
- Default redact paths include 'password', 'apiKey', 'token' per spec, added 'secret' in talos.yml

### Known Limitations
- Pretty printing is async (uses pino-pretty transport) so output may appear slightly delayed
- File destination doesn't support log rotation - would need external tool like logrotate
- No support for multiple destinations (e.g., stdout AND file) - would require pino.multistream