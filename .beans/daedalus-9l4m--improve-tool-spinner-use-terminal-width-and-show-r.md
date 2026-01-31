---
# daedalus-9l4m
title: 'Improve tool spinner: use terminal width and show relative paths'
status: in-progress
type: task
priority: normal
created_at: 2026-01-30T08:05:22Z
updated_at: 2026-01-31T06:22:35Z
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

- [x] Replace hardcoded `TOOL_ARGS_MAX_LENGTH` with dynamic terminal width calculation in `src/cli/spinner.ts`
- [x] Add `getGitRoot()` and `toRelativePath()` helpers in `src/cli/output.ts`
- [x] Update `formatToolArgs()` read/write/edit cases to use `toRelativePath()`
- [x] Update existing tests in `src/cli/plan-tool-spinner.test.ts` if affected
- [x] Add test for `toRelativePath()` showing relative conversion

## Changelog

### Implemented
- Replaced hardcoded `TOOL_ARGS_MAX_LENGTH = 120` in `spinner.ts` with dynamic calculation using `process.stdout.columns`
- Replaced hardcoded `TOOL_ARGS_MAX_LENGTH = 120` in `output.ts` with `getToolArgsMaxLength()` function
- Added `getGitRoot()` helper that caches the git root directory (via `git rev-parse --show-toplevel`)
- Added exported `toRelativePath()` that converts absolute paths to relative from git root
- Added `_resetGitRootCache()` for test isolation
- Updated `formatToolArgs()` read/write/edit cases to call `toRelativePath()`
- Added 7 new tests: 4 for dynamic width, 3 for toRelativePath
- Added 4 new tests for formatToolArgs relative path behavior
- Updated 6 existing tests (2 in plan-tool-spinner, 4 in output) to use real absolute paths

### Files Modified
- `src/cli/spinner.ts` — Removed `TOOL_ARGS_MAX_LENGTH` constant, added dynamic width calculation in `formatToolCallLine()`
- `src/cli/output.ts` — Added `getGitRoot()`, `toRelativePath()`, `_resetGitRootCache()`, `getToolArgsMaxLength()`; updated `formatToolArgs()` file cases
- `src/cli/plan-tool-spinner.test.ts` — Added tests for dynamic width and relative paths; updated existing tests
- `src/cli/output.test.ts` — Updated 4 file path tests to use real absolute paths and expect relative output

### Deviations from Spec
- Spec suggested `prefixLen = 2 + 1 + toolName.length + 1 + 1 + 1` (6 + name). Actual calculation is `2 + 1 + toolName.length + 1 + 1 + 1 + 1` (7 + name) to account for the space before the args text
- Added `getToolArgsMaxLength()` function in `output.ts` (not in spec) to replace the hardcoded constant used by `formatToolArgs` and `formatKeyValueArgs`
- Added `_resetGitRootCache()` export (not in spec) for test isolation of the cached git root
- Used `stdio: ['pipe', 'pipe', 'pipe']` in `execSync` to suppress stderr from git command

### Decisions Made
- Exported `toRelativePath` and `_resetGitRootCache` so tests can verify behavior and reset state
- Used `getToolArgsMaxLength()` returning `columns - 20` for the output.ts truncation (reserves space for `[Tool: Name]` prefix)
- Minimum args width of 20 chars enforced in spinner.ts to prevent unusable output on very narrow terminals

### Known Limitations
- `getGitRoot()` calls `execSync` once per session — if the process changes working directory to a different repo, the cached root will be stale
- `toRelativePath()` on paths outside the git root will produce `../..` relative paths rather than keeping the absolute path
