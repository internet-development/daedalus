---
# daedalus-kvgh
title: 'Daedalus TUI: Terminal Interface'
status: completed
type: epic
priority: high
created_at: 2026-01-26T05:38:38Z
updated_at: 2026-01-27T01:46:24Z
parent: daedalus-na2v
---

Ink-based terminal user interface for monitoring and interacting with Talos.

Three main views:
1. **Monitor View**: Bean list grouped by status, queue information
2. **Execute View**: Streaming agent output for running beans
3. **Plan View**: Chat interface for creating/refining beans with AI

## Design Principles
- Keyboard-first interaction
- Real-time updates from Talos
- Clean, terminal-native aesthetic
- Responsive to terminal size changes