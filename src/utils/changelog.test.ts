/**
 * Changelog Extraction Tests
 *
 * Tests for extracting the ## Changelog section from bean body
 * and formatting squash commit messages.
 */
import { describe, it, expect } from 'vitest';
import {
  extractChangelog,
  formatSquashCommitMessage,
} from './changelog.js';
import type { Bean, BeanType } from '../talos/beans-client.js';

// =============================================================================
// Test Helpers
// =============================================================================

function makeBean(overrides: Partial<Bean> & { id: string }): Bean {
  return {
    slug: overrides.id,
    title: `Bean ${overrides.id}`,
    status: 'completed',
    type: 'task',
    priority: 'normal',
    tags: [],
    body: '',
    blockingIds: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

// =============================================================================
// extractChangelog Tests
// =============================================================================

describe('extractChangelog', () => {
  it('extracts changelog section from bean body', () => {
    const body = `## Summary
Some summary text.

## Checklist
- [x] Task 1
- [x] Task 2

## Changelog

### Implemented
- Added retry logic
- Created test utilities

### Deviations from Spec
- Used 3 retries instead of 5

### Decisions Made
- Chose exponential backoff
`;

    const changelog = extractChangelog(body);
    expect(changelog).toContain('### Implemented');
    expect(changelog).toContain('- Added retry logic');
    expect(changelog).toContain('### Deviations from Spec');
    expect(changelog).toContain('### Decisions Made');
  });

  it('returns null when no changelog section exists', () => {
    const body = `## Summary
Some summary text.

## Checklist
- [x] Task 1
`;

    const changelog = extractChangelog(body);
    expect(changelog).toBeNull();
  });

  it('handles changelog at end of body', () => {
    const body = `## Summary
Text.

## Changelog

### Implemented
- Did thing A
- Did thing B`;

    const changelog = extractChangelog(body);
    expect(changelog).toContain('### Implemented');
    expect(changelog).toContain('- Did thing A');
  });

  it('stops at next h2 heading after changelog', () => {
    const body = `## Changelog

### Implemented
- Did thing

## Some Other Section
This should not be included.
`;

    const changelog = extractChangelog(body);
    expect(changelog).toContain('### Implemented');
    expect(changelog).not.toContain('Some Other Section');
  });

  it('handles empty changelog section', () => {
    const body = `## Changelog

## Next Section
`;

    const changelog = extractChangelog(body);
    // Empty changelog should return null or empty
    expect(changelog === null || changelog.trim() === '').toBe(true);
  });

  it('is case-insensitive for heading match', () => {
    const body = `## changelog

### Implemented
- Did thing
`;

    const changelog = extractChangelog(body);
    expect(changelog).toContain('### Implemented');
  });
});

// =============================================================================
// formatSquashCommitMessage Tests
// =============================================================================

describe('formatSquashCommitMessage', () => {
  it('formats a squash commit message with changelog', () => {
    const bean = makeBean({
      id: 'daedalus-abc1',
      title: 'Add retry logic',
      type: 'task',
      body: `## Summary
Add retry logic.

## Changelog

### Implemented
- Added retry logic with exponential backoff
- Created test utilities

### Deviations from Spec
- Used 3 retries instead of 5
`,
    });

    const message = formatSquashCommitMessage(bean, 'scope');

    expect(message).toContain('chore(scope): Add retry logic');
    expect(message).toContain('### Implemented');
    expect(message).toContain('- Added retry logic');
    expect(message).toContain('### Deviations from Spec');
    expect(message).toContain('Bean: daedalus-abc1');
  });

  it('uses feat prefix for feature beans', () => {
    const bean = makeBean({
      id: 'daedalus-feat1',
      title: 'New feature',
      type: 'feature',
      body: '## Changelog\n\n### Implemented\n- Feature\n',
    });

    const message = formatSquashCommitMessage(bean, null);
    expect(message).toMatch(/^feat: New feature/);
  });

  it('uses fix prefix for bug beans', () => {
    const bean = makeBean({
      id: 'daedalus-bug1',
      title: 'Fix crash',
      type: 'bug',
      body: '## Changelog\n\n### Implemented\n- Fix\n',
    });

    const message = formatSquashCommitMessage(bean, null);
    expect(message).toMatch(/^fix: Fix crash/);
  });

  it('falls back to title-only when no changelog', () => {
    const bean = makeBean({
      id: 'daedalus-abc1',
      title: 'Simple task',
      type: 'task',
      body: '## Summary\nJust a task.\n',
    });

    const message = formatSquashCommitMessage(bean, null);
    expect(message).toContain('chore: Simple task');
    expect(message).toContain('Bean: daedalus-abc1');
    // Should not have changelog subsections
    expect(message).not.toContain('### Implemented');
  });

  it('omits scope when null', () => {
    const bean = makeBean({
      id: 'daedalus-abc1',
      title: 'Task',
      type: 'task',
      body: '',
    });

    const message = formatSquashCommitMessage(bean, null);
    expect(message).toMatch(/^chore: Task/);
    expect(message).not.toContain('(');
  });

  it('includes scope when provided', () => {
    const bean = makeBean({
      id: 'daedalus-abc1',
      title: 'Task',
      type: 'task',
      body: '',
    });

    const message = formatSquashCommitMessage(bean, 'my-epic');
    expect(message).toMatch(/^chore\(my-epic\): Task/);
  });
});
