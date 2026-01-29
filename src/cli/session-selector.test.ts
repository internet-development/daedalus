/**
 * Tests for Session Selector
 *
 * Tests the session selection logic including exit behavior.
 * The interactive UI (raw stdin) is not tested here - we test
 * the public selectSession function's behavior and type contract.
 */
import { describe, test, expect } from 'vitest';
import type { SessionSelection } from './session-selector.js';
import { selectSession } from './session-selector.js';

// =============================================================================
// Type Contract Tests
// =============================================================================

describe('SessionSelection type', () => {
  test('supports exit action', () => {
    // The SessionSelection type must support 'exit' as an action
    // so that pressing 'q' can signal the caller to exit the app
    const selection: SessionSelection = { action: 'exit' };
    expect(selection.action).toBe('exit');
  });

  test('supports continue action with sessionId', () => {
    const selection: SessionSelection = {
      action: 'continue',
      sessionId: 'test-123',
    };
    expect(selection.action).toBe('continue');
    expect(selection.sessionId).toBe('test-123');
  });

  test('supports new action', () => {
    const selection: SessionSelection = { action: 'new' };
    expect(selection.action).toBe('new');
  });
});

// =============================================================================
// selectSession behavior tests
// =============================================================================

describe('selectSession', () => {
  test('returns new action when no sessions exist', async () => {
    // With empty sessions, should return 'new' without prompting
    const result = await selectSession([], null);
    expect(result).toEqual({ action: 'new' });
  });
});
