---
# daedalus-jmgm
title: Test branch-per-bean flow
status: todo
type: milestone
created_at: 2026-01-31T08:54:35Z
updated_at: 2026-01-31T08:54:35Z
---

## Summary

Throwaway milestone to validate the branch-per-bean feature end-to-end. Delete after verification.

## Expected git behavior

After all children complete and this milestone is reviewed:

1. `git log --graph --oneline` shows the full merge hierarchy
2. No `bean/*` branches remain (all deleted after merge)
3. Merge strategies were applied correctly:
   - milestone/epic/feature: merge commits (`--no-ff`)
   - task/bug: squash commits

## Verification

```bash
# Check no bean branches remain
git branch | grep bean/

# Check merge graph
git log --graph --oneline -20

# Check squash commits have changelog
git log --oneline --grep="Bean: daedalus-"
```

## Checklist

- [ ] All children completed and merged correctly
- [ ] No orphaned bean branches
- [ ] Squash commits contain changelog
- [ ] Merge commits preserve history
