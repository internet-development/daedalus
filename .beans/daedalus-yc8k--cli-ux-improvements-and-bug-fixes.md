---
# daedalus-yc8k
title: CLI UX improvements and bug fixes
status: completed
type: feature
priority: normal
created_at: 2026-01-28T04:31:27Z
updated_at: 2026-01-28T04:32:59Z
---

Fix bugs and improve UX in the new readline-based CLI

## Bugs
- [x] User message is duplicated (shown in prompt AND as 'You: ...')

## UX Improvements  
- [x] Add thinking/spinner indicator while planning agent is working
- [x] Improve session selector UI (arrow keys, better visual design)

## Details

### Bug 1: Duplicate user message
When user types a message, it appears twice:
1. In the readline prompt as they type
2. Again as 'You: message' after submission

Should only show once.

### Improvement 1: Thinking indicator
Long-running planning agent calls have no visual feedback.
Add a spinner or dots animation while waiting for response.

### Improvement 2: Better session selector
Current selector is basic numbered list.
Consider:
- Arrow key navigation
- Visual highlighting of current selection
- Maybe use a library like enquirer or prompts