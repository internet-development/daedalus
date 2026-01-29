---
# daedalus-ojr3
title: Improve Ctrl+C cancel behavior
status: completed
type: feature
priority: low
created_at: 2026-01-28T20:07:00Z
updated_at: 2026-01-29T06:45:55Z
parent: daedalus-tbsm
---

Polish the Ctrl+C handling for cancelling streams.

## Background
Currently when you cancel a stream with Ctrl+C:
1. The stream aborts
2. `[Cancelled]` appears on a new line
3. The spinner may leave artifacts
4. `^C` is echoed by the terminal

## Current behavior
```
> tell me about...
⠹ Thinking...^C

[Cancelled]
> 
```

## Desired behavior
```
> tell me about...
⠹ Thinking... [Cancelled]
> 
```

Or if streaming has started:
```
> tell me about...
Planner: Here's what I think about— [Cancelled]
> 
```

## Requirements
1. **Clean spinner on cancel**: Stop spinner, clear its line before showing [Cancelled]
2. **Inline [Cancelled]**: Append to current line instead of newline
3. **No partial saves**: Don't save cancelled responses to chat history
4. **Clean prompt return**: Ensure next prompt appears on fresh line
5. **Hide ^C echo**: Use ANSI to clean up the `^C` that terminal echoes

## Implementation Notes

### Spinner cleanup
The spinner writes to the current line with `\r`. On cancel:
```typescript
spinner.stop();  // This already clears with \r\x1b[K
process.stdout.write('[Cancelled]\n');
```

### Handling partial output
If `hasOutput` is true (streaming started), append [Cancelled] to current line:
```typescript
if (hasOutput) {
  process.stdout.write(' [Cancelled]\n');
} else {
  spinner.stop();
  process.stdout.write('[Cancelled]\n');
}
```

### SIGINT handler location
Currently in `setupSignalHandlers()`. The cancel logic is:
```typescript
if (ctx.session.isStreaming()) {
  ctx.session.cancel();
  console.log('\n[Cancelled]');  // This adds extra newline
}
```

Need to coordinate between signal handler and the streaming promise.

### Don't save cancelled responses
Currently `sendAndStream()` saves to history after the promise resolves. On cancel:
- The promise should reject or resolve with a "cancelled" flag
- Skip the `addMessage()` call for cancelled responses

## Files to modify
- `src/cli/plan.ts` - signal handlers and sendAndStream function

## Checklist
- [x] Modify spinner.stop() to not add extra newlines
- [x] In SIGINT handler, don't print `\n[Cancelled]` - let sendAndStream handle it
- [x] Track cancelled state in sendAndStream
- [x] On cancel during spinner: clear spinner line, print `[Cancelled]`
- [x] On cancel during streaming: append ` [Cancelled]` to current line
- [x] Skip saving assistant message to history when cancelled
- [x] Ensure prompt appears cleanly on next line
- [x] Test: Ctrl+C during spinner
- [x] Test: Ctrl+C during streaming
- [x] Test: Multiple Ctrl+C (second should exit)

## Changelog

### Implemented
- Added shared cancel state (`streamCancelled` flag) between SIGINT handler and `sendAndStream`
- SIGINT handler now only marks cancelled and calls `cancel()` without printing
- `sendAndStream` detects cancellation and handles output appropriately:
  - During spinner: clears spinner line, prints `[Cancelled]` in yellow
  - During streaming: clears `^C` echo, appends ` [Cancelled]` to current line
- Cancelled responses are not saved to chat history
- Cancel state is reset in `finally` block for next message

### Files Modified
- `src/cli/plan.ts` - All changes in this file:
  - Added cancel state management (lines 199-207)
  - Updated `setupSignalHandlers` to accept `markCancelled` callback
  - Updated `mainLoop` to pass cancel state functions
  - Updated `sendAndStream` to handle cancellation with proper output formatting
  - Removed `console.log('\n[Cancelled]')` from SIGINT handler

### Deviations from Spec
- Used `\x1b[2D\x1b[K` to clear `^C` echo (move back 2 chars, clear to end of line) instead of just clearing the line - this preserves the streaming text before the `^C`
- Added yellow color (`\x1b[33m`) to `[Cancelled]` for visibility (not specified in bean)
- Used double newline (`\n\n`) after `[Cancelled]` to ensure clean separation before next prompt

### Decisions Made
- Cancel state is managed at the `runPlan` function level (not global) to keep it scoped to a single planning session
- Used closure-based functions (`markCancelled`, `resetCancelled`, `isCancelled`) rather than a class to keep the implementation simple
- Both try and catch blocks in `sendAndStream` check for cancellation since the promise may resolve or reject depending on the provider

### Known Limitations
- The `^C` echo cleanup assumes the terminal echoes exactly 2 characters (`^C`). Some terminals may behave differently.
- Manual testing was performed but automated tests were not added due to the complexity of testing signal handlers and terminal output