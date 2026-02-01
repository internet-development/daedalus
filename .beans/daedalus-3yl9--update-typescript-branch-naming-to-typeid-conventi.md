---
# daedalus-3yl9
title: Update TypeScript branch naming to {type}/{id} convention
status: draft
type: task
created_at: 2026-02-01T00:11:30Z
updated_at: 2026-02-01T00:11:30Z
---

The ralph-loop.sh script now uses {type}/{id} branch names (e.g. feature/daedalus-px9m) instead of bean/{id}. The TypeScript codebase still uses the old bean/{id} format in:

- src/talos/scheduler.ts
- src/talos/branch-manager.ts
- src/talos/git.ts (gitSafe validation)
- src/config/index.ts (getMergeTarget)
- All associated test files

Update these to match the new convention. The bean_branch() function needs the bean type to construct the branch name, so BranchManager.getBranchName() will need a type parameter (or a beans client lookup).