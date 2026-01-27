---
# daedalus-53p0
title: AgentRunner spawn errors don't trigger completion cleanup
status: todo
type: bug
priority: high
created_at: 2026-01-27T00:09:12Z
updated_at: 2026-01-27T00:36:37Z
parent: daedalus-kfjn
---

## Problem

When agent subprocess fails to start (e.g., command not found), the system gets stuck:
- Bean stays in `inProgress` forever
- No 'exit' event fires
- Completion handler never runs
- No cleanup, no crash bean

## Root Cause

The runner 'error' handler in Talos just forwards without cleanup:

```typescript
this.runner.on('error', (error: Error) => {
  this.emit('error', error);  // ← no cleanup!
});
```

## Solution

Handle 'error' event properly - treat spawn failure as a crash. Clean up state and call completion handler.

## Affected Files

- `src/talos/talos.ts:509-511` - wireRunnerEvents error handler

## Checklist

- [ ] Update runner 'error' handler in `wireRunnerEvents()`:
  ```typescript
  this.runner.on('error', async (error: Error) => {
    const runningBean = this.findRunningBean();
    if (runningBean) {
      const { bean, worktreePath } = runningBean;
      
      // Write error to output file so crash bean has context
      this.appendOutput(bean.id, `Spawn error: ${error.message}`);
      
      // Clean up in-progress state
      this.inProgress.delete(bean.id);
      
      // Handle as crash
      const completionResult = await this.completionHandler.handleCompletion(
        bean,
        -1,
        this.getOutputPath(bean.id),
        worktreePath
      );
      
      this.handleCompletionResult(bean, completionResult);
    }
    
    this.emit('error', error);
  });
  ```
- [ ] Verify crash bean is created with spawn error details
- [ ] Verify bean is removed from inProgress
- [ ] Test with non-existent command (e.g., set backend to 'nonexistent')