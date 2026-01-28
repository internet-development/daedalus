---
# daedalus-w7xv
title: Rewrite cli/index.ts
status: completed
type: task
priority: normal
created_at: 2026-01-28T04:05:27Z
updated_at: 2026-01-28T04:15:14Z
parent: daedalus-gu7g
---

## Summary

Rewrite the CLI entry point without Ink. This replaces `src/cli.tsx` with `src/cli/index.ts`.

## File

`src/cli/index.ts` (replaces `src/cli.tsx`)

## Implementation

```typescript
#!/usr/bin/env node
/**
 * Daedalus CLI Entry Point
 *
 * Simple readline-based planning CLI.
 * No Ink, no React - just terminal I/O.
 */

import { runPlan, type PlanOptions } from './plan.js';
import { runTree, type TreeOptions } from './tree.js';

const args = process.argv.slice(2);
const command = args[0];

/**
 * Parse CLI arguments into flags and positional args
 */
function parseArgs(args: string[]): {
  flags: Record<string, string | boolean>;
  positional: string[];
} {
  const flags: Record<string, string | boolean> = {};
  const positional: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg.startsWith('--')) {
      const withoutDashes = arg.slice(2);
      if (withoutDashes.includes('=')) {
        const [key, value] = withoutDashes.split('=', 2);
        flags[key] = value;
      } else if (i + 1 < args.length && !args[i + 1].startsWith('-')) {
        flags[withoutDashes] = args[++i];
      } else {
        flags[withoutDashes] = true;
      }
    } else if (arg.startsWith('-') && arg.length === 2) {
      const flag = arg.slice(1);
      if (i + 1 < args.length && !args[i + 1].startsWith('-')) {
        flags[flag] = args[++i];
      } else {
        flags[flag] = true;
      }
    } else {
      positional.push(arg);
    }
  }

  return { flags, positional };
}

/**
 * Parse args for the plan command
 */
function parsePlanArgs(args: string[]): PlanOptions {
  const { flags } = parseArgs(args);
  
  return {
    mode: typeof flags['mode'] === 'string' ? flags['mode'] as any : undefined,
    prompt: typeof flags['prompt'] === 'string' ? flags['prompt'] : undefined,
    new: flags['new'] === true,
    list: flags['list'] === true,
  };
}

/**
 * Parse args for the tree command
 */
function parseTreeArgs(args: string[]): TreeOptions {
  return { args };  // Pass all args through to beans tree
}

/**
 * Show help text
 */
function showHelp(): void {
  console.log(`
Daedalus - AI Planning CLI

Usage:
  daedalus [options]         Start interactive planning session
  daedalus tree [args]       Show bean tree (delegates to beans tree)
  daedalus help              Show this help message

Planning Options:
  --mode <mode>              Start with mode (new, brainstorm, breakdown, etc.)
  --prompt <name>            Start with custom prompt
  --new                      Start a new session (skip session selector)
  --list                     List all sessions and exit

Tree Options:
  All arguments are passed to 'beans tree'. See 'beans tree --help'.

In-Session Commands:
  /help                      Show available commands
  /mode [name]               List modes or switch to mode
  /prompt [name]             List prompts or use prompt
  /start                     Start background daemon
  /stop                      Stop background daemon
  /status                    Show daemon status
  /sessions                  List and switch sessions
  /new                       Start new session
  /clear                     Clear current session
  /tree [args]               Show bean tree
  /quit, /q                  Exit

Examples:
  daedalus                   Start planning with session selector
  daedalus --new             Start fresh planning session
  daedalus --mode brainstorm Start in brainstorm mode
  daedalus tree --blocking   Show blocking dependencies
`);
}

async function main(): Promise<void> {
  switch (command) {
    case 'tree': {
      const options = parseTreeArgs(args.slice(1));
      await runTree(options);
      break;
    }
    
    case 'help':
    case '--help':
    case '-h': {
      showHelp();
      break;
    }
    
    default: {
      // Default to plan command
      // If command looks like a flag, include it in args
      const planArgs = command?.startsWith('-') ? args : args.slice(1);
      const options = parsePlanArgs(command?.startsWith('-') ? args : planArgs);
      await runPlan(options);
      break;
    }
  }
}

main().catch((error) => {
  console.error('Fatal error:', error.message);
  process.exit(1);
});
```

## Changes from cli.tsx

1. **No Ink/React imports** - Pure Node.js
2. **No render() calls** - Direct function calls
3. **Simpler command routing** - Default to plan, explicit tree
4. **No DaedalusApp component** - Replaced with runPlan()
5. **Updated help text** - Reflects new CLI structure

## Package.json Updates Needed

```json
{
  "bin": {
    "daedalus": "./dist/cli/index.js"  // Changed from ./dist/cli.js
  },
  "scripts": {
    "dev": "tsx src/cli/index.ts"       // Changed from src/cli.tsx
  }
}
```

## Checklist

- [ ] Create src/cli/index.ts
- [ ] Implement parseArgs helper
- [ ] Implement parsePlanArgs helper
- [ ] Implement parseTreeArgs helper
- [ ] Implement showHelp
- [ ] Implement main function with command routing
- [ ] Add shebang (#!/usr/bin/env node)
- [ ] Handle unknown commands (default to plan)
- [ ] Export nothing (entry point only)
- [ ] Update package.json bin path
- [ ] Update package.json dev script