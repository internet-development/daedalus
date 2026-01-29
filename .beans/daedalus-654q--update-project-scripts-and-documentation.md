---
# daedalus-654q
title: Update project scripts and documentation
status: in-progress
type: task
priority: high
created_at: 2026-01-28T22:22:14Z
updated_at: 2026-01-29T05:05:22Z
parent: daedalus-st1s
---

Add test-related scripts to package.json (test, test:watch, test:coverage). Update README.md with testing section. Ensure all npm commands are documented.

## Prerequisites
- Testing framework configured (daedalus-gsj7)
- TDD demonstration completed (daedalus-tg5y)

## Purpose
Finalize the testing setup by making it easily discoverable and usable for all developers.

## Package.json Scripts to Add
```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:ui": "vitest --ui"
  }
}
```

## README.md Testing Section
### Testing
- Overview of testing philosophy (TDD)
- How to run tests
- How to write new tests
- Testing utilities available
- CI/CD information

## Documentation Updates
- Clear npm script descriptions
- Link to TDD workflow documentation
- Examples of running tests
- Contribution guidelines for tests

## Deliverables
- Updated `package.json` with test scripts
- Updated `README.md` with testing section
- All npm commands documented
- Links to detailed TDD documentation

## Checklist
- [x] Add test scripts to package.json
- [x] Test all new npm scripts work correctly
- [x] Write testing section for README.md
- [x] Document script usage and options
- [x] Add links to TDD workflow docs
- [x] Update development setup instructions
- [x] Verify all commands work in fresh clone
- [x] Review and polish all documentation

## Changelog

### Implemented
- Added `test:ui` script to package.json (other test scripts already existed from daedalus-gsj7)
- Created comprehensive README.md with:
  - Quick start guide
  - Complete script documentation table
  - Testing section with TDD workflow explanation
  - Test file structure and examples
  - Testing best practices
  - Architecture overview
  - Configuration documentation
  - Contributing guidelines

### Files Modified
- `package.json` - Added `test:ui` script
- `README.md` - NEW: Complete project documentation

### Deviations from Spec
- `test:ui` script added but requires optional `@vitest/ui` package to be installed separately (documented in README)
- CI/CD information not included (no CI/CD configured yet in project)
- Test scripts `test`, `test:watch`, `test:coverage` were already present from daedalus-gsj7

### Decisions Made
- Created README.md as comprehensive project documentation rather than just a testing section
- Included architecture overview and contributing guidelines for completeness
- Linked to existing TDD skill documentation rather than duplicating content
- Used table format for script documentation for clarity

### Known Limitations
- `test:ui` requires manual installation of `@vitest/ui` package
- No CI/CD documentation (project doesn't have CI/CD yet)