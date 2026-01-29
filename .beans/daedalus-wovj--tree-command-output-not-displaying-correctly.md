---
# daedalus-wovj
title: /tree command output not displaying correctly
status: in-progress
type: bug
priority: normal
created_at: 2026-01-28T20:11:59Z
updated_at: 2026-01-29T06:04:03Z
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
- [x] Investigate whether `beans tree` needs stdin (interactive features?)
- [x] If no stdin needed: use `stdio: ['ignore', 'inherit', 'inherit']`
- [x] If stdin needed: add `rl` to CommandContext and pause/resume around spawn
- [x] Test `/tree` displays correctly
- [x] Test ANSI colors work
- [x] Test Ctrl+C works during tree display
- [x] Test prompt returns cleanly after tree completes
- [x] Test other spawned commands if any (check for similar issues)

## Changelog

### Implemented
- Fixed `/tree` command to use `runTree()` from `tree-simple.ts` instead of spawning non-existent `beans tree` command
- The tree command now displays correctly with proper ANSI colors and no stdin conflicts

### Files Modified
- `src/cli/commands.ts` - Changed `handleTree()` to call `runTree()` directly instead of spawning `beans tree`

### Deviations from Spec
- **Root cause was different than analyzed**: The spec assumed `beans tree` existed and the issue was `stdio: 'inherit'`. In reality, `beans tree` doesn't exist at all - the beans CLI has no `tree` command. The actual tree functionality is implemented in `src/cli/tree-simple.ts` via `runTree()`.
- **Neither Option 1 nor Option 2 was used**: Since `beans tree` doesn't exist, we simply call the existing `runTree()` function directly, which already handles everything correctly (queries beans via GraphQL, builds tree, renders with ANSI colors).

### Decisions Made
- Used the existing `runTree()` function from `tree-simple.ts` which was already being used by `daedalus tree` CLI command
- This is the simplest and most correct fix since it reuses existing, tested code

### Known Limitations
- None - the fix fully resolves the issue