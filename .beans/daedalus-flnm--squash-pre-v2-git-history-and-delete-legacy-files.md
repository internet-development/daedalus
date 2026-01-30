---
# daedalus-flnm
title: Squash pre-v2 git history and delete legacy files
status: completed
type: task
priority: critical
created_at: 2026-01-30T02:22:58Z
updated_at: 2026-01-30T02:26:21Z
parent: daedalus-u7dj
blocking:
    - daedalus-mjez
---

## Context

The git history contains 50+ commits from the old Next.js/sh-agent v1 codebase. These are irrelevant to the public release and include references to old architecture. Squash them into a single initial commit.

Additionally, `docs/reference/legacy-utilities.ts` is a leftover v1 file marked "DO NOT IMPORT" that should be deleted.

## Approach

### 1. Delete legacy file
Delete `docs/reference/legacy-utilities.ts` — it's a v1 leftover with DOM utilities that don't apply to the terminal app.

### 2. Squash pre-v2 commits
The commit history looks like:
```
6dc8877  Initial commit (v1 - Next.js)
  ... 50+ old v1 commits
6e1d653  chore: remove old Daedalus code  
4ae1199  feat: scaffold Daedalus v2 project structure
  ... 150+ v2 commits (keep these)
06931af  HEAD
```

Use `git rebase` to squash everything from `6dc8877` through `4ae1199` into a single commit:
```
<new>    feat: scaffold Daedalus v2 project structure
  ... 150+ v2 commits (unchanged)
HEAD
```

**Method:** `git rebase --onto <new-root> 4ae1199` won't work cleanly. Better approach:

1. Create an orphan branch from `4ae1199`:
   ```bash
   git checkout --orphan clean-start 4ae1199
   git commit -m 'feat: scaffold Daedalus v2 project structure'
   ```
2. Rebase the rest of the history onto it:
   ```bash
   git rebase --onto clean-start 4ae1199 caidanw/daedalus-v3
   ```
3. Force push (since history is rewritten)

**WARNING:** This rewrites history. Must be done before tagging v0.1.0. Coordinate with anyone else who has the repo cloned.

## Checklist
- [ ] Delete docs/reference/legacy-utilities.ts
- [ ] Verify no other files reference legacy-utilities.ts
- [ ] Create orphan branch from v2 scaffold commit
- [ ] Rebase v2 commits onto clean root
- [ ] Verify all v2 commits are intact
- [ ] Verify build still works after rebase
- [ ] Force push cleaned history