# TDD Workflow Guide

This guide covers Test-Driven Development practices in Daedalus, with concrete examples from the codebase.

## Overview

Daedalus follows **Test-Driven Development (TDD)** for all new features and bug fixes. The core principle:

> **If you didn't watch the test fail, you don't know if it tests the right thing.**

TDD isn't about having tests - it's about using tests to drive design and prove correctness.

## The Red-Green-Refactor Cycle

Every piece of production code follows this cycle:

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   ┌─────────┐     ┌─────────┐     ┌───────────┐            │
│   │   RED   │────▶│  GREEN  │────▶│ REFACTOR  │────┐       │
│   │  Write  │     │ Minimal │     │  Clean up │    │       │
│   │ failing │     │  code   │     │           │    │       │
│   │  test   │     │ to pass │     │           │    │       │
│   └─────────┘     └─────────┘     └───────────┘    │       │
│        ▲                                           │       │
│        └───────────────────────────────────────────┘       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 1. RED - Write a Failing Test

Write a test that describes the behavior you want. Run it. Watch it fail.

**Requirements:**
- Test one behavior only
- Use a clear, descriptive name
- Test real code (avoid mocks unless necessary)

**Example from CLI tests:**

```typescript
// src/cli/commands.test.ts
test('shows empty message for no beans', async () => {
  const output = await runTreeWithBeans();
  expect(output).toContain('No active beans found');
});
```

This test:
- Has a clear name describing expected behavior
- Tests one thing (empty state message)
- Uses real command execution

### 2. Verify RED - Confirm the Failure

**MANDATORY. Never skip this step.**

```bash
npm test src/cli/commands.test.ts
```

Confirm:
- The test **fails** (not errors)
- The failure message is what you expect
- It fails because the feature is missing (not typos)

**If the test passes immediately:** You're testing existing behavior. Rewrite the test.

**If the test errors:** Fix the error, re-run until it fails correctly.

### 3. GREEN - Write Minimal Code

Write the simplest code that makes the test pass. Nothing more.

**Good:**
```typescript
if (beans.length === 0) {
  console.log('No active beans found');
  return;
}
```

**Bad:**
```typescript
if (beans.length === 0) {
  console.log('No active beans found');
  // Also log to file for debugging
  await fs.appendFile('debug.log', 'Empty beans list\n');
  // Send analytics event
  analytics.track('empty_beans');
  return;
}
```

Don't add features, refactor other code, or "improve" beyond what the test requires.

### 4. Verify GREEN - Confirm the Pass

**MANDATORY.**

```bash
npm test src/cli/commands.test.ts
```

Confirm:
- The test passes
- Other tests still pass
- No warnings or errors in output

**If the test fails:** Fix the code, not the test.

**If other tests fail:** Fix them now before continuing.

### 5. REFACTOR - Clean Up

Only after tests are green:
- Remove duplication
- Improve names
- Extract helpers

Keep tests green throughout. Don't add new behavior during refactoring.

### 6. Repeat

Move to the next failing test for the next behavior.

## Writing Good Tests

### Test Names

Test names should describe the expected behavior:

| Good | Bad |
|------|-----|
| `'shows empty message for no beans'` | `'test1'` |
| `'displays parent-child hierarchy'` | `'tree works'` |
| `'rejects empty email'` | `'validation'` |

### One Assertion Per Test

Keep tests focused. If you have "and" in your test name, split it:

**Bad:**
```typescript
test('validates email and password and username', () => {
  // Too many things
});
```

**Good:**
```typescript
test('rejects empty email', () => { /* ... */ });
test('rejects short password', () => { /* ... */ });
test('rejects invalid username characters', () => { /* ... */ });
```

### Test Behavior, Not Implementation

Focus on what the code does, not how it does it:

**Good:**
```typescript
test('retries failed operations 3 times', async () => {
  let attempts = 0;
  const operation = () => {
    attempts++;
    if (attempts < 3) throw new Error('fail');
    return 'success';
  };

  const result = await retryOperation(operation);

  expect(result).toBe('success');
  expect(attempts).toBe(3);
});
```

**Bad:**
```typescript
test('retry works', async () => {
  const mock = jest.fn()
    .mockRejectedValueOnce(new Error())
    .mockResolvedValueOnce('success');
  await retryOperation(mock);
  expect(mock).toHaveBeenCalledTimes(2);
});
```

The good test verifies real behavior. The bad test verifies mock behavior.

## Testing Patterns in Daedalus

### CLI Command Testing

Use the test utilities to test CLI commands with real beans:

