---
# daedalus-qi88
title: Simplify PlanView with Static component and session management
status: draft
type: epic
priority: normal
created_at: 2026-01-28T02:58:07Z
updated_at: 2026-01-28T03:02:35Z
---

## Summary

Simplify the PlanView chat interface by removing custom scroll logic and using Ink's `<Static>` component for completed messages. Add session management for planning conversations.

## Problem

The current PlanView has complex scroll logic that causes rendering issues (flashing, smearing). This is overengineered - terminals already handle scrollback.

## Solution

### Phase 1: Simplify with `<Static>`

Remove all custom scroll logic and use Ink's built-in `<Static>` component:

- `<Static>` renders items once and never re-renders them
- Completed messages go in `<Static>`, only streaming content re-renders
- Terminal scrollback handles history navigation
- Delete: `scrollOffset`, `estimateMessageLines`, visible window calculations, scroll indicators

### Phase 2: Session Management

Add planning session persistence:

- Store sessions in `.talos/planning-sessions/`
- Session selector when entering Plan view (continue existing or start new)
- Auto-naming: AI generates session name after a few messages
- Session contains: messages, mode, selected bean, metadata

### Phase 3: Mode/Prompt Commands

Make modes and prompts changeable mid-conversation:

- `/mode` command opens mode selector overlay
- `/prompt` command opens prompt selector overlay
- Keyboard shortcuts (Ctrl+P, Tab) still work

## Checklist

### Phase 1: Static Component
- [ ] Update ChatHistory to use `<Static>` for completed messages
- [ ] Remove scroll state and logic from PlanView (`scrollOffset`, `visibleMessages` calculation)
- [ ] Remove `estimateMessageLines` function (already done)
- [ ] Remove scroll keyboard handlers (up/down/pageUp/pageDown)
- [ ] Remove scroll indicators (hasMoreAbove/Below)
- [ ] Test that terminal scrollback works naturally
- [ ] Verify streaming still works with throttling

### Phase 2: Session Management
- [ ] Create session storage structure in `.talos/planning-sessions/`
- [ ] Create Session type and persistence functions
- [ ] Add SessionSelector component (list existing, start new)
- [ ] Integrate session loading into PlanView
- [ ] Add session saving on message complete
- [ ] Implement AI-generated session naming after N messages

### Phase 3: Mode/Prompt Commands
- [ ] Add `/mode` command parsing in chat input
- [ ] Add `/prompt` command parsing in chat input
- [ ] Show mode selector as overlay when `/mode` entered
- [ ] Show prompt selector as overlay when `/prompt` entered
- [ ] Ensure Ctrl+P and Tab shortcuts still work

## Notes

- The `<Static>` approach was documented in ChatHistory.tsx but never implemented
- May need to fall back to unmount/remount if `<Static>` doesn't work well
- Session naming uses the planning agent itself to generate a short name