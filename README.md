# Daedalus

AI planning CLI and agentic coding orchestration platform. Manages AI agents to execute development work through a bean-driven task system.

## Prerequisites

- **Node.js** >= 20
- **[beans](https://github.com/internet-development/beans)** CLI — file-based issue tracker that stores tasks as markdown files in `.beans/`
- One of the following for the planning agent:
  - **Claude Code CLI** (recommended) — uses your Claude subscription, no API key needed
  - **Anthropic API key** (`ANTHROPIC_API_KEY`) — direct API access
  - **OpenAI API key** (`OPENAI_API_KEY`) — alternative provider

## Installation

```bash
npm install -g @internet-dev/daedalus
```

Or from source:

```bash
git clone https://github.com/internet-development/daedalus.git
cd daedalus
npm install
npm run build
```

## Quick Start

```bash
# Start an interactive planning session
daedalus

# Start in a specific mode
daedalus --mode brainstorm

# Show your bean tree
daedalus tree

# Start the Talos daemon (watches beans, spawns agents)
talos start
```

## Configuration

Create a `talos.yml` in your project root. See the [included talos.yml](talos.yml) for the full reference with comments.

### Agent Backend

The Talos daemon uses an agent backend to execute coding work on beans:

```yaml
agent:
  backend:
    # Claude Code CLI (recommended — uses your Claude subscription)
    claude:
      model: claude-sonnet-4-20250514
      # dangerously_skip_permissions: true

    # OR: OpenCode CLI
    # opencode:
    #   model: anthropic/claude-sonnet-4-20250514

    # OR: Codex CLI
    # codex:
    #   model: codex-mini-latest
```

### Planning Agent Provider

The planning agent powers the interactive `daedalus` CLI:

```yaml
planning_agent:
  # Provider options:
  #   claude_code — Claude Code CLI (no API key, uses subscription)
  #   claude     — Anthropic API (requires ANTHROPIC_API_KEY)
  #   openai     — OpenAI API (requires OPENAI_API_KEY)
  #   opencode   — OpenCode CLI
  provider: claude_code
  model: claude-sonnet-4-20250514
```

### Environment Variables

| Variable | When needed |
|----------|-------------|
| `ANTHROPIC_API_KEY` | When `planning_agent.provider` is `claude` or `anthropic` |
| `OPENAI_API_KEY` | When `planning_agent.provider` is `openai` |

No API key is needed when using `claude_code` or `opencode` providers — they use their respective CLI tools and subscriptions.

## The `daedalus` CLI

The main CLI for interactive AI-assisted planning. Run `daedalus` to start a planning session.

```bash
daedalus                       # Start with session selector
daedalus --new                 # Start fresh session
daedalus --continue            # Continue most recent session
daedalus --mode brainstorm     # Start in brainstorm mode
daedalus tree                  # Show bean tree
```

### Planning Modes

| Mode | Purpose |
|------|---------|
| `new` | Create new beans through guided conversation |
| `refine` | Improve and clarify existing draft beans |
| `critique` | Run expert review on draft beans |
| `sweep` | Check consistency across related beans |
| `brainstorm` | Explore design options with Socratic questioning |
| `breakdown` | Decompose work into actionable child beans (2-5 min each) |

### In-Session Commands

| Command | Action |
|---------|--------|
| `/help` | Show all commands |
| `/mode [name]` | Switch planning mode |
| `/prompt [name]` | Select a built-in prompt |
| `/edit` | Open `$EDITOR` for multi-line input |
| `/sessions` | List and switch sessions |
| `/new` | Start a new session |
| `/tree` | Display bean tree |
| `/start` / `/stop` | Start/stop the Talos daemon |
| `/status` | Show daemon status |
| `/clear` | Clear screen |
| `/quit` | Exit |

### Expert Advisors

The planning agent can consult 9 expert advisor personas for multi-perspective analysis:

| Expert | Focus |
|--------|-------|
| Pragmatist | Ship fast, avoid over-engineering |
| Architect | Scalability, maintainability, long-term health |
| Skeptic | Edge cases, failure modes, what could go wrong |
| Simplifier | Reduce complexity, find simpler alternatives |
| Security | Auth, data exposure, input validation, attack vectors |
| Researcher | Papers, docs, best practices |
| Codebase Explorer | Patterns, dependencies, existing architecture |
| UX Reviewer | User experience, discoverability, interface design |
| Critic | Synthesize multiple perspectives into actionable feedback |

## The `talos` CLI

The Talos daemon watches your `.beans/` directory and automatically spawns coding agents to work on todo beans.

```bash
talos start              # Start daemon (background)
talos start --no-detach  # Start in foreground
talos stop               # Stop daemon
talos stop --force       # Force kill
talos status             # Show daemon status
talos status --json      # JSON output
talos logs               # View recent logs
talos logs -f            # Follow logs
talos logs -n 50         # Last 50 lines
talos config             # Show configuration
talos config --validate  # Validate talos.yml
```

## Skills

Skills are portable markdown workflow definitions that teach the planning agent specific behaviors. They live in the `skills/` directory:

```
skills/
  beans-brainstorming/    # Socratic design exploration
  beans-breakdown/        # Task decomposition
  beans-tdd-suggestion/   # TDD pattern suggestions
```

You can create custom skills by adding a new directory with a `SKILL.md` file. Configure them in `talos.yml`:

```yaml
planning:
  skills_directory: ./skills
  modes:
    brainstorm:
      skill: beans-brainstorming
    breakdown:
      skill: beans-breakdown
```

## Runtime Data

The `.talos/` directory (gitignored) contains:

| Path | Contents |
|------|----------|
| `.talos/output/` | Agent execution logs |
| `.talos/chat-history.json` | Planning chat persistence |
| `.talos/prompts/` | Custom planning prompts |
| `.talos/daemon.pid` | Daemon process ID |
| `.talos/daemon-status.json` | Daemon state |

## Development

### Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start with tsx for development |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm run start` | Run compiled version |
| `npm run typecheck` | Type check without emitting |
| `npm test` | Run all tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage |

### Project Structure

```
src/
  cli/              # CLI entry point and commands (readline-based)
  talos/            # Daemon core (orchestration)
  planning/         # Planning agent system
  config/           # Configuration loading (talos.yml + Zod)
  utils/            # Shared utilities
  test-utils/       # Test utilities (real code, not mocks)
```

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
| [talos.yml](talos.yml) | Full configuration reference |

## License

[MIT](LICENSE)