```typescript
import {
  captureOutput,
  withTestBeansDir,
  createTestBean,
} from '../test-utils/index.js';
import { runTree } from './tree-simple.js';

test('displays single bean correctly', async () => {
  let beanId: string;
  
  const output = await withTestBeansDir(async (dir) => {
    // Create real test data
    beanId = await createTestBean(dir, {
      title: 'Test Bean',
      type: 'task',
      status: 'todo',
    });
    
    // Capture real command output
    return captureOutput(async () => {
      await runTree({ args: [], cwd: dir });
    });
  });

  expect(output).toContain('Test Bean');
  expect(output).toContain(beanId!);
});
```

Key patterns:
- `withTestBeansDir()` creates an isolated beans directory
- `createTestBean()` creates real bean files
- `captureOutput()` captures real console output
- Cleanup happens automatically

### Configuration Testing

Test configuration loading with real files:

```typescript
import { loadConfigFromFile, getDefaultConfig } from './index.js';

describe('loadConfigFromFile', () => {
  it('loads a valid complete configuration file', () => {
    const configPath = join(FIXTURES_DIR, 'valid-config.yml');
    const config = loadConfigFromFile(configPath);

    expect(config.agent.backend).toBe('claude');
    expect(config.scheduler.max_parallel).toBe(2);
  });

  it('handles missing configuration file by returning defaults', () => {
    const config = loadConfigFromFile('/nonexistent/path/to/talos.yml');
    
    expect(config.agent.backend).toBe('claude'); // default
    expect(config.scheduler.max_parallel).toBe(1); // default
  });
});
```

Key patterns:
- Use fixture files for valid configurations
- Test error handling with invalid/missing files
- Verify defaults are applied correctly

### Error Handling Tests

Test error cases explicitly:

```typescript
describe('schema validation errors', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('returns defaults when schema validation fails', () => {
    const configPath = join(FIXTURES_DIR, 'invalid-schema.yml');
    const config = loadConfigFromFile(configPath);

    expect(config.agent.backend).toBe('claude'); // defaults
  });

  it('logs helpful error messages for validation failures', () => {
    const configPath = join(FIXTURES_DIR, 'invalid-schema.yml');
    loadConfigFromFile(configPath);

    expect(consoleSpy).toHaveBeenCalled();
    const errorOutput = consoleSpy.mock.calls.map(call => call.join(' ')).join('\n');
    expect(errorOutput).toContain('Configuration validation errors');
  });
});
```

Key patterns:
- Spy on console methods to verify error logging
- Always restore spies in `afterEach`
- Test both the return value and side effects

### EventEmitter Testing

Test event-driven code with real events:

```typescript
import { waitForEvent, collectEvents } from '../test-utils/index.js';

test('watcher detects new bean file', async () => {
  await withTestBeansDir(async (dir) => {
    const watcher = new BeansWatcher({ beansDir: dir });
    await watcher.start();

    // Wait for real event
    const eventPromise = waitForEvent(watcher, 'bean:created');

    // Create actual bean file
    await createTestBean(dir, { title: 'New Bean' });

    // Verify real event was emitted
    const event = await eventPromise;
    expect(event.title).toBe('New Bean');

    await watcher.stop();
  });
});
```

Key patterns:
- `waitForEvent()` waits for a single event with timeout
- `collectEvents()` collects all events during an operation
- Test with real file system operations

## Test Utilities Reference

### Beans Fixtures

```typescript
import {
  createTestBean,
  createTempBeansDir,
  cleanupTestBeans,
  withTestBeansDir,
  getBeansSubdir,
  type TestBeanData,
} from './test-utils/index.js';
```

| Function | Purpose |
|----------|---------|
| `createTestBean(dir, data)` | Create a real bean file |
| `createTempBeansDir()` | Create an isolated beans project |
| `cleanupTestBeans(dir)` | Remove test directory |
| `withTestBeansDir(fn)` | Run test with auto-cleanup |
| `getBeansSubdir(dir)` | Get `.beans` path for a project |

### CLI Helpers

```typescript
import {
  captureOutput,
  captureExitCode,
  runCommandWithTestBeans,
  runCommandAndCaptureOutput,
} from './test-utils/index.js';
```

| Function | Purpose |
|----------|---------|
| `captureOutput(fn)` | Capture console output |
| `captureExitCode(fn)` | Capture process.exit code |
| `runCommandWithTestBeans(cmd, setup)` | Run command with test data |
| `runCommandAndCaptureOutput(cmd, setup)` | Combined helper |

### Event Helpers

```typescript
import { waitForEvent, collectEvents } from './test-utils/index.js';
```

| Function | Purpose |
|----------|---------|
| `waitForEvent(emitter, event, timeout)` | Wait for single event |
| `collectEvents(emitter, event, fn)` | Collect events during operation |

### Async Helpers

