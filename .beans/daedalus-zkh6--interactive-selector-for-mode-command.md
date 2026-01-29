---
# daedalus-zkh6
title: Interactive selector for /mode command
status: todo
type: bug
priority: normal
created_at: 2026-01-29T21:10:51Z
updated_at: 2026-01-29T22:07:36Z
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

- [ ] Create `src/cli/interactive-select.ts`:
  - [ ] Move `SelectOption` interface
  - [ ] Move ANSI helpers (`supportsColor`, `c()`, `bold`, `dim`, `green`, `cyan`, `inverse`)
  - [ ] Move ANSI escape code constants (`CLEAR_LINE`, `CURSOR_UP`, etc.)
  - [ ] Move `EXIT_SENTINEL` constant
  - [ ] Move `interactiveSelect()` function
  - [ ] Move `simpleSelect()` fallback function
  - [ ] Export all public APIs
- [ ] Update `src/cli/session-selector.ts`:
  - [ ] Import from `interactive-select.ts`
  - [ ] Remove moved code
  - [ ] Verify `selectSession()` still works
- [ ] Update `src/cli/commands.ts`:
  - [ ] Make `handleMode()` async
  - [ ] Add `await` to `handleMode()` call in switch statement
  - [ ] Use `interactiveSelect` when no args provided
  - [ ] Default selection to current mode index
  - [ ] Print confirmation on selection: `Switched to mode: <name>`
  - [ ] Handle `EXIT_SENTINEL` and `null` (return `{ type: 'continue' }`)
  - [ ] Keep `/mode <name>` direct switching as-is
- [ ] Typecheck passes
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

## Related Beans

- daedalus-0msm — Interactive selector for `/prompt` (blocked by this bean)
- daedalus-ixau — Header redesign to reflect current state
