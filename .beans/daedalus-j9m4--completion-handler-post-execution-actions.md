---
# daedalus-j9m4
title: 'Completion Handler: Post-execution actions'
status: todo
type: feature
priority: high
created_at: 2026-01-26T05:39:36Z
updated_at: 2026-01-26T08:54:39Z
parent: daedalus-ss8m
blocking:
    - daedalus-4h5x
---

Handle post-execution tasks: auto-commit changes, update bean status, create blocker beans.

## Interface
```typescript
class CompletionHandler {
  constructor(config: TalosConfig);
  
  // Handle completion based on exit code and bean state
  handleCompletion(
    bean: Bean,
    exitCode: number,
    outputPath: string,  // Path to .talos/output/{bean-id}.log
    worktreePath?: string    // Worktree path if parallel mode
  ): Promise<CompletionResult>;
}

interface CompletionResult {
  outcome: 'completed' | 'blocked' | 'failed';  // What happened (not bean status!)
  commitSha?: string;       // If changes were committed
  blockerBeanId?: string;   // If blocker bean was created
  error?: string;           // If failed, the error message
}
```

## Decisions Made

- **Crash handling**: Add `failed` tag + create error bean with crash details (NOT status change - beans has no 'blocked' status)
- **Git staging**: Agent stages its own changes during execution (cleaner control)
- **Git isolation**: Use worktrees for parallel execution, main branch for sequential (max_parallel=1)
- **Tags for stuck state**: Use `blocked` tag (agent hit issue) or `failed` tag (crash) since beans tracker has no blocked status
- **Blocked detection**: Fresh `getBean()` call after agent exits to check current tags (agent may have added 'blocked' tag)
- **Scope resolution**: Use `getEpicAncestor()` to find epic for commit scope, omit scope if no epic found

## On Successful Completion (exit code 0)

### Sequential mode (max_parallel = 1)
1. Update bean status to 'completed'
2. Commit staged changes with conventional commit message
3. Optionally push (if configured)

### Parallel mode (max_parallel > 1, using worktrees)
1. Update bean status to 'completed'
2. Commit in worktree with conventional commit message
3. Merge worktree branch to main (fast-forward if possible)
4. Delete worktree and branch
5. Optionally push (if configured)

## On Blocked (agent added 'blocked' tag)
Detection: After agent exits with code 0, call `getBean(id)` to check if `blocked` tag is present.

1. Tag already added by agent: `beans update {id} --tag blocked`
2. Check if blocker bean was created by agent
3. If no blocker bean, create generic one:
   ```
   beans create "Blocker: {bean.title}" -t bug --blocking {bean.id} \
     -d "Agent reported being blocked. Check agent output for details."
   ```
4. Notify UI of blocked state (emit 'bean-blocked' event)
5. If using worktree: keep worktree for inspection, don't delete

## On Failure (non-zero exit, crash)
1. Add `failed` tag: `beans update {id} --tag failed`
2. Create error bean with crash details:
   ```
   beans create "Crash: {bean.title}" -t bug --blocking {bean.id} \
     -d "Agent crashed with exit code {code}.\n\nLast output:\n{last_stderr}"
   ```
3. Notify UI of failure (emit 'bean-failed' event)
4. If using worktree: keep for debugging

Note: Bean status stays `in-progress` while blocked/failed. The tag indicates the stuck state.

## Commit Message Format
```
{type}({scope}): {bean.title}

{bean.description first paragraph}

Bean: {bean.id}
```

Where:
- type: feature→feat, bug→fix, task→chore
- scope: parent epic's slug (if exists)

## Checklist
- [ ] Detect completion type (success, blocked tag, failed/crashed)
- [ ] Implement commit for sequential mode (main branch)
- [ ] Implement commit + merge for parallel mode (worktrees)
- [ ] Format commit message using conventional commits
- [ ] Extract type from bean.type, scope via getEpicAncestor()
- [ ] Handle blocked tag detection (agent added 'blocked' tag)
- [ ] Add 'failed' tag on crash/error
- [ ] Create blocker bean if agent didn't (for blocked or crashed)
- [ ] Handle crash/error cases - create descriptive error bean
- [ ] Emit completion events for UI (bean-blocked, bean-failed, bean-completed)
- [ ] Support dry-run mode (no actual commits)
- [ ] Respect git hooks (don't skip verify)