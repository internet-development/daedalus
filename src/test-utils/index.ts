/**
 * Test Utilities
 *
 * Reusable utilities for setting up and cleaning up test environments.
 * These are NOT mocks - they create real test data and work with real behavior.
 *
 * ## Principles
 *
 * - Create real test data (not fake behavior)
 * - Set up real test environments (not stubs)
 * - Enable testing actual behavior (not mocked responses)
 * - Clean up after tests (no side effects)
 *
 * ## Usage Example
 *
 * ```typescript
 * import {
 *   withTestBeansDir,
 *   createTestBean,
 *   waitForEvent,
 *   waitUntil,
 * } from './test-utils/index.js';
 *
 * test('watcher detects new bean file', async () => {
 *   await withTestBeansDir(async (dir) => {
 *     const watcher = new BeansWatcher({ beansDir: dir });
 *     await watcher.start();
 *
 *     // Wait for 'bean:created' event
 *     const eventPromise = waitForEvent(watcher, 'bean:created');
 *
 *     // Create actual bean file
 *     await createTestBean(dir, { title: 'New Bean' });
 *
 *     // Verify real event was emitted
 *     const event = await eventPromise;
 *     expect(event.title).toBe('New Bean');
 *
 *     await watcher.stop();
 *   });
 *   // Auto-cleanup happens here
 * });
 * ```
 */

// Bean fixtures - create real bean files for testing
export {
  createTestBean,
  createTempBeansDir,
  cleanupTestBeans,
  withTestBeansDir,
  getBeansSubdir,
  type TestBeanData,
} from './beans-fixtures.js';

// Event helpers - test EventEmitter-based code
export { waitForEvent, collectEvents } from './event-helpers.js';

// Async helpers - test async operations
export { waitUntil, sleep } from './async-helpers.js';

// File system helpers - test file operations
export { createTempDir, removeDir, readTestFile } from './fs-helpers.js';

// CLI helpers - test CLI commands
export {
  captureOutput,
  captureExitCode,
  runCommandWithTestBeans,
  runCommandAndCaptureOutput,
  type CommandContext,
} from './cli-helpers.js';
