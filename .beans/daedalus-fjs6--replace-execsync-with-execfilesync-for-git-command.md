---
# daedalus-fjs6
title: Replace execSync with execFileSync for git commands
status: todo
type: task
priority: normal
created_at: 2026-01-31T07:55:49Z
updated_at: 2026-01-31T07:55:54Z
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

- [ ] Replace `git()` helper in `completion-handler.ts` with `execFileSync` version
- [ ] Replace all `execSync` git calls in `scheduler.ts` with `execFileSync`
- [ ] Add `validateBeanId()` helper for defense-in-depth
- [ ] Add unit tests for `validateBeanId()` (valid IDs pass, special chars rejected)
- [ ] Verify all existing tests still pass after migration (`npm test`)
- [ ] Check for any other `execSync` git calls in the codebase
