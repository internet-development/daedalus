# Planning Workflow Guide

This guide covers the planning workflow in Daedalus, which uses a three-layer architecture to help you design, plan, and break down work before execution.

## Overview

The planning workflow transforms vague ideas into well-specified, actionable beans through structured conversation. It uses:

1. **Brainstorm Mode** - Socratic questioning for design exploration
2. **Breakdown Mode** - Task decomposition for implementation planning

Both modes produce beans as output, not markdown files. This keeps your work tracked and executable by Daedalus agents.

## When to Use Each Mode

### Brainstorm Mode

Use brainstorm when you have:
- A new feature idea without clear requirements
- A problem to solve but multiple possible approaches
- An epic or milestone that needs design work
- A bug whose fix requires architectural decisions

Brainstorm mode guides you through:
1. Understanding the problem (Socratic questions)
2. Exploring solutions (incremental design)
3. Creating spec beans (documented decisions)

### Breakdown Mode

Use breakdown when you have:
- A feature/epic bean ready for implementation
- Work that would take more than 30 minutes
- Multiple files or components to modify
- Logical phases or dependencies to manage

Breakdown mode produces:
- Child task beans (2-5 minutes each)
- Blocking relationships (execution order)
- Optional test beans (TDD workflow)

## The Planning Workflow

Here's a typical workflow from idea to execution:

```
Epic (vague idea)
    |
    v
[Brainstorm Mode]
    |
    v
Spec Bean (detailed design)
    |
    v
[Breakdown Mode]
    |
    v
Child Tasks (actionable work)
    |
    v
[Execute View]
    |
    v
Completed Work
```

### Step 1: Create the Epic

Start with a high-level bean capturing the idea:

```bash
beans create "User authentication system" -t epic -s draft -d "We need a way to authenticate users. Details TBD."
```

### Step 2: Brainstorm the Design

Switch to brainstorm mode in Plan View (press `Tab` to cycle modes).

The planning agent will:
1. Ask clarifying questions (one at a time)
2. Offer multiple-choice options when possible
3. Present design in 200-300 word sections
4. Wait for your validation before continuing

Example conversation:

```
Agent: What type of authentication are you looking for?
  [1] Username/password (traditional)
  [2] OAuth (Google, GitHub, etc.)
  [3] Magic link (passwordless)
  [4] Multi-factor authentication

You: 2

Agent: Which OAuth providers should we support initially?
  [1] Google only (simplest)
  [2] Google + GitHub
  [3] Google + GitHub + Microsoft
  [4] Pluggable provider system

You: 2

Agent: Let me present the proposed approach...

## Section 1: Authentication Flow

The user clicks "Sign in with Google/GitHub", redirects to the provider,
returns with a token, and we create/update their account...

Does this align with your vision?

You: Yes, but we also need to handle returning users

Agent: Good point. Let me revise to include session management...
```

### Step 3: Review the Spec Bean

After brainstorming, the agent creates a spec bean:

```yaml
title: OAuth authentication with Google and GitHub
type: feature
status: draft
parent: <epic-id>

## Problem

Users need to authenticate to access the application...

## Solution

Implement OAuth 2.0 flow with Google and GitHub providers...

## Implementation

1. Create OAuth configuration module
2. Implement callback handlers
3. Add session management
4. Create user profile linking

## Files to Modify

- `src/auth/oauth.ts` - OAuth flow logic
- `src/auth/providers/` - Provider configurations
- `src/routes/auth.ts` - Auth routes
- `src/middleware/session.ts` - Session handling
```

### Step 4: Break Down into Tasks

Switch to breakdown mode. The agent will:
1. Read the spec bean
2. Research the codebase
3. Create child task beans

Example output:

```
I'll create these tasks:

1. [task] Create OAuth configuration types
   - src/auth/types.ts
   - Defines OAuthConfig, Provider interfaces

2. [task] Implement OAuth flow handler
   - src/auth/oauth.ts
   - Authorization URL, token exchange

3. [task] Add Google provider
   - src/auth/providers/google.ts
   - Google-specific configuration

4. [task] Add GitHub provider
   - src/auth/providers/github.ts
   - GitHub-specific configuration

5. [task] Create auth routes
   - src/routes/auth.ts
   - /auth/google, /auth/github, /auth/callback

Would you like me to create these beans?
```

### Step 5: TDD Suggestions

The agent may suggest test beans:

```
This feature has user-facing behavior that benefits from test coverage.

Would you like to use TDD for any of these components?

[1] Yes - test beans block implementation (write tests first)
[2] No - implementation beans block tests (implement first)
[3] Parallel - no blocking (independent)
```

If you choose TDD:
- Test bean is created first
- Implementation bean is blocked by test bean
- Agent works on test before implementation

### Step 6: Execute

Switch to Execute View. Your task beans are now queued:

```
> daedalus-abc1: Create OAuth configuration types      [todo] READY
  daedalus-abc2: Implement OAuth flow handler          [todo] (blocked by abc1)
  daedalus-abc3: Add Google provider                   [todo] (blocked by abc2)
  ...
```

## Bean Types in Planning

### Planning Beans vs Implementation Beans

