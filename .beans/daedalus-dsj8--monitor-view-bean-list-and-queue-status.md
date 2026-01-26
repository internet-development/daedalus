---
# daedalus-dsj8
title: 'Monitor View: Bean list and queue status'
status: in-progress
type: feature
priority: high
created_at: 2026-01-26T05:40:09Z
updated_at: 2026-01-26T09:54:41Z
parent: daedalus-kvgh
---

Display beans grouped by status with queue information and navigation.

## Layout
```
QUEUE (2 beans)
┌─────────────────────────────────────────────────────────────────┐
│ ● beans-a1b2  Add dark mode toggle       feature  high          │
│ ○ beans-c3d4  Fix login validation       bug      normal        │
└─────────────────────────────────────────────────────────────────┘

IN PROGRESS
┌─────────────────────────────────────────────────────────────────┐
│ ▶ beans-e5f6  Implement user settings    feature                │
│   └─ Running for 3m 42s                                         │
└─────────────────────────────────────────────────────────────────┘

STUCK (1 bean)
┌─────────────────────────────────────────────────────────────────┐
│ ⚠ beans-g7h8  Add OAuth integration      feature   [blocked]    │
│   └─ Blocker: beans-i9j0 (API key missing)                      │
└─────────────────────────────────────────────────────────────────┘
```

## Decisions

**Show completed beans**: Yes, include a "Recently Completed" section showing the last few completed beans.

**Selection behavior**: Show context menu. When pressing Enter on a bean, show a popup menu with context-appropriate options (View output, View details, Cancel, Retry, etc.).

**Draft visibility**: Togglable. Add a keyboard shortcut (e.g., `d`) to toggle draft beans visibility. Hidden by default but accessible when needed.

## Checklist
- [x] Create MonitorView component
- [x] Create BeanList component with grouping
- [x] Create BeanItem component with status icon, title, type, priority
- [x] Subscribe to Talos queue changes
- [x] Show elapsed time for in-progress beans
- [x] Show blocker info for stuck beans (blocked/failed tags)
- [x] Implement navigation (j/k or arrows)
- [x] Implement selection with Enter (show context menu)
- [x] Create BeanContextMenu component with state-appropriate actions
- [x] Show empty states for each group
- [x] Color-code by priority (critical=red, high=yellow, etc)
- [x] Add "Recently Completed" section
- [x] Add toggle for draft visibility (shortcut: d)

## Status Icons
- ○ Queued (todo status)
- ● Next up (first in queue)
- ▶ In progress (running)
- ⚠ Stuck (in-progress with 'blocked' or 'failed' tag)
- ✓ Completed (in recent section)

## Tags shown
- `[blocked]` - agent hit an issue it can't resolve
- `[failed]` - agent crashed or errored

Note: Beans tracker has no 'blocked' status, so we use tags. Stuck beans are `in-progress` status with a tag indicating why they're stuck.
