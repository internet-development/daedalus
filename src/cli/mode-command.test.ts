/**
 * Tests for /mode command — double message bug (daedalus-xjko)
 *
 * Verifies that switching modes prints the confirmation message exactly once,
 * both via interactive select and direct `/mode <name>`.
 *
 * interactiveSelect is mocked because it's a TTY UI component
 * that reads raw keypresses — unavoidable mock.
 */
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { captureOutput } from '../test-utils/index.js';

// Mock interactiveSelect — TTY UI can't be tested without mocking
vi.mock('./interactive-select.js', async () => {
  const actual = await vi.importActual<typeof import('./interactive-select.js')>(
    './interactive-select.js'
  );
  return {
    ...actual,
    interactiveSelect: vi.fn(),
  };
});

// Import after mock setup
import { handleCommand, type CommandContext } from './commands.js';
import { interactiveSelect, EXIT_SENTINEL } from './interactive-select.js';

const mockedInteractiveSelect = vi.mocked(interactiveSelect);

// =============================================================================
// Test Helpers
// =============================================================================

function makeCtx(overrides?: Partial<CommandContext>): CommandContext {
  return {
    session: {
      getMode: () => 'new',
      setMode: vi.fn(),
    } as unknown as CommandContext['session'],
    history: {
      currentSessionId: 'test',
      sessions: [],
    },
    talos: null,
    prompts: [],
    rlOutput: { mute: vi.fn(), unmute: vi.fn() },
    saveHistory: () => {},
    startDaemon: async () => {},
    stopDaemon: async () => {},
    ...overrides,
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('/mode command — double message bug (daedalus-xjko)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('interactive select (/mode with no args)', () => {
    test('prints "Switched to mode" exactly once when selecting a mode', async () => {
      mockedInteractiveSelect.mockResolvedValue('refine');

      const output = await captureOutput(async () => {
        await handleCommand('/mode', makeCtx());
      });

      const matches = output.match(/Switched to mode/g);
      expect(matches).toHaveLength(1);
      expect(output).toContain('Switched to mode: refine');
    });

    test('prints "Switched to mode" exactly once for each valid mode', async () => {
      const modes = ['new', 'refine', 'critique', 'sweep', 'brainstorm', 'breakdown'];

      for (const mode of modes) {
        mockedInteractiveSelect.mockResolvedValue(mode);

        const output = await captureOutput(async () => {
          await handleCommand('/mode', makeCtx());
        });

        const matches = output.match(/Switched to mode/g);
        expect(matches).toHaveLength(1);
        expect(output).toContain(`Switched to mode: ${mode}`);
      }
    });

    test('prints nothing when user exits with EXIT_SENTINEL', async () => {
      mockedInteractiveSelect.mockResolvedValue(EXIT_SENTINEL);

      const output = await captureOutput(async () => {
        await handleCommand('/mode', makeCtx());
      });

      expect(output).not.toContain('Switched to mode');
    });

    test('prints nothing when user exits with null', async () => {
      mockedInteractiveSelect.mockResolvedValue(null);

      const output = await captureOutput(async () => {
        await handleCommand('/mode', makeCtx());
      });

      expect(output).not.toContain('Switched to mode');
    });

    test('calls setMode exactly once', async () => {
      const setMode = vi.fn();
      mockedInteractiveSelect.mockResolvedValue('refine');

      await handleCommand('/mode', makeCtx({
        session: {
          getMode: () => 'new',
          setMode,
        } as unknown as CommandContext['session'],
      }));

      expect(setMode).toHaveBeenCalledTimes(1);
      expect(setMode).toHaveBeenCalledWith('refine');
    });

    test('/m alias works the same way', async () => {
      mockedInteractiveSelect.mockResolvedValue('critique');

      const output = await captureOutput(async () => {
        await handleCommand('/m', makeCtx());
      });

      const matches = output.match(/Switched to mode/g);
      expect(matches).toHaveLength(1);
      expect(output).toContain('Switched to mode: critique');
    });
  });

  describe('menu cleanup on selection', () => {
    test('interactiveSelect cleanup does not leave stale output that duplicates messages', async () => {
      // This test verifies the fix for daedalus-xjko: the interactive select
      // menu is cleared from the terminal before the confirmation message is
      // printed, preventing ANSI rendering artifacts that caused the message
      // to appear twice.
      mockedInteractiveSelect.mockResolvedValue('refine');

      const output = await captureOutput(async () => {
        await handleCommand('/mode', makeCtx());
      });

      // The output should contain exactly one confirmation message
      const lines = output.split('\n').filter(line => line.includes('Switched to mode'));
      expect(lines).toHaveLength(1);
    });
  });

  describe('direct mode switch (/mode <name>)', () => {
    test('prints "Switched to mode" exactly once', async () => {
      const output = await captureOutput(async () => {
        await handleCommand('/mode refine', makeCtx());
      });

      const matches = output.match(/Switched to mode/g);
      expect(matches).toHaveLength(1);
      expect(output).toContain('Switched to mode: refine');
    });

    test('does not call interactiveSelect', async () => {
      await handleCommand('/mode refine', makeCtx());

      expect(mockedInteractiveSelect).not.toHaveBeenCalled();
    });

    test('shows error for invalid mode', async () => {
      const output = await captureOutput(async () => {
        await handleCommand('/mode invalid', makeCtx());
      });

      expect(output).not.toContain('Switched to mode');
      expect(output).toContain('Unknown mode');
    });
  });
});
