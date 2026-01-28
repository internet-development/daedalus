---
# daedalus-mmkh
title: Add -c/--continue flag to bypass session selector
status: todo
type: feature
priority: normal
created_at: 2026-01-28T21:35:35Z
updated_at: 2026-01-28T21:35:35Z
parent: daedalus-tbsm
---

Add a flag to skip the session selector and immediately continue the most recent session.

## Background
Power users who frequently resume their last session shouldn't have to navigate the session selector every time. A quick flag enables instant continuation.

## Requirements
- `-c` or `--continue` flag on the `daedalus` command
- Bypasses session selector entirely
- Continues the most recent session (by `updatedAt`)
- If no sessions exist, creates a new one (same as `--new`)

## Usage
```bash
daedalus -c           # Continue most recent session
daedalus --continue   # Same thing
daedalus             # Normal flow with session selector
daedalus -n          # Skip selector, create new session (existing)
```

## Implementation Notes
- Add to argument parsing in `src/cli/index.ts`
- Pass through to `runPlan()` options
- In `plan.ts`, if `options.continue`:
  - Load history
  - Find most recent session by `updatedAt`
  - Switch to it (or create if none)
  - Skip `selectSession()` call

## Files to modify
- `src/cli/index.ts` - add flag parsing
- `src/cli/plan.ts` - handle continue option in runPlan()

## Checklist
- [ ] Add `continue` to PlanOptions interface
- [ ] Parse `-c` and `--continue` flags in `parsePlanArgs()`
- [ ] Update help text with new flag
- [ ] In `runPlan()`, handle continue option before session selection
- [ ] Find most recent session by sorting sessions by `updatedAt`
- [ ] If no sessions, fall back to creating new (same as `--new`)
- [ ] Test: `daedalus -c` with existing sessions
- [ ] Test: `daedalus -c` with no sessions