---
# daedalus-zkh6
title: Interactive selector for /mode command
status: in-progress
type: bug
priority: normal
created_at: 2026-01-29T21:10:51Z
updated_at: 2026-01-29T22:11:57Z
blocking:
    - daedalus-0msm
---

## Problem

The `/mode` command currently lists modes as text output and requires the user to type `/mode <name>` to switch. The `/sessions` command has a much better UX with an interactive arrow-key selector (`interactiveSelect` in `session-selector.ts`). The `/mode` command should use the same interactive selection pattern.

## Expected Behavior

`/mode` (with no args) should open an interactive selector showing all planning modes, with the current mode highlighted as the default. Arrow keys to navigate, Enter to select. On select, switch mode and print confirmation.

## Current Behavior

`/mode` prints a static list. User must type `/mode brainstorm` to switch.

## Solution

1. Extract `interactiveSelect` (and its helpers: ANSI codes, `simpleSelect`, `SelectOption`) from `session-selector.ts` into a new `src/cli/interactive-select.ts` module
2. Update `session-selector.ts` to import from the new module
3. Update `handleMode()` in `commands.ts` to use the interactive selector when no args provided
4. Keep `/mode <name>` direct switching as-is

## Implementation

### Files to Create
- `src/cli/interactive-select.ts` — Extracted interactive selector module

### Files to Modify
- `src/cli/session-selector.ts` — Remove `interactiveSelect`, `simpleSelect`, `SelectOption`, ANSI helpers, and import them from `interactive-select.ts`
- `src/cli/commands.ts` — Update `handleMode()` to use interactive selector when no args

### Extracting `interactiveSelect`

Move from `session-selector.ts` to `interactive-select.ts`:
- `SelectOption` interface
- ANSI helper constants and functions (`supportsColor`, `c()`, `bold`, `dim`, `green`, `cyan`, `inverse`, ANSI escape codes)
- `interactiveSelect()` function
- `simpleSelect()` fallback function
- `EXIT_SENTINEL` constant

Export:
```typescript
export interface SelectOption {
  label: string;
  value: string | null;
  meta?: string;
}

export const EXIT_SENTINEL = '__EXIT__';

export async function interactiveSelect(
  title: string,
  options: SelectOption[],
  defaultIndex?: number
): Promise<string | null>;
```

### Updated `handleMode()` in `commands.ts`

```typescript
import { interactiveSelect, EXIT_SENTINEL, type SelectOption } from './interactive-select.js';

async function handleMode(args: string, ctx: CommandContext): Promise<CommandResult> {
  if (!args.trim()) {
    // Interactive mode selection
    const options: SelectOption[] = VALID_MODES.map((mode) => ({
      label: mode,
      value: mode,
      meta: MODE_DESCRIPTIONS[mode],
    }));

    const currentIndex = VALID_MODES.indexOf(ctx.session.getMode());
    const result = await interactiveSelect('Planning Modes', options, currentIndex >= 0 ? currentIndex : 0);

    if (result === EXIT_SENTINEL || result === null) {
      return { type: 'continue' };
    }

    if (isValidMode(result)) {
      ctx.session.setMode(result);
      console.log(`Switched to mode: ${result}`);
    }

    return { type: 'continue' };
  }

  // Direct mode switch (existing behavior)
  const mode = args.trim().toLowerCase();
  if (!isValidMode(mode)) {
    console.log(formatError(`Unknown mode: ${args}`));
    console.log('Use /mode to see available modes.');
    return { type: 'continue' };
  }

  ctx.session.setMode(mode);
  console.log(`Switched to mode: ${mode}`);
  return { type: 'continue' };
}
```

Note: Mode descriptions are currently in `output.ts` inside `formatModeList()`. They should be extracted into a constant (e.g., `MODE_DESCRIPTIONS` record) so both `formatModeList` and `handleMode` can use them. Alternatively, define them in `commands.ts` directly since `formatModeList` may become unused after this change.

### Updated `session-selector.ts`

Replace local definitions with imports:
```typescript
import {
  interactiveSelect,
  EXIT_SENTINEL,
  type SelectOption,
} from './interactive-select.js';
```

Remove:
- `EXIT_SENTINEL` constant
- `supportsColor`, `c()`, `bold`, `dim`, `green`, `cyan`, `inverse` helpers
- ANSI escape code constants
- `SelectOption` interface
- `interactiveSelect()` function
- `simpleSelect()` function

