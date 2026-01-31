---
# daedalus-8jow
title: Branch-per-bean with type-aware merge strategies
status: in-progress
type: feature
priority: normal
created_at: 2026-01-31T07:14:58Z
updated_at: 2026-01-31T08:06:02Z
---

## Summary

Every bean gets its own git branch (`bean/{beanId}`), with **hierarchical branching** that mirrors the bean parent-child structure. On completion, branches merge into their **parent's branch** (not directly to main) using a **type-aware merge strategy**:

- **milestone/epic/feature** → `merge` (creates merge commit via `--no-ff`, preserves commit history)
- **task/bug** → `squash` (collapses agent noise into one clean conventional commit with changelog)

### Branch hierarchy example

```
main
 └── bean/daedalus-8jow (feature)        ← merges into main (no parent)
      ├── bean/daedalus-xfh9 (task)      ← squash-merges into bean/daedalus-8jow
      ├── bean/daedalus-x58b (task)      ← squash-merges into bean/daedalus-8jow
      └── bean/daedalus-xf7g (task)      ← squash-merges into bean/daedalus-8jow
```

The git graph on main stays clean:
```
main ────────────────────────────●── (merge commit: feature complete)
                                /
bean/daedalus-8jow ──●──●──●──●   (squash commits from child tasks)
```

### Key rules

1. **Merge target = parent's branch.** A bean always merges into its parent bean's branch. Top-level beans (no parent) merge into the default branch (configurable, defaults to `main`).
2. **Ancestor branches are auto-created.** During bean scheduling, the entire ancestor branch chain is ensured to exist before creating the child's branch.
3. **Type determines strategy.** Tasks/bugs squash (clean commits), features/epics/milestones merge (preserve history).

This gives us:
1. **Traceability** — `git log --graph` shows which commits came from which bean
2. **Clean main branch** — task/bug squash commits are one-per-bean with changelog
3. **Branch isolation** — agents work on branches, not directly on main
4. **Hierarchical organization** — branch structure mirrors bean hierarchy

## Design

### Branch creation (during scheduling)

When a bean is about to be worked on, the scheduler ensures the full ancestor branch chain exists:

1. Walk up the bean's parent chain to find all ancestors
2. For each ancestor (top-down), create `bean/{ancestorId}` from its parent's branch if it doesn't exist
3. Create `bean/{beanId}` from `bean/{parentId}` (or default branch if no parent)
4. Checkout `bean/{beanId}` for the agent to work on

Example for a task under a feature:
```
git checkout -b bean/daedalus-8jow main              # feature branch from main (if not exists)
git checkout -b bean/daedalus-xfh9 bean/daedalus-8jow  # task branch from feature
```

### Merge (on completion)

1. Commit any staged changes on the bean branch
2. Determine merge target: parent's branch (`bean/{parentId}`) or default branch if no parent
3. Checkout the merge target
4. Merge using type-aware strategy:
   - **task/bug** (squash): `git merge --squash bean/{beanId}` → commit with changelog
   - **feature/epic/milestone** (merge): `git merge --no-ff bean/{beanId}`
5. Delete the bean branch if `delete_after_merge` is true
6. On merge conflict: `git merge --abort`, mark bean as `blocked`, emit event

### Parallel mode

Same hierarchical branching and type-aware merge, but using git worktrees. The worktree is created from the parent's branch instead of from main.

### Squash commit message format

For task/bug squash commits, the message includes the `## Changelog` section extracted from the bean body:

```
feat(scope): Bean title

### Implemented
- Did thing A
- Did thing B

### Deviations from Spec
- Changed X because Y

Bean: daedalus-abc1
```

### Configuration

`branch` is a **top-level** config section (not nested under `on_complete`) because branching spans the full bean lifecycle.

```yaml
branch:
  enabled: true                  # default: true — create branch per bean
  delete_after_merge: true       # default: true — clean up bean branches
  default_branch: main           # default: main — fallback for beans with no parent
  merge_strategy:                # per-type merge strategy (GitHub-style names)
    milestone: merge             # git merge --no-ff (preserves commits)
    epic: merge
    feature: merge
    task: squash                 # git merge --squash (single clean commit)
    bug: squash

on_complete:
  auto_commit: true
  push: false
  commit_style:
    include_bean_id: true
```

### Error handling

- **Merge conflicts**: `git merge --abort`, mark bean as `blocked`, emit `branch:merge-failed` event
- **Dirty working tree**: Check for staged/unstaged changes before branch creation; fail with clear error if dirty
- **Daemon crash mid-merge**: On startup, detect `MERGE_HEAD`/`REBASE_HEAD` state and abort before proceeding
- **Shell injection**: All git commands use `execFileSync` (no shell interpretation) with validated bean IDs

## Files affected

- `src/config/index.ts` — New top-level `BranchConfigSchema` with Zod validation
- `src/talos/scheduler.ts` — Hierarchical branch creation with ancestor chain
- `src/talos/completion-handler.ts` — Type-aware merge into parent branch + conflict handling
- `src/utils/changelog.ts` — Changelog extraction from bean body (new file)
- `scripts/ralph-loop.sh` — Branch creation/cleanup around agent runs

