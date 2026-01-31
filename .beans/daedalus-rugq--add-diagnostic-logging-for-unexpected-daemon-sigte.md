---
# daedalus-rugq
title: Add diagnostic logging for unexpected daemon SIGTERM
status: in-progress
type: task
priority: high
tags:
    - failed
created_at: 2026-01-31T04:56:41Z
updated_at: 2026-01-31T05:51:35Z
---

## Context

The Talos daemon received an unexpected SIGTERM after ~2m43s while working on a bean. The user confirmed they did NOT stop it. The daemon log shows:

```
[04:44:49] Talos daemon starting...
[04:44:50] Bean daedalus-8b67 enqueued, agent spawned (PID 24631)
[04:44:55] Bean status changed to in-progress
[04:47:32] Received SIGTERM, shutting down gracefully
[04:47:32] Agent cancelled, daemon stopped
```

No errors logged before the SIGTERM. We need better diagnostics to identify the source next time this happens.

## Key constraint

Node.js signal handlers **cannot** determine which PID sent the signal (POSIX limitation — requires `SA_SIGINFO` which Node doesn't expose). We must rely on indirect evidence: resource usage, active handles, process state, and macOS system logs.

## Approach

Enhance the signal handler in `src/daemon-entry.ts` to capture a diagnostic snapshot before shutting down. Also add a `beforeExit` handler to detect event loop drain (which would NOT be a SIGTERM).

## Checklist

- [x] In `src/daemon-entry.ts`, enhance the `shutdown` function to log diagnostic info before calling `talos.stop()`:
  - `process.pid` and `process.ppid` (will be 1 for detached daemon — but if it's NOT 1, that's a clue)
  - `process.uptime()` (seconds since daemon started)
  - `process.memoryUsage()` (rss, heapUsed, heapTotal — rules out OOM)
  - `process.resourceUsage()` (maxRSS, majorPageFault, signalsCount)
  - `process.getActiveResourcesInfo()` (what's keeping event loop alive — timers, handles, etc.)
  - Whether the agent runner has an active child process (and its PID)
- [x] Add a `process.on('beforeExit')` handler that logs a warning — this fires ONLY on event loop drain, never on signals. If we see this in logs, it means the event loop emptied unexpectedly (different root cause than SIGTERM).
- [x] Add a `process.on('exit')` handler that logs the final exit code and reason synchronously (last chance to write anything).
- [x] Keep logging lightweight — use `console.log` with JSON since daemon-entry.ts writes to the log file via stdio redirect. Do NOT use `execSync` in the signal handler (risky in signal context).
- [x] Add a `shutdownReason` variable that tracks why we're exiting: `'sigterm'`, `'sigint'`, `'beforeExit'`, `'uncaughtException'`, `'unhandledRejection'`. Log it in the `exit` handler.
- [x] Add `process.on('uncaughtException')` and `process.on('unhandledRejection')` handlers that log the error and set `shutdownReason` before exiting. These could crash the daemon silently without the handlers.

## Files to modify

- `src/daemon-entry.ts` — All changes go here (single file, ~40 lines currently)

## Out of scope

- Auto-restart / supervisor (separate bean if needed)
- Heartbeat / watchdog
- macOS system log queries (risky in signal handler context)
- `process.report.writeReport()` (generates huge JSON files, overkill for now)

## Changelog

### Implemented
- Enhanced `shutdown()` signal handler to capture full diagnostic snapshot (pid, ppid, uptime, memory, resource usage, active handles, agent runner state) before calling `talos.stop()`
- Added `captureDiagnosticSnapshot()` helper that collects all process state into a structured JSON object
- Added `beforeExit` handler to detect unexpected event loop drain (distinct from signal-based shutdown)
- Added `exit` handler for final synchronous log with exit code and shutdown reason
- Added `uncaughtException` and `unhandledRejection` handlers to catch silent crashes
- Added `shutdownReason` tracking variable with typed union (`sigterm | sigint | beforeExit | uncaughtException | unhandledRejection | startup-failure | unknown`)
- Added `getRunnerInfo()` method to `Talos` class to expose agent runner state for diagnostics
- Added `getRunnerInfo()` method to `AgentRunner` class returning `{ isRunning, beanId, pid }`

### Files Modified
- `src/daemon-entry.ts` — Expanded from ~40 lines to ~234 lines with all diagnostic handlers
- `src/talos/talos.ts` — Added `getRunnerInfo()` method delegating to agent runner
- `src/talos/agent-runner.ts` — Added `getRunnerInfo()` method exposing child process state

### Deviations from Spec
- Added `startup-failure` to `ShutdownReason` union (not in spec) — covers the `main().catch()` path which was already present but untracked
- Added `unknown` as default shutdown reason — provides a safe initial value
- Memory snapshot includes `external` bytes and MB conversions — more useful than raw bytes alone
- Resource snapshot includes voluntary/involuntary context switches — additional signal for debugging
- Also logs `beansInProgress` from the scheduler — shows all active beans, not just the agent runner's current one

### Decisions Made
- Used `console.log` with `JSON.stringify` for structured logging (per spec — daemon stdout is redirected to log file)
- Wrapped diagnostic capture in try/catch so a failure in diagnostics doesn't prevent shutdown
- Used `timestamp()` helper for ISO timestamps throughout (consistent format)
- `getRunnerInfo()` returns a plain object (not the child process itself) to avoid leaking internals

### Known Limitations
- Cannot determine which PID sent SIGTERM (POSIX limitation, documented in spec)
- `process.on('exit')` handler is synchronous-only — cannot do async work like querying system logs
- If the daemon is killed with SIGKILL (not SIGTERM), none of these handlers fire