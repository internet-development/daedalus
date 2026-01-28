---
# daedalus-ugb4
title: Add braille spinner loading indicator
status: completed
type: feature
priority: normal
created_at: 2026-01-28T01:01:53Z
updated_at: 2026-01-28T01:30:21Z
---

Add a ThinkingIndicator component that shows an animated braille spinner (⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏) while the AI is processing, before streaming content starts appearing.

## Overview

When `isStreaming` is true but `streamingContent` is empty, the AI is "thinking" (processing the request before generating output). During this phase, show an animated braille spinner to indicate activity.

## Files to Create/Modify

- **Create:** `src/ui/components/ThinkingIndicator.tsx`
- **Modify:** `src/ui/views/PlanView.tsx`

---

## Step 1: Create ThinkingIndicator Component

Create `src/ui/components/ThinkingIndicator.tsx`:

```tsx
import React, { useState, useEffect } from 'react';
import { Text } from 'ink';

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
const FRAME_INTERVAL = 80;

export function ThinkingIndicator() {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setFrame(f => (f + 1) % SPINNER_FRAMES.length);
    }, FRAME_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  return (
    <Text color="cyan">
      {SPINNER_FRAMES[frame]} Thinking...
    </Text>
  );
}
```

---

## Step 2: Add Import to PlanView

In `src/ui/views/PlanView.tsx`, add the import near the top with other component imports:

```tsx
import { ThinkingIndicator } from '../components/ThinkingIndicator.js';
```

---

## Step 3: Update Streaming Render Section

In `src/ui/views/PlanView.tsx`, find the streaming message section (around line 471-474):

**Replace:**
```tsx
{isStreaming && (
  <StreamingMessage content={streamingContent} width={terminalWidth - 8} />
)}
```

**With:**
```tsx
{isStreaming && (
  streamingContent ? (
    <StreamingMessage content={streamingContent} width={terminalWidth - 8} />
  ) : (
    <Box marginLeft={2}>
      <ThinkingIndicator />
    </Box>
  )
)}
```

---

## Checklist

- [x] Create `src/ui/components/ThinkingIndicator.tsx` with the component code
- [x] In `src/ui/views/PlanView.tsx`, add import for ThinkingIndicator
- [x] Update streaming render section to show ThinkingIndicator when `isStreaming && !streamingContent`
- [x] Run `npm run typecheck` to verify no type errors
- [x] Test: send a message, verify spinner shows before text streams
- [x] Test: verify spinner disappears when streaming content starts appearing
- [x] Commit: `feat(ui): add braille spinner loading indicator`

---

## Verification

1. Run `npm run dev`
2. Enter plan mode and send a message
3. Observe:
   - Spinner should appear immediately when AI starts processing
   - Spinner should disappear when text starts streaming
   - Animation should be smooth (80ms frame rate)