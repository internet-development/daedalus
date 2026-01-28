---
# daedalus-rg1d
title: Create chat-history.ts
status: completed
type: task
priority: normal
created_at: 2026-01-28T04:03:05Z
updated_at: 2026-01-28T04:08:54Z
parent: daedalus-bji1
---

## Summary

Extract session persistence logic from `src/ui/hooks/useChatHistory.ts` into a pure TypeScript module.

## File

`src/planning/chat-history.ts`

## Types to Define

```typescript
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  toolCalls?: ToolCall[];
}

export interface ToolCall {
  name: string;
  args?: Record<string, unknown>;
  result?: string;
}

export interface ChatSession {
  id: string;
  name: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

export interface ChatHistoryState {
  currentSessionId: string | null;
  sessions: ChatSession[];
}
```

## Functions to Implement

### File I/O
```typescript
export function getChatHistoryPath(): string
// Search upward for .talos directory, return path to chat-history.json

export function loadChatHistory(): ChatHistoryState
// Load from file, handle legacy formats, return default if not found

export function saveChatHistory(state: ChatHistoryState): void
// Save to file, create directory if needed
```

### Session Operations (return new state, don't mutate)
```typescript
export function generateSessionId(): string
// Create unique session ID: session-{timestamp}-{random}

export function addMessage(state: ChatHistoryState, message: ChatMessage): ChatHistoryState
// Add message to current session, create session if none exists

export function clearMessages(state: ChatHistoryState): ChatHistoryState
// Clear messages in current session

export function switchSession(state: ChatHistoryState, sessionId: string): ChatHistoryState
// Switch to different session

export function createSession(state: ChatHistoryState, name?: string): ChatHistoryState
// Create new session and make it current

export function deleteSession(state: ChatHistoryState, sessionId: string): ChatHistoryState
// Delete session, switch to another if deleting current

export function renameSession(state: ChatHistoryState, sessionId: string, name: string): ChatHistoryState
// Rename a session (for AI-generated names)
```

### Helpers
```typescript
export function getCurrentSession(state: ChatHistoryState): ChatSession | undefined
// Get the current session object

export function getSessionsSortedByDate(state: ChatHistoryState): ChatSession[]
// Return sessions sorted by updatedAt descending (most recent first)
```

## Source Reference

Extract logic from: `src/ui/hooks/useChatHistory.ts` (lines 57-122 for helpers, adapt hook logic)

## Checklist

- [x] Define all types (ChatMessage, ToolCall, ChatSession, ChatHistoryState)
- [x] Implement getChatHistoryPath()
- [x] Implement loadChatHistory()
- [x] Implement saveChatHistory()
- [x] Implement generateSessionId()
- [x] Implement addMessage()
- [x] Implement clearMessages()
- [x] Implement switchSession()
- [x] Implement createSession()
- [x] Implement deleteSession()
- [x] Implement renameSession()
- [x] Implement getCurrentSession()
- [x] Implement getSessionsSortedByDate()
- [x] Add exports to src/planning/index.ts
- [x] Verify no React imports