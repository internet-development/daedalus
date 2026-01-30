---
# daedalus-s3it
title: Update README for public release
status: todo
type: task
priority: high
created_at: 2026-01-30T02:18:00Z
updated_at: 2026-01-30T02:18:18Z
parent: daedalus-u7dj
blocking:
    - daedalus-mjez
---

## Context

README exists and is good, but needs updates for a public audience who doesn't know the project.

## Changes

### Add prerequisites section
Document external dependencies:
- Node.js >= 20
- `beans` CLI — link to installation instructions (or explain what it is)
- Claude Code CLI or Anthropic API key (for planning agent)

### Add installation section
```bash
git clone <repo-url>
cd daedalus
npm install
npm run build
```

### Add quick start section
Show the fastest path to using Daedalus:
1. Install prerequisites
2. Clone and build
3. Run `daedalus` or `talos`
4. What to expect

### Verify existing content is accurate
- Check all code examples still work
- Check all file paths are correct
- Remove any internal references

## Files
- `README.md`

## Checklist
- [ ] Add prerequisites section (Node.js, beans CLI, Claude Code/API key)
- [ ] Add installation from source instructions
- [ ] Add quick start section
- [ ] Verify existing content is accurate and not stale
- [ ] Remove any internal/private references