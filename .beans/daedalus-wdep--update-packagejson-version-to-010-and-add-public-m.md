---
# daedalus-wdep
title: Update package.json version to 0.1.0 and add public metadata
status: todo
type: task
priority: critical
created_at: 2026-01-30T02:17:38Z
updated_at: 2026-01-30T02:18:18Z
parent: daedalus-u7dj
blocking:
    - daedalus-mjez
---

## Context

package.json currently says version 2.0.0 and is missing metadata needed for a public repo.

## Changes to `package.json`

### Update version
```
"version": "0.1.0"
```

### Add missing fields
```json
{
  "author": "<ask user for name/email>",
  "repository": {
    "type": "git",
    "url": "<ask user for repo URL>"
  },
  "homepage": "<repo URL>#readme",
  "bugs": {
    "url": "<repo URL>/issues"
  },
  "keywords": [
    "ai", "agent", "orchestration", "coding", "cli", "planning", "beans"
  ],
  "files": [
    "dist/",
    "README.md",
    "LICENSE",
    "docs/",
    "skills/"
  ]
}
```

### Add prepublishOnly script (for future npm publish)
```json
"prepublishOnly": "npm run typecheck && npm run build && npm test"
```

## Files
- `package.json`

## Checklist
- [ ] Update version from 2.0.0 to 0.1.0
- [ ] Add author field
- [ ] Add repository field
- [ ] Add homepage field
- [ ] Add bugs field
- [ ] Add keywords field
- [ ] Add files field
- [ ] Add prepublishOnly script
- [ ] Verify npm run typecheck passes
- [ ] Verify npm run build passes