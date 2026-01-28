---
# daedalus-ty5h
title: Simplify Daedalus to planning-first CLI (no Ink)
status: in-progress
type: epic
created_at: 2026-01-28T03:48:42Z
updated_at: 2026-01-28T04:30:00Z
---

## Summary

Complete rewrite of Daedalus from a complex Ink-based TUI to a simple readline-based planning CLI. Remove all Ink dependencies and UI complexity.

## Goals

1. Simple interactive planning via readline (no Ink)
2. Daemon controllable via /start and /stop commands (manual start only)
3. Session management for continuing conversations
4. Modes and custom prompts selectable via flags or /commands
5. AI-generated session naming on quit/SIGTERM

## Architecture

```
$ daedalus [--mode MODE] [--prompt PROMPT] [--new] [--list]

┌─────────────────────────────────────────────────────────────────┐
│ Session Selector (if sessions exist and --new not specified)    │
│   [1] Continue: "Feature planning" (5 msgs, 2h ago)             │
│   [2] Continue: "Bug triage" (12 msgs, yesterday)               │
│   [3] Start new session                                         │
│   Select: _                                                     │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Interactive Loop                                                │
│                                                                 │
│ Planning [Mode: Brainstorm] [Daemon: Stopped]                   │
│ ─────────────────────────────────────────────────────────────   │
│                                                                 │
│ You: I want to add dark mode                                    │
│                                                                 │
│ Planner: Let me research the codebase...                        │
│   [Reading src/theme/...]                                       │
│   Based on my analysis, here are some options:                  │
│   ...                                                           │
│                                                                 │
│ > _                                                             │
│                                                                 │
│ Commands: /help /mode /prompt /start /stop /status /sessions    │
│           /new /clear /tree /quit                               │
└─────────────────────────────────────────────────────────────────┘
```

## CLI Interface

**Flags:**
- `daedalus` - Interactive planning (session selector if sessions exist)
- `daedalus --new` - Start new session directly
- `daedalus --list` - List sessions and exit
- `daedalus --mode brainstorm` - Start with specific mode
- `daedalus --prompt challenge` - Start with specific prompt

**In-session /commands:**

| Command | Description |
|---------|-------------|
| `/help` | Show available commands |
| `/mode [name]` | Show modes or switch to mode |
| `/prompt [name]` | Show prompts or use prompt |
| `/start` | Start background daemon (manual) |
| `/stop` | Stop background daemon |
| `/status` | Show daemon status |
| `/sessions` | List and switch sessions |
| `/new` | Start a new session |
| `/clear` | Clear current session messages |
| `/tree [args]` | Spawn `beans tree` subprocess |
| `/quit` or `/q` | Exit (triggers AI session naming) |

## Key Decisions

1. **No Ink** - Pure readline + console.log for simplicity
2. **Daemon manual start** - User must explicitly /start the daemon
3. **Tree via subprocess** - Spawn `beans tree` instead of reimplementing
4. **Session naming on quit** - AI generates session name when exiting
5. **Config stays talos.yml** - Talos is daemon, Daedalus is interface
6. **No one-shot mode** - Daedalus is always interactive

## What to Keep

| Module | Reason |
|--------|--------|
| `planning/planning-agent.ts` | Vercel AI SDK integration |
| `planning/claude-code-provider.ts` | Claude CLI provider (EventEmitter) |
| `planning/system-prompts.ts` | Mode-specific prompts |
| `planning/prompts.ts` | Custom prompts loader |
| `planning/tools.ts` | Tool definitions |
| `planning/expert-advisor.ts` | Expert consultation |
| `talos/` | Entire daemon (EventEmitter-based) |
| `config/` | Config loading |

## What to Delete

| Directory/File | Count | Reason |
|----------------|-------|--------|
| `src/ui/` | 22 files | All Ink components and hooks |
| `src/index.tsx` | 1 file | Ink app entry |

## What to Create

| File | Purpose |
|------|---------|
| `src/planning/chat-history.ts` | Session persistence (extract from hook) |
| `src/planning/planning-session.ts` | Non-React planning session class |
| `src/cli/output.ts` | Terminal formatting (ANSI colors) |
| `src/cli/session-selector.ts` | Interactive session picker |
| `src/cli/commands.ts` | /command handlers |
| `src/cli/plan.ts` | Main planning loop |
| `src/cli/tree.ts` | Spawn `beans tree` subprocess |
| `src/cli/index.ts` | CLI entry (replaces cli.tsx) |

## Final File Structure

```
src/
├── cli/
│   ├── index.ts              # CLI entry, command routing
│   ├── plan.ts               # Interactive planning loop
│   ├── commands.ts           # /command handlers
│   ├── output.ts             # Terminal formatting (ANSI)
│   ├── session-selector.ts   # Session picker
│   └── tree.ts               # Spawns `beans tree`
├── planning/
│   ├── index.ts              # KEEP - re-exports
│   ├── planning-agent.ts     # KEEP - Vercel AI SDK
│   ├── claude-code-provider.ts # KEEP - Claude CLI provider
│   ├── system-prompts.ts     # KEEP - Mode prompts
│   ├── prompts.ts            # KEEP - Custom prompts
│   ├── tools.ts              # KEEP - Tool definitions
│   ├── expert-advisor.ts     # KEEP - Expert consultation
│   ├── chat-history.ts       # NEW - Session persistence
│   └── planning-session.ts   # NEW - Non-React session class
├── talos/                    # KEEP - All daemon code
└── config/                   # KEEP - Config loading
```
