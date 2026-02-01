# Daedalus

[![npm version](https://img.shields.io/npm/v/@internet-dev/daedalus)](https://www.npmjs.com/package/@internet-dev/daedalus)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)](https://www.typescriptlang.org/)
![Visitors](https://ghvc.kabelkultur.se?username=internet-development&repository=daedalus&label=Visitors&style=flat&color=blueviolet)

> **The bottleneck isn't agents. It's having clear enough tasks for them to work on.**

Daedalus is an AI planning CLI that creates structured tasks ([beans](https://github.com/hmans/beans)) for coding agents to execute autonomously. Stop babysitting agents. Plan the work, let them build it.

Read the full philosophy: [A Beans Based AI Workflow](https://caidan.dev/blog/2026-01-29-a-beans-based-ai-workflow/)

## Why Daedalus?

Most agentic coding tools focus on running as many agents as possible. But you can't write instructions fast enough to outpace a single agent. The real bottleneck is planning, not execution.

Daedalus flips the approach:

- **You plan with Daedalus** — an interactive AI planning agent with 9 expert personas (critics, architects, skeptics, simplifiers, and more)
- **Talos executes the plan** — a daemon that watches your task queue, resolves dependencies, and spawns coding agents autonomously
- **Beans are the interface** — plain markdown files with front matter, checked into git, readable by humans and robots alike

```
You (planning) ──→ Daedalus ──→ Beans (.beans/) ──→ Talos ──→ Coding Agents
     ↑                                                              │
     └──────────── review PRs, iterate on plan ─────────────────────┘
```

### How it compares

| Approach | What it does | The gap |
|----------|-------------|---------|
| **Claude Code, Cursor, Aider** | Interactive coding assistant | You're still the bottleneck, context-switching between planning and building |
| **Parallel agent runners** | Run 10-1000 agents at once | Who writes 1000 well-scoped tickets? You can't outpace one agent |
| **Daedalus + Talos** | Plan with AI, execute autonomously | You focus on *what* to build. Talos handles *how* |

## Quick Start

```bash
# Install Daedalus
npm install -g @internet-dev/daedalus

# Install beans (flat-file task tracker)
brew install hmans/beans/beans          # macOS
# or: go install github.com/hmans/beans@latest

# Start planning
cd your-project
beans init
daedalus

# Or jump straight into a mode
daedalus --mode brainstorm              # explore design options
daedalus --mode breakdown               # decompose work into tasks
```

### The workflow

1. **Plan with Daedalus** — Scope features, break them into beans, critique the design
2. **Beans are created** — Each bean is a markdown file with title, status, priority, and blockedBy fields
3. **Start Talos** — `talos start` launches the daemon, which picks up todo beans and spawns agents
4. **Review and iterate** — Check agent output, refine beans, plan the next batch

## Prerequisites

- **Node.js** >= 20
- **[beans](https://github.com/hmans/beans)** CLI — install via `brew install hmans/beans/beans` or `go install github.com/hmans/beans@latest`
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

## Configuration

Create a `talos.yml` in your project root. See the [included talos.yml](talos.yml) for the full reference with comments.

### Agent Backend

The Talos daemon uses an agent backend to execute coding work on beans:

```yaml
agent:
  # Backend to use: claude, opencode, or codex
  backend: claude
  claude:
    model: claude-sonnet-4-20250514
    # dangerously_skip_permissions: true

  # OR: OpenCode CLI
  # backend: opencode
  # opencode:
  #   model: anthropic/claude-sonnet-4-20250514

  # OR: Codex CLI
  # backend: codex
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

The planning agent can consult 9 expert personas for multi-perspective analysis:

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

The Talos daemon watches your `.beans/` directory and automatically spawns coding agents to work on todo beans. Named after the bronze automaton that protected Crete — you don't talk to Talos, he finds the next task and starts working.

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

### The Ralph Loop

Talos runs a [ralph loop](https://www.humanlayer.dev/blog/brief-history-of-ralph) — a while loop that feeds beans to an AI agent until they're done:

1. **Pick a bean** — Query todo/in-progress beans, filter blocked ones, sort by priority
2. **Mark it in-progress** — Update bean status via CLI
3. **Generate a prompt** — Implementation prompt for tasks/bugs, review prompt for epics/milestones
4. **Run the agent** — Claude Code, OpenCode, or Codex
5. **Handle result** — On success, check bean status and move on. On failure, retry up to 3 times
6. **Pick next bean** — Repeat until no beans remain

You can also run the ralph loop directly with the [shell script](scripts/ralph-loop.sh).

## Skills

Skills are portable markdown workflow definitions that teach the planning agent specific behaviors. They live in the `skills/` directory:

```
skills/
  beans-brainstorming/    # Socratic design exploration
  beans-breakdown/        # Task decomposition
  beans-tdd-suggestion/   # TDD pattern suggestions
```

Create custom skills by adding a directory with a `SKILL.md` file. Configure them in `talos.yml`:

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

## Built by the tools it orchestrates

Daedalus is dogfooded — planned, built, and tested using itself. Beans track the work, Daedalus plans the tasks, and Talos writes the code.

| Metric | Count |
|--------|-------|
| Source files | 36 |
| Lines of code | ~12,400 |
| Test files | 27 |
| Tests | 422 |
| Test lines | ~6,200 |

## Development

| Script | Description |
|--------|-------------|
| `npm run dev` | Start with tsx for development |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm run start` | Run compiled version |
| `npm run typecheck` | Type check without emitting |
| `npm test` | Run all tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage |

See [CONTRIBUTING.md](CONTRIBUTING.md) for development workflow, TDD practices, and code style.

## Documentation

| Document | Description |
|----------|-------------|
| [Blog: A Beans Based AI Workflow](https://caidan.dev/blog/2026-01-29-a-beans-based-ai-workflow/) | Philosophy and design behind Daedalus |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Development workflow and guidelines |
| [AGENTS.md](AGENTS.md) | Guidelines for AI coding agents |
| [docs/tdd-workflow.md](docs/tdd-workflow.md) | TDD practices with examples |
| [docs/planning-workflow.md](docs/planning-workflow.md) | Planning and brainstorming workflow |
| [docs/logging.md](docs/logging.md) | Logging patterns and best practices |
| [talos.yml](talos.yml) | Full configuration reference |

## License

[MIT](LICENSE)
