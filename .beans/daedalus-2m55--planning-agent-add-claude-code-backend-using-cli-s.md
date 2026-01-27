---
# daedalus-2m55
title: 'Planning agent: Add claude_code backend using CLI subscription'
status: draft
type: feature
priority: normal
created_at: 2026-01-27T02:26:58Z
updated_at: 2026-01-27T02:29:10Z
parent: daedalus-19c1
---

## Summary

Add `claude_code` as a planning agent provider option that uses the `claude` CLI instead of direct API calls. This allows users with Claude Code subscriptions to use the planning agent without needing a separate API key.

## Background

The planning agent currently supports:
- `anthropic`/`claude` - requires `ANTHROPIC_API_KEY`
- `openai` - requires `OPENAI_API_KEY`

Users with Claude Code subscriptions can use `claude --print` for non-interactive AI calls, which uses their subscription instead of API keys.

## Implementation

The `claude` CLI supports:
- `--print` - non-interactive mode
- `--output-format stream-json` - streaming JSON output
- `--input-format stream-json` - streaming input
- `--system-prompt` - custom system prompt

### Approach

Similar to how `AgentRunner` spawns claude/opencode for execution, create a new provider that spawns `claude --print` as a subprocess.

## Checklist

- [ ] Add `claude_code` to `PlanningAgentConfigSchema` provider enum
- [ ] Create `createClaudeCodeModel()` function in `usePlanningAgent.ts`
  - Spawn `claude --print --output-format stream-json`
  - Pass system prompt via `--system-prompt` or `--append-system-prompt`
  - Stream responses back through the existing interface
- [ ] Handle tool calls (may need to use claude's built-in tools or disable for now)
- [ ] Update config validation to check for `claude` CLI when using `claude_code` provider
- [ ] Add config example in talos.yml comments
- [ ] Test streaming response handling

## Notes

- Tool calls may need special handling since claude CLI has its own tool system
- Consider whether to use claude's native tools or disable tools for this backend
- May need to use `--allowedTools` to restrict to read-only operations