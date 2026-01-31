---
# daedalus-imv7
title: Add streaming markdown renderer for planning CLI output
status: completed
type: task
priority: normal
created_at: 2026-01-30T08:37:53Z
updated_at: 2026-01-31T06:58:51Z
parent: daedalus-bmnc
---

## Cross-references

- **daedalus-8b67** — Spinner wall-of-text bug also modifies `src/cli/plan.ts` in the streaming/output path (readline creation at line 134, `sendAndStream()` at lines 263-454). Coordinate to avoid merge conflicts if both are in-flight.

The planning agent streams raw markdown to the terminal. Add a line-buffered markdown renderer that converts it to ANSI-styled output.

## Approach

Custom streaming renderer — no new dependencies. Line-buffered: accumulate tokens until `\n`, then regex-transform the complete line. This avoids partial-token issues (e.g. `**` split across chunks) while preserving the streaming feel.

All providers (Claude Code, Anthropic API, OpenAI, OpenCode) emit raw markdown text — no pre-rendered ANSI. Verified in `src/planning/claude-code-provider.ts` (emits `content_block_delta` text).

## Architecture

Create `src/cli/markdown-renderer.ts` with:

```typescript
export class StreamingMarkdownRenderer {
  private buffer = '';
  private inCodeBlock = false;
  private codeBlockLang = '';

  /** Feed a chunk of streamed text. Renders complete lines immediately. */
  write(chunk: string): void;

  /** Flush remaining buffer (call on done/cancel). */
  flush(): void;

  /** Reset state between messages. */
  reset(): void;
}
```

### Integration point

In `src/cli/plan.ts`, the `textHandler` (line 303) currently does:
```typescript
process.stdout.write(text);
```

Replace with:
```typescript
renderer.write(text);
```

Call `renderer.flush()` in the done handler (line 390) and cancel handler (line 372). Call `renderer.reset()` at the start of each `sendAndStream()`.

## Rendering rules

### Phase 1 (P0 — ship this)

| Element | Input | Output |
|---------|-------|--------|
| Bold | `**text**` | ANSI bold |
| Italic | `*text*` or `_text_` | ANSI dim/italic |
| Inline code | `` `code` `` | Cyan on dark background |
| Headings | `## Title` | Bold + colored, with blank line |
| Checklists | `- [ ]` / `- [x]` | `☐` / `☑` with color |
| Bullet lists | `- item` | `  • item` |
| Numbered lists | `1. item` | `  1. item` (keep as-is, just indent) |
| Horizontal rule | `---` | Dim line of dashes to terminal width |
| Code blocks | ` ```lang ... ``` ` | Indented, dim, with language label |
| Blockquotes | `> text` | Dim vertical bar + text |

### Phase 2 (defer — add if users ask)

- Table rendering (complex alignment, error-prone)
- Link rendering (`[text](url)` → `text (url)`)
- Syntax highlighting in code blocks (would need `cli-highlight` dep)
- Nested blockquotes / nested lists

## Line-buffering logic

```
write(chunk):
  buffer += chunk
  while buffer contains '\n':
    line = buffer up to first '\n'
    buffer = remainder after '\n'
    if line is code fence (``` ):
      toggle inCodeBlock
      render fence header/footer
    else if inCodeBlock:
      render as code (indented, dim)
    else:
      render with inline transforms (bold, italic, code, etc.)
```

## Files to create/modify

- **Create** `src/cli/markdown-renderer.ts` — The renderer class
- **Create** `src/cli/markdown-renderer.test.ts` — Tests
- **Modify** `src/cli/plan.ts` — Integrate renderer into `textHandler`

## Edge cases

- Code blocks: track ` ``` ` open/close state, don't apply inline transforms inside code
- Nested bold/italic: `***bold italic***` — handle gracefully, don't need to be perfect
- Cancellation: `flush()` must output any buffered content before `[Cancelled]` is printed
- Empty lines: preserve blank lines for paragraph spacing
- Lines with only whitespace: pass through unchanged

## Checklist

- [x] Confirmed all providers emit raw markdown (verified during planning)
- [x] Create `StreamingMarkdownRenderer` class in `src/cli/markdown-renderer.ts`
- [x] Implement line buffering with `write()`, `flush()`, `reset()`
- [x] Implement inline transforms: bold, italic, inline code
- [x] Implement heading rendering with color and bold
- [x] Implement checklist rendering (`☐` / `☑`)
- [x] Implement bullet list rendering (`•`)
- [x] Implement horizontal rule rendering
- [x] Implement code block state tracking and rendering
- [x] Implement blockquote rendering
- [x] Integrate into `src/cli/plan.ts` textHandler
- [x] Add `flush()` calls on done and cancel
- [x] Add `reset()` call at start of each message
- [x] Write tests for each rendering rule
- [x] Test with real planning session output

## Changelog

### Implemented
- Created `StreamingMarkdownRenderer` class with line-buffered markdown-to-ANSI rendering
- Implemented all Phase 1 rendering rules: bold, italic, inline code, headings (h1-h6 with per-level colors), checklists (☐/☑), bullet lists (•), numbered lists, horizontal rules, code blocks (with language labels), and blockquotes
- Line buffering accumulates tokens until `\n`, then regex-transforms complete lines — avoids partial-token issues during streaming
- Code block state tracking prevents inline transforms inside fenced code blocks
- Integrated renderer into `sendAndStream()` in plan.ts: `renderer.write()` replaces `process.stdout.write()`, with `flush()` on done/cancel and `reset()` at message start
- 53 tests covering all rendering rules, streaming simulation, and edge cases

### Files Modified
- `src/cli/markdown-renderer.ts` — NEW: StreamingMarkdownRenderer class
- `src/cli/markdown-renderer.test.ts` — NEW: 53 tests for all rendering rules
- `src/cli/plan.ts` — Integrated renderer into textHandler, added flush/reset calls

### Deviations from Spec
- Italic uses ANSI italic (`\x1b[3m`) instead of dim — italic is the semantically correct choice and supported by modern terminals
- Horizontal rule uses box-drawing `─` character instead of ASCII `-` — matches existing `formatDivider()` in output.ts for visual consistency
- Heading colors vary by level (h1=magenta, h2=cyan, h3=yellow, h4=green) — spec said "colored" without specifying, this adds visual hierarchy
- Code fence headers use `── lang ──` format instead of just the language name — provides clearer visual boundary

### Decisions Made
- Used `\x1b[48;5;236m` (256-color dark gray background) for inline code — provides subtle contrast without being distracting
- Inline transforms processed in order: code first (to protect contents), then bold+italic, bold, italic — prevents nested marker conflicts
- Underscore italic uses word-boundary lookbehind/ahead to avoid matching `snake_case` identifiers
- `renderer.reset()` called at start of `sendAndStream()` rather than constructor — allows reuse across messages

### Known Limitations
- No nested list support (Phase 2 per spec)
- No table rendering (Phase 2 per spec)
- No link rendering (Phase 2 per spec)
- No syntax highlighting in code blocks (Phase 2, would require dependency)
- Nested blockquotes not supported (Phase 2 per spec)
- `***bold italic***` renders with bold+italic but nested `**bold *italic* bold**` may not render perfectly — spec says "handle gracefully, don't need to be perfect"