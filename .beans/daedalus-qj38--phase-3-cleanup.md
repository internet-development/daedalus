---
# daedalus-qj38
title: 'Phase 3: Cleanup'
status: todo
type: feature
priority: normal
created_at: 2026-01-28T04:02:39Z
updated_at: 2026-01-28T04:02:47Z
parent: daedalus-ty5h
blocking:
    - daedalus-fl9w
---

## Summary

Remove all Ink-related code and dependencies now that the new CLI is working.

## Goal

1. Delete all UI code (22 files)
2. Delete Ink app entry
3. Remove Ink/React from package.json
4. Clean up any remaining references

## Files to Delete

```
src/ui/                    # 22 files total
├── App.tsx
├── Header.tsx
├── StatusBar.tsx
├── TalosContext.tsx
├── index.ts
├── components/
│   ├── ChatHistory.tsx
│   ├── ChatInput.tsx
│   ├── ExpertQuote.tsx
│   ├── ModeSelector.tsx
│   ├── MultipleChoice.tsx
│   ├── PromptSelector.tsx
│   ├── ThinkingIndicator.tsx
│   ├── TreeView.tsx
│   ├── tree-utils.ts
│   └── index.ts
├── hooks/
│   ├── useChatHistory.ts
│   ├── usePlanningAgent.ts
│   └── index.ts
└── views/
    ├── ExecuteView.tsx
    ├── MonitorView.tsx
    ├── PlanView.tsx
    └── index.ts

src/index.tsx              # Ink app entry
src/cli.tsx                # Old CLI entry (replaced by src/cli/index.ts)
```

## Dependencies to Remove

```json
{
  "dependencies": {
    "ink": "^5.2.0",      // REMOVE
    "react": "^18.3.1"    // REMOVE
  },
  "devDependencies": {
    "@types/react": "^18.3.0"  // REMOVE
  }
}
```

## Dependencies

Blocked by Phase 2 - new CLI must be working first

## Acceptance Criteria

- [ ] src/ui/ directory deleted
- [ ] src/index.tsx deleted
- [ ] src/cli.tsx deleted (replaced by src/cli/index.ts)
- [ ] ink, react, @types/react removed from package.json
- [ ] `npm install` succeeds
- [ ] `npm run build` succeeds
- [ ] `npm run typecheck` succeeds