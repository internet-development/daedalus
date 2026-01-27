---
# daedalus-vc04
title: Integration - Planning Agent
status: todo
type: feature
created_at: 2026-01-26T23:04:03Z
updated_at: 2026-01-26T23:04:03Z
parent: daedalus-19c1
---

Create the planning agent orchestrator that integrates tools, prompts, and skills.

## Files to create

- `src/planning/planning-agent.ts`

## Files to modify

- `package.json` - Add bash-tool dependency

## Tasks

1. Install bash-tool: `npm install bash-tool`

2. Create `createPlanningAgent(mode, config)` function:
   - Load skills via `createSkillTool` from bash-tool
   - Combine tools (existing PLANNING_TOOLS + skill tool)
   - Select system prompt based on mode
   - Inject skill instructions into system prompt
   - Return configured agent with streamText from Vercel AI SDK

3. Add `getSystemPromptForMode(mode, skillInstructions)` helper

4. Export `PlanningMode` type: 'new' | 'refine' | 'critique' | 'sweep' | 'brainstorm' | 'breakdown'

## Integration Pattern

```typescript
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
```

## Verification

- Skills load successfully from ./skills directory
- System prompt combines mode prompt + skill instructions
- Agent has access to all tools (planning tools + skill tool)
- Can create and run agent in each mode
