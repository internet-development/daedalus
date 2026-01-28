---
# daedalus-chpa
title: Research and implement testing strategy for Ink-based TUI
status: scrapped
type: task
priority: normal
created_at: 2026-01-27T09:28:23Z
updated_at: 2026-01-28T04:23:52Z
---

Research how other Ink-based CLI tools handle testing, and develop a testing strategy for daedalus.

## Research Questions
- How do popular Ink projects test their UIs? (ink itself, pastel, etc.)
- What testing libraries work well with Ink? (ink-testing-library?)
- How to test React hooks in a Node.js/Ink context?
- How to snapshot test terminal output?
- How to test streaming/async behavior?

## Projects to Research
- ink (the library itself) - how do they test?
- pastel - Ink-based CLI framework
- jest (uses Ink for output) - how do they test their CLI?
- gatsby-cli - uses Ink
- npm CLI tools using Ink

## Deliverables
- Summary of testing approaches used by other projects
- Recommended testing strategy for daedalus
- List of testing libraries/tools to adopt
- Example test setup for one component