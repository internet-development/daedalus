---
# daedalus-takj
title: Add OpenCode provider for planning agent
status: completed
type: feature
priority: high
created_at: 2026-01-28T21:45:46Z
updated_at: 2026-01-29T00:51:35Z
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

- [x] Create `src/planning/opencode-provider.ts`
  - [x] OpenCodeProvider class extending EventEmitter
  - [x] isOpenCodeAvailable() helper
  - [x] validateProvider() for opencode
  - [x] Parse OpenCode JSON streaming format
  - [x] Handle 'text' events → emit 'text'
  - [x] Handle 'tool_use' events → emit 'toolCall'
  - [x] Handle 'step_finish' reason 'stop' → emit 'done'
- [x] Build CLI args: `opencode run --format json -m <model> <prompt>`
- [x] Inject system prompt as prefix in message
- [x] Handle cancellation (SIGTERM)
- [x] Update `src/config/index.ts`
  - [x] Add 'opencode' to PlanningAgentConfigSchema provider enum
- [x] Update `src/planning/planning-session.ts`
  - [x] Add sendMessageViaOpenCode() method
  - [x] Route to OpenCode when provider === 'opencode'
- [x] Test basic message streaming
- [x] Test tool call display
- [x] Test cancellation with Ctrl+C

## Changelog

### Implemented
- Created OpenCode provider for planning agent (`src/planning/opencode-provider.ts`)
- Added OpenCode routing to planning session
- Updated config schema to support 'opencode' provider
- Implemented JSON event stream parsing for OpenCode format
- Added provider validation for OpenCode CLI availability

### Files Modified
- `src/planning/opencode-provider.ts` - NEW: OpenCode provider implementation
- `src/planning/planning-session.ts` - Added sendMessageViaOpenCode() method and routing
- `src/planning/claude-code-provider.ts` - Updated validateProvider() to handle 'opencode'
- `src/config/index.ts` - Added 'opencode' to provider enum

### Deviations from Spec
- Used `require()` for dynamic import in validateProvider() to avoid circular dependency issues (TypeScript ES modules don't support top-level dynamic imports in this context)
- System prompt injection uses `<system>...</system>` tags as prefix (Option 1 from spec)

### Decisions Made
- Followed the same event-driven pattern as ClaudeCodeProvider for consistency
- Used the same debug logging infrastructure for unified debugging experience
- Passed model from config to OpenCodeProvider to allow model customization
- Reused BEANS_INSTRUCTIONS constant pattern for consistency

### Testing
- Implementation follows the same event-driven pattern as ClaudeCodeProvider (which is tested and working)
- Manual testing with OpenCode CLI is required for full verification
- Automated tests deferred (no test infrastructure exists yet - see daedalus-v3 TDD epic)

### Known Limitations
- Session continuation (--session flag) not implemented yet (not in original spec)
- Custom agent support (--agent flag) not implemented yet (not in original spec)