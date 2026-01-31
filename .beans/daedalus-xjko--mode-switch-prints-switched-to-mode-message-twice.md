---
# daedalus-xjko
title: Mode switch prints "Switched to mode" message twice
status: in-progress
type: bug
priority: normal
created_at: 2026-01-30T07:44:17Z
updated_at: 2026-01-31T06:35:59Z
parent: daedalus-bmnc
---

## Description

When switching planning modes via the interactive select menu (`/mode`), the confirmation message is printed twice:

```
Switched to mode: refine

Switched to mode: refine
```

## Root Cause Analysis

The `handleMode` function in `src/cli/commands.ts` has the confirmation `console.log()` at line ~225 after `interactiveSelect()` resolves. The message itself only appears once in this code path, so the duplication likely comes from one of:

1. **Terminal buffer / ANSI rendering artifact** — `interactiveSelect()` in `src/cli/interactive-select.ts` uses ANSI cursor manipulation (`CURSOR_UP`, `CURSOR_TO_START`, `CLEAR_LINE`) for its menu rendering. When the selection resolves, there's an extra `console.log()` (blank line) at line ~125 before resolve. A flushing or cursor-position issue may cause the subsequent "Switched to mode" output to render twice.

2. **Readline / raw mode interaction** — The interactive select sets raw mode on stdin and attaches a keypress listener. If cleanup doesn't fully restore state before the `console.log` in `handleMode`, the output could be echoed or duplicated. Check whether the blank `console.log()` at line ~125 of `interactive-select.ts` combined with cursor movements causes the duplication.

3. **Main loop re-entry** — Check whether `plan.ts` `mainLoop()` re-dispatches the command or re-renders output after `handleCommand` returns.

**Note:** This bug shares the same `interactive-select.ts` component as daedalus-rbhm (j/k echo bug). Fixing the cleanup and readline state management in rbhm will likely resolve or inform the fix for this bug.

## Files Involved

- `src/cli/commands.ts` — `handleMode()` (~lines 203-242), prints the confirmation message
- `src/cli/interactive-select.ts` — `interactiveSelect()`, ANSI rendering and cleanup logic
- `src/cli/plan.ts` — `mainLoop()`, calls `handleCommand` and processes the result

## Checklist

- [x] Reproduce the bug: run `/mode`, select a mode, confirm message prints twice
- [x] Investigate whether the ANSI cleanup in `interactive-select.ts` leaves a stale buffer that causes double output
- [x] Check whether the blank `console.log()` at line ~125 of `interactive-select.ts` combined with cursor movements causes the duplication
- [x] Check if `mainLoop()` in `plan.ts` has any post-command output that duplicates the message
- [x] Fix the root cause (likely in `interactive-select.ts` cleanup or `commands.ts` handleMode)
- [x] Verify the fix: `/mode` with interactive select prints the message exactly once
- [x] Verify direct `/mode refine` still works correctly with a single message

## Blocked By

- daedalus-rbhm — Fix the j/k echo bug first, as it shares the same interactive-select cleanup code

## Changelog

### Implemented
- Added menu clearing to `interactiveSelect()` cleanup — when the user makes a selection (Enter) or quits (q/Escape), the entire menu area (header, options, instructions) is erased from the terminal using ANSI cursor-up and clear-line sequences before the cursor is restored
- Removed the extra `console.log()` blank line that was emitted after selection (line ~125), which contributed to the ANSI rendering artifact
- Added comprehensive test suite for `/mode` command verifying single-message output

### Root Cause
The duplication was an ANSI terminal rendering artifact. `interactiveSelect()` rendered a multi-line menu using ANSI cursor manipulation (`CURSOR_UP`, `CLEAR_LINE`, `CURSOR_TO_START`) but did NOT clear the menu from the terminal when the user made a selection. The stale menu content combined with the extra `console.log()` blank line left the terminal in a state where the subsequent "Switched to mode" message appeared duplicated. The `handleMode` function in `commands.ts` only prints the message once (confirmed by unit tests capturing `console.log` output).

### Files Modified
- `src/cli/interactive-select.ts` — Added `clearMenu()` helper that erases the full menu area (header + options + instructions) on exit; removed extra `console.log()` after selection
- `src/cli/mode-command.test.ts` — NEW: 10 tests verifying `/mode` prints confirmation exactly once (interactive and direct paths)

### Deviations from Spec
- The spec suggested the fix might be in `commands.ts handleMode` — investigation confirmed `handleMode` only prints once; the fix was entirely in `interactive-select.ts`
- `mainLoop()` in `plan.ts` has no post-command output that duplicates the message (confirmed by code review)

### Decisions Made
- Clear the entire menu (header + options + instructions) rather than just the options area, for a cleaner terminal state
- Menu clearing benefits all callers of `interactiveSelect` (mode, prompt, sessions), not just `/mode`
- Used CURSOR_UP + CLEAR_LINE loop rather than terminal scroll region manipulation (simpler, more portable)

### Known Limitations
- The menu clearing uses line-count arithmetic (headerLines + options.length + instructionLines) which must stay in sync with the render layout — if the render format changes, the line count must be updated