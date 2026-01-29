---
# daedalus-xmlb
title: Pressing 'q' on session selector continues session instead of exiting
status: todo
type: bug
priority: normal
created_at: 2026-01-29T17:06:03Z
updated_at: 2026-01-29T17:10:23Z
---

## Problem

When pressing 'q' on the session selector screen (the first screen users see), instead of exiting the application, it continues the current session unexpectedly.

## Expected Behavior

Pressing 'q' should exit the application entirely since this is the first screen and there's no previous context to return to.

## Location

- `src/ui/components/SessionSelector.tsx` - Session selector component

## Checklist

- [ ] Add 'q' key handler to SessionSelector that exits the application
- [ ] Ensure clean exit (no orphaned processes, proper cleanup)
- [ ] Test that 'q' exits cleanly from session selector