---
# daedalus-i7jz
title: 'Debug: Plan mode not showing planning agent output'
status: completed
type: bug
priority: normal
created_at: 2026-01-27T08:30:21Z
updated_at: 2026-01-27T08:50:56Z
---

## Problem
Plan mode doesn't show output from the planning agent during streaming.

## Root Cause
**Multiple issues identified (from GitHub issue #771):**

1. **stdin pipe causing hang**: Using `stdio: ['pipe', 'pipe', 'pipe']` causes the `claude` CLI to hang waiting for stdin input. Fixed by using `stdio: ['ignore', 'pipe', 'pipe']`.

2. **Prompt position with long args**: When `--append-system-prompt` has a very long value (3000+ chars), the trailing prompt argument is not parsed correctly by the CLI. **Fix: put the prompt FIRST** before all options.

3. **Missing `--include-partial-messages`**: Without this flag, no streaming text deltas are emitted.

4. **Missing `stream_event` handler**: Code only handled `assistant` events, not `stream_event` deltas.

## References
- GitHub Issue: https://github.com/anthropics/claude-code/issues/771
- Key insight from @lukebjerring: `stdio: ['inherit', 'pipe', 'pipe']` or `['ignore', 'pipe', 'pipe']` fixes the hang

## Fixes Applied
1. Changed `stdio` to `['ignore', 'pipe', 'pipe']` (line 420)
2. Moved prompt to FIRST position in args array (line 404)
3. Added `--include-partial-messages` flag (line 408)
4. Added handler for `stream_event` type to extract text deltas

## Checklist
- [x] Reproduce the issue
- [x] Search for known issues (found #771)
- [x] Find the root cause
- [x] Implement fix