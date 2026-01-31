---
# daedalus-bmnc
title: CLI Terminal Output Fixes
status: todo
type: epic
created_at: 2026-01-30T08:56:32Z
updated_at: 2026-01-30T08:56:32Z
---

Groups all CLI terminal output and readline-related bugs and improvements.

## Scope

- Readline interference bugs (spinner wall-of-text, j/k echoing, double mode messages)
- Spinner formatting improvements
- Streaming markdown renderer

All beans in this epic touch `src/cli/plan.ts` and/or `src/cli/spinner.ts` and share the readline/stdout interaction surface.