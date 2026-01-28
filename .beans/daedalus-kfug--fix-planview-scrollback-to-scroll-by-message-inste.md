---
# daedalus-kfug
title: Fix PlanView scrollback to scroll by message instead of by line
status: scrapped
type: bug
priority: normal
created_at: 2026-01-28T02:18:04Z
updated_at: 2026-01-28T03:03:55Z
---

## Problem

The scrollback in PlanView doesn't scroll properly. The current implementation uses line-based scrolling with estimated line counts, which is unreliable because:

1. **Line estimation is approximate** - `estimateMessageLines()` calculates based on content length and terminal width but doesn't account for:
   - Actual Ink/terminal text wrapping behavior
   - Expert quotes and tool indicators parsed from content
   - Complex markdown or special characters
   - The actual rendered height of components

2. **Scroll offset logic is confusing** - The scroll offset is measured from the bottom in lines, but the algorithm iterates backwards through messages to find visible ranges. This creates a disconnect between the scroll position and what's actually displayed.

3. **Poor UX for chat interfaces** - Users expect to scroll by message (like in Slack, Discord, etc.), not by arbitrary line counts.

## Solution

Change the scrolling mechanism to scroll by message index rather than by estimated line count:
- `scrollOffset` becomes a message index offset from the bottom
- Arrow up/down moves by 1 message at a time
- PageUp/PageDown moves by N messages (where N is based on visible count)
- Home/End jumps to first/last message

## Checklist

- [x] Refactor `scrollOffset` state to represent message index offset from bottom
- [x] Update the `visibleMessages` calculation in useMemo to use message-based windowing
- [x] Update scroll keyboard handlers (up/down/pageUp/pageDown/home/end)
- [x] Remove or repurpose `estimateMessageLines()` function
- [x] Update scroll indicators to show message count instead of line-based hints
- [x] Test scrolling behavior with various message lengths (typecheck + build pass)