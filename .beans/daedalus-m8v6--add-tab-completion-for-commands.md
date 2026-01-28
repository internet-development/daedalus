---
# daedalus-m8v6
title: Add tab completion for /commands
status: todo
type: feature
priority: normal
created_at: 2026-01-28T20:06:46Z
updated_at: 2026-01-28T20:08:22Z
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
- [ ] Export list of all command names (including aliases) from commands.ts
- [ ] Create `completer(line: string)` function in plan.ts
- [ ] Handle non-command input (return empty completions)
- [ ] Handle `/` prefix - filter commands starting with typed text
- [ ] Pass completer to readline.createInterface()
- [ ] Test: `/h<tab>` completes to `/help`
- [ ] Test: `/s<tab>` shows `/start`, `/stop`, `/status`, `/sessions`
- [ ] Test: Regular text doesn't trigger completion
- [ ] Test: Empty `/` shows all commands