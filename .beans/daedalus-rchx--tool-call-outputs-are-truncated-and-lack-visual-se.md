---
# daedalus-rchx
title: Tool call outputs are truncated and lack visual separation
status: completed
type: bug
priority: normal
created_at: 2026-01-29T17:15:50Z
updated_at: 2026-01-29T18:39:52Z
blocking:
    - daedalus-pjmp
---

## Problem

Tool call output is currently truncated and lacks visual breathing room:

1. **Truncation**: Tool calls display only first 50 characters of JSON args
   - Example: `[Tool: Bash {"command":"beans create \"Planner agent offers to]`
   - Users can't see what command is actually being run

2. **Grouping**: Consecutive tool calls are displayed but need blank line separation from planner text
   - Should have newline after planner message, before first tool call
   - Consecutive tool calls should be grouped together (no newline between them)

## Root Cause

`src/cli/output.ts:333-336`:
```typescript
export function formatToolCall(name: string, args?: Record<string, unknown>): string {
  const argsStr = args ? ` ${c('dim', JSON.stringify(args).slice(0, 50))}` : '';
  return c('yellow', `  [Tool: ${name}${argsStr}]`);
}
```

And in `src/cli/plan.ts:338-356`, the toolCallHandler adds a newline before EVERY tool call if hasOutput is true, rather than grouping consecutive calls.

## Desired Behavior

1. Show more useful info from tool args (smart truncation based on tool type)
2. Add blank line after planner text, before first tool call in a group
3. Group consecutive tool calls together (no blank lines between them)

Example of desired output:
```
Planner: Let me create that bug for you.

  [Tool: Bash] beans create "Fix the login bug" -t bug -s todo
  [Tool: Bash] beans query '{ beans { id title } }'

Planner: Done! Created bug daedalus-abc1.
```

## Checklist

- [x] Update `formatToolCall` in `src/cli/output.ts` to show more useful info
  - For Bash: show the command (truncated intelligently if needed)
  - For other tools: show key args in a readable format
- [x] Update `toolCallHandler` in `src/cli/plan.ts` to track consecutive tool calls
  - Add blank line before first tool call in a group (after text)
  - No blank line between consecutive tool calls
- [x] Update tests in `src/cli/output.test.ts`

## Changelog

### Implemented
- Rewrote `formatToolCall` with type-aware smart formatting for tool args
  - Bash/mcp_bash: shows command string directly (e.g. `[Tool: Bash] git status`)
  - Read/Write/Edit: shows file path (e.g. `[Tool: Read] /src/cli/output.ts`)
  - Glob/Grep: shows search pattern (e.g. `[Tool: Grep] formatToolCall`)
  - Task: shows description (e.g. `[Tool: Task] Explore codebase`)
  - WebFetch: shows URL (e.g. `[Tool: WebFetch] https://example.com/api`)
  - Unknown tools: shows key=value pairs with truncation
- Strips `mcp_` prefix from tool names and capitalizes for display
- Intelligent truncation at 120 chars with ellipsis for long args
- Fixed tool call grouping: blank line only before first tool call in a group (after text), no blank lines between consecutive tool calls

### Files Modified
- `src/cli/output.ts` - Rewrote `formatToolCall` with helper functions: `normalizeToolName`, `formatToolArgs`, `formatKeyValueArgs`, `truncate`
- `src/cli/output.test.ts` - Replaced 3 old tests with 14 new tests covering all tool types
- `src/cli/plan.ts` - Fixed `toolCallHandler` to check `!afterToolCall` before adding blank line
- `src/cli/plan-tool-grouping.test.ts` - NEW: 5 tests verifying tool call grouping behavior

### Deviations from Spec
- Added `mcp_` prefix stripping (not in spec, but necessary since Claude Code tools use `mcp_` prefix)
- Tool name capitalization (first letter uppercase) for cleaner display
- Added support for `todowrite` tool type (shows description, similar to Task)

### Decisions Made
- Used 120 char max for tool arg display (reasonable terminal width)
- Key=value format for unknown tools (more readable than JSON)
- Individual value truncation at 30 chars for unknown tool args
- Separated tool name (yellow) from args (dim) with different ANSI styling for visual distinction

### Known Limitations
- Tool name normalization only capitalizes first letter (e.g. `custom_tool` → `Custom_tool`, not `CustomTool`)
- No special handling for `TodoRead`, `Skill`, or other less common tools (falls back to key=value format)