---
# daedalus-d7g8
title: 'TUI: Border overflow - views set conflicting heights'
status: completed
type: bug
priority: normal
created_at: 2026-01-26T23:13:43Z
updated_at: 2026-01-27T01:45:25Z
parent: daedalus-kvgh
---

The TUI has border rendering issues related to scrolling:
1. Need to scroll to get the top border to show initially
2. When scrolling, the bottom border disappears

## Root Cause: FOUND ✓

### Multiple Conflicting Height Calculations

**App.tsx (parent container):**
```tsx
const contentHeight = Math.max(terminalHeight - 5, 10);  // e.g., 24 - 5 = 19

<Box height={contentHeight} borderStyle="single" borderTop={false} borderBottom={false}>
  {view === 'execute' && <ExecuteView />}
</Box>
```

**ExecuteView.tsx (child):**
```tsx
const terminalHeight = stdout?.rows ?? 24;

<Box height={terminalHeight - 5} paddingX={1}>  // Also 24 - 5 = 19!
```

**The problem:** ExecuteView sets its height to `terminalHeight - 5` (19 rows), but it's INSIDE a parent that's also 19 rows with borders. The child can't fit inside the parent, causing overflow.

### Affected Views

| View | Height Calculation | Issue |
|------|-------------------|-------|
| ExecuteView | `height={terminalHeight - 5}` | Same as parent - causes overflow |
| PlanView | `chatHeight = terminalHeight - ... - 8` | Independent calculation, may overflow |
| MonitorView | No explicit height | Uses flexbox, may still overflow |

### Why Borders Disappear

1. Views calculate their own heights based on terminal size
2. These heights don't account for being INSIDE the App content area
3. Content overflows the parent container
4. Ink pushes borders off-screen to accommodate overflow

## Solution

### Fix 1: Remove explicit heights from views (Quick fix)

Views should NOT set their own heights. Let the parent container constrain them:

**ExecuteView.tsx - BEFORE:**
```tsx
<Box flexDirection="column" paddingX={1} height={terminalHeight - 5}>
```

**ExecuteView.tsx - AFTER:**
```tsx
<Box flexDirection="column" paddingX={1} flexGrow={1}>
```

Same for PlanView - remove terminal-based height calculations, use flexGrow.

### Fix 2: Single border container (Better fix)

Move all borders to App.tsx with proper height accounting:

```tsx
// App.tsx
<Box borderStyle="single" height={terminalHeight}>
  <HeaderContent />  {/* No individual border */}
  <Divider />
  <Box flexGrow={1} overflow="hidden">
    {currentView}  {/* Views use flexGrow, no explicit height */}
  </Box>
  <Divider />
  <StatusBarContent />  {/* No individual border */}
</Box>
```

### Fix 3: Pass available height to views (Most robust)

App.tsx calculates and passes `availableHeight` as a prop:

```tsx
// App.tsx
const availableHeight = terminalHeight - headerHeight - statusBarHeight - borderHeight;

<ContentArea>
  {view === 'execute' && <ExecuteView maxHeight={availableHeight} />}
</ContentArea>
```

Views use this prop instead of calculating from terminal size.

## Files to Modify

- `src/ui/App.tsx` - Single border container, calculate available height
- `src/ui/views/ExecuteView.tsx` - Remove `height={terminalHeight - 5}`, use flexGrow
- `src/ui/views/PlanView.tsx` - Remove terminal-based height calc, use flexGrow
- `src/ui/views/MonitorView.tsx` - Verify no height overflow issues
- `src/ui/Header.tsx` - Remove individual borders
- `src/ui/StatusBar.tsx` - Remove individual borders

## Implementation Checklist

### Quick Fix (do first)
- [x] ExecuteView: Replace `height={terminalHeight - 5}` with `flexGrow={1}`
- [x] PlanView: Remove `chatHeight` calculation, use flexGrow
- [x] Test if borders now stay visible

### Full Fix (if quick fix isn't enough)
- [ ] App.tsx: Single outer border container
- [ ] Add Divider components for ├───┤ separators
- [ ] Header/StatusBar: Remove individual borders, export content-only components
- [ ] Pass `availableHeight` prop to views if they need it for internal scrolling
- [ ] Test in multiple terminals

### Verification
- [x] Top border visible on initial render
- [x] Bottom border visible during scroll
- [x] All three views (Monitor, Execute, Plan) work correctly
- [x] Scrolling within views doesn't affect outer borders

## Fix Applied

Quick fix was sufficient! The issue was that views were calculating their own height using `terminalHeight - N` which caused them to overflow their parent container (which had the same or smaller height). By replacing explicit heights with `flexGrow={1}`, the views now properly fill the available space without overflowing.

Changes made:
1. ExecuteView.tsx: Changed `height={terminalHeight - 5}` to `flexGrow={1}`
2. PlanView.tsx: Removed `chatHeight` calculation, changed chat history box to use `flexGrow={1}`
