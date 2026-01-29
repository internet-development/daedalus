# Daedalus

Agentic coding orchestration platform that manages AI agents to execute development work through a bean-driven task system.

## Quick Start

```bash
npm install          # Install dependencies
npm run dev          # Start development mode
npm run build        # Compile TypeScript
npm run start        # Run compiled version
```

## Development

### Available Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `npm run dev` | `tsx src/cli/index.ts` | Start with tsx for development |
| `npm run build` | `tsc` | Compile TypeScript to `dist/` |
| `npm run start` | `node dist/cli/index.js` | Run compiled version |
| `npm run typecheck` | `tsc --noEmit` | Type check without emitting files |
| `npm test` | `vitest run` | Run all tests once |
| `npm run test:watch` | `vitest` | Run tests in watch mode |
| `npm run test:coverage` | `vitest run --coverage` | Run tests with coverage report |
| `npm run test:ui` | `vitest --ui` | Open Vitest UI (requires `@vitest/ui`) |

## Testing

This project follows **Test-Driven Development (TDD)** practices. All new features and bug fixes should be developed using the Red-Green-Refactor cycle.

### Running Tests

```bash
# Run all tests once
npm test

# Watch mode - re-runs tests on file changes (recommended for TDD)
npm run test:watch

# Generate coverage report
npm run test:coverage

# Open Vitest UI (requires: npm install -D @vitest/ui)
npm run test:ui
```

### Writing Tests

Tests are co-located with source files using the `.test.ts` suffix:

```
src/
  utils/
    string-helpers.ts
    string-helpers.test.ts    # Tests for string-helpers
  config/
    index.ts
    index.test.ts             # Tests for config
```

#### Test File Structure

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

### TDD Workflow

Follow the **Red-Green-Refactor** cycle:

1. **RED** - Write a failing test that describes the desired behavior
2. **Verify RED** - Run the test and confirm it fails for the expected reason
3. **GREEN** - Write the minimal code to make the test pass
4. **Verify GREEN** - Run the test and confirm it passes
5. **REFACTOR** - Clean up the code while keeping tests green
6. **Repeat** - Move to the next behavior

**Core principle:** If you didn't watch the test fail, you don't know if it tests the right thing.

For detailed TDD guidelines, see [docs/tdd-workflow.md](docs/tdd-workflow.md).

### Testing Best Practices

- **Test behavior, not implementation** - Focus on what the code does, not how
- **One assertion per test** - Keep tests focused and clear
- **Use real code** - Avoid mocks unless absolutely necessary (external APIs, file system)
- **Descriptive test names** - Test names should describe the expected behavior
- **Co-locate tests** - Keep test files next to the code they test

### Test Utilities

The project includes test utilities in `src/test-utils/`:

| Utility | Purpose |
|---------|---------|
| `beans-fixtures.ts` | Create real bean files for testing |
| `cli-helpers.ts` | Capture CLI output and exit codes |
| `event-helpers.ts` | Test EventEmitter-based code |
| `async-helpers.ts` | Wait for conditions and delays |
| `fs-helpers.ts` | Temporary directories and file operations |

See [docs/tdd-workflow.md](docs/tdd-workflow.md) for usage examples.

## Architecture

### Project Structure

```
src/
  cli/              # CLI entry point and commands
  talos/            # Daemon core (orchestration)
  ui/               # Ink UI components
  config/           # Configuration loading
  planning/         # Planning agent system
  utils/            # Shared utilities
```

### Key Concepts

- **Beans** - Task specifications stored as markdown files in `.beans/`
- **Talos** - The daemon that watches beans and spawns agents
- **Event-driven** - Components communicate via EventEmitter

For detailed architecture documentation, see [CLAUDE.md](CLAUDE.md).

## Configuration

Configuration is loaded from `talos.yml`:

```yaml
agent:
  backend: opencode  # Agent backend (opencode, claude, codex)

scheduler:
  maxConcurrent: 1   # Parallel agent limit

planning_agent:
  provider: claude_code  # Planning provider
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines on:

- Development workflow with beans
- TDD practices and test utilities
- Code style and conventions
- Pull request process

## Documentation

| Document | Description |
|----------|-------------|
| [CONTRIBUTING.md](CONTRIBUTING.md) | Development workflow and guidelines |
| [docs/tdd-workflow.md](docs/tdd-workflow.md) | TDD practices with examples |
| [docs/planning-workflow.md](docs/planning-workflow.md) | Planning and brainstorming workflow |
| [AGENTS.md](AGENTS.md) | Guidelines for AI coding agents |

## License

MIT
