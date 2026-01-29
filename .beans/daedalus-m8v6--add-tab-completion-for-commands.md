---
# daedalus-m8v6
title: Add tab completion for /commands
status: completed
type: feature
priority: normal
created_at: 2026-01-28T20:06:46Z
updated_at: 2026-01-29T06:09:06Z
parent: daedalus-tbsm
---

Implement tab completion for slash commands in the readline loop.

## Background
Users have to type full command names like `/sessions` or `/brainstorm`. Tab completion would improve discoverability and speed.

## Requirements
- Tab completes `/` commands (e.g., `/se<tab>` → `/sessions`)
- Show available completions if ambiguous (readline does this automatically)
- **Phase 1**: Commands only (simpler, covers 90% of use case)
- **Future**: Could extend to complete arguments like `/mode <tab>` → mode names

## Implementation Notes

### Completer function signature
```typescript
function completer(line: string): [string[], string] {
  // Returns [completions, originalSubstring]
  // Example: for "/se", return [["/sessions", "/status"], "/se"]
}
```

### Commands to complete
From `src/cli/commands.ts`:
```
/help, /h, /?
/mode, /m
/prompt, /p
/start
/stop
/status, /st
/sessions, /ss
/new, /n
/clear, /c
/tree, /t
/quit, /q, /exit
```

Should complete both full names and aliases.

### Completion logic
1. If line doesn't start with `/`, return no completions (regular message)
2. Filter commands that start with the typed prefix
3. Return matching commands

### Edge cases
- Empty `/` should show all commands
- Exact match should still show (user might want to see it's valid)
- Case-insensitive matching

## Files to modify
- `src/cli/plan.ts` - add completer function to readline.createInterface()
- `src/cli/commands.ts` - export `COMMANDS` array for completion

## Checklist
- [x] Export list of all command names (including aliases) from commands.ts
- [x] Create `completer(line: string)` function in plan.ts
- [x] Handle non-command input (return empty completions)
- [x] Handle `/` prefix - filter commands starting with typed text
- [x] Pass completer to readline.createInterface()
- [x] Test: `/h<tab>` completes to `/help`
- [x] Test: `/s<tab>` shows `/start`, `/stop`, `/status`, `/sessions`
- [x] Test: Regular text doesn't trigger completion
- [x] Test: Empty `/` shows all commands

## Changelog

### Implemented
- Added `COMMAND_NAMES` export to `commands.ts` with all command names and aliases
- Created `completer.ts` module with the completer function for readline
- Integrated completer into readline.createInterface() in plan.ts
- Added comprehensive test suite for tab completion

### Files Modified
- `src/cli/commands.ts` - Added `COMMAND_NAMES` array export
- `src/cli/completer.ts` - NEW: Completer function module
- `src/cli/completer.test.ts` - NEW: Test suite for completer
- `src/cli/plan.ts` - Added completer import and passed to readline

### Deviations from Spec
- Created separate `completer.ts` module instead of putting function in `plan.ts` (better separation of concerns, easier to test)
- Named export `COMMAND_NAMES` instead of `COMMANDS` (more descriptive)

### Decisions Made
- Used case-insensitive matching for better UX (spec mentioned this as edge case)
- Completer returns original line as-is for non-command input (standard readline behavior)
- All 14 tests pass covering primary commands, aliases, and edge cases

### Known Limitations
- Phase 1 only: Commands only, no argument completion (as specified in requirements)