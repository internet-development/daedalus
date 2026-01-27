---
# daedalus-lhly
title: 'Plan View: AI chat returns ''No output generated'' error'
status: in-progress
type: bug
priority: high
created_at: 2026-01-27T02:18:44Z
updated_at: 2026-01-27T02:38:03Z
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

- [x] Add startup validation in `src/cli.tsx` before TUI launches
  - Check provider from config (`planning_agent.provider`)
  - If `anthropic`/`claude`: verify `ANTHROPIC_API_KEY` is set
  - If `openai`: verify `OPENAI_API_KEY` is set
  - If `claude_code`: verify `claude` CLI is available (future)
- [x] Block launch and show helpful error message
  - Exit with clear message: "Planning agent requires ANTHROPIC_API_KEY. Set it with: export ANTHROPIC_API_KEY=your-key"
  - Include link to Anthropic console for getting API key
  - Suggest `claude_code` backend as alternative (once implemented)
- [x] Fix double error display in `usePlanningAgent.ts:204-208`
  - Remove `setError(error)` call, keep only `onError(error)`
  - Error will show in chat history, not separate error box
- [x] Remove error box from `PlanView.tsx:437-441`
  - No longer needed since errors go to chat history