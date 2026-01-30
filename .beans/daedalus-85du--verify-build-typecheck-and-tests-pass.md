---
# daedalus-85du
title: Verify build, typecheck, and tests pass
status: todo
type: task
priority: critical
created_at: 2026-01-30T02:17:53Z
updated_at: 2026-01-30T02:18:18Z
parent: daedalus-u7dj
blocking:
    - daedalus-mjez
---

## Context

Before release, all quality gates must pass. Cannot ship broken code.

## Steps

1. Run `npm run typecheck` — fix any type errors
2. Run `npm run build` — fix any compilation errors  
3. Run `npm test` — fix any test failures
4. Run `npm pack --dry-run` — verify package contents look correct (no sensitive files)

## Checklist
- [ ] npm run typecheck passes
- [ ] npm run build passes
- [ ] npm test passes
- [ ] npm pack --dry-run shows only intended files