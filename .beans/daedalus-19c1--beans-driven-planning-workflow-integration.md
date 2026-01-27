---
# daedalus-19c1
title: Beans-Driven Planning Workflow Integration
status: completed
type: epic
priority: normal
created_at: 2026-01-26T23:02:59Z
updated_at: 2026-01-27T02:01:42Z
parent: daedalus-na2v
---

Integration of superpowers-style planning workflow into daedalus using a three-layer architecture: Tools (what agents can do), System Prompts (how they behave), and Skills (workflows they know).

## Goals

1. Add brainstorm and breakdown modes to Plan View
2. Use Agent Skills format for portable, reusable workflows
3. All planning outputs become beans (not markdown files)
4. Hybrid rigor: systematic planning for complex work, flexible for simple tasks

## Three-Layer Architecture

**Layer 1 - Tools**: Enhanced beansCliTool with relationship management
**Layer 2 - System Prompts**: Mode-specific prompts (base, brainstorm, breakdown)
**Layer 3 - Skills**: Agent Skills format workflows (beans-brainstorming, beans-breakdown, beans-tdd-suggestion)

## Key Features

- Socratic questioning (one at a time, multiple choice preferred)
- Incremental design presentation (200-300 word sections with validation)
- Bean hierarchy creation (epic → feature → task, etc.)
- TDD suggestions (not enforced)
- Exact file paths and verification commands in task beans

## Implementation Checklist

- [ ] daedalus-n4vb: Layer 1 - Enhanced Tools & Client
- [ ] daedalus-11w2: Layer 2 - System Prompts
- [ ] daedalus-rftl: Layer 3 - Agent Skills
- [ ] daedalus-vc04: Integration - Planning Agent
- [ ] daedalus-rbot: UI Integration - Plan View
- [ ] daedalus-k2ha: Configuration
- [ ] daedalus-sk55: Testing & Documentation
