---
# daedalus-wb3l
title: Epic/milestone review mode for execution agent
status: todo
type: feature
priority: high
created_at: 2026-01-27T00:43:16Z
updated_at: 2026-01-27T00:53:03Z
parent: daedalus-ss8m
---

## Problem

The execution agent loop doesn't distinguish bean types. Epics/milestones shouldn't be "worked on" directly - they should validate their children's work.

## Solution

### 1. Blocking: Children block parent

When epic/milestone is created or enqueued:
- Find all children
- Add blocking relationships: each child blocks the parent
- Epic can only be picked up when all children complete (unblocked)

This is standard beans behavior - just need to set up the relationships.

### 2. Review Mode: Validate children's work

When epic/milestone is picked up (all children complete), run agent in **review mode**:

Think like a **senior engineer or engineering manager** reviewing work before merging:

1. Read all child beans to understand what was supposed to be implemented
2. Read the actual implementation code (files mentioned in child beans)
3. Sanity check: does the code make sense? Any obvious bugs? Follows project patterns?
4. Run test suite and verify tests pass
5. Check integration between components

**If review passes:** Mark epic complete

**If review finds issues:** 
- Create bug beans as children of the epic
- Revert epic to 'todo'
- New incomplete children → epic naturally waits
- Bugs get fixed → epic re-reviewed automatically

### 3. No children edge case

If epic has no children, let agent decide:
- Create child beans for the work needed
- Or flag as issue (epic shouldn't be empty)

## Behavior by Type

| Type | Scheduling | Execution |
|------|------------|-----------|
| task/bug/feature | Normal | Implement/fix |
| epic/milestone | Blocked by children | Review mode |

## Affected Files

- `src/talos/talos.ts` - Set up child→parent blocking on enqueue
- `src/talos/agent-runner.ts` - Review mode prompt generation
- `src/talos/scheduler.ts` - No changes needed (blocking already works)

## Checklist

### Blocking setup (talos.ts)
- [ ] In `wireWatcherEvents` or `enqueue`, detect epic/milestone
- [ ] Query children: `bean.children`
- [ ] For each incomplete child, add blocking: child blocks parent
- [ ] Use beans CLI: `beans update <child-id> --blocking <parent-id>`

### Review mode prompt (agent-runner.ts)
- [ ] Add `isReviewMode(bean)` - true for epic/milestone
- [ ] Add `generateReviewPrompt(bean)` with:
  ```
  You are a senior engineer reviewing work before it ships.
  
  ## Epic: {bean.id}: {bean.title}
  
  {bean.body}
  
  ### Completed children to review:
  {for each child}
  - {child.id}: {child.title}
    {child.body}
  {end for}
  
  ### Your review process:
  1. Read each child bean to understand what should have been implemented
  2. Read the actual code files mentioned in each child bean
  3. Sanity check the implementations:
     - Does the code make sense?
     - Any obvious bugs or issues?
     - Does it follow project patterns and conventions?
     - Is error handling appropriate?
  4. Run the test suite: npm test
  5. Verify integration between components works correctly
  
  ### Outcome:
  - If everything looks good: exit 0 (epic will be marked complete)
  - If issues found: 
    - Create bug beans as children describing each issue:
      beans create "Issue: ..." -t bug --parent {bean.id} -d "Description..."
    - Exit 0 (epic will wait for bugs to be fixed, then re-review)
  ```

### Prompt enhancements
- [ ] Include file paths extracted from child beans
- [ ] Include git diff or recent commits for context
- [ ] Specify test commands from config or child beans
- [ ] Include project conventions/patterns for reference

### Verification
- [ ] Epic with incomplete children stays blocked
- [ ] Epic becomes unblocked when all children complete
- [ ] Review mode reads child beans AND actual code
- [ ] Review includes sanity checks
- [ ] Passing review marks epic complete
- [ ] Failing review creates child bugs, epic waits, re-reviews after fix