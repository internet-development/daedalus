import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { spawn, ChildProcess } from 'child_process';
import { join } from 'path';

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

    test('runs stub action', async () => {
      const result = await runTalosCli(['logs']);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('logs command - to be implemented');
    });
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
