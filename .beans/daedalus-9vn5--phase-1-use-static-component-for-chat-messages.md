---
# daedalus-9vn5
title: 'Phase 1: Use Static component for chat messages'
status: scrapped
type: task
priority: normal
created_at: 2026-01-28T03:02:55Z
updated_at: 2026-01-28T03:18:16Z
parent: daedalus-qi88
blocking:
    - daedalus-09lr
---

## Summary

Replace custom scroll logic in PlanView with Ink's `<Static>` component for completed messages. This is an experimental change - `<Static>` was documented in ChatHistory.tsx but never implemented. It may not work as expected.

## Goal

- Remove all custom scroll state and logic
- Let terminal scrollback handle history navigation
- Only streaming content should re-render

## Changes

### `src/ui/components/ChatHistory.tsx`

```tsx
// Add Static import
import { Box, Text, Static } from 'ink';

// Update ChatHistory component
export function ChatHistory({ messages, width }: ChatHistoryProps) {
  return (
    <Box flexDirection="column">
      <Static items={messages}>
        {(message, index) => (
          <Box key={message.timestamp || index}>
            {renderMessage(message, index, width)}
          </Box>
        )}
      </Static>
    </Box>
  );
}
```

### `src/ui/views/PlanView.tsx`

Remove:
- `MESSAGES_PER_PAGE` constant (line ~74)
- `scrollOffset` state (line ~112)
- `visibleMessages` useMemo calculation (lines ~122-140)
- Scroll keyboard handlers in `useInput` (up/down/pageUp/pageDown/Home/End)
- Scroll indicators in JSX (`hasMoreAbove`, `hasMoreBelow`, `hiddenAbove`, `hiddenBelow`)

Simplify chat rendering to:
```tsx
{/* Chat history */}
<ChatHistory messages={messages} width={terminalWidth - 8} />

{/* Streaming content */}
{isStreaming && streamingContent && (
  <StreamingMessage content={streamingContent} width={terminalWidth - 8} />
)}
{isStreaming && !streamingContent && (
  <Box marginLeft={2}>
    <ThinkingIndicator />
  </Box>
)}
```

## Checklist

- [ ] Add `Static` import to ChatHistory.tsx
- [ ] Wrap messages in `<Static>` component
- [ ] Remove `MESSAGES_PER_PAGE` constant from PlanView
- [ ] Remove `scrollOffset` state from PlanView
- [ ] Remove `visibleMessages` useMemo from PlanView
- [ ] Remove scroll keyboard handlers from PlanView
- [ ] Remove scroll indicators from PlanView JSX
- [ ] Simplify chat rendering section
- [ ] Test: messages render and terminal scrollback works
- [ ] Test: streaming still works with throttling
- [ ] Test: no flashing/smearing

## Fallback

If `<Static>` doesn't work well:
- Option A: Render all messages without `<Static>`, accept some flicker
- Option B: Consider unmount/remount approach for full terminal control