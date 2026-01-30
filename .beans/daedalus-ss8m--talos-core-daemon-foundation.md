---
# daedalus-ss8m
title: 'Talos Core: Daemon Foundation'
status: todo
type: epic
priority: high
created_at: 2026-01-26T05:38:34Z
updated_at: 2026-01-26T08:54:39Z
parent: daedalus-na2v
---

Core daemon functionality for watching beans, scheduling execution, and running agents.

This epic covers the foundational components that make Talos work:
- Beans client for CLI interaction
- File system watcher for change detection
- Scheduler with priority queue and dependency resolution
- Agent runner for spawning coding agents
- Completion handler for post-execution tasks

## Architecture Notes
- Pure TypeScript, no React dependencies
- Event-driven architecture for easy Go migration later
- All beans interaction via `beans graphql --json` CLI