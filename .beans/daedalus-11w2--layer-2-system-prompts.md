---
# daedalus-11w2
title: Layer 2 - System Prompts
status: completed
type: task
priority: normal
created_at: 2026-01-26T23:04:03Z
updated_at: 2026-01-27T01:33:08Z
parent: daedalus-19c1
blocking:
    - daedalus-rftl
---

Create mode-specific system prompts for the planning agent.

## Files to modify

- `src/planning/system-prompts.ts`

## Tasks

1. [x] Add `basePlanningPrompt` (shared foundation for all modes)
2. [x] Add `brainstormModePrompt` (extends base, adds Socratic workflow)
3. [x] Add `breakdownModePrompt` (extends base, adds task breakdown workflow)
4. [x] Export all prompts for use in planning agent

## Prompt Structure

**Base prompt:**
- Role: planning assistant
- Goal: break down work into beans
- Tools: beans_cli
- Behavior: clear descriptions, exact file paths, ask when uncertain

**Brainstorm prompt:**
- Socratic questions (one at a time, prefer multiple choice)
- 200-300 word sections with validation checkpoints
- Works for any bean type needing design (epic/feature/bug/milestone)

**Breakdown prompt:**
- Adapts to parent bean type
- Epic → Features, Feature → Tasks, Bug → Tasks, Milestone → Epics/Features
- 2-5 minute granularity for tasks
- Exact file paths, verification commands, test suggestions

## Verification

- [x] Prompts are composable (mode prompts extend base)
- [x] Each mode has clear goals and process steps
- [x] Prompts reference beans_cli tool correctly
