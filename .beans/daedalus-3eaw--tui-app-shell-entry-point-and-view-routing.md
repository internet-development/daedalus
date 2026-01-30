---
# daedalus-3eaw
title: 'TUI App Shell: Entry point and view routing'
status: todo
type: feature
priority: high
created_at: 2026-01-26T05:39:56Z
updated_at: 2026-01-26T08:54:39Z
parent: daedalus-kvgh
blocking:
    - daedalus-dsj8
    - daedalus-kqdl
    - daedalus-dbon
---

Create the main Ink application shell with view routing, keyboard shortcuts, and status bar.

## Decisions Made

- **Default view**: Smart default - Execute if agent running, otherwise Monitor
- **Terminal layout**: Full height (use entire terminal like vim/htop)
- **State management**: Pass Talos instance via React Context. Components subscribe to Talos EventEmitter events directly using useEffect. Simple and pragmatic - no extra state library needed for a TUI of this size.

## Layout Structure
```
┌─────────────────────────────────────────────────────────────────────┐
│  DAEDALUS                        [Monitor] [Execute] [Plan]    ⚡ N  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  {Current View Content}                                             │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│  [q]uit  [1-3] switch view  {context-specific shortcuts}            │
└─────────────────────────────────────────────────────────────────────┘
```

## Checklist
- [ ] Create src/index.tsx entry point
- [ ] Initialize Talos daemon before rendering
- [ ] Create App.tsx with view state management
- [ ] Implement smart default view (Execute if running, else Monitor)
- [ ] Implement view switching (1=Monitor, 2=Execute, 3=Plan)
- [ ] Create Header component with title and view tabs
- [ ] Create StatusBar component with shortcuts and queue count
- [ ] Create useTalos hook for accessing daemon instance
- [ ] Create TalosContext for providing Talos instance to components
- [ ] Handle quit (q) with graceful shutdown
- [ ] Support terminal resize events (Ink handles this)
- [ ] Add loading state while Talos initializes
- [ ] Use full terminal height

## Keyboard Shortcuts (Global)
- `q`: Quit application
- `1`: Switch to Monitor view
- `2`: Switch to Execute view  
- `3`: Switch to Plan view
- `p`: Pause/resume execution
- `?`: Show help