## Checklist

- [x] Replace `execSync` with `execFileSync` for git commands (security hardening)
- [x] Add top-level `branch` configuration schema to `src/config/index.ts`
- [x] Create hierarchical branches in scheduler (ancestor chain auto-creation)
- [x] Implement type-aware merge strategies in completion handler (merge into parent branch)
- [x] Extract changelog from bean body for squash commit messages (`src/utils/changelog.ts`)
- [x] Add merge conflict handling (`--abort` + mark blocked)
- [x] Add git state recovery on daemon startup (MERGE_HEAD detection)
- [x] Update ralph-loop.sh with branch support
- [x] Handle edge cases (dirty working tree, branch already exists, daemon crash)

## Changelog

### Implemented
- Created centralized `src/talos/git.ts` module using `execFileSync` for all git operations (shell-injection safe)
- Added `BranchConfigSchema` to `src/config/index.ts` with `enabled`, `delete_after_merge`, `default_branch`, and per-type `merge_strategy` (merge/squash)
- Created `src/talos/branch-manager.ts` with `BranchManager` class implementing:
  - Hierarchical branch creation with ancestor chain auto-creation (walks parent chain top-down)
  - Type-aware merge: `--no-ff` for features/epics/milestones, `--squash` for tasks/bugs
  - Merge into parent's branch (not directly to main)
  - Merge conflict detection and abort (handles both MERGE_HEAD and squash conflict cases)
  - Git state recovery on startup (MERGE_HEAD/REBASE_HEAD detection)
  - Dirty working tree detection before branch creation
  - Branch reuse (idempotent - existing branches are checked out, not recreated)
  - Configurable branch deletion after merge
- Created `src/utils/changelog.ts` for extracting `## Changelog` section from bean body and formatting squash commit messages
- Updated `scripts/ralph-loop.sh` with branch-per-bean support:
  - `setup_bean_branch` creates/checks out bean branch with ancestor chain
  - `merge_bean_branch` merges on completion with type-aware strategy
  - `--no-branch` flag and `TALOS_BRANCH`/`TALOS_DEFAULT_BRANCH` env vars
  - Auto-stash dirty working tree, git state recovery
- Migrated `src/talos/completion-handler.ts` and `src/talos/scheduler.ts` to use centralized git module

### Files Modified
- `src/talos/git.ts` — NEW: Centralized git operations with execFileSync
- `src/talos/git.test.ts` — NEW: 29 tests for git module
- `src/talos/branch-manager.ts` — NEW: BranchManager class with hierarchical branching
- `src/talos/branch-manager.test.ts` — NEW: 25 tests for branch manager
- `src/utils/changelog.ts` — NEW: Changelog extraction from bean body
- `src/utils/changelog.test.ts` — NEW: 12 tests for changelog extraction
- `src/config/index.ts` — Added BranchConfigSchema, MergeStrategySchema, MergeStrategyMapSchema
- `src/config/index.test.ts` — Added 7 tests for branch configuration
- `src/talos/completion-handler.ts` — Replaced local git helpers with centralized git module imports
- `src/talos/scheduler.ts` — Replaced execSync worktree creation with centralized git module
- `scripts/ralph-loop.sh` — Added branch management functions and integration

### Deviations from Spec
- Created a standalone `BranchManager` class instead of modifying the scheduler directly. The spec said "hierarchical branch creation in scheduler" but a separate class is cleaner and more testable. The scheduler can instantiate BranchManager when needed.
- The `BranchManager` is not yet wired into `Talos` orchestrator or `CompletionHandler` — it's a standalone module ready for integration. The sub-task beans (daedalus-x58b, daedalus-xf7g) handle the actual integration into scheduler and completion handler respectively.
- Squash merge conflict detection uses `git ls-files --unmerged` instead of MERGE_HEAD check, because `git merge --squash` does not create MERGE_HEAD on conflict.
- Branch safety/rollback on agent failure (daedalus-b9x8) is a separate sub-task in draft status.

### Decisions Made
- Created `src/talos/git.ts` as a centralized module rather than updating each file's git helpers individually — single source of truth for all git operations
- Used `execFileSync` throughout (not `execSync`) to prevent shell injection — arguments are passed as array, never interpolated into a shell command
- Bean ID validation uses `/^[a-zA-Z0-9_-]+$/` regex — strict but covers all beans format IDs
- `BranchManager` takes `BranchConfig` and `cwd` as constructor args for testability (no global state)
- Changelog extraction is case-insensitive for the `## Changelog` heading match
- Ralph-loop.sh auto-stashes dirty working tree before branch switch (pragmatic for agent workflows)

### Known Limitations
- `BranchManager` is not yet integrated into `Talos` orchestrator — sub-tasks daedalus-x58b and daedalus-xf7g handle this
- Parallel mode worktree creation in scheduler still uses the old pattern (creates worktree from HEAD, not from parent branch) — needs update when parallel mode is fully implemented
- No push support for bean branches (spec says `push: false` by default)
- Branch safety/rollback on agent failure is a separate draft sub-task (daedalus-b9x8)
