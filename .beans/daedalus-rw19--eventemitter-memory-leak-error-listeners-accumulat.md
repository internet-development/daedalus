---
# daedalus-rw19
title: 'EventEmitter memory leak: error listeners accumulate on PlanningSession'
status: todo
type: bug
created_at: 2026-01-29T18:17:59Z
updated_at: 2026-01-29T18:17:59Z
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

- [ ] Store references to the `error` and `done` listeners so they can be removed
- [ ] Add cleanup for both listeners in the `finally` block (lines 436-442)
- [ ] Verify fix by sending 15+ messages in a planning session without seeing the warning