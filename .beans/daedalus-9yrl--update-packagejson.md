---
# daedalus-9yrl
title: Update package.json
status: todo
type: task
created_at: 2026-01-28T04:05:59Z
updated_at: 2026-01-28T04:05:59Z
parent: daedalus-qj38
---

## Summary

Update package.json to remove Ink/React dependencies and update paths.

## Changes

### Remove Dependencies

```diff
{
  "dependencies": {
-   "ink": "^5.2.0",
-   "react": "^18.3.1",
    ...
  },
  "devDependencies": {
-   "@types/react": "^18.3.0",
    ...
  }
}
```

### Update Paths

```diff
{
  "bin": {
-   "daedalus": "./dist/cli.js"
+   "daedalus": "./dist/cli/index.js"
  },
  "scripts": {
-   "dev": "tsx src/cli.tsx",
+   "dev": "tsx src/cli/index.ts",
    ...
  }
}
```

## Final package.json (relevant sections)

```json
{
  "name": "daedalus",
  "version": "2.0.0",
  "description": "AI Planning CLI for agentic coding orchestration",
  "type": "module",
  "bin": {
    "daedalus": "./dist/cli/index.js"
  },
  "engines": {
    "node": ">=20"
  },
  "scripts": {
    "dev": "tsx src/cli/index.ts",
    "build": "tsc",
    "start": "node dist/cli/index.js",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@ai-sdk/anthropic": "^3.0.23",
    "@ai-sdk/openai": "^3.0.19",
    "ai": "^6.0.50",
    "bash-tool": "^1.3.9",
    "chokidar": "^4.0.0",
    "simple-git": "^3.27.0",
    "yaml": "^2.7.0",
    "zod": "^3.24.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "tsx": "^4.19.0",
    "typescript": "^5.7.0"
  }
}
```

## Commands

```bash
# Remove packages
npm uninstall ink react @types/react

# Verify
npm install
npm run typecheck
npm run build
```

## Checklist

- [ ] Remove ink from dependencies
- [ ] Remove react from dependencies
- [ ] Remove @types/react from devDependencies
- [ ] Update bin path to dist/cli/index.js
- [ ] Update dev script to src/cli/index.ts
- [ ] Update start script to dist/cli/index.js
- [ ] Run npm install
- [ ] Run npm run typecheck
- [ ] Run npm run build
- [ ] Verify daedalus command works