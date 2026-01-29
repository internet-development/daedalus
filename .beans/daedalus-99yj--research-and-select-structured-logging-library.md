---
# daedalus-99yj
title: Research and select structured logging library
status: completed
type: task
priority: high
created_at: 2026-01-29T00:20:31Z
updated_at: 2026-01-29T00:25:22Z
parent: daedalus-pvpy
blocking:
    - daedalus-qkep
---

# Research Complete: Pino Selected

## Decision: Use Pino

After comprehensive research, **Pino is the clear choice** for Daedalus v2 daemon logging.

## Key Findings

### Performance (Most Critical)
- Pino: ~50,000 ops/sec
- Winston: ~10,000 ops/sec (5x slower)
- For 24/7 daemon, this compounds significantly

### Structured Logging
- ✅ JSON by default (no configuration needed)
- ✅ Fast JSON serialization
- ✅ Built-in redaction for secrets

### TypeScript/ES Modules
- ✅ Excellent TypeScript support
- ✅ Native ES module compatibility
- ✅ Works with "type": "module"

### Developer Experience
- ✅ pino-pretty for development
- ✅ Simple API
- ✅ Child loggers with context

### Production Ready
- ✅ Used by Fastify framework
- ✅ 17.3k GitHub stars, 5.4M weekly downloads
- ✅ Active maintenance

### Go Migration Path
- ✅ Structured JSON translates well
- ✅ Similar to Go's zap/zerolog libraries

## Comparison Matrix

| Feature | Pino | Winston | Built-in |
|---------|------|---------|----------|
| Performance | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ |
| Structured | ✅ Default | ⚠️ Config | ❌ |
| TypeScript | ✅ Excellent | ✅ Good | ✅ |
| ES Modules | ✅ Native | ✅ Yes | ✅ |
| Child Loggers | ✅ | ✅ | ❌ |
| Redaction | ✅ Built-in | ⚠️ Manual | ❌ |

## Tradeoffs Accepted

- ❌ No source file/line logging (by design for performance)
  - Mitigation: Use component names and structured context
- ❌ Slightly less popular than Winston
  - Not a concern: Still widely used and well-maintained

## Implementation Plan

### 1. Configuration in talos.yml
```yaml
logging:
  level: info
  prettyPrint: false
  redact: [password, apiKey, token]
  destination: stdout
```

### 2. Logger Setup
- Create src/talos/logger.ts
- Load config from talos.yml
- Support pretty printing for dev
- Support JSON for production

### 3. AsyncLocalStorage for Correlation IDs
- Use Node's AsyncLocalStorage
- Automatically include correlationId and beanId in all logs
- Trace operations across async boundaries

### 4. Migration Strategy
- Replace console.log → logger.info
- Replace console.error → logger.error
- Add structured context (beanId, component, etc.)

## Next Steps

Implementation tasks created:
1. Install and configure Pino
2. Create logger module with AsyncLocalStorage
3. Add logging to scheduler, watcher, agent-runner
4. Document logging best practices

## Sources
- Pino docs: https://getpino.io
- Benchmarks: https://github.com/pinojs/pino/blob/master/docs/benchmarks.md
- Better Stack comparison: https://betterstack.com/community/guides/logging/best-nodejs-logging-libraries/