---
# daedalus-s2ut
title: Add readline history support (up/down arrows)
status: in-progress
type: feature
priority: high
created_at: 2026-01-28T20:06:42Z
updated_at: 2026-01-29T00:17:17Z
parent: daedalus-tbsm
blocking:
    - daedalus-4jz1
---

Implement persistent command history for the readline loop so users can press up/down arrows to recall previous inputs.

## Background
Currently the basic `readline.Interface` doesn't persist history between prompts or sessions. This is table-stakes UX for any CLI.

## Requirements
- Up arrow recalls previous inputs within the session
- Down arrow moves forward through history
- **Persist history to disk** at `.talos/input-history`
- **Global history** across all chat sessions (not per-session)
- Max history size: 1000 lines
- Include both messages AND commands (everything typed at the prompt)

## Implementation Notes

### Node.js readline history
Node's `readline.createInterface()` accepts:
```typescript
readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  history: string[],      // Pre-populate with previous inputs
  historySize: 1000,      // Max history entries (default: 30)
  removeHistoryDuplicates: true,  // Don't store consecutive duplicates
});
```

### History file format
Simple newline-delimited text file:
```
/help
What are the main features we need?
/mode brainstorm
Let's think about the architecture
```

### Persistence strategy
1. On startup: Read `.talos/input-history`, split by newlines, pass to readline
2. After each input: Append to history file (or rewrite if deduping)
3. On exit: Ensure history is flushed to disk

### Edge cases
- History file doesn't exist: Start with empty history
- History file has more than 1000 lines: Truncate to most recent 1000
- Ensure `.talos/` directory exists before writing

## Files to modify
- `src/cli/plan.ts` - readline interface creation and history management
- New helper functions: `loadInputHistory()`, `saveInputHistory()`, `appendToHistory()`

## Checklist
- [ ] Create `loadInputHistory()` function to read `.talos/input-history`
- [ ] Handle missing file gracefully (return empty array)
- [ ] Truncate to most recent 1000 lines if file is larger
- [ ] Pass history array to `readline.createInterface()`
- [ ] Set `historySize: 1000` and `removeHistoryDuplicates: true`
- [ ] Create `appendToHistory()` function to add new entries
- [ ] Call `appendToHistory()` after each successful input in main loop
- [ ] Ensure `.talos/` directory exists before writing
- [ ] Test: up/down arrows recall previous inputs
- [ ] Test: history persists after CLI restart
- [ ] Test: commands (starting with `/`) are included in history
- [ ] Test: empty inputs are NOT added to history