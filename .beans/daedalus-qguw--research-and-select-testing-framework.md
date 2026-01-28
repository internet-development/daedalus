---
# daedalus-qguw
title: Research and select testing framework
status: completed
type: task
priority: normal
created_at: 2026-01-28T22:20:26Z
updated_at: 2026-01-28T23:01:18Z
parent: daedalus-st1s
blocking:
    - daedalus-gsj7
---

Based on comprehensive research and critical review, select Vitest as the testing framework for Daedalus v2.

## Research Summary
The @researcher agent evaluated Jest vs Vitest for our TypeScript ES modules project and found:

### ✅ **Vitest Advantages for Our Project**
- **Native ES Module Support**: Works perfectly with our "type": "module" setup
- **Zero TypeScript Configuration**: Shares our existing TypeScript/Vite pipeline  
- **Performance**: Faster startup and watch mode using Vite's HMR
- **Modern Architecture**: Built for ES modules, top-level await, modern JS

### ⚠️ **Jest Limitations for Our Setup**
- **ES Module Issues**: Requires complex configuration, though v29+ support is production-ready
- **TypeScript Overhead**: Needs separate transpilation setup (Babel/ts-jest)
- **Configuration Duplication**: Separate config from build tools
- **Performance**: Slower startup times with TypeScript

## Critical Review Findings

The @critic agent evaluated our decision and identified:

### **Bun Alternative: NOT Recommended**
- No auto-mocking support (__mocks__ directories don't work)
- Rapid breaking changes (more frequent than Vitest)
- Would require runtime change (run on Bun, not just use test runner)
- Less mature IDE integration and tooling

**Verdict**: Do NOT switch to Bun. Vitest is the better choice.

### **Key Concerns Addressed**
1. **"Agent-friendly" justification is weak** - Both frameworks use identical describe/it/expect APIs
2. **Jest ESM support is better than claimed** - v29+ has stable ESM, but Vitest is still simpler
3. **Decision process was sound** - Deliberation has diminishing returns, time to execute

## Decision: **Vitest**

## Rationale
1. **Perfect Technical Fit**: Native ES module + TypeScript support
2. **Simpler Configuration**: Zero-config approach reduces setup complexity
3. **Performance**: Fast feedback loops essential for TDD
4. **Future-Proof**: Built for modern JavaScript ecosystem
5. **Good Enough**: Both Jest and Vitest would work, but Vitest is simpler for our setup

## Critical Recommendations for Implementation

### **Must Validate Before Proceeding**
1. Write ONE test that spawns beans CLI to validate child_process handling
2. Configure global timeout (default 10s is too short for agent operations)
3. Pin Vitest version to avoid breaking changes

### **Test Architecture Considerations**
- EventEmitter state can leak between tests - need cleanup utilities
- Child process spawning needs validation (spawn/execSync)
- Long-running agent tests need explicit timeout configuration
- Consider sequential test execution to avoid spawning too many processes

## Next Steps
- Update task 2 (daedalus-gsj7) to include critical recommendations
- Provide concrete configuration template for agents
- Enable autonomous execution of remaining TDD tasks

## Deliverables
- ✅ Framework decision documented with rationale
- ✅ Research findings captured for future reference
- ✅ Critical review findings integrated
- ✅ Implementation risks identified and mitigations planned
- ✅ Clear path forward for autonomous implementation

This decision enables the remaining 8 TDD epic tasks to be implemented autonomously by coding agents.