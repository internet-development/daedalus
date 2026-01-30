# Daedalus

AI planning CLI and agentic coding orchestration platform. Manages AI agents to execute development work through a bean-driven task system.

## Prerequisites

- **Node.js** >= 20
- **[beans](https://github.com/internet-development/beans)** CLI — issue tracker that stores tasks as markdown files
- **Claude Code CLI** (recommended) or an **Anthropic API key** (`ANTHROPIC_API_KEY`) for the planning agent

## Installation

```bash
git clone https://github.com/internet-development/daedalus.git
cd daedalus
npm install
npm run build
```

## Quick Start

```bash
# Start the planning agent (interactive CLI)
npm run start -- plan

# Start the Talos daemon (watches beans, spawns agents)
npm run start -- talos

# View your bean tree
npm run start -- tree

# Development mode (no build step)
npm run dev -- plan
```

### What to Expect

1. **`plan`** — Opens an interactive planning session where you can brainstorm, break down features, and create beans with AI assistance
2. **`talos`** — Watches the `.beans/` directory for todo tasks and automatically spawns coding agents to work on them
3. **`tree`** — Displays your bean hierarchy in the terminal

## Configuration

Configuration is loaded from `talos.yml` in your project root:

```yaml
agent:
  backend:
    claude:
      model: claude-sonnet-4-20250514

scheduler:
  maxConcurrent: 1

planning_agent:
  provider: claude_code  # or: claude, openai, opencode
```

See [`talos.yml`](talos.yml) for the full configuration reference with comments.

## Development

### Available Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `npm run dev` | `tsx src/cli/index.ts` | Start with tsx for development |
| `npm run build` | `tsc` | Compile TypeScript to `dist/` |
| `npm run start` | `node dist/cli/index.js` | Run compiled version |
| `npm run typecheck` | `tsc --noEmit` | Type check without emitting files |
| `npm test` | `vitest run` | Run all tests once |
| `npm run test:watch` | `vitest` | Run tests in watch mode |
| `npm run test:coverage` | `vitest run --coverage` | Run tests with coverage report |

### Project Structure

```
src/
  cli/              # CLI entry point and commands
  talos/            # Daemon core (orchestration)
  planning/         # Planning agent system
  config/           # Configuration loading (talos.yml + Zod)
  utils/            # Shared utilities
```

### Key Concepts

- **Beans** — Task specifications stored as markdown files in `.beans/`
- **Talos** — The daemon that watches beans and spawns coding agents
- **Planning Agent** — Interactive AI assistant for brainstorming, task breakdown, and expert consultation
- **Event-driven** — Components communicate via EventEmitter for loose coupling

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development workflow, TDD practices, and code style.

## Documentation

| Document | Description |
|----------|-------------|
| [CONTRIBUTING.md](CONTRIBUTING.md) | Development workflow and guidelines |
| [AGENTS.md](AGENTS.md) | Guidelines for AI coding agents |
| [docs/tdd-workflow.md](docs/tdd-workflow.md) | TDD practices with examples |
| [docs/planning-workflow.md](docs/planning-workflow.md) | Planning and brainstorming workflow |
| [docs/logging.md](docs/logging.md) | Logging patterns and best practices |

## License

[MIT](LICENSE)
