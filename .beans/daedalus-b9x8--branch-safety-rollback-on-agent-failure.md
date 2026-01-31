---
# daedalus-b9x8
title: 'Branch safety: rollback on agent failure'
status: draft
type: task
created_at: 2026-01-31T07:16:58Z
updated_at: 2026-01-31T07:16:58Z
parent: daedalus-8jow
---

## Summary

Future enhancement: when an agent fails on a bean branch, provide options for rollback/cleanup rather than just leaving the branch as-is.

Potential features:
- `git reset --hard` the bean branch to its starting point on repeated failures
- Auto-cleanup stale bean branches older than N days
- Option to discard branch changes and retry from clean state
- Integration with the `failed` tag to track branch state

This is a **draft** for future consideration — not blocking the initial branch-per-bean implementation.

## Checklist

- [ ] Design rollback strategy for failed agent runs
- [ ] Implement stale branch cleanup
- [ ] Add configuration options for failure behavior
