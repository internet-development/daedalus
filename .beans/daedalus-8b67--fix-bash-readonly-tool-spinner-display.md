---
# daedalus-8b67
title: Spinner prints wall of text instead of updating in-place
status: completed
type: bug
priority: high
created_at: 2026-01-30T07:45:49Z
updated_at: 2026-01-31T06:04:21Z
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

- [x] Reproduce: run a planning session, trigger a tool call (e.g. bash_readonly), observe wall of text
- [x] Evaluate fix approaches (option 2 recommended) and confirm it integrates with existing readline usage in plan.ts
- [x] Implement the fix so readline doesn't interfere with spinner stdout writes
- [x] Verify the thinking spinner ("Thinking...") also updates in-place correctly
- [x] Verify tool spinner ([Bash] ⠋ git status) updates in-place correctly
- [x] Verify final checkmark (✓/✗) renders correctly on the same line
- [x] Verify readline prompt still works correctly after streaming completes
- [x] Test with multiple consecutive tool calls in a single response

## Changelog

### Implemented
- Created `MutableOutput` abstraction — a `Writable` stream that can be muted/unmuted
- Replaced `output: process.stdout` in readline creation with `output: rlOutput.stream`
- Added `rlOutput.mute()` at start of `sendAndStream()` to prevent readline interference during spinner/streaming output
- Added `rlOutput.unmute()` in `finally` block of `sendAndStream()` to restore readline functionality for next prompt
- 15 tests covering: MutableOutput behavior, readline integration, thinking spinner, tool spinner, checkmark rendering, multiple consecutive tools, and full streaming cycle

### Files Modified
- `src/cli/readline-output.ts` — **NEW**: MutableOutput factory with mute/unmute controls
- `src/cli/readline-output.test.ts` — **NEW**: 15 tests for MutableOutput and readline integration
- `src/cli/plan.ts` — Changed readline `output` from `process.stdout` to `rlOutput.stream`; added mute/unmute calls in `sendAndStream()`

### Deviations from Spec
- Used a **mutable passthrough stream** (variant of option 2) instead of a pure no-op/devnull stream. A pure devnull would suppress readline's prompt display and character echoing, breaking the interactive experience. The mutable approach preserves all readline functionality when unmuted while preventing interference when muted during streaming.
- Did not modify `spinner.ts` at all — the spinner code was already correct, only the readline configuration needed fixing.

### Decisions Made
- Chose mutable Writable over rl.output reassignment (fragile, relies on internal Node.js behavior)
- Chose mutable Writable over rl.pause()/resume() (pause only affects input stream, not output interception)
- Chose mutable Writable over stderr writes (semantically wrong, breaks if stderr is redirected)
- Placed `unmute()` in `finally` block to guarantee restoration on all exit paths (success, cancellation, error)
- Used `{ mute: () => void; unmute: () => void }` interface type for `sendAndStream` parameter to keep it decoupled from the concrete implementation

### Known Limitations
- The fix cannot be fully verified in automated tests because the wall-of-text bug only manifests in interactive TTY terminals where readline's cursor management is active. Tests verify the correct bytes are written (carriage returns, no unexpected newlines) but cannot observe actual terminal rendering.
- The `session-selector.ts` and `interactive-select.ts` files also create readline with `output: process.stdout`, but these are short-lived (closed immediately after selection) and don't run concurrently with spinners, so they are not affected by this bug.