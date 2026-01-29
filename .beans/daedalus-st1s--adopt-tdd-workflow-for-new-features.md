---
# daedalus-st1s
title: Adopt TDD workflow for new features
status: in-progress
type: epic
priority: high
created_at: 2026-01-28T22:15:23Z
updated_at: 2026-01-29T00:52:44Z
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
- [ ] Install and configure Vitest with critical recommendations
- [ ] Create test utilities for CLI argument parsing
- [ ] Create test utilities for beans client mocking
- [ ] Create test utilities for process spawning
- [ ] Add test coverage for configuration loading
- [ ] Create TDD workflow documentation
- [ ] Apply TDD to a small utility function as validation
- [ ] Update project scripts and documentation