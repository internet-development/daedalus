---
# daedalus-drq1
title: Test edge cases
status: todo
type: task
created_at: 2026-01-28T04:06:47Z
updated_at: 2026-01-28T04:06:47Z
parent: daedalus-fl9w
---

## Summary

Test edge cases and error handling.

## Test Cases

### Signal Handling
- [ ] Ctrl+C during prompt exits cleanly
- [ ] Ctrl+C during streaming cancels stream
- [ ] SIGTERM triggers clean exit
- [ ] Session is saved on signal exit
- [ ] AI session naming attempted on exit (if applicable)

### Error Handling
- [ ] Network error during API call shows error message
- [ ] Missing API key shows helpful error
- [ ] Missing beans CLI shows helpful error (for /tree)
- [ ] Corrupted chat-history.json is handled (reset to default)
- [ ] Permission errors on .talos/ are handled

### Empty Input
- [ ] Empty line does nothing (re-prompts)
- [ ] Whitespace-only line does nothing
- [ ] Ctrl+D (EOF) exits cleanly

### Long Conversations
- [ ] 50+ messages don't cause performance issues
- [ ] Large messages (10KB+) are handled
- [ ] Session file doesn't grow unbounded

### Concurrent Access
- [ ] Two daedalus instances warn about concurrent access
- [ ] File locking or last-write-wins behavior

### Invalid State
- [ ] Session with invalid ID is handled
- [ ] Message with missing timestamp is handled
- [ ] Empty sessions array is handled

### Daemon Edge Cases
- [ ] /start when already running is idempotent
- [ ] /stop when not running is idempotent
- [ ] /status when not running shows appropriate message
- [ ] Daemon crash is handled gracefully

## Checklist

- [ ] Signal handling works
- [ ] Error handling works
- [ ] Empty input handled
- [ ] Long conversations work
- [ ] Concurrent access handled
- [ ] Invalid state handled
- [ ] Daemon edge cases handled
- [ ] No crashes or data loss