---
# daedalus-byrd
title: Dependency Tree Visualization
status: in-progress
type: feature
priority: normal
created_at: 2026-01-26T07:49:14Z
updated_at: 2026-01-26T10:13:00Z
parent: daedalus-ss8m
---

Visualize bean dependencies as a tree structure, both in CLI and in the Monitor View.

## Motivation

Understanding the dependency graph helps with:
- Seeing what's blocking what
- Understanding execution order
- Identifying bottlenecks (beans blocking many others)
- Verifying the plan makes sense before promoting to todo

## Implementation Phases

This feature has two phases - CLI first (can be done early), then TUI integration (after Monitor View exists).

## Phase 1: CLI Script (`talos tree`)

A quick command to print the dependency tree in the terminal:

```bash
$ talos tree daedalus-na2v

daedalus-na2v: Daedalus v2 (milestone) [draft]
├── daedalus-ss8m: Talos Core (epic) [draft]
│   ├── daedalus-ap8h: Project Setup [draft] ← START
│   │   ├── daedalus-a5ja: Beans Client [draft]
│   │   │   ├── daedalus-neut: Watcher [draft]
│   │   │   └── daedalus-waja: Scheduler [draft]
│   │   ├── daedalus-uyd2: Configuration [draft]
│   │   ├── daedalus-zhi7: Agent Runner [draft]
│   │   └── daedalus-j9m4: Completion Handler [draft]
│   └── daedalus-4h5x: Orchestrator [draft]
└── daedalus-kvgh: Daedalus TUI (epic) [draft]
    ├── daedalus-3eaw: TUI Shell [draft]
    │   ├── daedalus-dsj8: Monitor View [draft]
    │   ├── daedalus-kqdl: Execute View [draft]
    │   └── daedalus-dbon: Plan View [draft]
    └── daedalus-byrd: Dependency Tree [draft] ← this bean
```

Options:
- `--blocking`: Show blocking relationships instead of parent/child
- `--status`: Filter by status
- `--compact`: One line per bean (no status)

## Phase 2: Monitor View Integration (after daedalus-dsj8)

Add a toggleable panel or mode in Monitor View that shows:
- Tree view of current milestone/epic
- Highlight current execution path
- Show which beans are ready (unblocked + todo)
- Color-code by status

Toggle with `t` for tree view vs list view.

## Checklist

### Phase 1: CLI Script
- [x] Create `src/cli/tree.ts` command
- [x] Query beans with parent/blocking relationships
- [x] Build tree data structure from flat bean list
- [x] Render tree with Unicode box-drawing characters
- [x] Add status indicators and colors
- [x] Support `--blocking` flag for blocking-based tree
- [x] Support filtering options

### Phase 2: Monitor View Integration
- [x] Add tree view mode toggle (`t` key)
- [x] Create TreeView component
- [x] Reuse tree-building logic from CLI
- [x] Highlight ready-to-execute beans
- [x] Show execution path (what leads to what)
