/**
 * Beans Client Tests
 * 
 * Validation tests for beans CLI spawning and basic operations.
 * These tests use the real beans CLI to ensure child process spawning works correctly.
 */
import { describe, it, expect } from 'vitest';
import { listBeans, getBean, setCwd, getCwd, BeansCliError } from './beans-client.js';

// Verify TypeScript type imports work correctly
import type { Bean, BeanStatus, BeanType } from './beans-client.js';

describe('beans-client', () => {
  describe('child process spawning', () => {
    it('can spawn beans CLI and query beans', async () => {
      // This is the critical validation test - ensures child process spawning works
      const beans = await listBeans();
      
      // Should return an array (even if empty)
      expect(Array.isArray(beans)).toBe(true);
      
      // If there are beans, they should have the expected structure
      if (beans.length > 0) {
        const bean = beans[0];
        expect(bean).toHaveProperty('id');
        expect(bean).toHaveProperty('title');
        expect(bean).toHaveProperty('status');
        expect(bean).toHaveProperty('type');
      }
    });

    it('can query a specific bean by ID', async () => {
      // First get any bean to test with
      const beans = await listBeans();
      
      if (beans.length > 0) {
        const firstBean = beans[0];
        const fetched = await getBean(firstBean.id);
        
        expect(fetched).not.toBeNull();
        expect(fetched?.id).toBe(firstBean.id);
        expect(fetched?.title).toBe(firstBean.title);
      }
    });

    it('returns null for non-existent bean', async () => {
      const bean = await getBean('non-existent-bean-id-12345');
      expect(bean).toBeNull();
    });
  });

  describe('cwd management', () => {
    it('can get and set working directory', () => {
      const original = getCwd();
      
      setCwd('/tmp/test');
      expect(getCwd()).toBe('/tmp/test');
      
      // Restore original
      setCwd(original);
      expect(getCwd()).toBe(original);
    });
  });

  describe('TypeScript integration', () => {
    it('exports types correctly', async () => {
      // Verify type exports work - this is a compile-time check
      const beans = await listBeans();
      
      // Type assertions to verify TypeScript integration
      const _bean: Bean | undefined = beans[0];
      const _status: BeanStatus = 'todo';
      const _type: BeanType = 'task';
      
      // Verify error class is exported
      const error = new BeansCliError('test', 'test-command');
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('BeansCliError');
      expect(error.command).toBe('test-command');
    });
  });
});
