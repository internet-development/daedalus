---
# daedalus-h4z9
title: Rename /tree command to /beans (keep /tree as alias)
status: in-progress
type: task
priority: normal
created_at: 2026-01-30T07:37:37Z
updated_at: 2026-01-31T06:45:32Z
---

## Summary

Rename the `/tree` slash command to `/beans` as the primary command name, since it displays beans and "beans" is more descriptive. Keep `/tree` and `/t` as backwards-compatible aliases.

## Rationale

The command shows the beans hierarchy, so `/beans` is a more intuitive and discoverable name. Keeping `/tree` as an alias avoids breaking muscle memory.

## Checklist

- [x] Rename `/tree` to `/beans` in `COMMAND_NAMES` array (`src/cli/commands.ts:46`), add `/tree` as alias alongside existing `/t`
- [x] Update the command handler switch in `src/cli/commands.ts:171-173` to use `case 'beans':` as primary, with `'tree'` and `'t'` as fallthrough aliases
- [x] Rename `handleTree` to `handleBeans` in `src/cli/commands.ts:371`
- [x] Update help text in `src/cli/output.ts:134` — change entry to `['/beans', 'Show beans tree']` and add alias note
- [x] Update interactive help in `src/cli/index.ts:115` — change `/tree [args]` to `/beans [args]`
- [x] Update CLI argument docs in `src/cli/index.ts:92` to say `daedalus beans` (keep `daedalus tree` as alias)
- [x] Update CLI main command switch in `src/cli/index.ts:133-137` to handle both `'beans'` and `'tree'`
- [x] Update `parseTreeArgs` function name to `parseBeansArgs` in `src/cli/index.ts:78-80`
- [x] Update tab completion in `src/cli/completer.ts` to include `/beans` in completions
- [x] Update tests in `src/cli/commands.test.ts` to test `/beans` as primary command
- [x] Update tab completion test in `src/cli/completer.test.ts:30` to include `/beans`
- [x] Verify `/tree` and `/t` still work as aliases after the rename

## Changelog

### Implemented
- Renamed `/tree` to `/beans` as the primary slash command name
- Added `case 'beans':` as primary in the command handler switch, with `'tree'` and `'t'` as fallthrough aliases
- Renamed `handleTree` to `handleBeans` and `parseTreeArgs` to `parseBeansArgs`
- Updated help text to show `/beans` with alias note `(alias: /tree, /t)`
- Updated CLI argument docs to show `daedalus beans` as primary, `daedalus tree` as alias
- Updated tab completion: `/beans` is now a primary command, `/tree` moved to aliases section
- Updated tests to verify `/beans` as primary command and `/tree` as alias

### Files Modified
- `src/cli/commands.ts` — Renamed `/tree` to `/beans` in COMMAND_NAMES, updated switch case, renamed `handleTree` to `handleBeans`
- `src/cli/output.ts` — Updated help text entry from `/tree` to `/beans` with alias note
- `src/cli/index.ts` — Updated CLI docs, help text, command switch (`beans` + `tree`), renamed `parseTreeArgs` to `parseBeansArgs`
- `src/cli/commands.test.ts` — Updated test descriptions to reference `/beans`, added `/tree` alias test
- `src/cli/completer.test.ts` — Updated to expect `/beans` as primary, added test for `/tree` as alias

### Deviations from Spec
- `src/cli/completer.ts` did not need changes — it reads from `COMMAND_NAMES` dynamically, so updating the array in `commands.ts` was sufficient
- Help text uses `(alias: /tree, /t)` format instead of just "add alias note" — more specific and user-friendly

### Decisions Made
- Kept `/tree` in the aliases section of `COMMAND_NAMES` (between `/c` and `/t`) for logical grouping
- Error message in `handleBeans` updated from "Failed to run tree" to "Failed to run beans"
- Removed `daedalus tree` assertion from help test since the help text now says `daedalus beans`

### Known Limitations
- None — all aliases work, all tests pass (489 passed, 4 skipped)