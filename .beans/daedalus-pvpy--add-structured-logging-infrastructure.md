---
# daedalus-pvpy
title: Add structured logging infrastructure
status: completed
type: epic
priority: normal
created_at: 2026-01-28T22:15:35Z
updated_at: 2026-01-29T06:34:05Z
parent: daedalus-5k7n
---

Build a proper logging system to support debugging, monitoring, and development workflows.

## Goal
Replace ad-hoc console.log statements with structured, configurable logging that aids debugging and monitoring.

## Why Logging Infrastructure
- Current debugging relies on scattered console.log statements
- No way to trace operations across async boundaries
- Difficult to debug issues in production-like scenarios
- No structured data for analysis

## Requirements
- Structured logging (JSON format for machine parsing)
- Log levels (debug, info, warn, error, trace)
- Context/correlation IDs for tracing async operations
- Configurable output (console, file, both)
- Integration with talos.yml configuration
- Performance-conscious (minimal overhead in production)

## Design Considerations
- Library choice: pino (fast), winston (features), or built-in
- Context propagation strategy (AsyncLocalStorage?)
- Log rotation and retention policies
- Integration with existing EventEmitter patterns

## Success Criteria
- Logging API is simple and consistent
- Can trace operations across components
- Configurable via talos.yml
- Minimal performance impact
- Easy to use in tests (log capture/assertions)

## Implementation Strategy
Start with core logging utility, then gradually replace console.log statements in key components (scheduler, watcher, agent-runner).

## Checklist
- [ ] Research logging libraries and choose one
- [ ] Design logging API and context strategy
- [ ] Implement core logging utility
- [ ] Add logging configuration to talos.yml schema
- [ ] Create test utilities for log assertions
- [ ] Add logging to 2-3 key components as examples
- [ ] Document logging best practices