---
# daedalus-kfjn
title: Talos execution lifecycle improvements
status: completed
type: epic
priority: high
created_at: 2026-01-27T00:36:31Z
updated_at: 2026-01-27T01:27:26Z
parent: daedalus-na2v
---

## Overview

Improvements to how Talos handles agent execution lifecycle - cancellation, spawn errors, and error organization.

## Children

- **daedalus-m31s**: Fix cancel/stop to not create spurious crash beans
- **daedalus-53p0**: Handle spawn errors properly (cleanup + crash bean)
- **daedalus-uool**: Organize crash beans under Errors epic

## Context

These fixes address issues discovered when investigating why:
1. Stopping execution creates unwanted 'Crash' or 'Cancelled' beans
2. Agent subprocess failures leave system in inconsistent state

## Implementation Order

1. **daedalus-53p0** (spawn errors) - small, independent fix
2. **daedalus-m31s** (cancel lifecycle) - medium, changes AgentRunner interface  
3. **daedalus-uool** (Errors epic) - small, depends on knowing where crash beans are created