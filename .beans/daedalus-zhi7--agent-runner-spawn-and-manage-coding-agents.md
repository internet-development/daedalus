---
# daedalus-zhi7
title: 'Agent Runner: Spawn and manage coding agents'
status: todo
type: feature
priority: critical
created_at: 2026-01-26T05:39:25Z
updated_at: 2026-01-26T08:54:39Z
parent: daedalus-ss8m
blocking:
    - daedalus-4h5x
---

Spawn coding agents (opencode, claude, codex) with bean context and manage their lifecycle.

## Decisions Made

- **Prompt content**: Include full bean body (title, description, checklist, notes)
- **Output capture**: Emit stdout/stderr separately with timestamps - UI can display interleaved or split
- **Timeout**: No timeout - let agent run until completion (some tasks take hours)
- **Working directory**: Configurable per-run. Defaults to project root, but scheduler passes worktree path for parallel execution.

## Supported Backends
1. **opencode**: `opencode run "<prompt>"`
2. **claude**: `claude -p "<prompt>" --dangerously-skip-permissions`
3. **codex**: `codex "<prompt>"`

## Prompt Generation
```
Implement the following task:

## {bean.id}: {bean.title}

{bean.body}

---

Instructions:
1. Read and understand the task above
2. Implement each checklist item in order  
3. Update the bean's checklist as you complete items:
   `beans update {bean.id} --body "..."`
4. If you encounter a blocker you cannot resolve:
   - Add the blocked tag: `beans update {bean.id} --tag blocked`
   - Create a blocker bean: `beans create "Blocker: ..." -t bug --blocking {bean.id} -d "Description of why blocked"`
   - Exit cleanly with code 0
5. When complete, exit with code 0
```

Note: We use `--tag blocked` instead of `--status blocked` because beans tracker doesn't have a blocked status.

## Interface
```typescript
class AgentRunner extends EventEmitter {
  constructor(config: AgentConfig);
  
  // Execution
  run(bean: Bean, worktreePath?: string): void;  // worktreePath for parallel mode
  cancel(): Promise<void>;                   // SIGTERM, then SIGKILL after grace period
  
  // State
  isRunning(): boolean;
  getRunningBean(): Bean | null;
  getStartedAt(): number | null;            // timestamp
  
  // Events
  on(event: 'started', cb: (bean: Bean) => void): this;
  on(event: 'output', cb: (data: OutputEvent) => void): this;
  on(event: 'exit', cb: (result: ExitResult) => void): this;
  on(event: 'error', cb: (error: Error) => void): this;
}

interface AgentConfig {
  backend: 'opencode' | 'claude' | 'codex';
  opencode?: { model: string };
  claude?: { model: string; dangerously_skip_permissions: boolean };
  codex?: { model: string };
}

type OutputEvent = {
  beanId: string;           // included so Orchestrator doesn't need to wrap
  stream: 'stdout' | 'stderr';
  data: string;
  timestamp: number;        // Date.now() for ordering
};

type ExitResult = {
  code: number;
  signal?: string;
  duration: number;   // ms
};
```

UI can use OutputEvent to:
- Interleaved view: sort by timestamp, display all
- Split view: filter by stream, show in separate panes

## Checklist
- [ ] Create AgentRunner class with configurable backend
- [ ] Implement prompt generation from bean (full body)
- [ ] Spawn process with proper stdio handling
- [ ] Stream stdout/stderr separately with timestamps via EventEmitter
- [ ] Detect process exit and exit code
- [ ] Support cancellation (SIGTERM → SIGKILL after grace period)
- [ ] Track running time (startedAt timestamp)
- [ ] Handle backend-specific CLI arguments
- [ ] Accept worktreePath parameter (default: project root, worktree path for parallel)
- [ ] No timeout - let agents run to completion

## Events
- `started`: (bean: Bean) - emitted when agent process spawns successfully
- `output`: { beanId, stream: 'stdout' | 'stderr', data, timestamp }
- `exit`: { code: number, signal?: string, duration: number }
- `error`: (error: Error) - spawn failure or unexpected error