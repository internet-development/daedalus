/**
 * Tests for /prompt command interactive selector
 *
 * Tests that /prompt (no args) opens an interactive selector,
 * and /prompt <name> still works for direct usage.
 *
 * interactiveSelect is mocked because it's a TTY UI component
 * that reads raw keypresses — unavoidable mock.
 */
import { describe, test, expect, vi, beforeEach } from 'vitest';
import type { CustomPrompt } from '../planning/prompts.js';
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

const TEST_PROMPTS: CustomPrompt[] = [
  {
    name: 'Challenge',
    description: 'Challenge every assumption',
    content: 'Challenge every assumption in this plan.',
    path: '',
    isDefault: true,
  },
  {
    name: 'Simplify',
    description: 'Find ways to reduce complexity',
    content: 'Look at this plan with fresh eyes and simplify.',
    path: '',
    isDefault: true,
  },
];

function makeCtx(overrides?: Partial<CommandContext>): CommandContext {
  return {
    session: {
      getMode: () => 'new',
      setMode: () => {},
    } as unknown as CommandContext['session'],
    history: {
      currentSessionId: 'test',
      sessions: [],
    },
    talos: null,
    prompts: TEST_PROMPTS,
    saveHistory: () => {},
    startDaemon: async () => {},
    stopDaemon: async () => {},
    ...overrides,
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('/prompt command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('interactive selector (no args)', () => {
    test('returns send result with selected prompt content', async () => {
      mockedInteractiveSelect.mockResolvedValue('Challenge');

      const result = await handleCommand('/prompt', makeCtx());

      expect(result).toEqual({
        type: 'send',
        message: 'Challenge every assumption in this plan.',
      });
    });

    test('calls interactiveSelect with prompt options', async () => {
      mockedInteractiveSelect.mockResolvedValue('Challenge');

      await handleCommand('/prompt', makeCtx());

      expect(mockedInteractiveSelect).toHaveBeenCalledWith(
        'Available Prompts',
        [
          { label: 'Challenge', value: 'Challenge', meta: 'Challenge every assumption' },
          { label: 'Simplify', value: 'Simplify', meta: 'Find ways to reduce complexity' },
        ],
        0
      );
    });

    test('returns continue when user exits selector with EXIT_SENTINEL', async () => {
      mockedInteractiveSelect.mockResolvedValue(EXIT_SENTINEL);

      const result = await handleCommand('/prompt', makeCtx());

      expect(result).toEqual({ type: 'continue' });
    });

    test('returns continue when user exits selector with null', async () => {
      mockedInteractiveSelect.mockResolvedValue(null);

      const result = await handleCommand('/prompt', makeCtx());

      expect(result).toEqual({ type: 'continue' });
    });

    test('shows message when no prompts available', async () => {
      const ctx = makeCtx({ prompts: [] });

      const output = await captureOutput(async () => {
        const result = await handleCommand('/prompt', ctx);
        expect(result).toEqual({ type: 'continue' });
      });

      expect(output).toContain('No custom prompts found');
      expect(mockedInteractiveSelect).not.toHaveBeenCalled();
    });

    test('uses (no description) as meta when prompt has no description', async () => {
      const promptsNoDesc: CustomPrompt[] = [
        {
          name: 'NoDesc',
          content: 'Some content',
          path: '',
          isDefault: false,
        },
      ];
      mockedInteractiveSelect.mockResolvedValue('NoDesc');

      await handleCommand('/prompt', makeCtx({ prompts: promptsNoDesc }));

      expect(mockedInteractiveSelect).toHaveBeenCalledWith(
        'Available Prompts',
        [{ label: 'NoDesc', value: 'NoDesc', meta: '(no description)' }],
        0
      );
    });

    test('/p alias also opens interactive selector', async () => {
      mockedInteractiveSelect.mockResolvedValue('Simplify');

      const result = await handleCommand('/p', makeCtx());

      expect(result).toEqual({
        type: 'send',
        message: 'Look at this plan with fresh eyes and simplify.',
      });
    });
  });

  describe('direct usage (/prompt <name>)', () => {
    test('returns send result with matching prompt content', async () => {
      const result = await handleCommand('/prompt Challenge', makeCtx());

      expect(result).toEqual({
        type: 'send',
        message: 'Challenge every assumption in this plan.',
      });
      expect(mockedInteractiveSelect).not.toHaveBeenCalled();
    });

    test('is case-insensitive', async () => {
      const result = await handleCommand('/prompt challenge', makeCtx());

      expect(result).toEqual({
        type: 'send',
        message: 'Challenge every assumption in this plan.',
      });
    });

    test('shows error for unknown prompt name', async () => {
      const output = await captureOutput(async () => {
        const result = await handleCommand('/prompt nonexistent', makeCtx());
        expect(result).toEqual({ type: 'continue' });
      });

      expect(output).toContain('Unknown prompt');
    });
  });
});
