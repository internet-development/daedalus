---
# daedalus-gu7g
title: 'Phase 2: Create New CLI'
status: completed
type: feature
priority: normal
created_at: 2026-01-28T04:02:28Z
updated_at: 2026-01-28T04:15:18Z
parent: daedalus-ty5h
blocking:
    - daedalus-qj38
---

## Summary

Build the new readline-based CLI using the extracted core logic from Phase 1.

## Goal

Create a fully functional planning CLI with:
1. Session selection at startup
2. Interactive readline loop
3. All /commands working
4. Tree command via subprocess

## Files to Create

| File | Purpose |
|------|---------|
| `src/cli/session-selector.ts` | Interactive session picker |
| `src/cli/commands.ts` | /command handlers |
| `src/cli/plan.ts` | Main planning loop |
| `src/cli/tree.ts` | Spawn `beans tree` |
| `src/cli/index.ts` | CLI entry point |

## Dependencies

Blocked by Phase 1 - needs chat-history.ts, planning-session.ts, output.ts

## Acceptance Criteria

- [ ] `daedalus` launches planning with session selector
- [ ] `daedalus --new` skips selector, creates new session
- [ ] `daedalus --list` lists sessions and exits
- [ ] All /commands work correctly
- [ ] Streaming responses display properly
- [ ] Sessions persist between invocations