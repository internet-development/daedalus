---
# daedalus-kgmw
title: Create commands.ts
status: todo
type: task
created_at: 2026-01-28T04:04:19Z
updated_at: 2026-01-28T04:04:19Z
parent: daedalus-gu7g
---

## Summary

Implement all /command handlers for the interactive planning session.

## File

`src/cli/commands.ts`

## Command Context

```typescript
import type { PlanningSession } from '../planning/planning-session.js';
import type { ChatHistoryState } from '../planning/chat-history.js';
import type { Talos } from '../talos/talos.js';
import type { CustomPrompt } from '../planning/prompts.js';
import type * as readline from 'readline';

export interface CommandContext {
  session: PlanningSession;
  history: ChatHistoryState;
  talos: Talos | null;  // null if not started
  prompts: CustomPrompt[];
  rl: readline.Interface;
  saveHistory: () => void;  // Save current history state
}

export type CommandResult =
  | { type: 'continue' }                                    // Keep chatting
  | { type: 'quit'; generateName: boolean }                 // Exit
  | { type: 'send'; message: string }                       // Send message to agent
  | { type: 'update-history'; state: ChatHistoryState }     // Update session state
  | { type: 'switch-session'; sessionId: string }           // Switch to different session
  | { type: 'new-session' };                                // Create new session
```

## Main Handler

```typescript
export async function handleCommand(
  input: string,
  ctx: CommandContext
): Promise<CommandResult>
// Parse input, dispatch to appropriate handler
// Return CommandResult indicating what to do next
```

## Commands to Implement

| Command | Function | Description |
|---------|----------|-------------|
| `/help` | `handleHelp()` | Print help text |
| `/mode [name]` | `handleMode(args, ctx)` | List modes or switch |
| `/prompt [name]` | `handlePrompt(args, ctx)` | List prompts or use one |
| `/start` | `handleStart(ctx)` | Start Talos daemon |
| `/stop` | `handleStop(ctx)` | Stop Talos daemon |
| `/status` | `handleStatus(ctx)` | Show daemon status |
| `/sessions` | `handleSessions(ctx)` | List/switch sessions |
| `/new` | `handleNew(ctx)` | Create new session |
| `/clear` | `handleClear(ctx)` | Clear current session |
| `/tree [args]` | `handleTree(args)` | Spawn `beans tree` |
| `/quit` `/q` | `handleQuit()` | Exit planning |

## Handler Implementations

### /help
```typescript
function handleHelp(): CommandResult {
  console.log(formatHelp());
  return { type: 'continue' };
}
```

### /mode [name]
```typescript
function handleMode(args: string, ctx: CommandContext): CommandResult {
  if (!args) {
    // List all modes
    console.log(formatModeList(ctx.session.getMode()));
    return { type: 'continue' };
  }
  // Switch to mode
  const mode = args.trim().toLowerCase() as PlanMode;
  if (!isValidMode(mode)) {
    console.log(formatError(`Unknown mode: ${args}`));
    return { type: 'continue' };
  }
  ctx.session.setMode(mode);
  console.log(`Switched to mode: ${mode}`);
  return { type: 'continue' };
}
```

### /prompt [name]
```typescript
async function handlePrompt(args: string, ctx: CommandContext): Promise<CommandResult> {
  if (!args) {
    // List all prompts
    console.log(formatPromptList(ctx.prompts));
    return { type: 'continue' };
  }
  // Find and use prompt
  const prompt = ctx.prompts.find(p => 
    p.name.toLowerCase() === args.trim().toLowerCase()
  );
  if (!prompt) {
    console.log(formatError(`Unknown prompt: ${args}`));
    return { type: 'continue' };
  }
  return { type: 'send', message: prompt.content };
}
```

### /start
```typescript
async function handleStart(ctx: CommandContext): Promise<CommandResult> {
  if (ctx.talos) {
    console.log('Daemon is already running.');
    return { type: 'continue' };
  }
  // Start daemon - this will need to be handled by the caller
  // since we need to create the Talos instance
  console.log('Starting daemon...');
  // Signal to caller to start daemon
  return { type: 'continue' };  // Caller handles actual start
}
```

### /stop
```typescript
async function handleStop(ctx: CommandContext): Promise<CommandResult> {
  if (!ctx.talos) {
    console.log('Daemon is not running.');
    return { type: 'continue' };
  }
  await ctx.talos.stop();
  console.log('Daemon stopped.');
  return { type: 'continue' };
}
```

### /status
```typescript
function handleStatus(ctx: CommandContext): CommandResult {
  if (!ctx.talos) {
    console.log('Daemon is not running. Use /start to start it.');
    return { type: 'continue' };
  }
  const queue = ctx.talos.getQueue();
  const running = Array.from(ctx.talos.getInProgress().values());
  const stuck = ctx.talos.getStuck();
  console.log(formatStatus(true, queue, running, stuck));
  return { type: 'continue' };
}
```

### /sessions
```typescript
async function handleSessions(ctx: CommandContext): Promise<CommandResult> {
  // Show session selector
  const selection = await selectSession(
    ctx.history.sessions,
    ctx.history.currentSessionId
  );
  if (selection.action === 'new') {
    return { type: 'new-session' };
  }
  return { type: 'switch-session', sessionId: selection.sessionId! };
}
```

### /new
```typescript
function handleNew(ctx: CommandContext): CommandResult {
  return { type: 'new-session' };
}
```

### /clear
```typescript
function handleClear(ctx: CommandContext): CommandResult {
  const newState = clearMessages(ctx.history);
  console.log('Session cleared.');
  return { type: 'update-history', state: newState };
}
```

### /tree [args]
```typescript
async function handleTree(args: string): Promise<CommandResult> {
  // Spawn beans tree as subprocess
  const { spawn } = await import('child_process');
  const treeArgs = args ? args.split(/\s+/) : [];
  
  return new Promise((resolve) => {
    const child = spawn('beans', ['tree', ...treeArgs], {
      stdio: 'inherit',
    });
    child.on('close', () => {
      resolve({ type: 'continue' });
    });
  });
}
```

### /quit, /q
```typescript
function handleQuit(): CommandResult {
  return { type: 'quit', generateName: true };
}
```

## Checklist

- [ ] Define CommandContext interface
- [ ] Define CommandResult type
- [ ] Implement handleCommand dispatcher
- [ ] Implement handleHelp
- [ ] Implement handleMode
- [ ] Implement handlePrompt
- [ ] Implement handleStart
- [ ] Implement handleStop
- [ ] Implement handleStatus
- [ ] Implement handleSessions
- [ ] Implement handleNew
- [ ] Implement handleClear
- [ ] Implement handleTree
- [ ] Implement handleQuit
- [ ] Handle unknown commands gracefully
- [ ] Export handleCommand and types