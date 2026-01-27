---
# daedalus-2m55
title: 'Planning agent: Add claude_code backend using CLI subscription'
status: completed
type: feature
priority: normal
created_at: 2026-01-27T02:26:58Z
updated_at: 2026-01-27T02:44:03Z
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
- `--append-system-prompt` - append to system prompt
- `--allowedTools` - restrict available tools

### Approach

Spawn `claude --print` as a subprocess (similar to `AgentRunner`), using Claude Code's native tools for codebase access. This is an **alternative provider** - only used when explicitly configured.

### Tool Strategy

Use Claude Code's native tools via `--allowedTools`:
- `Read` - read files (replaces our `read_file`)
- `Glob` - find files (replaces our `glob`)
- `Grep` - search code (replaces our `grep`)
- `Bash` - read-only commands (replaces our `bash_readonly`)

For beans operations, append instructions to system prompt telling it to use `beans` CLI directly via Bash tool.

## Checklist

- [x] Add `claude_code` to `PlanningAgentConfigSchema` provider enum in `src/config/index.ts`
- [x] Create `ClaudeCodeProvider` class or function
  - Spawn `claude --print --output-format stream-json`
  - Pass `--append-system-prompt` with planning agent prompt
  - Use `--allowedTools "Read Glob Grep Bash"` for read-only access
- [x] Adapt streaming interface
  - Parse stream-json output format
  - Convert to same interface as Vercel AI SDK responses
  - Handle tool call reporting (for UI indicators)
- [x] Update startup validation (from daedalus-lhly)
  - Check `which claude` when provider is `claude_code`
  - Show helpful message if claude CLI not found
- [x] Add config example to `talos.yml`
  ```yaml
  planning_agent:
    provider: claude_code  # Uses Claude Code subscription
  ```
- [x] Test end-to-end: prompt → spawn → stream → display

## Config Behavior

- `claude_code` is **only used when explicitly set** in config
- Default remains `claude` (direct API)
- Startup validation checks appropriate credentials for configured provider