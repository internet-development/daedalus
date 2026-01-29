# AGENTS.md

Guidelines for AI coding agents working in this repository.

## Project Overview

Daedalus v2 is an agentic coding orchestration platform built with:
- **TypeScript** - Type-safe codebase
- **Ink** - React-based terminal UI
- **Talos** - The core daemon that watches beans and spawns agents

The architecture is event-driven and designed for eventual migration to Go.

## Commands

```bash
npm install          # Install dependencies
npm run dev          # Start with tsx (development)
npm run build        # Compile TypeScript to dist/
npm run start        # Run compiled version
npm run typecheck    # Type check without emitting
```

## Project Structure

```
src/
  cli.tsx           # CLI entry point (with shebang for bin)
  index.tsx         # Main Ink app component
  cli/              # CLI command handlers
    tree.tsx        # Bean tree command
  talos/            # Daemon core
    index.ts        # Exports all daemon modules
    beans-client.ts # Beans CLI interaction
    watcher.ts      # File system watcher
    scheduler.ts    # Priority queue + dependency resolution
    agent-runner.ts # Spawns coding agents
    completion-handler.ts # Post-execution tasks
  ui/               # Ink UI components
    index.ts        # Component exports
  config/           # Configuration loading
    index.ts        # talos.yml loader with Zod validation
```

## Runtime Data

The `.talos/` directory contains runtime data (gitignored):
- `.talos/output/` - Persisted agent output logs
- `.talos/chat-history.json` - Planning chat persistence
- `.talos/prompts/` - Custom planning prompts

## Code Style

### TypeScript

- Strict mode enabled
- Use ES modules (`"type": "module"` in package.json)
- File extensions in imports: `./module.js` (NodeNext resolution)

### React/Ink

```typescript
import React, { useState, useEffect } from 'react';
import { Box, Text, useApp, useInput } from 'ink';

export function MyComponent() {
  const { exit } = useApp();
  const [state, setState] = useState(initial);

  useInput((input, key) => {
    if (input === 'q') exit();
  });

  return (
    <Box flexDirection="column">
      <Text>Hello</Text>
    </Box>
  );
}
```

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
  command: opencode
  args: [run]
  model: anthropic/claude-sonnet-4-20250514

scheduler:
  maxConcurrent: 1

watcher:
  beansDir: .beans

output:
  dir: .talos/output
  autoComplete: false
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

1. **Always include context** - Add relevant fields like `beanId`, `filePath`, `exitCode`
2. **Use appropriate levels** - `debug` for diagnostics, `info` for operations, `error` for failures
3. **Log errors properly** - Use `{ err: error }` for error objects
4. **Use child loggers** - Create one per component for automatic context
5. **Use correlation IDs** - Wrap operations with `withContext` for tracing

```typescript
import { withContext } from './talos/context.js';

await withContext({ beanId }, async () => {
  // All logs here include beanId and correlationId
  logger.info('Starting operation');
});
```

## Key Architectural Decisions

1. **No database** - Beans are the source of truth, stored as files
2. **Event-driven** - Components communicate via events, not direct calls
3. **CLI-first** - All beans interaction via CLI for easy Go migration
4. **Ink for UI** - React patterns in terminal, familiar for web devs
5. **No Zustand** - Using React Context + EventEmitter instead
