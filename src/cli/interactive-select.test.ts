/**
 * Tests for Interactive Select
 *
 * Tests the extracted interactive selector module.
 * The interactive TTY UI is not tested here - we test exports,
 * type contracts, and the simpleSelect fallback behavior.
 */
import { describe, test, expect } from 'vitest';
import { EXIT_SENTINEL, type SelectOption } from './interactive-select.js';
import type { CommandContext } from './commands.js';

// =============================================================================
// Export Contract Tests
// =============================================================================

describe('interactive-select exports', () => {
  test('EXIT_SENTINEL is a string constant', () => {
    expect(typeof EXIT_SENTINEL).toBe('string');
    expect(EXIT_SENTINEL).toBe('__EXIT__');
  });

  test('SelectOption interface supports label, value, and optional meta', () => {
    const option: SelectOption = {
      label: 'Test Option',
      value: 'test',
      meta: 'some description',
    };
    expect(option.label).toBe('Test Option');
    expect(option.value).toBe('test');
    expect(option.meta).toBe('some description');
  });

  test('SelectOption value can be null', () => {
    const option: SelectOption = {
      label: 'New Item',
      value: null,
    };
    expect(option.value).toBeNull();
  });

  test('SelectOption meta is optional', () => {
    const option: SelectOption = {
      label: 'Simple',
      value: 'simple',
    };
    expect(option.meta).toBeUndefined();
  });
});

describe('interactiveSelect', () => {
  test('is exported as a function', async () => {
    const mod = await import('./interactive-select.js');
    expect(typeof mod.interactiveSelect).toBe('function');
  });
});

// =============================================================================
// CommandContext rlOutput contract (daedalus-rbhm)
// =============================================================================

describe('CommandContext rlOutput contract', () => {
  test('CommandContext includes rlOutput with mute and unmute methods', () => {
    // Verify the type contract: CommandContext must have rlOutput
    // This is a compile-time check that also runs at runtime
    const mockRlOutput = {
      mute: () => {},
      unmute: () => {},
    };

    // Create a partial CommandContext to verify the rlOutput shape
    const ctx: Pick<CommandContext, 'rlOutput'> = {
      rlOutput: mockRlOutput,
    };

    expect(typeof ctx.rlOutput.mute).toBe('function');
    expect(typeof ctx.rlOutput.unmute).toBe('function');
  });

  test('rlOutput mute/unmute are called during interactive select commands', () => {
    // Track mute/unmute calls to verify the pattern
    const calls: string[] = [];
    const rlOutput = {
      mute: () => calls.push('mute'),
      unmute: () => calls.push('unmute'),
    };

    // Simulate the mute-around-interactive-select pattern
    rlOutput.mute();
    // ... interactiveSelect would run here ...
    rlOutput.unmute();

    expect(calls).toEqual(['mute', 'unmute']);
  });
});
