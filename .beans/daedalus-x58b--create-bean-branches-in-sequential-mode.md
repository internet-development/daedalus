---
# daedalus-x58b
title: Create bean branches in sequential mode
status: in-progress
type: task
priority: normal
created_at: 2026-01-31T07:15:39Z
updated_at: 2026-01-31T08:24:29Z
parent: daedalus-8jow
blocking:
    - daedalus-xf7g
---

## Summary

When a bean is about to be worked on, create a **hierarchical branch structure** that mirrors the bean parent-child relationships. The scheduler ensures the entire ancestor branch chain exists before creating the child's branch.

Key change: branches are created **from their parent bean's branch**, not from main. This means `bean/task-123` branches off `bean/feature-456`, which branches off `main`.

## Current behavior

In `src/talos/scheduler.ts`, `markBeanInProgress()` and `markInProgress()` only create branches in parallel mode (`maxParallel > 1`) via git worktrees. Sequential mode has no branch isolation.

## New behavior

When `branch.enabled` is `true` (default — top-level config), create hierarchical branches for every bean regardless of `maxParallel`.

### Hierarchical branch creation

Before creating a bean's branch, ensure the full ancestor chain exists:

```
Bean hierarchy:                    Branch hierarchy:
feature/daedalus-8jow              main → bean/daedalus-8jow
  task/daedalus-xfh9                      → bean/daedalus-xfh9
  task/daedalus-x58b                      → bean/daedalus-x58b
```

Algorithm:
1. Fetch the bean's parent chain (walk up `parent` references)
2. For each ancestor (top-down from root), ensure `bean/{ancestorId}` exists:
   - If ancestor has a parent: branch from `bean/{ancestor.parentId}`
   - If ancestor has no parent: branch from `config.branch.default_branch` (e.g., `main`)
3. Create `bean/{beanId}` from its parent's branch
4. Checkout `bean/{beanId}` for the agent

### Sequential vs parallel mode

- **Sequential mode** (`maxParallel === 1`): `git checkout -b bean/{beanId} bean/{parentId}` in the main working directory. No worktree needed.
- **Parallel mode** (`maxParallel > 1`): `git worktree add` from the parent's branch instead of from HEAD.

## Implementation

### 1. Pass branch config to Scheduler

The scheduler needs access to the full `BranchConfig`. In `src/talos/talos.ts`, pass it when constructing the scheduler:
```typescript
// Add to scheduler config interface
branchConfig: BranchConfig;
```

### 2. Add `ensureAncestorBranches()` method

```typescript
/**
 * Ensure the full ancestor branch chain exists for a bean.
 * Creates branches top-down from the root ancestor.
 */
private async ensureAncestorBranches(bean: Bean): Promise<string> {
  // Walk up parent chain to collect ancestors
  const ancestors: Bean[] = [];
  let current = bean;
  while (current.parentId) {
    const parent = await getBean(current.parentId);
    if (!parent) break;
    ancestors.unshift(parent); // prepend so root is first
    current = parent;
  }

  // Create branches top-down
  for (const ancestor of ancestors) {
    const baseBranch = ancestor.parentId
      ? `bean/${ancestor.parentId}`
      : this.config.branchConfig.default_branch;
    this.ensureBranch(`bean/${ancestor.id}`, baseBranch);
  }

  // Return the immediate parent's branch (merge target for this bean)
  return bean.parentId
    ? `bean/${bean.parentId}`
    : this.config.branchConfig.default_branch;
}
```

### 3. Add `ensureBranch()` method

```typescript
/**
 * Ensure a branch exists. Creates it from baseBranch if it doesn't.
 * Uses execFileSync (no shell) for security.
 */
private ensureBranch(branchName: string, baseBranch: string): void {
  // Check if branch already exists
  try {
    execFileSync('git', ['rev-parse', '--verify', branchName], {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return; // branch exists
  } catch {
    // Branch doesn't exist, create it
  }

  execFileSync('git', ['branch', branchName, baseBranch], {
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}
```

