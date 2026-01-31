---
# daedalus-8b67
title: Spinner prints wall of text instead of updating in-place
status: todo
type: bug
priority: high
created_at: 2026-01-30T07:45:49Z
updated_at: 2026-01-31T05:51:08Z
parent: daedalus-bmnc
blocking:
    - daedalus-rbhm
    - daedalus-9l4m
---

## Bug

The tool spinner (used for bash_readonly and all tool calls) prints every animation frame on a **new line** instead of updating in-place. This creates a wall of text like:

```
  [Bash] ⠋ git status
  [Bash] ⠙ git status
  [Bash] ⠹ git status
  [Bash] ⠸ git status
  ...dozens more lines...
```

Instead of a single line that animates in-place.

## Root Cause

The `readline.Interface` is created at `src/cli/plan.ts:134` with `output: process.stdout`:

```typescript
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,   // <-- readline intercepts all stdout writes
  history: inputHistory,
  historySize: 1000,
  removeHistoryDuplicates: true,
  completer,
});
```

When readline is active with `output: process.stdout`, it intercepts all writes to stdout for cursor/prompt management. The spinner in `src/cli/spinner.ts` uses `\r` (carriage return) to overwrite the current line in-place, but readline's interception prevents `\r` from working as expected — each frame gets printed on a new line instead.

The spinner code itself is correct (`src/cli/spinner.ts:140-169`). The `\r` in-place update pattern works fine when readline isn't intercepting stdout. The bug is purely a readline + raw stdout write conflict.

## Fix

The fix should follow the same pattern as all other tool calls — the spinner animation needs readline to not interfere with its stdout writes. Options:

1. **Pause readline during streaming** — Call `rl.pause()` before `sendAndStream()` and `rl.resume()` after. Note: `rl.pause()` pauses the input stream; verify it also prevents stdout interception, or use a different approach.
2. **Create readline with a no-op output stream (recommended)** — Pass a dummy writable stream to readline's `output` option and handle the prompt display manually. This prevents readline from ever intercepting stdout. This is the most robust option since it eliminates the class of issues entirely.
3. **Write spinner output to stderr** — Use `process.stderr.write()` for spinner frames so they bypass readline entirely.

Evaluate all three during implementation, but option 2 is recommended as the starting point.

## Affected Files

- `src/cli/plan.ts:134` — readline creation with `output: process.stdout`
- `src/cli/plan.ts:263-454` — `sendAndStream()` function where spinners run
- `src/cli/spinner.ts:140-169` — `createToolSpinner()` (correct code, affected by readline)
- `src/cli/spinner.ts:54-76` — `createSpinner()` thinking spinner (same issue)

## Cross-references

- **daedalus-rbhm** — j/k characters echoing in interactive select (same readline interference root cause, blocked by this bean)
- **daedalus-xjko** — double "Switched to mode" message (related terminal output issue, transitively blocked)
- **daedalus-9l4m** — spinner formatting improvements (blocked by this bean — fix wall-of-text first, then improve formatting)
- **daedalus-imv7** — streaming markdown renderer (also modifies `src/cli/plan.ts` in the streaming/output path at `textHandler` line 303; coordinate to avoid merge conflicts)

## Checklist

- [ ] Reproduce: run a planning session, trigger a tool call (e.g. bash_readonly), observe wall of text
- [ ] Evaluate fix approaches (option 2 recommended) and confirm it integrates with existing readline usage in plan.ts
- [ ] Implement the fix so readline doesn't interfere with spinner stdout writes
- [ ] Verify the thinking spinner ("Thinking...") also updates in-place correctly
- [ ] Verify tool spinner ([Bash] ⠋ git status) updates in-place correctly
- [ ] Verify final checkmark (✓/✗) renders correctly on the same line
- [ ] Verify readline prompt still works correctly after streaming completes
- [ ] Test with multiple consecutive tool calls in a single response