---
# daedalus-a5ja
title: 'Beans Client: Typed wrapper for beans CLI'
status: completed
type: feature
priority: critical
created_at: 2026-01-26T05:38:55Z
updated_at: 2026-01-26T09:19:54Z
parent: daedalus-ss8m
blocking:
    - daedalus-neut
    - daedalus-waja
    - daedalus-byrd
---

Create a TypeScript module with standalone functions that wrap the `beans` CLI with type-safe interfaces.

## Decisions Made

- **API Style**: Standalone functions (not a class) - functional style, no persistent state needed
- **Error Handling**: Return `null` for not-found cases, throw for actual failures (CLI missing, parse errors)
- **Caching**: No caching in client - the Watcher will maintain its own cache

## Interface Design
```typescript
// Standalone functions - no class needed
export async function listBeans(filter?: BeanFilter): Promise<Bean[]>;
export async function getBean(id: string): Promise<Bean | null>;
export async function getBlockedBy(id: string): Promise<Bean[]>;
export async function updateBeanStatus(id: string, status: BeanStatus): Promise<Bean>;
export async function createBean(input: CreateBeanInput): Promise<Bean>;
export async function updateBeanBody(id: string, body: string): Promise<Bean>;
export async function updateBeanTags(id: string, add?: string[], remove?: string[]): Promise<Bean>;
export async function getEpicAncestor(beanId: string): Promise<Bean | null>;  // Walk up parent chain to find epic

// Helper for running CLI
async function execBeans(args: string[]): Promise<string>;
async function execBeansQuery<T>(query: string): Promise<T>;
```

## Error Handling Strategy
- `getBean(id)` → returns `null` if bean not found (expected case)
- `listBeans()` → returns `[]` if no matches (expected case)
- Throws `BeansCliError` for actual failures (CLI not found, parse errors, etc.)

## Checklist
- [x] Define Bean, BeanStatus, BeanFilter, BeanType types matching beans GraphQL schema
- [x] Implement `execBeans()` helper for running `beans` CLI commands
- [x] Implement `execBeansQuery()` for `beans query --json` queries
- [x] Implement `listBeans()` with optional filter
- [x] Implement `getBean()` returning null for not found
- [x] Implement `getBlockedBy()` for dependency resolution
- [x] Implement `updateBeanStatus()` using `beans update`
- [x] Implement `updateBeanTags()` for adding/removing tags (blocked, failed)
- [x] Implement `createBean()` using `beans create`
- [x] Implement `updateBeanBody()` for checklist updates
- [x] Implement `isStuck()` helper function (checks blocked/failed tags)
- [x] Implement `getEpicAncestor()` - walk parent chain until type='epic' or null
- [x] Define `BeansCliError` for actual failure cases

## Shared Types

This module exports the core bean types used throughout Talos:

```typescript
// Bean statuses (actual beans tracker values - NO 'blocked' status!)
type BeanStatus = 'draft' | 'todo' | 'in-progress' | 'completed' | 'scrapped';

// Bean types  
type BeanType = 'milestone' | 'epic' | 'feature' | 'bug' | 'task';

// Bean priorities
type BeanPriority = 'critical' | 'high' | 'normal' | 'low' | 'deferred';

// Special tags used by Talos (not status, but tags!)
// - 'blocked': agent hit an issue it can't resolve
// - 'failed': agent crashed or errored unexpectedly
type TalosTag = 'blocked' | 'failed';

// Core bean interface
interface Bean {
  id: string;
  slug: string;             // human-readable slug from filename (for commit scope)
  title: string;
  status: BeanStatus;
  type: BeanType;
  priority: BeanPriority;
  tags: string[];           // includes TalosTag values
  body: string;
  parentId?: string;
  blockingIds: string[];
  createdAt: string;
  updatedAt: string;
}

// Helper to check if bean is stuck (has blocked or failed tag)
function isStuck(bean: Bean): boolean {
  return bean.tags.includes('blocked') || bean.tags.includes('failed');
}

// Filter for queries
interface BeanFilter {
  status?: BeanStatus[];
  excludeStatus?: BeanStatus[];
  type?: BeanType[];
  priority?: BeanPriority[];
  tags?: string[];          // filter by tags
  excludeTags?: string[];
  parentId?: string;
  isBlocked?: boolean;      // has incomplete blockedBy beans
  search?: string;
}

// Input for creating beans
interface CreateBeanInput {
  title: string;
  type?: BeanType;
  status?: BeanStatus;
  priority?: BeanPriority;
  tags?: string[];
  body?: string;
  parent?: string;
  blocking?: string[];
}
```

## Blocked/Failed State Design

Since beans tracker doesn't have a `blocked` status, we use **tags + blocker beans**:

1. **Tags indicate state**:
   - `blocked` tag = agent intentionally stopped (dependency issue)
   - `failed` tag = agent crashed/errored

2. **Blocker bean contains details**:
   - Type: `bug`
   - Blocking relationship to parent bean
   - Body contains error details, last output, etc.

3. **Status stays `in-progress`** while stuck, enabling easy retry

4. **Query patterns**:
   - Stuck beans: `beans(filter: { status: ["in-progress"], tags: ["blocked", "failed"] })`
   - Ready to run: `beans(filter: { status: ["in-progress"], excludeTags: ["blocked", "failed"] })`

## Notes
- Use `beans query --json` for GraphQL queries (machine-readable output)
- Use `beans update` / `beans create` for mutations
- Handle both full IDs (beans-xxxx) and short IDs (xxxx)
- No caching - keep this module stateless and simple
- Types are exported from this module and used by Watcher, Scheduler, Orchestrator, etc.
