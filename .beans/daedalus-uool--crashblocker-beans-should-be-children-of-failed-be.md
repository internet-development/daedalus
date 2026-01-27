---
# daedalus-uool
title: Crash beans should be children of Errors epic
status: completed
type: bug
priority: normal
created_at: 2026-01-27T00:09:12Z
updated_at: 2026-01-27T01:26:06Z
parent: daedalus-kfjn
---

## Problem

Crash/blocker beans are created with `blocking` relationship but float independently in the bean list. Hard to see all failures at a glance.

## Solution

Create a dedicated "Errors" epic bean that parents all crash/blocker beans:

```
Errors (epic)
├── Crash: Fix login bug (bug)
├── Crash: Add feature (bug)  
└── Blocked: Deploy script (bug)
```

This works within current type hierarchy (epic → bug is allowed).

Each crash bean still has `blocking` relationship to original bean for dependency tracking.

## Affected Files

- `src/talos/talos.ts` - startup: find or create Errors epic
- `src/talos/talos.ts` - cancel() (if it still creates beans - check m31s)
- `src/talos/completion-handler.ts` - handleBlocked(), handleFailure()
- `src/talos/talos.ts` - detectOrphanedBeans()

## Checklist

### Setup
- [x] Add `errorsEpicId: string | null` to Talos class state
- [x] On `start()`, find existing Errors epic or create one:
  ```typescript
  const existing = await listBeans({ type: ['epic'], search: 'Errors' });
  if (existing.find(b => b.title === 'Errors')) {
    this.errorsEpicId = existing[0].id;
  } else {
    const errorsBean = await createBean({
      title: 'Errors',
      type: 'epic',
      status: 'todo',
      body: 'Container for crash and blocker beans created by Talos.',
    });
    this.errorsEpicId = errorsBean.id;
  }
  ```

### Update crash bean creation
- [x] Pass errorsEpicId to CompletionHandler (via constructor or method param)
- [x] In `handleFailure()`, add `parent: errorsEpicId` when creating Crash bean
- [x] In `handleBlocked()`, add `parent: errorsEpicId` when creating blocker bean
- [x] In `detectOrphanedBeans()`, add `parent: errorsEpicId` when creating Crash bean

### Verification
- [x] Errors epic is created on first run
- [x] Errors epic is reused on subsequent runs
- [x] Crash beans appear as children of Errors epic in tree view
- [x] Blocking relationship still works (original bean shows as blocked)
