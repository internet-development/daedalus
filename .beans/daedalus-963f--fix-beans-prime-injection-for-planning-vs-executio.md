---
# daedalus-963f
title: Fix beans prime injection for planning vs execution agents
status: completed
type: bug
priority: high
created_at: 2026-01-28T23:27:37Z
updated_at: 2026-01-29T00:13:18Z
parent: daedalus-5k7n
---

## Problem

The `beans prime` output is injected into ALL agents via the OpenCode plugin at `~/.config/opencode/plugins/beans-prime.ts`. This causes the beans planning agent to suggest executing work when it should only plan.

## Solution Implemented

### 1. Updated beans.md agent
Added explicit override to ignore beans prime execution instructions.

### 2. Created code.md agent
New implementation agent with:
- TDD workflow built-in
- Changelog requirement before completion
- Bean workflow (pick up → implement → update → complete)

### 3. Updated ralph-loop.sh
- Uses `--agent code` flag to invoke the code agent
- Simplified prompts (TDD/changelog logic now in agent, not script)
- Updated model default to use alias `anthropic/claude-sonnet-4-5`
- Added `OPENCODE_AGENT` env var for customization

## Workflow

```
beans agent → create/refine specs and plans
code agent  → implement the specs with TDD
build agent → general development (default OpenCode)
```

## Checklist
- [x] Add override to beans.md agent to ignore execution instructions
- [x] Create code.md agent with implementation workflow
- [x] Add changelog requirement to code.md agent
- [x] Update ralph-loop.sh to use code agent
- [x] Simplify ralph-loop.sh prompts (defer to agent)
- [x] Update model defaults to use aliases
- [ ] Test that beans agent no longer suggests execution
- [ ] Test that code agent properly implements beans with TDD
- [ ] Test ralph-loop.sh with code agent
- [ ] Document the agent workflow in project README or AGENTS.md