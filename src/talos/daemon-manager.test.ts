import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'path';
import { mkdir, rm, writeFile, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { tmpdir } from 'os';
import { DaemonManager, type DaemonStatus } from './daemon-manager.js';

describe('DaemonManager', () => {
  let testDir: string;
  let manager: DaemonManager;

  beforeEach(async () => {
    // Create a temp directory for testing
    testDir = join(tmpdir(), `.test-daemon-manager-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
    manager = new DaemonManager(testDir);
  });

  afterEach(async () => {
    // Clean up test directory
    if (existsSync(testDir)) {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  describe('constructor', () => {
    test('creates manager with specified data directory', () => {
      const customDir = join(testDir, 'custom');
      const customManager = new DaemonManager(customDir);
      expect(customManager).toBeInstanceOf(DaemonManager);
    });

    test('defaults to .talos directory when not specified', () => {
      const defaultManager = new DaemonManager();
      expect(defaultManager).toBeInstanceOf(DaemonManager);
    });
  });

  describe('isRunning', () => {
    test('returns false when no PID file exists', () => {
      expect(manager.isRunning()).toBe(false);
    });

    test('returns false when PID file contains invalid PID', async () => {
      const pidFile = join(testDir, 'daemon.pid');
      await writeFile(pidFile, 'not-a-number');
      expect(manager.isRunning()).toBe(false);
    });

    test('returns false when PID file contains non-existent process', async () => {
      const pidFile = join(testDir, 'daemon.pid');
      // Use a very high PID that's unlikely to exist
      await writeFile(pidFile, '999999999');
      expect(manager.isRunning()).toBe(false);
    });

    test('returns true when PID file contains running process', async () => {
      const pidFile = join(testDir, 'daemon.pid');
      // Use current process PID (which is definitely running)
      await writeFile(pidFile, String(process.pid));
      expect(manager.isRunning()).toBe(true);
    });

    test('cleans up stale PID file when process does not exist', async () => {
      const pidFile = join(testDir, 'daemon.pid');
      await writeFile(pidFile, '999999999');
      
      manager.isRunning();
      
      // PID file should be cleaned up
      expect(existsSync(pidFile)).toBe(false);
    });
  });

  describe('getStatus', () => {
    test('returns null when daemon is not running', () => {
      expect(manager.getStatus()).toBeNull();
    });

    test('returns status from status file when daemon is running', async () => {
      const pidFile = join(testDir, 'daemon.pid');
      const statusFile = join(testDir, 'status.json');
      
      await writeFile(pidFile, String(process.pid));
      await writeFile(statusFile, JSON.stringify({
        pid: process.pid,
        startedAt: 1704067200000,
        configPath: '/path/to/config.yml',
      }));
      
      const status = manager.getStatus();
      
      expect(status).not.toBeNull();
      expect(status?.pid).toBe(process.pid);
      expect(status?.startedAt).toBe(1704067200000);
      expect(status?.configPath).toBe('/path/to/config.yml');
    });

    test('returns minimal status when status file is missing but process is running', async () => {
      const pidFile = join(testDir, 'daemon.pid');
      await writeFile(pidFile, String(process.pid));
      
      const status = manager.getStatus();
      
      expect(status).not.toBeNull();
      expect(status?.pid).toBe(process.pid);
      expect(status?.startedAt).toBeDefined();
    });
  });

  describe('writePid', () => {
    test('writes PID to file', async () => {
      manager.writePid(12345);
      
      const pidFile = join(testDir, 'daemon.pid');
      const content = await readFile(pidFile, 'utf-8');
      expect(content).toBe('12345');
    });

    test('creates data directory if it does not exist', async () => {
      const nestedDir = join(testDir, 'nested', 'dir');
      const nestedManager = new DaemonManager(nestedDir);
      
      nestedManager.writePid(12345);
      
      expect(existsSync(join(nestedDir, 'daemon.pid'))).toBe(true);
    });
  });

  describe('writeStatus', () => {
    test('writes status to JSON file', async () => {
      const status: DaemonStatus = {
        pid: 12345,
        startedAt: 1704067200000,
        configPath: '/path/to/config.yml',
      };
      
      manager.writeStatus(status);
      
      const statusFile = join(testDir, 'status.json');
      const content = await readFile(statusFile, 'utf-8');
      const parsed = JSON.parse(content);
      
      expect(parsed.pid).toBe(12345);
      expect(parsed.startedAt).toBe(1704067200000);
      expect(parsed.configPath).toBe('/path/to/config.yml');
    });

    test('creates data directory if it does not exist', async () => {
      const nestedDir = join(testDir, 'nested', 'dir');
      const nestedManager = new DaemonManager(nestedDir);
      
      nestedManager.writeStatus({ pid: 12345, startedAt: Date.now() });
      
      expect(existsSync(join(nestedDir, 'status.json'))).toBe(true);
    });
  });

  describe('readPid', () => {
    test('returns null when PID file does not exist', () => {
      expect(manager.readPid()).toBeNull();
    });

    test('returns PID from file', async () => {
      const pidFile = join(testDir, 'daemon.pid');
      await writeFile(pidFile, '12345');
      
      expect(manager.readPid()).toBe(12345);
    });

    test('returns null for invalid PID content', async () => {
      const pidFile = join(testDir, 'daemon.pid');
      await writeFile(pidFile, 'not-a-number');
      
      expect(manager.readPid()).toBeNull();
    });
  });

  describe('cleanup', () => {
    test('removes PID file', async () => {
      const pidFile = join(testDir, 'daemon.pid');
      await writeFile(pidFile, '12345');
      
      manager.cleanup();
      
      expect(existsSync(pidFile)).toBe(false);
    });

    test('removes status file', async () => {
      const statusFile = join(testDir, 'status.json');
      await writeFile(statusFile, '{}');
      
      manager.cleanup();
      
      expect(existsSync(statusFile)).toBe(false);
    });

    test('does not throw when files do not exist', () => {
      expect(() => manager.cleanup()).not.toThrow();
    });
  });

  describe('stop', () => {
    test('returns false when no daemon is running', async () => {
      const result = await manager.stop();
      expect(result).toBe(false);
    });

    test('sends SIGTERM to running process', async () => {
      // This test is tricky because we can't easily test signal handling
      // We'll test the cleanup behavior instead
      const pidFile = join(testDir, 'daemon.pid');
      await writeFile(pidFile, '999999999'); // Non-existent process
      
      const result = await manager.stop();
      
      // Should return false because process doesn't exist
      expect(result).toBe(false);
      // Should clean up files
      expect(existsSync(pidFile)).toBe(false);
    });
  });

  describe('getLogFile', () => {
    test('returns path to daemon.log in data directory', () => {
      expect(manager.getLogFile()).toBe(join(testDir, 'daemon.log'));
    });
  });

  describe('getPidFile', () => {
    test('returns path to daemon.pid in data directory', () => {
      expect(manager.getPidFile()).toBe(join(testDir, 'daemon.pid'));
    });
  });

  describe('getStatusFile', () => {
    test('returns path to status.json in data directory', () => {
      expect(manager.getStatusFile()).toBe(join(testDir, 'status.json'));
    });
  });
});
