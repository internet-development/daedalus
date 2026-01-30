#!/usr/bin/env tsx
/**
 * Manual test script for session selector logic
 * 
 * Tests the defaultIndex calculation and option ordering.
 * Run with: npx tsx scripts/test-session-selector.ts
 */

import type { ChatSession } from '../src/planning/chat-history.js';

// Mock sessions for testing
const now = Date.now();
const mockSessions: ChatSession[] = [
  {
    id: 'session-1',
    name: 'Session 1',
    messages: [
      { role: 'user', content: 'msg1', timestamp: now - 3600000 },
      { role: 'assistant', content: 'msg2', timestamp: now - 3599000 },
    ],
    createdAt: now - 3600000, // 1 hour ago
    updatedAt: now - 3600000,
  },
  {
    id: 'session-2',
    name: 'Session 2',
    messages: [{ role: 'user', content: 'msg1', timestamp: now - 7200000 }],
    createdAt: now - 7200000, // 2 hours ago
    updatedAt: now - 7200000,
  },
  {
    id: 'session-3',
    name: 'Session 3',
    messages: [
      { role: 'user', content: 'msg1', timestamp: now - 1800000 },
      { role: 'assistant', content: 'msg2', timestamp: now - 1799000 },
      { role: 'user', content: 'msg3', timestamp: now - 1798000 },
    ],
    createdAt: now - 1800000, // 30 mins ago (most recent)
    updatedAt: now - 1800000,
  },
];

// Simulate the logic from session-selector.ts
function calculateDefaultIndex(
  sessions: ChatSession[],
  currentSessionId: string | null
): { options: string[]; defaultIndex: number } {
  if (sessions.length === 0) {
    return { options: ['Start new session'], defaultIndex: 0 };
  }

  // Sort sessions by updatedAt descending (most recent first)
  const sorted = [...sessions].sort((a, b) => b.updatedAt - a.updatedAt);

  // Build options - start with "new session" at top
  const options = ['Start new session', ...sorted.map((s) => s.name)];

  // Calculate default index
  let defaultIndex = 1; // Default to most recent session
  if (currentSessionId) {
    const currentIdx = sorted.findIndex((s) => s.id === currentSessionId);
    if (currentIdx >= 0) {
      defaultIndex = currentIdx + 1; // +1 because "new session" is at index 0
    }
  }

  return { options, defaultIndex };
}

// Test cases
console.log('Testing session selector logic...\n');

// Test 1: No sessions
console.log('Test 1: No sessions');
const test1 = calculateDefaultIndex([], null);
console.log('  Options:', test1.options);
console.log('  Default index:', test1.defaultIndex);
console.log('  Expected: defaultIndex = 0 (Start new session)');
console.log('  PASS:', test1.defaultIndex === 0 ? '✓' : '✗');
console.log();

// Test 2: Multiple sessions, no current session
console.log('Test 2: Multiple sessions, no current session');
const test2 = calculateDefaultIndex(mockSessions, null);
console.log('  Options:', test2.options);
console.log('  Default index:', test2.defaultIndex);
console.log('  Expected: defaultIndex = 1 (most recent session, Session 3)');
console.log('  PASS:', test2.defaultIndex === 1 && test2.options[1] === 'Session 3' ? '✓' : '✗');
console.log();

// Test 3: Multiple sessions, current session is most recent
console.log('Test 3: Multiple sessions, current session is most recent (session-3)');
const test3 = calculateDefaultIndex(mockSessions, 'session-3');
console.log('  Options:', test3.options);
console.log('  Default index:', test3.defaultIndex);
console.log('  Expected: defaultIndex = 1 (Session 3 is at index 1 after sorting)');
console.log('  PASS:', test3.defaultIndex === 1 && test3.options[1] === 'Session 3' ? '✓' : '✗');
console.log();

// Test 4: Multiple sessions, current session is NOT most recent
console.log('Test 4: Multiple sessions, current session is NOT most recent (session-2)');
const test4 = calculateDefaultIndex(mockSessions, 'session-2');
console.log('  Options:', test4.options);
console.log('  Default index:', test4.defaultIndex);
// After sorting by updatedAt: Session 3, Session 1, Session 2
// session-2 is at sorted index 2, so defaultIndex = 2 + 1 = 3
console.log('  Expected: defaultIndex = 3 (Session 2 is at sorted index 2, +1 for new session)');
console.log('  PASS:', test4.defaultIndex === 3 && test4.options[3] === 'Session 2' ? '✓' : '✗');
console.log();

// Test 5: Single session, is current
console.log('Test 5: Single session, is current');
const singleSession = [mockSessions[0]];
const test5 = calculateDefaultIndex(singleSession, 'session-1');
console.log('  Options:', test5.options);
console.log('  Default index:', test5.defaultIndex);
console.log('  Expected: defaultIndex = 1 (Session 1 is at index 1)');
console.log('  PASS:', test5.defaultIndex === 1 && test5.options[1] === 'Session 1' ? '✓' : '✗');
console.log();

// Test 6: Single session, not current
console.log('Test 6: Single session, not current');
const test6 = calculateDefaultIndex(singleSession, null);
console.log('  Options:', test6.options);
console.log('  Default index:', test6.defaultIndex);
console.log('  Expected: defaultIndex = 1 (most recent session)');
console.log('  PASS:', test6.defaultIndex === 1 ? '✓' : '✗');
console.log();

// Test 7: Verify "Start new session" is always first
console.log('Test 7: "Start new session" is always first');
const allTests = [test1, test2, test3, test4, test5, test6];
const allHaveNewFirst = allTests.every((t) => t.options[0] === 'Start new session');
console.log('  PASS:', allHaveNewFirst ? '✓' : '✗');
console.log();

// Summary
const allPassed = 
  test1.defaultIndex === 0 &&
  test2.defaultIndex === 1 && test2.options[1] === 'Session 3' &&
  test3.defaultIndex === 1 && test3.options[1] === 'Session 3' &&
  test4.defaultIndex === 3 && test4.options[3] === 'Session 2' &&
  test5.defaultIndex === 1 && test5.options[1] === 'Session 1' &&
  test6.defaultIndex === 1 &&
  allHaveNewFirst;

console.log('='.repeat(50));
console.log(allPassed ? 'ALL TESTS PASSED ✓' : 'SOME TESTS FAILED ✗');
console.log('='.repeat(50));

process.exit(allPassed ? 0 : 1);
