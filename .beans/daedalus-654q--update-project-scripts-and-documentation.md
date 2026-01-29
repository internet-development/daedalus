---
# daedalus-654q
title: Update project scripts and documentation
status: todo
type: task
priority: high
created_at: 2026-01-28T22:22:14Z
updated_at: 2026-01-29T01:04:00Z
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
- [ ] Add test scripts to package.json
- [ ] Test all new npm scripts work correctly
- [ ] Write testing section for README.md
- [ ] Document script usage and options
- [ ] Add links to TDD workflow docs
- [ ] Update development setup instructions
- [ ] Verify all commands work in fresh clone
- [ ] Review and polish all documentation