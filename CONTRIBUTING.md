# Contributing to Daedalus

Thank you for your interest in contributing to Daedalus! This guide covers the development workflow and coding standards.

## Getting Started

```bash
# Clone the repository
git clone https://github.com/internet-development/daedalus.git
cd daedalus

# Install dependencies
npm install

# Run in development mode
npm run dev
```

## Development Workflow

### 1. Pick Up a Bean

Work is tracked as beans in the `.beans/` directory:

```bash
# List available work
beans query '{ beans(filter: { status: ["todo"], isBlocked: false }) { id title type } }'

# Read a bean's details
beans query '{ bean(id: "<id>") { title body } }'

# Start working on a bean
beans update <bean-id> --status in-progress
```

### 2. Follow TDD

**All new features and bug fixes must follow Test-Driven Development.**

The Red-Green-Refactor cycle:

1. **RED** — Write a failing test that describes the desired behavior
2. **Verify RED** — Run the test and confirm it fails for the expected reason
3. **GREEN** — Write the minimal code to make the test pass
4. **Verify GREEN** — Run the test and confirm it passes
5. **REFACTOR** — Clean up the code while keeping tests green
6. **Repeat** — Move to the next behavior

**Core principle:** If you didn't watch the test fail, you don't know if it tests the right thing.

For detailed TDD guidelines, see [docs/tdd-workflow.md](docs/tdd-workflow.md).

### 3. Run Tests

```bash
# Run all tests once
npm test

# Watch mode (recommended for TDD)
npm run test:watch

# Run specific test file
npm test src/cli/commands.test.ts

# Generate coverage report
npm run test:coverage
```

### 4. Type Check

```bash
npm run typecheck
```

### 5. Commit Changes

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```bash
# Feature
git commit -m "feat(cli): add tree command for bean visualization"

# Bug fix
git commit -m "fix(config): handle missing talos.yml gracefully"

# Tests
git commit -m "test(beans-client): add integration tests for query operations"

# Documentation
git commit -m "docs: add TDD workflow guide"
```

### 6. Complete the Bean

```bash
beans update <bean-id> --status completed
```

## Testing Guidelines

### Test File Location

Tests are co-located with source files:

```
src/
  cli/
    commands.ts
    commands.test.ts      # Tests for commands
  config/
    index.ts
    index.test.ts         # Tests for config
```

### Test File Structure

```typescript
import { describe, test, expect } from 'vitest';
import { myFunction } from './my-module.js';

describe('myFunction', () => {
  test('handles basic case', () => {
    const result = myFunction('input');
    expect(result).toBe('expected');
  });

  test('handles edge case', () => {
    expect(() => myFunction('')).toThrow('Invalid input');
  });
});
```

### Test Utilities

Use the provided test utilities instead of mocks:

```typescript
import {
  withTestBeansDir,
  createTestBean,
  captureOutput,
  waitForEvent,
} from '../test-utils/index.js';

test('displays bean in tree', async () => {
  const output = await withTestBeansDir(async (dir) => {
    await createTestBean(dir, { title: 'Test Bean', type: 'task' });
    return captureOutput(async () => {
      await runTree({ cwd: dir });
    });
  });
  
  expect(output).toContain('Test Bean');
});
```

### When to Mock

**Prefer real code.** Only mock when absolutely necessary:

- External APIs (network calls)
- Time-dependent code (`vi.useFakeTimers()`)
- Console/process spying

**Never mock:**
- Your own code
- File system (use temp directories)
- The beans CLI (use real beans)

## Code Style

### TypeScript

- Strict mode enabled
- ES modules with `.js` extensions in imports
- Zod for runtime validation

```typescript
// Good
import { myFunction } from './my-module.js';

// Bad
import { myFunction } from './my-module';
```

### Event-Driven Pattern

All daemon modules extend EventEmitter:

```typescript
import { EventEmitter } from 'events';

export class MyModule extends EventEmitter {
  doThing() {
    this.emit('thing:done', { data });
  }
}
```

## Project Structure

```
src/
  cli/              # CLI entry point and commands (readline-based)
  talos/            # Daemon core (orchestration)
  planning/         # Planning agent system
  config/           # Configuration loading
  utils/            # Shared utilities
  test-utils/       # Test utilities (NOT mocks)
```

## Pull Request Process

1. Create a feature branch from `main`
2. Follow TDD for all changes
3. Ensure all tests pass (`npm test`)
4. Ensure types check (`npm run typecheck`)
5. Write clear commit messages
6. Open a PR with a description of changes

## Questions?

- Check existing beans for context
- Read the [TDD workflow guide](docs/tdd-workflow.md)
- Review the [README](README.md) for project overview
