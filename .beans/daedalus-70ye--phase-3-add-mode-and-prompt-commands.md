---
# daedalus-70ye
title: 'Phase 3: Add /mode and /prompt commands'
status: scrapped
type: task
priority: normal
created_at: 2026-01-28T03:03:21Z
updated_at: 2026-01-28T03:18:23Z
parent: daedalus-qi88
blocking:
    - daedalus-w63x
---

## Summary

Add `/mode` and `/prompt` commands that trigger the existing mode selector and prompt selector overlays. Keeps keyboard shortcuts (Ctrl+P, Tab) working as well.

## Commands

- `/mode` - Opens mode selector overlay
- `/prompt` - Opens prompt selector overlay
- `/help` - Shows available commands (optional, nice to have)

## Changes

### `src/ui/views/PlanView.tsx`

In `handleSend`, check for commands before sending to agent:

```tsx
const handleSend = useCallback(async (text: string) => {
  const trimmed = text.trim().toLowerCase();
  
  // Handle commands
  if (trimmed === '/mode') {
    setShowModeSelector(true);
    return;
  }
  if (trimmed === '/prompt') {
    setShowPromptSelector(true);
    return;
  }
  if (trimmed === '/sessions') {
    setShowSessionSelector(true);
    return;
  }
  if (trimmed === '/help') {
    // Add a system message with available commands
    addMessage({
      role: 'system',
      content: 'Commands: /mode, /prompt, /sessions, /help',
      timestamp: Date.now(),
    });
    return;
  }
  
  // ... rest of send logic (add user message, send to agent)
}, [...]);
```

## Checklist

- [ ] Add /mode command handling in handleSend
- [ ] Add /prompt command handling in handleSend  
- [ ] Add /sessions command handling in handleSend
- [ ] Add /help command that shows available commands
- [ ] Ensure Ctrl+P still works for prompts
- [ ] Ensure Tab still works for mode cycling
- [ ] Test: /mode opens mode selector
- [ ] Test: /prompt opens prompt selector
- [ ] Test: /help shows command list