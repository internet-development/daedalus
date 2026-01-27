---
# daedalus-m31s
title: Talos stop() creates spurious Crash bean
status: todo
type: bug
priority: high
created_at: 2026-01-27T00:09:12Z
updated_at: 2026-01-27T01:06:23Z
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
- [ ] Add `cancelled: boolean` field to `ExitResult` interface
- [ ] Change `cancel()` return type from `Promise<void>` to `Promise<ExitResult>`
- [ ] In cancel(), wait for process exit and return result directly
- [ ] Set `cancelled: true` in the returned result
- [ ] Remove 'close' event listener before killing to prevent 'exit' event emission
- [ ] Reset internal state in cancel() (don't rely on 'close' handler)

### Talos.cancel() changes
- [ ] Remove bean from `inProgress` BEFORE calling cancel
- [ ] Capture result from `await this.runner.cancel()`
- [ ] Revert bean status to 'todo': `updateBeanStatus(beanId, 'todo')`
- [ ] Remove the "Cancelled: ..." bean creation code
- [ ] Remove the `updateBeanTags(beanId, ['failed'])` call
- [ ] Clean up scheduler state (already done)

### Talos.stop() changes  
- [ ] Remove bean from `inProgress` BEFORE calling cancel
- [ ] Capture result from `await this.runner.cancel()`
- [ ] Revert bean status to 'todo'
- [ ] No bean creation

### Verification
- [ ] Test: explicit cancel reverts bean to 'todo', no new beans created
- [ ] Test: stop() reverts bean to 'todo', no new beans created
- [ ] Test: cancelled bean not auto-retried in current session
- [ ] Test: cancelled bean available on next daemon run
- [ ] Test: normal agent exit still works (emits 'exit', completion handler runs)
- [ ] Test: agent crash still creates "Crash: ..." bean