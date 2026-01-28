---
# daedalus-w63x
title: 'Phase 4: AI-generated session naming'
status: todo
type: task
created_at: 2026-01-28T03:03:37Z
updated_at: 2026-01-28T03:03:37Z
parent: daedalus-qi88
---

## Summary

Automatically generate meaningful session names using the planning agent. Names should update as the conversation progresses to better reflect the topic.

## Behavior

1. New sessions start with default name: "Session N"
2. After ~3 messages, request AI to generate a name
3. Periodically check if name should be updated (e.g., if conversation direction changes significantly)
4. AI generates a 3-5 word descriptive name

## Implementation Options

### Option A: Inline with Planning Agent

After receiving assistant response, check if session needs naming:

```tsx
onMessageComplete: (content, toolCalls) => {
  addMessage({ ... });
  
  // Check if session needs naming
  const session = sessions.find(s => s.id === currentSessionId);
  if (session && session.messages.length >= 3 && session.name.startsWith('Session ')) {
    generateSessionName(session.messages);
  }
}
```

### Option B: Separate Hook

Create `useSessionNaming` hook that watches messages and triggers naming when appropriate.

## Name Generation

Use a one-shot prompt to the planning agent:

```
Generate a 3-5 word name for this planning session based on the conversation below. 
Return ONLY the name, nothing else.

Conversation:
User: I want to add dark mode to the app
Assistant: Let me research the codebase...
```

## Changes

### `src/ui/hooks/useChatHistory.ts`

Add `renameSession` function:

```tsx
const renameSession = useCallback((sessionId: string, newName: string) => {
  setState((prev) => ({
    ...prev,
    sessions: prev.sessions.map((s) =>
      s.id === sessionId ? { ...s, name: newName, updatedAt: Date.now() } : s
    ),
  }));
}, []);
```

### `src/ui/views/PlanView.tsx` or new hook

Add logic to:
1. Check if session needs naming after message complete
2. Call AI to generate name (could reuse planning agent or be simpler)
3. Update session name via `renameSession`

## Checklist

- [ ] Add `renameSession` function to useChatHistory
- [ ] Create name generation prompt
- [ ] Add logic to trigger naming after N messages
- [ ] Call AI to generate session name
- [ ] Update session with generated name
- [ ] Handle errors gracefully (keep default name if generation fails)
- [ ] Consider periodic re-naming if conversation topic shifts
- [ ] Test: new session gets auto-named after 3 messages
- [ ] Test: name appears in session selector