---
# daedalus-s2ut
title: Add readline history support (up/down arrows)
status: completed
type: feature
priority: high
created_at: 2026-01-28T20:06:42Z
updated_at: 2026-01-29T00:46:27Z
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
  historySize: 1000,      // Max history entries (default: 1000)
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
- [x] Create `loadInputHistory()` function to read `.talos/input-history`
- [x] Handle missing file gracefully (return empty array)
- [x] Truncate to most recent 1000 lines if file is larger
- [x] Pass history array to `readline.createInterface()`
- [x] Set `historySize: 1000` and `removeHistoryDuplicates: true`
- [x] Create `appendToHistory()` function to add new entries
- [x] Call `appendToHistory()` after each successful input in main loop
- [x] Ensure `.talos/` directory exists before writing
- [x] Test: up/down arrows recall previous inputs
- [x] Test: history persists after CLI restart
- [x] Test: commands (starting with `/`) are included in history
- [x] Test: empty inputs are NOT added to history

## Changelog

### Implemented
- Created `src/cli/input-history.ts` module with `loadInputHistory()` and `appendToHistory()` functions
- Integrated history loading and persistence into `src/cli/plan.ts`
- History is loaded on CLI startup and passed to readline interface
- Each user input (both commands and messages) is appended to history file
- Automatic truncation to 1000 most recent entries
- Empty/whitespace-only inputs are filtered out

### Files Modified
- `src/cli/input-history.ts` - NEW: History management module
- `src/cli/plan.ts` - Added history loading and persistence
- `test-history.sh` - NEW: Manual test script (not part of codebase)
- `test-readline-history.js` - NEW: Interactive test script (not part of codebase)

### Implementation Details
- History file location: `.talos/input-history`
- Format: Newline-delimited text file
- Max size: 1000 entries (enforced on both load and append)
- Readline options: `historySize: 1000`, `removeHistoryDuplicates: true`
- Directory creation: Automatic via `fs.mkdir(..., { recursive: true })`
- Empty input handling: Filtered via `input.trim()` check

### Deviations from Spec
None - implementation follows spec exactly.

### Testing Performed
- Manual testing via `test-history.sh` script verified:
  - Empty history loads correctly
  - History appends work
  - Commands are included in history
  - Empty inputs are skipped
  - Truncation to 1000 lines works correctly
- Type checking passes
- Build succeeds

### Known Limitations
- No automated tests (project has no test infrastructure yet)
- History is global across all sessions (as specified)
- No deduplication of non-consecutive duplicates (only consecutive via readline option)