### 4. Update `markBeanInProgress()` / `markInProgress()`

```typescript
let worktreePath: string | undefined;
let branchName: string | undefined;
let baseBranch: string | undefined;

if (this.config.branchConfig.enabled) {
  // Ensure ancestor branches exist and get the merge target
  baseBranch = await this.ensureAncestorBranches(bean);
  branchName = `bean/${beanId}`;

  if (this.config.maxParallel > 1) {
    // Parallel: worktree from parent branch
    worktreePath = await this.createWorktree(beanId, baseBranch);
  } else {
    // Sequential: checkout branch
    this.ensureBranch(branchName, baseBranch);
    execFileSync('git', ['checkout', branchName], {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  }
} else if (this.config.maxParallel > 1) {
  // Legacy: parallel without branch config
  worktreePath = await this.createWorktree(beanId);
}
```

### 5. Update event context

Use a typed context object for the `bean-ready` event:
```typescript
interface BeanExecutionContext {
  worktreePath?: string;   // parallel mode
  branchName?: string;     // bean's branch name
  baseBranch?: string;     // merge target (parent's branch or default_branch)
}

"bean-ready": (bean: Bean, context: BeanExecutionContext) => void;
```

Update `src/talos/talos.ts` to pass context through to the completion handler.

### 6. Check for dirty git state before branch creation

```typescript
private assertCleanWorkingTree(): void {
  const status = execFileSync('git', ['status', '--porcelain'], {
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  if (status.trim()) {
    throw new Error('Cannot create branch: working tree has uncommitted changes');
  }
}
```

### 7. Check for MERGE_HEAD on startup

In `src/talos/talos.ts`, during initialization or `detectOrphanedBeans()`:
```typescript
private recoverGitState(): void {
  // Abort any in-progress merge
  try {
    execFileSync('git', ['rev-parse', '--verify', 'MERGE_HEAD'], { ... });
    execFileSync('git', ['merge', '--abort'], { ... });
    log.warn('Aborted in-progress merge from previous run');
  } catch { /* no MERGE_HEAD, clean state */ }
}
```

## Edge cases