```typescript
import { waitUntil, sleep } from './test-utils/index.js';
```

| Function | Purpose |
|----------|---------|
| `waitUntil(condition, timeout)` | Poll until condition is true |
| `sleep(ms)` | Delay for specified milliseconds |

### File System Helpers

```typescript
import { createTempDir, removeDir, readTestFile } from './test-utils/index.js';
```

| Function | Purpose |
|----------|---------|
| `createTempDir(prefix)` | Create temporary directory |
| `removeDir(path)` | Remove directory recursively |
| `readTestFile(path)` | Read file contents |

## Test Organization

### File Naming

Tests are co-located with source files using the `.test.ts` suffix:

```
src/
  cli/
    commands.ts
    commands.test.ts      # Tests for commands
  config/
    index.ts
    index.test.ts         # Tests for config
  talos/
    beans-client.ts
    beans-client.test.ts  # Unit tests
    beans-client.integration.test.ts  # Integration tests
```

### Test File Structure

```typescript
import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { myFunction } from './my-module.js';

// =============================================================================
// Test Helpers (if needed)
// =============================================================================

function createTestData() {
  // Helper functions at the top
}

// =============================================================================
// Tests
// =============================================================================

describe('myFunction', () => {
  describe('happy path', () => {
    test('handles basic case', () => {
      const result = myFunction('input');
      expect(result).toBe('expected');
    });
  });

  describe('error handling', () => {
    test('throws on invalid input', () => {
      expect(() => myFunction('')).toThrow('Invalid input');
    });
  });
});
```

### Integration vs Unit Tests

**Unit tests** (`.test.ts`):
- Test a single function or class
- Fast, isolated
- May use test utilities for setup

**Integration tests** (`.integration.test.ts`):
- Test multiple components together
- May use real external systems (beans CLI)
- Slower, but verify real behavior

Example from beans client:

```typescript
// beans-client.test.ts - Unit tests
describe('beans-client', () => {
  it('can spawn beans CLI and query beans', async () => {
    const beans = await listBeans();
    expect(Array.isArray(beans)).toBe(true);
  });
});

// beans-client.integration.test.ts - Integration tests
describe('beans-client integration', () => {
  it('creates and retrieves beans end-to-end', async () => {
    await withTestBeansDir(async (dir) => {
      // Full workflow test
    });
  });
});
```

## When to Use Mocks

**Prefer real code.** Only mock when:

1. **External APIs** - Network calls to third-party services
2. **Time-dependent code** - Use `vi.useFakeTimers()` for timeouts
3. **Console/process** - Spy on `console.error` or `process.exit`

**Never mock:**
- Your own code
- File system operations (use temp directories)
- The beans CLI (use real beans with test data)

### Mocking Console

```typescript
let consoleSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  consoleSpy.mockRestore();
});

test('logs error message', () => {
  doSomethingThatLogs();
  expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Error'));
});
```

### Mocking Time

```typescript
import { vi, beforeEach, afterEach } from 'vitest';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

test('retries after delay', async () => {
  const promise = retryWithDelay(operation);
  
  // Fast-forward time
  await vi.advanceTimersByTimeAsync(1000);
  
  const result = await promise;
  expect(result).toBe('success');
});
```

## Common Rationalizations (and Why They're Wrong)

| Excuse | Reality |
|--------|---------|
| "Too simple to test" | Simple code breaks. Test takes 30 seconds. |
| "I'll test after" | Tests passing immediately prove nothing. |
| "Already manually tested" | Ad-hoc ≠ systematic. No record, can't re-run. |
| "Deleting X hours is wasteful" | Sunk cost fallacy. Keeping unverified code is debt. |
| "TDD will slow me down" | TDD is faster than debugging. |

## Running Tests

```bash
# Run all tests once
npm test

# Watch mode (recommended for TDD)
npm run test:watch

# Run specific test file
npm test src/cli/commands.test.ts

# Generate coverage report
npm run test:coverage

# Open Vitest UI
npm run test:ui
```

## Verification Checklist

Before marking work complete:

- [ ] Every new function/method has a test
- [ ] Watched each test fail before implementing
- [ ] Each test failed for expected reason (feature missing, not typo)
- [ ] Wrote minimal code to pass each test
- [ ] All tests pass
- [ ] Output pristine (no errors, warnings)
- [ ] Tests use real code (mocks only if unavoidable)
- [ ] Edge cases and errors covered

Can't check all boxes? You skipped TDD. Start over.

## Related Documentation

- [README.md](/README.md) - Quick start and test commands
- [CONTRIBUTING.md](/CONTRIBUTING.md) - Development workflow
- [TDD Skill](../skills/beans-tdd-suggestion/SKILL.md) — Agent skill definition
