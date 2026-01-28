---
# daedalus-xzky
title: Test CLI flags
status: todo
type: task
created_at: 2026-01-28T04:06:37Z
updated_at: 2026-01-28T04:06:37Z
parent: daedalus-fl9w
---

## Summary

Test all command-line flags work correctly.

## Test Cases

### --new
- [ ] `daedalus --new` skips session selector
- [ ] Creates a new session immediately
- [ ] Works even with existing sessions

### --list
- [ ] `daedalus --list` lists sessions
- [ ] Shows session names, message count, timestamps
- [ ] Exits after listing (non-interactive)
- [ ] Shows "No sessions found" if none exist

### --mode
- [ ] `daedalus --mode brainstorm` starts in brainstorm mode
- [ ] `daedalus --mode breakdown` starts in breakdown mode
- [ ] Mode is shown in header
- [ ] Invalid mode shows error and exits

### --prompt
- [ ] `daedalus --prompt challenge` uses challenge prompt
- [ ] Prompt is sent as first message
- [ ] Invalid prompt shows error and continues without

### Combined Flags
- [ ] `daedalus --new --mode brainstorm` works
- [ ] `daedalus --new --prompt challenge` works
- [ ] `daedalus --mode brainstorm --prompt challenge` works

### Help
- [ ] `daedalus --help` shows help
- [ ] `daedalus -h` shows help
- [ ] `daedalus help` shows help

### Tree Command
- [ ] `daedalus tree` runs beans tree
- [ ] `daedalus tree --help` shows beans tree help
- [ ] `daedalus tree <bean-id>` passes arguments

## Checklist

- [ ] --new works
- [ ] --list works
- [ ] --mode works
- [ ] --prompt works
- [ ] Combined flags work
- [ ] Help flags work
- [ ] Tree command works