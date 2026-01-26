---
# daedalus-neut
title: 'Bean Watcher: File system change detection'
status: completed
type: feature
priority: critical
created_at: 2026-01-26T05:39:03Z
updated_at: 2026-01-26T09:29:23Z
parent: daedalus-ss8m
blocking:
    - daedalus-4h5x
---

Watch the .beans/ directory for file changes and emit typed events when beans are created, modified, or deleted.

## Decisions Made

- **Event scope**: Emit events for ALL bean changes (not just status) - UI may want to show title/body updates
- **Startup behavior**: Silent load, then watch. Provide `getBeans()` for initial state, emit events only for subsequent changes.

## Interface
```typescript
class BeanWatcher extends EventEmitter {
  constructor(beansPath: string);
  
  // Lifecycle
  start(): Promise<void>;  // Load initial state, start watching
  stop(): void;
  
  // State access
  getBeans(): Map<string, Bean>;  // Get current cached state
  getBean(id: string): Bean | null;
  
  // Events (emitted after start() completes)
  on(event: 'created', cb: (bean: Bean) => void): this;
  on(event: 'updated', cb: (bean: Bean, previous: Bean) => void): this;
  on(event: 'deleted', cb: (beanId: string) => void): this;
  on(event: 'status-changed', cb: (bean: Bean, from: BeanStatus, to: BeanStatus) => void): this;
  on(event: 'tags-changed', cb: (bean: Bean, added: string[], removed: string[]) => void): this;
  on(event: 'error', cb: (error: Error, filePath?: string) => void): this;
}
```

## Usage Pattern
```typescript
const watcher = new BeanWatcher('.beans');
await watcher.start();

// Get initial state for UI
const beans = watcher.getBeans();
renderUI(beans);

// Subscribe to changes (Orchestrator wires these to other components)
watcher.on('created', bean => console.log('New bean:', bean.title));
watcher.on('updated', (bean, prev) => console.log('Updated:', bean.title));
watcher.on('deleted', id => console.log('Deleted:', id));
watcher.on('status-changed', (bean, from, to) => {
  console.log(`${bean.id}: ${from} → ${to}`);
});
watcher.on('tags-changed', (bean, added, removed) => {
  if (added.length) console.log(`${bean.id} tags added:`, added);
  if (removed.length) console.log(`${bean.id} tags removed:`, removed);
});
```

Note: The Orchestrator (daedalus-4h5x) wires Watcher events to Scheduler and CompletionHandler.

## Checklist
- [x] Set up chokidar watcher on .beans/ directory
- [x] Implement `start()` to load initial state via beans client
- [x] Parse bean files on change using beans client
- [x] Detect status changes by comparing with cached state
- [x] Detect tag changes by comparing with cached state (for blocked/failed tags)
- [x] Emit `status-changed` event specifically for status transitions
- [x] Emit `tags-changed` event when tags are added/removed
- [x] Emit `updated` event for any change (including status)
- [x] Emit `created` / `deleted` for new/removed beans
- [x] Handle file renames (delete + create)
- [x] Debounce rapid changes (100ms window)
- [x] Maintain in-memory cache of bean states
- [x] Implement `getBeans()` and `getBean()` for state access
- [x] Clean up watcher on `stop()`

## Implementation Notes
- Use chokidar for cross-platform file watching
- Cache previous bean states to detect status changes
- Ignore .beans/.index and other non-bean files
- 100ms debounce window for rapid edits
- Only emit events after `start()` resolves (not during initial load)
