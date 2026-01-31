---
# daedalus-9l4m
title: 'Improve tool spinner: use terminal width and show relative paths'
status: todo
type: task
priority: normal
created_at: 2026-01-30T08:05:22Z
updated_at: 2026-01-30T08:56:37Z
parent: daedalus-bmnc
---

Tool call spinner lines truncate args at a hardcoded 120 characters and show absolute file paths. Both reduce readability.

## Changes

### 1. Use terminal width for truncation

Replace the hardcoded `TOOL_ARGS_MAX_LENGTH = 120` with a dynamic calculation based on terminal width. The args portion should fill the remaining space after the prefix `  [ToolName] ✓ `.

In `src/cli/spinner.ts`:
- Remove `const TOOL_ARGS_MAX_LENGTH = 120`
- In `formatToolCallLine()`, calculate available width:
  ```typescript
  const cols = process.stdout.columns || 120;
  // Prefix: "  [ToolName] X " where X is the indicator (1 char)
  // Account for ANSI escape codes being zero-width
  const prefixLen = 2 + 1 + toolName.length + 1 + 1 + 1; // "  [Name] X "
  const maxArgs = Math.max(20, cols - prefixLen);
  const truncatedArgs = argsStr ? truncate(argsStr, maxArgs) : '';
  ```

Also update the `truncate` function in `src/cli/output.ts` (line 436) which is used by `formatToolArgs` — it uses the same hardcoded constant.

### 2. Show relative paths from git root

File paths in tool args (Read, Write, Edit) currently show absolute paths. Convert them to relative paths from the git root, falling back to cwd if not in a git repo.

In `src/cli/output.ts`, update `formatToolArgs()`:
- For the `read`/`write`/`edit` cases, convert `filePath` to relative:
  ```typescript
  case 'read':
  case 'write':
  case 'edit': {
    const filePath = args.filePath;
    if (typeof filePath === 'string') {
      return toRelativePath(filePath);
    }
    break;
  }
  ```
- Add a helper function that finds git root and makes paths relative:
  ```typescript
  import { execSync } from 'child_process';
  import { relative } from 'path';

  let _gitRoot: string | null | undefined; // undefined = not computed yet

  function getGitRoot(): string | null {
    if (_gitRoot === undefined) {
      try {
        _gitRoot = execSync('git rev-parse --show-toplevel', { encoding: 'utf-8' }).trim();
      } catch {
        _gitRoot = null;
      }
    }
    return _gitRoot;
  }

  function toRelativePath(absPath: string): string {
    const root = getGitRoot() || process.cwd();
    const rel = relative(root, absPath);
    return rel || absPath;
  }
  ```
- Cache the git root (it won't change during a session)

## Files to modify

- `src/cli/spinner.ts` — Dynamic width in `formatToolCallLine()`
- `src/cli/output.ts` — `toRelativePath()` helper, update `formatToolArgs()` file cases

## Checklist

- [ ] Replace hardcoded `TOOL_ARGS_MAX_LENGTH` with dynamic terminal width calculation in `src/cli/spinner.ts`
- [ ] Add `getGitRoot()` and `toRelativePath()` helpers in `src/cli/output.ts`
- [ ] Update `formatToolArgs()` read/write/edit cases to use `toRelativePath()`
- [ ] Update existing tests in `src/cli/plan-tool-spinner.test.ts` if affected
- [ ] Add test for `toRelativePath()` showing relative conversion
