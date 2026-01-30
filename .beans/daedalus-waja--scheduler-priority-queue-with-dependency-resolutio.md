---
# daedalus-waja
title: 'Scheduler: Priority queue with dependency resolution'
status: todo
type: feature
priority: critical
created_at: 2026-01-26T05:39:13Z
updated_at: 2026-01-26T08:54:39Z
parent: daedalus-ss8m
blocking:
    - daedalus-4h5x
---

Priority-based scheduler that manages the execution queue, respecting bean dependencies (blockedBy relationships) and configurable concurrency.

## Decisions Made

- **Git isolation**: Sequential mode (max_parallel=1) works on main branch. Parallel mode (max_parallel>1) uses git worktrees for isolation.
- **Worktree lifecycle**: Scheduler creates worktree before execution, completion handler cleans up after.

## Core Logic
1. When a bean moves to 'todo', add to queue
2. Sort queue by: priority → created date
3. Before executing, check if any blockedBy beans are incomplete (status != 'completed')
4. Skip beans that have 'blocked' or 'failed' tags (they're stuck, need retry)
5. Respect maxParallel configuration
6. When execution slot opens, pick next eligible bean
7. **If max_parallel > 1**: Create git worktree for the bean before starting execution

## Git Worktree Management (parallel mode only)
```bash
# Before execution (scheduler does this):
git worktree add .worktrees/{bean-id} -b bean/{bean-id}

# Agent runs in .worktrees/{bean-id}/

# After completion (completion handler does this):
# If success: commit, merge to main, delete worktree
# If blocked/failed: keep worktree for debugging
```

## Interface
```typescript
class Scheduler extends EventEmitter {
  constructor(config: SchedulerConfig);
  
  // Queue management
  enqueue(bean: Bean): void;
  dequeue(beanId: string): void;
  getQueue(): Bean[];
  
  // Execution
  getNextEligible(): Bean | null;
  markInProgress(beanId: string): void;
  markComplete(beanId: string): void;
  markStuck(beanId: string): void;  // bean got 'blocked' or 'failed' tag
  
  // Worktree management (parallel mode)
  getWorktreePath(beanId: string): string | null;  // null if sequential mode
  
  // Configuration
  setMaxParallel(n: number): void;
  
  // Events
  on(event: 'bean-ready', cb: (bean: Bean, worktreePath?: string) => void): this;
}

interface SchedulerConfig {
  maxParallel: number;      // default: 1
  pollInterval: number;     // ms, default: 1000
}
```

## Checklist
- [ ] Create priority queue data structure
- [ ] Implement priority comparison (priority level → createdAt)
- [ ] Build dependency graph from blockedBy relationships
- [ ] Check if bean is blocked before allowing execution
- [ ] Track in-progress beans for concurrency control
- [ ] Emit 'bean-ready' when slot opens and bean is eligible
- [ ] Handle bean status changes (re-sort queue)
- [ ] Support configurable maxParallel (default: 1)
- [ ] Implement worktree creation for parallel mode (max_parallel > 1)
- [ ] Pass worktree path to runner when in parallel mode

## Priority Order
1. critical
2. high
3. normal (default)
4. low
5. deferred