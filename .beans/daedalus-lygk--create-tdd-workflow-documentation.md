---
# daedalus-lygk
title: Create TDD workflow documentation
status: todo
type: task
priority: high
created_at: 2026-01-28T22:21:49Z
updated_at: 2026-01-29T01:04:00Z
parent: daedalus-st1s
---

Document red-green-refactor process in docs/tdd-workflow.md with examples from CLI and beans client tests. Update CONTRIBUTING.md with testing guidelines.

## Prerequisites
- CLI testing utilities created (daedalus-zoeb)
- Beans client testing utilities created (daedalus-516s)
- Process mocking utilities created (daedalus-uzth)

## Purpose
Provide clear guidance for developers on how to follow TDD practices in the Daedalus codebase, with concrete examples.

## Deliverables
- `docs/tdd-workflow.md` - Complete TDD guide
- Updated `CONTRIBUTING.md` with testing section
- Code examples from actual test files

## Documentation Sections
### TDD Process
- Red-Green-Refactor cycle explanation
- When to write tests vs when to refactor
- How to write good test descriptions

### Testing Patterns
- CLI function testing examples
- Process mocking examples
- Configuration testing patterns
- Error handling test strategies

### Project-Specific Guidelines
- Testing utilities usage
- File naming conventions
- Test organization patterns
- Mock vs integration test decisions

## Examples to Include
- Complete TDD cycle from CLI tests
- Beans client mocking example
- Configuration validation testing
- Error case testing patterns

## Checklist
- [ ] Write TDD process overview
- [ ] Document red-green-refactor with examples
- [ ] Include CLI testing patterns
- [ ] Include mocking patterns
- [ ] Document test organization
- [ ] Update CONTRIBUTING.md
- [ ] Add testing section to main README
- [ ] Review and refine documentation