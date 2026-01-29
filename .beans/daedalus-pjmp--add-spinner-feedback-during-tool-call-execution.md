---
# daedalus-pjmp
title: Add spinner feedback during tool call execution
status: todo
type: feature
priority: normal
created_at: 2026-01-29T17:28:00Z
updated_at: 2026-01-29T18:15:58Z
---

## Problem

When the planning agent calls a tool, there's a noticeable hang with no visual feedback. Users don't know if the system is working or frozen.

## Dependencies

**Blocked by daedalus-rchx** — Tool call display formatting (truncation fix, newline separation, grouping) must land first. This feature builds on top of the improved tool call display by adding real-time feedback during execution.

**Scope boundary:**
- **daedalus-rchx** handles _what_ is displayed (formatting, truncation, grouping)
- **daedalus-pjmp** handles _feedback during execution_ (spinner, completion indicators)

## "Thinking..." Spinner Transition

The current spinner in `src/cli/plan.ts:63-86` shows "Thinking..." while the LLM generates a response. When a tool call arrives:

1. `toolCallHandler` already calls `spinner.stop()` (line 342)
2. The "Thinking..." spinner is cleared
3. The tool call is displayed

**After this feature**, the flow becomes:
```
⠋ Thinking...                          ← LLM generating (existing)
  [Bash] ⠋ beans create "Fix bug"...   ← Tool executing (NEW)
  [Bash] ✓ beans create "Fix bug"      ← Tool done (NEW)
⠋ Thinking...                          ← LLM generating again (existing resumes)
```

The "Thinking..." spinner and tool spinners are **separate concerns**:
- "Thinking..." runs between `sendMessage` and first text/tool event
- Tool spinners run between tool call detection and tool result
- They never overlap — a tool call event stops "Thinking...", and the tool result allows "Thinking..." to resume if the LLM continues generating

## Research Summary

### Expert Consensus
- **UX Researcher**: Show something within 100ms for 'instant' feel. Optimistic UI pattern — show tool immediately, then spinner.
- **Pragmatist**: Extend existing code. Don't add dependencies for ~25 lines of logic.
- **Architect**: Model states clearly: pending → running → success/error. The current spinner already handles this for "Thinking..."; extend the pattern.
- **Skeptic**: Consider slow tools (10+ seconds) and streaming output cases.
- **Simplifier**: Inline spinner is the sweet spot — feedback without complexity.

### Recommended Pattern
```
  [Bash] ⠋ beans query '{ beans { id title } }'           # Running
  [Bash] ✓ beans query '{ beans { id title } }' (3 results)  # Success
  [Bash] ✗ beans query '{ beans { id title } }' (exit 1)     # Error
```

### Key Principles (from CLI UX research)
- Show tool name + command **immediately** when detected (no waiting)
- Spinner animates until result arrives
- Replace spinner with ✓/✗ on completion
- Optionally show brief result summary

### Sources
- [CLI UX best practices: progress displays](https://evilmartians.com/chronicles/cli-ux-best-practices-3-patterns-for-improving-progress-displays)
- [UX patterns for CLI tools](https://lucasfcosta.com/2022/06/01/ux-patterns-cli-tools.html)
- [cli-spinners - GitHub](https://github.com/sindresorhus/cli-spinners)
- [Tool UI patterns - assistant-ui](https://www.assistant-ui.com/docs/guides/ToolUI)

## Library Evaluation: Build vs Buy

### Current State
- Custom spinner in `src/cli/plan.ts:63-86` (~25 lines)
- Uses raw ANSI codes and `setInterval`
- Works but limited to "Thinking..." message
- No Ink or React — pure Node.js CLI

### Decision: Extend custom implementation

| Option | Verdict |
|--------|---------|
| **Keep custom** | ✅ Recommended — already works, 25 lines, full control |
| **ora** | ❌ Overkill — heavier dep for marginal benefit |
| **yocto-spinner** | ⚠️ Good lightweight option if we needed a dep |
| **cli-spinners** | ⚠️ Just animation frames — pull data inline instead |

## Spinner Selection

Curated from [cli-spinners](https://github.com/sindresorhus/cli-spinners/blob/main/spinners.json). Copy frames inline with attribution — no dependency needed.

| Name | Frames | Interval | Use Case |
|------|--------|----------|----------|
| **dots** | `⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏` | 80ms | Default, clean and professional |
| **moon** | `🌑🌒🌓🌔🌕🌖🌗🌘` | 80ms | Fun alternative, lunar phases |
| **clock** | `🕛🕐🕑🕒🕓🕔🕕🕖🕗🕘🕙🕚` | 100ms | Time-based tasks |
| **earth** | `🌍🌎🌏` | 180ms | Network/remote operations |
| **arc** | `◜◠◝◞◡◟` | 100ms | Minimal, geometric feel |

> Note: `aesthetic` (▰▱▱▱▱▱▱ → ▰▰▰▰▰▰▰) was removed — it's a linear progress bar, not a looping spinner. Replaced with `arc` which loops cleanly for indefinite-duration operations.

### Implementation

```typescript
// Spinner frames curated from cli-spinners
// Reference: https://github.com/sindresorhus/cli-spinners/blob/main/spinners.json
const SPINNERS = {
  dots: { frames: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'], interval: 80 },
  moon: { frames: ['🌑', '🌒', '🌓', '🌔', '🌕', '🌖', '🌗', '🌘'], interval: 80 },
  clock: { frames: ['🕛', '🕐', '🕑', '🕒', '🕓', '🕔', '🕕', '🕖', '🕗', '🕘', '🕙', '🕚'], interval: 100 },
  earth: { frames: ['🌍', '🌎', '🌏'], interval: 180 },
  arc: { frames: ['◜', '◠', '◝', '◞', '◡', '◟'], interval: 100 },
} as const;
```

## Checklist

- [ ] Add `SPINNERS` constant to `src/cli/plan.ts` with attribution link to cli-spinners repo
- [ ] Refactor `createSpinner()` to accept a spinner name parameter (defaults to `dots`)
- [ ] Add `createToolSpinner()` function that:
  - Shows `[ToolName] ⠋ command...` immediately on tool call start
  - Animates spinner inline using `\r` and ANSI codes
  - Returns a `stop(success: boolean)` method
- [ ] Update `toolCallHandler` in `src/cli/plan.ts`:
  - Stop "Thinking..." spinner (already done at line 342)
  - Start tool spinner immediately with tool name + command preview
  - On tool result: stop tool spinner with ✓/✗
- [ ] Handle the "Thinking..." → tool → "Thinking..." transition cleanly
  - "Thinking..." stops when tool call detected
  - Tool spinner runs during execution
  - "Thinking..." resumes if LLM continues generating after tool result
- [ ] Handle error states: show ✗ and exit code on tool failure
- [ ] Test with fast tools (<1s) — spinner should appear briefly then resolve
- [ ] Test with slow tools (>5s) — spinner should animate smoothly