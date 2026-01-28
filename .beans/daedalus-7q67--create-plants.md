---
# daedalus-7q67
title: Create plan.ts
status: todo
type: task
created_at: 2026-01-28T04:04:51Z
updated_at: 2026-01-28T04:04:51Z
parent: daedalus-gu7g
---

## Summary

Create the main interactive planning loop that ties everything together.

## File

`src/cli/plan.ts`

## Function Signature

```typescript
export interface PlanOptions {
  mode?: PlanMode;      // Initial mode (--mode flag)
  prompt?: string;      // Initial prompt to use (--prompt flag)
  new?: boolean;        // Skip session selector (--new flag)
  list?: boolean;       // List sessions and exit (--list flag)
}

export async function runPlan(options: PlanOptions): Promise<void>
```

## Main Flow

```typescript
export async function runPlan(options: PlanOptions): Promise<void> {
  // 1. Load config
  const { config } = loadConfig();
  
  // 2. Validate environment
  const envError = validatePlanningAgentEnv(config);
  if (envError) {
    console.error(formatError(envError));
    process.exit(1);
  }
  
  // 3. Load prompts
  const prompts = await loadPrompts();
  
  // 4. Load chat history
  let historyState = loadChatHistory();
  
  // 5. Handle --list flag
  if (options.list) {
    if (historyState.sessions.length === 0) {
      console.log('No sessions found.');
    } else {
      console.log(formatSessionList(
        getSessionsSortedByDate(historyState),
        historyState.currentSessionId
      ));
    }
    return;
  }
  
  // 6. Session selection
  if (options.new || historyState.sessions.length === 0) {
    historyState = createSession(historyState);
  } else {
    const selection = await selectSession(
      historyState.sessions,
      historyState.currentSessionId
    );
    if (selection.action === 'new') {
      historyState = createSession(historyState);
    } else {
      historyState = switchSession(historyState, selection.sessionId!);
    }
  }
  saveChatHistory(historyState);
  
  // 7. Initialize PlanningSession
  const session = new PlanningSession({
    config: config.planning_agent,
    expertsConfig: config.experts,
    mode: options.mode ?? 'new',
  });
  
  // 8. Handle --prompt flag
  let initialPrompt: string | null = null;
  if (options.prompt) {
    const prompt = prompts.find(p => 
      p.name.toLowerCase() === options.prompt!.toLowerCase()
    );
    if (prompt) {
      initialPrompt = prompt.content;
    } else {
      console.log(formatError(`Unknown prompt: ${options.prompt}`));
    }
  }
  
  // 9. Create readline interface
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  
  // 10. Set up Talos (not started yet - manual start)
  let talos: Talos | null = null;
  
  // 11. Command context
  const ctx: CommandContext = {
    session,
    history: historyState,
    talos,
    prompts,
    rl,
    saveHistory: () => {
      saveChatHistory(ctx.history);
    },
  };
  
  // 12. Set up signal handlers
  setupSignalHandlers(ctx, rl);
  
  // 13. Print header
  console.log(formatHeader(session.getMode(), talos ? 'running' : 'stopped'));
  
  // 14. Main loop
  await mainLoop(rl, ctx, initialPrompt);
}
```

## Main Loop Implementation

```typescript
async function mainLoop(
  rl: readline.Interface,
  ctx: CommandContext,
  initialPrompt: string | null
): Promise<void> {
  // Send initial prompt if provided
  if (initialPrompt) {
    await sendAndStream(initialPrompt, ctx);
  }
  
  // Interactive loop
  while (true) {
    const input = await question(rl, formatPrompt());
    
    if (!input.trim()) continue;
    
    // Check for command
    if (input.startsWith('/')) {
      const result = await handleCommand(input, ctx);
      
      switch (result.type) {
        case 'continue':
          break;
        case 'quit':
          if (result.generateName) {
            await generateSessionName(ctx);
          }
          rl.close();
          return;
        case 'send':
          await sendAndStream(result.message, ctx);
          break;
        case 'update-history':
          ctx.history = result.state;
          ctx.saveHistory();
          break;
        case 'switch-session':
          ctx.history = switchSession(ctx.history, result.sessionId);
          ctx.saveHistory();
          console.log('Switched session.');
          break;
        case 'new-session':
          ctx.history = createSession(ctx.history);
          ctx.saveHistory();
          console.log('Created new session.');
          break;
      }
    } else {
      // Regular message
      await sendAndStream(input, ctx);
    }
  }
}
```

## Send and Stream Implementation

```typescript
async function sendAndStream(message: string, ctx: CommandContext): Promise<void> {
  // Add user message to history
  ctx.history = addMessage(ctx.history, {
    role: 'user',
    content: message,
    timestamp: Date.now(),
  });
  ctx.saveHistory();
  
  // Print user message
  console.log(formatUserMessage(message));
  
  // Set up streaming output
  let fullContent = '';
  const toolCalls: ToolCall[] = [];
  
  ctx.session.on('text', (text) => {
    process.stdout.write(text);  // Stream to stdout
    fullContent += text;
  });
  
  ctx.session.on('toolCall', (tc) => {
    toolCalls.push(tc);
  });
  
  // Wait for completion
  await new Promise<void>((resolve, reject) => {
    ctx.session.once('done', () => resolve());
    ctx.session.once('error', (err) => reject(err));
    
    // Send message
    const messages = getCurrentSession(ctx.history)?.messages ?? [];
    ctx.session.sendMessage(message, messages).catch(reject);
  });
  
  // Add newline after streaming
  console.log();
  
  // Add assistant message to history
  ctx.history = addMessage(ctx.history, {
    role: 'assistant',
    content: fullContent,
    timestamp: Date.now(),
    toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
  });
  ctx.saveHistory();
  
  // Remove listeners for next message
  ctx.session.removeAllListeners('text');
  ctx.session.removeAllListeners('toolCall');
}
```

## Signal Handlers

```typescript
function setupSignalHandlers(ctx: CommandContext, rl: readline.Interface): void {
  const cleanup = async () => {
    // Generate session name before exit
    await generateSessionName(ctx);
    
    // Stop daemon if running
    if (ctx.talos) {
      await ctx.talos.stop();
    }
    
    rl.close();
    process.exit(0);
  };
  
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}
```

## Session Name Generation

```typescript
async function generateSessionName(ctx: CommandContext): Promise<void> {
  const currentSession = getCurrentSession(ctx.history);
  if (!currentSession) return;
  
  // Only generate if using default name
  if (!currentSession.name.startsWith('Session ')) return;
  
  // Need at least a few messages
  if (currentSession.messages.length < 2) return;
  
  console.log('\nGenerating session name...');
  
  // Use planning agent to generate name
  // This is a one-shot call, not part of the conversation
  try {
    const name = await generateNameWithAI(currentSession.messages, ctx);
    ctx.history = renameSession(ctx.history, currentSession.id, name);
    ctx.saveHistory();
    console.log(`Session named: ${name}`);
  } catch (err) {
    // Silently fail - not critical
  }
}
```

## Checklist

- [ ] Define PlanOptions interface
- [ ] Implement runPlan main function
- [ ] Load and validate config
- [ ] Load prompts
- [ ] Load/manage chat history
- [ ] Handle --list flag
- [ ] Implement session selection
- [ ] Initialize PlanningSession
- [ ] Handle --prompt flag
- [ ] Set up readline interface
- [ ] Implement mainLoop
- [ ] Implement sendAndStream
- [ ] Implement signal handlers
- [ ] Implement generateSessionName
- [ ] Handle errors gracefully
- [ ] Export runPlan