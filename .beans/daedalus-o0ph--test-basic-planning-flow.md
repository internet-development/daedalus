---
# daedalus-o0ph
title: Test basic planning flow
status: todo
type: task
created_at: 2026-01-28T04:06:16Z
updated_at: 2026-01-28T04:06:16Z
parent: daedalus-fl9w
---

## Summary

Test the core planning functionality works correctly.

## Test Cases

### Session Selection
- [ ] `daedalus` with no existing sessions creates new session
- [ ] `daedalus` with existing sessions shows session selector
- [ ] Session selector displays sessions sorted by recency
- [ ] Can select existing session by number
- [ ] Can select "new session" option

### Basic Chat
- [ ] Can type and send a message
- [ ] Message is displayed with "You:" prefix
- [ ] Agent response streams to stdout
- [ ] Response is displayed with "Planner:" prefix
- [ ] Messages are saved to session

### Session Persistence
- [ ] Messages persist after /quit
- [ ] Can continue session after restart
- [ ] History is loaded correctly
- [ ] New messages are appended to history

### Streaming
- [ ] Text streams character by character (or chunks)
- [ ] Tool calls are tracked (if applicable)
- [ ] Streaming can be interrupted (Ctrl+C during stream)

## Commands to Test

```bash
# Fresh start
rm -f .talos/chat-history.json
daedalus

# Continue existing
daedalus

# New session explicitly
daedalus --new
```

## Checklist

- [ ] Session selection works
- [ ] Basic chat works
- [ ] Session persistence works
- [ ] Streaming works
- [ ] No crashes or hangs