---
# daedalus-xfh9
title: Add branch configuration schema
status: in-progress
type: task
priority: normal
created_at: 2026-01-31T07:15:18Z
updated_at: 2026-01-31T08:21:55Z
parent: daedalus-8jow
blocking:
    - daedalus-x58b
    - daedalus-xf7g
---

## Summary

Add a new **top-level** `branch` configuration section in the Zod schema, with GitHub-style merge strategy names and type-aware defaults. This is a top-level section (not nested under `on_complete`) because branching spans the full bean lifecycle — creation in the scheduler, merge/cleanup in the completion handler.

## Target config shape

```yaml
branch:
  enabled: true
  delete_after_merge: true
  default_branch: main
  merge_strategy:
    milestone: merge
    epic: merge
    feature: merge
    task: squash
    bug: squash
```

## GitHub-style merge strategy mapping

| Config value | GitHub name | Git command | Use case |
|---|---|---|---|
| `merge` | Create a merge commit | `git merge --no-ff` | feature/epic/milestone — preserves branch history |
| `squash` | Squash and merge | `git merge --squash` + commit | task/bug — single clean commit |

Note: `rebase` strategy is deferred to a future version to reduce v1 complexity.

## Implementation

In `src/config/index.ts`:

1. Add a `MergeStrategy` enum schema with GitHub-style names:
   ```typescript
   const MergeStrategySchema = z.enum(["merge", "squash"]);
   ```

2. Add a `MergeStrategyByTypeSchema` with per-bean-type defaults:
   ```typescript
   const MergeStrategyByTypeSchema = z.object({
     milestone: MergeStrategySchema.default("merge"),
     epic: MergeStrategySchema.default("merge"),
     feature: MergeStrategySchema.default("merge"),
     task: MergeStrategySchema.default("squash"),
     bug: MergeStrategySchema.default("squash"),
   });
   ```

3. Add a `BranchConfigSchema`:
   ```typescript
   const BranchConfigSchema = z.object({
     enabled: z.boolean().default(true),
     delete_after_merge: z.boolean().default(true),
     default_branch: z.string().default("main"),
     merge_strategy: MergeStrategyByTypeSchema.default({}),
   });
   ```

4. Add `branch` as a **top-level** field in `TalosConfigSchema`:
   ```typescript
   const TalosConfigSchema = z.object({
     agent: AgentConfigSchema.default({}),
     scheduler: SchedulerConfigSchema.default({}),
     branch: BranchConfigSchema.default({}),    // NEW — top-level
     on_complete: OnCompleteConfigSchema.default({}),
     // ... rest unchanged
   });
   ```

5. Export the new types:
   ```typescript
   export type MergeStrategy = z.infer<typeof MergeStrategySchema>;
   export type MergeStrategyByType = z.infer<typeof MergeStrategyByTypeSchema>;
   export type BranchConfig = z.infer<typeof BranchConfigSchema>;
   ```

6. Add a helper function to get merge strategy for a bean type:
   ```typescript
   export function getMergeStrategy(
     beanType: BeanType,
     config: BranchConfig
   ): MergeStrategy {
     return config.merge_strategy[beanType] ?? "squash";
   }
   ```

7. Add a helper to resolve the merge target branch for a bean:
   ```typescript
   /**
    * Get the branch a bean should merge into on completion.
    * If the bean has a parent, merge into the parent's branch.
    * Otherwise, merge into the configured default branch.
    */
   export function getMergeTarget(
     parentId: string | null,
     config: BranchConfig
   ): string {
     return parentId ? `bean/${parentId}` : config.default_branch;
   }
   ```

## Files to modify

- `src/config/index.ts` — Schema definition, types, helper functions

## Testing

**Unit tests: YES.** This is pure Zod schema + pure helper functions — highly testable with no I/O. Follow the existing pattern in `src/config/index.test.ts` which tests schema defaults, validation, and error cases using `TalosConfigSchema.safeParse()` and `getDefaultConfig()`.

Test file: `src/config/index.test.ts` (extend existing file)

Tests to add:
- Schema defaults: `getDefaultConfig().branch.enabled === true`, `branch.delete_after_merge === true`, `branch.default_branch === "main"`
- Per-type strategy defaults: `branch.merge_strategy.task === "squash"`, `branch.merge_strategy.feature === "merge"`
- Invalid strategy rejected: `safeParse({ branch: { merge_strategy: { task: "invalid" } } })` fails
- `getMergeStrategy()`: returns correct strategy per bean type, falls back to `"squash"` for unknown types
- `getMergeTarget()`: returns `bean/{parentId}` when parent exists, returns `default_branch` when no parent

## Checklist

- [x] Add `MergeStrategySchema` enum (`merge`, `squash`)
- [x] Add `MergeStrategyByTypeSchema` with per-type defaults (merge for feature/epic/milestone, squash for task/bug)
- [x] Add `BranchConfigSchema` (`enabled`, `delete_after_merge`, `default_branch`, `merge_strategy`)
- [x] Add `branch` as top-level field in `TalosConfigSchema`
- [x] Export new types (`MergeStrategy`, `MergeStrategyByType`, `BranchConfig`)
- [x] Add `getMergeStrategy()` helper function
- [x] Add `getMergeTarget()` helper function
- [x] Add tests for schema defaults in `src/config/index.test.ts`
- [x] Add tests for `getMergeStrategy()` helper
- [x] Add tests for `getMergeTarget()` helper

## Changelog

### Implemented
- Added `MergeStrategySchema` (`merge` | `squash`) Zod enum
- Added `MergeStrategyMapSchema` with per-bean-type defaults (merge for feature/epic/milestone, squash for task/bug)
- Added `BranchConfigSchema` with `enabled`, `delete_after_merge`, `default_branch`, `merge_strategy` fields
- Added `branch` as top-level field in `TalosConfigSchema`
- Exported `MergeStrategy`, `MergeStrategyMap`, `MergeStrategyByType`, and `BranchConfig` types
- Added standalone `getMergeStrategy(beanType, config)` helper function
- Added standalone `getMergeTarget(parentId, config)` helper function
- Added 9 tests for schema defaults, helper functions, and custom overrides
- Added 7 tests for branch config schema validation (defaults, enums, YAML loading)

### Files Modified
- `src/config/index.ts` — Added schemas, types, and helper functions
- `src/config/index.test.ts` — Added test suites for branch config, getMergeStrategy, getMergeTarget

### Deviations from Spec
- Schema named `MergeStrategyMapSchema` instead of `MergeStrategyByTypeSchema` (prior commit used `Map` naming; added `MergeStrategyByType` as a type alias for compatibility)
- Schema and branch config tests were already added in a prior commit (`6d82737`); this iteration added the missing helper functions and their tests

### Decisions Made
- Added `MergeStrategyByType` as a type alias for `MergeStrategyMap` rather than renaming, to avoid breaking existing consumers (BranchManager)
- Helper functions are pure functions taking `BranchConfig` as parameter (not methods on a class) for maximum reusability

### Known Limitations
- `getMergeStrategy` fallback to `'squash'` for unknown types is defensive but currently unreachable since `BeanType` is a union of known types
