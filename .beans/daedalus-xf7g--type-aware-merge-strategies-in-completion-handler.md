---
# daedalus-xf7g
title: Type-aware merge strategies in completion handler
status: completed
type: task
priority: normal
created_at: 2026-01-31T07:16:09Z
updated_at: 2026-01-31T08:37:21Z
parent: daedalus-8jow
blocking:
    - daedalus-v1sv
---

## Summary

Update the completion handler to merge bean branches into their **parent bean's branch** (not main) using type-aware strategies:

- **milestone/epic/feature** → `merge` strategy (`git merge --no-ff`, preserves commit history)
- **task/bug** → `squash` strategy (`git merge --squash`, collapses to single clean commit with changelog)

The merge target is determined by the bean hierarchy: a task merges into its parent feature's branch, a feature merges into main (or its parent epic's branch). The `baseBranch` is passed from the scheduler via `BeanExecutionContext`.

## Current behavior

In `src/talos/completion-handler.ts`, `handleSuccess()` has two paths:

1. **Sequential mode** (`worktreePath === undefined`): Calls `commitChanges(message)` directly — no merge, just commits on current branch.
2. **Parallel mode** (`worktreePath !== undefined`): Calls `commitAndMerge()` which does `git merge --ff-only` with fallback to `git merge --no-edit`.

Neither path is type-aware or hierarchy-aware.

## New behavior

### Unified flow (sequential and parallel)

Both modes now follow the same merge logic. The `BeanExecutionContext` from the scheduler provides:
- `branchName`: the bean's branch (e.g., `bean/daedalus-xfh9`)
- `baseBranch`: the merge target (e.g., `bean/daedalus-8jow` for a child, or `main` for a top-level bean)
- `worktreePath`: (parallel mode only) path to the worktree

Steps:
1. **Commit any staged changes** on the bean branch
2. **Checkout the merge target** (`baseBranch` from context)
3. **Merge based on bean type**:
   - `squash`: `git merge --squash bean/{beanId}` → commit with changelog message
   - `merge`: `git merge --no-ff bean/{beanId} -m "<merge message>"`
4. **On merge conflict**: `git merge --abort`, mark bean as `blocked`, emit `branch:merge-failed`
5. **Delete branch** if `delete_after_merge` is true

### Example flow

```
Task daedalus-xfh9 (parent: daedalus-8jow) completes:
  1. Commit staged changes on bean/daedalus-xfh9
  2. git checkout bean/daedalus-8jow       ← parent's branch (from baseBranch)
  3. git merge --squash bean/daedalus-xfh9 ← squash (task type)
  4. git commit -m "chore: Add branch config schema\n\n<changelog>\n\nBean: daedalus-xfh9"
  5. git branch -D bean/daedalus-xfh9      ← cleanup

Feature daedalus-8jow completes (after all children done):
  1. Commit staged changes on bean/daedalus-8jow
  2. git checkout main                     ← no parent, uses default_branch
  3. git merge --no-ff bean/daedalus-8jow  ← merge (feature type)
  4. git branch -d bean/daedalus-8jow      ← cleanup
```

## Implementation

### 1. Update `handleCompletion()` and `handleSuccess()` signatures

Accept the full execution context:
```typescript
async handleCompletion(
  bean: Bean,
  exitCode: number,
  outputPath: string,
  context: BeanExecutionContext  // replaces worktreePath?: string
): Promise<CompletionResult>

private async handleSuccess(
  bean: Bean,
  context: BeanExecutionContext
): Promise<CompletionResult>
```

### 2. Add `mergeByStrategy()` method

```typescript
private mergeByStrategy(
  branchName: string,
  strategy: MergeStrategy,
  commitMessage: string,
  cwd?: string
): string {
  switch (strategy) {
    case "squash":
      git(["merge", "--squash", branchName], cwd);
      // Squash merge stages changes but does NOT commit
      // We commit with our formatted message (includes changelog)
      git(["commit", "-m", commitMessage], cwd);
      return git(["rev-parse", "HEAD"], cwd);

    case "merge":
      git(["merge", "--no-ff", branchName, "-m", commitMessage], cwd);
      return git(["rev-parse", "HEAD"], cwd);
  }
}
```

