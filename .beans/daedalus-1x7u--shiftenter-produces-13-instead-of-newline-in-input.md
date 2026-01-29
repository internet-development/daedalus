---
# daedalus-1x7u
title: Shift+Enter produces '13~' instead of newline in input
status: in-progress
type: bug
priority: normal
created_at: 2026-01-29T17:06:03Z
updated_at: 2026-01-29T18:23:26Z
---

## Problem

When pressing Shift+Enter in the readline input, it outputs the literal characters `13~` instead of inserting a newline character.

## Expected Behavior

Shift+Enter should insert a newline character, allowing multi-line input.

## Current Behavior

The escape sequence is being printed literally rather than interpreted as a newline.

## Root Cause Analysis

This is a **terminal-dependent escape sequence issue**. Different terminals send different escape sequences for Shift+Enter:

| Terminal | Escape Sequence | Notes |
|----------|----------------|-------|
| **Ghostty** | `\x1b[27;2;13~` | Shows as `[27;2;13~` when unhandled |
| **Konsole** | `\x1b\x4f\x4d` (`\EOM`) | Legacy VT100 compatibility |
| **iTerm2** | Usually `\n` | Often configured correctly |
| **Others** | Varies | May send `\x0d` (CR) same as Enter |

The `13~` we see is the latter part of `[27;2;13~` (the leading `\x1b[27;2;` is being consumed/partially parsed by readline).

### Why Node.js readline doesn't handle this

Node.js readline was designed for line-by-line input. It doesn't interpret Shift+Enter as special - it passes through unrecognized escape sequences as literal characters.

### Research Sources

- [Shift+Enter produces escape sequence instead of newline in Claude Code - Ghostty Discussion](https://github.com/ghostty-org/ghostty/discussions/7780)
- [Handle \EOM escape sequence as newline for Konsole - Claude Code Issue](https://github.com/anthropics/claude-code/issues/2115)
- [Kitty Keyboard Protocol - comprehensive keyboard handling](https://sw.kovidgoyal.net/kitty/keyboard-protocol/)

## Solution

Option A: **Handle escape sequences in raw mode** (recommended)
- Switch from readline to raw stdin mode with custom keypress handling
- Recognize common Shift+Enter sequences and convert to newline
- More complex but handles all terminals

Option B: **Document terminal configuration** (workaround)
- Tell users to configure their terminal to send `\n` on Shift+Enter
- For Ghostty: `keybind = shift+enter=text:\n`
- For others: varies by terminal
- Simple but pushes problem to users

Option C: **Hybrid approach**
- Handle common escape sequences we can detect
- Document configuration for edge cases

## Implementation (Option A - Recommended)

### Files to Modify

- `src/cli/plan.ts:561-602` - Replace `rl.question()` with raw mode input handling

### Escape Sequences to Handle

\`\`\`typescript
const SHIFT_ENTER_SEQUENCES = [
  '\x1b[27;2;13~',  // Ghostty, some xterm variants
  '\x1bOM',         // Konsole (legacy VT100)
  '\x1b[13;2~',     // Some other terminals
  '\n',             // Terminals that send newline directly
];
\`\`\`

### Approach

1. Use `process.stdin.setRawMode(true)` during input
2. Listen for keypress events via `readline.emitKeypressEvents()`
3. When detecting a Shift+Enter sequence, insert newline into buffer
4. When detecting Enter alone, submit the input
5. Handle other keys normally (including arrow keys, backspace, etc.)

## Checklist

- [x] Research: Confirm escape sequences in common terminals (Ghostty, iTerm2, Kitty, VS Code integrated terminal)
- [x] Create `src/cli/shift-enter.ts` module for escape sequence detection (deviation: used Transform stream instead of raw-input.ts)
- [x] Implement escape sequence detection for Shift+Enter variants
- [x] Handle normal keypress events (typing, backspace, arrows) — preserved via readline passthrough
- [x] Support existing features (history navigation, completion) — preserved via readline passthrough
- [x] Replace `question()` in `src/cli/plan.ts` with new raw input handler — stdin piped through Transform
- [ ] Test in multiple terminals (at minimum: iTerm2, VS Code terminal, Ghostty if available)
- [x] Add fallback for terminals that can't be detected — unrecognized sequences pass through unchanged

## Changelog

### Implemented
- Created escape sequence detection module (`shift-enter.ts`) that recognizes Shift+Enter sequences from Ghostty (`\x1b[27;2;13~`), Konsole (`\x1bOM`), and alternate xterm variants (`\x1b[13;2~`)
- Created stdin Transform stream (`stdin-transform.ts`) that intercepts raw stdin data and translates Shift+Enter sequences into backslash + CR markers
- Integrated the Transform stream into `plan.ts` by piping `process.stdin` through it before feeding to readline
- When Shift+Enter is pressed, the escape sequence is converted to `\\\r`, which triggers readline line submission AND the existing backslash-continuation logic in `processInputLine`

### Files Modified
- `src/cli/shift-enter.ts` — NEW: Escape sequence detection and translation
- `src/cli/shift-enter.test.ts` — NEW: 16 tests for detection and translation
- `src/cli/stdin-transform.ts` — NEW: Transform stream factory
- `src/cli/stdin-transform.test.ts` — NEW: 6 tests for stream behavior
- `src/cli/plan.ts` — Modified readline creation to pipe stdin through transform

### Deviations from Spec
- **Used Transform stream instead of raw mode** (spec recommended Option A with `setRawMode`): Reimplementing readline in raw mode would require handling all keypress events (cursor movement, word deletion, history, tab completion, etc.) — thousands of lines of code. The Transform stream approach achieves the same result by intercepting escape sequences *before* readline sees them, preserving all existing readline functionality.
- **Named module `shift-enter.ts` instead of `raw-input.ts`**: The name better reflects what the module does (it's not raw mode input handling)
- **Did not include `\n` in escape sequences**: The spec listed `\n` as a Shift+Enter sequence, but `\n` is a normal newline that readline already handles correctly. Including it would break normal Enter behavior.
- **Manual terminal testing not possible in CI/automated context**: The checklist item "Test in multiple terminals" requires interactive testing in actual terminal emulators, which cannot be done programmatically. The escape sequence handling is thoroughly unit-tested instead.

### Decisions Made
- **Backslash continuation as the mechanism**: Rather than inventing a new multi-line input system, we leverage the existing `processInputLine` backslash continuation. Shift+Enter → `\\\r` → readline submits line ending with `\` → continuation mode activates. This is simple, well-tested, and consistent with existing UX.
- **Longer sequences checked first**: The `SHIFT_ENTER_SEQUENCES` array is ordered longest-first to prevent partial matches (e.g., `\x1b[27;2;13~` before `\x1bOM`)
- **Fast path for non-matching data**: The Transform stream checks `containsShiftEnter` first and passes through unchanged data without string conversion for performance

### Known Limitations
- **Terminal testing**: Cannot be automatically tested in real terminals — requires manual verification in Ghostty, Konsole, iTerm2, etc.
- **Partial escape sequences across chunks**: If a terminal sends a Shift+Enter escape sequence split across two TCP/stdin chunks, the Transform won't detect it. This is extremely unlikely in practice since escape sequences are sent atomically.
- **UX shows backslash**: The user sees `\` at the end of the line when pressing Shift+Enter, consistent with manual backslash continuation but different from a "seamless newline" experience. A raw-mode implementation could provide seamless newlines but at much greater complexity.