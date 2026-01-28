---
# daedalus-9i8d
title: Create planning-session.ts
status: todo
type: task
created_at: 2026-01-28T04:03:23Z
updated_at: 2026-01-28T04:03:23Z
parent: daedalus-bji1
---

## Summary

Extract planning agent logic from `src/ui/hooks/usePlanningAgent.ts` into an EventEmitter-based class that works without React.

## File

`src/planning/planning-session.ts`

## Class Design

```typescript
import { EventEmitter } from 'events';
import type { PlanningAgentConfig, ExpertsConfig } from '../config/index.js';
import type { ChatMessage, ToolCall } from './chat-history.js';
import type { Bean } from '../talos/beans-client.js';

export type PlanMode = 'new' | 'refine' | 'critique' | 'sweep' | 'brainstorm' | 'breakdown';

export interface PlanningSessionOptions {
  config: PlanningAgentConfig;
  expertsConfig: ExpertsConfig;
  mode?: PlanMode;
  selectedBean?: Bean | null;
}

export interface PlanningSessionEvents {
  'text': (text: string) => void;           // Streaming text chunk
  'toolCall': (tc: ToolCall) => void;       // Tool was called
  'done': (fullContent: string, toolCalls: ToolCall[]) => void;  // Complete
  'error': (error: Error) => void;          // Error occurred
}

export class PlanningSession extends EventEmitter {
  private config: PlanningAgentConfig;
  private expertsConfig: ExpertsConfig;
  private mode: PlanMode;
  private selectedBean: Bean | null;
  private abortController: AbortController | null;
  private claudeCodeProvider: ClaudeCodeProvider | null;
  private streaming: boolean;

  constructor(options: PlanningSessionOptions);

  // Mode management
  setMode(mode: PlanMode): void;
  getMode(): PlanMode;
  setSelectedBean(bean: Bean | null): void;
  getSelectedBean(): Bean | null;

  // Streaming state
  isStreaming(): boolean;

  // Main methods
  async sendMessage(message: string, history: ChatMessage[]): Promise<void>;
  cancel(): void;
}
```

## Implementation Details

### Constructor
- Store config, expertsConfig, mode (default 'new'), selectedBean
- Initialize abortController and claudeCodeProvider as null
- Set streaming to false

### sendMessage(message, history)
1. Cancel any existing stream
2. Set streaming = true
3. Create new AbortController
4. Check provider type (claude_code vs API)
5. For claude_code:
   - Create ClaudeCodeProvider instance
   - Set up event forwarding (text, toolCall, error)
   - On 'done', emit 'done' with full content and tool calls
   - Call provider.send()
6. For API providers (anthropic, openai):
   - Get system prompt via getPlanningAgentSystemPrompt()
   - Get enabled tools
   - Convert history to model messages
   - Call streamText() from Vercel AI SDK
   - Iterate over textStream, emit 'text' events
   - On complete, extract tool calls from steps
   - Emit 'done'
7. Handle errors, emit 'error'
8. Set streaming = false on completion

### cancel()
1. Abort the AbortController
2. Cancel ClaudeCodeProvider if active
3. Set streaming = false

## Reuse From Existing Code

- `ClaudeCodeProvider` class (already EventEmitter-based)
- `getModel()` helper for API providers
- `convertToModelMessages()` for message conversion
- `getPlanningAgentSystemPrompt()` for system prompts
- `getEnabledTools()` for tool definitions

## Source Reference

Extract logic from: `src/ui/hooks/usePlanningAgent.ts` (entire file)

## Checklist

- [ ] Define PlanMode type (or import from system-prompts)
- [ ] Define PlanningSessionOptions interface
- [ ] Define PlanningSessionEvents interface
- [ ] Implement PlanningSession class constructor
- [ ] Implement setMode/getMode
- [ ] Implement setSelectedBean/getSelectedBean
- [ ] Implement isStreaming
- [ ] Implement sendMessage for claude_code provider
- [ ] Implement sendMessage for API providers
- [ ] Implement cancel
- [ ] Add proper TypeScript event typing
- [ ] Add exports to src/planning/index.ts
- [ ] Verify no React imports