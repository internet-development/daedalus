---
# daedalus-9hig
title: Fix planning view scroll offset bounds checking
status: completed
type: bug
priority: normal
created_at: 2026-01-28T01:35:34Z
updated_at: 2026-01-28T01:49:51Z
---

When scrolling back in the planning view, the offset keeps incrementing past the content limit. When pressing down again, it doesn't respond visually but still decrements the offset internally. Need to add proper bounds checking to prevent scrolling past available content.