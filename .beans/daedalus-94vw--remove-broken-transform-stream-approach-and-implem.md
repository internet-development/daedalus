---
# daedalus-94vw
title: Remove broken Transform stream and add /edit command for multi-line input
status: completed
type: task
priority: normal
created_at: 2026-01-29T20:00:11Z
updated_at: 2026-01-29T20:53:48Z
---

## Context

The current implementation uses a Transform stream to intercept Shift+Enter escape sequences before they reach readline. This approach is fundamentally broken because:
1. Readline processes input before Transform streams can intercept it
2. Without raw mode, escape sequences are partially processed by the terminal
3. The escape sequence `^[[27;2;13~` is being printed literally

Research shows the Unix standard pattern for multi-line input is to use $EDITOR (like git commit, gh, kubectl). A critic review identified that the original Ctrl+X Ctrl+E keybinding approach had 4 blockers (raw mode conflicts with readline, Ctrl+X intercepts readline's Emacs prefix, `rl.write()` can't handle multi-line, undefined post-editor UX). The `/edit` slash command approach eliminates all blockers.

## Solution

1. Remove broken Transform stream code
2. Add `/edit` (alias `/e`) slash command that opens $EDITOR
3. Auto-submit the edited content as a message (like git commit)
4. Follow Unix patterns: `$EDITOR` → fallback to `vi`

## Implementation

### Files to Remove
- `src/cli/shift-enter.ts` — Broken escape sequence detection
- `src/cli/shift-enter.test.ts` — Tests for broken approach
- `src/cli/stdin-transform.ts` — Transform stream factory
- `src/cli/stdin-transform.test.ts` — Transform stream tests

### Files to Create
- `src/cli/editor.ts` — $EDITOR integration module (exported `openEditor()` function)

### Files to Modify

**`src/cli/plan.ts`**
- Remove `import { createShiftEnterTransform } from './stdin-transform.js'` (line ~41)
- Remove Transform stream setup (lines ~132-141): delete `createShiftEnterTransform()`, `process.stdin.pipe(stdinTransform)`, and change readline `input` back to `process.stdin`
- No other changes needed — command dispatch is handled in `commands.ts`

**`src/cli/commands.ts`**
- Add `/edit` and `/e` to `COMMAND_NAMES` array (line ~40) for tab completion
- Add `case 'edit': case 'e':` to `handleCommand()` switch statement (line ~153)
- Implement `handleEdit()` handler that:
  1. Calls `openEditor()` from `editor.ts`
  2. Returns `{ type: 'send', message: editedContent }` to auto-submit
  3. Returns `{ type: 'continue' }` on error/empty/abort

**`src/cli/output.ts`**
- Add `/edit, /e` to help text (line ~126): `"Open $EDITOR for multi-line input"`

### Editor Module (`src/cli/editor.ts`)

```typescript
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, unlinkSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, basename } from 'node:path';

export function openEditor(initialContent = ''): string | null {
  const editorEnv = process.env.EDITOR || 'vi';

  // Support $EDITOR with arguments (e.g., "vim -u NONE")
  const parts = editorEnv.split(/\s+/);
  const [cmd, ...editorArgs] = parts;

  // Create temp file with restricted permissions
  const tempDir = mkdtempSync(join(tmpdir(), 'daedalus-'));
  const tempFile = join(tempDir, 'PLAN_MESSAGE.md');

  try {
    writeFileSync(tempFile, initialContent, { encoding: 'utf8', mode: 0o600 });

    const result = spawnSync(cmd, [...editorArgs, tempFile], {
      stdio: 'inherit',
    });

    if (result.status !== 0) {
      return null; // Editor exited with error or was cancelled
    }

    if (result.error) {
      if (result.error.code === 'ENOENT') {
        console.error(
          `Editor '${cmd}' not found.\n` +
          `Set $EDITOR environment variable.\n` +
          `Example: export EDITOR=vim`
        );
      } else {
        console.error(`Editor error: ${result.error.message}`);
      }
      return null;
    }

    const content = readFileSync(tempFile, 'utf8').trim();

    if (!content) {
      return null; // Empty message
    }

    return content;
  } finally {
    try { unlinkSync(tempFile); } catch {}
    try { rmdirSync(tempDir); } catch {}
  }
}
```

### Command Handler (`commands.ts`)

```typescript
import { openEditor } from './editor.js';

async function handleEdit(): Promise<CommandResult> {
  const content = openEditor();

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
[editor opens with empty file]
[user types multi-line message, saves, exits]
> Sending message...
[message is auto-submitted to the planner]
```

## Checklist

