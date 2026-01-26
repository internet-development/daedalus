---
# daedalus-dbon
title: 'Plan View: AI Planning Workbench'
status: in-progress
type: feature
priority: high
created_at: 2026-01-26T05:40:32Z
updated_at: 2026-01-26T10:03:17Z
parent: daedalus-kvgh
---

An AI-powered planning workbench for creating, refining, and critiquing beans. The Plan View is central to the Daedalus workflow - it's where all beans originate through structured conversation with a dedicated planning agent and its expert advisors.

## Core Concept

The planning agent is a **dedicated AI that only plans** - it cannot execute code, only:
- Read code (understand the codebase)
- Run read-only commands (git status, ls, etc.)
- Search the web for existing solutions and approaches
- Consult "expert" sub-agents for specialized advice
- Create and modify beans via `beans` CLI

This separation ensures planning stays focused on design and architecture, not implementation details.

## Expert Advisors

The planning agent can consult specialized sub-agents with distinct personalities:

| Expert | Personality | Focus |
|--------|-------------|-------|
| Pragmatist | "Ship it" mentality | MVP scope, avoiding over-engineering, time-to-value |
| Architect | Systems thinker | Scalability, maintainability, separation of concerns |
| Skeptic | Devil's advocate | Edge cases, failure modes, "what could go wrong?" |
| Simplifier | Less is more | Reducing complexity, questioning necessity |
| Security | Paranoid by design | Auth, data exposure, input validation |

The planning agent decides when to consult which expert, synthesizes their input, and presents options to the user.

## Modes of Operation

### 1. New Bean Creation (default)
Chat freely to explore ideas. Agent researches codebase, searches web for solutions, presents approaches, asks clarifying questions, and creates draft beans.

### 2. Bean Refinement
Select an existing draft bean to iterate on. Agent reviews the bean, identifies gaps or ambiguities, and helps refine scope and checklist.

### 3. Bean Critique
Run a draft bean through expert review. Each advisor provides feedback, agent synthesizes into actionable questions for the user.

### 4. Final Sweep (Consistency Check)
Before promoting beans to `todo`, run a final consistency check across all related beans. The agent:
- Reads all beans in a milestone/epic
- Identifies logical inconsistencies (conflicting decisions, missing dependencies)
- Checks for terminology inconsistencies (same concept named differently)
- Verifies blocking relationships make sense
- Flags ambiguous or under-specified requirements
- Suggests fixes or asks clarifying questions

This catches issues that only become visible when viewing the full picture.

### 5. Custom Prompts
User-defined prompts that guide the planning conversation. Examples:
- "Challenge every assumption in this bean"
- "Find 3 existing open-source solutions for this"
- "Break this into the smallest possible increments"
- "What's the riskiest part of this plan?"

## Layout
```
Plan View                                           [Mode: New Bean]
────────────────────────────────────────────────────────────────────

You: I want to add a notification system

Planner: Let me research your codebase and look for existing patterns...

         [Searching codebase for notification, toast, alert...]
         [Searching web for "react notification system patterns 2026"]

         I found a few things:
         - Your codebase uses react-hot-toast in 2 places
         - Popular approaches: Sonner, react-toastify, custom context

         Let me consult the experts...

         > Pragmatist: "Stick with react-hot-toast, it's already there"
         > Architect: "Consider a notification context for future growth"
         > Simplifier: "Do you really need this? What problem does it solve?"

         Based on this, I have some questions:

         What's the primary use case?
         [1] Success/error feedback for user actions
         [2] Real-time updates from background processes  
         [3] Both

You: 1

Planner: Good - that's simpler. One more question...

────────────────────────────────────────────────────────────────────
> Type your message...                              [Enter] Send
                                           [Ctrl+P] Prompts [Esc] Back
```

## Voice Input (Future)

Support voice-to-text input using local models for hands-free planning:
- **Qwen2.5-Omni-7B** - Alibaba's multimodal model, runs on mobile/edge devices
- **Qwen3-Omni** - Latest version with real-time speech recognition
- Whisper.cpp as fallback

Voice enables natural conversation flow without keyboard context-switching.

## Decisions

**Planning agent**: Separate config in talos.yml (`planning_agent` section). Planning benefits from different models, temperature, and tool access than execution.

**Bean creation**: AI calls beans CLI directly. Give the planning agent access to run `beans create`, `beans update`, and `beans query` commands.

**Chat persistence**: Persist to file (`.talos/chat-history.json`). Planning context is valuable across sessions.

**Expert implementation**: Sub-agents with distinct system prompts. Planning agent spawns them as needed and synthesizes responses.

**Custom prompts**: Store in `.talos/prompts/` as markdown files. User can create/edit these to customize their planning workflow.

**AI SDK**: Use Vercel AI SDK (`@ai-sdk/anthropic`, `@ai-sdk/openai`) for API calls. Mature library with streaming, tool calling, and multi-provider support.

## Checklist

### Core Components
- [x] Create PlanView component with mode switching
- [x] Create ChatHistory component with message rendering
- [x] Create ChatInput component with keyboard handling
- [x] Create MultipleChoice component for structured questions
- [x] Create ExpertQuote component for advisor responses

### Planning Agent
- [x] Define planning agent config schema in talos.yml
- [x] Set up Vercel AI SDK (@ai-sdk/anthropic, @ai-sdk/openai)
- [x] Create planning agent system prompt (read-only, bean-focused)
- [x] Implement tool definitions for AI SDK (read files, run safe commands, web search)
- [x] Implement beans CLI tool for AI SDK (create, update, query)
- [x] Support streaming responses via AI SDK streamText()

### Expert Advisors
- [x] Define expert personas and system prompts
- [ ] Implement expert consultation (spawn sub-agent, collect response)
- [ ] Create expert synthesis logic in planning agent
- [x] Add expert toggle (enable/disable specific experts)

### Modes
- [x] Implement New Bean Creation mode
- [x] Implement Bean Refinement mode (load existing draft)
- [x] Implement Bean Critique mode (structured expert review)
- [x] Implement Final Sweep mode (cross-bean consistency check)
- [x] Create mode switcher UI

### Custom Prompts
- [x] Create prompts directory structure
- [x] Implement prompt loader
- [x] Add prompt selector UI (Ctrl+P)
- [x] Include default prompts (challenge, simplify, research, etc.)

### Persistence
- [x] Implement chat history save/load
- [x] Handle multiple chat sessions
- [x] Add clear chat command

### Voice Input (Future)
- [ ] Research Qwen-Omni integration options
- [ ] Add voice input toggle
- [ ] Implement speech-to-text pipeline

## AI Integration

```yaml
# talos.yml example
planning_agent:
  provider: claude          # or opencode, openai, etc.
  model: claude-sonnet-4-20250514
  temperature: 0.7          # more creative for planning
  tools:
    - read_file
    - glob
    - grep  
    - bash_readonly         # ls, git status, etc.
    - web_search
    - beans_cli
  
experts:
  enabled: true
  personas:
    - pragmatist
    - architect
    - skeptic
    # - simplifier          # disabled
    # - security            # disabled
```

## Keyboard Shortcuts
- `Enter`: Send message
- `Shift+Enter`: Newline in input
- `Tab`: Accept suggestion / select choice
- `1-9`: Quick select multiple choice
- `Ctrl+P`: Open prompt selector
- `Ctrl+M`: Switch mode
- `Ctrl+L`: Clear chat
- `Esc`: Back to Monitor
