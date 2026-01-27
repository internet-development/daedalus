---
# daedalus-m31s
title: Talos stop() creates spurious Crash bean
status: in-progress
type: bug
priority: high
created_at: 2026-01-27T00:09:12Z
updated_at: 2026-01-27T01:19:17Z
parent: daedalus-kfjn
blocking:
    - daedalus-uool
---

## Problem

Two issues with cancellation:

1. **Double bean on explicit cancel**: When user presses 'c', BOTH a "Crash: ..." bean AND a "Cancelled: ..." bean are created
2. **Spurious crash bean on shutdown**: When `talos.stop()` is called, a "Crash: ..." bean is created even though it's a clean shutdown

## Solution

Change `runner.cancel()` to return `ExitResult` directly instead of emitting 'exit' event. Caller handles result explicitly.

**Behavior on cancel/stop:**
- Revert bean to 'todo' status
- No crash/cancelled beans created
- Remove from scheduler queue (no auto-retry in current session)
- User can manually retry with 'r' key
- Available for pickup on next daemon run

## Affected Files

- `src/talos/agent-runner.ts`
- `src/talos/talos.ts`

## Checklist

### AgentRunner changes
- [x] Add `cancelled: boolean` field to `ExitResult` interface
- [x] Change `cancel()` return type from `Promise<void>` to `Promise<ExitResult>`
- [x] In cancel(), wait for process exit and return result directly
- [x] Set `cancelled: true` in the returned result
- [x] Remove 'close' event listener before killing to prevent 'exit' event emission
- [x] Reset internal state in cancel() (don't rely on 'close' handler)

### Talos.cancel() changes
- [x] Remove bean from `inProgress` BEFORE calling cancel
- [x] Capture result from `await this.runner.cancel()`
- [x] Revert bean status to 'todo': `updateBeanStatus(beanId, 'todo')`
- [x] Remove the "Cancelled: ..." bean creation code
- [x] Remove the `updateBeanTags(beanId, ['failed'])` call
- [x] Clean up scheduler state (already done)

### Talos.stop() changes  
- [x] Remove bean from `inProgress` BEFORE calling cancel
- [x] Capture result from `await this.runner.cancel()`
- [x] Revert bean status to 'todo'
- [x] No bean creation

### Verification
- [x] Test: explicit cancel reverts bean to 'todo', no new beans created
- [x] Test: stop() reverts bean to 'todo', no new beans created
- [x] Test: cancelled bean not auto-retried in current session
- [x] Test: cancelled bean available on next daemon run
- [x] Test: normal agent exit still works (emits 'exit', completion handler runs)
- [x] Test: agent crash still creates "Crash: ..." bean