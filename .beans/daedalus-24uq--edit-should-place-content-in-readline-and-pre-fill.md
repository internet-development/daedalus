---
# daedalus-24uq
title: /edit should auto-submit and pre-fill with last agent message
status: todo
type: bug
priority: normal
created_at: 2026-01-29T21:11:21Z
updated_at: 2026-01-29T22:10:33Z
---

## Problem

The `/edit` command opens an empty editor. The user has no context about what the agent last said, making it hard to write a relevant response. The editor should pre-fill with the last agent message as context, with a clear separator indicating where the user should write.

## Expected Behavior

1. `/edit` opens `$EDITOR` with the last agent message at the top (as read-only context)
2. A decorative separator divides agent context from user input area
3. User writes their message below the separator
4. On save+exit, everything up to and including the separator is stripped
5. Remaining content is auto-submitted as a message

## Editor Content Layout

```
<last agent message here, for reference>

#  ╾━━━━━╼◉╾━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╼◉╾━━━━━╼
#         ⚱  DAEDALUS · Write your message below  ⚱
#  ╾━━━━━╼◉╾━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╼◉╾━━━━━╼

<user writes their message here>
```

## Stripping Logic

- Find the **last occurrence** of the separator bottom border line
- Strip everything up to and including that line
- Trim the remaining content
- If empty after stripping, return null (cancelled)
- **Fallback**: If separator is not found (user deleted it, or editor mangled Unicode), treat the entire file content as the user's message. This is a safe default — the user explicitly saved the file, so they intended to send whatever is in it.

Using last occurrence ensures that even if the agent message coincidentally contains the separator text, the real separator is always the final one.

## Current Behavior

`/edit` opens an empty editor and auto-submits content on save+exit. No agent context is provided.

## Solution

1. Update `openEditor()` in `editor.ts` to accept an `agentMessage` option
2. Pre-fill the editor with agent message + separator + empty space for user input
3. Strip separator and everything above it from the result
4. Update `handleEdit()` in `commands.ts` to pass the last agent message from chat history
5. Keep auto-submit behavior (return `{ type: 'send', message }`)

## Implementation

### Files to Modify
- `src/cli/editor.ts` — Add separator constant, agent message pre-fill, and stripping logic
- `src/cli/commands.ts` — Pass last agent message to `openEditor()`, add `CommandContext` to `handleEdit()`

### Separator Constant (`editor.ts`)

```typescript
const SEPARATOR_TOP    = '#  ╾━━━━━╼◉╾━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╼◉╾━━━━━╼';
const SEPARATOR_MIDDLE = '#         ⚱  DAEDALUS · Write your message below  ⚱';
const SEPARATOR_BOTTOM = '#  ╾━━━━━╼◉╾━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╼◉╾━━━━━╼';

const SEPARATOR = `${SEPARATOR_TOP}\n${SEPARATOR_MIDDLE}\n${SEPARATOR_BOTTOM}`;
```

### Updated `openEditor()` Signature

```typescript
interface EditorOptions {
  agentMessage?: string;
}

export function openEditor(options: EditorOptions = {}): string | null {
  const { agentMessage } = options;

  // Build initial content
  let initialContent = '';
  if (agentMessage) {
    initialContent = `${agentMessage}\n\n${SEPARATOR}\n\n`;
  }

  // ... existing temp file + spawn logic ...

  // After reading file, strip separator
  const content = readFileSync(tempFile, 'utf8');
  const cleaned = stripSeparator(content);

  if (!cleaned) {
    return null;
  }

  return cleaned;
}
```

### Stripping Logic (`editor.ts`)

```typescript
function stripSeparator(content: string): string | null {
  // Find last occurrence of the separator bottom line
  const lastIndex = content.lastIndexOf(SEPARATOR_BOTTOM);

  if (lastIndex === -1) {
    // No separator found — treat entire content as user message
    return content.trim() || null;
  }

  // Take everything after the separator bottom line
  const afterSeparator = content.slice(lastIndex + SEPARATOR_BOTTOM.length);
  const trimmed = afterSeparator.trim();

  return trimmed || null;
}
```

