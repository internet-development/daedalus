---
# daedalus-1kee
title: Implement Static + Active rendering pattern for planning output
status: completed
type: task
created_at: 2026-01-27T09:27:09Z
updated_at: 2026-01-27T09:27:09Z
---

Implemented Ink's <Static> component pattern for plan mode chat output to eliminate flickering during streaming.

## Changes
- **ChatHistory.tsx**: Exported individual message components (UserMessage, AssistantMessage, SystemMessage) and added new StreamingMessage component
- **PlanView.tsx**: Uses <Static items={messages}> for completed messages (never re-render) and <StreamingMessage> for active streaming content (only this re-renders)
- Removed debug logging from usePlanningAgent.ts and PlanView.tsx

## Architecture
```
<Static items={completedMessages}>
  {(msg) => <Message message={msg} />}
</Static>
<StreamingMessage content={streamingContent} />  // Only this re-renders
<ChatInput />
```

## Benefits
- Completed messages never re-render (eliminates flickering for history)
- Only the streaming area updates during streaming
- Follows established pattern used by Jest, Gatsby, and Claude Code