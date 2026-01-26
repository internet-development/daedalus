---
# daedalus-4h5x
title: 'Talos Orchestrator: Main daemon class'
status: completed
type: feature
priority: high
created_at: 2026-01-26T05:39:46Z
updated_at: 2026-01-26T09:49:15Z
parent: daedalus-ss8m
blocking:
    - daedalus-3eaw
---

Main Talos class that ties together all components: watcher, scheduler, runner, completion handler.

## Responsibilities
- Initialize all components on startup
- Wire up event handlers between components
- Load configuration from talos.yml
- Provide unified API for TUI
- Handle graceful shutdown

## Interface
```typescript
class Talos extends EventEmitter {
  constructor(configPath?: string);  // searches upward for talos.yml if not specified
  
  // Lifecycle
  start(): Promise<void>;
  stop(): Promise<void>;
  
  // State
  getQueue(): Bean[];
  getInProgress(): Map<string, RunningBean>;
  getStuck(): Bean[];               // Beans with 'blocked' or 'failed' tags
  getRecentlyCompleted(): Bean[];   // Last 5 completed beans for Monitor View
  getOutput(beanId: string): string | null;  // Get persisted output for a bean
  isPaused(): boolean;
  
  // Control
  pause(): void;
  resume(): void;
  cancel(beanId: string): Promise<void>;
  retry(beanId: string): Promise<void>;
  
  // Events
  on(event: 'bean-started', cb: (bean: Bean) => void): this;
  on(event: 'bean-completed', cb: (bean: Bean) => void): this;
  on(event: 'bean-blocked', cb: (bean: Bean, blocker?: Bean) => void): this;  // Agent intentionally blocked
  on(event: 'bean-failed', cb: (bean: Bean, error: Error) => void): this;     // Crash/error (adds 'failed' tag)
  on(event: 'output', cb: (data: OutputEvent) => void): this;  // OutputEvent includes beanId
  on(event: 'queue-changed', cb: (queue: Bean[]) => void): this;
}

// Bean currently being executed
interface RunningBean {
  bean: Bean;
  startedAt: number;        // timestamp
  worktreePath?: string;    // set if running in parallel mode
}
```

## Decisions

**Retry behavior**: 
1. Remove `blocked` or `failed` tag (but keep blocker bean for history)
2. If worktree exists with uncommitted changes, prompt user: discard or reuse?
3. Re-enqueue at front of queue for immediate execution

**State persistence**: Rebuild from beans on startup. Bean files are the source of truth - scan all beans and rebuild queue from their current statuses. No separate state file.

**Auto-enqueue on startup**: Configurable via `scheduler.auto_enqueue_on_startup` (default: true). If enabled, beans in `todo` status are automatically added to queue on startup, resuming work after restart.

**Crash recovery**: On startup, detect any beans with `in-progress` status but no running agent (orphaned from a crash). Add `failed` tag and create a blocker bean. This requires manual review rather than auto-retrying potentially broken work.

**Event distinction**: `bean-blocked` = agent intentionally blocked (added 'blocked' tag). `bean-failed` = crash/error (we add 'failed' tag). Both result in the bean staying `in-progress` with a tag, but different events let the UI show different messages.

**Tags not status**: The beans tracker has no 'blocked' status, so we use tags ('blocked', 'failed') to indicate stuck beans while keeping them in `in-progress` status.

**Recently completed limit**: Keep last 5 completed beans in memory for quick access.

**Output persistence**: Persist agent output to `.talos/output/{bean-id}.log`. This allows viewing output from previous runs and survives restarts.

## Checklist
- [x] Create Talos class skeleton
- [x] Load and validate talos.yml configuration
- [x] Initialize Watcher, Scheduler, Runner, CompletionHandler
- [x] Wire watcher events to scheduler
- [x] Wire scheduler 'bean-ready' to runner
- [x] Wire runner completion to completion handler
- [x] Implement pause/resume (pause scheduler)
- [x] Implement cancel (kill running agent)
- [x] Implement retry (remove tag, prompt for worktree handling, re-enqueue)
- [x] Handle graceful shutdown (stop watcher, wait for agent)
- [x] Emit unified events for UI consumption
- [x] On startup, detect orphaned in-progress beans and add 'failed' tag + create blocker
- [x] Track last 5 completed beans for getRecentlyCompleted()
- [x] Persist output to .talos/output/{bean-id}.log
- [x] Implement getOutput() to read persisted output
