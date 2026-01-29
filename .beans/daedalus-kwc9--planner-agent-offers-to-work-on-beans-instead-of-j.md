---
# daedalus-kwc9
title: Planner agent offers to work on beans instead of just planning
status: todo
type: bug
created_at: 2026-01-29T17:12:44Z
updated_at: 2026-01-29T17:12:44Z
---

## Problem

The Planning Agent keeps asking "Would you like me to work on either of these now?" after creating beans. This is incorrect behavior - the Planning Agent is supposed to be a dedicated planning AI that **cannot execute code**. It should only create and refine beans, not offer to implement them.

## Analysis

The bug is caused by missing explicit instructions in the planner prompts. The prompts say the planner "cannot execute code" but never explicitly tell it NOT to offer to start work after creating beans.

### Files involved:

1. **`src/planning/system-prompts.ts`** - Main system prompts for the Planning Agent
   - `basePlanningPrompt` (line 26-84): Says "cannot execute code" but doesn't say "don't offer to work"
   - Each mode prompt needs an explicit instruction

2. **`.opencode/agents/beans.md`** - OpenCode agent config
   - Line 46: Currently says "Switch to the code agent to implement" which is good, but doesn't explicitly prohibit offering to work

3. **`skills/beans-brainstorming/SKILL.md`** - Brainstorming skill
   - Phase 3 (Bean Creation) ends without explicit instructions about what to say/not say after creating

## Solution

Add explicit instructions to the Planning Agent prompts:

1. In `basePlanningPrompt`, add:
   ```
   ## Important Boundaries
   
   - After creating beans, do NOT offer to work on them or implement them
   - Do NOT ask "Would you like me to work on this?" or similar
   - Your job ends when the bean is created - implementation is for execution agents
   - If the user asks you to implement something, remind them you are a planning-only agent
   ```

2. In each mode prompt's closing section, add guidance on what to say after bean creation

3. In the brainstorming skill's Phase 3, add:
   ```
   After creating the bean, confirm creation and stop. Do NOT offer to implement it.
   ```

## Checklist

- [ ] Add "Important Boundaries" section to `basePlanningPrompt` in `src/planning/system-prompts.ts`
- [ ] Update `.opencode/agents/beans.md` to explicitly prohibit offering work
- [ ] Update `skills/beans-brainstorming/SKILL.md` Phase 3 to clarify post-creation behavior
- [ ] Test by creating a new bean and verifying planner doesn't offer to work on it