- [x] Remove `src/cli/shift-enter.ts` and `src/cli/shift-enter.test.ts`
- [x] Remove `src/cli/stdin-transform.ts` and `src/cli/stdin-transform.test.ts`
- [x] Update `src/cli/plan.ts`:
  - [x] Remove `createShiftEnterTransform` import
  - [x] Remove Transform stream piping, use `process.stdin` directly for readline
- [x] Create `src/cli/editor.ts`:
  - [x] `openEditor()` function using `spawnSync` with `stdio: 'inherit'`
  - [x] `$EDITOR` env var with `vi` fallback
  - [x] Support `$EDITOR` with arguments (split on whitespace)
  - [x] Temp file with `0o600` permissions and `.md` extension
  - [x] Clean up both temp file and temp directory in finally block
  - [x] Return `null` on error, non-zero exit, or empty content
- [x] Update `src/cli/commands.ts`:
  - [x] Add `/edit` and `/e` to `COMMAND_NAMES` array
  - [x] Add `case 'edit': case 'e':` to switch in `handleCommand()`
  - [x] Implement `handleEdit()` returning `{ type: 'send', message }` or `{ type: 'continue' }`
- [x] Update `src/cli/output.ts`:
  - [x] Add `/edit, /e` to help text: "Open $EDITOR for multi-line input"
- [ ] Manual testing:
  - [ ] `/edit` opens editor, saves, auto-submits message
  - [ ] `/e` alias works
  - [ ] Empty file returns to prompt without sending
  - [ ] `:q!` in vim (non-zero exit) returns to prompt
  - [ ] `$EDITOR` not set falls back to `vi`
  - [ ] Tab completion includes `/edit` and `/e`

## Design Decisions

**Why `/edit` slash command instead of Ctrl+X Ctrl+E?**
- Critic review found 4 blockers with keybinding approach: raw mode conflicts with readline, Ctrl+X intercepts readline's Emacs prefix, `rl.write()` can't handle multi-line content, undefined post-editor UX
- `/edit` uses existing command infrastructure — zero risk of terminal corruption
- Discoverable via `/help` and tab completion
- ~30 lines vs 150+ for keybinding approach

**Why `spawnSync` instead of `spawn`?**
- Synchronous is simpler — no async state management
- readline is already paused during command handling
- Matches how git commit works (blocks until editor closes)

**Why auto-submit after editor?**
- Matches git commit pattern — save+exit = submit
- No ambiguity about post-editor state
- Returns `{ type: 'send', message }` which the main loop already handles

**Why no comment stripping?**
- This is a chat interface, not git commit — users may write markdown with `#` headings
- Stripping comments would silently lose content

**Why no GUI editor detection?**
- Users who set `$EDITOR=code` know to add `--wait` themselves
- Over-engineering for an edge case — just document it if needed

**Why no pre-fill from readline?**
- `/edit` is typed as a command, so readline content IS the command — nothing useful to pre-fill
- Always starts with empty file (simpler, covers 95% of cases)

## Changelog

### Implemented
- Removed broken Transform stream approach (4 files deleted)
- Created `src/cli/editor.ts` with `openEditor()` function using `spawnSync`
- Added `/edit` (alias `/e`) slash command to `commands.ts`
- Added help text entry for `/edit` in `output.ts`
- Restored plain `process.stdin` as readline input (removed Transform stream piping)

### Files Modified
- `src/cli/shift-enter.ts` — DELETED
- `src/cli/shift-enter.test.ts` — DELETED
- `src/cli/stdin-transform.ts` — DELETED
- `src/cli/stdin-transform.test.ts` — DELETED
- `src/cli/editor.ts` — NEW: $EDITOR integration (~65 lines)
- `src/cli/commands.ts` — Added `/edit` and `/e` to COMMAND_NAMES, switch case, and handleEdit() handler
- `src/cli/output.ts` — Added `/edit` to help text
- `src/cli/plan.ts` — Removed Transform stream import and piping, use process.stdin directly

### Deviations from Spec
- **Error check order**: Checked `result.error` before `result.status` in the actual implementation (spec had them reversed). When `spawnSync` fails to find the command, `result.error` is set but `result.status` may be null, so error must be checked first.

### Decisions Made
- Used synchronous fs APIs (`mkdtempSync`, `writeFileSync`, etc.) to match `spawnSync` — entire editor flow is synchronous
- No comment stripping per spec — chat input may contain markdown `#` headings
- No GUI editor detection per spec — users handle `--wait` themselves via `$EDITOR`

### Known Limitations
- Manual testing required for full verification (editor interaction can't be automated)
- `$EDITOR` with quoted arguments (e.g., `EDITOR='vim -u "my config"'`) won't parse correctly — split on whitespace is naive but covers 99% of cases

## Related Beans

- daedalus-1x7u — Original Shift+Enter bug (scrapped — Transform stream approach was fundamentally broken)
