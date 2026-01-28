---
# daedalus-sb04
title: Recently completed beans not shown on monitor startup
status: completed
type: bug
priority: normal
tags:
    - failed
created_at: 2026-01-27T08:53:14Z
updated_at: 2026-01-28T01:31:37Z
---

## Problem

The "Recently Completed" section in the Monitor view shows no beans when Daedalus starts, even if beans were completed in previous sessions. The list only populates when beans complete during the current session.

## Root Cause

In `src/talos/talos.ts:94`, the `recentlyCompleted` array is initialized as empty:
```typescript
private recentlyCompleted: Bean[] = [];
```

It's only populated via the `bean-completed` event during the session (line 576), not from persisted data at startup.

Compare with `getStuck()` (lines 232-243) which dynamically queries the watcher's bean cache - it always reflects current state.

## Expected Behavior

When the Monitor view opens, the "Recently Completed" section should show up to 5 of the most recently completed beans from the beans database, sorted by `updatedAt` descending.

## Checklist

- [x] Query completed beans at startup in Talos constructor or `start()` method
  - Filter: `status: ['completed']`
  - Sort by: `updatedAt` descending  
  - Limit: 5 beans
- [x] Initialize `recentlyCompleted` with query results
- [x] Consider using `listBeans()` from beans-client with appropriate filters
- [x] Test: Start Daedalus with completed beans → verify they appear in Monitor
