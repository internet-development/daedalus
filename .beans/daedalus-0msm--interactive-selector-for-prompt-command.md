---
# daedalus-0msm
title: Interactive selector for /prompt command
status: todo
type: bug
priority: normal
created_at: 2026-01-29T21:10:57Z
updated_at: 2026-01-29T22:07:36Z
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

- [ ] Update `src/cli/commands.ts`:
  - [ ] Make `handlePrompt()` async
  - [ ] Add `await` to `handlePrompt()` call in switch statement
  - [ ] Use `interactiveSelect` when no args provided
  - [ ] Handle empty prompts list (show message, return continue)
  - [ ] Show prompt name as label, description as meta
  - [ ] On select, return `{ type: 'send', message: prompt.content }` to auto-submit
  - [ ] Handle `EXIT_SENTINEL` and `null` (return `{ type: 'continue' }`)
  - [ ] Keep `/prompt <name>` direct usage as-is
- [ ] Typecheck passes
- [ ] Manual testing:
  - [ ] `/prompt` opens interactive selector
  - [ ] Arrow keys navigate, Enter selects
  - [ ] Selected prompt content is auto-submitted as a message
  - [ ] `q` or Escape cancels without sending
  - [ ] `/prompt <name>` still works directly
  - [ ] Empty prompts list shows message instead of empty selector

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

## Related Beans

- daedalus-zkh6 — Interactive selector for `/mode` (prerequisite — extracts shared `interactiveSelect`)
