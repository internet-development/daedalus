---
# daedalus-iwc6
title: Add scrollable message history to PlanView
status: todo
type: feature
priority: normal
created_at: 2026-01-28T01:01:59Z
updated_at: 2026-01-28T01:18:27Z
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

---

## Step 1: Add Scroll State

Add scroll state after other useState calls in PlanView:

```tsx
const [scrollOffset, setScrollOffset] = useState(0);
```

---

## Step 2: Get Terminal Dimensions

Add terminal height calculation (needs `useStdoutDimensions` import from ink):

```tsx
const [, terminalHeight] = useStdoutDimensions();
const visibleHeight = Math.max(terminalHeight - 10, 5); // Reserve space for header/input/padding
```

---

## Step 3: Create Message Line Estimator

Add helper function to estimate how many terminal lines a message occupies:

```tsx
function estimateMessageLines(message: ChatMessage, width: number): number {
  const contentWidth = width - 10; // Account for margins
  const lines = message.content.split('\n');
  let total = 1; // Header line
  for (const line of lines) {
    total += Math.max(1, Math.ceil(line.length / contentWidth));
  }
  return total + 1; // +1 for margin
}
```

---

## Step 4: Calculate Visible Window

Add useMemo to calculate which messages to display:

```tsx
const { visibleMessages, totalContentLines, hasMoreAbove, hasMoreBelow } = useMemo(() => {
  if (messages.length === 0) {
    return { visibleMessages: [], totalContentLines: 0, hasMoreAbove: false, hasMoreBelow: false };
  }

  // Calculate cumulative line counts from bottom
  const messageSizes = messages.map(m => estimateMessageLines(m, terminalWidth - 8));
  const totalLines = messageSizes.reduce((a, b) => a + b, 0);

  // Find visible range based on scrollOffset
  let linesFromBottom = 0;
  let startIdx = messages.length;
  let endIdx = messages.length;

  // Find end index (skip scrollOffset lines from bottom)
  for (let i = messages.length - 1; i >= 0 && linesFromBottom < scrollOffset; i--) {
    linesFromBottom += messageSizes[i];
    endIdx = i;
  }

  // Find start index (include visibleHeight lines)
  let visibleLines = 0;
  for (let i = endIdx - 1; i >= 0 && visibleLines < visibleHeight; i--) {
    visibleLines += messageSizes[i];
    startIdx = i;
  }

  return {
    visibleMessages: messages.slice(startIdx, endIdx),
    totalContentLines: totalLines,
    hasMoreAbove: startIdx > 0,
    hasMoreBelow: scrollOffset > 0,
  };
}, [messages, scrollOffset, visibleHeight, terminalWidth]);
```

---

## Step 5: Add Keyboard Handler

Add useInput handler for scroll controls (needs `useInput` import from ink):

```tsx
useInput((input, key) => {
  // Don't handle scroll keys when choice is pending
  if (pendingChoice) return;

  const maxOffset = Math.max(0, totalContentLines - visibleHeight);

  if (key.upArrow && !key.ctrl) {
    setScrollOffset(o => Math.min(o + 1, maxOffset));
  }
  if (key.downArrow && !key.ctrl) {
    setScrollOffset(o => Math.max(o - 1, 0));
  }
  if (key.pageUp) {
    setScrollOffset(o => Math.min(o + visibleHeight, maxOffset));
  }
  if (key.pageDown) {
    setScrollOffset(o => Math.max(o - visibleHeight, 0));
  }
  if (input === 'Home' || (key.ctrl && key.upArrow)) {
    setScrollOffset(maxOffset);
  }
  if (input === 'End' || (key.ctrl && key.downArrow)) {
    setScrollOffset(0); // Jump to bottom, re-enable auto-scroll
  }
});
```

---

## Step 6: Update Chat History Rendering

Replace the chat history section with windowed rendering:

```tsx
{/* Chat history */}
<Box flexDirection="column" flexGrow={1} overflowY="hidden">
  {messages.length === 0 && !isStreaming ? (
    {/* ... welcome message unchanged ... */}
  ) : (
    <Box flexDirection="column">
      {/* Scroll indicator - above */}
      {hasMoreAbove && (
        <Box marginLeft={2}>
          <Text color="gray" dimColor>↑ More messages above (Page Up to scroll)</Text>
        </Box>
      )}

      {/* Visible messages */}
      <ChatHistory messages={visibleMessages} width={terminalWidth - 8} />

      {/* Active streaming / thinking indicator */}
      {isStreaming && (
        streamingContent ? (
          <StreamingMessage content={streamingContent} width={terminalWidth - 8} />
        ) : (
          <Box marginLeft={2}>
            <ThinkingIndicator />
          </Box>
        )
      )}

      {/* Scroll indicator - below */}
      {hasMoreBelow && (
        <Box marginLeft={2}>
          <Text color="gray" dimColor>↓ More messages below (End to jump to bottom)</Text>
        </Box>
      )}
    </Box>
  )}
</Box>
```

---

## Step 7: Remove MemoizedChatHistory

Remove the MemoizedChatHistory wrapper since we're now using windowing:

```tsx
// Remove this line:
const MemoizedChatHistory = memo(ChatHistory);
```

And remove the `memo` import if no longer used elsewhere.

---

## Checklist

- [ ] Add `scrollOffset` state with useState
- [ ] Import `useStdoutDimensions` and `useInput` from ink
- [ ] Add terminal height calculation (`terminalHeight`, `visibleHeight`)
- [ ] Create `estimateMessageLines` helper function
- [ ] Add `useMemo` for visible window calculation
- [ ] Add `useInput` handler for keyboard scroll controls
- [ ] Update chat history rendering to use `visibleMessages`
- [ ] Add scroll indicators ("↑ More messages above" / "↓ More messages below")
- [ ] Remove `MemoizedChatHistory` wrapper and unused `memo` import
- [ ] Run `npm run typecheck` to verify no type errors
- [ ] Test: scroll up/down with arrow keys
- [ ] Test: Page Up/Down scrolls by page
- [ ] Test: End jumps to bottom
- [ ] Test: scroll up, send new message, verify position maintained
- [ ] Commit: `feat(ui): add scrollable message history with keyboard controls`

---

## Auto-scroll Behavior

The implementation naturally handles auto-scroll:
- `scrollOffset === 0` means user is at bottom → new content appears naturally
- `scrollOffset > 0` means user has scrolled up → position is preserved
- Pressing End sets `scrollOffset = 0`, resuming auto-scroll