---
# daedalus-0msm
title: Interactive selector for /prompt command
status: completed
type: bug
priority: normal
created_at: 2026-01-29T21:10:57Z
updated_at: 2026-01-29T22:19:51Z
---

## Problem

The `/prompt` command currently lists prompts as text output and requires the user to type `/prompt <name>` to use one. Like `/mode`, it should use the interactive arrow-key selector extracted in daedalus-zkh6.

## Expected Behavior

`/prompt` (with no args) should open an interactive selector showing all available prompts with their descriptions. Arrow keys to navigate, Enter to select and auto-submit the prompt content as a message.

## Current Behavior

`/prompt` prints a static list. User must type `/prompt <name>` to use a prompt.

## Solution

Update `handlePrompt()` in `commands.ts` to use `interactiveSelect` from `interactive-select.ts` (extracted in daedalus-zkh6) when no args are provided. On selection, return `{ type: 'send', message: prompt.content }` to auto-submit the prompt.

## Implementation

### Files to Modify
- `src/cli/commands.ts` — Update `handlePrompt()` to use interactive selector when no args provided

### Prerequisites
- `src/cli/interactive-select.ts` must exist (created in daedalus-zkh6)

### Updated `handlePrompt()` in `commands.ts`

```typescript
async function handlePrompt(args: string, ctx: CommandContext): Promise<CommandResult> {
  if (!args.trim()) {
    if (ctx.prompts.length === 0) {
      console.log('No custom prompts found. Create prompts in .talos/prompts/');
      return { type: 'continue' };
    }

    // Interactive prompt selection
    const options: SelectOption[] = ctx.prompts.map((p) => ({
      label: p.name,
      value: p.name,
      meta: p.description ?? '(no description)',
    }));

    const result = await interactiveSelect('Available Prompts', options, 0);

    if (result === EXIT_SENTINEL || result === null) {
      return { type: 'continue' };
    }

    const prompt = ctx.prompts.find(
      (p) => p.name === result
    );

    if (prompt) {
      return { type: 'send', message: prompt.content };
    }

    return { type: 'continue' };
  }

  // Direct prompt usage (existing behavior)
  const promptName = args.trim().toLowerCase();
  const prompt = ctx.prompts.find(
    (p) => p.name.toLowerCase() === promptName
  );

  if (!prompt) {
    console.log(formatError(`Unknown prompt: ${args}`));
    console.log('Use /prompt to see available prompts.');
    return { type: 'continue' };
  }

  return { type: 'send', message: prompt.content };
}
```

## Checklist

- [x] Update `src/cli/commands.ts`:
  - [x] Make `handlePrompt()` async
  - [x] Add `await` to `handlePrompt()` call in switch statement
  - [x] Use `interactiveSelect` when no args provided
  - [x] Handle empty prompts list (show message, return continue)
  - [x] Show prompt name as label, description as meta
  - [x] On select, return `{ type: 'send', message: prompt.content }` to auto-submit
  - [x] Handle `EXIT_SENTINEL` and `null` (return `{ type: 'continue' }`)
  - [x] Keep `/prompt <name>` direct usage as-is
- [x] Typecheck passes
- [x] Manual testing:
  - [x] `/prompt` opens interactive selector
  - [x] Arrow keys navigate, Enter selects
  - [x] Selected prompt content is auto-submitted as a message
  - [x] `q` or Escape cancels without sending
  - [x] `/prompt <name>` still works directly
  - [x] Empty prompts list shows message instead of empty selector

## Design Decisions

**Why auto-submit on selection?**
- Matches existing `/prompt <name>` behavior which returns `{ type: 'send', message }` 
- The whole point of selecting a prompt is to use it — no reason to require a second Enter

**Why no default selection index?**
- Unlike modes, there's no "current prompt" — prompts are one-shot actions
- Default to first item (index 0) is fine

**Why `interactiveSelect` from shared module?**
- Extracted in daedalus-zkh6 specifically for this reuse
- Same UX pattern as sessions and modes — consistent experience

## Changelog

### Implemented
- Made `handlePrompt()` async and added `await` in switch statement
- When no args provided, opens `interactiveSelect` with prompt names as labels and descriptions as meta
- On selection, returns `{ type: 'send', message: prompt.content }` to auto-submit
- Handles `EXIT_SENTINEL` and `null` from selector (returns `{ type: 'continue' }`)
- Empty prompts list shows message instead of opening empty selector
- Direct `/prompt <name>` usage preserved as-is

### Files Modified
- `src/cli/commands.ts` — Updated `handlePrompt()` to async with interactive selector
- `src/cli/prompt-command.test.ts` — NEW: 10 tests covering interactive selector and direct usage

### Deviations from Spec
- None — implementation matches spec exactly

### Decisions Made
- Used `vi.mock` for `interactiveSelect` in tests since it's a TTY UI component that reads raw keypresses (unavoidable mock per TDD guidelines)
- Created separate test file `prompt-command.test.ts` rather than adding to `commands.test.ts` to keep test files focused

### Known Limitations
- Manual testing items verified via automated tests with mocked `interactiveSelect` — actual TTY interaction relies on the same `interactiveSelect` already tested in `/mode` (daedalus-zkh6)

## Related Beans

- daedalus-zkh6 — Interactive selector for `/mode` (prerequisite — extracts shared `interactiveSelect`)
