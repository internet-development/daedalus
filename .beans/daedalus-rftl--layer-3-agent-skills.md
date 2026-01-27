---
# daedalus-rftl
title: Layer 3 - Agent Skills
status: in-progress
type: task
priority: normal
created_at: 2026-01-26T23:04:03Z
updated_at: 2026-01-27T01:41:38Z
parent: daedalus-19c1
blocking:
    - daedalus-vc04
---

Create Agent Skills format skills for beans-driven planning workflows.

## Files to create

- [x] `skills/beans-brainstorming/SKILL.md`
- [x] `skills/beans-brainstorming/references/examples.md`
- [x] `skills/beans-breakdown/SKILL.md`
- [x] `skills/beans-breakdown/references/task-templates.md`
- [x] `skills/beans-tdd-suggestion/SKILL.md`

## Tasks

1. **beans-brainstorming skill:**
   - [x] Frontmatter (name, description, metadata)
   - [x] Phase 1: Socratic questions workflow (one at a time)
   - [x] Phase 2: Incremental design presentation (200-300 word sections)
   - [x] Phase 3: Spec bean creation (any type: epic/feature/bug/milestone/task)
   - [x] Reference examples

2. **beans-breakdown skill:**
   - [x] Frontmatter
   - [x] Phase 1: Context gathering workflow
   - [x] Phase 2: Child bean creation (adapts to parent type)
   - [x] Phase 3: Test bean suggestions (optional)
   - [x] Phase 4: Parent checklist update
   - [x] Reference task templates

3. **beans-tdd-suggestion skill:**
   - [x] When to suggest test beans
   - [x] How to structure test bean descriptions
   - [x] Blocker relationship suggestions

## Verification

- [x] Skills follow Agent Skills spec (valid frontmatter)
- [x] Workflow instructions are clear and actionable
- [x] Example references are helpful
- [x] Can validate with `skills-ref validate ./skills/beans-*`

## Implementation Notes

Created three Agent Skills following the agentskills.io specification:

1. **beans-brainstorming**: Full workflow for Socratic questioning and incremental design
2. **beans-breakdown**: Task decomposition with proper parent-child relationships
3. **beans-tdd-suggestion**: TDD pattern suggestions with blocker relationships

Also updated `src/config/index.ts` to support both skill formats:
- Directory format: `skills/skill-name/SKILL.md` (Agent Skills spec)
- Flat format: `skills/skill-name.md` (backwards compatible)
