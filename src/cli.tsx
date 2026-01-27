#!/usr/bin/env node
/**
 * Daedalus CLI Entry Point
 *
 * This is the main entry point for the Daedalus CLI.
 * It routes commands to appropriate handlers or launches the Talos daemon UI.
 */
import { render } from 'ink';
import React from 'react';
import { execSync } from 'child_process';

import { DaedalusApp } from './index.js';
import { TreeCommand, TreeCommandProps } from './cli/tree.js';
import { loadConfig } from './config/index.js';

// =============================================================================
// Environment Validation
// =============================================================================

/**
 * Validate that required environment variables are set for the planning agent.
 * Returns an error message if validation fails, null if valid.
 */
function validatePlanningAgentEnv(): string | null {
  const { config } = loadConfig();
  const provider = config.planning_agent.provider.toLowerCase();

  switch (provider) {
    case 'anthropic':
    case 'claude': {
      if (!process.env.ANTHROPIC_API_KEY) {
        return `Planning agent requires ANTHROPIC_API_KEY environment variable.

To fix this:
  1. Get an API key from https://console.anthropic.com/settings/keys
  2. Set it with: export ANTHROPIC_API_KEY=your-key

Alternatively, configure a different backend in talos.yml:
  planning_agent:
    provider: openai  # requires OPENAI_API_KEY`;
      }
      return null;
    }

    case 'openai': {
      if (!process.env.OPENAI_API_KEY) {
        return `Planning agent requires OPENAI_API_KEY environment variable.

To fix this:
  1. Get an API key from https://platform.openai.com/api-keys
  2. Set it with: export OPENAI_API_KEY=your-key

Alternatively, configure a different backend in talos.yml:
  planning_agent:
    provider: claude  # requires ANTHROPIC_API_KEY`;
      }
      return null;
    }

    case 'claude_code': {
      // Check if `claude` CLI is available
      try {
        execSync('which claude', { encoding: 'utf-8', stdio: 'pipe' });
        return null;
      } catch {
        return `Planning agent provider 'claude_code' requires the Claude CLI.

To fix this:
  1. Install Claude Code from https://claude.ai/download
  2. Ensure 'claude' is in your PATH

Alternatively, configure a different backend in talos.yml:
  planning_agent:
    provider: claude  # requires ANTHROPIC_API_KEY`;
      }
    }

    default:
      // Unknown provider, assume it's fine
      return null;
  }
}

const args = process.argv.slice(2);
const command = args[0];

/**
 * Parse CLI arguments into an object
 * Supports: --flag, --key=value, --key value, positional args
 */
function parseArgs(args: string[]): { flags: Record<string, string | boolean>; positional: string[] } {
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
        // Check if next arg looks like a value (not a flag)
        flags[withoutDashes] = args[++i];
      } else {
        flags[withoutDashes] = true;
      }
    } else if (arg.startsWith('-') && arg.length === 2) {
      // Short flags like -c
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

async function main() {
  switch (command) {
    case 'tree': {
      // Parse tree command arguments
      const { flags, positional } = parseArgs(args.slice(1));
      
      const props: TreeCommandProps = {
        rootId: positional[0],
        blocking: flags['blocking'] === true || flags['b'] === true,
        status: typeof flags['status'] === 'string' ? flags['status'] : 
                typeof flags['s'] === 'string' ? flags['s'] : undefined,
        excludeStatus: typeof flags['exclude-status'] === 'string' ? flags['exclude-status'] :
                       typeof flags['x'] === 'string' ? flags['x'] : undefined,
        compact: flags['compact'] === true || flags['c'] === true,
      };

      // Show help for tree command
      if (flags['help'] || flags['h']) {
        console.log(`
Usage: daedalus tree [bean-id] [options]

Display bean dependency tree using Unicode box-drawing characters.

Arguments:
  bean-id              Root bean ID to start from (optional, shows all roots if omitted)

Options:
  --blocking, -b       Show blocking relationships instead of parent/child
  --status, -s         Filter by status (comma-separated, e.g. "todo,in-progress")
  --exclude-status, -x Exclude by status (comma-separated, e.g. "completed,scrapped")
  --compact, -c        Compact mode - one line per bean without type/status
  --help, -h           Show this help message

Examples:
  daedalus tree                          Show full hierarchy from all roots
  daedalus tree daedalus-na2v            Show tree starting from specific bean
  daedalus tree --blocking               Show blocking dependencies
  daedalus tree -s todo,in-progress      Show only actionable beans
  daedalus tree -x completed,scrapped    Hide completed/scrapped beans
  daedalus tree --compact                Compact output
`);
        break;
      }

      render(<TreeCommand {...props} />);
      break;
    }

    case 'help':
    case '--help':
    case '-h':
      console.log(`
Daedalus v2 - Agentic Coding Orchestration

Usage:
  daedalus           Launch the Talos daemon UI
  daedalus tree      Show bean dependency tree (use --help for options)
  daedalus help      Show this help message

Environment:
  ANTHROPIC_API_KEY  API key for Claude models
  OPENAI_API_KEY     API key for OpenAI models
`);
      break;

    default: {
      // Validate environment before launching UI
      const envError = validatePlanningAgentEnv();
      if (envError) {
        console.error(`\n❌ Configuration Error\n\n${envError}\n`);
        process.exit(1);
      }

      // Launch main Talos daemon UI with full-screen mode
      render(<DaedalusApp />, { exitOnCtrlC: false });
      break;
    }
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
