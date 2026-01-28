---
# daedalus-09lr
title: 'Phase 2: Add session selector UI'
status: todo
type: task
priority: normal
created_at: 2026-01-28T03:03:12Z
updated_at: 2026-01-28T03:03:42Z
parent: daedalus-qi88
blocking:
    - daedalus-70ye
---

## Summary

Add a session selector that shows when entering PlanView. Users can continue an existing session or start a new one. Also add `/sessions` command to show selector mid-conversation.

## Design

### Session Selector UI

```
Planning Sessions
─────────────────────────────
↑/↓ to select, Enter to confirm

● Continue: "Dark mode feature" (5 msgs, 2h ago)
  Continue: "Auth refactor" (12 msgs, yesterday)
  + Start new session

[Esc] Back to views
```

- Sessions sorted by most recent first
- First option auto-selected
- Arrow keys to navigate, Enter to select
- Esc to go back to view router

### Triggering

1. **On PlanView enter**: Show selector (sorted by recency, most recent pre-selected)
2. **`/sessions` command**: Show selector mid-conversation

## Changes

### New File: `src/ui/components/SessionSelector.tsx`

```tsx
interface SessionSelectorProps {
  sessions: ChatSession[];
  currentSessionId: string | null;
  onSelect: (sessionId: string) => void;
  onCreate: () => void;
  onCancel: () => void;
}

export function SessionSelector({ ... }: SessionSelectorProps) {
  // Arrow key navigation
  // Sorted by updatedAt desc
  // "+ Start new session" option at end
}
```

### `src/ui/views/PlanView.tsx`

- Add `showSessionSelector` state, default to `true` when entering view
- Render SessionSelector overlay when `showSessionSelector` is true
- In `handleSend`, check for `/sessions` command

### `src/ui/hooks/useChatHistory.ts`

Already has:
- `sessions` - list of all sessions
- `switchSession(id)` - switch to session
- `createSession(name?)` - create new session
- `currentSessionId` - current session

No changes needed to the hook.

## Checklist

- [ ] Create SessionSelector component with keyboard navigation
- [ ] Sort sessions by `updatedAt` descending
- [ ] Add "+ Start new session" option
- [ ] Add `showSessionSelector` state to PlanView
- [ ] Show SessionSelector on PlanView mount
- [ ] Handle session selection (switch + close selector)
- [ ] Handle new session creation
- [ ] Add `/sessions` command parsing in handleSend
- [ ] Test: can continue existing session
- [ ] Test: can create new session
- [ ] Test: /sessions command works mid-chat