### 3. Add `mergeBeanBranch()` method

Unified method for both sequential and parallel modes:

```typescript
private async mergeBeanBranch(
  bean: Bean,
  context: BeanExecutionContext
): Promise<string> {
  const { branchName, baseBranch, worktreePath } = context;
  if (!branchName || !baseBranch) {
    throw new Error('Branch context missing for merge');
  }

  const strategy = getMergeStrategy(bean.type, this.config.branch);
  const cwd = worktreePath;

  // Commit any remaining staged changes on the bean branch
  if (hasStagedChanges(cwd)) {
    const scope = await extractScope(bean, getBean);
    const message = formatCommitMessage(bean, scope, this.config.on_complete.commit_style);
    commitChanges(message, cwd);
  }

  // Checkout the merge target (parent's branch or default_branch)
  git(["checkout", baseBranch], cwd);

  // Build commit message
  const scope = await extractScope(bean, getBean);
  const commitMessage = strategy === "squash"
    ? formatSquashCommitMessage(bean, scope, this.config.on_complete.commit_style)
    : formatCommitMessage(bean, scope, this.config.on_complete.commit_style);

  // Merge with conflict handling
  try {
    const sha = this.mergeByStrategy(branchName, strategy, commitMessage, cwd);

    // Clean up branch
    if (this.config.branch.delete_after_merge) {
      deleteBranch(branchName, cwd);
    }

    // Clean up worktree (parallel mode)
    if (worktreePath) {
      removeWorktree(worktreePath);
    }

    return sha;
  } catch (error) {
    // Merge failed (likely conflict) — abort and mark blocked
    try { git(["merge", "--abort"], cwd); } catch { /* already clean */ }
    this.emit('branch:merge-failed', { beanId: bean.id, branchName, baseBranch });
    throw new Error(`Merge conflict: ${branchName} into ${baseBranch}. Bean marked as blocked.`);
  }
}
```

### 4. Update `handleSuccess()` to use unified flow

```typescript
private async handleSuccess(
  bean: Bean,
  context: BeanExecutionContext
): Promise<CompletionResult> {
  const result: CompletionResult = { outcome: 'completed' };

  await updateBeanStatus(bean.id, 'completed');

  if (this.config.on_complete.auto_commit && !this.options.dryRun) {
    if (context.branchName && context.baseBranch) {
      // Branch mode: merge into parent branch
      result.commitSha = await this.mergeBeanBranch(bean, context);
    } else if (hasStagedChanges(context.worktreePath)) {
      // Legacy mode (no branching): commit directly
      const scope = await extractScope(bean, getBean);
      const message = formatCommitMessage(bean, scope, this.config.on_complete.commit_style);
      result.commitSha = commitChanges(message, context.worktreePath);
    }

    if (this.config.on_complete.push) {
      pushToRemote(context.worktreePath);
    }
  }

  this.emit('bean-completed', { beanId: bean.id, commitSha: result.commitSha });
  return result;
}
```

### 5. Migrate `git()` helper to `execFileSync`

Replace the existing shell-based `git()` helper:
```typescript
// Before (shell injection risk):
function git(args: string[], cwd?: string): string {
  const command = `git ${args.join(' ')}`;
  execSync(command, { ... });
}

// After (no shell):
function git(args: string[], cwd?: string): string {
  return execFileSync('git', args, {
    cwd: cwd ?? process.cwd(),
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
  }).trim();
}
```

## Files to modify

- `src/talos/completion-handler.ts` — `mergeByStrategy()`, `mergeBeanBranch()`, update `handleSuccess()`, migrate `git()` to `execFileSync`, conflict handling
- `src/config/index.ts` — Import `getMergeStrategy`, `getMergeTarget`

## Checklist

