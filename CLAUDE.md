# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Daedalus v2 is an agentic coding orchestration platform that manages AI agents to execute development work through a bean-driven task system. Built with TypeScript, Ink (React-based terminal UI), and an event-driven architecture designed for eventual migration to Go.

## Commands

```bash
npm run dev          # Start with tsx (development)
npm run build        # Compile TypeScript to dist/
npm run start        # Run compiled version
npm run typecheck    # Type check without emitting
```

## Architecture

### Three Main Layers

**Daemon (src/talos/)** - Core orchestrator
- `talos.ts` - Main coordinator, creates and wires all components
- `beans-client.ts` - Type-safe wrapper for `beans` CLI
- `watcher.ts` - File system monitoring for bean changes
- `scheduler.ts` - Priority queue with dependency resolution
- `agent-runner.ts` - Spawns and manages coding agents
- `completion-handler.ts` - Post-execution task handling

**UI (src/ui/)** - Terminal application
- `App.tsx` - Main shell with view routing (Monitor, Execute, Plan)
- `TalosContext.tsx` - React Context providing daemon state to all components
- `views/` - MonitorView (queue monitoring), ExecuteView (bean execution), PlanView (planning chat)

**Planning (src/planning/)** - Three-layer planning system
- Tools layer: `read_file`, `glob`, `grep`, `bash_readonly`, `beans_cli`
- Prompts layer: Base + mode-specific system prompts
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

### Path Aliases

```typescript
import { BeansClient } from '@talos/beans-client.js';
import { SomeComponent } from '@ui/components/SomeComponent.js';
import { loadConfig } from '@config/index.js';
```

## Code Style

- Strict TypeScript with ES modules (`"type": "module"`)
- File extensions required in imports: `./module.js` (NodeNext resolution)
- React/Ink patterns for terminal UI components
- Zod for runtime config validation

## Beans Integration

All beans interaction is via the `beans` CLI, not direct file manipulation:

```typescript
import { BeansClient } from '@talos/beans-client.js';

const client = new BeansClient();
const beans = await client.getBeans({ status: ['todo', 'in-progress'] });
await client.updateStatus('daedalus-abc1', 'completed');
```

## Configuration

Main config: `talos.yml`
- `agent.backend` - Agent backend (opencode, claude, codex)
- `scheduler.maxConcurrent` - Parallel agent limit
- `planning_agent.provider` - Planning provider (claude_code, anthropic, openai)
- `planning.skills_directory` - Path to skill definitions

## Runtime Data

`.talos/` directory (gitignored):
- `output/` - Agent execution logs
- `chat-history.json` - Planning chat persistence
- `prompts/` - Custom prompts

## Planning Workflow

Two modes for planning work before execution:
1. **Brainstorm** - Socratic questioning for design exploration → creates spec beans
2. **Breakdown** - Task decomposition → creates child task beans (2-5 min each)

Skills in `skills/` define the workflows as portable markdown files.
