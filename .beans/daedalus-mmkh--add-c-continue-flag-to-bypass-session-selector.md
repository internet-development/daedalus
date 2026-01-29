---
# daedalus-mmkh
title: Add -c/--continue flag to bypass session selector
status: in-progress
type: feature
priority: normal
created_at: 2026-01-28T21:35:35Z
updated_at: 2026-01-29T06:14:54Z
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
- [x] Add `continue` to PlanOptions interface
- [x] Parse `-c` and `--continue` flags in `parsePlanArgs()`
- [x] Update help text with new flag
- [x] In `runPlan()`, handle continue option before session selection
- [x] Find most recent session by sorting sessions by `updatedAt`
- [x] If no sessions, fall back to creating new (same as `--new`)
- [x] Test: `daedalus -c` with existing sessions
- [x] Test: `daedalus -c` with no sessions

## Changelog

### Implemented
- Added `-c` and `--continue` flags to bypass session selector and continue most recent session
- Added `continue` property to `PlanOptions` interface
- Updated `parsePlanArgs()` to parse the new flags
- Updated help text with new flag documentation
- Implemented continue logic in `runPlan()` that finds most recent session by `updatedAt`
- Falls back to creating new session if no sessions exist (same as `--new`)

### Files Modified
- `src/cli/index.ts` - Added flag parsing in `parsePlanArgs()`, updated help text, exported `parsePlanArgs` for testing
- `src/cli/plan.ts` - Added `continue` to `PlanOptions` interface, added continue logic in session selection

### Tests Added
- `src/cli/commands.test.ts` - Added tests for:
  - Parsing `-c` flag
  - Parsing `--continue` flag
  - `continue` being undefined when not specified
  - `getSessionsSortedByDate` returning most recent first
  - Continue with existing sessions switches to most recent
  - Continue with no sessions creates new session

### Deviations from Spec
- None - implementation follows spec exactly

### Decisions Made
- Exported `parsePlanArgs()` function to enable unit testing
- Used existing `getSessionsSortedByDate()` helper which already sorts by `updatedAt` descending

### Known Limitations
- None