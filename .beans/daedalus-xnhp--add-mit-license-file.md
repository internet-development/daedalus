---
# daedalus-xnhp
title: Add MIT LICENSE file
status: todo
type: task
priority: critical
created_at: 2026-01-30T02:17:40Z
updated_at: 2026-01-30T02:18:18Z
parent: daedalus-u7dj
blocking:
    - daedalus-mjez
---

## Context

package.json declares `"license": "MIT"` but no LICENSE file exists in the repo. Required for public release.

## Approach

Create a standard MIT LICENSE file at the repo root.

## Files
- `LICENSE` — NEW

## Checklist
- [ ] Create LICENSE file with MIT license text
- [ ] Ensure copyright year and name match package.json author