---
# daedalus-lz47
title: Delete src/index.tsx and src/cli.tsx
status: completed
type: task
priority: normal
created_at: 2026-01-28T04:05:47Z
updated_at: 2026-01-28T04:18:52Z
parent: daedalus-qj38
---

## Summary

Delete the old Ink-based entry points that have been replaced.

## Files to Delete

| File | Replaced By |
|------|-------------|
| `src/index.tsx` | Not needed - was Ink app wrapper |
| `src/cli.tsx` | `src/cli/index.ts` |

## Commands

```bash
rm src/index.tsx
rm src/cli.tsx
```

## Verification

After deletion:
- `npm run typecheck` should pass
- `npm run build` should pass
- `npm run dev` should work (using new cli/index.ts)

## Checklist

- [ ] Delete src/index.tsx
- [ ] Delete src/cli.tsx
- [ ] Verify no remaining imports to these files
- [ ] Run typecheck
- [ ] Run build