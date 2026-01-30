# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Daedalus is an agentic coding orchestration platform that manages AI agents to execute development work through a bean-driven task system. Built with TypeScript, readline-based CLI, and an event-driven architecture.

## Commands

```bash
npm run dev          # Start with tsx (development)
npm run build        # Compile TypeScript to dist/
npm run start        # Run compiled version
npm run typecheck    # Type check without emitting
npm test             # Run all tests
```

## Architecture

### Three Main Layers

**Daemon (src/talos/)** — Core orchestrator
- `talos.ts` — Main coordinator, creates and wires all components
- `beans-client.ts` — Type-safe wrapper for `beans` CLI
- `watcher.ts` — File system monitoring for bean changes
- `scheduler.ts` — Priority queue with dependency resolution
- `agent-runner.ts` — Spawns and manages coding agents
- `completion-handler.ts` — Post-execution task handling
- `logger.ts` — Structured logging with Pino
- `context.ts` — Correlation IDs and async context
- `daemon-manager.ts` — PID management and daemon lifecycle

**CLI (src/cli/)** — Terminal interface (readline-based, no React/Ink)
- `index.ts` — Main daedalus CLI entry point
- `talos.ts` — Talos daemon CLI (start/stop/status/logs/config)
- `plan.ts` — Interactive planning session with slash commands
- `commands.ts` — Command parser (/help, /mode, /edit, etc.)
- `output.ts` — Terminal formatting and display

**Planning (src/planning/)** — Three-layer planning system
- Tools layer: `read_file`, `glob`, `grep`, `bash_readonly`, `beans_cli`, `consult_experts`
- Prompts layer: Base + mode-specific system prompts (new, refine, critique, sweep, brainstorm, breakdown)
- Skills layer: Portable markdown workflows in `skills/`

### Event-Driven Pattern

All daemon modules extend EventEmitter for loose coupling:

```typescript
export class MyModule extends EventEmitter {
  doThing() {
    this.emit('thing:done', { data });
  }
}
```

## Code Style

- Strict TypeScript with ES modules (`"type": "module"`)
- File extensions required in imports: `./module.js` (NodeNext resolution)
- Readline-based CLI (no React/Ink)
- Zod for runtime config validation

## Beans Integration

All beans interaction is via the `beans` CLI, not direct file manipulation:

```typescript
import { BeansClient } from './talos/beans-client.js';

const client = new BeansClient();
const beans = await client.getBeans({ status: ['todo', 'in-progress'] });
await client.updateStatus('daedalus-abc1', 'completed');
```

## Configuration

Main config: `talos.yml`
- `agent.backend` — Agent backend configuration (claude, opencode, codex)
- `scheduler.maxConcurrent` — Parallel agent limit
- `planning_agent.provider` — Planning provider (claude_code, anthropic, openai, opencode)
- `planning.skills_directory` — Path to skill definitions
- `experts.personas` — List of expert advisor personas

## Runtime Data

`.talos/` directory (gitignored):
- `output/` — Agent execution logs
- `chat-history.json` — Planning chat persistence
- `prompts/` — Custom planning prompts
- `daemon.pid` — Daemon process ID
- `daemon-status.json` — Daemon state

## Planning Workflow

Six modes for planning work:
1. **New** — Create new beans through guided conversation
2. **Refine** — Improve and clarify existing draft beans
3. **Critique** — Run expert review on draft beans
4. **Sweep** — Check consistency across related beans
5. **Brainstorm** — Socratic questioning for design exploration
6. **Breakdown** — Task decomposition into child task beans (2-5 min each)

Nine expert advisor personas are available via the `consult_experts` tool:
pragmatist, architect, skeptic, simplifier, security, researcher, codebase-explorer, ux-reviewer, critic

Skills in `skills/` define reusable workflows as portable markdown files.
