---
# daedalus-rftl
title: Layer 3 - Agent Skills
status: todo
type: task
priority: normal
created_at: 2026-01-26T23:04:03Z
updated_at: 2026-01-27T01:06:12Z
parent: daedalus-19c1
blocking:
    - daedalus-vc04
---

Create Agent Skills format skills for beans-driven planning workflows.

## Files to create

- `skills/beans-brainstorming/SKILL.md`
- `skills/beans-brainstorming/references/examples.md`
- `skills/beans-breakdown/SKILL.md`
- `skills/beans-breakdown/references/task-templates.md`
- `skills/beans-tdd-suggestion/SKILL.md`

## Tasks

1. **beans-brainstorming skill:**
   - Frontmatter (name, description, metadata)
   - Phase 1: Socratic questions workflow (one at a time)
   - Phase 2: Incremental design presentation (200-300 word sections)
   - Phase 3: Spec bean creation (any type: epic/feature/bug/milestone/task)
   - Reference examples

2. **beans-breakdown skill:**
   - Frontmatter
   - Phase 1: Context gathering workflow
   - Phase 2: Child bean creation (adapts to parent type)
   - Phase 3: Test bean suggestions (optional)
   - Phase 4: Parent checklist update
   - Reference task templates

3. **beans-tdd-suggestion skill:**
   - When to suggest test beans
   - How to structure test bean descriptions
   - Blocker relationship suggestions

## Verification

- Skills follow Agent Skills spec (valid frontmatter)
- Workflow instructions are clear and actionable
- Example references are helpful
- Can validate with `skills-ref validate ./skills/beans-*`
