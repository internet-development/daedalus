/**
 * Tests for CLI Test Helpers
 *
 * These tests verify that our CLI testing utilities work correctly.
 */
import { describe, test, expect } from 'vitest';
import { captureOutput, captureExitCode } from './cli-helpers.js';

describe('CLI Helpers', () => {
  describe('captureOutput', () => {
    test('captures stdout from sync console.log', async () => {
      const output = await captureOutput(async () => {
        console.log('Hello, World!');
      });

      expect(output).toContain('Hello, World!');
    });

    test('captures multiple lines of output', async () => {
      const output = await captureOutput(async () => {
        console.log('Line 1');
        console.log('Line 2');
        console.log('Line 3');
      });

      expect(output).toContain('Line 1');
      expect(output).toContain('Line 2');
      expect(output).toContain('Line 3');
    });

    test('captures console.error output', async () => {
      const output = await captureOutput(async () => {
        console.error('Error message');
      });

      expect(output).toContain('Error message');
    });

    test('restores console.log after execution', async () => {
      const originalLog = console.log;

      await captureOutput(async () => {
        console.log('test');
      });

      expect(console.log).toBe(originalLog);
    });

    test('restores console.log even on error', async () => {
      const originalLog = console.log;

      await expect(
        captureOutput(async () => {
          throw new Error('Test error');
        })
      ).rejects.toThrow('Test error');

      expect(console.log).toBe(originalLog);
    });
  });

  describe('captureExitCode', () => {
    test('returns 0 when function completes normally', async () => {
      const code = await captureExitCode(async () => {
        // Do nothing, normal completion
      });

      expect(code).toBe(0);
    });

    test('captures exit code when process.exit is called', async () => {
      const code = await captureExitCode(async () => {
        process.exit(1);
      });

      expect(code).toBe(1);
    });

    test('captures non-zero exit codes', async () => {
      const code = await captureExitCode(async () => {
        process.exit(42);
      });

      expect(code).toBe(42);
    });

    test('restores process.exit after execution', async () => {
      const originalExit = process.exit;

      await captureExitCode(async () => {
        process.exit(0);
      });

      expect(process.exit).toBe(originalExit);
    });

    test('restores process.exit even on error', async () => {
      const originalExit = process.exit;

      await expect(
        captureExitCode(async () => {
          throw new Error('Test error');
        })
      ).rejects.toThrow('Test error');

      expect(process.exit).toBe(originalExit);
    });
  });
});
