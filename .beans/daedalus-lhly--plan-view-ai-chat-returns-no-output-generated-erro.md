---
# daedalus-lhly
title: 'Plan View: AI chat returns ''No output generated'' error'
status: draft
type: bug
priority: normal
created_at: 2026-01-27T02:18:44Z
updated_at: 2026-01-27T02:29:10Z
parent: daedalus-19c1
blocking:
    - daedalus-2m55
---

When asking the plan agent to create a bean, the chat returns:

```
Error: No output generated. Check the stream for errors.
Error: No output generated. Check the stream for errors.
```

(Error appears twice)

User prompt: 'Currently, when in the monitor view we don't see completed beans in the recently completed tab. Can you investigate and help me plan a bug bean.'

## Root Cause Analysis (Completed)

**Primary cause:** `ANTHROPIC_API_KEY` not set in environment. The planning agent defaults to `provider: claude` which uses `@ai-sdk/anthropic`, requiring the API key. Without it, the SDK fails silently and throws `NoOutputGeneratedError`.

**Secondary issue:** Error displays twice because `usePlanningAgent.ts:204-208` calls BOTH:
- `setError(error)` - displays in error box
- `onError(error)` - adds system message to chat

**Error origin:** Vercel AI SDK (`node_modules/ai/dist/index.js`) throws `NoOutputGeneratedError` when `recordedSteps.length === 0`.

## Checklist

- [ ] Add startup validation for planning agent credentials
  - Check if `ANTHROPIC_API_KEY` is set when provider is `anthropic`/`claude`
  - Check if `OPENAI_API_KEY` is set when provider is `openai`
  - Show clear error message in TUI if missing
- [ ] Fix double error display in `usePlanningAgent.ts`
  - Remove either `setError(error)` or `onError(error)` call (not both)
  - Recommend keeping `onError` for chat history, remove separate error box
- [ ] Improve error message for missing API key
  - Catch authentication errors specifically
  - Show "Missing ANTHROPIC_API_KEY" instead of generic "No output generated"