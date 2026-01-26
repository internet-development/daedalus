---
# daedalus-ap8h
title: 'Project Setup: Replace existing Daedalus codebase'
status: completed
type: task
priority: critical
created_at: 2026-01-26T05:38:47Z
updated_at: 2026-01-26T09:16:13Z
parent: daedalus-ss8m
blocking:
    - daedalus-a5ja
    - daedalus-uyd2
    - daedalus-zhi7
    - daedalus-j9m4
---

Set up the new project structure by removing existing Daedalus code and creating the fresh TypeScript/Ink foundation.

## Decisions Made

- **Git strategy**: Two commits - first removes old code, second scaffolds new structure
- **AGENTS.md**: Replace with new Daedalus v2 instructions explaining Ink/Talos architecture
- **Code preservation**: Keep `common/utilities.ts` as reference (copy somewhere, don't import)
- **Package manager**: npm (can migrate to Bun later if desired - easy migration path)
- **CLI entry point**: Use `bin` field in package.json pointing to compiled JS. Standard Ink pattern:
  - `"bin": { "daedalus": "./dist/cli.js" }`
  - Built file has shebang `#!/usr/bin/env node`
  - `npm run dev` uses tsx for development
  - `npm run build` compiles TypeScript for production

## Preserve These Files

Do NOT delete:
- `.beans/` - Bean tracker data (our issue tracker)
- `.beans.yml` - Bean tracker config
- `scripts/ralph-loop.sh` - Bootstrap script for running agents
- `AGENTS.md` - Will be replaced, not deleted

## Checklist

### Commit 1: Remove old Daedalus code
- [x] Remove existing app/, components/, lib/, stores/, hooks/ directories
- [x] Remove server.ts, next.config.ts, and Next.js related files
- [x] Remove common/ directory (but save utilities.ts somewhere for reference)
- [x] Remove modules/, agents/ directories
- [x] Keep .beans/, .beans.yml, scripts/, and git history
- [x] Commit: `chore: remove old Daedalus code`

### Commit 2: Scaffold new structure
- [x] Create new src/ directory structure:
  - src/index.tsx (entry point)
  - src/talos/ (daemon core)
  - src/ui/ (Ink components)
  - src/config/ (configuration)
  - src/cli/ (CLI commands like `talos tree`)
- [x] Create .talos/ directory for runtime data:
  - .talos/output/ (persisted agent output logs)
  - .talos/chat-history.json (planning chat persistence)
  - .talos/prompts/ (custom planning prompts)
- [x] Add .talos/ to .gitignore (runtime data, not committed)
- [x] Update package.json with new dependencies
- [x] Create tsconfig.json for the new project
- [x] Create talos.yml configuration file (empty/minimal)
- [x] Replace AGENTS.md with new Daedalus v2 instructions
- [x] Add bin field to package.json pointing to dist/cli.js
- [x] Create src/cli.tsx entry point with shebang for production
- [x] Add npm scripts: dev (tsx), build (tsc), start (node dist/cli.js)
- [x] Verify `npm install` and `npm run dev` works
- [x] Verify `npm run build` compiles successfully
- [x] Commit: `feat: scaffold Daedalus v2 project structure`

## Dependencies
- ink: ^5.2.0
- react: ^18.3.1
- chokidar: ^4.0.0
- zod: ^3.24.0
- yaml: ^2.7.0
- simple-git: ^3.27.0
- ai: ^4.0.0 (Vercel AI SDK core)
- @ai-sdk/anthropic: ^1.0.0 (for Claude)
- @ai-sdk/openai: ^1.0.0 (for OpenAI/compatible)
- tsx: ^4.19.0 (dev)
- @types/react: ^18.3.0 (dev)
- typescript: ^5.7.0 (dev)

Note: No Zustand - using React Context + EventEmitter for state management.