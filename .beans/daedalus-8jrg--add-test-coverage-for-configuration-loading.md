---
# daedalus-8jrg
title: Add test coverage for configuration loading
status: todo
type: task
priority: high
created_at: 2026-01-28T22:21:25Z
updated_at: 2026-01-29T01:04:00Z
parent: daedalus-st1s
---

Write comprehensive tests in src/config/index.test.ts for talos.yml loading and Zod validation. Cover happy path, missing files, invalid YAML, and schema validation errors.

## Prerequisites
- Testing framework configured (daedalus-gsj7)

## Configuration System
The config module loads talos.yml using Zod schema validation. This is critical infrastructure that needs thorough testing.

## Deliverables
- `src/config/index.test.ts` - Comprehensive config tests
- Test fixtures with various YAML configurations
- Error case coverage for invalid configs

## Test Scenarios
### Happy Path
- Valid talos.yml loads correctly
- Default values are applied when optional fields missing
- Environment variable substitution works

### Error Cases
- Missing talos.yml file
- Invalid YAML syntax
- Schema validation failures (wrong types, missing required fields)
- File permission errors

### Edge Cases
- Empty YAML file
- YAML with unknown fields
- Nested validation errors
- Very large configuration files

## Test Fixtures Needed
- `test/fixtures/valid-config.yml`
- `test/fixtures/invalid-syntax.yml`
- `test/fixtures/invalid-schema.yml`
- `test/fixtures/minimal-config.yml`

## Checklist
- [ ] Analyze current config loading implementation
- [ ] Create test fixtures directory and sample configs
- [ ] Write tests for successful config loading
- [ ] Test default value application
- [ ] Test schema validation error handling
- [ ] Test file system error handling
- [ ] Test YAML parsing error handling
- [ ] Verify error messages are helpful