---
# daedalus-wzjj
title: Ralph Loop Bootstrap Script
status: completed
type: task
priority: critical
created_at: 2026-01-26T08:38:43Z
updated_at: 2026-01-26T08:52:34Z
parent: daedalus-ss8m
blocking:
    - daedalus-ap8h
---

Create a ralph-loop.sh script to bootstrap Talos development. This is a mini scheduler that picks the highest priority unblocked bean and runs an agent on it until completion.

## Purpose

Before Talos exists, we need a way to run coding agents on beans autonomously. This script implements the Ralph Wiggum pattern with automatic work selection: it finds the next actionable bean, runs an agent on it, and repeats.

## How It Works

1. Query all beans to find the next actionable one (todo status, unblocked, highest priority)
2. If no actionable beans, exit (nothing to do)
3. Mark the selected bean as `in-progress`
4. Fetch the bean's full tree (including children for context)
5. Run opencode (or configured agent) with the prompt
6. After agent exits, check bean status
7. If not completed, fallback WIP commit if needed, loop back to step 4
8. If completed (or blocked/failed), loop back to step 1 to pick next bean
9. Stop when no more actionable beans or max total iterations reached

## Work Selection

Find the next actionable bean using this query:

```graphql
{
  beans(filter: {
    status: ["todo"],
    excludeType: ["milestone", "epic"],  # Only actionable types
    isBlocked: false                      # No incomplete blockers
  }) {
    id title type priority status
    blockedBy { id status }
  }
}
```

Then sort by priority (critical > high > normal > low > deferred) and pick the first one.

If a bean ID is passed as argument, work on that specific bean instead (skip selection).

## Bean Context Resolution

Once a bean is selected, fetch its full context:
- The bean itself with full body
- Its parent chain (for understanding scope)
- Its children if any (for epics being worked on directly)

Query:
```graphql
{
  bean(id: "{id}") {
    id title status type body
    parent { id title type body }
    children { id title status type body }
  }
}
```

## Prompt Template

The script generates a prompt for the agent:

```
You are an autonomous coding agent in a ralph loop. You will be re-prompted 
with this same task until you mark it complete. Your previous work is visible
in the codebase and git history.

{if has parent}
## Context: {parent.title}
{parent.body summary or first paragraph}
{end if}

## Current Task: {bean.id}
### {bean.title}

{bean.body}

{if has children}
### Sub-tasks
{for each child}
- [{child.status}] {child.id}: {child.title}
{end for}
{end if}

---

## Your Mission

1. Implement the checklist items in the task above
2. As you complete items, update the bean:
   `beans update {bean.id} --body "..."` (change [ ] to [x])
3. Commit your work with conventional commits:
   - Type: feature→feat, bug→fix, task→chore
   - Include "Bean: {bean.id}" in the commit body
4. When ALL items are done: `beans update {bean.id} --status completed`

## If You Get Stuck

If you hit a blocker you cannot resolve:
1. `beans update {bean.id} --tag blocked`
2. `beans create "Blocker: {description}" -t bug --blocking {bean.id} -d "..."`
3. Exit cleanly - the loop will stop and a human can help

## Remember

- You will be re-run if the task isn't complete yet
- Your changes persist between runs (check git log)
- Focus on one checklist item at a time
- Test your changes before marking complete
```

## Completion Detection

Agent marks bean completed via: `beans update {bean-id} --status completed`
Script checks bean status after each iteration using: `beans query`
Script also checks for `blocked` or `failed` tags to stop the loop early.

## Commit Behavior

**Primary**: Agent creates its own commits with proper conventional commit messages.

**Fallback**: If agent exits without committing staged/unstaged changes, script creates a WIP commit:
- Check for uncommitted changes: `git status --porcelain`
- If changes exist: `git add -A && git commit -m "wip({bean-id}): ralph loop iteration N"`
- This ensures no work is lost between iterations

The WIP commits can be squashed later or the agent can amend them in the next iteration.

## Usage

```bash
# Auto-select and work through all actionable beans
./scripts/ralph-loop.sh

# Work on a specific bean (skip auto-selection)
./scripts/ralph-loop.sh daedalus-ap8h

# With max iterations per bean
./scripts/ralph-loop.sh --max-iterations 10

# With different agent
TALOS_AGENT=claude ./scripts/ralph-loop.sh

# Dry run - show what would be selected
./scripts/ralph-loop.sh --dry-run
```

## Checklist

### Work Selection
- [x] Create scripts/ralph-loop.sh
- [x] Query all beans with todo status, not blocked, actionable types
- [x] Sort by priority (critical > high > normal > low > deferred)
- [x] Select first bean, or use bean ID if passed as argument
- [x] Mark selected bean as in-progress before starting
- [x] Exit gracefully if no actionable beans found

### Bean Context
- [x] Fetch selected bean with full body
- [x] Include parent chain for scope context
- [x] Include children if present

### Agent Execution
- [x] Generate prompt from bean context
- [x] Run agent (opencode default, TALOS_AGENT env for claude/codex)
- [x] Check bean status after agent exits
- [x] Fallback WIP commit if agent left uncommitted changes
- [x] Re-fetch bean and continue if still in-progress

### Outer Loop
- [x] After bean completes (or blocked/failed), go back to work selection
- [x] Continue until no actionable beans remain
- [x] Track total beans completed in session

### Stop Conditions
- [x] Stop inner loop when bean status = 'completed'
- [x] Stop inner loop when bean has 'blocked' or 'failed' tag
- [x] Stop inner loop when max iterations per bean reached
- [x] Stop outer loop when no actionable beans found

### CLI Flags
- [x] [bean-id] - optional, work on specific bean
- [x] --max-iterations N (default: 50 per bean)
- [x] --dry-run (show selection and prompt without running)
- [x] --once (complete one bean then exit, don't continue to next)

### Polish
- [x] Print which bean was selected and why
- [x] Print iteration count and status each inner loop
- [x] Print summary when bean completes (time, iterations, commits)
- [x] Color output (green=completed, yellow=in-progress, red=blocked/failed)
- [x] Handle agent errors gracefully (non-zero exit continues loop)