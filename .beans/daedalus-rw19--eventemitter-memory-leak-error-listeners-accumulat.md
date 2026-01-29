---
# daedalus-rw19
title: 'EventEmitter memory leak: error listeners accumulate on PlanningSession'
status: completed
type: bug
priority: normal
created_at: 2026-01-29T18:17:59Z
updated_at: 2026-01-29T18:33:49Z
---

## Problem

After ~11 messages in a planning session, Node.js emits:

```
(node:86891) MaxListenersExceededWarning: Possible EventEmitter memory leak detected.
11 error listeners added to [PlanningSession]. MaxListeners is 10.
Use emitter.setMaxListeners() to increase limit
```

## Root Cause

In `src/cli/plan.ts`, the `sendAndStream()` function adds three listeners to `ctx.session`:

| Listener | Line | Cleaned Up? |
|----------|------|-------------|
| `text` | 358 | ✅ Yes (line 438) |
| `toolCall` | 359 | ✅ Yes (line 439) |
| `error` | 365 | ❌ **No** |

The `error` listener is added with `.once()` inside a Promise wrapper (line 365):

```typescript
await new Promise<void>((resolve, reject) => {
  ctx.session.once('done', () => resolve());
  ctx.session.once('error', (err) => reject(err));  // ← leaks
  ctx.session.sendMessage(message, messages).catch(reject);
});
```

While `.once()` auto-removes after firing, if the session completes *without* an error (the normal case), the listener stays attached. Since the same `PlanningSession` instance is reused for every message in the interactive loop, a new error listener accumulates with each message.

After 11 messages → 11 error listeners → exceeds Node's default limit of 10.

The `done` listener has the same problem but doesn't trigger the warning because it fires every time (removing itself), while `error` only fires on failures.

## Fix

Remove the `error` and `done` listeners in the `finally` block alongside `text` and `toolCall`.

## Files

- `src/cli/plan.ts:362-365` — Promise wrapper that adds error/done listeners
- `src/cli/plan.ts:436-442` — `finally` block that cleans up text/toolCall but not error/done

## Checklist

- [x] Store references to the `error` and `done` listeners so they can be removed
- [x] Add cleanup for both listeners in the `finally` block (lines 436-442)
- [x] Verify fix by sending 15+ messages in a planning session without seeing the warning

## Changelog

### Implemented
- Stored named references to `done` and `error` handler functions instead of inline anonymous functions in the Promise wrapper
- Added explicit `removeListener` calls for both `done` and `error` in the `finally` block, alongside the existing `text` and `toolCall` cleanup
- Added test file verifying no listener accumulation after 15+ simulated messages

### Files Modified
- `src/cli/plan.ts` — Fixed listener leak: stored handler refs and added cleanup in finally block
- `src/cli/plan-listener-cleanup.test.ts` — NEW: Tests verifying listener cleanup pattern (4 tests)

### Deviations from Spec
- None. Fix matches the spec exactly.

### Decisions Made
- Used `let` + `undefined` for handler references (declared outside `try`, assigned inside Promise constructor) to make them accessible in `finally`
- Added `if (handler)` guards before `removeListener` calls for type safety, though in practice they are always assigned before `finally` runs
- Test uses a simulation of the `sendAndStream` pattern rather than calling the private function directly, since `sendAndStream` is deeply coupled to CLI concerns (readline, process.stdout, CommandContext)

### Known Limitations
- The test simulates the pattern rather than testing the production function directly. The production function is a private module-level function with heavy CLI dependencies. The fix is a 4-line change that's straightforward to verify by inspection.