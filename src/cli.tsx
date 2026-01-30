#!/usr/bin/env node
/**
 * Daedalus CLI Entry Point
 *
 * This is the main entry point for the Daedalus CLI.
 * It routes commands to appropriate handlers or launches the Talos daemon UI.
 */
import { render } from 'ink';
import React from 'react';

import { App } from './index.js';
import { TreeCommand } from './cli/tree.js';

const args = process.argv.slice(2);
const command = args[0];

async function main() {
  switch (command) {
    case 'tree':
      // Show bean tree view
      render(<TreeCommand />);
      break;

    case 'help':
    case '--help':
    case '-h':
      console.log(`
Daedalus v2 - Agentic Coding Orchestration

Usage:
  daedalus           Launch the Talos daemon UI
  daedalus tree      Show bean dependency tree
  daedalus help      Show this help message

Environment:
  ANTHROPIC_API_KEY  API key for Claude models
  OPENAI_API_KEY     API key for OpenAI models
`);
      break;

    default:
      // Launch main Talos daemon UI
      render(<App />);
      break;
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
