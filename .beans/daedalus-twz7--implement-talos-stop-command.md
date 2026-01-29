---
# daedalus-twz7
title: Implement 'talos stop' command
status: todo
type: task
created_at: 2026-01-29T00:31:38Z
updated_at: 2026-01-29T00:31:38Z
parent: daedalus-qkep
---

Implement the stop command to gracefully shut down the Talos daemon.

## Prerequisites
- Process management ready (daedalus-6vtz)

## Implementation

Update `src/cli/talos.ts`:

```typescript
import { DaemonManager } from '../talos/daemon-manager.js';

program
  .command('stop')
  .description('Stop the Talos daemon')
  .option('-f, --force', 'Force kill if graceful shutdown fails')
  .option('-t, --timeout <seconds>', 'Shutdown timeout in seconds', '30')
  .action(async (options) => {
    const manager = new DaemonManager();

    // Check if running
    if (!manager.isRunning()) {
      console.log('Daemon is not running');
      process.exit(0);
    }

    const status = manager.getStatus();
    console.log('Stopping daemon (PID: %d)...', status?.pid);

    // Attempt graceful shutdown
    const timeout = parseInt(options.timeout, 10) * 1000;
    const stopped = await manager.stop(timeout);

    if (stopped) {
      console.log('Daemon stopped successfully ✓');
    } else {
      if (options.force) {
        console.log('Graceful shutdown failed, force killing...');
        // Force kill is already done in manager.stop()
        console.log('Daemon killed ✓');
      } else {
        console.error('Failed to stop daemon gracefully');
        console.error('Use --force to kill forcefully');
        process.exit(1);
      }
    }
  });
```

## Features

### Graceful Shutdown (default)
```bash
talos stop
# Sends SIGTERM, waits up to 30s
```

### Custom Timeout
```bash
talos stop --timeout 60
```

### Force Kill
```bash
talos stop --force
# Sends SIGKILL if SIGTERM fails
```

## Shutdown Sequence
1. Check if daemon is running
2. Send SIGTERM signal
3. Wait for graceful shutdown (up to timeout)
4. If timeout, optionally SIGKILL
5. Clean up PID and status files

## Error Handling
- Handle daemon not running
- Handle timeout gracefully
- Clean up files even on error
- Clear error messages

## Files to Modify
- `src/cli/talos.ts`

## Acceptance Criteria
- [ ] Detects if daemon not running
- [ ] Sends SIGTERM for graceful shutdown
- [ ] Waits for process to exit
- [ ] --timeout flag works
- [ ] --force flag kills after timeout
- [ ] Cleans up PID and status files
- [ ] Shows clear progress messages
- [ ] Exits with code 0 on success
- [ ] Exits with code 1 on failure (without --force)