---
# daedalus-vc04
title: Integration - Planning Agent
status: completed
type: feature
priority: normal
created_at: 2026-01-26T23:04:03Z
updated_at: 2026-01-27T01:53:36Z
parent: daedalus-19c1
blocking:
    - daedalus-rbot
---

Create the planning agent orchestrator that integrates tools, prompts, and skills.

## Files to create

- `src/planning/planning-agent.ts`

## Files to modify

- `package.json` - Add bash-tool dependency

## Checklist

- [x] Install bash-tool: `npm install bash-tool`
- [x] Create `createPlanningAgent(mode, config)` function:
  - [x] Load skills via `createSkillTool` from bash-tool
  - [x] Combine tools (existing PLANNING_TOOLS + skill tool)
  - [x] Select system prompt based on mode
  - [x] Inject skill instructions into system prompt
  - [x] Return configured agent with streamText from Vercel AI SDK
- [x] Add `getSystemPromptForMode(mode, skillInstructions)` helper
- [x] Export `PlanningMode` type: 'new' | 'refine' | 'critique' | 'sweep' | 'brainstorm' | 'breakdown'
- [x] Update AI SDK to v6 (required by bash-tool dependency)
- [x] Fix existing tools.ts, expert-advisor.ts, usePlanningAgent.ts for AI SDK v6 compatibility
- [x] Export from planning/index.ts

## Integration Pattern

\`\`\`typescript
// Load skills (Layer 3)
const { skill, files, instructions } = await createSkillTool({
  skillsDirectory: './skills',
});

// Combine tools (Layer 1)
const tools = { ...PLANNING_TOOLS, skill };

// Select prompt (Layer 2) + inject skill instructions
const systemPrompt = getSystemPromptForMode(mode, instructions);

// Create agent
return streamText({ model, system: systemPrompt, tools });
\`\`\`

## Verification

- [x] Skills load successfully from ./skills directory
- [x] System prompt combines mode prompt + skill instructions
- [x] Agent has access to all tools (planning tools + skill tool)
- [x] Can create and run agent in each mode (via `createPlanningAgent` and `runPlanningAgent`)
- [x] Typecheck passes