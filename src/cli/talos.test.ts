import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { spawn, ChildProcess } from 'child_process';
import { join } from 'path';
import { mkdir, writeFile, rm } from 'fs/promises';
import { existsSync } from 'fs';

/**
 * Helper to run the talos CLI and capture output
 */
function runTalosCli(args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve) => {
    const cliPath = join(__dirname, 'talos.ts');
    const proc = spawn('npx', ['tsx', cliPath, ...args], {
      cwd: join(__dirname, '../..'),
      env: { ...process.env },
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      resolve({ stdout, stderr, exitCode: code ?? 1 });
    });
  });
}

describe('talos CLI', () => {
  describe('--help', () => {
    test('displays help text with program name and description', async () => {
      const result = await runTalosCli(['--help']);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('talos');
      expect(result.stdout).toContain('Talos daemon management CLI');
    });

    test('lists all available commands', async () => {
      const result = await runTalosCli(['--help']);
      
      expect(result.stdout).toContain('start');
      expect(result.stdout).toContain('stop');
      expect(result.stdout).toContain('status');
      expect(result.stdout).toContain('logs');
      expect(result.stdout).toContain('config');
    });
  });

  describe('--version', () => {
    test('displays version from package.json', async () => {
      const result = await runTalosCli(['--version']);
      
      expect(result.exitCode).toBe(0);
      // Should match semver pattern
      expect(result.stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/);
    });
  });

  describe('start command', () => {
    test('has help text', async () => {
      const result = await runTalosCli(['start', '--help']);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Start the Talos daemon');
    });

    test('accepts --config option', async () => {
      const result = await runTalosCli(['start', '--help']);
      
      expect(result.stdout).toContain('--config');
      expect(result.stdout).toContain('-c');
    });

    test('accepts --detach option', async () => {
      const result = await runTalosCli(['start', '--help']);
      
      expect(result.stdout).toContain('--detach');
      expect(result.stdout).toContain('-d');
    });

    test('runs stub action', async () => {
      const result = await runTalosCli(['start']);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('start command - to be implemented');
    });
  });

  describe('stop command', () => {
    test('has help text', async () => {
      const result = await runTalosCli(['stop', '--help']);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Stop the Talos daemon');
    });

    test('runs stub action', async () => {
      const result = await runTalosCli(['stop']);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('stop command - to be implemented');
    });
  });

  describe('status command', () => {
    test('has help text', async () => {
      const result = await runTalosCli(['status', '--help']);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Show daemon status');
    });

    test('runs stub action', async () => {
      const result = await runTalosCli(['status']);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('status command - to be implemented');
    });
  });

  describe('logs command', () => {
    let testDir: string;
    let talosDir: string;
    let logFile: string;

    beforeEach(async () => {
      // Create a temp directory structure for testing
      testDir = join(__dirname, '../../.test-talos-logs-' + Date.now());
      talosDir = join(testDir, '.talos');
      logFile = join(talosDir, 'daemon.log');
      await mkdir(talosDir, { recursive: true });
    });

    afterEach(async () => {
      // Clean up test directory
      if (existsSync(testDir)) {
        await rm(testDir, { recursive: true, force: true });
      }
    });

    /**
     * Helper to run talos CLI in the test directory
     */
    function runTalosCliInDir(args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> {
      return new Promise((resolve) => {
        const cliPath = join(__dirname, 'talos.ts');
        const proc = spawn('npx', ['tsx', cliPath, ...args], {
          cwd: testDir,
          env: { ...process.env },
        });

        let stdout = '';
        let stderr = '';

        proc.stdout.on('data', (data) => {
          stdout += data.toString();
        });

        proc.stderr.on('data', (data) => {
          stderr += data.toString();
        });

        proc.on('close', (code) => {
          resolve({ stdout, stderr, exitCode: code ?? 1 });
        });
      });
    }

    test('has help text', async () => {
      const result = await runTalosCli(['logs', '--help']);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Show daemon logs');
    });

    test('accepts --follow option', async () => {
      const result = await runTalosCli(['logs', '--help']);
      
      expect(result.stdout).toContain('--follow');
      expect(result.stdout).toContain('-f');
    });

    test('accepts --lines option', async () => {
      const result = await runTalosCli(['logs', '--help']);
      
      expect(result.stdout).toContain('--lines');
      expect(result.stdout).toContain('-n');
    });

    test('shows error when log file does not exist', async () => {
      const result = await runTalosCliInDir(['logs']);
      
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Log file not found');
      expect(result.stderr).toContain('talos status');
    });

    test('shows last 50 lines by default', async () => {
      // Create a log file with 100 lines
      const lines = Array.from({ length: 100 }, (_, i) => `Line ${i + 1}`);
      await writeFile(logFile, lines.join('\n'));

      const result = await runTalosCliInDir(['logs']);
      
      expect(result.exitCode).toBe(0);
      // Should show last 50 lines (51-100)
      expect(result.stdout).toContain('Line 51');
      expect(result.stdout).toContain('Line 100');
      expect(result.stdout).not.toContain('Line 50\n');
    });

    test('-n flag changes line count', async () => {
      // Create a log file with 100 lines
      const lines = Array.from({ length: 100 }, (_, i) => `Line ${i + 1}`);
      await writeFile(logFile, lines.join('\n'));

      const result = await runTalosCliInDir(['logs', '-n', '10']);
      
      expect(result.exitCode).toBe(0);
      // Should show last 10 lines (91-100)
      expect(result.stdout).toContain('Line 91');
      expect(result.stdout).toContain('Line 100');
      expect(result.stdout).not.toContain('Line 90\n');
    });

    test('handles empty log file', async () => {
      await writeFile(logFile, '');

      const result = await runTalosCliInDir(['logs']);
      
      expect(result.exitCode).toBe(0);
      // Should not error, just show nothing or empty
    });

    test('handles log file with fewer lines than requested', async () => {
      // Create a log file with only 5 lines
      const lines = Array.from({ length: 5 }, (_, i) => `Line ${i + 1}`);
      await writeFile(logFile, lines.join('\n'));

      const result = await runTalosCliInDir(['logs', '-n', '50']);
      
      expect(result.exitCode).toBe(0);
      // Should show all 5 lines
      expect(result.stdout).toContain('Line 1');
      expect(result.stdout).toContain('Line 5');
    });

    test('works with JSON log format (Pino)', async () => {
      // Create JSON log lines like Pino produces
      const jsonLogs = [
        JSON.stringify({ level: 30, time: 1704067200000, msg: 'Server started', pid: 1234 }),
        JSON.stringify({ level: 40, time: 1704067201000, msg: 'Warning message', pid: 1234 }),
        JSON.stringify({ level: 50, time: 1704067202000, msg: 'Error occurred', err: 'Something failed', pid: 1234 }),
      ];
      await writeFile(logFile, jsonLogs.join('\n'));

      const result = await runTalosCliInDir(['logs']);
      
      expect(result.exitCode).toBe(0);
      // Should display the logs (either raw JSON or pretty-printed)
      expect(result.stdout).toContain('Server started');
      expect(result.stdout).toContain('Warning message');
      expect(result.stdout).toContain('Error occurred');
    });

    test('pretty prints JSON logs with timestamp and level', async () => {
      // Create JSON log lines like Pino produces
      const jsonLogs = [
        JSON.stringify({ level: 30, time: 1704067200000, msg: 'Server started', pid: 1234 }),
      ];
      await writeFile(logFile, jsonLogs.join('\n'));

      const result = await runTalosCliInDir(['logs']);
      
      expect(result.exitCode).toBe(0);
      // Should pretty print with timestamp
      expect(result.stdout).toMatch(/2024-01-01/); // Date from timestamp
      expect(result.stdout).toMatch(/INFO|info/i); // Level 30 = INFO
    });

    test('-f flag follows log output', async () => {
      // Create initial log file
      await writeFile(logFile, 'Initial line\n');

      // Start following logs
      const cliPath = join(__dirname, 'talos.ts');
      const proc = spawn('npx', ['tsx', cliPath, 'logs', '-f', '-n', '5'], {
        cwd: testDir,
        env: { ...process.env },
      });

      let stdout = '';
      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      // Wait a bit for the process to start
      await new Promise(resolve => setTimeout(resolve, 500));

      // Append a new line to the log file
      const { appendFile } = await import('fs/promises');
      await appendFile(logFile, 'New line added\n');

      // Wait for the new line to be picked up
      await new Promise(resolve => setTimeout(resolve, 500));

      // Kill the process
      proc.kill('SIGINT');

      // Wait for process to exit
      await new Promise(resolve => proc.on('close', resolve));

      expect(stdout).toContain('Initial line');
      expect(stdout).toContain('New line added');
    }, 10000); // Longer timeout for follow test

    test('Ctrl+C stops following gracefully', async () => {
      await writeFile(logFile, 'Test line\n');

      const cliPath = join(__dirname, 'talos.ts');
      const proc = spawn('npx', ['tsx', cliPath, 'logs', '-f'], {
        cwd: testDir,
        env: { ...process.env },
      });

      let exited = false;
      let stderr = '';
      proc.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      // Wait for process to start
      await new Promise(resolve => setTimeout(resolve, 300));

      // Send SIGINT (Ctrl+C)
      proc.kill('SIGINT');

      // Wait for process to exit
      const exitCode = await new Promise<number>(resolve => {
        proc.on('close', (code) => {
          exited = true;
          resolve(code ?? 1);
        });
      });

      // Process should have exited
      expect(exited).toBe(true);
      // Should exit cleanly (0) or with SIGINT code (130 = 128 + 2)
      // Both are acceptable - 0 means we caught SIGINT, 130 means signal propagated
      expect([0, 130]).toContain(exitCode);
      // Should not have error output
      expect(stderr).not.toContain('Error');
    }, 5000);
  });

  describe('config command', () => {
    test('has help text', async () => {
      const result = await runTalosCli(['config', '--help']);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Show current configuration');
    });

    test('accepts --validate option', async () => {
      const result = await runTalosCli(['config', '--help']);
      
      expect(result.stdout).toContain('--validate');
    });

    test('runs stub action', async () => {
      const result = await runTalosCli(['config']);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('config command - to be implemented');
    });
  });
});
