---
# daedalus-uyd2
title: 'Configuration: talos.yml schema and loading'
status: todo
type: feature
priority: high
created_at: 2026-01-26T05:40:42Z
updated_at: 2026-01-26T08:54:39Z
parent: daedalus-ss8m
blocking:
    - daedalus-4h5x
---

Define and load configuration from talos.yml with Zod validation.

## Decisions Made

- **Missing config**: Use sensible defaults, no config file required to run
- **Environment variables**: No env var overrides - config file only (simpler)
- **Config discovery**: Search upward from cwd for `talos.yml`, similar to how `beans` finds `.beans.yml`
- **Beans discovery**: Look for `.beans/` directory in same location as `talos.yml` (or its parent directories)
- **Commit style**: Conventional commits with type from bean type, scope from epic ancestor
  - `feature` → `feat`, `bug` → `fix`, `task` → `chore`
  - Scope: walk up parent chain to find an epic, use its slug (e.g., `feat(talos-core): Add scheduler`)
  - If no epic ancestor found, omit scope entirely (e.g., `feat: Add scheduler`)

## Configuration Schema
```yaml
# talos.yml (all fields optional, defaults shown)

# Agent backend configuration
agent:
  backend: opencode  # opencode | claude | codex
  opencode:
    model: anthropic/claude-sonnet-4-20250514
  claude:
    model: claude-sonnet-4-20250514
    dangerously_skip_permissions: true
  codex:
    model: codex-mini-latest

# Scheduler settings
scheduler:
  max_parallel: 1
  poll_interval: 1000  # ms
  auto_enqueue_on_startup: true  # Enqueue todo beans on startup

# Completion handling
on_complete:
  auto_commit: true
  push: false
  commit_style:
    # Type derived from bean.type: feature→feat, bug→fix, task→chore
    # Scope derived from parent epic slug
    include_bean_id: true  # Add "Bean: {id}" to commit body

# Blocker handling (uses tags, not status - beans has no 'blocked' status)
on_blocked:
  create_blocker_bean: true  # Create a bug bean blocking this one

# Planning agent (separate from execution agent)
planning_agent:
  provider: claude          # or opencode, openai, etc.
  model: claude-sonnet-4-20250514
  temperature: 0.7          # higher for creative planning
  tools:
    - read_file
    - glob
    - grep
    - bash_readonly         # ls, git status, etc. (no writes)
    - web_search
    - beans_cli

# Expert advisors for planning
experts:
  enabled: true
  personas:
    - pragmatist
    - architect
    - skeptic
    # - simplifier          # can be disabled
    # - security
```

## Commit Message Format
```
{type}({scope}): {bean.title}

{bean.description first paragraph}

Bean: {bean.id}
```

Example:
```
feat(talos-core): Add priority-based scheduler

Implement a priority queue that respects bean dependencies and
supports configurable parallelism.

Bean: daedalus-waja
```

## Checklist
- [ ] Define Zod schema for configuration
- [ ] Create default configuration values (all fields optional)
- [ ] Implement config file loading from talos.yml
- [ ] Search upward for config file (like beans does)
- [ ] Detect `.beans/` directory location (same dir as talos.yml or search upward)
- [ ] Merge with defaults
- [ ] Validate with helpful error messages
- [ ] Export typed TalosConfig interface
- [ ] Export discovered paths (configPath, beansPath, projectRoot)
- [ ] Implement commit type mapping (bean.type → conventional commit type)
- [ ] Implement scope extraction (walk up to find epic ancestor, omit if none)