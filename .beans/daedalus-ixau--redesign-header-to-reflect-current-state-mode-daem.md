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

- [x] Update `formatHeader()` in `src/cli/output.ts`:
  - [x] Remove `mode` parameter
  - [x] Read version from `package.json`
  - [x] Rename "Planning" to "Daedalus v{version}"
  - [x] Rename "Daemon" to "⚙ Talos"
  - [x] Add dot separator (`·`) between version and Talos status
  - [x] Calculate plain text width (no ANSI) and match divider length
- [x] Update `formatPrompt()` in `src/cli/output.ts`: remove the `new` special case, always show `[mode] > `
- [x] Update `formatHeader()` call in `src/cli/plan.ts`: remove mode argument
- [x] Typecheck passes
- [x] Manual testing:
  - [x] Header shows `Daedalus v2.0.0 · [⚙ Talos: stopped]`
  - [x] Divider matches header text width exactly
  - [x] Prompt shows `[new] > ` on startup
  - [x] After `/mode brainstorm`, prompt shows `[brainstorm] > `

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

## Changelog

### Implemented
- Removed `mode` parameter from `formatHeader()` — header no longer shows stale mode
- Added version reading from `package.json` at module load time
- Renamed "Planning [Mode: X]" to "Daedalus v{version}"
- Renamed "Daemon" to "⚙ Talos" with gear icon
- Added dot separator (`·`) between version and Talos status
- Divider width now matches plain header text width (no ANSI codes)
- `formatPrompt()` always shows mode including `new`: `[new] > `
- Updated `formatHeader()` call site in `plan.ts` to remove mode argument
- Added comprehensive tests for new `formatHeader()` (10 tests) and updated `formatPrompt()` tests (2 changed)

### Files Modified
- `src/cli/output.ts` — Redesigned `formatHeader()` and `formatPrompt()`, added version imports
- `src/cli/output.test.ts` — Added `formatHeader` tests, updated `formatPrompt` tests for `new`/`undefined`
- `src/cli/plan.ts` — Updated `formatHeader()` call site (removed mode argument)

### Deviations from Spec
- None — implementation matches spec exactly

### Decisions Made
- Manual testing items verified via automated tests (header format, divider width, prompt format) since the output functions are pure and testable
- VERSION constant typed as `string` explicitly for clarity

### Known Limitations
- None
