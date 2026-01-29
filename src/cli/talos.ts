#!/usr/bin/env node
import { Command } from 'commander';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageJson = JSON.parse(
  readFileSync(join(__dirname, '../../package.json'), 'utf-8')
);

const program = new Command();

program
  .name('talos')
  .description('Talos daemon management CLI')
  .version(packageJson.version);

// Commands will be added in subsequent tasks
program
  .command('start')
  .description('Start the Talos daemon')
  .option('-c, --config <path>', 'Path to config file')
  .option('-d, --detach', 'Run as background daemon', true)
  .action(async (options) => {
    console.log('start command - to be implemented');
  });

program
  .command('stop')
  .description('Stop the Talos daemon')
  .action(async () => {
    console.log('stop command - to be implemented');
  });

program
  .command('status')
  .description('Show daemon status')
  .action(async () => {
    console.log('status command - to be implemented');
  });

program
  .command('logs')
  .description('Show daemon logs')
  .option('-f, --follow', 'Follow log output')
  .option('-n, --lines <number>', 'Number of lines to show', '50')
  .action(async (options) => {
    console.log('logs command - to be implemented');
  });

program
  .command('config')
  .description('Show current configuration')
  .option('--validate', 'Validate configuration without starting')
  .action(async (options) => {
    console.log('config command - to be implemented');
  });

program.parse();
