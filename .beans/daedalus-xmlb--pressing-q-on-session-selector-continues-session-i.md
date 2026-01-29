---
# daedalus-xmlb
title: Pressing 'q' on session selector continues session instead of exiting
status: completed
type: bug
priority: normal
created_at: 2026-01-29T17:06:03Z
updated_at: 2026-01-29T18:23:14Z
---

## Problem

When pressing 'q' on the session selector screen (the first screen users see), instead of exiting the application, it continues the current session unexpectedly.

## Expected Behavior

Pressing 'q' should exit the application entirely since this is the first screen and there's no previous context to return to.

## Location

- `src/ui/components/SessionSelector.tsx` - Session selector component

## Checklist

- [x] Add 'q' key handler to SessionSelector that exits the application
- [x] Ensure clean exit (no orphaned processes, proper cleanup)
- [x] Test that 'q' exits cleanly from session selector

## Changelog

### Implemented
- Added `'exit'` action to `SessionSelection` type so callers can distinguish quit from selection
- Changed 'q' and Escape key handler to return an exit sentinel instead of defaulting to first option
- Separated Ctrl+C into its own handler that calls `process.exit(0)` immediately for clean exit
- Updated `selectSession` to map the exit sentinel to `{ action: 'exit' }`
- Updated `handleSessions` in commands.ts to return `{ type: 'quit', generateName: true }` on exit
- Updated `plan.ts` to call `process.exit(0)` on exit action (since it's the entry point)
- Added test file with type contract tests and behavior tests

### Files Modified
- `src/cli/session-selector.ts` - Added exit action type, exit sentinel, fixed 'q' handler
- `src/cli/commands.ts` - Handle `'exit'` action in `handleSessions`
- `src/cli/plan.ts` - Handle `'exit'` action with `process.exit(0)`
- `src/cli/session-selector.test.ts` - NEW: Tests for session selection type contract and behavior

### Deviations from Spec
- Bean referenced `src/ui/components/SessionSelector.tsx` but actual file is `src/cli/session-selector.ts`
- Ctrl+C now calls `process.exit(0)` directly instead of resolving through the selection flow (more reliable for interrupt signals)

### Decisions Made
- Used a sentinel string `'__EXIT__'` internally rather than adding a special option to the select list (cleaner separation of concerns)
- Separated 'q'/Escape from Ctrl+C: 'q' and Escape go through the normal flow returning exit action; Ctrl+C exits immediately via `process.exit(0)`
- In `plan.ts`, exit action calls `process.exit(0)` since there's no command result loop to return to
- In `commands.ts`, exit action returns `{ type: 'quit', generateName: true }` to reuse existing quit flow

### Known Limitations
- Interactive stdin tests are limited to type contract and empty-session behavior (raw mode stdin cannot be easily simulated in vitest)