---
# daedalus-f7od
title: 'Plan View: Replace ctrl+m with Tab to cycle modes'
status: completed
type: bug
priority: normal
created_at: 2026-01-26T23:13:43Z
updated_at: 2026-01-27T01:22:42Z
parent: daedalus-kvgh
---

In Plan View, ctrl+m is supposed to open the mode selector but does not respond.

## Root Cause

ctrl+m maps to ASCII code 13 (carriage return/Enter) in most terminals. The terminal intercepts ctrl+m and interprets it as Enter before it reaches the application. This is standard terminal behavior, not a bug in daedalus.

## Solution: Use Tab to cycle modes

Replaced ctrl+m with Tab key:
- Tab cycles forward through modes (new → refine → critique → sweep → brainstorm → breakdown → new)
- Shift+Tab cycles backward
- Familiar UX pattern from many applications
- Reliable keybinding that works across all terminals

## Implementation Checklist

- [x] Remove ctrl+m handler
- [x] Add Tab handler to cycle forward through modes
- [x] Add Shift+Tab handler to cycle backward (optional)
- [x] Create cycleMode helper function
- [x] Update footer/help text to show Tab shortcut
- [x] Test in multiple terminals (iTerm, Terminal.app, VS Code terminal)

## Changes Made

- `src/ui/views/PlanView.tsx`:
  - Added `brainstorm` and `breakdown` to PlanMode type
  - Created PLAN_MODES constant for cycle order
  - Added `cycleMode` helper function using useCallback
  - Replaced ctrl+m handler with Tab/Shift+Tab handlers
  - Updated footer hints and tips to show Tab shortcut
