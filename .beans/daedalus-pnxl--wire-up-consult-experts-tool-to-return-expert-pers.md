---
# daedalus-pnxl
title: Wire up consult_experts tool to return expert persona prompts
status: in-progress
type: feature
priority: high
created_at: 2026-01-29T23:55:33Z
updated_at: 2026-01-29T23:58:27Z
---

## Context

The planning agent has a `consult_experts` tool that is currently a placeholder — it returns a useless message telling the agent to "include expert perspectives in your response." Meanwhile, `expert-advisor.ts` implements a full API-based subagent system that spawns separate LLM calls, but this is dead code we won't use.

Instead of spawning separate LLM calls for each expert, the main planning agent will role-play expert perspectives itself. The `consult_experts` tool becomes a **context loader** — when called, it returns the full persona system prompts for the requested experts, which the planning agent reads and uses to provide feedback from each perspective.

## Current State
- `EXPERT_PROMPTS` in `system-prompts.ts` has 5 personas: pragmatist, architect, skeptic, simplifier, security
- `expert-advisor.ts` (239 lines) spawns separate API calls per expert — dead code, delete it
- `consult_experts` tool in `tools.ts` is a placeholder returning a no-op message
- Config schema (`PersonaSchema`) only supports the 5 existing personas

## Approach

### Upgrade all expert persona prompts in `system-prompts.ts`

The existing 5 prompts are thin (~10 lines each). Replace them with rich, structured prompts based on the OpenCode agent definitions in `.opencode/agents/`. Then add 4 new personas.

**Upgrade existing 5 personas** (use `.opencode/agents/<name>.md` as source):
- **pragmatist** — Add: red flags, output format (scope assessment, simplification, MVP recommendation, ship-blocking concerns), voice phrases
- **architect** — Add: what to look for, output format (system context, design assessment, scalability, evolution path, recommended patterns, tech debt), voice phrases
- **skeptic** — Add: failure categories (input/system/user), output format (assumptions, edge cases table, failure modes, race conditions, "the question you're not asking"), voice phrases
- **simplifier** — Add: simplification strategies (elimination/reduction/substitution/clarification), output format (complexity inventory table, elimination candidates, "the hard question"), voice phrases
- **security** — Add: security checklist (auth/authz/input/data/errors), output format (threat model, attack surface table, vulnerabilities, secrets & credentials), voice phrases

**Add 4 new personas:**
- **researcher** — Evidence-based research, tiered source credibility (Tier 1: official docs/papers, Tier 2: SO/talks, Tier 3: blogs), finds papers/articles/docs to validate decisions. Reference `.opencode/agents/researcher.md`.
- **codebase-explorer** — Deep codebase analysis, pattern discovery, dependency mapping, architecture understanding. Strategy: start broad → follow threads → identify patterns → document. Reference `.opencode/agents/codebase-explorer.md`.
- **ux-reviewer** — CLI/UX design specialist, discoverability, error messages, user workflows. Reference `.opencode/agents/ux-reviewer.md`.
- **critic** — Meta-expert that synthesizes multiple perspectives into actionable feedback, identifies blockers vs concerns vs suggestions. Reference `.opencode/agents/critic.md`.

Each prompt should include: philosophy quote, focus areas, "when invoked" context, questions to ask, domain-specific details (red flags, categories, checklists etc.), structured output format, voice/phrases.

### Wire up `consult_experts` tool in `tools.ts`
Update the tool's `execute` function to:
1. Look up each requested expert in `EXPERT_PROMPTS`
2. Return the full persona prompt text for each expert
3. Include a brief instruction telling the agent to respond from each expert's perspective, addressing the provided context and optional question
4. Return which experts were not found (if any)

### Update the expert enum in `tools.ts`
Expand the `z.enum()` in `consultExpertsInputSchema` from 5 → 9 values.

### Update config schema in `config/index.ts`
Expand `PersonaSchema` enum to include the 4 new personas. Update default enabled list.

### Delete `expert-advisor.ts`
Remove the dead code. Remove its exports from `src/planning/index.ts`.

### Update system prompt expert section in `system-prompts.ts`
Update the inline "Expert Advisors" section (lines ~76-84) to list all 9 experts and clarify they are invoked via the `consult_experts` tool, not inline quotes.

