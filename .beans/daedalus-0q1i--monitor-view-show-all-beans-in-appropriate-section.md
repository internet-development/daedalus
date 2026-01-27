---
# daedalus-0q1i
title: 'Monitor View: UX improvements (naming, ordering, space utilization)'
status: in-progress
type: bug
priority: normal
created_at: 2026-01-26T23:13:43Z
updated_at: 2026-01-27T01:27:30Z
parent: daedalus-kvgh
---

Monitor View has several UX issues that need improvement to make it more useful and clear.

## Current Issues

1. "QUEUE" label is confusing - doesn't clearly indicate these are todo beans
2. New beans created elsewhere (e.g., Plan View) don't appear until TUI restart
3. IN PROGRESS section is below QUEUE, but it's more important
4. **IN PROGRESS section shows todo beans** - displays beans that are still status: todo, not actually running
5. Draft beans are hidden by default, requiring toggle
6. Lots of empty vertical space not being utilized

## Proposed Changes

### 1. Rename "QUEUE" to "TODO QUEUE"
- Makes it clear these are beans with status: todo
- Differentiates from "in progress" or "scheduled queue"
- File: `src/ui/views/MonitorView.tsx:407`

### 2. Fix IN PROGRESS section to only show running beans
- Currently shows beans from `talos.getInProgress()` which may include "next up" beans
- Should ONLY show beans with status: in-progress that are actively being worked on by an agent
- "Next up" indicator (●) should stay in TODO QUEUE, not appear in IN PROGRESS
- Investigate what `talos.getInProgress()` actually returns
- May need to filter by actual running state, not just "scheduled to run"

Investigation:
- Check `src/talos/talos.ts` - `getInProgress()` method
- Check `src/talos/scheduler.ts` - what gets marked as "in progress"
- Verify: is status being set to 'in-progress' when agent starts?
- Or is it showing "next in queue" beans incorrectly?

### 3. Automatic refresh via Watcher
- Ensure Watcher events propagate properly to MonitorView
- When beans are created/updated elsewhere (Plan View, CLI), MonitorView should update automatically
- Watcher already monitors .beans/ directory - just need proper event flow

Investigation:
- Does Watcher emit events for beans created by Plan View?
- Are events propagated properly to MonitorView state?
- May need to subscribe to additional Talos events

### 4. Move IN PROGRESS to top
Reorder sections to:
1. IN PROGRESS (most important - actively running)
2. TODO QUEUE (what's ready to run)
3. STUCK (needs attention)
4. RECENTLY COMPLETED
5. DRAFTS

File: `src/ui/views/MonitorView.tsx:396-476` (groups array construction)

### 5. Show draft beans by default
- Remove toggle, show drafts automatically
- Keep 'd' hotkey to hide drafts if user wants
- Drafts are useful context, not clutter
- File: `src/ui/views/MonitorView.tsx:296` (showDrafts default to true)

### 6. Add status summary in title bar
- Show counts next to "Daedalus" title: `Daedalus | 5 todo · 2 running · 0 stuck`
- At-a-glance overview without taking extra vertical space
- Update counts in real-time as beans change
- File: `src/ui/App.tsx` or wherever title bar is rendered

### 7. Keep single column layout
- Focus on vertical space improvements instead of multi-column
- Reduce margins between sections for compact display
- Keep all sections visible (even empty) for consistent structure

## Files to Modify

- `src/ui/views/MonitorView.tsx` - Section ordering, drafts default, spacing
- `src/ui/App.tsx` - Title bar with status summary
- `src/talos/talos.ts` - Verify getInProgress() returns only actually running beans
- `src/talos/scheduler.ts` - Check how in-progress state is managed
- `src/talos/watcher.ts` - Verify events propagate for external bean changes

## Implementation Checklist

- [x] Fix IN PROGRESS to only show actually running beans (not "next up")
  - Verified: `talos.getInProgress()` correctly returns only beans with actively running agents
  - The "next up" indicator (●) only appears in TODO QUEUE section
- [x] Rename QUEUE to TODO QUEUE
- [x] Reorder groups (IN PROGRESS first)
- [x] Show drafts by default (flip toggle default)
- [x] Ensure Watcher events propagate to MonitorView for auto-refresh
  - Watcher events flow through Talos → MonitorView via event handlers
  - Added draft refresh on queue-changed and bean-completed events
- [x] Add status summary to title bar (todo · running · stuck counts)
- [x] Reduce vertical spacing between sections