- **Dirty working tree**: Check before branch creation, fail with clear error (don't silently carry changes)
- **Branch already exists**: `ensureBranch()` is idempotent — checks first, creates only if needed
- **Agent failure**: Leave the branch as-is. On retry, the scheduler checks out the existing branch
- **Daemon crash mid-merge**: `recoverGitState()` on startup aborts any in-progress merge
- **Parent bean not found**: If `getBean(parentId)` returns null, stop walking and use default_branch as base

## Files to modify

- `src/talos/scheduler.ts` — Hierarchical branch creation, `ensureAncestorBranches()`, `ensureBranch()`, updated event context
- `src/talos/talos.ts` — Pass branch config to scheduler, update event handlers, add `recoverGitState()`

## Checklist

- [x] Add `branchConfig: BranchConfig` to scheduler config interface
- [x] Pass `config.branch` from talos.ts to scheduler
- [x] Add `ensureBranch()` method (idempotent, uses `execFileSync`)
- [x] Add `ensureAncestorBranches()` method (walks parent chain, creates top-down)
- [x] Update `markInProgress()` to create hierarchical branches in sequential mode
- [x] Update `markBeanInProgress()` to create hierarchical branches in sequential mode
- [x] Update `createWorktree()` to accept a base branch parameter for parallel mode
- [x] Define `BeanExecutionContext` interface (`branchName`, `baseBranch`, `worktreePath`)
- [x] Update `bean-ready` event to emit `BeanExecutionContext`
- [x] Update talos.ts event handler to forward context to completion handler
- [x] Add `assertCleanWorkingTree()` check before branch creation
- [x] Add `recoverGitState()` to talos.ts startup (abort MERGE_HEAD/REBASE_HEAD)
- [x] Handle edge case: branch already exists (idempotent)
- [x] Handle edge case: parent bean not found (fall back to default_branch)

## Testing

**Unit tests: NO.** The scheduler has no existing test file and all the new methods (`ensureBranch`, `ensureAncestorBranches`, `assertCleanWorkingTree`, `recoverGitState`) shell out to git — they require a real git repository to test meaningfully. Creating a git repo fixture for each test would be fragile and slow.

**Do NOT write unit tests for this task.** Instead:
- Verify `npm test` still passes (no regressions)
- Manual testing with a real bean hierarchy is the appropriate validation
- The `BeanExecutionContext` interface is just a type — no runtime behavior to test

If integration tests are desired later, they should be a separate task with proper git repo fixtures (like `beans-client.integration.test.ts` uses real `beans` CLI).

## Changelog

### Implemented
- Added `branchConfig?: BranchConfig` to `SchedulerConfig` interface
- Passed `config.branch` from `talos.ts` to scheduler constructor
- Added `BeanExecutionContext` interface with `worktreePath`, `branchName`, `baseBranch`
- Added `ensureBranch()` — idempotent branch creation using centralized `git.ts` module
- Added `ensureAncestorBranches()` — walks parent chain, creates branches top-down
- Added `assertCleanWorkingTree()` — prevents dirty state from leaking into new branches
- Updated `markInProgress()` and `markBeanInProgress()` to create hierarchical branches in sequential mode (checkout) and parallel mode (worktree from parent branch)
- Updated `createWorktree()` to accept optional `baseBranch` parameter
- Updated `bean-ready` and `bean:in-progress` events to emit `BeanExecutionContext` instead of bare `worktreePath`
- Updated `talos.ts` `wireSchedulerEvents` to destructure `BeanExecutionContext`
- Added `recoverGitState()` to `talos.ts` startup — aborts in-progress merge/rebase from previous crash

### Files Modified
- `src/talos/scheduler.ts` — Added `BranchConfig` import, `BeanExecutionContext` interface, `ensureBranch()`, `ensureAncestorBranches()`, `assertCleanWorkingTree()`, updated `markInProgress()`, `markBeanInProgress()`, `createWorktree()`, `pollForReady()`, and event signatures
- `src/talos/talos.ts` — Added git imports, passed `branchConfig` to scheduler, updated `wireSchedulerEvents` to use `BeanExecutionContext`, added `recoverGitState()` called on startup

### Deviations from Spec
- Used centralized `git.ts` module functions (`branchExists`, `createBranch`, `checkoutBranch`, `isWorkingTreeDirty`) instead of raw `execFileSync` calls as shown in the spec pseudocode — this is consistent with the existing codebase pattern established by daedalus-fjs6
- `recoverGitState()` uses `console.warn` instead of a logger since it runs very early in startup — the logger may not be fully initialized yet
- `markInProgress()` and `markBeanInProgress()` return `BeanExecutionContext` instead of `string | undefined` — this is a breaking change to the return type but aligns with the new event signature

### Decisions Made
- Reused existing `git.ts` functions rather than duplicating `execFileSync` calls — keeps all git operations centralized and shell-injection safe
- Made `branchConfig` optional in `SchedulerConfig` (using `?`) so existing code without branch config continues to work unchanged
- Error handling in branch/worktree creation re-enqueues the bean for retry, matching existing worktree error handling pattern
- `createWorktree()` checks `branchExists()` first to handle the case where a branch was created by `ensureAncestorBranches()` but worktree doesn't exist yet

### Known Limitations
- No unit tests (per spec — git operations require real repo fixtures)
- `recoverGitState()` only handles MERGE_HEAD and REBASE_HEAD; other git states (CHERRY_PICK_HEAD, etc.) are not recovered
- The completion handler still receives `worktreePath` as a string, not the full `BeanExecutionContext` — the context forwarding to completion handler is done via the existing `RunningBean.worktreePath` field
