---
# daedalus-zoeb
title: Add integration tests for CLI commands
status: todo
type: task
priority: high
created_at: 2026-01-28T22:20:48Z
updated_at: 2026-01-29T01:04:00Z
parent: daedalus-st1s
blocking:
    - daedalus-lygk
---

Write integration tests for CLI command handlers using real command execution, following TDD principles.

## Prerequisites
- Testing framework configured (daedalus-gsj7)
- TDD skill guidelines understood

## TDD Principle: Test Real Behavior

**From TDD skill:**
> "Tests use real code (mocks only if unavoidable)"

**NO MOCKING.** We will:
- Test actual CLI command handlers
- Use real argument parsing
- Verify real output and behavior
- Test integration with actual beans CLI

## Testing Strategy

### Integration Tests for CLI Commands

Test commands by invoking them directly:

```typescript
// Test the actual command handler
test('/tree command displays bean hierarchy', async () => {
  await withTestBeansDir(async (dir) => {
    // Setup: Create test beans
    await createTestBean(dir, {
      id: 'parent-1',
      title: 'Parent Bean',
      type: 'epic'
    });
    await createTestBean(dir, {
      id: 'child-1',
      title: 'Child Bean',
      type: 'feature',
      parent: 'parent-1'
    });
    
    // Execute: Run actual command
    const output = await captureOutput(() => {
      return handleTreeCommand({ beansDir: dir });
    });
    
    // Verify: Check real output
    expect(output).toContain('Parent Bean');
    expect(output).toContain('Child Bean');
    expect(output).toMatch(/└─.*Child Bean/);
  });
});
```

### Test Utilities for CLI Testing

**NOT mocks** - helpers for testing real CLI behavior:

```typescript
// src/test-utils/cli-helpers.ts

/** Captures stdout/stderr during command execution */
export async function captureOutput(
  fn: () => Promise<void>
): Promise<string> {
  const originalWrite = process.stdout.write;
  let output = '';
  
  process.stdout.write = (chunk: any) => {
    output += chunk.toString();
    return true;
  };
  
  try {
    await fn();
    return output;
  } finally {
    process.stdout.write = originalWrite;
  }
}

/** Captures exit code from command */
export async function captureExitCode(
  fn: () => Promise<void>
): Promise<number> {
  const originalExit = process.exit;
  let exitCode = 0;
  
  (process.exit as any) = (code: number) => {
    exitCode = code;
    throw new Error(`Process.exit(${code})`); // Prevent actual exit
  };
  
  try {
    await fn();
    return exitCode;
  } catch (e: any) {
    if (e.message.startsWith('Process.exit')) {
      return exitCode;
    }
    throw e;
  } finally {
    process.exit = originalExit;
  }
}

/** Runs command with test beans directory */
export async function runCommandWithTestBeans<T>(
  command: (ctx: CommandContext) => Promise<T>,
  setup?: (dir: string) => Promise<void>
): Promise<T> {
  return withTestBeansDir(async (dir) => {
    if (setup) await setup(dir);
    
    const ctx: CommandContext = {
      beansDir: dir,
      // ... other context
    };
    
    return command(ctx);
  });
}
```

## Test Coverage Areas

### Command Handlers
1. **handleTreeCommand()** - Display bean hierarchy
   - Empty directory shows appropriate message
   - Single bean displays correctly
   - Parent-child relationships shown with tree structure
   - Filtering by status/type works

2. **handleStatusCommand()** - Show status summary
   - Counts beans by status
   - Shows breakdown by type
   - Empty directory handled

3. **handleNewCommand()** - Create new bean
   - Creates bean file with correct data
   - Returns bean ID
   - Validates required fields

### Argument Parsing
Test real argument parsing, not mocked args:

```typescript
test('parses --status filter argument', () => {
  const args = parseArgs(['--status', 'todo', 'in-progress']);
  expect(args.status).toEqual(['todo', 'in-progress']);
});

test('parses -t shorthand for --type', () => {
  const args = parseArgs(['-t', 'bug']);
  expect(args.type).toEqual(['bug']);
});
```

### Error Handling
- Invalid arguments show helpful error
- Missing required args show usage
- Invalid bean IDs show clear message

## Test Structure

```typescript
describe('CLI Commands', () => {
  describe('/tree command', () => {
    test('shows empty message for no beans', async () => {
      const output = await runCommandWithTestBeans(handleTreeCommand);
      expect(output).toContain('No beans found');
    });
    
    test('displays bean hierarchy', async () => {
      const output = await runCommandWithTestBeans(
        handleTreeCommand,
        async (dir) => {
          await createTestBean(dir, { title: 'Parent' });
          await createTestBean(dir, { title: 'Child', parent: 'parent-id' });
        }
      );
      
      expect(output).toContain('Parent');
      expect(output).toContain('Child');
    });
  });
});
```

## Why No Mocking?

**Testing real CLI commands:**
- ✅ Verifies actual user experience
- ✅ Tests real argument parsing
- ✅ Catches output formatting bugs
- ✅ Validates integration with beans CLI

**Mocking would:**
- ❌ Miss real CLI bugs
- ❌ Test mock behavior, not user experience
- ❌ Require maintaining mock args

## Files to Create
- `src/cli/commands.test.ts` - Integration tests for command handlers
- `src/test-utils/cli-helpers.ts` - CLI testing utilities (NOT mocks)

## TDD Process

1. **RED**: Write test for command behavior
2. **Verify RED**: Watch test fail (command doesn't exist yet)
3. **GREEN**: Implement command handler
4. **Verify GREEN**: Watch test pass
5. **REFACTOR**: Clean up command implementation

## Checklist
- [ ] Create cli-helpers.ts with captureOutput()
- [ ] Create captureExitCode() helper
- [ ] Create runCommandWithTestBeans() helper
- [ ] RED: Test /tree with empty directory (watch fail)
- [ ] GREEN: Implement to pass
- [ ] RED: Test /tree with hierarchy (watch fail)
- [ ] GREEN: Implement to pass
- [ ] RED: Test argument parsing (watch fail)
- [ ] GREEN: Implement to pass
- [ ] RED: Test error handling (watch fail)
- [ ] GREEN: Implement to pass
- [ ] REFACTOR: Clean up duplication
- [ ] Verify all tests use real commands, no mocks