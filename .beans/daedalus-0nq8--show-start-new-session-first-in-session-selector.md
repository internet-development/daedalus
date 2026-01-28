---
# daedalus-0nq8
title: Show 'Start new session' first in session selector
status: todo
type: task
priority: normal
created_at: 2026-01-28T20:10:00Z
updated_at: 2026-01-28T20:10:00Z
parent: daedalus-tbsm
---

Improve the session selector UX by reordering options and adjusting the default selection.

## Background
Currently in the session selector:
1. Existing sessions are listed first, "Start new session" appears at the bottom
2. Default selection is the current session (good)
3. Starting fresh requires scrolling past all existing sessions

## UX Research Summary
Per [CLI Guidelines](https://clig.dev/):
- "Make the default the right thing for most users" - default to resuming work
- "Conversation as the norm" - users often continue sessions

The ideal UX balances:
- **Quick access to "new session"** - common action, should be easy to reach
- **Default to continue** - most users launch to resume work

## Desired behavior
```
Planning Sessions
────────────────────────────────────────
  Start new session
> Session 1 (current)         3 msgs, 2h ago
  Session 2                   5 msgs, 1d ago
```

Key changes:
1. "Start new session" moves to TOP of list (easy to reach with one up-arrow)
2. Default selection stays on current/most recent session (resume workflow)
3. If no sessions exist, default to "Start new session"

This gives:
- Power users: one keystroke to start new (up + enter)
- Default behavior: resume where you left off
- Visual prominence: "new" is always visible at top

## Files to modify
- `src/cli/session-selector.ts` - reorder options array and adjust defaultIndex calculation

## Checklist
- [ ] Move "Start new session" option to beginning of options array (use `unshift` instead of `push`)
- [ ] Adjust `defaultIndex` calculation to account for the new item at index 0
- [ ] If current session exists: default to its index (now +1 due to new item)
- [ ] If no current session but sessions exist: default to most recent (index 1)
- [ ] If no sessions: default to "Start new session" (index 0)
- [ ] Test with 0, 1, and multiple sessions
- [ ] Test arrow key navigation works correctly