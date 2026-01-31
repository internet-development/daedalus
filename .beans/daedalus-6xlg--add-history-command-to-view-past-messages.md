---
# daedalus-6xlg
title: Add /history command to view past messages
status: completed
type: feature
priority: normal
created_at: 2026-01-30T07:41:07Z
updated_at: 2026-01-31T06:22:12Z
---

## Problem

There's no way to view past messages or prompts within the planning CLI session. The chat history is persisted in `.talos/chat-history.json` with full session and message data, but users can only switch sessions (`/sessions`) or clear them (`/clear`) — they can't actually *read* what was said.

## Context

The infrastructure is already solid:
- `src/planning/chat-history.ts` — Full chat history module with types and accessor functions
- `.talos/chat-history.json` — JSON persistence with sessions, messages
- `src/cli/output.ts` — Already has `formatSessionList()` for session display
- `src/cli/commands.ts` — Command registry, where `/history` would be registered

### ChatMessage type shape

```typescript
// src/planning/chat-history.ts:20-25
interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  toolCalls?: ToolCall[];  // optional — present on assistant messages that invoked tools
}

// src/planning/chat-history.ts:27-33
interface ChatSession {
  id: string;
  name: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}
```

Key accessor functions:
- `getCurrentSession(state): ChatSession | undefined`
- `getSessionsSortedByDate(state): ChatSession[]`

## Proposed Behavior

`/history` or `/hist` — Show recent messages from the current session.

Options:
- `/history` — Show last N messages (default 10) from current session
- `/history <n>` — Show last N messages
- `/history all` — Show all messages in current session

### Display format

```
── History (last 5 messages) ──────────────────

[user] 3 min ago
  can we file a task to make a /history command?

[assistant] 3 min ago
  Let me explore the existing chat history...

[user] 1 min ago
  sounds good, file it

...
```

- Truncate long messages (show first ~3 lines with "..." continuation indicator)
- Use dim text for timestamps
- Use bold/color for role labels (cyan for user, green for assistant)
- System messages shown in dim/italic
- **Tool call messages should be omitted** — filter out messages where `role === 'assistant'` and `toolCalls` is present but `content` is empty. If an assistant message has both `content` and `toolCalls`, show the content but not the tool call details.

## Checklist

- [x] Register `/history` and `/hist` as command aliases in `src/cli/commands.ts`
- [x] Add `isHistoryCommand()` parser that extracts optional count arg
- [x] Implement `handleHistoryCommand()` in `src/cli/plan.ts` (or a new handler file)
- [x] Read messages from `getCurrentSession(state)` and slice to requested count
- [x] Filter messages: omit assistant messages with `toolCalls` but no `content`; for messages with both, show only content
- [x] Add `formatHistory()` display function in `src/cli/output.ts`
- [x] Format messages with role, relative timestamp, and truncated content
- [x] Handle edge case: empty session (print "No messages in this session")
- [x] Add `/history` entry to `/help` output
- [x] Add tests for the command parser and formatter

## Out of Scope (future work)

- Cross-session search (`/history search <term>`) — file as a separate bean if desired
- CLI subcommand (`daedalus history`) — could be added later alongside the slash command

## Changelog

### Implemented
- `/history` and `/hist` slash commands to view past messages in the current planning session
- `parseHistoryArgs()` — parses optional count arg (number or "all", defaults to 10)
- `filterHistoryMessages()` — omits assistant messages with toolCalls but no content
- `formatHistory()` — formats messages with role labels, relative timestamps, and truncated content
- `handleHistory()` — command handler wired into the switch statement in commands.ts
- Tab completion support via COMMAND_NAMES registration
- Help text entry for `/history [n|all]`

### Files Modified
- `src/cli/history.ts` — **NEW**: History command module (parser, filter, formatter)
- `src/cli/history.test.ts` — **NEW**: 27 tests covering parser, filter, formatter, and integration
- `src/cli/commands.ts` — Added `/history` and `/hist` to COMMAND_NAMES, switch case, and handler
- `src/cli/output.ts` — Added `/history [n|all]` entry to `formatHelp()`

### Deviations from Spec
- Named the parser `parseHistoryArgs()` instead of `isHistoryCommand()` — the spec suggested a boolean-style name, but a parser that returns `{ count }` is more useful and descriptive
- Put `formatHistory()` in `src/cli/history.ts` instead of `src/cli/output.ts` — keeps the history module self-contained rather than spreading across files. The formatter reuses `formatRelativeTime()` from output.ts.
- `handleHistoryCommand()` is named `handleHistory()` to match the naming convention of other handlers in commands.ts (e.g., `handleHelp`, `handleMode`, `handleClear`)

### Decisions Made
- Created a dedicated `src/cli/history.ts` module rather than inlining into commands.ts or output.ts — keeps concerns separated and testable
- Used local ANSI color helpers (matching output.ts pattern) rather than importing from output.ts — output.ts doesn't export the `c()` helper
- Default message count is 10 (as specified in the bean)
- Message truncation at 3 lines (as specified)
- Empty session handled both in `handleHistory()` (no session at all) and `formatHistory()` (session with 0 filtered messages)

### Known Limitations
- No cross-session search (explicitly out of scope)
- No CLI subcommand variant (explicitly out of scope)