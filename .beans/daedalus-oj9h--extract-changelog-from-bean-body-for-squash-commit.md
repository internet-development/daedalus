---
# daedalus-oj9h
title: Extract changelog from bean body for squash commit messages
status: todo
type: task
priority: normal
created_at: 2026-01-31T07:16:29Z
updated_at: 2026-01-31T07:17:04Z
parent: daedalus-8jow
blocking:
    - daedalus-xf7g
---

## Summary

When squash-merging task/bug branches, the commit message should include the changelog that the agent wrote into the bean body. This gives rich context in `git log` without needing to look at the bean tracker.

## Changelog format in beans

Agents write changelogs into bean bodies using this convention (from `daedalus-9l4m` as reference):

```markdown
## Changelog

### Implemented
- Did thing A
- Did thing B

### Files Modified
- `src/foo.ts` — Description

### Deviations from Spec
- Changed X because Y

### Decisions Made
- Chose approach A over B because...
```

The changelog section starts with `## Changelog` and continues until the next `## ` heading or end of file.

## Squash commit message format

```
feat(scope): Bean title

### Implemented
- Did thing A
- Did thing B

### Deviations from Spec
- Changed X because Y

Bean: daedalus-abc1
```

We include the changelog subsections but strip the `## Changelog` header itself (redundant in a commit message). If no changelog section exists, fall back to the first paragraph of the bean body (current behavior).

## Implementation

### 1. Add `extractChangelog()` function

In `src/utils/changelog.ts` (new file — keeps `config/index.ts` focused on config):

```typescript
/**
 * Extract the ## Changelog section from a bean body.
 * Returns the content between ## Changelog and the next ## heading (or EOF).
 * Returns null if no changelog section found.
 */
export function extractChangelog(body: string): string | null {
  const lines = body.split("\n");
  let inChangelog = false;
  const changelogLines: string[] = [];

  for (const line of lines) {
    if (/^## Changelog\s*$/i.test(line)) {
      inChangelog = true;
      continue; // skip the ## Changelog header itself
    }
    if (inChangelog && /^## /.test(line)) {
      break; // hit next section
    }
    if (inChangelog) {
      changelogLines.push(line);
    }
  }

  if (changelogLines.length === 0) return null;

  // Trim leading/trailing blank lines
  const trimmed = changelogLines.join("\n").trim();
  return trimmed || null;
}
```

### 2. Add `formatSquashCommitMessage()` function

In `src/utils/changelog.ts` alongside `extractChangelog()`:

```typescript
import { beanTypeToCommitType } from '../config/index.js';
import type { Bean } from '../talos/beans-client.js';
import type { CommitStyleConfig } from '../config/index.js';

/**
 * Format a squash commit message that includes the changelog.
 * Used for task/bug beans that are squash-merged.
 */
export function formatSquashCommitMessage(
  bean: Bean,
  scope: string | null,
  config: CommitStyleConfig
): string {
  const type = beanTypeToCommitType(bean.type);
  const header = scope ? `${type}(${scope}): ${bean.title}` : `${type}: ${bean.title}`;

  const parts: string[] = [header];

  // Try to extract changelog, fall back to first paragraph
  const changelog = extractChangelog(bean.body);
  if (changelog) {
    parts.push("", changelog);
  } else {
    const bodyParagraphs = bean.body.trim().split(/\n\n+/);
    const firstParagraph = bodyParagraphs[0]?.trim() || "";
    if (firstParagraph) {
      parts.push("", firstParagraph);
    }
  }

  if (config.include_bean_id) {
    parts.push("", `Bean: ${bean.id}`);
  }

  return parts.join("\n");
}
```

### 3. Export from `src/utils/changelog.ts`

Both `extractChangelog` and `formatSquashCommitMessage` are exported from the new file. The completion handler imports from `../utils/changelog.js`.

## Edge cases

- **No changelog section**: Fall back to first paragraph of body (existing behavior)
- **Empty changelog section**: `## Changelog` exists but no content below → fall back
- **Changelog with only `### Files Modified`**: Include it — the agent chose to document it
- **Very long changelog**: No truncation — git commit messages can be long, and this is valuable context

## Files to modify

- `src/utils/changelog.ts` — New file: `extractChangelog()`, `formatSquashCommitMessage()`

## Testing

**Unit tests: YES.** Both functions are pure string-in/string-out with no I/O — ideal for unit testing. Follow the pattern in `src/utils/string-helpers.test.ts` which tests pure utility functions with simple input/output assertions.

Test file: `src/utils/changelog.test.ts` (new file, co-located with implementation)

Tests to add:
- `extractChangelog`: full changelog section → returns content without `## Changelog` header
- `extractChangelog`: no changelog section → returns `null`
- `extractChangelog`: empty changelog (header only, no content) → returns `null`
- `extractChangelog`: stops at next `## ` heading
- `extractChangelog`: changelog at end of file (no following section)
- `formatSquashCommitMessage`: with changelog → includes changelog in body
- `formatSquashCommitMessage`: no changelog → falls back to first paragraph
- `formatSquashCommitMessage`: includes `Bean: {id}` when `include_bean_id` is true
- `formatSquashCommitMessage`: correct conventional commit type prefix (`chore` for task, `fix` for bug)

## Checklist

- [ ] Add `extractChangelog()` function to parse `## Changelog` section from bean body
- [ ] Add `formatSquashCommitMessage()` that includes changelog in commit message
- [ ] Export both new functions from `src/utils/changelog.ts`
- [ ] Add unit tests in `src/utils/changelog.test.ts`
