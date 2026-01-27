---
# daedalus-rbot
title: UI Integration - Plan View
status: in-progress
type: feature
priority: normal
created_at: 2026-01-26T23:04:03Z
updated_at: 2026-01-27T01:55:52Z
parent: daedalus-19c1
blocking:
    - daedalus-sk55
---

Integrate the new planning modes into the existing Plan View UI.

## Files to modify

- `src/ui/views/PlanView.tsx`

## Checklist

- [x] Add `brainstorm` and `breakdown` to mode selector (4 existing + 2 new = 6 total)
- [x] Update mode handling to use planning agent with mode-specific prompts
- [x] Add mode-specific UI hints (brainstorm: "Asking Socratic questions...", breakdown: "Breaking down into child beans...")
- [x] Handle bean creation/update responses (show real-time updates, display created bean IDs)
- [x] Show skill activation status (indicate when skill is loaded, show workflow phase)

## Verification

- Mode selector shows 6 modes total
- Switching modes loads correct skill and prompt
- Bean creation shows in real-time
- UI reflects skill workflow progress
- Existing modes (new, refine, critique, sweep) still work
