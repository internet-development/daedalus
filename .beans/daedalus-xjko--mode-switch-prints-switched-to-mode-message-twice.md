---
# daedalus-xjko
title: Mode switch prints "Switched to mode" message twice
status: todo
type: bug
priority: normal
created_at: 2026-01-30T07:44:17Z
updated_at: 2026-01-30T08:56:37Z
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

- [ ] Reproduce the bug: run `/mode`, select a mode, confirm message prints twice
- [ ] Investigate whether the ANSI cleanup in `interactive-select.ts` leaves a stale buffer that causes double output
- [ ] Check whether the blank `console.log()` at line ~125 of `interactive-select.ts` combined with cursor movements causes the duplication
- [ ] Check if `mainLoop()` in `plan.ts` has any post-command output that duplicates the message
- [ ] Fix the root cause (likely in `interactive-select.ts` cleanup or `commands.ts` handleMode)
- [ ] Verify the fix: `/mode` with interactive select prints the message exactly once
- [ ] Verify direct `/mode refine` still works correctly with a single message

## Blocked By

- daedalus-rbhm — Fix the j/k echo bug first, as it shares the same interactive-select cleanup code