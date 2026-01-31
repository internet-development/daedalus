---
# daedalus-rbhm
title: Mode select menu prints j/k characters to screen
status: in-progress
type: bug
priority: normal
created_at: 2026-01-30T07:34:51Z
updated_at: 2026-01-31T06:29:05Z
parent: daedalus-bmnc
blocking:
    - daedalus-xjko
---

## Description

When using the interactive select menu (e.g. `/mode` command), pressing `j` or `k` to navigate up/down causes those characters to be visually printed to the terminal output, even though the navigation itself works correctly.

## Root Cause

In `src/cli/interactive-select.ts`, the `interactiveSelect()` function enables raw mode on `process.stdin` (line 92-93) and listens for `data` events to handle `j`/`k` keypresses (lines 110-121). However, the parent readline interface from the main CLI (`src/cli/plan.ts:134`) is still attached and echoing input characters to stdout before the raw-mode `data` handler consumes them.

This is the same class of bug as **daedalus-8b67** (spinner wall of text) — both are caused by readline's `output: process.stdout` intercepting raw stdout writes. The readline interface created at `plan.ts:134` manages cursor positioning on stdout, so any raw `process.stdin` reads or `process.stdout.write()` calls that bypass readline get mangled.

### Investigation notes

- Verify that `process.stdin.setRawMode(true)` is actually being called successfully — the function has a TTY guard (`process.stdin.isTTY`) and falls back to `simpleSelect()` for non-TTY environments. The bug may only manifest in certain terminal configurations.
- Check whether the readline `line` event from `plan.ts` is firing alongside the raw mode `data` handler, which would explain the echo.
- The `simpleSelect()` fallback (non-TTY path) would not exhibit this bug — confirm the bug is exclusive to TTY mode.
- **The fix for daedalus-8b67 (readline output interception) will likely fix this bug as collateral.** If 8b67 is fixed first, re-test this bug before doing additional work.

## Steps to Reproduce

1. Run `daedalus plan`
2. Type `/mode` and press Enter
3. Press `j` or `k` to navigate the menu
4. Observe that `j` or `k` characters appear in the terminal output alongside the menu

## Expected Behavior

`j` and `k` keypresses should silently navigate the menu without printing any characters to the terminal.

## Affected Code

- `src/cli/interactive-select.ts:90-143` — `interactiveSelect()` function
- `src/cli/plan.ts:134` — Parent readline interface with `output: process.stdout`

## Blocked By

- **daedalus-8b67** — Spinner wall-of-text bug shares the same readline interference root cause. Fix 8b67 first, then re-test this bug.

## Blocks

- **daedalus-xjko** — Mode switch double message bug shares the same interactive-select component; fixing cleanup here will likely address that bug too.

## Checklist

- [x] Verify `process.stdin.setRawMode(true)` is being called successfully (add debug logging if needed)
- [x] Check whether the readline `line` event from `plan.ts` fires during interactive select and echoes characters
- [x] Investigate whether the parent readline interface in `plan.ts` is echoing characters during interactive select
- [x] Pause or suppress the parent readline interface output before entering the interactive select
- [x] Restore the parent readline interface after interactive select completes
- [x] Test that j/k navigation works without printing characters in `/mode`, `/prompt`, and session selector menus
- [x] Confirm the bug does not occur in non-TTY fallback (`simpleSelect`)

## Changelog

### Implemented
- Added `rlOutput` to `CommandContext` interface so command handlers can mute/unmute the parent readline output
- Mute readline output before `interactiveSelect()` calls in `handleMode()`, `handlePrompt()`, and `handleSessions()`
- Unmute in `finally` blocks to ensure restoration even on errors
- Passed `rlOutput` from `plan.ts` through `CommandContext`
- Added type contract test verifying `CommandContext.rlOutput` shape

### Root Cause
The parent readline interface (created in `plan.ts`) was echoing j/k keypresses to stdout during interactive select. The readline's mutable output stream (introduced by daedalus-8b67) was unmuted during command handling, so readline's internal character echo reached stdout. The fix reuses the same mute/unmute pattern from `sendAndStream()`.

### Files Modified
- `src/cli/commands.ts` — Added `rlOutput` to `CommandContext` interface; mute/unmute around `interactiveSelect()` calls in `handleMode()`, `handlePrompt()`, `handleSessions()`
- `src/cli/plan.ts` — Pass `rlOutput` through `CommandContext`
- `src/cli/interactive-select.test.ts` — Added type contract tests for `CommandContext.rlOutput`
- `src/cli/prompt-command.test.ts` — Added `rlOutput` to test `makeCtx()` helper

### Deviations from Spec
- None. The fix follows the same pattern established by daedalus-8b67.

### Decisions Made
- Chose to mute in command handlers rather than inside `interactiveSelect()` itself, keeping the selector generic and unaware of readline
- Used `try/finally` for unmute to ensure cleanup on errors or early exits
- The initial session selection in `plan.ts` (before readline is created) does not need muting

### Known Limitations
- None. The fix covers all three interactive select call sites (`/mode`, `/prompt`, `/sessions`).