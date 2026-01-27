# Brainstorming Examples

Real-world examples of the beans-brainstorming workflow in action.

## Example 1: Feature Request - Dark Mode

### Phase 1: Socratic Questions

**Agent**: What type of work is this?
- [ ] New feature for users
- [ ] Bug fix or correction
- [ ] Internal improvement
- [x] Other

**User**: It's a new feature - adding dark mode to the app.

**Agent**: Who is the primary audience for dark mode?
- [ ] All users (make it the default or prominent option)
- [ ] Power users (available in settings)
- [ ] Accessibility users (important for eye strain/sensitivity)
- [x] All of the above

**User**: All of the above, but especially helpful for accessibility.

**Agent**: What parts of the app should support dark mode?
- [ ] Just the main UI chrome (navigation, sidebars)
- [ ] Chrome + content areas
- [x] Everything including embedded content
- [ ] Let me specify...

**User**: Everything - we want a complete dark mode experience.

**Agent**: Should dark mode sync with system preferences?
- [x] Yes, follow OS dark mode setting automatically
- [ ] No, only manual toggle
- [ ] Both - default to system, allow override

**User**: Yes, follow the system setting.

**Agent**: Are there any brand colors that MUST stay the same in dark mode?
- [ ] Yes, our brand colors should never change
- [ ] Some colors can adapt, but logo/accent should stay
- [x] All colors can adapt appropriately for dark mode
- [ ] Let me specify...

**User**: Colors can adapt as long as contrast ratios are maintained.

### Phase 2: Incremental Design

**Agent - Section 1: Problem Summary**

Users currently have no way to reduce the brightness of the application interface. This causes eye strain during extended use, especially in low-light environments. The feature will benefit all users but is particularly important for accessibility - some users have light sensitivity conditions that make bright interfaces painful to use.

The app should automatically detect the operating system's dark mode preference and apply a coordinated dark theme across all UI surfaces, including navigation, content areas, and any embedded components.

Does this accurately capture the problem?

**User**: Yes, that's right.

**Agent - Section 2: Proposed Approach**

I recommend a CSS custom properties approach:

1. Define all colors as CSS variables in a central theme file
2. Create two theme variants: `light` (default) and `dark`
3. Use `prefers-color-scheme` media query for automatic detection
4. Apply theme class to the root element for consistent cascading

This approach is:
- **Maintainable**: Single source of truth for colors
- **Performant**: No runtime color calculations
- **Accessible**: Works with browser/OS preferences out of the box

Does this approach make sense?

**User**: Yes, but can users also manually override?

**Agent - Section 2 (Revised)**

Updated approach with manual override:

1. Define colors as CSS variables in `theme.css`
2. Create `light` and `dark` theme variants
3. Check user preference in this order:
   - Stored preference in localStorage (if set)
   - OS preference via `prefers-color-scheme`
   - Default to light theme
4. Add theme toggle component to settings
5. Apply theme class to document root

This gives automatic behavior with user control when needed.

Does this approach make sense?

**User**: Perfect.

### Phase 3: Bean Creation

```bash
beans create "Add dark mode support with system preference detection" \
  -t feature \
  -s draft \
  -d "## Problem

Users have no way to reduce interface brightness, causing eye strain in low-light conditions. This is especially impactful for users with light sensitivity.

## Solution

Implement CSS custom properties-based theming with automatic OS preference detection and manual override capability.

## Implementation

1. Create \`src/styles/theme.css\` with color variables
2. Add \`ThemeProvider\` context in \`src/context/theme.tsx\`
3. Implement \`useTheme\` hook for components
4. Add theme toggle to Settings page
5. Persist preference in localStorage

## Files to Modify

- \`src/styles/theme.css\` - Create new theme variables file
- \`src/context/theme.tsx\` - Create ThemeProvider and useTheme hook
- \`src/components/Settings.tsx\` - Add theme toggle
- \`src/App.tsx\` - Wrap with ThemeProvider
- \`src/index.css\` - Import theme variables

## Verification

- [ ] Light theme displays correctly
- [ ] Dark theme displays correctly
- [ ] Follows OS preference when no override set
- [ ] Manual toggle persists across sessions
- [ ] All components respect theme variables
- [ ] Contrast ratios meet WCAG AA standards"
```

---

## Example 2: Bug Report - Performance Issue

### Phase 1: Socratic Questions

**Agent**: What behavior are you observing?

**User**: The dashboard takes 10+ seconds to load.

**Agent**: When did this start happening?
- [ ] Always been slow
- [x] Started recently (past few days/weeks)
- [ ] After a specific change (please describe)
- [ ] Intermittent/unpredictable

**User**: Started recently, maybe 2 weeks ago.

**Agent**: Does it happen for all users or specific conditions?
- [ ] All users, all the time
- [ ] All users, sometimes
- [x] Specific users or data conditions
- [ ] Only in certain environments

**User**: Users with lots of data (100+ items) are affected.

**Agent**: What have you tried to diagnose?
- [ ] Browser dev tools / Network tab
- [ ] Server logs
- [ ] Database query analysis
- [x] Nothing yet

**User**: Haven't dug into it yet.

### Phase 2: Incremental Design

**Agent - Section 1: Problem Summary**

The dashboard is experiencing significant load time degradation (10+ seconds) for users with large datasets (100+ items). This is a regression that appeared approximately two weeks ago. The issue is data-volume dependent, suggesting either an N+1 query problem, missing pagination, or unoptimized data fetching.

Does this accurately describe the issue?

**User**: Yes, exactly.

**Agent - Section 2: Investigation Plan**

Before proposing a fix, I recommend this investigation approach:

1. **Profile the API endpoint** - Identify which queries are slow
2. **Check recent commits** - Look for changes ~2 weeks ago affecting dashboard
3. **Add query logging** - Measure actual query counts and times
4. **Test with sample data** - Reproduce with 100, 500, 1000 items

Likely culprits based on symptoms:
- N+1 query introduced by eager loading change
- Missing LIMIT clause on a query
- New computed field requiring additional queries

Should I create a task for investigation, or do you have a hypothesis about the cause?

**User**: I think it's the new activity feed we added. Can you investigate that?

### Phase 3: Bean Creation

```bash
beans create "Investigate and fix dashboard performance regression" \
  -t bug \
  -s draft \
  -p high \
  -d "## Problem

Dashboard load time has regressed from <2s to 10+ seconds for users with 100+ items. Regression appeared ~2 weeks ago, correlating with the new activity feed feature.

## Investigation

Primary suspect: Activity feed feature may be causing N+1 queries or unbounded data fetching.

Steps:
1. Profile \`GET /api/dashboard\` endpoint
2. Review activity feed implementation for query patterns
3. Check if activity feed fetches all history vs. paginated
4. Measure query count before/after activity feed

## Files to Investigate

- \`src/api/dashboard.ts\` - Dashboard endpoint handler
- \`src/services/activity-feed.ts\` - Activity feed data fetching
- \`src/db/queries/activity.ts\` - Activity-related queries

## Acceptance Criteria

- [ ] Root cause identified and documented
- [ ] Dashboard loads in <3s for users with 100+ items
- [ ] Dashboard loads in <5s for users with 1000+ items
- [ ] No N+1 queries in dashboard endpoint
- [ ] Activity feed is paginated (last 50 items max)"
```

---

## Key Patterns

### Good Questions

- Specific, not open-ended
- Multiple choice when possible
- Progress toward actionable understanding

### Good Design Sections

- 200-300 words each
- One concept per section
- End with validation question

### Good Beans

- Clear, specific title
- Structured body with sections
- Concrete file paths
- Testable acceptance criteria
