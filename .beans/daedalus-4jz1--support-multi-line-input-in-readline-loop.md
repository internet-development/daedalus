---
# daedalus-4jz1
title: Support multi-line input in readline loop
status: todo
type: feature
priority: normal
created_at: 2026-01-28T20:06:51Z
updated_at: 2026-01-28T20:08:22Z
parent: daedalus-tbsm
---

Allow users to enter multi-line messages in the planning CLI.

## Background
Currently pressing Enter always submits the input. For longer prompts or code snippets, users need multi-line support.

## Design Decision: Backslash continuation

After considering options:
1. ~~Triple-quote syntax~~ - Requires tracking open/close state, can conflict with markdown
2. **Backslash continuation** ✓ - Simple, familiar (shell, Python), easy to implement
3. ~~Special key combo~~ - Hard in basic readline, platform-dependent

**Chosen approach**: End a line with `\` to continue on next line.

## Requirements
- Line ending with `\` (backslash) continues to next line
- Visual indication: continuation prompt changes to `... ` (instead of `> `)
- Backslash is stripped from final message
- Newlines are preserved in the accumulated message
- Ctrl+C during multi-line input cancels and returns to normal prompt
- Empty continuation line (just Enter) does NOT submit - must complete the message

## Example
```
> This is a long message that I want \
... to split across multiple lines \
... for readability.
```

Becomes: `This is a long message that I want to split across multiple lines for readability.`

Wait, that loses newlines. Let me reconsider...

**Revised**: The backslash escapes the Enter key, but preserves the newline in the message:
```
> First line\
... Second line\
... Third line
```

Becomes:
```
First line
Second line
Third line
```

The `\` means "I'm not done yet" but the newline is still part of the content.

## Implementation Notes

### Modified question function
```typescript
async function question(rl: readline.Interface, prompt: string): Promise<string> {
  const lines: string[] = [];
  let currentPrompt = prompt;
  
  while (true) {
    const line = await new Promise<string>((resolve) => {
      rl.question(currentPrompt, resolve);
    });
    
    if (line.endsWith('\\')) {
      // Continuation: strip backslash, store line, continue
      lines.push(line.slice(0, -1));
      currentPrompt = formatContinuationPrompt(); // "... "
    } else {
      // Final line
      lines.push(line);
      break;
    }
  }
  
  return lines.join('\n');
}
```

### Edge cases
- `\` at end of empty line: treat as blank line continuation
- Multiple `\` at end: only strip the last one
- `\\` at end: should result in single `\` (escaped backslash) - but this adds complexity, maybe skip for v1

## Files to modify
- `src/cli/plan.ts` - modify `question()` function for multi-line handling
- `src/cli/output.ts` - add `formatContinuationPrompt()` returning `... `

## Checklist
- [ ] Add `formatContinuationPrompt()` to output.ts returning dim `... `
- [ ] Modify `question()` in plan.ts to accumulate lines
- [ ] Detect trailing backslash and continue prompting
- [ ] Strip trailing backslash from each continued line
- [ ] Join accumulated lines with newlines
- [ ] Test: single line without backslash works as before
- [ ] Test: multi-line with backslash continuation
- [ ] Test: Ctrl+C during multi-line returns to normal prompt
- [ ] Test: backslash in middle of line is preserved
- [ ] Update history to store the complete multi-line message (not individual lines)