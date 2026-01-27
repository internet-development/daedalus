---
# daedalus-n4vb
title: Layer 1 - Enhanced Tools & Client
status: completed
type: task
priority: normal
created_at: 2026-01-26T23:04:03Z
updated_at: 2026-01-27T01:21:10Z
parent: daedalus-19c1
blocking:
    - daedalus-11w2
---

Enhance beansCliTool and beans-client with relationship management capabilities.

## Files to modify

- `src/talos/beans-client.ts` - Add relationship management functions
- `src/planning/tools.ts` - Enhance beansCliTool

## Tasks

**beans-client.ts:**
1. [x] Add `setParent(id: string, parentId: string | null): Promise<Bean>`
2. [x] Add `addBlocking(id: string, targetId: string): Promise<Bean>`
3. [x] Add `removeBlocking(id: string, targetId: string): Promise<Bean>`

**beansCliTool:**
1. [x] Add `blocking` parameter (array) to create action schema
2. [x] Add update actions: `set_parent`, `add_blocking`, `remove_blocking`
3. [x] Enhance description with planning workflow examples

## Verification

- Can create beans with parent and blocking relationships
- Can update relationships after creation
- Tool description includes clear examples