## Files to modify
- `src/planning/system-prompts.ts` — Add 4 new expert prompts, update inline expert list
- `src/planning/tools.ts` — Wire up tool execute, expand enum
- `src/config/index.ts` — Expand PersonaSchema
- `src/planning/expert-advisor.ts` — DELETE
- `src/planning/index.ts` — Remove expert-advisor exports

## Checklist
- [x] Upgrade pragmatist prompt with rich structure from `.opencode/agents/pragmatist.md`
- [x] Upgrade architect prompt with rich structure from `.opencode/agents/architect.md`
- [x] Upgrade skeptic prompt with rich structure from `.opencode/agents/skeptic.md`
- [x] Upgrade simplifier prompt with rich structure from `.opencode/agents/simplifier.md`
- [x] Upgrade security prompt with rich structure from `.opencode/agents/security.md`
- [x] Add researcher persona prompt from `.opencode/agents/researcher.md`
- [x] Add codebase-explorer persona prompt from `.opencode/agents/codebase-explorer.md`
- [x] Add ux-reviewer persona prompt from `.opencode/agents/ux-reviewer.md`
- [x] Add critic persona prompt from `.opencode/agents/critic.md`
- [x] Update consultExpertsInputSchema enum to include all 9 experts
- [x] Wire up consult_experts tool execute to return persona prompts from EXPERT_PROMPTS
- [x] Update PersonaSchema in config/index.ts to include new personas
- [x] Update default enabled personas list in config
- [x] Delete src/planning/expert-advisor.ts
- [x] Remove expert-advisor exports from src/planning/index.ts
- [x] Update Expert Advisors section in system prompt to reference all 9 experts and the tool
- [x] Verify typecheck passes: npm run typecheck

## Changelog

### Implemented
- Upgraded all 5 existing expert persona prompts (pragmatist, architect, skeptic, simplifier, security) with rich structured content including philosophy quotes, "when invoked" context, domain-specific details (red flags, failure categories, security checklists, simplification strategies), structured output formats, and voice/phrases
- Added 4 new expert persona prompts: researcher, codebase-explorer, ux-reviewer, critic
- Wired up `consult_experts` tool to return full persona prompt text for each requested expert, with instruction context and not-found reporting
- Expanded `consultExpertsInputSchema` enum from 5 to 9 expert types
- Expanded `PersonaSchema` config enum to include all 9 personas
- Updated default enabled personas from `['pragmatist', 'architect', 'skeptic']` to `['pragmatist', 'architect', 'skeptic', 'simplifier', 'security']`
- Updated Expert Advisors section in base planning prompt to list all 9 experts and reference the `consult_experts` tool
- Deleted dead code `expert-advisor.ts` (239 lines) that spawned separate API calls per expert
- Removed expert-advisor exports from `src/planning/index.ts`

### Files Modified
- `src/planning/system-prompts.ts` — Replaced all 5 expert prompts with rich versions, added 4 new prompts, updated inline Expert Advisors section
- `src/planning/tools.ts` — Added import of EXPERT_PROMPTS, expanded enum to 9 values, rewrote execute function to return persona prompts
- `src/config/index.ts` — Expanded PersonaSchema enum to 9 values, updated default enabled list
- `src/planning/expert-advisor.ts` — DELETED
- `src/planning/index.ts` — Removed expert-advisor exports block

### Deviations from Spec
- Default enabled personas expanded to 5 (added simplifier, security) instead of keeping original 3 — the original 3 felt too narrow given we now have 9 available experts, and the 5 core experts are the most generally useful
- New expert keys use kebab-case (`codebase-explorer`, `ux-reviewer`) to match the `.opencode/agents/` filenames and be consistent with CLI conventions

### Decisions Made
- Used kebab-case for new expert keys (e.g., `codebase-explorer` not `codebaseExplorer`) for consistency with the `.opencode/agents/` file naming convention
- The `consult_experts` tool returns both the instruction (with context/question) and the full persona prompts, so the planning agent has everything it needs in one tool call
- Each prompt faithfully adapts the `.opencode/agents/*.md` content but is formatted as a string template literal suitable for embedding in TypeScript

### Known Limitations
- No tests added — the tool execute function is straightforward lookup logic and the prompts are static strings; the typecheck validates the type-level correctness