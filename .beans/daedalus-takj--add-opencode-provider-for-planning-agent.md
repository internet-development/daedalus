---
# daedalus-takj
title: Add OpenCode provider for planning agent
status: todo
type: feature
priority: high
created_at: 2026-01-28T21:45:46Z
updated_at: 2026-01-29T00:13:48Z
parent: daedalus-5k7n
---

Create an OpenCode provider as an alternative to the Claude Code provider for the planning agent. This allows using OpenCode's CLI instead of Claude's CLI for planning sessions.

## Background

The planning agent currently supports:
- `anthropic`/`claude` - Direct Anthropic API
- `openai` - Direct OpenAI API  
- `claude_code` - Claude CLI (`claude` command)

Adding `opencode` as a provider enables using OpenCode's native tools and model routing.

## OpenCode CLI Interface

```bash
# Basic streaming with JSON output
opencode run --format json -m anthropic/claude-sonnet-4-20250514 "message"

# With session continuation
opencode run --format json --session <session-id> "message"

# With custom agent
opencode run --format json --agent <agent-name> "message"
```

## OpenCode JSON Event Format

```typescript
// Text event
{type: "text", part: {text: "Hello..."}}

// Tool use event  
{type: "tool_use", part: {tool: "read", state: {status: "completed", input: {...}, output: "..."}}}

// Step finish event
{type: "step_finish", part: {reason: "stop" | "tool-calls"}}
```

## System Prompt Strategy

OpenCode doesn't have `--append-system-prompt` like Claude CLI. Options:
1. **Prefix message** - Inject system prompt as `<system>...</system>` prefix
2. **Custom agent** - Create OpenCode agent with baked-in system prompt

Start with Option 1 (prefix) for simplicity.

## Files to Create/Modify

- `src/planning/opencode-provider.ts` - New provider (similar to claude-code-provider.ts)
- `src/planning/planning-session.ts` - Add opencode routing
- `src/config/index.ts` - Add 'opencode' to provider enum

## Checklist

- [ ] Create `src/planning/opencode-provider.ts`
  - [ ] OpenCodeProvider class extending EventEmitter
  - [ ] isOpenCodeAvailable() helper
  - [ ] validateProvider() for opencode
  - [ ] Parse OpenCode JSON streaming format
  - [ ] Handle 'text' events → emit 'text'
  - [ ] Handle 'tool_use' events → emit 'toolCall'
  - [ ] Handle 'step_finish' reason 'stop' → emit 'done'
- [ ] Build CLI args: `opencode run --format json -m <model> <prompt>`
- [ ] Inject system prompt as prefix in message
- [ ] Handle cancellation (SIGTERM)
- [ ] Update `src/config/index.ts`
  - [ ] Add 'opencode' to PlanningAgentConfigSchema provider enum
- [ ] Update `src/planning/planning-session.ts`
  - [ ] Add sendMessageViaOpenCode() method
  - [ ] Route to OpenCode when provider === 'opencode'
- [ ] Test basic message streaming
- [ ] Test tool call display
- [ ] Test cancellation with Ctrl+C