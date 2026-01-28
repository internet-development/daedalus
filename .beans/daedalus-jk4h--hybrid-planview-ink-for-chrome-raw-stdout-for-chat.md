---
# daedalus-jk4h
title: 'Hybrid PlanView: Ink for chrome, raw stdout for chat'
status: in-progress
type: feature
priority: normal
tags:
    - failed
created_at: 2026-01-28T03:25:42Z
updated_at: 2026-01-28T03:31:51Z
---

## Summary

Rewrite PlanView to use a hybrid approach:
- Ink renders header, footer, mode indicator, and overlays (selectors)
- Chat messages are written directly to stdout (no Ink rendering)
- User input via Ink's useInput or raw readline

This avoids Ink's limitations with scrolling/overflow while keeping the nice UI chrome.

## Approach

### Architecture

```
┌─────────────────────────────────────┐
│ [Ink] Header: Plan [Mode: New]      │
├─────────────────────────────────────┤
│                                     │
│ [Raw stdout] Chat messages          │
│ - Written with console.log/write    │
│ - Terminal handles scrollback       │
│ - No Ink re-rendering               │
│                                     │
├─────────────────────────────────────┤
│ [Ink] Input area + footer hints     │
└─────────────────────────────────────┘
```

### Key Insight

Ink's `useStdout().write()` can write directly to stdout while preserving Ink's output. This lets us:
1. Keep Ink for the UI chrome (header, input, footer)
2. Write chat messages directly above Ink's rendered area
3. Let terminal scrollback handle history

### Implementation

1. Use `useStdout().write()` to output completed messages
2. Keep streaming content in Ink (it's temporary anyway)
3. When message completes, write it to stdout and clear from Ink state
4. Overlays (mode selector, prompt selector) still work via Ink

## Checklist

- [x] Refactor PlanView to use useStdout().write() for completed messages
- [x] Keep only streaming content in Ink render
- [x] Remove scroll state and keyboard handlers
- [x] Add formatMessageForStdout helper with ANSI colors
- [x] Track written messages to avoid duplicates
- [x] Clear tracking on chat clear
- [ ] Test that messages persist via terminal scrollback
- [ ] Test that overlays still work
- [ ] Test input handling
- [ ] Verify no crashes on long conversations