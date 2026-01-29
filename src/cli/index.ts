#!/usr/bin/env node
/**
 * Daedalus CLI Entry Point
 *
 * Simple readline-based planning CLI.
 * No Ink, no React - just terminal I/O.
 */

import { runPlan, type PlanOptions } from './plan.js';
import { runTree, type TreeOptions } from './tree-simple.js';
import type { PlanMode } from '../planning/planning-session.js';

const args = process.argv.slice(2);
const command = args[0];

// =============================================================================
// Argument Parsing
// =============================================================================

/**
 * Parse CLI arguments into flags and positional args
 */
export function parseArgs(args: string[]): {
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
    mode: typeof flags['mode'] === 'string' ? (flags['mode'] as PlanMode) : undefined,
    prompt: typeof flags['prompt'] === 'string' ? flags['prompt'] : undefined,
    new: flags['new'] === true || flags['n'] === true,
    list: flags['list'] === true || flags['l'] === true,
  };
}

/**
 * Parse args for the tree command
 */
function parseTreeArgs(args: string[]): TreeOptions {
  return { args }; // Pass all args through to beans tree
}

// =============================================================================
// Help
// =============================================================================

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
  --new, -n                  Start a new session (skip session selector)
  --list, -l                 List all sessions and exit

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

// =============================================================================
// Main
// =============================================================================

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
      const planArgs = command?.startsWith('-') ? args : args.slice(command ? 1 : 0);
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
