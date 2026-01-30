---
# daedalus-3t2e
title: Clean up repo for public release
status: todo
type: task
priority: high
created_at: 2026-01-30T02:17:49Z
updated_at: 2026-01-30T02:18:18Z
parent: daedalus-u7dj
blocking:
    - daedalus-mjez
---

## Context

Several files need cleanup before the repo goes public. Local config shouldn't leak, and the repo should look professional.

## Changes

### Revert talos.yml to sensible defaults
The current talos.yml has local dev overrides (opencode backend, changed log destination, etc.). Reset to clean defaults that work out of the box for new users:
- `backend: claude` (most common)
- `provider: claude_code` (no API key needed)
- `destination: stdout` (not a local file)
- Commented-out examples for alternative configs

### Verify .gitignore covers sensitive files
Ensure these are excluded:
- `.env`, `.env.*` ✅ (already covered)
- `.talos/` ✅ (already covered)
- Any local config overrides

### Check for hardcoded paths or secrets
Search for any hardcoded local paths, API keys, or user-specific values in committed files.

## Files
- `talos.yml` — Reset to clean defaults
- `.gitignore` — Verify coverage

## Checklist
- [ ] Reset talos.yml to clean defaults for new users
- [ ] Verify .gitignore covers all sensitive files
- [ ] Search for hardcoded paths or secrets in committed files
- [ ] Verify no .env files are committed