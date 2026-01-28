---
# daedalus-wovj
title: /tree command output not displaying correctly
status: todo
type: bug
priority: normal
created_at: 2026-01-28T20:11:59Z
updated_at: 2026-01-28T22:13:09Z
parent: daedalus-tbsm
---

## Problem

When running the `/tree` command, instead of displaying the directory tree:
1. Shows raw escape codes like `gb:2e2e/3434/4040` (likely malformed ANSI color codes)
2. Captures stdin (user input is not echoed or processed normally)
3. Requires force quit (Ctrl+C doesn't work normally)

## Root Cause Analysis

Found the implementation in `src/cli/commands.ts` (lines 268-285):

```typescript
async function handleTree(args: string): Promise<CommandResult> {
  const treeArgs = args.trim() ? args.trim().split(/\s+/) : [];
  return new Promise((resolve) => {
    const child = spawn('beans', ['tree', ...treeArgs], {
      stdio: 'inherit',  // <-- This is the problem
    });
    // ...
  });
}
```

**The issue**: `stdio: 'inherit'` passes the current process's stdin/stdout/stderr directly to the child. However, readline has already claimed stdin and set up event handlers. When the child inherits stdin:
1. Readline and the child both try to read from stdin
2. Terminal settings (like raw mode used by session selector) may conflict
3. ANSI escape codes may get mangled in the crossover

## Likely Fix

Don't use `stdio: 'inherit'`. Instead:
1. Pipe stdout/stderr and forward to console
2. Don't inherit stdin (tree doesn't need input)
3. Or pause readline before spawning and resume after

### Option 1: Pipe stdio (simpler)
```typescript
const child = spawn('beans', ['tree', ...treeArgs], {
  stdio: ['ignore', 'pipe', 'pipe'],  // stdin ignored, stdout/stderr piped
});
child.stdout?.pipe(process.stdout);
child.stderr?.pipe(process.stderr);
```

### Option 2: Pause readline (more robust)
```typescript
rl.pause();  // Stop reading stdin
const child = spawn('beans', ['tree', ...treeArgs], {
  stdio: 'inherit',
});
child.on('close', () => {
  rl.resume();  // Resume reading stdin
  resolve({ type: 'continue' });
});
```

Option 2 is probably better because `beans tree` might have interactive features.

## Files to modify
- `src/cli/commands.ts` - fix handleTree() spawn options
- `src/cli/commands.ts` - may need readline reference passed in CommandContext

## Checklist
- [ ] Investigate whether `beans tree` needs stdin (interactive features?)
- [ ] If no stdin needed: use `stdio: ['ignore', 'inherit', 'inherit']`
- [ ] If stdin needed: add `rl` to CommandContext and pause/resume around spawn
- [ ] Test `/tree` displays correctly
- [ ] Test ANSI colors work
- [ ] Test Ctrl+C works during tree display
- [ ] Test prompt returns cleanly after tree completes
- [ ] Test other spawned commands if any (check for similar issues)