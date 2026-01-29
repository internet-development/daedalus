---
# daedalus-rchx
title: Tool call outputs are truncated and lack visual separation
status: todo
type: bug
priority: normal
created_at: 2026-01-29T17:15:50Z
updated_at: 2026-01-29T18:13:38Z
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

- [ ] Update `formatToolCall` in `src/cli/output.ts` to show more useful info
  - For Bash: show the command (truncated intelligently if needed)
  - For other tools: show key args in a readable format
- [ ] Update `toolCallHandler` in `src/cli/plan.ts` to track consecutive tool calls
  - Add blank line before first tool call in a group (after text)
  - No blank line between consecutive tool calls
- [ ] Update tests in `src/cli/output.test.ts`