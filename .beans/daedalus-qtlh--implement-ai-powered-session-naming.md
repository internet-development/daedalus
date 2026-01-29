---
# daedalus-qtlh
title: Implement AI-powered session naming
status: completed
type: feature
priority: low
created_at: 2026-01-28T20:07:06Z
updated_at: 2026-01-29T06:41:16Z
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
- [x] Check if `@anthropic-ai/sdk` is available or add it
- [x] Create naming prompt template
- [x] Extract first 2-3 user and assistant messages for context
- [x] Make API call with fast model and 5s timeout
- [x] Parse response, clean up (trim, remove quotes)
- [x] Truncate to 30 chars max
- [x] Fall back to heuristic on any error
- [x] Test: normal exit generates good name
- [x] Test: API timeout falls back gracefully
- [x] Test: short sessions (< 2 messages) skip naming

## Changelog

### Implemented
- Created new `src/cli/session-naming.ts` module with AI-powered session naming
- Uses Vercel AI SDK (`ai` + `@ai-sdk/anthropic`) which was already available
- Implemented `generateNameWithAI()` with 5-second timeout and abort controller
- Implemented `generateNameHeuristic()` as fallback (first 5 words, capitalized)
- Implemented `cleanSessionName()` to sanitize AI output (removes quotes, emoji, special chars)
- Implemented `buildConversationContext()` to extract first 2-3 user/assistant messages
- Updated `plan.ts` to use the new module

### Files Modified
- `src/cli/session-naming.ts` - NEW: AI-powered session naming module
- `src/cli/session-naming.test.ts` - NEW: Comprehensive test suite (33 tests)
- `src/cli/plan.ts` - Updated to use new session-naming module, removed old heuristic code

### Deviations from Spec
- Used `@ai-sdk/anthropic` (Vercel AI SDK) instead of `@anthropic-ai/sdk` (direct SDK) since it was already in the project
- Used `claude-3-5-haiku-latest` model instead of `claude-3-haiku-20240307` (newer, same speed tier)
- Did NOT add `naming_model` config to `talos.yml` - kept it simple with hardcoded model (can be added later if needed)

### Decisions Made
- Created separate module (`session-naming.ts`) for better testability and separation of concerns
- Used `generateText` from AI SDK for simple one-shot call (simpler than streaming)
- Interleaved user/assistant messages in context for better conversation flow
- Limited context to 200 chars per message to keep prompt small

### Known Limitations
- Model is hardcoded (`claude-3-5-haiku-latest`) - not configurable via `talos.yml`
- Requires `ANTHROPIC_API_KEY` environment variable for AI naming to work
- AI naming tests are skipped when API key is not available