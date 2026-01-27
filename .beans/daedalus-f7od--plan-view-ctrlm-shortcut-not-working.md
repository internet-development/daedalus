---
# daedalus-f7od
title: 'Plan View: Replace ctrl+m with Tab to cycle modes'
status: todo
type: bug
priority: normal
created_at: 2026-01-26T23:13:43Z
updated_at: 2026-01-27T00:44:13Z
parent: daedalus-kvgh
---

In Plan View, ctrl+m is supposed to open the mode selector but doesn't respond.

## Root Cause

ctrl+m maps to ASCII code 13 (carriage return/Enter) in most terminals. The terminal intercepts ctrl+m and interprets it as Enter before it reaches the application. This is standard terminal behavior, not a bug in daedalus.

## Current Implementation

File: `src/ui/views/PlanView.tsx:196-199`
```typescript
// Ctrl+M: Open mode selector
if (key.ctrl && input === 'm') {
  setShowModeSelector(true);
  return;
}
```

## Solution: Use Tab to cycle modes

Replace ctrl+m with Tab key:
- Tab cycles forward through modes (new → refine → critique → sweep → brainstorm → breakdown → new)
- Shift+Tab cycles backward (optional)
- Familiar UX pattern from many applications
- Reliable keybinding that works across all terminals

## Implementation

1. Replace ctrl+m handler with Tab handler:
```typescript
// Tab: Cycle to next mode
if (key.tab && !key.shift) {
  cycleMode(1);  // forward
  return;
}

// Shift+Tab: Cycle to previous mode (optional)
if (key.tab && key.shift) {
  cycleMode(-1);  // backward
  return;
}
```

2. Add `cycleMode` helper function:
```typescript
const cycleMode = (direction: 1 | -1) => {
  const modes = ['new', 'refine', 'critique', 'sweep', 'brainstorm', 'breakdown'];
  const currentIndex = modes.indexOf(currentMode);
  const nextIndex = (currentIndex + direction + modes.length) % modes.length;
  setMode(modes[nextIndex]);
};
```

3. Update footer hints to show Tab shortcut instead of ctrl+m

## Files to Modify

- `src/ui/views/PlanView.tsx` - Replace ctrl+m with Tab handler, add cycleMode helper

## Implementation Checklist

- [ ] Remove ctrl+m handler
- [ ] Add Tab handler to cycle forward through modes
- [ ] Add Shift+Tab handler to cycle backward (optional)
- [ ] Create cycleMode helper function
- [ ] Update footer/help text to show Tab shortcut
- [ ] Test in multiple terminals (iTerm, Terminal.app, VS Code terminal)
