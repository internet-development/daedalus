#!/usr/bin/env node
import { Command } from 'commander';
import { existsSync, readFileSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import { loadConfig } from '../config/index.js';

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

// Import DaemonManager for process management
import { DaemonManager } from '../talos/daemon-manager.js';

program
  .command('start')
  .description('Start the Talos daemon')
  .option('-c, --config <path>', 'Path to config file')
  .option('--no-detach', 'Run in foreground (for debugging)')
  .action(async (options) => {
    const manager = new DaemonManager();

    // Check if already running
    if (manager.isRunning()) {
      const status = manager.getStatus();
      console.error('Daemon is already running (PID: %d)', status?.pid);
      process.exit(1);
    }

    // Validate config
    try {
      const startDir = options.config ? dirname(resolve(options.config)) : process.cwd();
      const { config } = loadConfig(startDir);
      console.log('Configuration validated ✓');
    } catch (error) {
      console.error('Configuration error:', (error as Error).message);
      process.exit(1);
    }

    if (options.detach) {
      // Spawn detached daemon process
      const { spawn: spawnChild } = await import('child_process');
      const { createWriteStream } = await import('fs');
      const { mkdirSync } = await import('fs');

      // Ensure .talos directory exists
      const talosDir = join(process.cwd(), '.talos');
      mkdirSync(talosDir, { recursive: true });

      const logFile = manager.getLogFile();
      const logStream = createWriteStream(logFile, { flags: 'a' });

      // Spawn the daemon entry point
      const daemonScript = join(__dirname, '../daemon-entry.js');
      const args = options.config ? ['--config', resolve(options.config)] : [];
      
      const child = spawnChild(process.execPath, [daemonScript, ...args], {
        detached: true,
        stdio: ['ignore', logStream, logStream],
        cwd: process.cwd(),
      });

      // Write PID and status
      if (child.pid) {
        manager.writePid(child.pid);
        manager.writeStatus({
          pid: child.pid,
          startedAt: Date.now(),
          configPath: options.config ? resolve(options.config) : undefined,
        });

        // Detach from parent
        child.unref();

        console.log('Talos daemon started (PID: %d)', child.pid);
        console.log('Use "talos logs -f" to view output');
        console.log('Use "talos status" to check status');
      } else {
        console.error('Failed to start daemon');
        process.exit(1);
      }
    } else {
      // Run in foreground for debugging
      const { Talos } = await import('../talos/talos.js');
      const talos = new Talos(options.config ? resolve(options.config) : undefined);

      // Write PID for status command
      manager.writePid(process.pid);
      manager.writeStatus({
        pid: process.pid,
        startedAt: Date.now(),
        configPath: options.config ? resolve(options.config) : undefined,
      });

      const shutdown = async () => {
        console.log('\nShutting down...');
        await talos.stop();
        manager.cleanup();
        process.exit(0);
      };

      process.on('SIGTERM', shutdown);
      process.on('SIGINT', shutdown);

      await talos.start();
      console.log('Talos daemon running in foreground');
      console.log('Press Ctrl+C to stop');
    }
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
  .description('Show and validate configuration')
  .option('-c, --config <path>', 'Path to config file (default: talos.yml)')
  .option('--validate', "Only validate, don't display")
  .option('--json', 'Output as JSON')
  .option('--paths', 'Show discovered paths')
  .action(async (options) => {
    try {
      let config;
      let paths;
      
      if (options.config) {
        // Load from specific file path
        const configPath = resolve(options.config);
        const projectRoot = dirname(configPath);
        
        // Import loadConfigFromFile for explicit path loading
        const { loadConfigFromFile } = await import('../config/index.js');
        config = loadConfigFromFile(configPath);
        paths = {
          configPath: existsSync(configPath) ? configPath : null,
          projectRoot,
          beansPath: join(projectRoot, '.beans'),
        };
      } else {
        // Use standard config discovery
        const result = loadConfig(process.cwd());
        config = result.config;
        paths = result.paths;
      }

      if (options.validate) {
        console.log('Configuration is valid ✓');
        if (options.paths) {
          console.log('\nDiscovered paths:');
          console.log('  Project root: %s', paths.projectRoot);
          console.log('  Beans path: %s', paths.beansPath);
          console.log('  Config file: %s', paths.configPath || 'none (using defaults)');
        }
        process.exit(0);
      }

      if (options.json) {
        console.log(JSON.stringify({
          config,
          paths: options.paths ? paths : undefined,
        }, null, 2));
      } else {
        console.log('Configuration:');
        console.log('─'.repeat(60));
        
        // Agent config
        console.log('\nAgent:');
        console.log('  Backend: %s', config.agent.backend);
        if (config.agent.opencode) {
          console.log('  OpenCode model: %s', config.agent.opencode.model);
        }
        if (config.agent.claude) {
          console.log('  Claude model: %s', config.agent.claude.model);
        }
        if (config.agent.codex) {
          console.log('  Codex model: %s', config.agent.codex.model);
        }

        // Scheduler config
        console.log('\nScheduler:');
        console.log('  Max parallel: %d', config.scheduler.max_parallel);
        console.log('  Poll interval: %dms', config.scheduler.poll_interval);
        console.log('  Auto-enqueue on startup: %s', config.scheduler.auto_enqueue_on_startup);

        // On complete config
        console.log('\nOn Complete:');
        console.log('  Auto commit: %s', config.on_complete.auto_commit);
        console.log('  Push: %s', config.on_complete.push);
        console.log('  Include bean ID: %s', config.on_complete.commit_style.include_bean_id);

        // Planning agent config
        console.log('\nPlanning Agent:');
        console.log('  Provider: %s', config.planning_agent.provider);
        console.log('  Model: %s', config.planning_agent.model);
        console.log('  Temperature: %s', config.planning_agent.temperature);
        console.log('  Tools: %s', config.planning_agent.tools.join(', '));

        // Paths
        if (options.paths) {
          console.log('\nDiscovered paths:');
          console.log('  Project root: %s', paths.projectRoot);
          console.log('  Beans path: %s', paths.beansPath);
          console.log('  Config file: %s', paths.configPath || 'none (using defaults)');
        }

        console.log('\n' + '─'.repeat(60));
        console.log('Configuration is valid ✓');
      }
    } catch (error) {
      console.error('Configuration error:');
      console.error((error as Error).message);
      process.exit(1);
    }
  });

program.parse();
