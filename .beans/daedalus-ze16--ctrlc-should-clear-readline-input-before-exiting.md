---
# daedalus-ze16
title: Ctrl+C should clear readline input before exiting
status: in-progress
type: bug
priority: normal
created_at: 2026-01-29T21:11:07Z
updated_at: 2026-01-29T22:10:59Z
---

## Problem

When pressing Ctrl+C on the readline input, the application exits immediately regardless of whether there is text in the input buffer. This is jarring — the user may have been typing and just wants to clear the line, not exit.

## Expected Behavior

1. **First Ctrl+C with text in input**: Clear the current input line and re-prompt (like bash)
2. **Second Ctrl+C with empty input**: Exit the application (existing cleanup behavior)

## Current Behavior

Ctrl+C always triggers the SIGINT handler which calls `cleanup()` and exits (unless streaming or in multi-line mode).

## Root Cause

The SIGINT handler in `setupSignalHandlers()` (`src/cli/plan.ts` lines ~486-499) checks for streaming and multi-line mode but doesn't check if readline has text in the buffer.

## Solution

Check `rl.line` (the current input buffer) in the SIGINT handler. If it has content, clear the line and re-prompt instead of exiting.

## Implementation

### Files to Modify
- `src/cli/plan.ts` — Update SIGINT handler in `setupSignalHandlers()` to check `rl.line`

### Updated SIGINT Handler

```typescript
// Handle Ctrl+C - cancels stream, multi-line input, clears line, or exits
process.on('SIGINT', () => {
  if (ctx.session.isStreaming()) {
    // Mark as cancelled - sendAndStream will handle the output
    markCancelled();
    ctx.session.cancel();
    // Don't print anything here - let sendAndStream handle it cleanly
  } else if (isMultilineMode()) {
    cancelMultiline();
    // Re-prompt will happen in the main loop
  } else if ((rl as any).line && (rl as any).line.length > 0) {
    // Clear current input line and re-prompt (like bash)
    // rl.line is undocumented but stable — tracks current input buffer
    process.stdout.write('\n');
    rl.write(null, { ctrl: true, name: 'u' }); // Clear line buffer
    rl.prompt(); // Re-show prompt
  } else {
    cleanup();
  }
});
```

Note: `rl.line` is not in Node.js's public API typings, so we cast to `any`. This is a widely-used pattern in Node.js CLI tools and has been stable across all Node.js versions.

### UX Flow

```
> Hello, I was typing something^C
>                                    ← line cleared, fresh prompt
> ^C                                 ← empty input, exits
Generating session name...
```

## Checklist

- [x] Update SIGINT handler in `setupSignalHandlers()` (`src/cli/plan.ts`):
  - [x] Add `rl.line` check after multi-line mode check
  - [x] If `rl.line` has content: print newline, clear buffer with `rl.write(null, { ctrl: true, name: 'u' })`, re-prompt
  - [x] If `rl.line` is empty: proceed with existing `cleanup()` exit
- [x] Typecheck passes
- [ ] Manual testing:
  - [ ] Type text, Ctrl+C clears the line and shows fresh prompt
  - [ ] Ctrl+C on empty input exits the application
  - [ ] Ctrl+C during streaming still cancels stream (existing behavior)
  - [ ] Ctrl+C during multi-line input still cancels multi-line (existing behavior)

## Design Decisions

**Why `rl.line` (undocumented)?**
- It's the only way to check readline's current input buffer
- Widely used in Node.js CLI tools, stable across all versions
- Alternative (tracking input state ourselves) is over-engineering for this use case
- Cast to `any` to avoid TypeScript errors

**Why `process.stdout.write('\n')` before clearing?**
- The `^C` is echoed by the terminal on the current line
- Newline moves to a fresh line before showing the new prompt
- Matches bash behavior

**Why `rl.prompt()` instead of relying on the main loop?**
- The SIGINT handler fires outside the main loop's `await question()` flow
- `rl.prompt()` re-displays the prompt immediately without disrupting the pending question
- The main loop's `question()` call is still waiting — the next Enter will resolve it

## Changelog

### Implemented
- Added `rl.line` check to SIGINT handler in `setupSignalHandlers()` so Ctrl+C clears the input line when text is present, and only exits on empty input

### Files Modified
- `src/cli/plan.ts` — Added `else if` branch checking `(rl as any).line` in the SIGINT handler (lines ~496-501)

### Deviations from Spec
- None — implementation matches the spec exactly

### Decisions Made
- Used the exact approach from the bean spec: `rl.write(null, { ctrl: true, name: 'u' })` to clear the buffer, `rl.prompt()` to re-display

### Known Limitations
- Manual testing checklist items cannot be verified in this automated context — requires human verification

## Related Beans

None — standalone bug fix.
