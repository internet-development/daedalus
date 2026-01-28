---
# daedalus-0v8e
title: Clean up TypeScript config
status: completed
type: task
priority: normal
created_at: 2026-01-28T04:06:06Z
updated_at: 2026-01-28T04:19:47Z
parent: daedalus-qj38
---

## Summary

Update TypeScript configuration after removing React/Ink.

## Potential Changes

### tsconfig.json

Check if these React-specific settings can be removed:

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",           // May need to remove
    "jsxImportSource": "react",   // May need to remove
    ...
  }
}
```

However, if we're not using any JSX files, we can keep these settings - they're just unused.

## Verification Steps

1. Review tsconfig.json for React-specific settings
2. Decide if removal is needed (optional - unused settings don't hurt)
3. If changing, verify typecheck and build still work

## Checklist

- [ ] Review tsconfig.json
- [ ] Remove React JSX settings if desired (optional)
- [ ] Verify npm run typecheck passes
- [ ] Verify npm run build passes