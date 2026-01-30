---
# daedalus-mjez
title: Tag v0.1.0 and create GitHub release
status: todo
type: task
priority: critical
created_at: 2026-01-30T02:18:09Z
updated_at: 2026-01-30T02:18:14Z
parent: daedalus-u7dj
---

## Context

Final step: tag the release and create a GitHub release with notes.

## Prerequisites
All other release tasks must be completed first.

## Steps

1. Ensure all changes are committed
2. Create annotated tag: `git tag -a v0.1.0 -m "Release v0.1.0"`
3. Push tag: `git push origin v0.1.0`
4. Create GitHub release via `gh release create v0.1.0` with release notes

## Release Notes Template
```markdown
## Daedalus v0.1.0

First public release of Daedalus — an AI planning CLI for agentic coding orchestration.

### Features
- Interactive planning agent with multiple modes (new, refine, critique, sweep, brainstorm, breakdown)
- Expert advisor system (9 personas: pragmatist, architect, skeptic, simplifier, security, researcher, codebase-explorer, ux-reviewer, critic)
- Beans integration for issue tracking
- Talos daemon for automated agent orchestration
- Multi-provider support (Anthropic API, OpenAI, Claude Code CLI, OpenCode CLI)
- /edit command for multi-line input via $EDITOR
- Interactive selectors for /mode and /prompt commands
- Skill system for reusable workflows

### Requirements
- Node.js >= 20
- beans CLI
- Claude Code CLI or ANTHROPIC_API_KEY
```

## Checklist
- [ ] All other release tasks completed
- [ ] All changes committed and pushed
- [ ] Create annotated git tag v0.1.0
- [ ] Push tag to origin
- [ ] Create GitHub release with release notes