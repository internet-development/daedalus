---
# daedalus-imv7
title: Add streaming markdown renderer for planning CLI output
status: todo
type: task
priority: normal
created_at: 2026-01-30T08:37:53Z
updated_at: 2026-01-30T08:56:37Z
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
- [ ] Create `StreamingMarkdownRenderer` class in `src/cli/markdown-renderer.ts`
- [ ] Implement line buffering with `write()`, `flush()`, `reset()`
- [ ] Implement inline transforms: bold, italic, inline code
- [ ] Implement heading rendering with color and bold
- [ ] Implement checklist rendering (`☐` / `☑`)
- [ ] Implement bullet list rendering (`•`)
- [ ] Implement horizontal rule rendering
- [ ] Implement code block state tracking and rendering
- [ ] Implement blockquote rendering
- [ ] Integrate into `src/cli/plan.ts` textHandler
- [ ] Add `flush()` calls on done and cancel
- [ ] Add `reset()` call at start of each message
- [ ] Write tests for each rendering rule
- [ ] Test with real planning session output