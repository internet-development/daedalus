---
# daedalus-yayo
title: Implement 'talos logs' command
status: todo
type: task
created_at: 2026-01-29T00:32:08Z
updated_at: 2026-01-29T00:32:08Z
parent: daedalus-qkep
---

Implement the logs command to tail and display daemon output.

## Prerequisites
- Process management ready (daedalus-6vtz)

## Implementation

Update `src/cli/talos.ts`:

```typescript
import { existsSync, readFileSync, statSync, createReadStream } from 'fs';
import { join } from 'path';
import { spawn } from 'child_process';

program
  .command('logs')
  .description('Show daemon logs')
  .option('-f, --follow', 'Follow log output (like tail -f)')
  .option('-n, --lines <number>', 'Number of lines to show', '50')
  .option('--no-color', 'Disable colored output')
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
        stdio: 'inherit',
      });

      process.on('SIGINT', () => {
        tail.kill();
        process.exit(0);
      });
    } else {
      // Read last N lines
      const content = readFileSync(logFile, 'utf-8');
      const allLines = content.split('\n');
      const lastLines = allLines.slice(-lines);
      console.log(lastLines.join('\n'));
    }
  });
```

## Features

### Show Last 50 Lines (default)
```bash
talos logs
```

### Show Last N Lines
```bash
talos logs -n 100
```

### Follow Logs (live tail)
```bash
talos logs -f
# Press Ctrl+C to stop
```

### Combined
```bash
talos logs -f -n 20
# Show last 20 lines, then follow
```

## Enhanced Version (Optional)
If we want better log parsing:
```typescript
// Parse JSON logs and pretty print
function formatLogLine(line: string): string {
  try {
    const log = JSON.parse(line);
    const timestamp = new Date(log.time).toISOString();
    const level = log.level.toUpperCase().padEnd(5);
    const msg = log.msg;
    const context = { ...log };
    delete context.time;
    delete context.level;
    delete context.msg;
    
    return `${timestamp} ${level} ${msg} ${JSON.stringify(context)}`;
  } catch {
    return line; // Not JSON, return as-is
  }
}
```

## Error Handling
- Handle missing log file
- Handle daemon not running
- Handle Ctrl+C in follow mode
- Handle empty log file

## Files to Modify
- `src/cli/talos.ts`

## Acceptance Criteria
- [ ] Shows last N lines by default
- [ ] -n flag changes line count
- [ ] -f flag follows log output
- [ ] Ctrl+C stops following gracefully
- [ ] Handles missing log file
- [ ] Helpful error messages
- [ ] Works with JSON log format (from Pino)
- [ ] Optional: Pretty prints JSON logs