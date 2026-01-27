---
name: beans-tdd-suggestion
description: Suggest test-driven development patterns when breaking down work. Use alongside beans-breakdown to recommend test beans and blocker relationships that enable TDD workflows.
---

# Beans TDD Suggestion

A companion skill for beans-breakdown that recommends test-first development patterns.

## Purpose

This skill helps identify opportunities for test-driven development (TDD) during task breakdown. It does NOT enforce TDD - it suggests when tests-first might be valuable and lets the user decide.

## When to Suggest Tests

### Strong Indicators (Always Suggest)

**Bug Fixes**
- A regression test ensures the bug doesn't return
- The test captures the exact failure condition
- Example: "Before fixing, write a test that fails with current behavior"

**User-Facing Behavior**
- Public APIs that others depend on
- UI interactions that should be consistent
- Business logic with specific requirements

**Complex Logic**
- Algorithms with multiple code paths
- State machines or workflows
- Data transformations with specific rules

**Edge Cases in Requirements**
- "Must handle X gracefully"
- "Should work even when Y"
- Error conditions and recovery

### Moderate Indicators (Offer as Option)

**New Services/Classes**
- Tests help define the interface before implementation
- But sometimes exploration-first is more productive

**Refactoring**
- Tests protect existing behavior
- But sometimes behavior is already covered

**Performance-Critical Code**
- Benchmarks establish baseline
- But micro-benchmarks can be misleading

### Weak Indicators (Usually Skip)

**Configuration Changes**
- Tests often over-specify implementation details
- Better to test behavior that uses the config

**Pure Infrastructure**
- Docker, CI, tooling changes
- Often tested by "does it work" in practice

**Documentation**
- No behavior to test
- Linting catches most issues

## How to Structure Test Beans

### Test Bean Template

```markdown
---
title: "Test: [Feature/Module] [Aspect]"
type: task
status: todo
parent: <feature-bean-id>
---

## Purpose

This test verifies [specific behavior] to prevent [specific risk].

## Test Cases

- [ ] [Happy path case]
- [ ] [Another expected scenario]
- [ ] [Edge case that might break]
- [ ] [Error handling scenario]

## Setup

What fixtures, mocks, or test data are needed:
- [Fixture 1]
- [Mock for external service]

## Files

- `src/[path]/__tests__/[name].test.ts`

## Notes

[Any testing approach decisions or constraints]
```

### Good Test Bean Titles

Descriptive titles help identify test scope:

- "Test: UserService.create() validation rules"
- "Test: PaymentFlow handles declined cards"
- "Test: SearchInput debounces API calls"
- "Test: Router redirects unauthenticated users"

### Test Organization

Group tests by:
- **Unit**: Single function/class in isolation
- **Integration**: Multiple components together
- **E2E**: Full user workflows

For a typical feature breakdown:
```
feature-bean/
  ├── task: Create UserService class
  ├── task: Test: UserService unit tests      # Tests the service
  ├── task: Add /users API endpoint
  └── task: Test: /users endpoint integration  # Tests service + API
```

## Blocker Relationship Patterns

### TDD Pattern (Test-First)

Test bean blocks implementation bean:

```bash
# Implementation is blocked by test
beans update <impl-bean-id> --blocking <test-bean-id>
```

Execution order:
1. Write test (fails)
2. Implement (test passes)

**When to suggest**: User values strict TDD or working on critical code.

### Implementation-First Pattern

Implementation bean blocks test bean:

```bash
# Test is blocked by implementation
beans update <test-bean-id> --blocking <impl-bean-id>
```

Execution order:
1. Implement feature
2. Write tests for coverage

**When to suggest**: Exploratory work or prototype-first approach.

### Parallel Pattern (No Blocking)

Tests and implementation can happen independently:

```
[impl-bean] -----> done
[test-bean] -----> done
```

**When to suggest**: Different people working on tests vs implementation.

## Suggesting TDD to Users

### How to Ask

Always frame TDD as a choice, not a requirement:

**Good approach**:
> "This feature has complex validation logic. Would you like me to create test beans that block the implementation? This enables TDD - writing tests first to define expected behavior."

**Avoid**:
> "You should write tests first." (prescriptive)
> "Creating test beans..." (without asking)

### Presenting Options

Offer clear choices:

> "For test coverage, I can structure it as:
> 
> 1. **TDD** - Test beans block implementation (write tests first)
> 2. **Test after** - Implementation beans block tests (implement first)
> 3. **Parallel** - No blocking (tests and implementation independent)
> 4. **No tests** - Skip test beans (not recommended for this work)
> 
> Which approach would you prefer?"

### Respecting the Choice

If user declines tests or TDD:
- Acknowledge the choice
- Don't repeatedly suggest
- Move on with the breakdown

## Integration with beans-breakdown

This skill works alongside beans-breakdown:

1. **During Phase 2** (Child Bean Creation)
   - As tasks are identified, note which could benefit from tests
   - Track test opportunities separately

2. **After Phase 2** (Before Phase 4)
   - Present test suggestions as a batch
   - Ask about TDD preference for each group
   - Create test beans based on user choice

3. **Phase 4** (Parent Checklist)
   - Include test beans in checklist if created
   - Mark TDD relationships in parent body

### Example Integration

```markdown
## Checklist

### Implementation
- [ ] daedalus-abc1: Create UserService class
- [ ] daedalus-abc2: Add API endpoint
- [ ] daedalus-abc3: Build user form component

### Testing (TDD - blocks implementation)
- [ ] daedalus-abc4: Test: UserService CRUD operations [blocks abc1]
- [ ] daedalus-abc5: Test: /users endpoint integration [blocks abc2]
```

## Common Patterns

### Bug Fix TDD

```
1. [Test bean]: Write failing test that reproduces bug
   ↓ blocks
2. [Fix bean]: Implement the fix
   ↓ blocks
3. [Verify bean]: Confirm fix and check for regressions
```

### New Feature TDD

```
1. [Test bean]: Define expected behavior via tests
   ↓ blocks
2. [Impl bean]: Implement to make tests pass
   ↓ blocks
3. [Polish bean]: Refactor with test safety net
```

### Refactor with Tests

```
1. [Test bean]: Add tests for existing behavior (if missing)
   ↓ blocks
2. [Refactor bean]: Change implementation
   (tests verify behavior unchanged)
```

## Tips

1. **Don't over-test** - Some code isn't worth testing
2. **Focus on behavior** - Test what it does, not how
3. **Match project style** - Follow existing test conventions
4. **Keep tests fast** - Slow tests get skipped
5. **Respect user choice** - TDD is a tool, not a religion
