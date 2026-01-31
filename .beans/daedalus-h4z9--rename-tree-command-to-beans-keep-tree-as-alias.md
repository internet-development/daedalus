---
# daedalus-h4z9
title: Rename /tree command to /beans (keep /tree as alias)
status: todo
type: task
priority: normal
created_at: 2026-01-30T07:37:37Z
updated_at: 2026-01-30T07:53:28Z
---

## Summary

Rename the `/tree` slash command to `/beans` as the primary command name, since it displays beans and "beans" is more descriptive. Keep `/tree` and `/t` as backwards-compatible aliases.

## Rationale

The command shows the beans hierarchy, so `/beans` is a more intuitive and discoverable name. Keeping `/tree` as an alias avoids breaking muscle memory.

## Checklist

- [ ] Rename `/tree` to `/beans` in `COMMAND_NAMES` array (`src/cli/commands.ts:46`), add `/tree` as alias alongside existing `/t`
- [ ] Update the command handler switch in `src/cli/commands.ts:171-173` to use `case 'beans':` as primary, with `'tree'` and `'t'` as fallthrough aliases
- [ ] Rename `handleTree` to `handleBeans` in `src/cli/commands.ts:371`
- [ ] Update help text in `src/cli/output.ts:134` — change entry to `['/beans', 'Show beans tree']` and add alias note
- [ ] Update interactive help in `src/cli/index.ts:115` — change `/tree [args]` to `/beans [args]`
- [ ] Update CLI argument docs in `src/cli/index.ts:92` to say `daedalus beans` (keep `daedalus tree` as alias)
- [ ] Update CLI main command switch in `src/cli/index.ts:133-137` to handle both `'beans'` and `'tree'`
- [ ] Update `parseTreeArgs` function name to `parseBeansArgs` in `src/cli/index.ts:78-80`
- [ ] Update tab completion in `src/cli/completer.ts` to include `/beans` in completions
- [ ] Update tests in `src/cli/commands.test.ts` to test `/beans` as primary command
- [ ] Update tab completion test in `src/cli/completer.test.ts:30` to include `/beans`
- [ ] Verify `/tree` and `/t` still work as aliases after the rename