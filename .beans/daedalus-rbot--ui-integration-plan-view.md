---
# daedalus-rbot
title: UI Integration - Plan View
status: todo
type: feature
priority: normal
created_at: 2026-01-26T23:04:03Z
updated_at: 2026-01-27T01:06:12Z
parent: daedalus-19c1
blocking:
    - daedalus-sk55
---

Integrate the new planning modes into the existing Plan View UI.

## Files to modify

- `src/ui/views/PlanView.tsx`

## Tasks

1. Add `brainstorm` and `breakdown` to mode selector (4 existing + 2 new = 6 total)

2. Update mode handling to use new planning agent:
   - Import `createPlanningAgent` from planning-agent.ts
   - Call agent with selected mode
   - Stream responses to UI

3. Add mode-specific UI hints:
   - Brainstorm: "Asking Socratic questions..."
   - Breakdown: "Breaking down into child beans..."

4. Handle bean creation/update responses:
   - Show real-time updates as beans are created
   - Display created bean IDs and titles
   - Update Monitor View when beans change

5. Show skill activation status:
   - Indicate when skill is loaded
   - Show current workflow phase

## Verification

- Mode selector shows 6 modes total
- Switching modes loads correct skill and prompt
- Bean creation shows in real-time
- UI reflects skill workflow progress
- Existing modes (new, refine, critique, sweep) still work
