---
# daedalus-rugq
title: Add diagnostic logging for unexpected daemon SIGTERM
status: todo
type: task
priority: high
created_at: 2026-01-31T04:56:41Z
updated_at: 2026-01-31T05:00:46Z
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

- [ ] In `src/daemon-entry.ts`, enhance the `shutdown` function to log diagnostic info before calling `talos.stop()`:
  - `process.pid` and `process.ppid` (will be 1 for detached daemon — but if it's NOT 1, that's a clue)
  - `process.uptime()` (seconds since daemon started)
  - `process.memoryUsage()` (rss, heapUsed, heapTotal — rules out OOM)
  - `process.resourceUsage()` (maxRSS, majorPageFault, signalsCount)
  - `process.getActiveResourcesInfo()` (what's keeping event loop alive — timers, handles, etc.)
  - Whether the agent runner has an active child process (and its PID)
- [ ] Add a `process.on('beforeExit')` handler that logs a warning — this fires ONLY on event loop drain, never on signals. If we see this in logs, it means the event loop emptied unexpectedly (different root cause than SIGTERM).
- [ ] Add a `process.on('exit')` handler that logs the final exit code and reason synchronously (last chance to write anything).
- [ ] Keep logging lightweight — use `console.log` with JSON since daemon-entry.ts writes to the log file via stdio redirect. Do NOT use `execSync` in the signal handler (risky in signal context).
- [ ] Add a `shutdownReason` variable that tracks why we're exiting: `'sigterm'`, `'sigint'`, `'beforeExit'`, `'uncaughtException'`, `'unhandledRejection'`. Log it in the `exit` handler.
- [ ] Add `process.on('uncaughtException')` and `process.on('unhandledRejection')` handlers that log the error and set `shutdownReason` before exiting. These could crash the daemon silently without the handlers.

## Files to modify

- `src/daemon-entry.ts` — All changes go here (single file, ~40 lines currently)

## Out of scope

- Auto-restart / supervisor (separate bean if needed)
- Heartbeat / watchdog
- macOS system log queries (risky in signal handler context)
- `process.report.writeReport()` (generates huge JSON files, overkill for now)