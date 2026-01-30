---
# daedalus-n6pp
title: Daedalus MCP server for OpenCode integration
status: draft
type: feature
priority: normal
created_at: 2026-01-30T02:09:43Z
updated_at: 2026-01-30T02:09:43Z
---

## Context

When using OpenCode (Crush) as the planning agent provider, Daedalus-specific tools like `consult_experts` are unavailable because OpenCode uses its own native tools (Read, Glob, Grep, Bash, Write, Edit) rather than Daedalus's tool definitions from `tools.ts`.

OpenCode/Crush fully supports MCP (Model Context Protocol) servers via stdio, HTTP, or SSE transports. We can build a Daedalus MCP server that exposes Daedalus-specific tools to OpenCode.

## Approach

Build a stdio-based MCP server within the Daedalus codebase that exposes the `consult_experts` tool (and potentially others in the future). When Daedalus spawns OpenCode as the planning provider, it configures OpenCode to load this MCP server.

### MCP Server (`src/mcp/server.ts`)
- Use `@modelcontextprotocol/sdk` TypeScript SDK
- Expose `consult_experts` tool that returns expert persona prompts from `EXPERT_PROMPTS`
- Use `stdio` transport (simplest for local dev, spawned as child process)
- Input schema: `{ experts: string[], context: string, question?: string }`
- Returns: persona prompts for requested experts + instructions to role-play each perspective

### OpenCode Configuration
- Generate or maintain a `.opencode.json` (or equivalent) that includes the Daedalus MCP server config:
  ```json
  {
    "mcp": {
      "daedalus": {
        "type": "stdio",
        "command": "node",
        "args": ["dist/mcp/server.js"],
        "timeout": 120
      }
    }
  }
  ```
- OpenCode will expose the tool as `mcp_daedalus_consult_experts` (prefixed by server name)

### Integration with OpenCode Provider
- When `OpenCodeProvider` spawns OpenCode, ensure the MCP config is in place
- System prompt should reference the MCP tool name (`mcp_daedalus_consult_experts`) so the agent knows to use it
- beans_cli is NOT needed as MCP — OpenCode has Bash natively, and beans CLI instructions are already injected in the system prompt

## Design Decisions
- **In-repo, not standalone** — MCP server lives in `src/mcp/` as part of the Daedalus codebase
- **stdio transport** — Simplest, no network setup, OpenCode spawns it as a child process
- **Start with one tool** — `consult_experts` only. Add more later if needed.
- **Reusable** — Same MCP server could work with Claude Desktop, Zed, or any MCP client

## Files
- `src/mcp/server.ts` — NEW: MCP server entry point
- `src/mcp/tools.ts` — NEW: Tool definitions for MCP (imports from planning/system-prompts.ts)
- `package.json` — Add `@modelcontextprotocol/sdk` dependency
- `src/planning/opencode-provider.ts` — Ensure MCP config is available when spawning OpenCode
- `src/planning/system-prompts.ts` — Update OpenCode system prompt to reference MCP tool name

## Checklist
- [ ] Install `@modelcontextprotocol/sdk` dependency
- [ ] Create `src/mcp/server.ts` with stdio transport
- [ ] Create `src/mcp/tools.ts` with `consult_experts` tool definition
- [ ] Tool returns expert persona prompts from EXPERT_PROMPTS for requested experts
- [ ] Add MCP server config to OpenCode config file
- [ ] Update OpenCode provider system prompt to reference `mcp_daedalus_consult_experts` tool
- [ ] Add build step for MCP server (`dist/mcp/server.js`)
- [ ] Test: OpenCode loads MCP server and `consult_experts` tool is available
- [ ] Test: Planning agent can invoke `consult_experts` and receives persona prompts
- [ ] Verify typecheck passes: npm run typecheck