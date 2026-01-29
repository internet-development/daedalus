---
# daedalus-st1s
title: Adopt TDD workflow for new features
status: completed
type: epic
priority: high
created_at: 2026-01-28T22:15:23Z
updated_at: 2026-01-29T05:25:08Z
parent: daedalus-5k7n
---

Establish Test-Driven Development as the standard practice for all new feature work in Daedalus.

## Goal
Shift from ad-hoc development to disciplined TDD workflow to improve code quality and reduce bugs.

## Why TDD Now
- Current codebase has minimal test coverage
- New features are being added without tests
- Bugs are discovered late in development
- Refactoring is risky without test safety net

## Framework Decision: Vitest

After comprehensive research and critical review:
- ✅ **Vitest selected** over Jest and Bun
- ✅ Native ES module support for our setup
- ✅ Zero-config TypeScript integration
- ✅ Fast performance for TDD feedback loops
- ⚠️ Bun rejected - not mature enough, would require runtime change
- ⚠️ Jest would work but requires more configuration

## Critical Implementation Considerations

### **Must Address Before Autonomous Execution**
1. **Pin Vitest version** - Use exact version (1.6.0) not semver range
2. **Configure global timeout** - Default 10s too short for agent operations (use 60s)
3. **Validate child process spawning** - Write test for beans CLI before proceeding
4. **EventEmitter cleanup** - Prevent state leaks between tests
5. **Consider sequential execution** - Avoid spawning too many processes in parallel

### **Test Architecture Risks**
- Child process spawning (beans CLI, git, etc.) needs validation
- EventEmitter state can leak between tests
- Long-running agent tests need explicit timeouts
- Parallel test execution + process spawning = potential chaos

## Scope
- Set up testing infrastructure (Vitest)
- Create test utilities for common patterns
- Establish red-green-refactor workflow
- Document TDD practices for contributors
- Apply TDD to next 2-3 features as proof of concept

## Success Criteria
- Testing framework is configured and working
- Test utilities exist for common patterns (CLI commands, EventEmitters, process mocking)
- Developers can easily write and run tests
- New features follow TDD workflow
- Framework-agnostic test helpers support eventual Go migration

## Implementation Strategy
Start small with unit tests for core utilities, then expand to integration tests for CLI commands and eventually event-driven components.

## Checklist
- [x] Research and choose testing framework (Vitest selected)
- [x] Install and configure Vitest with critical recommendations
- [x] Create test utilities for CLI argument parsing
- [x] Create test utilities for beans client mocking
- [x] Create test utilities for process spawning
- [x] Add test coverage for configuration loading
- [x] Create TDD workflow documentation
- [x] Apply TDD to a small utility function as validation
- [x] Update project scripts and documentation

## Changelog

### Summary
Successfully established TDD as the standard practice for Daedalus with comprehensive testing infrastructure.

### Completed Work (via child tasks)

**daedalus-gsj7: Install and configure Vitest**
- Installed Vitest 1.6.0 and @vitest/coverage-v8 1.6.0 (pinned versions)
- Created vitest.config.ts with 60s timeout, Node environment, path aliases
- Added test scripts: `npm test`, `npm run test:watch`, `npm run test:coverage`
- Validated beans CLI spawning works in tests

**daedalus-516s: Beans client integration tests**
- Created `src/test-utils/beans-fixtures.ts` with real bean creation utilities
- Created `src/talos/beans-client.integration.test.ts` (12 tests)
- Tests use real beans CLI, no mocks

**daedalus-uzth: Test utilities for setup/cleanup**
- Created `src/test-utils/event-helpers.ts` - waitForEvent, collectEvents
- Created `src/test-utils/async-helpers.ts` - waitUntil, sleep
- Created `src/test-utils/fs-helpers.ts` - createTempDir, removeDir, readTestFile
- Created `src/test-utils/index.ts` - barrel export with documentation
- 46 tests covering all utilities

**daedalus-zoeb: CLI integration tests**
- Created `src/test-utils/cli-helpers.ts` - captureOutput, captureExitCode
- Created `src/cli/commands.test.ts` (16 tests)
- Added `cwd` option to `runTree()` for testability

**daedalus-8jrg: Configuration loading tests**
- Created `src/config/index.test.ts` (28 tests)
- Created test fixtures: valid-config.yml, minimal-config.yml, invalid-*.yml
- Comprehensive error handling coverage

**daedalus-tg5y: TDD demonstration**
- Created `src/utils/string-helpers.ts` with `toSlug()` function
- Created `src/utils/string-helpers.test.ts` (8 tests)
- Demonstrated complete Red-Green-Refactor cycle

**daedalus-lygk: TDD documentation**
- Created `docs/tdd-workflow.md` (603 lines) - comprehensive TDD guide
- Created `CONTRIBUTING.md` - development workflow guidelines
- Updated `README.md` with testing section

**daedalus-654q: Project scripts and documentation**
- Added `test:ui` script to package.json
- Comprehensive README.md with all scripts documented

### Test Coverage
- 10 test files
- 125 passing tests
- All tests run in ~1 second

### Files Created/Modified
- `vitest.config.ts` - Vitest configuration
- `package.json` - Test scripts and dependencies
- `src/test-utils/*.ts` - 5 utility modules + tests
- `src/utils/string-helpers.ts` - TDD demonstration
- `src/config/index.test.ts` - Config tests
- `src/talos/beans-client.*.test.ts` - Client tests
- `src/cli/commands.test.ts` - CLI tests
- `test/fixtures/*.yml` - Test configuration fixtures
- `docs/tdd-workflow.md` - TDD guide
- `CONTRIBUTING.md` - Contribution guidelines
- `README.md` - Updated documentation

### Success Criteria Met
- ✅ Testing framework configured and working (Vitest 1.6.0)
- ✅ Test utilities for CLI, EventEmitters, beans fixtures
- ✅ Developers can easily write and run tests
- ✅ TDD workflow documented with examples
- ✅ Framework-agnostic helpers (no Vitest-specific patterns in utilities)