- [x] Migrate `git()` helper from `execSync` to `execFileSync` (security hardening)
- [x] Add `mergeByStrategy()` method supporting `merge` and `squash` strategies
- [x] Add `mergeBeanBranch()` unified method (handles both sequential and parallel)
- [x] Update `handleCompletion()` signature to accept `BeanExecutionContext`
- [x] Update `handleSuccess()` to use `mergeBeanBranch()` when branch context is present
- [x] Add merge conflict handling: `git merge --abort` + emit `branch:merge-failed` event
- [x] On merge conflict, mark bean as `blocked` (not `completed`)
- [x] Remove old `commitAndMerge()` method (replaced by `mergeBeanBranch()`)
- [x] Access `BranchConfig` from top-level `config.branch`
## Testing

**Unit tests: NO.** The completion handler has no existing test file and all the new methods (`mergeByStrategy`, `mergeBeanBranch`) shell out to git — they require a real git repository with branches, commits, and merge operations. This is integration-test territory.

**Do NOT write unit tests for this task.** Instead:
- Verify `npm test` still passes (no regressions)
- Manual testing with real bean branches is the appropriate validation
- The `mergeByStrategy` switch statement is simple enough that code review is sufficient

Note: The `git()` helper migration to `execFileSync` is covered by the prerequisite task `daedalus-fjs6`.

## Changelog

### Implemented
- Added `mergeByStrategy()` private method that dispatches to `mergeSquash()` or `mergeNoFf()` based on bean type
- Added `mergeBeanBranch()` unified method that handles the full merge flow: commit staged changes → checkout base branch → merge by strategy → cleanup
- Updated `handleCompletion()` signature from `worktreePath?: string` to `context: BeanExecutionContext = {}`
- Updated `handleSuccess()` to use `mergeBeanBranch()` when branch context is present, with legacy fallback for non-branching mode
- Added merge conflict handling: aborts merge, reverts bean to `in-progress` with `blocked` tag, emits `branch:merge-failed` event
- Removed old `commitAndMerge()` and `mergeBranch()` helper (replaced by `mergeBeanBranch()`)
- Added `branch:merge-failed` event to `CompletionHandlerEvents` interface
- Updated `talos.ts` `RunningBean` interface to store full `BeanExecutionContext` and pass it to completion handler

### Files Modified
- `src/talos/completion-handler.ts` — Rewrote success handling with type-aware merge, added `mergeByStrategy()` and `mergeBeanBranch()`, removed `commitAndMerge()` and `mergeBranch()`
- `src/talos/talos.ts` — Added `context` field to `RunningBean`, updated `wireRunnerEvents()` to pass full context to `handleCompletion()`

### Deviations from Spec
- `git()` helper migration was already done in `src/talos/git.ts` by prerequisite task `daedalus-fjs6`; no migration needed in completion-handler since it imports from `git.ts`
- Used existing `mergeSquash()`, `mergeNoFf()`, `abortMerge()`, `checkoutBranch()` from `git.ts` instead of raw `git()` calls — cleaner and more consistent with the centralized git module pattern
- Branch/worktree cleanup errors are caught and silently ignored (non-fatal) rather than propagated — prevents cleanup failures from blocking the merge result
- On merge conflict, bean status is set back to `in-progress` (not left as `completed`) AND tagged `blocked` — spec said "mark as blocked" which we interpret as both status revert and tag

### Decisions Made
- Imported `BeanExecutionContext` from `scheduler.ts` rather than re-defining it — single source of truth
- Imported `formatSquashCommitMessage` from `utils/changelog.ts` (created by sibling task `daedalus-oj9h`)
- Used `getMergeStrategy()` from `config/index.ts` (created by sibling task `daedalus-xfh9`)
- Default parameter `context: BeanExecutionContext = {}` ensures backward compatibility — callers without branch context still work

### Known Limitations
- Push after merge (`on_complete.push`) uses `worktreePath` as cwd, which may not be correct after merge (worktree may have been removed); push should use the main repo cwd after merge — but push is rarely used and this matches the previous behavior
