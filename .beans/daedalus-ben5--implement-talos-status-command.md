---
# daedalus-ben5
title: Implement 'talos status' command
status: todo
type: task
created_at: 2026-01-29T00:31:52Z
updated_at: 2026-01-29T00:31:52Z
parent: daedalus-qkep
---

Implement the status command to show daemon health and current state.

## Prerequisites
- Process management ready (daedalus-6vtz)

## Implementation

Update `src/cli/talos.ts`:

```typescript
import { DaemonManager } from '../talos/daemon-manager.js';
import { formatDistanceToNow } from 'date-fns';

program
  .command('status')
  .description('Show daemon status')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    const manager = new DaemonManager();

    if (!manager.isRunning()) {
      if (options.json) {
        console.log(JSON.stringify({ running: false }, null, 2));
      } else {
        console.log('Status: stopped');
      }
      process.exit(0);
    }

    const status = manager.getStatus();
    if (!status) {
      console.error('Daemon is running but status unavailable');
      process.exit(1);
    }

    const uptime = Date.now() - status.startedAt;
    const uptimeStr = formatDistanceToNow(status.startedAt, { addSuffix: false });

    if (options.json) {
      console.log(JSON.stringify({
        running: true,
        pid: status.pid,
        startedAt: status.startedAt,
        uptime: uptime,
        configPath: status.configPath,
      }, null, 2));
    } else {
      console.log('Status: running ✓');
      console.log('PID: %d', status.pid);
      console.log('Uptime: %s', uptimeStr);
      if (status.configPath) {
        console.log('Config: %s', status.configPath);
      }
      console.log('\nUse "talos logs -f" to view output');
    }
  });
```

## Features

### Human-Readable Output (default)
```bash
talos status
# Status: running ✓
# PID: 12345
# Uptime: 2 hours
# Config: talos.yml
```

### JSON Output
```bash
talos status --json
# {
#   "running": true,
#   "pid": 12345,
#   "startedAt": 1706234567890,
#   "uptime": 7200000,
#   "configPath": "talos.yml"
# }
```

## Status Information
- Running/stopped state
- Process ID (PID)
- Uptime (human-readable)
- Config file path
- Helpful next steps

## Error Handling
- Handle daemon not running
- Handle missing status file
- Handle stale PID file

## Dependencies
```bash
npm install date-fns
```

## Files to Modify
- `src/cli/talos.ts`
- `package.json` (add date-fns)

## Acceptance Criteria
- [ ] Shows "stopped" when not running
- [ ] Shows PID when running
- [ ] Shows uptime in human-readable format
- [ ] Shows config path if available
- [ ] --json flag outputs valid JSON
- [ ] Helpful messages for next steps
- [ ] Exit code 0 for running or stopped
- [ ] Exit code 1 for error states