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
import type { Bean } from '../talos/beans-client.js';
import type { CommitStyleConfig } from '../config/index.js';

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

const defaultConfig: CommitStyleConfig = { include_bean_id: true };

// =============================================================================
// extractChangelog Tests
// =============================================================================

describe('extractChangelog', () => {
  it('extracts full changelog section from bean body', () => {
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
    expect(changelog).not.toBeNull();
    expect(changelog).toContain('### Implemented');
    expect(changelog).toContain('- Added retry logic');
    expect(changelog).toContain('- Created test utilities');
    expect(changelog).toContain('### Deviations from Spec');
    expect(changelog).toContain('- Used 3 retries instead of 5');
    expect(changelog).toContain('### Decisions Made');
    expect(changelog).toContain('- Chose exponential backoff');
    // Should NOT include the ## Changelog header itself
    expect(changelog).not.toContain('## Changelog');
  });

  it('returns null when no changelog section exists', () => {
    const body = `## Summary
Some summary text.

## Checklist
- [x] Task 1
`;

    expect(extractChangelog(body)).toBeNull();
  });

  it('returns null for empty changelog section (header only, no content)', () => {
    const body = `## Changelog

## Next Section
Content here.
`;

    expect(extractChangelog(body)).toBeNull();
  });

  it('stops at next ## heading', () => {
    const body = `## Changelog

### Implemented
- Did thing

## Some Other Section
This should not be included.
`;

    const changelog = extractChangelog(body);
    expect(changelog).toContain('### Implemented');
    expect(changelog).toContain('- Did thing');
    expect(changelog).not.toContain('Some Other Section');
    expect(changelog).not.toContain('This should not be included');
  });

  it('extracts changelog at end of file (no following section)', () => {
    const body = `## Summary
Text.

## Changelog

### Implemented
- Did thing A
- Did thing B`;

    const changelog = extractChangelog(body);
    expect(changelog).toContain('### Implemented');
    expect(changelog).toContain('- Did thing A');
    expect(changelog).toContain('- Did thing B');
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
  it('formats message with changelog content', () => {
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

    const message = formatSquashCommitMessage(bean, 'scope', defaultConfig);

    expect(message).toContain('chore(scope): Add retry logic');
    expect(message).toContain('### Implemented');
    expect(message).toContain('- Added retry logic with exponential backoff');
    expect(message).toContain('### Deviations from Spec');
    expect(message).toContain('Bean: daedalus-abc1');
  });

  it('falls back to first paragraph when no changelog', () => {
    const bean = makeBean({
      id: 'daedalus-abc1',
      title: 'Simple task',
      type: 'task',
      body: `When squash-merging task/bug branches, the commit message should include the changelog.

## Checklist
- [x] Task 1
`,
    });

    const message = formatSquashCommitMessage(bean, null, defaultConfig);
    expect(message).toContain('chore: Simple task');
    expect(message).toContain('When squash-merging task/bug branches');
    expect(message).not.toContain('### Implemented');
  });

  it('uses correct conventional commit type for task (chore)', () => {
    const bean = makeBean({
      id: 'daedalus-t1',
      title: 'Do task',
      type: 'task',
      body: '## Changelog\n\n### Implemented\n- Thing\n',
    });

    const message = formatSquashCommitMessage(bean, null, defaultConfig);
    expect(message).toMatch(/^chore: Do task/);
  });

  it('uses correct conventional commit type for bug (fix)', () => {
    const bean = makeBean({
      id: 'daedalus-bug1',
      title: 'Fix crash',
      type: 'bug',
      body: '## Changelog\n\n### Implemented\n- Fix\n',
    });

    const message = formatSquashCommitMessage(bean, null, defaultConfig);
    expect(message).toMatch(/^fix: Fix crash/);
  });

  it('uses correct conventional commit type for feature (feat)', () => {
    const bean = makeBean({
      id: 'daedalus-feat1',
      title: 'New feature',
      type: 'feature',
      body: '## Changelog\n\n### Implemented\n- Feature\n',
    });

    const message = formatSquashCommitMessage(bean, null, defaultConfig);
    expect(message).toMatch(/^feat: New feature/);
  });

  it('includes Bean: {id} when include_bean_id is true', () => {
    const bean = makeBean({
      id: 'daedalus-abc1',
      title: 'Task',
      type: 'task',
      body: '',
    });

    const message = formatSquashCommitMessage(bean, null, { include_bean_id: true });
    expect(message).toContain('Bean: daedalus-abc1');
  });

  it('omits Bean: {id} when include_bean_id is false', () => {
    const bean = makeBean({
      id: 'daedalus-abc1',
      title: 'Task',
      type: 'task',
      body: '',
    });

    const message = formatSquashCommitMessage(bean, null, { include_bean_id: false });
    expect(message).not.toContain('Bean:');
  });

  it('omits scope when null', () => {
    const bean = makeBean({
      id: 'daedalus-abc1',
      title: 'Task',
      type: 'task',
      body: '',
    });

    const message = formatSquashCommitMessage(bean, null, defaultConfig);
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

    const message = formatSquashCommitMessage(bean, 'my-epic', defaultConfig);
    expect(message).toMatch(/^chore\(my-epic\): Task/);
  });
});
