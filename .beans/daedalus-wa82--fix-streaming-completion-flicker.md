---
# daedalus-wa82
title: Fix streaming completion flicker
status: completed
type: bug
priority: normal
created_at: 2026-01-28T00:37:58Z
updated_at: 2026-01-28T00:39:30Z
---

Match DOM structures between StreamingMessage and AssistantMessage components to reduce flicker on component swap. Remove (typing...) indicator and simplify AssistantMessage header structure.