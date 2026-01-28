---
# daedalus-iwc6
title: Add scrollable message history to PlanView
status: in-progress
type: feature
priority: normal
created_at: 2026-01-28T01:01:59Z
updated_at: 2026-01-28T01:28:34Z
---

Add keyboard-controlled scrolling for chat history with auto-scroll behavior, allowing users to review past messages while new content streams in.

## Overview

Implement virtual scrolling that:
- Auto-scrolls to bottom when new messages arrive (only if already at bottom)
- Preserves scroll position when user has scrolled up (don't yank them back)
- Provides keyboard controls for navigation
- Shows indicators when more content is available above/below

## Keyboard Controls

| Key | Action |
|-----|--------|
| ↑ / ↓ | Scroll one line |
| Page Up / Page Down | Scroll one page |
| Home | Jump to start of history |
| End | Jump to bottom (resume auto-scroll) |

## Files to Modify

- **Modify:** `src/ui/views/PlanView.tsx`

## Checklist

- [x] Add `scrollOffset` state with useState
- [x] Import `useStdoutDimensions` and `useInput` from ink (Note: used existing `useStdout` for dimensions)
- [x] Add terminal height calculation (`terminalHeight`, `visibleHeight`)
- [x] Create `estimateMessageLines` helper function
- [x] Add `useMemo` for visible window calculation
- [x] Add `useInput` handler for keyboard scroll controls
- [x] Update chat history rendering to use `visibleMessages`
- [x] Add scroll indicators ("↑ More messages above" / "↓ More messages below")
- [x] Remove `MemoizedChatHistory` wrapper and unused `memo` import
- [x] Run `npm run typecheck` to verify no type errors
- [ ] Test: scroll up/down with arrow keys
- [ ] Test: Page Up/Down scrolls by page
- [ ] Test: End jumps to bottom
- [ ] Test: scroll up, send new message, verify position maintained
- [ ] Commit: `feat(ui): add scrollable message history with keyboard controls`

## Auto-scroll Behavior

The implementation naturally handles auto-scroll:
- `scrollOffset === 0` means user is at bottom → new content appears naturally
- `scrollOffset > 0` means user has scrolled up → position is preserved
- Pressing End sets `scrollOffset = 0`, resuming auto-scroll
