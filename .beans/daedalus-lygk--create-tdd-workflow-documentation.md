---
# daedalus-lygk
title: Create TDD workflow documentation
status: completed
type: task
priority: high
created_at: 2026-01-28T22:21:49Z
updated_at: 2026-01-29T05:23:55Z
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
- [x] Write TDD process overview
- [x] Document red-green-refactor with examples
- [x] Include CLI testing patterns
- [x] Include mocking patterns
- [x] Document test organization
- [x] Update CONTRIBUTING.md
- [x] Add testing section to main README
- [x] Review and refine documentation

## Changelog

### Implemented
- Created comprehensive TDD workflow guide at `docs/tdd-workflow.md`
- Created CONTRIBUTING.md with development workflow and testing guidelines
- Updated README.md with improved test utilities section and documentation links

### Files Modified
- `docs/tdd-workflow.md` - NEW: Complete TDD guide with examples from codebase
- `CONTRIBUTING.md` - NEW: Development workflow and contribution guidelines
- `README.md` - Updated test utilities section and added documentation table

### Deviations from Spec
- None - all deliverables completed as specified

### Decisions Made
- Included ASCII diagram for Red-Green-Refactor cycle for visual clarity
- Organized test utilities reference as tables for quick scanning
- Added "Common Rationalizations" section from TDD skill for completeness
- Cross-referenced existing TDD skill file in related documentation

### Known Limitations
- Examples are based on current test files; may need updates as codebase evolves
- Some test utilities (like BeansWatcher) are referenced but not yet implemented