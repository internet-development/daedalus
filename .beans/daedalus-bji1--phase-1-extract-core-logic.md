---
# daedalus-bji1
title: 'Phase 1: Extract Core Logic'
status: todo
type: feature
priority: normal
created_at: 2026-01-28T04:02:20Z
updated_at: 2026-01-28T04:02:47Z
parent: daedalus-ty5h
blocking:
    - daedalus-gu7g
---

## Summary

Extract reusable logic from React hooks into pure TypeScript modules. This phase creates the foundation that the new CLI will build upon.

## Goal

Create framework-agnostic modules for:
1. Chat history / session persistence
2. Planning agent interaction
3. Terminal output formatting

## Files to Create

| File | Source | Purpose |
|------|--------|---------|
| `src/planning/chat-history.ts` | `src/ui/hooks/useChatHistory.ts` | Session persistence |
| `src/planning/planning-session.ts` | `src/ui/hooks/usePlanningAgent.ts` | Planning agent class |
| `src/cli/output.ts` | New | ANSI color formatting |

## Dependencies

None - this phase has no external dependencies.

## Acceptance Criteria

- [ ] chat-history.ts can load/save sessions without React
- [ ] planning-session.ts can send messages and stream responses without React
- [ ] output.ts provides all necessary formatting functions
- [ ] All modules have proper TypeScript types
- [ ] No React/Ink imports in new files