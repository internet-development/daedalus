---
# daedalus-ben5
title: Implement 'talos status' command
status: completed
type: task
priority: normal
created_at: 2026-01-29T00:31:52Z
updated_at: 2026-01-29T06:01:29Z
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
- [x] Shows "stopped" when not running
- [x] Shows PID when running
- [x] Shows uptime in human-readable format
- [x] Shows config path if available
- [x] --json flag outputs valid JSON
- [x] Helpful messages for next steps
- [x] Exit code 0 for running or stopped
- [x] Exit code 1 for error states

## Changelog

### Implemented
- Full status command with human-readable and JSON output
- Running/stopped state detection
- PID and uptime display when running
- Config path display if available
- Helpful next steps message

### Files Modified
- `src/cli/talos.ts` - Implemented status command action, added formatUptime helper
- `src/cli/talos.test.ts` - Added status command tests

### Deviations from Spec
- Did NOT add date-fns dependency - implemented formatUptime helper instead
  (avoids adding external dependency for simple formatting)

### Decisions Made
- Custom formatUptime function instead of date-fns (simpler, no dependency)
- Format: "Xd Yh", "Xh Ym", "Xm Ys", or "Xs" depending on duration
- Exit code 0 for both running and stopped (both are valid states)

### Known Limitations
- None