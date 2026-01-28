---
# daedalus-m0ma
title: Create output.ts
status: completed
type: task
priority: normal
created_at: 2026-01-28T04:03:40Z
updated_at: 2026-01-28T04:11:13Z
parent: daedalus-bji1
---

## Summary

Create terminal output formatting utilities with ANSI color codes for the CLI.

## File

`src/cli/output.ts`

## ANSI Color Constants

```typescript
const COLORS = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  italic: '\x1b[3m',
  underline: '\x1b[4m',
  
  // Foreground
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
  
  // Background
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
};
```

## Functions to Implement

### Message Formatting
```typescript
export function formatUserMessage(content: string): string
// Green bold "You: " prefix, then content

export function formatAssistantMessage(content: string): string
// Cyan bold "Planner:" prefix, newline, indented content

export function formatSystemMessage(content: string): string
// Yellow dim text

export function formatError(message: string): string
// Red bold "Error: " prefix
```

### UI Elements
```typescript
export function formatHeader(mode: string, daemonStatus: 'running' | 'stopped'): string
// "Planning [Mode: {mode}] [Daemon: {status}]"
// With horizontal line below

export function formatPrompt(): string
// Returns "> " in appropriate color

export function formatDivider(width?: number): string
// Horizontal line using ─ character
```

### List Formatting
```typescript
export function formatHelp(): string
// Full help text with all commands listed

export function formatSessionList(sessions: ChatSession[], currentId: string | null): string
// Numbered list of sessions with metadata
// e.g., "[1] Feature planning (5 msgs, 2h ago)"
// Current session marked with *

export function formatModeList(currentMode: string): string
// List all modes with descriptions, current marked

export function formatPromptList(prompts: CustomPrompt[]): string
// List all prompts with descriptions

export function formatStatus(
  daemonRunning: boolean,
  queue: Bean[],
  running: Bean[],
  stuck: Bean[]
): string
// Daemon status summary
```

### Helpers
```typescript
export function formatRelativeTime(timestamp: number): string
// e.g., "2h ago", "yesterday", "3 days ago"

export function wrapText(text: string, width: number, indent?: number): string
// Word-wrap text to width, optionally with indent
```

## Design Notes

- Keep formatting simple and readable
- Use colors consistently (green=user, cyan=assistant, yellow=system, red=error)
- Ensure output looks good without colors too (for piping)
- Consider terminal width for wrapping

## Checklist

- [x] Define COLORS constant
- [x] Implement formatUserMessage
- [x] Implement formatAssistantMessage
- [x] Implement formatSystemMessage
- [x] Implement formatError
- [x] Implement formatHeader
- [x] Implement formatPrompt
- [x] Implement formatDivider
- [x] Implement formatHelp
- [x] Implement formatSessionList
- [x] Implement formatModeList
- [x] Implement formatPromptList
- [x] Implement formatStatus
- [x] Implement formatRelativeTime
- [x] Implement wrapText
- [x] Export all functions