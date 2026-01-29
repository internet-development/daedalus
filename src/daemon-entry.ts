#!/usr/bin/env node
/**
 * Daemon entry point - runs as detached background process
 * 
 * This file is spawned by `talos start` when running in detached mode.
 * It initializes the Talos daemon and handles graceful shutdown.
 */
import { Talos } from './talos/talos.js';
import { resolve } from 'path';

async function main() {
  // Parse --config argument
  const configIndex = process.argv.indexOf('--config');
  const configPath = configIndex !== -1 ? process.argv[configIndex + 1] : undefined;

  console.log('[%s] Talos daemon starting...', new Date().toISOString());
  
  const talos = new Talos(configPath ? resolve(configPath) : undefined);

  // Handle shutdown signals
  const shutdown = async (signal: string) => {
    console.log('[%s] Received %s, shutting down gracefully', new Date().toISOString(), signal);
    await talos.stop();
    console.log('[%s] Talos daemon stopped', new Date().toISOString());
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Start daemon
  await talos.start();
  console.log('[%s] Talos daemon started', new Date().toISOString());
}

main().catch((error) => {
  console.error('[%s] Daemon startup failed:', new Date().toISOString(), error);
  process.exit(1);
});
