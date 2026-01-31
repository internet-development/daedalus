#!/usr/bin/env node
/**
 * Daemon entry point - runs as detached background process
 * 
 * This file is spawned by `talos start` when running in detached mode.
 * It initializes the Talos daemon and handles graceful shutdown.
 * 
 * Includes diagnostic logging for unexpected signals and crashes.
 * All logging uses console.log with JSON since stdout is redirected to the log file.
 */
import { Talos } from './talos/talos.js';
import { resolve } from 'path';

// ---------------------------------------------------------------------------
// Shutdown reason tracking
// ---------------------------------------------------------------------------

type ShutdownReason =
  | 'sigterm'
  | 'sigint'
  | 'beforeExit'
  | 'uncaughtException'
  | 'unhandledRejection'
  | 'startup-failure'
  | 'unknown';

let shutdownReason: ShutdownReason = 'unknown';

// ---------------------------------------------------------------------------
// Diagnostic helpers
// ---------------------------------------------------------------------------

function timestamp(): string {
  return new Date().toISOString();
}

/**
 * Capture a diagnostic snapshot of process state.
 * Called during shutdown to help identify unexpected SIGTERM sources.
 * 
 * Note: Node.js signal handlers cannot determine which PID sent the signal
 * (POSIX limitation — requires SA_SIGINFO which Node doesn't expose).
 * We rely on indirect evidence instead.
 */
function captureDiagnosticSnapshot(talos: Talos): Record<string, unknown> {
  const mem = process.memoryUsage();
  const resources = process.resourceUsage();
  const runnerInfo = talos.getRunnerInfo();
  const inProgress = talos.getInProgress();

  return {
    // Process identity — ppid !== 1 for detached daemon is a clue
    pid: process.pid,
    ppid: process.ppid,

    // Uptime — how long the daemon ran before the signal
    uptimeSeconds: Math.round(process.uptime()),

    // Memory — rules out OOM killer
    memory: {
      rssBytes: mem.rss,
      rssMB: Math.round(mem.rss / 1024 / 1024),
      heapUsedBytes: mem.heapUsed,
      heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
      heapTotalBytes: mem.heapTotal,
      heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024),
      externalBytes: mem.external,
    },

    // Resource usage — signalsCount, page faults, etc.
    resources: {
      maxRSSBytes: resources.maxRSS,
      maxRSSMB: Math.round(resources.maxRSS / 1024),
      voluntaryContextSwitches: resources.voluntaryContextSwitches,
      involuntaryContextSwitches: resources.involuntaryContextSwitches,
      signalsCount: resources.signalsCount,
      majorPageFaults: resources.majorPageFault,
      minorPageFaults: resources.minorPageFault,
    },

    // Active handles — what's keeping the event loop alive
    activeResources: process.getActiveResourcesInfo(),

    // Agent runner state — is a child process active?
    agent: {
      isRunning: runnerInfo.isRunning,
      beanId: runnerInfo.beanId ?? null,
      childPid: runnerInfo.pid ?? null,
    },

    // Beans in progress
    beansInProgress: Array.from(inProgress.entries()).map(([id, running]) => ({
      beanId: id,
      startedAt: new Date(running.startedAt).toISOString(),
      runningForSeconds: Math.round((Date.now() - running.startedAt) / 1000),
    })),
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  // Parse --config argument
  const configIndex = process.argv.indexOf('--config');
  const configPath = configIndex !== -1 ? process.argv[configIndex + 1] : undefined;

  console.log('[%s] Talos daemon starting...', timestamp());
  
  const talos = new Talos(configPath ? resolve(configPath) : undefined);

  // -------------------------------------------------------------------------
  // Signal handlers (SIGTERM, SIGINT)
  // -------------------------------------------------------------------------

  const shutdown = async (signal: string) => {
    shutdownReason = signal === 'SIGTERM' ? 'sigterm' : 'sigint';

    console.log('[%s] Received %s, shutting down gracefully', timestamp(), signal);

    // Capture diagnostic snapshot BEFORE stopping
    try {
      const snapshot = captureDiagnosticSnapshot(talos);
      console.log(JSON.stringify({
        event: 'shutdown-diagnostics',
        timestamp: timestamp(),
        signal,
        shutdownReason,
        ...snapshot,
      }));
    } catch (err) {
      // Don't let diagnostic logging prevent shutdown
      console.log('[%s] Failed to capture diagnostics: %s', timestamp(),
        err instanceof Error ? err.message : String(err));
    }

    await talos.stop();
    console.log('[%s] Talos daemon stopped', timestamp());
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // -------------------------------------------------------------------------
  // beforeExit handler — fires ONLY on event loop drain, never on signals.
  // If we see this in logs, the event loop emptied unexpectedly.
  // -------------------------------------------------------------------------

  process.on('beforeExit', (code) => {
    if (shutdownReason === 'unknown') {
      shutdownReason = 'beforeExit';
    }
    console.log(JSON.stringify({
      event: 'before-exit',
      timestamp: timestamp(),
      exitCode: code,
      shutdownReason,
      warning: 'Event loop drained unexpectedly — this is NOT a signal-based shutdown. '
        + 'Something caused all async work to complete or all handles to close.',
      activeResources: process.getActiveResourcesInfo(),
    }));
  });

  // -------------------------------------------------------------------------
  // exit handler — last synchronous chance to write anything.
  // -------------------------------------------------------------------------

  process.on('exit', (code) => {
    // Must be synchronous — no async allowed here
    console.log(JSON.stringify({
      event: 'process-exit',
      timestamp: timestamp(),
      exitCode: code,
      shutdownReason,
      uptimeSeconds: Math.round(process.uptime()),
    }));
  });

  // -------------------------------------------------------------------------
  // uncaughtException — could crash the daemon silently without this handler.
  // -------------------------------------------------------------------------

  process.on('uncaughtException', (error, origin) => {
    shutdownReason = 'uncaughtException';
    console.log(JSON.stringify({
      event: 'uncaught-exception',
      timestamp: timestamp(),
      origin,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
    }));
    // Exit with failure code — the error is unrecoverable
    process.exit(1);
  });

  // -------------------------------------------------------------------------
  // unhandledRejection — could crash the daemon silently without this handler.
  // -------------------------------------------------------------------------

  process.on('unhandledRejection', (reason, promise) => {
    shutdownReason = 'unhandledRejection';
    const error = reason instanceof Error ? reason : new Error(String(reason));
    console.log(JSON.stringify({
      event: 'unhandled-rejection',
      timestamp: timestamp(),
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
    }));
    // Exit with failure code — the rejection is unrecoverable
    process.exit(1);
  });

  // -------------------------------------------------------------------------
  // Start daemon
  // -------------------------------------------------------------------------

  await talos.start();
  console.log('[%s] Talos daemon started', timestamp());
}

main().catch((error) => {
  shutdownReason = 'startup-failure';
  console.error('[%s] Daemon startup failed:', timestamp(), error);
  process.exit(1);
});
