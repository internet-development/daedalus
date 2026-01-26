---
# daedalus-kqdl
title: 'Execute View: Agent output streaming'
status: completed
type: feature
priority: high
created_at: 2026-01-26T05:40:18Z
updated_at: 2026-01-26T10:07:50Z
parent: daedalus-kvgh
---

Display real-time agent output for the currently running bean.

## Layout
```
beans-e5f6: Implement user settings
──────────────────────────────────────────────────────────────────

[Agent] Reading src/components/Settings.tsx...
[Agent] I'll add a new section for user preferences.
[Agent] Creating src/stores/user-preferences.ts...
[Agent] Writing file...
[Agent] Now I'll update the Settings component to use
        the new preferences store.
[Agent] Editing src/components/Settings.tsx...
[Agent] ✓ Added preferences section
[Agent] Updating bean checklist...
│
```

## Decisions

**ANSI handling**: Render ANSI codes. Use ink's built-in support or a library to render colors/formatting from agent output.

**Empty state**: Show last completed output. When no bean is running, display the output from the most recently completed bean with a "Completed" indicator at the top. Output is persisted to `.talos/output/{bean-id}.log` by Orchestrator, so it survives restarts.

**Split view**: No split view. Keep it simple with full-screen scrolling output.

## Checklist
- [x] Create ExecuteView component
- [x] Create OutputPane component with scrolling
- [x] Subscribe to Talos output events
- [x] Render ANSI codes properly (colors, formatting)
- [x] Auto-scroll to bottom on new output
- [x] Support scroll-back (j/k or arrows)
- [x] Show bean title and ID at top
- [x] Show elapsed time (or "Completed Xm ago" for finished)
- [x] Cancel shortcut (c) to abort
- [x] Show last completed bean output when nothing running (via talos.getOutput())
- [x] Implement output buffering (avoid flicker)

## Keyboard Shortcuts
- `c`: Cancel running bean
- `j/k` or arrows: Scroll output
- `g`: Jump to top
- `G`: Jump to bottom
- `Esc`: Back to Monitor