Keep:
- `selectSession()` function (uses imported `interactiveSelect`)
- `promptSessionNumber()` function
- `SessionSelection` type

## Checklist

- [x] Create `src/cli/interactive-select.ts`:
  - [x] Move `SelectOption` interface
  - [x] Move ANSI helpers (`supportsColor`, `c()`, `bold`, `dim`, `green`, `cyan`, `inverse`)
  - [x] Move ANSI escape code constants (`CLEAR_LINE`, `CURSOR_UP`, etc.)
  - [x] Move `EXIT_SENTINEL` constant
  - [x] Move `interactiveSelect()` function
  - [x] Move `simpleSelect()` fallback function
  - [x] Export all public APIs
- [x] Update `src/cli/session-selector.ts`:
  - [x] Import from `interactive-select.ts`
  - [x] Remove moved code
  - [x] Verify `selectSession()` still works
- [x] Update `src/cli/commands.ts`:
  - [x] Make `handleMode()` async
  - [x] Add `await` to `handleMode()` call in switch statement
  - [x] Use `interactiveSelect` when no args provided
  - [x] Default selection to current mode index
  - [x] Print confirmation on selection: `Switched to mode: <name>`
  - [x] Handle `EXIT_SENTINEL` and `null` (return `{ type: 'continue' }`)
  - [x] Keep `/mode <name>` direct switching as-is
- [x] Typecheck passes
- [ ] Manual testing:
  - [ ] `/mode` opens interactive selector
  - [ ] Arrow keys navigate, Enter selects
  - [ ] Current mode is pre-selected
  - [ ] `q` or Escape cancels without changing mode
  - [ ] `/mode brainstorm` still works directly

## Design Decisions

**Why extract to a new module?**
- `interactiveSelect` is a generic UI primitive, not session-specific
- `/prompt` selector (daedalus-0msm) will also need it
- Clean separation of concerns

**Why print confirmation after selection?**
- Keeps existing `handleMode()` behavior (already prints `Switched to mode: <name>`)
- Consistent between interactive selection and direct `/mode <name>` switching
- Header redesign (daedalus-ixau) will address persistent state display later

**Why keep `/mode <name>` direct switching?**
- Power users prefer typing
- Scripts/automation may use it
- No reason to remove working functionality

## Changelog

### Implemented
- Extracted `interactiveSelect`, `simpleSelect`, `SelectOption`, `EXIT_SENTINEL`, and all ANSI helpers from `session-selector.ts` into a new reusable `interactive-select.ts` module
- Updated `session-selector.ts` to import from the new module (removed ~130 lines of duplicated code)
- Updated `handleMode()` in `commands.ts` to use interactive selector when no args provided
- Added `MODE_DESCRIPTIONS` constant in `commands.ts` for mode metadata display
- Added test file for the new `interactive-select.ts` module

### Files Modified
- `src/cli/interactive-select.ts` - NEW: Extracted interactive selector module
- `src/cli/interactive-select.test.ts` - NEW: Tests for export contracts
- `src/cli/session-selector.ts` - Removed extracted code, imports from `interactive-select.ts`
- `src/cli/commands.ts` - Updated `handleMode()` to async with interactive selector, added `MODE_DESCRIPTIONS`, removed `formatModeList` import

### Deviations from Spec
- `inverse` ANSI helper was not moved to `interactive-select.ts` since it was unused by `interactiveSelect()` or `simpleSelect()` — kept minimal
- `session-selector.ts` retains a local `cyan` helper and `supportsColor`/`c()` for formatting session labels in `selectSession()` — these are used locally and not part of the extracted interactive selector API
- `formatModeList` in `output.ts` is now dead code (only defined, never imported) — left in place as it's harmless and outside scope

### Decisions Made
- Defined `MODE_DESCRIPTIONS` directly in `commands.ts` rather than extracting from `output.ts`, since `formatModeList` may become unused (as noted in spec)
- Kept `simpleSelect` exported for potential reuse by other commands
- Manual testing items left unchecked as they require interactive TTY verification

### Known Limitations
- Manual testing checklist items cannot be verified in automated CI — require interactive TTY session
- `formatModeList` in `output.ts` is now dead code but not removed (out of scope)

## Related Beans

- daedalus-0msm — Interactive selector for `/prompt` (blocked by this bean)
- daedalus-ixau — Header redesign to reflect current state
