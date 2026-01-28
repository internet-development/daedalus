---
# daedalus-t8d7
title: Test all /commands
status: todo
type: task
created_at: 2026-01-28T04:06:27Z
updated_at: 2026-01-28T04:06:27Z
parent: daedalus-fl9w
---

## Summary

Test all /commands work correctly.

## Test Cases

### /help
- [ ] Displays all available commands
- [ ] Formatting is readable
- [ ] Returns to prompt after

### /mode
- [ ] `/mode` lists all modes with current marked
- [ ] `/mode brainstorm` switches to brainstorm mode
- [ ] `/mode invalid` shows error message
- [ ] Mode change is reflected in header

### /prompt
- [ ] `/prompt` lists all prompts (default + custom)
- [ ] `/prompt challenge` sends the challenge prompt
- [ ] `/prompt invalid` shows error message
- [ ] Prompt content is sent to agent

### /start
- [ ] `/start` starts the Talos daemon
- [ ] Shows confirmation message
- [ ] `/start` when already running shows appropriate message

### /stop
- [ ] `/stop` stops the Talos daemon
- [ ] Shows confirmation message
- [ ] `/stop` when not running shows appropriate message

### /status
- [ ] Shows daemon running/stopped status
- [ ] When running, shows queue count
- [ ] When running, shows running agents
- [ ] When running, shows stuck beans count

### /sessions
- [ ] Lists all sessions with metadata
- [ ] Allows switching to different session
- [ ] Allows creating new session

### /new
- [ ] Creates new session
- [ ] Switches to new session
- [ ] Shows confirmation message

### /clear
- [ ] Clears current session messages
- [ ] Session still exists (not deleted)
- [ ] Shows confirmation message

### /tree
- [ ] `/tree` spawns beans tree
- [ ] `/tree --blocking` passes arguments
- [ ] Returns to prompt after tree display

### /quit and /q
- [ ] `/quit` exits cleanly
- [ ] `/q` exits cleanly
- [ ] AI generates session name on quit (if applicable)
- [ ] History is saved before exit

### Unknown Commands
- [ ] `/unknown` shows error message
- [ ] Suggests using /help

## Checklist

- [ ] /help works
- [ ] /mode works
- [ ] /prompt works
- [ ] /start works
- [ ] /stop works
- [ ] /status works
- [ ] /sessions works
- [ ] /new works
- [ ] /clear works
- [ ] /tree works
- [ ] /quit and /q work
- [ ] Unknown commands handled gracefully