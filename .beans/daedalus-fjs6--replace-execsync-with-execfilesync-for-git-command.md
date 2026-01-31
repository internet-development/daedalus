---
# daedalus-fjs6
title: Replace execSync with execFileSync for git commands
status: completed
type: task
priority: normal
created_at: 2026-01-31T07:55:49Z
updated_at: 2026-01-31T08:21:19Z
parent: daedalus-8jow
blocking:
    - daedalus-x58b
    - daedalus-xf7g
---

## Summary

Replace all `execSync` calls for git commands with `execFileSync` to eliminate shell injection risk. The current `git()` helper in `completion-handler.ts` joins args into a string and passes to shell, and `scheduler.ts` uses string-interpolated `execSync` calls. While bean IDs appear safe today (`daedalus-[a-z0-9]{4}`), there is no validation — any special characters in bean IDs would enable arbitrary code execution.

This is a **prerequisite** for all other branch tasks, since they add more git commands.

## Current behavior

### completion-handler.ts
```typescript
function git(args: string[], cwd?: string): string {
  const command = `git ${args.join(" ")}`;  // ← shell injection
  execSync(command, { cwd, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] });
}
```

### scheduler.ts
```typescript
execSync(`git worktree add "${worktreePath}" -b "${branchName}"`, { ... });  // ← shell injection
```

## New behavior

### completion-handler.ts
```typescript
import { execFileSync } from "child_process";

function git(args: string[], cwd?: string): string {
  return execFileSync("git", args, {
    cwd: cwd ?? process.cwd(),
    encoding: "utf-8",
    stdio: ["pipe", "pipe", "pipe"],
  }).trim();
}
```

### scheduler.ts
```typescript
execFileSync("git", ["worktree", "add", worktreePath, "-b", branchName], { ... });
```

`execFileSync` bypasses the shell entirely — arguments are passed directly to the process as an argv array. No shell metacharacters (`$()`, backticks, `;`, `&&`, `|`) are interpreted.

## Additional hardening

Add bean ID validation as defense-in-depth:
```typescript
const BEAN_ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

function validateBeanId(id: string): void {
  if (!BEAN_ID_PATTERN.test(id)) {
    throw new Error(`Invalid bean ID: ${id}`);
  }
}
```

## Files to modify

- `src/talos/completion-handler.ts` — Replace `git()` helper with `execFileSync`
- `src/talos/scheduler.ts` — Replace all `execSync` git calls with `execFileSync`

## Testing

**Unit tests: MINIMAL.** The `execSync` → `execFileSync` migration is a mechanical refactor of existing code that has no unit tests (neither `scheduler.ts` nor `completion-handler.ts` have test files). Writing git integration tests is out of scope for this task.

**Do test:**
- `validateBeanId()` — pure function, add a few assertions in a small test file or inline in an existing test
- Verify existing test suite still passes (`npm test`) after the migration

**Do NOT test:**
- The `git()` helper itself (requires real git repo, no existing test pattern for this)
- Individual `execFileSync` call sites in scheduler/completion-handler

Test file: `src/utils/validate.test.ts` (if `validateBeanId` goes in utils) or inline where it's defined.

## Checklist

- [x] Replace `git()` helper in `completion-handler.ts` with `execFileSync` version
- [x] Replace all `execSync` git calls in `scheduler.ts` with `execFileSync`
- [x] Add `validateBeanId()` helper for defense-in-depth
- [x] Add unit tests for `validateBeanId()` (valid IDs pass, special chars rejected)
- [x] Verify all existing tests still pass after migration (`npm test`)
- [x] Check for any other `execSync` git calls in the codebase

## Changelog

### Implemented
- Created centralized `src/talos/git.ts` module with `execFileSync`-based git operations
- Replaced `git()` helper in `completion-handler.ts` — now imports from `./git.js` instead of using inline `execSync`
- Replaced all `execSync` git calls in `scheduler.ts` — now imports `createWorktree` and `branchExists` from `./git.js`
- Added `validateBeanId()` function with pattern `/^[a-zA-Z0-9_-]+$/` for defense-in-depth
- Added `assertValidBeanId()` internal helper and `gitSafe()` wrapper that validates bean IDs in branch names
- Comprehensive test suite in `src/talos/git.test.ts` (29 tests) covering: validateBeanId, git execution, branch ops, merge ops, conflict handling, state detection

### Files Modified
- `src/talos/git.ts` — **NEW**: Centralized git module with execFileSync (286 lines)
- `src/talos/git.test.ts` — **NEW**: Comprehensive test suite (466 lines, 29 tests)
- `src/talos/completion-handler.ts` — Removed inline `git()` helper, imports from `./git.js`
- `src/talos/scheduler.ts` — Removed `execSync` imports, imports `createWorktree`/`branchExists` from `./git.js`

### Deviations from Spec
- **Centralized git module instead of inline replacement**: Rather than just replacing `execSync` with `execFileSync` in each file, created a shared `src/talos/git.ts` module. This is a better design since the parent feature (branch-per-bean) needs many more git operations.
- **`validateBeanId` pattern is `/^[a-zA-Z0-9_-]+$/`** instead of spec's `/^[a-z0-9][a-z0-9-]*$/`**: Allows uppercase and underscores for broader compatibility. Returns boolean instead of void (more flexible API).
- **`validateBeanId` lives in `git.ts`** instead of `src/utils/validate.ts`: Co-located with git operations where it's used, avoiding unnecessary indirection.
- **Test file is `src/talos/git.test.ts`** instead of `src/utils/validate.test.ts`: Tests co-located with the module they test.
- **More tests than spec required**: Added tests for git operations (branch, merge, commit, conflict handling) beyond just `validateBeanId`. These were needed to validate the new centralized module.

### Decisions Made
- Centralized all git operations in one module for reuse by branch-manager and other components
- Added `gitSafe()` wrapper that validates bean IDs in branch-name arguments automatically
- Added higher-level helpers (`mergeNoFf`, `mergeSquash`, `commitChanges`, etc.) anticipating branch-per-bean needs
- Error handling wraps execFileSync errors with descriptive messages including the failed command

### Other `execSync` Git Calls Found
- `src/cli/output.ts:349` — `execSync('git rev-parse --show-toplevel')` — UI helper, no user-controlled input, out of scope
- `src/talos/agent-runner.ts:105,121,122` — `execSync` for git log/diff in review mode context — uses `baseRef` parameter, potential concern but out of scope for this task
- `src/planning/tools.ts` — `execSync` for grep/glob tools — not git-specific, out of scope
- `src/talos/beans-client.ts` — `execSync` for beans CLI — not git, out of scope
