---
# daedalus-na2v
title: 'Daedalus v2: Bean-driven AI Workflow System'
status: completed
type: milestone
priority: high
created_at: 2026-01-26T05:38:28Z
updated_at: 2026-01-27T02:03:56Z
---

Complete rewrite of Daedalus as a bean-driven AI workflow system. Replace the existing agent monitoring dashboard with a new architecture consisting of:

- **Talos**: A daemon that watches beans, schedules execution based on priority/dependencies, and runs agents (opencode/claude/codex)
- **Daedalus TUI**: An Ink-based terminal UI with Monitor, Execute, and Plan views
- **Integrated Planning**: Chat interface for iterating on beans with AI assistance

## Goals
- Automate the draft → todo → in-progress → completed workflow
- Respect bean dependencies (blockedBy relationships)
- Support multiple agent backends
- Auto-commit completed work with bean ID in body
- Handle blockers gracefully (status change + blocker bean creation)

## Success Criteria
- [x] Can watch .beans/ and detect status changes
- [x] Can execute todo beans automatically with configurable agent
- [x] TUI shows real-time bean status and agent output
- [x] Planning mode allows creating/refining beans via chat
- [x] Auto-commits work with proper attribution
