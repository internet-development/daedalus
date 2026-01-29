---
# daedalus-mkog
title: Show context in readline prompt
status: in-progress
type: feature
priority: low
created_at: 2026-01-28T20:06:55Z
updated_at: 2026-01-29T06:34:10Z
parent: daedalus-tbsm
---

Enhance the prompt to show current context like mode and session name.

## Background
Currently the prompt is always just `> `. Users lose context about what mode they're in or which session is active.

## Design Decision: Inline mode indicator

After considering options:
1. **Inline** ✓ - `[brainstorm] > ` - Clean, compact, familiar
2. ~~Two-line~~ - Takes vertical space, feels heavy
3. ~~Abbreviated~~ - `[bs]` is cryptic, saves minimal space

**Chosen approach**: Show mode inline when not in default mode.

## Requirements
- Show current mode in prompt when NOT in default mode (`new`)
- Default mode (`new`) shows plain `> ` to reduce noise
- Format: `[mode] > ` with mode in cyan/dim
- Keep session name out of prompt (too long, changes rarely)
- Prompt should be consistent width for visual stability

## Examples
```
> _                        # Default "new" mode - clean
[brainstorm] > _           # Non-default mode shown
[breakdown] > _
[refine] > _
```

## Implementation Notes

### Updated formatPrompt signature
```typescript
export function formatPrompt(mode?: PlanMode): string {
  if (!mode || mode === 'new') {
    return c('green', '> ');
  }
  return `${c('dim', '[')}${c('cyan', mode)}${c('dim', ']')} ${c('green', '>')} `;
}
```

### Passing context to prompt
In the main loop, `formatPrompt()` needs access to current mode:
```typescript
const input = await question(rl, formatPrompt(ctx.session.getMode()));
```

## Files to modify
- `src/cli/output.ts` - update `formatPrompt()` to accept optional mode parameter
- `src/cli/plan.ts` - pass mode to `formatPrompt()` in main loop

## Checklist
- [x] Update `formatPrompt()` signature to accept optional `PlanMode`
- [x] Return plain `> ` for default mode (`new` or undefined)
- [x] Return `[mode] > ` for non-default modes
- [x] Style mode name in cyan, brackets in dim
- [x] Update main loop to pass `ctx.session.getMode()` to formatPrompt
- [x] Test: default mode shows `> `
- [x] Test: `/mode brainstorm` changes prompt to `[brainstorm] > `
- [x] Test: `/mode new` returns to plain `> `

## Changelog

### Implemented
- Updated `formatPrompt()` to accept optional `PlanMode` parameter
- Returns plain `> ` for default mode (`new`) or when mode is undefined
- Returns `[mode] > ` format for non-default modes (brainstorm, breakdown, refine, critique, sweep)
- Mode name styled in cyan, brackets styled in dim
- Updated main loop to pass current mode from session to formatPrompt

### Files Modified
- `src/cli/output.ts` - Updated `formatPrompt()` signature and implementation
- `src/cli/output.test.ts` - Added 7 new tests for formatPrompt mode behavior
- `src/cli/plan.ts` - Updated main loop to pass `ctx.session.getMode()` to formatPrompt

### Deviations from Spec
- None - implementation matches spec exactly

### Decisions Made
- Used `stripAnsi` helper in tests to make assertions cleaner and avoid ANSI escape code interference
- Tests cover all 6 modes: new, brainstorm, breakdown, refine, critique, sweep

### Known Limitations
- None