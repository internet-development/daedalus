---
# daedalus-ixau
title: Remove mode from header, always show mode in prompt
status: in-progress
type: bug
priority: normal
created_at: 2026-01-29T21:15:11Z
updated_at: 2026-01-29T22:07:56Z
---

## Problem

The header shows the current mode but is only printed once at startup, so it becomes stale after switching modes. Meanwhile, `formatPrompt()` already shows the mode in the input line — but only when it's not `new`.

## Solution

1. Remove mode from the header (it's stale and redundant)
2. Rename "Planning" to "Daedalus" with version number
3. Rename "Daemon" to "Talos" with gear icon
4. Add dot separator between version and Talos status
5. Match divider width to header text width
6. Always show mode in the prompt, including `new`: `[new] > `

Header output:
```
Daedalus v2.0.0 · [⚙ Talos: stopped]
──────────────────────────────────────
```

The prompt is the source of truth for mode — it updates every line.

## Implementation

### Files to Modify
- `src/cli/output.ts` — Update `formatHeader()` and `formatPrompt()`
- `src/cli/plan.ts` — Update `formatHeader()` call site

### `formatHeader()` — Redesign

```typescript
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Read version from package.json at module load
const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, '..', '..', 'package.json'), 'utf8'));
const VERSION = pkg.version;

export function formatHeader(
  daemonStatus: 'running' | 'stopped'
): string {
  const statusColor = daemonStatus === 'running' ? 'green' : 'gray';
  const statusText = c(statusColor, daemonStatus);

  // Plain text for width calculation (no ANSI codes)
  const plainHeader = `Daedalus v${VERSION} · [⚙ Talos: ${daemonStatus}]`;

  const header = `Daedalus v${VERSION} ${c('dim', '·')} ${c('dim', '[')}⚙ Talos: ${statusText}${c('dim', ']')}`;
  const divider = c('dim', '─'.repeat(plainHeader.length));

  return `${header}\n${divider}`;
}
```

### `formatPrompt()` — Always show mode

```typescript
export function formatPrompt(mode?: PlanMode): string {
  const modeName = mode || 'new';
  return `${c('dim', '[')}${c('cyan', modeName)}${c('dim', ']')} ${c('green', '>')} `;
}
```

### `plan.ts` — Update call site

```typescript
// Before
console.log(formatHeader(session.getMode(), ctx.talos ? 'running' : 'stopped'));

// After
console.log(formatHeader(ctx.talos ? 'running' : 'stopped'));
```

## Checklist

- [ ] Update `formatHeader()` in `src/cli/output.ts`:
  - [ ] Remove `mode` parameter
  - [ ] Read version from `package.json`
  - [ ] Rename "Planning" to "Daedalus v{version}"
  - [ ] Rename "Daemon" to "⚙ Talos"
  - [ ] Add dot separator (`·`) between version and Talos status
  - [ ] Calculate plain text width (no ANSI) and match divider length
- [ ] Update `formatPrompt()` in `src/cli/output.ts`: remove the `new` special case, always show `[mode] > `
- [ ] Update `formatHeader()` call in `src/cli/plan.ts`: remove mode argument
- [ ] Typecheck passes
- [ ] Manual testing:
  - [ ] Header shows `Daedalus v2.0.0 · [⚙ Talos: stopped]`
  - [ ] Divider matches header text width exactly
  - [ ] Prompt shows `[new] > ` on startup
  - [ ] After `/mode brainstorm`, prompt shows `[brainstorm] > `

## Design Decisions

**Why remove mode from header instead of updating it?**
- Header is printed once and scrolls away — updating it requires cursor manipulation
- The prompt already shows mode and updates every line
- Simpler is better

**Why always show mode in prompt?**
- Consistent — user always knows what mode they're in
- No special case for `new` — same format regardless of mode

**Why read version from package.json?**
- Standard Node.js approach, stays in sync with `npm version` bumps
- No hardcoded constants to maintain

**Why dynamic divider width?**
- Matches header text exactly regardless of version string length or daemon status
- Uses plain text (stripped of ANSI codes) for accurate width calculation
