/**
 * Tree Command
 *
 * Simple wrapper that spawns `beans tree` as a subprocess.
 * This replaces the Ink-based tree.tsx with a simpler approach.
 */
import { spawn } from 'child_process';

// =============================================================================
// Types
// =============================================================================

export interface TreeOptions {
  args: string[];
}

// =============================================================================
// Main Function
// =============================================================================

export async function runTree(options: TreeOptions): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('beans', ['tree', ...options.args], {
      stdio: 'inherit', // Pass through stdin/stdout/stderr
    });

    child.on('error', (err) => {
      if (err.message.includes('ENOENT')) {
        console.error('Error: beans CLI not found. Please install beans first.');
        console.error('See: https://github.com/anomalyco/beans');
      } else {
        console.error(`Error running beans tree: ${err.message}`);
      }
      reject(err);
    });

    child.on('close', (code) => {
      if (code === 0 || code === null) {
        resolve();
      } else {
        reject(new Error(`beans tree exited with code ${code}`));
      }
    });
  });
}
