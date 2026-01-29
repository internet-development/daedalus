/**
 * Context Module Tests
 *
 * Tests for AsyncLocalStorage-based execution context for correlation IDs.
 */
import { describe, it, expect, beforeEach } from 'vitest';

// =============================================================================
// Context Creation Tests
// =============================================================================

describe('executionContext', () => {
  it('provides undefined when no context is set', async () => {
    const { executionContext } = await import('./context.js');
    
    const store = executionContext.getStore();
    expect(store).toBeUndefined();
  });
});

describe('withContext', () => {
  it('generates correlationId when not provided', async () => {
    const { withContext, executionContext } = await import('./context.js');
    
    let capturedContext: unknown;
    await withContext({}, async () => {
      capturedContext = executionContext.getStore();
    });

    expect(capturedContext).toBeDefined();
    expect((capturedContext as { correlationId: string }).correlationId).toBeDefined();
    expect(typeof (capturedContext as { correlationId: string }).correlationId).toBe('string');
    expect((capturedContext as { correlationId: string }).correlationId.length).toBeGreaterThan(0);
  });

  it('uses provided correlationId', async () => {
    const { withContext, executionContext } = await import('./context.js');
    
    let capturedContext: unknown;
    await withContext({ correlationId: 'custom-id-123' }, async () => {
      capturedContext = executionContext.getStore();
    });

    expect((capturedContext as { correlationId: string }).correlationId).toBe('custom-id-123');
  });

  it('includes beanId in context', async () => {
    const { withContext, executionContext } = await import('./context.js');
    
    let capturedContext: unknown;
    await withContext({ beanId: 'daedalus-abc1' }, async () => {
      capturedContext = executionContext.getStore();
    });

    expect((capturedContext as { beanId: string }).beanId).toBe('daedalus-abc1');
  });

  it('includes component in context', async () => {
    const { withContext, executionContext } = await import('./context.js');
    
    let capturedContext: unknown;
    await withContext({ component: 'scheduler' }, async () => {
      capturedContext = executionContext.getStore();
    });

    expect((capturedContext as { component: string }).component).toBe('scheduler');
  });

  it('propagates context through async calls', async () => {
    const { withContext, executionContext } = await import('./context.js');
    
    const capturedContexts: unknown[] = [];

    async function innerAsync() {
      capturedContexts.push(executionContext.getStore());
    }

    async function middleAsync() {
      capturedContexts.push(executionContext.getStore());
      await innerAsync();
    }

    await withContext({ beanId: 'test-bean', component: 'test' }, async () => {
      capturedContexts.push(executionContext.getStore());
      await middleAsync();
    });

    expect(capturedContexts.length).toBe(3);
    for (const ctx of capturedContexts) {
      expect((ctx as { beanId: string }).beanId).toBe('test-bean');
      expect((ctx as { component: string }).component).toBe('test');
    }
  });

  it('returns the result of the wrapped function', async () => {
    const { withContext } = await import('./context.js');
    
    const result = await withContext({ beanId: 'test' }, async () => {
      return 'hello world';
    });

    expect(result).toBe('hello world');
  });

  it('propagates errors from the wrapped function', async () => {
    const { withContext } = await import('./context.js');
    
    await expect(
      withContext({ beanId: 'test' }, async () => {
        throw new Error('test error');
      })
    ).rejects.toThrow('test error');
  });
});

// =============================================================================
// Nested Context Tests
// =============================================================================

describe('nested contexts', () => {
  it('inner context overrides outer context', async () => {
    const { withContext, executionContext } = await import('./context.js');
    
    let outerContext: unknown;
    let innerContext: unknown;

    await withContext({ beanId: 'outer-bean', component: 'outer' }, async () => {
      outerContext = executionContext.getStore();
      
      await withContext({ beanId: 'inner-bean' }, async () => {
        innerContext = executionContext.getStore();
      });
    });

    expect((outerContext as { beanId: string }).beanId).toBe('outer-bean');
    expect((innerContext as { beanId: string }).beanId).toBe('inner-bean');
    // Inner context gets new correlationId, doesn't inherit component
    expect((innerContext as { correlationId: string }).correlationId).toBeDefined();
  });

  it('outer context is restored after inner context completes', async () => {
    const { withContext, executionContext } = await import('./context.js');
    
    let contextAfterInner: unknown;

    await withContext({ beanId: 'outer-bean' }, async () => {
      await withContext({ beanId: 'inner-bean' }, async () => {
        // Inner context active here
      });
      
      contextAfterInner = executionContext.getStore();
    });

    expect((contextAfterInner as { beanId: string }).beanId).toBe('outer-bean');
  });
});

// =============================================================================
// Context Isolation Tests
// =============================================================================

describe('context isolation', () => {
  it('concurrent operations have isolated contexts', async () => {
    const { withContext, executionContext } = await import('./context.js');
    
    const results: { id: string; context: unknown }[] = [];

    const operation = async (id: string, delay: number) => {
      await withContext({ beanId: id }, async () => {
        // Simulate async work
        await new Promise(resolve => setTimeout(resolve, delay));
        results.push({ id, context: executionContext.getStore() });
      });
    };

    // Run operations concurrently with different delays
    await Promise.all([
      operation('bean-1', 30),
      operation('bean-2', 10),
      operation('bean-3', 20),
    ]);

    // Each operation should have captured its own context
    expect(results.length).toBe(3);
    
    const bean1Result = results.find(r => r.id === 'bean-1');
    const bean2Result = results.find(r => r.id === 'bean-2');
    const bean3Result = results.find(r => r.id === 'bean-3');

    expect((bean1Result?.context as { beanId: string }).beanId).toBe('bean-1');
    expect((bean2Result?.context as { beanId: string }).beanId).toBe('bean-2');
    expect((bean3Result?.context as { beanId: string }).beanId).toBe('bean-3');
  });
});

// =============================================================================
// getContext Helper Tests
// =============================================================================

describe('getContext', () => {
  it('returns current context or empty object', async () => {
    const { getContext, withContext } = await import('./context.js');
    
    // Outside context - should return empty object
    const outsideContext = getContext();
    expect(outsideContext).toEqual({});

    // Inside context - should return the context
    await withContext({ beanId: 'test-bean' }, async () => {
      const insideContext = getContext();
      expect(insideContext.beanId).toBe('test-bean');
      expect(insideContext.correlationId).toBeDefined();
    });
  });
});
