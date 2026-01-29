---
# daedalus-oc7p
title: Implement 'talos start' command
status: todo
type: task
created_at: 2026-01-29T00:31:26Z
updated_at: 2026-01-29T00:31:26Z
parent: daedalus-qkep
---

Implement the start command to launch the Talos daemon.

## Prerequisites
- Process management ready (daedalus-6vtz)

## Implementation

Update `src/cli/talos.ts`:

```typescript
import { DaemonManager } from '../talos/daemon-manager.js';
import { loadConfig } from '../config/index.js';
import { dirname } from 'path';

program
  .command('start')
  .description('Start the Talos daemon')
  .option('-c, --config <path>', 'Path to config file (default: talos.yml)')
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
      const startDir = options.config ? dirname(options.config) : process.cwd();
      const { config } = loadConfig(startDir);
      console.log('Configuration validated ✓');
    } catch (error) {
      console.error('Configuration error:', error.message);
      process.exit(1);
    }

    // Start daemon
    if (options.detach) {
      const pid = manager.fork(options.config);
      console.log('Talos daemon started (PID: %d)', pid);
      console.log('Use "talos logs -f" to view output');
      console.log('Use "talos status" to check status');
    } else {
      // Run in foreground for debugging
      const { Talos } = await import('../talos/talos.js');
      const talos = new Talos(options.config);
      
      process.on('SIGTERM', async () => {
        console.log('Shutting down...');
        await talos.stop();
        process.exit(0);
      });

      process.on('SIGINT', async () => {
        console.log('Shutting down...');
        await talos.stop();
        process.exit(0);
      });

      await talos.start();
      console.log('Talos daemon running in foreground');
      console.log('Press Ctrl+C to stop');
    }
  });
```

## Features

### Config Override
```bash
talos start --config /path/to/talos.yml
```

### Foreground Mode (for debugging)
```bash
talos start --no-detach
```

### Default Mode (detached)
```bash
talos start
```

## Error Handling
- Check if already running
- Validate config before starting
- Clear error messages
- Proper exit codes

## Files to Modify
- `src/cli/talos.ts`

## Acceptance Criteria
- [ ] Detects if daemon already running
- [ ] Validates config before starting
- [ ] Spawns detached daemon by default
- [ ] --config flag works
- [ ] --no-detach runs in foreground
- [ ] Shows PID on successful start
- [ ] Helpful messages about logs and status
- [ ] Exits with code 1 on error
- [ ] Foreground mode handles Ctrl+C gracefully