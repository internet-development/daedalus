---
# daedalus-gsj7
title: Install and configure Vitest testing framework
status: todo
type: task
priority: normal
created_at: 2026-01-28T22:20:37Z
updated_at: 2026-01-28T23:01:44Z
parent: daedalus-st1s
blocking:
    - daedalus-zoeb
    - daedalus-516s
    - daedalus-uzth
    - daedalus-8jrg
    - daedalus-tg5y
---

Install Vitest and configure it for TypeScript ES modules based on the research decision (daedalus-qguw).

## Prerequisites
- Framework research completed with Vitest selected
- Critical review findings integrated
- Understanding of implementation risks and mitigations

## Technical Requirements
- Configure for TypeScript ES modules
- Support for .ts and .tsx test files
- Proper path resolution for src/ imports
- Integration with existing tsconfig.json
- Node environment for CLI testing

## Critical Recommendations from @critic

### **1. Pin Vitest Version (CRITICAL)**
Vitest is younger than Jest and has more frequent breaking changes.

```json
// package.json - DO THIS:
"vitest": "1.6.0"

// NOT THIS:
"vitest": "^1.6.0"
```

### **2. Configure Global Timeout**
Default timeout is 10 seconds. Agent operations can run much longer.

```typescript
// vitest.config.ts
test: {
  testTimeout: 60000,  // 60 seconds default
}
```

### **3. Validate Child Process Spawning**
Before proceeding with other tests, write ONE test that validates beans CLI spawning:

```typescript
// First test to write:
it('can spawn beans CLI', async () => {
  const result = await execBeansQuery('{ beans { id } }');
  expect(result.beans).toBeDefined();
});
```

## Deliverables
- Updated package.json with Vitest dependencies (PINNED version)
- vitest.config.ts configuration file
- Working "npm run test" command
- Basic test script setup
- Validation test for child process spawning

## Vitest Configuration Template
```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.{test,spec}.{js,ts}'],
    
    // CRITICAL: Set reasonable timeout for agent operations
    testTimeout: 60000,  // 60 seconds
    
    // Coverage configuration
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{js,ts}'],
      exclude: ['src/**/*.{test,spec}.{js,ts}']
    },
    
    // Consider sequential execution to avoid spawning too many processes
    // pool: 'forks',
    // poolOptions: { forks: { singleFork: true } }
  }
})
```

## Package.json Dependencies
```json
{
  "devDependencies": {
    "vitest": "1.6.0",
    "@vitest/coverage-v8": "1.6.0"
  },
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  }
}
```

## Test Architecture Considerations

### **EventEmitter State Management**
Your event-driven architecture requires cleanup between tests:

```typescript
// Test helper to create
afterEach(() => {
  // Remove all listeners from shared EventEmitters
  scheduler.removeAllListeners();
  watcher.removeAllListeners();
});
```

### **Child Process Testing Strategy**
- Validate beans CLI spawning works correctly
- Consider sequential test execution to avoid process explosion
- Mock external processes where possible
- Set appropriate timeouts for long-running operations

## Acceptance Criteria
- ✅ Vitest version PINNED (not using ^)
- ✅ Vitest starts without errors
- ✅ Can import project modules in test files
- ✅ TypeScript compilation works for tests
- ✅ Basic test script runs (even with 0 tests)
- ✅ Configuration supports our ES module setup
- ✅ Global timeout configured for agent operations
- ✅ Validation test for beans CLI spawning passes

## Checklist
- [ ] Install vitest@1.6.0 and @vitest/coverage-v8@1.6.0 (PINNED versions)
- [ ] Create vitest.config.ts with Node environment and 60s timeout
- [ ] Add test scripts to package.json
- [ ] Verify vitest can resolve TypeScript imports
- [ ] Write validation test for beans CLI spawning
- [ ] Run validation test and ensure it passes
- [ ] Test that "npm run test" works
- [ ] Verify ES module imports work in test context
- [ ] Document configuration choices and timeout strategy