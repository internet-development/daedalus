#!/usr/bin/env node
import { Command } from 'commander';
import { existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

/**
 * Pino log levels (numeric to string mapping)
 */
const PINO_LEVELS: Record<number, string> = {
  10: 'TRACE',
  20: 'DEBUG',
  30: 'INFO',
  40: 'WARN',
  50: 'ERROR',
  60: 'FATAL',
};

/**
 * Format a JSON log line (Pino format) into a human-readable string.
 * Falls back to returning the original line if it's not valid JSON.
 */
function formatLogLine(line: string): string {
  if (!line.trim()) return line;
  
  try {
    const log = JSON.parse(line);
    
    // Format timestamp
    const timestamp = log.time 
      ? new Date(log.time).toISOString() 
      : '';
    
    // Format level
    const levelNum = typeof log.level === 'number' ? log.level : 30;
    const level = (PINO_LEVELS[levelNum] || 'INFO').padEnd(5);
    
    // Get message
    const msg = log.msg || '';
    
    // Collect remaining context
    const context = { ...log };
    delete context.time;
    delete context.level;
    delete context.msg;
    delete context.pid;
    delete context.hostname;
    
    // Build formatted line
    const contextStr = Object.keys(context).length > 0 
      ? ' ' + JSON.stringify(context) 
      : '';
    
    return `${timestamp} ${level} ${msg}${contextStr}`;
  } catch {
    // Not JSON, return as-is
    return line;
  }
}

/**
 * Get the last N lines from a string content
 */
function getLastLines(content: string, n: number): string[] {
  const lines = content.split('\n');
  // Filter out empty trailing line if present
  const nonEmptyLines = lines[lines.length - 1] === '' 
    ? lines.slice(0, -1) 
    : lines;
  return nonEmptyLines.slice(-n);
}

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
  .option('-f, --follow', 'Follow log output (like tail -f)')
  .option('-n, --lines <number>', 'Number of lines to show', '50')
  .action(async (options) => {
    const logFile = join('.talos', 'daemon.log');

    if (!existsSync(logFile)) {
      console.error('Log file not found: %s', logFile);
      console.error('Is the daemon running? Use "talos status" to check');
      process.exit(1);
    }

    const lines = parseInt(options.lines, 10);

    if (options.follow) {
      // Use tail -f for following
      const tail = spawn('tail', ['-f', '-n', String(lines), logFile], {
        stdio: ['inherit', 'pipe', 'inherit'],
      });

      // Process output to format JSON logs
      tail.stdout?.on('data', (data: Buffer) => {
        const text = data.toString();
        const formatted = text
          .split('\n')
          .map(line => formatLogLine(line))
          .join('\n');
        process.stdout.write(formatted);
      });

      // Handle Ctrl+C gracefully
      process.on('SIGINT', () => {
        tail.kill();
        process.exit(0);
      });

      // Wait for tail to exit
      await new Promise<void>((resolve) => {
        tail.on('close', () => resolve());
      });
    } else {
      // Read last N lines
      const content = readFileSync(logFile, 'utf-8');
      const lastLines = getLastLines(content, lines);
      const formatted = lastLines.map(line => formatLogLine(line));
      console.log(formatted.join('\n'));
    }
  });

program
  .command('config')
  .description('Show current configuration')
  .option('--validate', 'Validate configuration without starting')
  .action(async (options) => {
    console.log('config command - to be implemented');
  });

program.parse();
