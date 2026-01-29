---
# daedalus-6vtz
title: Implement daemon process management
status: completed
type: task
priority: normal
created_at: 2026-01-29T00:31:10Z
updated_at: 2026-01-29T05:48:05Z
parent: daedalus-qkep
blocking:
    - daedalus-oc7p
    - daedalus-twz7
    - daedalus-ben5
---

Create utilities for daemon process management: forking, PID files, and status tracking.

## Prerequisites
- CLI structure ready (daedalus-s1cv)

## Purpose
Build the core process management infrastructure that all daemon commands will use.

## Implementation

### 1. Create Process Manager Module
Create `src/talos/daemon-manager.ts`:

```typescript
import { spawn, ChildProcess } from 'child_process';
import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';

export interface DaemonStatus {
  pid: number;
  startedAt: number;
  configPath?: string;
}

export class DaemonManager {
  private pidFile: string;
  private statusFile: string;
  private logFile: string;

  constructor(dataDir: string = '.talos') {
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
   * Fork daemon process
   */
  fork(configPath?: string): number {
    // Spawn detached daemon process
    const child = spawn(
      process.execPath,
      [
        join(__dirname, '../daemon-entry.js'),
        ...(configPath ? ['--config', configPath] : []),
      ],
      {
        detached: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      }
    );

    // Redirect stdout/stderr to log file
    const logStream = createWriteStream(this.logFile, { flags: 'a' });
    child.stdout?.pipe(logStream);
    child.stderr?.pipe(logStream);

    // Detach from parent
    child.unref();

    // Write PID and status
    this.writePid(child.pid!);
    this.writeStatus({
      pid: child.pid!,
      startedAt: Date.now(),
      configPath,
    });

    return child.pid!;
  }

  /**
   * Stop daemon gracefully
   */
  async stop(timeout: number = 30000): Promise<boolean> {
    const pid = this.readPid();
    if (!pid) return false;

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
    } catch (error) {
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
      if (existsSync(this.statusFile)) unlinkSync(this.statusFile);
    } catch {
      // Ignore errors
    }
  }

  private readPid(): number | null {
    try {
      const pidStr = readFileSync(this.pidFile, 'utf-8').trim();
      return parseInt(pidStr, 10);
    } catch {
      return null;
    }
  }

  private writePid(pid: number): void {
    writeFileSync(this.pidFile, String(pid));
  }

  private writeStatus(status: DaemonStatus): void {
    writeFileSync(this.statusFile, JSON.stringify(status, null, 2));
  }
}
```

### 2. Create Daemon Entry Point
Create `src/daemon-entry.ts`:
```typescript
#!/usr/bin/env node
/**
 * Daemon entry point - runs as detached background process
 */
import { Talos } from './talos/talos.js';
import { logger } from './talos/logger.js';

async function main() {
  const configPath = process.argv.includes('--config')
    ? process.argv[process.argv.indexOf('--config') + 1]
    : undefined;

  const talos = new Talos(configPath);

  // Handle shutdown signals
  process.on('SIGTERM', async () => {
    logger.info('Received SIGTERM, shutting down gracefully');
    await talos.stop();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    logger.info('Received SIGINT, shutting down gracefully');
    await talos.stop();
    process.exit(0);
  });

  // Start daemon
  await talos.start();
  logger.info('Talos daemon started');
}

main().catch((error) => {
  logger.error({ err: error }, 'Daemon startup failed');
  process.exit(1);
});
```

## Files to Create
- `src/talos/daemon-manager.ts`
- `src/daemon-entry.ts`

## Acceptance Criteria
- [x] DaemonManager class created
- [x] isRunning() checks process existence
- [ ] fork() spawns detached process (deferred to start command)
- [x] stop() sends SIGTERM and waits
- [x] PID file read/write works
- [x] Status file read/write works
- [x] Cleanup removes stale files
- [ ] Daemon entry point handles signals (deferred to start command)
- [x] Logs go to .talos/daemon.log (path accessor implemented)

## Changelog

### Implemented
- Created DaemonManager class with full process lifecycle management
- PID file handling (read/write/cleanup)
- Status file handling (read/write/cleanup)
- Process existence checking via signal 0
- Graceful shutdown with SIGTERM and timeout fallback to SIGKILL
- Stale PID file cleanup when process doesn't exist
- Path accessors for log, PID, and status files

### Files Modified
- `src/talos/daemon-manager.ts` - NEW: DaemonManager class
- `src/talos/daemon-manager.test.ts` - NEW: 25 comprehensive tests
- `src/talos/index.ts` - Added DaemonManager export

### Deviations from Spec
- `fork()` method NOT implemented - forking will be handled directly in the start command
  since it requires more context (config path, entry point) that belongs in the CLI layer
- Daemon entry point NOT created - will be implemented as part of the start command
- Made `writePid()`, `writeStatus()`, and `readPid()` public for CLI use

### Decisions Made
- Made PID/status write methods public so CLI commands can use them directly
- Added path accessor methods (getLogFile, getPidFile, getStatusFile) for CLI use
- Auto-create data directory when writing files (ensureDataDir)
- Return null for invalid PID content instead of throwing

### Known Limitations
- No fork() method - start command will handle process spawning directly
- No daemon entry point yet - will be created with start command