### Updated `handleEdit()` in `commands.ts`

```typescript
import { openEditor } from './editor.js';
import { getCurrentSession } from '../planning/chat-history.js';

function handleEdit(ctx: CommandContext): CommandResult {
  // Get last agent message from chat history
  const session = getCurrentSession(ctx.history);
  const messages = session?.messages ?? [];
  const lastAgentMessage = [...messages]
    .reverse()
    .find((m) => m.role === 'assistant');

  const content = openEditor({
    agentMessage: lastAgentMessage?.content,
  });

  if (!content) {
    console.log('Editor cancelled or empty message — not sent.');
    return { type: 'continue' };
  }

  return { type: 'send', message: content };
}
```

### UX Flow

```
> /edit
[editor opens with:]

Here is my analysis of the codebase. I found three issues:
1. The authentication module has a race condition...
2. The cache invalidation logic is missing...
3. The error handler swallows exceptions...

#  ╾━━━━━╼◉╾━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╼◉╾━━━━━╼
#         ⚱  DAEDALUS · Write your message below  ⚱
#  ╾━━━━━╼◉╾━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╼◉╾━━━━━╼

Let's focus on issue 1 first. Can you create a bean
for the race condition fix? Include the specific file
paths and a checklist of changes needed.

[user saves and exits]
[auto-submits: "Let's focus on issue 1 first..."]
```

### Edge Cases

- **No previous agent message**: Open editor with just the separator + empty space below
- **User deletes separator**: Treat entire content as the message (graceful fallback)
- **User writes above separator**: Ignored — only content below last separator counts
- **Agent message contains separator text**: Last occurrence matching ensures the real separator is found
- **Empty content below separator**: Return null, show "cancelled or empty" message

## Checklist

- [ ] Update `src/cli/editor.ts`:
  - [ ] Add separator constants (3-line block with amphora design)
  - [ ] Update `openEditor()` to accept `EditorOptions` with optional `agentMessage`
  - [ ] Build initial content: agent message + separator + empty space
  - [ ] Add `stripSeparator()` function using `lastIndexOf` on bottom border line
  - [ ] Replace raw `.trim()` with `stripSeparator()` for content processing
- [ ] Update `src/cli/commands.ts`:
  - [ ] Change `handleEdit()` signature to accept `ctx: CommandContext` (currently takes no args)
  - [ ] Update call site in switch statement: `return handleEdit(ctx)` (currently `return handleEdit()`)
  - [ ] Import `getCurrentSession` from `../planning/chat-history.js`
  - [ ] Get last assistant message from `getCurrentSession(ctx.history)`
  - [ ] Pass `agentMessage` to `openEditor()`
- [ ] Typecheck passes
- [ ] Manual testing:
  - [ ] `/edit` with previous agent message shows it above separator
  - [ ] `/edit` with no history shows just separator
  - [ ] Content below separator is auto-submitted
  - [ ] Content above separator is stripped
  - [ ] Deleting separator treats entire content as message
  - [ ] Empty content below separator shows "cancelled" message
  - [ ] Saving without changes (only agent message) shows "cancelled"

## Design Decisions

**Why agent message first, separator second, user input last?**
- Natural reading order — read context, then write response
- Like replying to an email with quoted text above
- Cursor naturally starts at the bottom in most editors

**Why last occurrence matching?**
- If the agent message coincidentally contains the separator text, the real separator is always the last one
- Belt and suspenders with the unique namespaced separator design

**Why auto-submit instead of readline prefill?**
- Readline is single-line — `rl.write()` with newlines submits each line separately
- Auto-submit matches git commit pattern (save+exit = submit)
- Keeps existing `{ type: 'send', message }` flow

**Why keep the separator decorative?**
- Makes the editor experience feel polished
- Greek amphora theme matches the project name (Daedalus)
- Unique enough to avoid false matches in agent output

## Related Beans

- daedalus-94vw — Original `/edit` implementation (completed)
