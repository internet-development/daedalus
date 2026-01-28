---
# daedalus-ojr3
title: Improve Ctrl+C cancel behavior
status: todo
type: feature
priority: low
created_at: 2026-01-28T20:07:00Z
updated_at: 2026-01-28T20:08:23Z
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
- [ ] Modify spinner.stop() to not add extra newlines
- [ ] In SIGINT handler, don't print `\n[Cancelled]` - let sendAndStream handle it
- [ ] Track cancelled state in sendAndStream
- [ ] On cancel during spinner: clear spinner line, print `[Cancelled]`
- [ ] On cancel during streaming: append ` [Cancelled]` to current line
- [ ] Skip saving assistant message to history when cancelled
- [ ] Ensure prompt appears cleanly on next line
- [ ] Test: Ctrl+C during spinner
- [ ] Test: Ctrl+C during streaming
- [ ] Test: Multiple Ctrl+C (second should exit)