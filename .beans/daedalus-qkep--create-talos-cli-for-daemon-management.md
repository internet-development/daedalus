---
# daedalus-qkep
title: Create talos CLI for daemon management
status: draft
type: feature
created_at: 2026-01-27T09:28:23Z
updated_at: 2026-01-27T09:28:23Z
---

Create a dedicated CLI tool for running and managing the talos daemon with various options to make testing and development easier.

## Goals
- Provide a clean CLI interface for starting/stopping the daemon
- Support various run modes (dev, test, production)
- Make it easy to test individual components in isolation
- Improve developer experience during development

## Potential Commands
- `talos start` - Start the daemon
- `talos stop` - Stop the daemon  
- `talos status` - Show daemon status
- `talos run <component>` - Run a specific component (scheduler, watcher, etc.)
- `talos plan` - Jump directly to plan mode
- `talos exec <bean-id>` - Execute a specific bean

## Considerations
- Use a CLI framework (commander, yargs, or similar)
- Support config file overrides via CLI flags
- Add verbose/debug output options
- Consider subcommand structure for organization