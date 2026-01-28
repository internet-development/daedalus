---
# daedalus-yl5k
title: Tool call outputs are bunched together and hard to read
status: todo
type: bug
priority: normal
created_at: 2026-01-28T20:15:05Z
updated_at: 2026-01-28T22:13:09Z
parent: daedalus-tbsm
---

## Problem

When the agent makes tool calls, the output is confusing and hard to follow:

1. **No visual separation** - Text before and after tool calls runs together
   - Example: `Let me update the bean with this information:Updated the bean with the specific symptoms.`
   - Should have a newline or indicator between the pre-tool text and post-tool result

2. **No indication of tool execution** - The UI hangs for a second after the colon while the tool runs, but there's no visual feedback that a tool is being called

3. **Tool results blend into response** - Can't tell what came from the tool vs what the agent is saying

## Root Cause Analysis

The streaming architecture in `src/cli/plan.ts` handles text events but doesn't distinguish tool execution boundaries:

- **textHandler** (line 280-288): Simply appends all incoming text chunks to output with `process.stdout.write(text)` - no awareness of tool calls
- **toolCallHandler** (line 291-293): Captures tool calls but doesn't display anything to the user
- The `formatToolCall()` function exists in `src/cli/output.ts:326` but is never used in the main loop

The Claude Code provider (`src/planning/claude-code-provider.ts`) emits separate events:
- `text` events for streaming content
- `toolCall` events when tools are invoked
- But the UI doesn't visually react to toolCall events

## Proposed Solution

Modify `sendAndStream()` in `src/cli/plan.ts` to:

1. **Show tool call indicator** when `toolCall` event fires:
   - Print a newline after any pending text
   - Display `[Tool: beans_cli ...]` using the existing `formatToolCall()` from output.ts
   - Track that we're "in a tool call" state

2. **Handle post-tool text** with visual separation:
   - After a tool call, ensure there's a newline before resuming text output
   - Optionally show a brief "done" indicator

3. **Consider a tool spinner** for longer operations (optional enhancement)

## Affected Files

- `src/cli/plan.ts` - Main changes to sendAndStream() text/toolCall handlers
- `src/cli/output.ts` - May need to refine formatToolCall() for better display

## Checklist

- [ ] Import `formatToolCall` from output.ts into plan.ts
- [ ] Modify toolCallHandler to display tool call indicator
- [ ] Track "in tool call" state to manage newlines properly
- [ ] Add newline before tool call display (if text was streaming)
- [ ] Add newline after tool call completes before resuming text
- [ ] Test with various tool calls (beans CLI, file reads, etc.)
- [ ] Verify Ctrl+C still cancels properly during tool execution