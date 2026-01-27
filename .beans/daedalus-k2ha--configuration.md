---
# daedalus-k2ha
title: Configuration
status: todo
type: task
priority: normal
created_at: 2026-01-26T23:04:03Z
updated_at: 2026-01-27T01:06:12Z
parent: daedalus-19c1
blocking:
    - daedalus-sk55
---

Add configuration schema for planning modes and skills.

## Files to modify

- `src/config/index.ts` - Zod schema
- `talos.yml` - Default config

## Tasks

1. Add `planning.skills_directory` field (default: `./skills`)

2. Add `planning.modes.brainstorm` config:
   ```yaml
   brainstorm:
     enabled: true
     skill: beans-brainstorming
     enforce_for_types: [feature, epic, milestone]
   ```

3. Add `planning.modes.breakdown` config:
   ```yaml
   breakdown:
     enabled: true
     skill: beans-breakdown
     min_task_duration_minutes: 2
     max_task_duration_minutes: 5
     suggest_test_beans: true
   ```

4. Validate skill names match directory structure

5. Update Zod schema with new fields

## Verification

- `talos.yml` loads with new config
- Invalid config triggers Zod validation errors
- Skills directory path resolves correctly
- Mode settings control agent behavior
- Config changes are picked up on restart
