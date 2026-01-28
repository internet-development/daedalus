---
# daedalus-kej0
title: Delete src/ui/ directory
status: todo
type: task
created_at: 2026-01-28T04:05:40Z
updated_at: 2026-01-28T04:05:40Z
parent: daedalus-qj38
---

## Summary

Delete the entire `src/ui/` directory containing all Ink-related components, hooks, and views.

## Files to Delete (22 files)

```
src/ui/
├── App.tsx                    # Main Ink app component
├── Header.tsx                 # Header component
├── StatusBar.tsx              # Status bar component
├── TalosContext.tsx           # React context for Talos
├── index.ts                   # UI exports
├── components/
│   ├── ChatHistory.tsx        # Chat message display
│   ├── ChatInput.tsx          # Input component
│   ├── ExpertQuote.tsx        # Expert quote display
│   ├── ModeSelector.tsx       # Mode selection overlay
│   ├── MultipleChoice.tsx     # Multiple choice selector
│   ├── PromptSelector.tsx     # Prompt selection overlay
│   ├── ThinkingIndicator.tsx  # Loading indicator
│   ├── TreeView.tsx           # Bean tree view
│   ├── tree-utils.ts          # Tree rendering utilities
│   └── index.ts               # Components exports
├── hooks/
│   ├── useChatHistory.ts      # Chat history hook (extracted to planning/)
│   ├── usePlanningAgent.ts    # Planning agent hook (extracted to planning/)
│   └── index.ts               # Hooks exports
└── views/
    ├── ExecuteView.tsx        # Execution view
    ├── MonitorView.tsx        # Monitor view
    ├── PlanView.tsx           # Planning view
    └── index.ts               # Views exports
```

## Command

```bash
rm -rf src/ui/
```

## Verification

After deletion:
- `npm run typecheck` should pass (no imports from src/ui/)
- `npm run build` should pass

## Notes

- The logic from `useChatHistory.ts` has been extracted to `src/planning/chat-history.ts`
- The logic from `usePlanningAgent.ts` has been extracted to `src/planning/planning-session.ts`
- Other components are not needed in the new CLI

## Checklist

- [ ] Verify no remaining imports from src/ui/
- [ ] Delete src/ui/ directory
- [ ] Run typecheck to verify
- [ ] Run build to verify