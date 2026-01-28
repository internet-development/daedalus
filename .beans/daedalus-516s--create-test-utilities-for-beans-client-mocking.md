---
# daedalus-516s
title: Add integration tests for beans client
status: todo
type: task
priority: normal
created_at: 2026-01-28T22:20:59Z
updated_at: 2026-01-28T23:10:51Z
parent: daedalus-st1s
blocking:
    - daedalus-lygk
---

Write integration tests for the BeansClient class using the real beans CLI, following TDD principles.

## Prerequisites
- Testing framework configured (daedalus-gsj7)
- TDD skill guidelines understood

## TDD Principle: Use Real Code

**From TDD skill:**
> "Tests use real code (mocks only if unavoidable)"

**NO MOCKING.** We will:
- Use the actual beans CLI (it's installed!)
- Test with real bean files in a test directory
- Clean up test beans after each test
- Verify actual behavior, not mock behavior

## Testing Strategy

### Integration Tests (Primary)
Test BeansClient with real beans CLI:

```typescript
test('getBeans returns actual beans from test directory', async () => {
  // Setup: Create test bean file
  const testBeansDir = 'test/fixtures/.beans';
  await createTestBean(testBeansDir, {
    title: 'Test Bean',
    type: 'task',
    status: 'todo'
  });
  
  // Execute: Use real BeansClient
  const client = new BeansClient({ beansDir: testBeansDir });
  const beans = await client.getBeans();
  
  // Verify: Check actual results
  expect(beans).toHaveLength(1);
  expect(beans[0].title).toBe('Test Bean');
  
  // Cleanup: Remove test beans
  await cleanupTestBeans(testBeansDir);
});
```

### Test Utilities (Not Mocks)

**Helper functions for test setup/cleanup:**
- `createTestBean(dir, data)` - Creates actual bean file
- `cleanupTestBeans(dir)` - Removes test beans directory
- `withTestBeansDir(fn)` - Runs test with isolated beans directory

**NOT mock utilities** - these create real beans for testing.

## Test Coverage Areas

### BeansClient Methods
1. **getBeans()** - Query with real beans CLI
   - Empty directory returns []
   - Single bean returns correct data
   - Multiple beans with filters
   - Invalid GraphQL query throws error

2. **updateStatus()** - Actually update bean files
   - Changes status on disk
   - Returns updated bean data
   - Invalid bean ID throws error

3. **createBean()** - Creates real bean files
   - File created with correct frontmatter
   - Returns created bean data
   - Invalid data throws error

### Error Handling
- beans CLI not found
- Invalid JSON response
- GraphQL errors
- File system errors

## Test Structure

```typescript
describe('BeansClient', () => {
  let testDir: string;
  let client: BeansClient;
  
  beforeEach(async () => {
    testDir = await createTempBeansDir();
    client = new BeansClient({ beansDir: testDir });
  });
  
  afterEach(async () => {
    await cleanupTestBeans(testDir);
  });
  
  test('getBeans with empty directory', async () => {
    const beans = await client.getBeans();
    expect(beans).toEqual([]);
  });
  
  test('getBeans returns created bean', async () => {
    await createTestBean(testDir, { title: 'Test' });
    const beans = await client.getBeans();
    expect(beans[0].title).toBe('Test');
  });
});
```

## Files to Create
- `src/talos/beans-client.test.ts` - Integration tests for BeansClient
- `src/test-utils/beans-fixtures.ts` - Test bean creation helpers (NOT mocks)
- `test/fixtures/.gitkeep` - Test fixtures directory

## Why No Mocking?

**Mocking beans CLI would:**
- ❌ Test mock behavior, not real CLI
- ❌ Miss actual CLI bugs or changes
- ❌ Create maintenance burden (mocks drift from reality)
- ❌ Give false confidence

**Using real beans CLI:**
- ✅ Tests actual integration
- ✅ Catches real bugs
- ✅ Validates CLI contract
- ✅ No mock maintenance

## Checklist
- [ ] Create test fixtures directory structure
- [ ] Write helper: createTestBean()
- [ ] Write helper: cleanupTestBeans()
- [ ] Write helper: withTestBeansDir()
- [ ] RED: Test getBeans() with empty directory (watch fail)
- [ ] GREEN: Implement to pass
- [ ] RED: Test getBeans() with single bean (watch fail)
- [ ] GREEN: Implement to pass
- [ ] RED: Test updateStatus() (watch fail)
- [ ] GREEN: Implement to pass
- [ ] RED: Test error handling (watch fail)
- [ ] GREEN: Implement to pass
- [ ] REFACTOR: Clean up duplication
- [ ] Verify all tests pass with real beans CLI