# AGENTS.md

Guidelines for AI coding agents working in this repository.

## Project Overview

Daedalus is an agentic coding orchestration platform built with:
- **TypeScript** — Type-safe codebase with strict mode
- **Readline CLI** — Terminal interface (no React/Ink)
- **Talos** — The core daemon that watches beans and spawns coding agents

The architecture is event-driven with loose coupling via EventEmitter.

## Commands

```bash
npm install          # Install dependencies
npm run dev          # Start with tsx (development)
npm run build        # Compile TypeScript to dist/
npm run start        # Run compiled version
npm run typecheck    # Type check without emitting
npm test             # Run all tests
```

## Project Structure

```
src/
  cli/              # CLI entry point and commands
    index.ts        # Main daedalus CLI (readline-based)
    talos.ts        # Talos daemon CLI (start/stop/status/logs/config)
    plan.ts         # Interactive planning session
    commands.ts     # Command parser (/help, /mode, /edit, etc.)
    output.ts       # Terminal formatting and display
    tree-simple.ts  # Bean tree visualization
  talos/            # Daemon core
    talos.ts        # Main coordinator, wires all components
    beans-client.ts # Beans CLI interaction (type-safe wrapper)
    watcher.ts      # File system watcher for bean changes
    scheduler.ts    # Priority queue + dependency resolution
    agent-runner.ts # Spawns coding agents (Claude, OpenCode, Codex)
    completion-handler.ts # Post-execution tasks
    logger.ts       # Structured logging with Pino
    context.ts      # Correlation IDs and async context
    daemon-manager.ts # PID management and daemon lifecycle
  planning/         # Planning agent system
    planning-agent.ts    # Multi-provider AI agent (Anthropic, OpenAI)
    planning-session.ts  # Session management and message handling
    system-prompts.ts    # Mode-specific system prompts + expert personas
    tools.ts             # Planning tools (read_file, glob, grep, beans_cli)
    chat-history.ts      # Chat persistence to .talos/chat-history.json
  config/           # Configuration loading
    index.ts        # talos.yml loader with Zod validation
  utils/            # Shared utilities
    string-helpers.ts
  test-utils/       # Test utilities (real code, not mocks)
    beans-fixtures.ts  # Create real bean files for testing
    cli-helpers.ts     # Capture CLI output and exit codes
    event-helpers.ts   # Test EventEmitter-based code
    async-helpers.ts   # Wait for conditions and delays
    fs-helpers.ts      # Temporary directories and file operations
```

## Runtime Data

The `.talos/` directory contains runtime data (gitignored):
- `.talos/output/` — Persisted agent output logs
- `.talos/chat-history.json` — Planning chat persistence
- `.talos/prompts/` — Custom planning prompts
- `.talos/daemon.pid` — Daemon process ID
- `.talos/daemon-status.json` — Daemon state

## Code Style

### TypeScript

- Strict mode enabled
- Use ES modules (`"type": "module"` in package.json)
- File extensions in imports: `./module.js` (NodeNext resolution)

### Event-Driven Pattern

All daemon modules extend EventEmitter for loose coupling:

```typescript
import { EventEmitter } from 'events';

export class MyModule extends EventEmitter {
  doThing() {
    this.emit('thing:done', { data });
  }
}

// Usage
const mod = new MyModule();
mod.on('thing:done', (data) => console.log(data));
```

## Beans Integration

All beans interaction is via the `beans` CLI:

```typescript
import { BeansClient } from './talos/beans-client.js';

const client = new BeansClient();

// Query beans
const beans = await client.getBeans({ status: ['todo', 'in-progress'] });

// Update status
await client.updateStatus('daedalus-abc1', 'completed');
```

## Configuration

Configuration is loaded from `talos.yml`:

```yaml
agent:
  backend:
    claude:
      model: claude-sonnet-4-20250514

scheduler:
  maxConcurrent: 1

planning_agent:
  provider: claude_code
  model: claude-sonnet-4-20250514

planning:
  skills_directory: ./skills
  modes:
    brainstorm:
      enabled: true
      skill: beans-brainstorming
    breakdown:
      enabled: true
      skill: beans-breakdown
```

## Logging

Use structured logging with Pino. See [docs/logging.md](docs/logging.md) for full documentation.

```typescript
import { logger } from './talos/logger.js';

// Good: Structured with context
logger.info({ beanId, status }, 'Bean status changed');

// Bad: Unstructured
logger.info(`Bean ${beanId} status: ${status}`);

// Use child loggers for components
const myLogger = logger.child({ component: 'my-component' });
```

### Key Patterns

1. **Always include context** — Add relevant fields like `beanId`, `filePath`, `exitCode`
2. **Use appropriate levels** — `debug` for diagnostics, `info` for operations, `error` for failures
3. **Log errors properly** — Use `{ err: error }` for error objects
4. **Use child loggers** — Create one per component for automatic context
5. **Use correlation IDs** — Wrap operations with `withContext` for tracing

```typescript
import { withContext } from './talos/context.js';

await withContext({ beanId }, async () => {
  // All logs here include beanId and correlationId
  logger.info('Starting operation');
});
```

## Key Architectural Decisions

1. **No database** — Beans are the source of truth, stored as files
2. **Event-driven** — Components communicate via events, not direct calls
3. **CLI-first** — All beans interaction via CLI, all UI via readline
4. **Zod validation** — Runtime config validation with Zod schemas
5. **Real tests** — Test utilities use real code, not mocks
