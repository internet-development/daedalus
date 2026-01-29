---
# daedalus-qkep
title: Create talos CLI for daemon management
status: todo
type: feature
priority: normal
created_at: 2026-01-27T09:28:23Z
updated_at: 2026-01-29T00:13:48Z
parent: daedalus-5k7n
---

Create a dedicated CLI tool for running and managing the talos daemon, separate from the main daedalus planning CLI.

## Problem
Currently there's no clean way to:
- Start/stop the daemon independently 
- Test individual daemon components in isolation
- Run the daemon with different configurations
- Check daemon status or logs

The `daedalus` CLI is focused on planning sessions, not daemon management.

## Solution: `talos` CLI
A separate binary for daemon lifecycle management and development workflows.

## Core Commands (MVP)
```bash
talos start              # Start daemon with default config
talos stop               # Stop running daemon  
talos status             # Show daemon status (running/stopped, PID, uptime)
talos logs               # Tail daemon logs
talos config             # Show current configuration
```

## Development Commands (Phase 2)
```bash
talos dev                # Start in development mode (verbose logging)
talos test <component>   # Test individual component (scheduler, watcher, etc.)
talos exec <bean-id>     # Execute specific bean for testing
```

## Technical Implementation
- New binary: `src/cli/talos.ts` with shebang for `bin/talos`
- Use commander.js for subcommand structure
- Daemon process management via PID files in `.talos/daemon.pid`
- Log output to `.talos/daemon.log` 
- Status tracking via `.talos/status.json`

## Configuration Support
- `--config <file>` to override default `talos.yml`
- `--verbose` for debug output
- `--dry-run` to validate config without starting

## Package.json Changes
```json
{
  "bin": {
    "daedalus": "./dist/cli.js",
    "talos": "./dist/cli/talos.js"
  }
}
```

## Success Criteria
- Can start/stop daemon independently of planning sessions
- Clear status reporting (is it running? what's it doing?)
- Easy access to logs for debugging
- Supports development workflows (testing components)

## Files to Create/Modify
- `src/cli/talos.ts` - Main CLI entry point
- `src/talos/daemon-manager.ts` - Process management utilities
- `src/talos/status.ts` - Status tracking and reporting
- `package.json` - Add talos binary
- Update build scripts for new binary

## Checklist
- [ ] Design CLI command structure with commander.js
- [ ] Implement daemon process management (start/stop/status)
- [ ] Add PID file handling for process tracking
- [ ] Create log file management and tailing
- [ ] Add config validation and override support
- [ ] Set up binary compilation and packaging
- [ ] Test daemon lifecycle (start, status, stop)
- [ ] Test with different config files
- [ ] Document usage and development workflows