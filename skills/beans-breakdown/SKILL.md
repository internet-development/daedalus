---
name: beans-breakdown
description: Decompose features, epics, and bugs into small, actionable child beans. Use when a bean needs to be broken into smaller tasks before execution.
---

# Beans Breakdown

A workflow skill for decomposing work into small, focused child beans that agents can execute efficiently.

## When to Use

Activate this skill when:
- A feature/epic/bug bean is ready for implementation
- The bean's body describes work that would take >30 minutes
- Multiple files or components need changes
- The work has logical phases or dependencies

Do NOT use when:
- The bean is already a small, focused task
- The work can be done in a single coding session
- Breaking it down would create unnecessary overhead

## Workflow Overview

The breakdown workflow has four phases:

1. **Context Gathering** - Understand the parent bean and codebase
2. **Child Bean Creation** - Create focused child tasks
3. **Test Bean Suggestions** - Optionally suggest test coverage
4. **Parent Checklist Update** - Link children in parent's body

## Phase 1: Context Gathering

Before creating child beans, understand the work thoroughly.

### Read the Parent Bean

Use the beans CLI to get full details:

```bash
beans query '{ bean(id: "<parent-id>") { id title type body parent { title } } }'
```

### Analyze the Scope

Identify:
- **Entry points**: Where does the work start?
- **Files involved**: What needs to change?
- **Dependencies**: What must happen first?
- **Interfaces**: What connects to external code?

### Explore the Codebase

Read relevant files to understand:
- Current implementation patterns
- Testing conventions
- Module boundaries
- Existing similar features

### Determine Granularity

Target task duration: **2-5 minutes of agent work**

Signs a task is too big:
- Modifies >3 files
- Has multiple distinct concerns
- Could be partially completed

Signs a task is too small:
- Is just "add import statement"
- Has no meaningful verification
- Would be combined with next task anyway

## Phase 2: Child Bean Creation

Create child beans that are:
- **Atomic**: Complete one logical unit of work
- **Ordered**: Can be done in sequence
- **Verifiable**: Have clear done conditions

### Bean Type by Parent

| Parent Type | Child Types |
|-------------|-------------|
| milestone | epic, feature |
| epic | feature, task |
| feature | task, bug |
| bug | task |
| task | (rarely needs breakdown) |

### Child Bean Structure

Each child bean should have:

**Title**: Verb-noun format, specific (e.g., "Add UserService class")

**Body**:
```markdown
## Context

Brief explanation of why this task exists and how it fits the parent.

## Implementation

Specific steps to complete:
1. Step one
2. Step two
3. Step three

## Files

- `path/to/file.ts` - What changes to make

## Verification

How to confirm this task is done:
- [ ] Specific check 1
- [ ] Specific check 2
```

### Creating Child Beans

```bash
beans create "Add UserService class" \
  -t task \
  -s todo \
  --parent <parent-id> \
  -d "## Context

Part of user management feature. Creates the core service class.

## Implementation

1. Create UserService class in src/services/
2. Add constructor with database dependency
3. Implement CRUD methods with proper error handling

## Files

- \`src/services/user-service.ts\` - Create new file

## Verification

- [ ] File exists at correct path
- [ ] Class exports properly
- [ ] TypeScript compiles without errors"
```

### Ordering with Blocking Relationships

If tasks must be done in order, use blocking relationships:

```bash
# Task B depends on Task A
beans update <task-b-id> --blocking <task-a-id>
```

This means: Task A blocks Task B (A must complete before B).

Common ordering patterns:
- Interface/types before implementation
- Service before controller
- Implementation before tests (usually)

### Typical Breakdown Patterns

**For a new feature**:
1. Create types/interfaces
2. Implement core service/logic
3. Add API endpoint (if applicable)
4. Add UI component (if applicable)
5. Write tests
6. Update documentation

**For a bug fix**:
1. Write failing test that reproduces bug
2. Implement the fix
3. Verify test passes
4. Check for related edge cases

**For a refactor**:
1. Add tests for current behavior (if missing)
2. Extract/move code
3. Update imports/references
4. Verify tests still pass

## Phase 3: Test Bean Suggestions

Good test coverage prevents regressions. Suggest test beans when appropriate.

### When to Suggest Tests

Suggest test beans when:
- Feature has user-facing behavior
- Bug was caused by untested edge case
- Code has complex logic worth protecting
- Integration points need verification

Skip test suggestions when:
- Pure refactor with existing tests
- Configuration-only changes
- Work is itself test-related

### Test Bean Structure

```bash
beans create "Test: UserService CRUD operations" \
  -t task \
  -s todo \
  --parent <parent-id> \
  -d "## Context

Test coverage for UserService to prevent regressions.

## Test Cases

- [ ] Creates user with valid data
- [ ] Returns null for non-existent user
- [ ] Updates user fields correctly
- [ ] Deletes user and cascades
- [ ] Handles invalid input gracefully

## Files

- \`src/services/__tests__/user-service.test.ts\` - Create test file

## Verification

- [ ] All test cases pass
- [ ] No skipped tests
- [ ] Covers happy path and error cases"
```

### TDD Blocker Relationships

For test-driven development, suggest (but don't enforce) test-first:

"Would you like the test bean to block the implementation bean? This enables TDD - writing tests before implementation."

If yes:
```bash
beans update <implementation-bean-id> --blocking <test-bean-id>
```

## Phase 4: Parent Checklist Update

After creating children, update the parent bean with a checklist.

### Update Parent Body

Add a checklist section referencing children:

```markdown
## Checklist

- [ ] daedalus-abc1: Create types/interfaces
- [ ] daedalus-abc2: Implement UserService
- [ ] daedalus-abc3: Add API endpoint
- [ ] daedalus-abc4: Test coverage
```

### Update Command

```bash
beans update <parent-id> --body "... updated body with checklist ..."
```

Or use GraphQL mutation:
```bash
beans query 'mutation {
  updateBean(id: "<parent-id>", input: {
    body: "... new body ..."
  }) { id }
}'
```

## Tips for Good Breakdowns

1. **Respect boundaries** - Don't mix concerns in one task
2. **Name clearly** - Task titles should be grep-able
3. **Include paths** - Specific file paths reduce ambiguity
4. **Think verification** - Every task needs a "done" check
5. **Stay flexible** - Breakdown can evolve during execution

## Reference Files

See [task-templates.md](references/task-templates.md) for reusable task patterns.
