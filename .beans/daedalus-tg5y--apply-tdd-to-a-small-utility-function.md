---
# daedalus-tg5y
title: Apply TDD to a small utility function
status: todo
type: task
priority: normal
created_at: 2026-01-28T22:22:03Z
updated_at: 2026-01-28T22:22:27Z
parent: daedalus-st1s
blocking:
    - daedalus-654q
---

Use TDD to build a utility function (e.g., slug generation) in src/utils/string-helpers.ts. Demonstrate complete red-green-refactor cycle with tests in src/utils/string-helpers.test.ts.

## Prerequisites
- Testing framework configured (daedalus-gsj7)

## Purpose
Provide a concrete example of TDD in practice by building a real utility function that the project can use.

## Suggested Function: Slug Generation
Build a function that converts titles to URL-safe slugs:
- "My Feature Title" → "my-feature-title"
- "Fix Bug #123" → "fix-bug-123"
- "Add CLI Support" → "add-cli-support"

## TDD Process to Follow
1. **Red**: Write failing test for basic slug conversion
2. **Green**: Write minimal implementation to pass
3. **Refactor**: Clean up implementation
4. **Red**: Add test for edge case (special characters)
5. **Green**: Handle special characters
6. **Refactor**: Optimize and clean
7. Continue cycle for additional requirements

## Requirements to Test-Drive
- Basic string to slug conversion
- Handle special characters and punctuation
- Handle multiple spaces and whitespace
- Handle empty strings and edge cases
- Handle Unicode characters
- Maximum length limits

## Deliverables
- `src/utils/string-helpers.ts` - Utility functions
- `src/utils/string-helpers.test.ts` - Comprehensive tests
- Clear commit history showing TDD steps

## Checklist
- [ ] Create src/utils directory
- [ ] Write first failing test (basic slug conversion)
- [ ] Implement minimal code to pass
- [ ] Refactor implementation
- [ ] Add test for special characters
- [ ] Extend implementation
- [ ] Add tests for edge cases
- [ ] Final refactor and cleanup
- [ ] Document the TDD process used