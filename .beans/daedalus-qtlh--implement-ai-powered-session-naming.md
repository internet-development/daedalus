---
# daedalus-qtlh
title: Implement AI-powered session naming
status: todo
type: feature
priority: low
created_at: 2026-01-28T20:07:06Z
updated_at: 2026-01-28T20:08:24Z
parent: daedalus-tbsm
---

Use the AI to generate meaningful session names instead of the current heuristic.

## Background
Currently `generateNameWithAI()` has scaffolding for AI naming but falls back to a simple heuristic (first 5 words of first message). The function name is misleading.

## Requirements
- Actually call the AI to generate a concise session name
- Keep it fast (use a fast/cheap model)
- Graceful fallback to heuristic if AI call fails or times out
- Name should be 2-5 words, descriptive of the conversation topic
- No emoji or special characters in names

## Design

### Prompt
```
Summarize this conversation in 2-5 words for use as a session title. 
Return ONLY the title, nothing else. No quotes, no punctuation, no emoji.

Conversation:
User: [first few user messages]
Assistant: [first few assistant messages]
```

### Model selection
Use a fast, cheap model for this task:
- Prefer: `claude-3-haiku` or similar fast model
- Could be configurable in `talos.yml` under `planning_agent.naming_model`
- Timeout: 5 seconds max

### When to generate
- On `/quit` or Ctrl+D exit
- Only if session uses default name (`Session N`)
- Only if session has 2+ messages

### Fallback strategy
1. Try AI naming with 5s timeout
2. On failure/timeout: fall back to current heuristic (first 5 words)
3. On total failure: keep default name

## Implementation Notes

### API call
Could reuse the existing planning agent infrastructure or make a direct API call:
```typescript
// Option 1: Direct Anthropic API call
const response = await anthropic.messages.create({
  model: 'claude-3-haiku-20240307',
  max_tokens: 20,
  messages: [{ role: 'user', content: namingPrompt }],
});

// Option 2: Reuse PlanningSession with different config
// More complex, might not be worth it for a simple one-shot
```

Direct API call is simpler and more appropriate for this use case.

### Current code location
- `src/cli/plan.ts` - `generateNameWithAI()` function (lines 419-445)

## Files to modify
- `src/cli/plan.ts` - implement actual AI call in generateNameWithAI
- `src/config/index.ts` - optionally add `naming_model` config
- `package.json` - may need `@anthropic-ai/sdk` if not already present

## Checklist
- [ ] Check if `@anthropic-ai/sdk` is available or add it
- [ ] Create naming prompt template
- [ ] Extract first 2-3 user and assistant messages for context
- [ ] Make API call with fast model and 5s timeout
- [ ] Parse response, clean up (trim, remove quotes)
- [ ] Truncate to 30 chars max
- [ ] Fall back to heuristic on any error
- [ ] Test: normal exit generates good name
- [ ] Test: API timeout falls back gracefully
- [ ] Test: short sessions (< 2 messages) skip naming