| Bean Type | Purpose | Who Works On It |
|-----------|---------|-----------------|
| milestone | Release target | Humans (coordination) |
| epic | Thematic grouping | Humans (planning) |
| feature | User-facing spec | Planning agent |
| task | Concrete work | Execution agent |
| bug | Something broken | Either |

**Planning beans** (milestone, epic, feature):
- Contain design decisions and rationale
- May have checklists tracking child beans
- Usually worked on in brainstorm/breakdown modes

**Implementation beans** (task, bug):
- Contain specific file paths and changes
- Have verification criteria
- Executed by coding agents

### Bean Hierarchy

The type hierarchy enforces sensible structure:

```
milestone
    └── epic
        └── feature
            └── task / bug
```

Use `--parent` when creating child beans:

```bash
beans create "Login form component" -t task --parent daedalus-abc1
```

## Agent Skills Format

The planning workflow uses Agent Skills - portable, reusable workflow definitions.

### What are Agent Skills?

Skills are markdown files that teach agents specific workflows:

```
skills/
├── beans-brainstorming/
│   ├── SKILL.md          # Main skill definition
│   └── references/
│       └── examples.md   # Example conversations
├── beans-breakdown/
│   ├── SKILL.md
│   └── references/
│       └── task-templates.md
└── beans-tdd-suggestion/
    └── SKILL.md
```

### Benefits of Agent Skills

1. **Portable** - Copy skills between projects
2. **Customizable** - Edit workflows for your needs
3. **Composable** - Skills can reference each other
4. **Versionable** - Track changes with git

### Creating Custom Skills

Create a new skill in the `skills/` directory:

```
skills/my-custom-workflow/
├── SKILL.md
└── references/
    └── examples.md
```

The SKILL.md format:

```markdown
---
name: my-custom-workflow
description: One-line description of when to use this skill
---

# Skill Name

## When to Use

Describe the situations where this skill applies...

## Workflow

Step-by-step workflow instructions...

## Reference Files

See [examples.md](references/examples.md) for examples.
```

### Configuring Skills

In `talos.yml`:

```yaml
planning:
  skills_directory: ./skills
  modes:
    brainstorm:
      enabled: true
      skill: beans-brainstorming
    breakdown:
      enabled: true
      skill: beans-breakdown
      suggest_test_beans: true
```

## Three-Layer Architecture

The planning workflow uses a three-layer architecture:

### Layer 1: Tools

Tools are what agents can do:
- `read_file` - Read codebase files
- `glob` - Find files by pattern
- `grep` - Search file contents
- `bash_readonly` - Run safe commands
- `beans_cli` - Create and manage beans

Tools work independently and can be tested in isolation.

### Layer 2: System Prompts

System prompts define how agents behave:
- `basePlanningPrompt` - Core planning agent behavior
- `brainstormModePrompt` - Socratic questioning workflow
- `breakdownModePrompt` - Task decomposition workflow

Prompts can be swapped without changing tools.

### Layer 3: Skills

Skills are reusable workflow knowledge:
- `beans-brainstorming` - Design exploration skill
- `beans-breakdown` - Task breakdown skill
- `beans-tdd-suggestion` - TDD pattern suggestions

Skills can be added/removed from the skills directory.

### Testing Each Layer

**Tools**: Test directly via beans CLI or planning tools

```bash
# Test beans_cli tool
beans create "Test bean" -t task -d "Testing..."
beans query '{ bean(id: "...") { title } }'
```

**Prompts**: Review in `src/planning/system-prompts.ts`

**Skills**: Read skill files in `skills/` directory

## Keyboard Shortcuts

In Plan View:

| Key | Action |
|-----|--------|
| `Tab` | Cycle to next mode |
| `Shift+Tab` | Cycle to previous mode |
| `Enter` | Send message |
| `Ctrl+P` | Open prompt selector |
| `Ctrl+L` | Clear chat |
| `1-9` | Quick-select multiple choice |
| `Esc` | Go back |

## Tips for Effective Planning

1. **Be specific about problems** - Vague problems lead to vague solutions
2. **Validate incrementally** - Don't wait until the end to give feedback
3. **Use multiple choice** - It's faster and reduces ambiguity
4. **Check the codebase** - The agent researches, but you know the patterns
5. **Keep tasks small** - 2-5 minutes is ideal for agents
6. **Use blocking relationships** - They prevent race conditions

## Troubleshooting

### "Skill not found" error

Check that skills exist in the configured directory:

```bash
ls -la skills/
```

Verify the skill name in `talos.yml` matches the directory name.

### Brainstorm mode asks too many questions

The Socratic approach is thorough by design. You can:
- Provide more context upfront
- Ask to "speed up" or "skip to design"
- Switch to a different mode

### Breakdown creates too many/few tasks

Adjust granularity in config:

```yaml
planning:
  modes:
    breakdown:
      min_task_duration_minutes: 2
      max_task_duration_minutes: 5
```

Or tell the agent: "Break this into larger/smaller pieces"

### TDD suggestions are unwanted

Disable in config:

```yaml
planning:
  modes:
    breakdown:
      suggest_test_beans: false
```

## Related Documentation

- [AGENTS.md](/AGENTS.md) - Beans CLI usage guide
- [Configuration](/src/config/index.ts) - Full config schema
- [Skills Directory](/skills/) - Agent Skills definitions
