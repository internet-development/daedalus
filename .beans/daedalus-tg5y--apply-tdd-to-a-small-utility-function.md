---
# daedalus-tg5y
title: Apply TDD to a small utility function
status: in-progress
type: task
priority: high
created_at: 2026-01-28T22:22:03Z
updated_at: 2026-01-29T03:06:03Z
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
- [x] Create src/utils directory
- [x] Write first failing test (basic slug conversion)
- [x] Implement minimal code to pass
- [x] Refactor implementation
- [x] Add test for special characters
- [x] Extend implementation
- [x] Add tests for edge cases
- [x] Final refactor and cleanup
- [x] Document the TDD process used

## Changelog

### Implemented
- Created `toSlug()` function that converts strings to URL-safe slugs
- Followed strict TDD Red-Green-Refactor cycle with 5 commits showing progression
- Comprehensive test suite with 8 test cases covering all requirements

### Files Modified
- `src/utils/string-helpers.ts` - NEW: Slug generation utility with `toSlug()` function
- `src/utils/string-helpers.test.ts` - NEW: Comprehensive test suite (8 tests)

### TDD Process Demonstrated
1. **Cycle 1**: Basic slug conversion (spaces to hyphens, lowercase)
2. **Cycle 2**: Special characters removal (#, !, ?, etc.)
3. **Cycle 3**: Whitespace handling (multiple spaces, tabs, newlines, trim)
4. **Cycle 4**: Unicode handling and maxLength option with word boundary truncation
5. **Cycle 5**: Additional edge cases (existing hyphens, numbers)

### Deviations from Spec
- None - implemented exactly as specified

### Decisions Made
- Used simple ASCII-only approach for Unicode (strips non-ASCII chars) - keeps implementation simple and predictable
- maxLength truncates at word boundaries when possible (>50% of target length) for cleaner slugs
- Added `SlugOptions` interface for extensibility

### Known Limitations
- Unicode characters are stripped rather than transliterated (e.g., "café" becomes "caf" not "cafe")
- Could add transliteration in future if needed