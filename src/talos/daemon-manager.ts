/**
 * Daemon Process Manager
 *
 * Utilities for daemon process management: PID files, status tracking,
 * and graceful shutdown.
 */
import { readFileSync, writeFileSync, unlinkSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';

/**
 * Status information for a running daemon
 */
export interface DaemonStatus {
  pid: number;
  startedAt: number;
  configPath?: string;
}

/**
 * Manages daemon process lifecycle: PID files, status tracking, and shutdown.
 */
export class DaemonManager {
  private pidFile: string;
  private statusFile: string;
  private logFile: string;
  private dataDir: string;

  constructor(dataDir: string = '.talos') {
    this.dataDir = dataDir;
    this.pidFile = join(dataDir, 'daemon.pid');
    this.statusFile = join(dataDir, 'status.json');
    this.logFile = join(dataDir, 'daemon.log');
  }

  /**
   * Check if daemon is running
   */
  isRunning(): boolean {
    const pid = this.readPid();
    if (!pid) return false;

    try {
      // Check if process exists (signal 0 doesn't kill, just checks)
      process.kill(pid, 0);
      return true;
    } catch {
      // Process doesn't exist - clean up stale PID file
      this.cleanup();
      return false;
    }
  }

  /**
   * Get daemon status
   */
  getStatus(): DaemonStatus | null {
    if (!this.isRunning()) return null;

    try {
      const statusData = readFileSync(this.statusFile, 'utf-8');
      return JSON.parse(statusData);
    } catch {
      // Status file missing but process running
      const pid = this.readPid();
      return pid ? { pid, startedAt: Date.now() } : null;
    }
  }

  /**
   * Read PID from file
   */
  readPid(): number | null {
    try {
      const pidStr = readFileSync(this.pidFile, 'utf-8').trim();
      const pid = parseInt(pidStr, 10);
      return isNaN(pid) ? null : pid;
    } catch {
      return null;
    }
  }

  /**
   * Write PID to file
   */
  writePid(pid: number): void {
    this.ensureDataDir();
    writeFileSync(this.pidFile, String(pid));
  }

  /**
   * Write status to file
   */
  writeStatus(status: DaemonStatus): void {
    this.ensureDataDir();
    writeFileSync(this.statusFile, JSON.stringify(status, null, 2));
  }

  /**
   * Stop daemon gracefully
   */
  async stop(timeout: number = 30000): Promise<boolean> {
    const pid = this.readPid();
    if (!pid) return false;

    try {
      // Check if process exists first
      process.kill(pid, 0);
    } catch {
      // Process doesn't exist
      this.cleanup();
      return false;
    }

    try {
      // Send SIGTERM for graceful shutdown
      process.kill(pid, 'SIGTERM');

      // Wait for process to exit
      const startTime = Date.now();
      while (Date.now() - startTime < timeout) {
        try {
          process.kill(pid, 0);
          // Still running, wait a bit
          await new Promise((resolve) => setTimeout(resolve, 100));
        } catch {
          // Process exited
          this.cleanup();
          return true;
        }
      }

      // Timeout - force kill
      process.kill(pid, 'SIGKILL');
      this.cleanup();
      return true;
    } catch {
      this.cleanup();
      return false;
    }
  }

  /**
   * Clean up PID and status files
   */
  cleanup(): void {
    try {
      if (existsSync(this.pidFile)) unlinkSync(this.pidFile);
    } catch {
      // Ignore errors
    }
    try {
      if (existsSync(this.statusFile)) unlinkSync(this.statusFile);
    } catch {
      // Ignore errors
    }
  }

  /**
   * Get path to log file
   */
  getLogFile(): string {
    return this.logFile;
  }

  /**
   * Get path to PID file
   */
  getPidFile(): string {
    return this.pidFile;
  }

  /**
   * Get path to status file
   */
  getStatusFile(): string {
    return this.statusFile;
  }

  /**
   * Ensure data directory exists
   */
  private ensureDataDir(): void {
    if (!existsSync(this.dataDir)) {
      mkdirSync(this.dataDir, { recursive: true });
    }
  }
}

export default DaemonManager;
