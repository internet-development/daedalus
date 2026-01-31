---
# daedalus-6xlg
title: Add /history command to view past messages
status: todo
type: feature
priority: normal
created_at: 2026-01-30T07:41:07Z
updated_at: 2026-01-30T08:43:40Z
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

- [ ] Register `/history` and `/hist` as command aliases in `src/cli/commands.ts`
- [ ] Add `isHistoryCommand()` parser that extracts optional count arg
- [ ] Implement `handleHistoryCommand()` in `src/cli/plan.ts` (or a new handler file)
- [ ] Read messages from `getCurrentSession(state)` and slice to requested count
- [ ] Filter messages: omit assistant messages with `toolCalls` but no `content`; for messages with both, show only content
- [ ] Add `formatHistory()` display function in `src/cli/output.ts`
- [ ] Format messages with role, relative timestamp, and truncated content
- [ ] Handle edge case: empty session (print "No messages in this session")
- [ ] Add `/history` entry to `/help` output
- [ ] Add tests for the command parser and formatter

## Out of Scope (future work)

- Cross-session search (`/history search <term>`) — file as a separate bean if desired
- CLI subcommand (`daedalus history`) — could be added later alongside the slash command