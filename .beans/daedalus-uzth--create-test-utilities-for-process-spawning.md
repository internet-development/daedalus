---
# daedalus-uzth
title: Add test utilities for test setup and cleanup
status: todo
type: task
priority: high
created_at: 2026-01-28T22:21:14Z
updated_at: 2026-01-29T01:04:00Z
parent: daedalus-st1s
blocking:
    - daedalus-lygk
---

Create reusable test utilities for setting up and cleaning up test environments, following TDD principles.

## Prerequisites
- Testing framework configured (daedalus-gsj7)
- TDD skill guidelines understood

## TDD Principle: Real Code, Not Mocks

**From TDD skill:**
> "Tests use real code (mocks only if unavoidable)"

**NO PROCESS MOCKING.** Instead, create utilities for:
- Setting up isolated test environments
- Creating real test data
- Cleaning up after tests
- Waiting for async operations

## Test Utilities Needed

### 1. Test Bean Fixtures

```typescript
// src/test-utils/beans-fixtures.ts

/** Creates a real bean file in test directory */
export async function createTestBean(
  dir: string,
  data: Partial<BeanData>
): Promise<string> {
  // Actually create bean file on disk
  // Return bean ID
}

/** Creates temporary beans directory for tests */
export async function createTempBeansDir(): Promise<string> {
  // Create isolated .beans directory
  // Return path
}

/** Removes test beans directory and all contents */
export async function cleanupTestBeans(dir: string): Promise<void> {
  // Recursively delete test directory
}

/** Runs test with isolated beans directory, auto-cleanup */
export async function withTestBeansDir<T>(
  fn: (dir: string) => Promise<T>
): Promise<T> {
  const dir = await createTempBeansDir();
  try {
    return await fn(dir);
  } finally {
    await cleanupTestBeans(dir);
  }
}
```

### 2. Event Testing Helpers

```typescript
// src/test-utils/event-helpers.ts

/** Waits for event to be emitted, returns event data */
export async function waitForEvent<T>(
  emitter: EventEmitter,
  event: string,
  timeout = 5000
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Event ${event} not emitted within ${timeout}ms`));
    }, timeout);
    
    emitter.once(event, (data: T) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

/** Collects all events emitted during async operation */
export async function collectEvents<T>(
  emitter: EventEmitter,
  event: string,
  fn: () => Promise<void>
): Promise<T[]> {
  const events: T[] = [];
  const handler = (data: T) => events.push(data);
  
  emitter.on(event, handler);
  try {
    await fn();
    return events;
  } finally {
    emitter.off(event, handler);
  }
}
```

### 3. Async Testing Utilities

```typescript
// src/test-utils/async-helpers.ts

/** Polls condition until true or timeout */
export async function waitUntil(
  condition: () => boolean | Promise<boolean>,
  timeout = 5000,
  interval = 100
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await condition()) return;
    await sleep(interval);
  }
  throw new Error(`Condition not met within ${timeout}ms`);
}

/** Sleep helper for tests */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

### 4. File System Test Helpers

```typescript
// src/test-utils/fs-helpers.ts

/** Creates temporary directory for test */
export async function createTempDir(prefix = 'test-'): Promise<string> {
  const tmpDir = path.join(os.tmpdir(), `${prefix}${Date.now()}`);
  await fs.mkdir(tmpDir, { recursive: true });
  return tmpDir;
}

/** Recursively removes directory */
export async function removeDir(dir: string): Promise<void> {
  await fs.rm(dir, { recursive: true, force: true });
}

/** Reads file and returns content */
export async function readTestFile(path: string): Promise<string> {
  return fs.readFile(path, 'utf-8');
}
```

## Why These Utilities, Not Mocks?

**These utilities:**
- ✅ Create real test data
- ✅ Set up real test environments
- ✅ Enable testing actual behavior
- ✅ Clean up after tests

**NOT mocks because:**
- ❌ Don't fake behavior
- ❌ Don't intercept calls
- ❌ Don't stub out real code

## Usage Example

```typescript
test('watcher detects new bean file', async () => {
  await withTestBeansDir(async (dir) => {
    const watcher = new BeansWatcher({ beansDir: dir });
    await watcher.start();
    
    // Wait for 'bean:created' event
    const eventPromise = waitForEvent(watcher, 'bean:created');
    
    // Create actual bean file
    await createTestBean(dir, { title: 'New Bean' });
    
    // Verify real event was emitted
    const event = await eventPromise;
    expect(event.title).toBe('New Bean');
    
    await watcher.stop();
  });
  // Auto-cleanup happens here
});
```

## Files to Create
- `src/test-utils/beans-fixtures.ts` - Bean test data creation
- `src/test-utils/event-helpers.ts` - EventEmitter testing
- `src/test-utils/async-helpers.ts` - Async operation helpers
- `src/test-utils/fs-helpers.ts` - File system test helpers
- `src/test-utils/index.ts` - Export all utilities

## TDD Process for Each Utility

1. **RED**: Write test showing desired utility behavior
2. **Verify RED**: Watch test fail
3. **GREEN**: Implement minimal utility
4. **Verify GREEN**: Watch test pass
5. **REFACTOR**: Clean up

## Checklist
- [ ] RED: Test createTestBean() (watch fail)
- [ ] GREEN: Implement createTestBean()
- [ ] RED: Test withTestBeansDir() (watch fail)
- [ ] GREEN: Implement withTestBeansDir()
- [ ] RED: Test waitForEvent() (watch fail)
- [ ] GREEN: Implement waitForEvent()
- [ ] RED: Test collectEvents() (watch fail)
- [ ] GREEN: Implement collectEvents()
- [ ] RED: Test waitUntil() (watch fail)
- [ ] GREEN: Implement waitUntil()
- [ ] RED: Test file system helpers (watch fail)
- [ ] GREEN: Implement file system helpers
- [ ] REFACTOR: Remove duplication
- [ ] Document usage patterns with examples
- [ ] Verify all utilities tested with real behavior