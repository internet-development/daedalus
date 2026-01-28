---
# daedalus-zlj6
title: Create tree.ts
status: todo
type: task
created_at: 2026-01-28T04:05:02Z
updated_at: 2026-01-28T04:05:02Z
parent: daedalus-gu7g
---

## Summary

Create a simple wrapper that spawns `beans tree` as a subprocess, passing through all arguments.

## File

`src/cli/tree.ts`

## Function Signature

```typescript
export interface TreeOptions {
  args: string[];  // All arguments to pass to beans tree
}

export async function runTree(options: TreeOptions): Promise<void>
```

## Implementation

```typescript
import { spawn } from 'child_process';

export interface TreeOptions {
  args: string[];
}

export async function runTree(options: TreeOptions): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('beans', ['tree', ...options.args], {
      stdio: 'inherit',  // Pass through stdin/stdout/stderr
    });
    
    child.on('error', (err) => {
      if (err.message.includes('ENOENT')) {
        console.error('Error: beans CLI not found. Please install beans first.');
        console.error('See: https://github.com/anomalyco/beans');
      } else {
        console.error(`Error running beans tree: ${err.message}`);
      }
      reject(err);
    });
    
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`beans tree exited with code ${code}`));
      }
    });
  });
}
```

## Usage

From CLI:
```bash
daedalus tree                           # beans tree
daedalus tree daedalus-abc1             # beans tree daedalus-abc1
daedalus tree --blocking                # beans tree --blocking
daedalus tree -s todo,in-progress       # beans tree -s todo,in-progress
```

From /command:
```
/tree                     # beans tree
/tree daedalus-abc1       # beans tree daedalus-abc1
/tree --blocking          # beans tree --blocking
```

## Why Subprocess?

- beans already has excellent tree rendering
- No need to duplicate code
- Stays in sync with beans CLI updates
- Simpler to maintain

## Checklist

- [ ] Define TreeOptions interface
- [ ] Implement runTree function
- [ ] Handle spawn errors (ENOENT for missing beans)
- [ ] Handle non-zero exit codes
- [ ] Use stdio: 'inherit' for passthrough
- [ ] Export runTree