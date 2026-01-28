---
# daedalus-d5r5
title: PlanView Newline Preservation Fix
status: completed
type: bug
priority: normal
created_at: 2026-01-27T23:16:26Z
updated_at: 2026-01-28T01:26:46Z
---

Fix the visual inconsistency where paragraph breaks appear during streaming but disappear when the message completes. Unify text rendering between StreamingMessage and AssistantMessage components.