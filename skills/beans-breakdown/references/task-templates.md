# Task Templates

Reusable templates for common task types during bean breakdown.

## TypeScript/JavaScript Tasks

### Create New Module

```markdown
## Context

[Why this module exists and its responsibilities]

## Implementation

1. Create file at specified path
2. Define exports (classes, functions, types)
3. Add JSDoc comments for public APIs
4. Export from index.ts if applicable

## Files

- `src/[path]/[name].ts` - Create new module

## Verification

- [ ] File exists at correct path
- [ ] TypeScript compiles without errors
- [ ] Exports are accessible from intended import paths
- [ ] No circular dependencies introduced
```

### Modify Existing Module

```markdown
## Context

[What's being changed and why]

## Implementation

1. Open file at specified path
2. Make changes described below
3. Update any affected types/interfaces
4. Fix any resulting type errors

## Changes

- Add [thing] to [location]
- Modify [thing] to support [behavior]
- Remove [deprecated thing]

## Files

- `src/[path]/[name].ts` - Modify as described

## Verification

- [ ] Change is implemented correctly
- [ ] No new type errors
- [ ] Existing tests still pass
- [ ] No unintended side effects
```

### Add React Component

```markdown
## Context

[Component purpose and where it's used]

## Implementation

1. Create component file
2. Define props interface
3. Implement component with proper hooks
4. Export from index if needed
5. Add basic styling (if applicable)

## Props

```typescript
interface [Name]Props {
  // Define expected props
}
```

## Files

- `src/components/[Name]/[Name].tsx` - Component implementation
- `src/components/[Name]/index.ts` - Re-export (optional)

## Verification

- [ ] Component renders without errors
- [ ] Props are properly typed
- [ ] Component is exported correctly
- [ ] Basic styling works
```

### Add API Endpoint

```markdown
## Context

[What the endpoint does and who calls it]

## Implementation

1. Add route handler to router
2. Implement request validation
3. Call appropriate service methods
4. Handle errors with proper status codes
5. Return typed response

## Endpoint

- Method: `[GET|POST|PUT|DELETE]`
- Path: `/api/[path]`
- Request: [describe body/params]
- Response: [describe shape]

## Files

- `src/api/[domain]/routes.ts` - Add route
- `src/api/[domain]/handlers/[name].ts` - Handler implementation

## Verification

- [ ] Endpoint responds to correct HTTP method
- [ ] Request validation works
- [ ] Success response has correct shape
- [ ] Error cases return appropriate status codes
```

### Add Database Migration

```markdown
## Context

[What schema change is needed and why]

## Implementation

1. Generate migration file
2. Define up() migration
3. Define down() migration (rollback)
4. Test migration locally

## Schema Change

```sql
-- Describe the schema change
ALTER TABLE [name] ...
```

## Files

- `migrations/[timestamp]_[name].ts` - Migration file

## Verification

- [ ] Migration runs without error
- [ ] Rollback works correctly
- [ ] Schema change is correct
- [ ] Existing data is preserved/migrated
```

---

## Testing Tasks

### Unit Test Suite

```markdown
## Context

Unit tests for [module name] to prevent regressions.

## Test Cases

- [ ] [Describe test case 1]
- [ ] [Describe test case 2]
- [ ] [Edge case / error handling]

## Implementation

1. Create test file
2. Import module under test
3. Set up test fixtures/mocks
4. Write test cases
5. Verify all pass

## Files

- `src/[path]/__tests__/[name].test.ts` - Test file

## Verification

- [ ] All test cases pass
- [ ] Tests are meaningful (not just coverage padding)
- [ ] Mocks are minimal and focused
```

### Integration Test

```markdown
## Context

Integration test for [feature] to verify end-to-end behavior.

## Test Scenario

1. [Setup step]
2. [Action step]
3. [Verification step]

## Files

- `tests/integration/[name].test.ts` - Integration test

## Verification

- [ ] Test passes in CI environment
- [ ] Test is not flaky
- [ ] Test cleans up after itself
```

---

## Bug Fix Tasks

### Investigate Issue

```markdown
## Context

[Describe the bug symptoms]

## Investigation Steps

1. Reproduce the issue locally
2. Add logging/debugging to identify cause
3. Document findings in this bean

## Expected Findings

- Root cause identification
- Affected code paths
- Potential fix approach

## Files to Examine

- `src/[suspected file 1]`
- `src/[suspected file 2]`

## Verification

- [ ] Bug can be reproduced
- [ ] Root cause is identified
- [ ] Fix approach is documented
```

### Implement Fix

```markdown
## Context

Fix for [bug description]. Root cause: [identified cause].

## Implementation

1. [Specific fix step 1]
2. [Specific fix step 2]
3. Verify existing tests pass
4. Add regression test if missing

## Files

- `src/[path]/[file].ts` - Apply fix

## Verification

- [ ] Bug no longer reproduces
- [ ] Existing tests pass
- [ ] No new issues introduced
- [ ] Regression test added
```

---

## Documentation Tasks

### Update README

```markdown
## Context

[What documentation is outdated/missing]

## Changes

- Add section for [new feature]
- Update [outdated section]
- Fix [incorrect information]

## Files

- `README.md` - Update documentation

## Verification

- [ ] Documentation is accurate
- [ ] Examples work as shown
- [ ] No broken links
```

### Add JSDoc Comments

```markdown
## Context

Add documentation comments to [module] for better IDE support.

## Implementation

1. Add JSDoc to exported functions
2. Add JSDoc to exported classes
3. Add JSDoc to public methods
4. Document parameters and return types

## Files

- `src/[path]/[file].ts` - Add JSDoc comments

## Verification

- [ ] All exports have JSDoc
- [ ] Descriptions are meaningful
- [ ] @param and @returns are documented
- [ ] @example included where helpful
```

---

## Configuration Tasks

### Add Environment Variable

```markdown
## Context

[Why this config is needed]

## Implementation

1. Add to .env.example with description
2. Add to config schema/loader
3. Add validation if needed
4. Use in appropriate location

## Configuration

- Name: `[VAR_NAME]`
- Type: `[string|number|boolean]`
- Default: `[value or none]`
- Required: `[yes|no]`

## Files

- `.env.example` - Add example
- `src/config/index.ts` - Add to schema

## Verification

- [ ] Config loads correctly
- [ ] Default works as expected
- [ ] Validation catches invalid values
- [ ] Documentation updated
```

---

## Refactoring Tasks

### Extract Function

```markdown
## Context

Extract [logic description] into reusable function.

## Implementation

1. Identify code to extract
2. Create function with clear name
3. Move code and add parameters
4. Update call sites
5. Verify behavior unchanged

## Files

- `src/[path]/[file].ts` - Extract function
- `src/[path]/[affected files]` - Update imports

## Verification

- [ ] Function is properly extracted
- [ ] All call sites updated
- [ ] Behavior is unchanged
- [ ] Tests still pass
```

### Rename Symbol

```markdown
## Context

Rename [old name] to [new name] for clarity.

## Implementation

1. Use IDE rename refactoring
2. Update any string references
3. Update documentation/comments
4. Update test descriptions

## Files

- `src/[files that reference symbol]`

## Verification

- [ ] All references updated
- [ ] No runtime errors
- [ ] Tests pass
- [ ] Documentation updated
```
