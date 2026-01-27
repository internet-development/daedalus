---
name: beans-brainstorming
description: Guide agents through creative exploration and requirements gathering using Socratic questioning and incremental design presentation. Use when creating new features, epics, bugs, milestones, or any bean that needs design work.
---

# Beans Brainstorming

A workflow skill for structured requirements gathering and design exploration that produces well-specified beans.

## When to Use

Activate this skill when:
- Creating a new feature, epic, milestone, or bug that needs design work
- User describes a problem or idea without clear requirements
- Starting greenfield work with undefined scope
- Exploring technical approaches for a complex change

## Workflow Overview

The brainstorming workflow has three phases:

1. **Socratic Questions** - Gather requirements through targeted questions
2. **Incremental Design** - Present solutions in digestible sections
3. **Bean Creation** - Create the spec bean with full details

## Phase 1: Socratic Questions

Ask clarifying questions to understand the problem space. Follow these rules:

### Question Rules

1. **One question at a time** - Never ask multiple questions in the same message
2. **Prefer multiple choice** - When possible, offer 3-5 concrete options
3. **Include "other" option** - Allow custom answers when appropriate
4. **Progressive depth** - Start broad, then drill into specifics
5. **Validate assumptions** - Confirm understanding before proceeding

### Question Categories

Work through these categories as needed:

**Problem Understanding**
- What problem are we solving?
- Who experiences this problem?
- How is this currently handled?

**Scope Definition**
- What's the minimum viable solution?
- What's explicitly out of scope?
- Are there related changes to consider?

**Technical Context**
- What existing code/systems are involved?
- What constraints exist (performance, compatibility, etc.)?
- What dependencies are needed?

**Success Criteria**
- How will we know this is done?
- What should we test?
- What could go wrong?

### Example Question Flow

```
Q1: What type of work is this?
[ ] New feature for users
[ ] Bug fix or correction
[ ] Internal improvement/refactor
[ ] Infrastructure or tooling
[ ] Other (please describe)

User: New feature

Q2: Which user problem does this solve?
[ ] Users can't do X at all
[ ] Users can do X but it's slow/painful
[ ] Users want to do X but have to work around it
[ ] Other (please describe)

User: Users can do X but it's slow

Q3: What specific workflow is slow? Please describe...

User: The search takes 5+ seconds...
```

### Transition to Phase 2

Move to Phase 2 when:
- Core problem is clearly understood
- Scope boundaries are established
- Major technical constraints are identified
- User seems ready for solutions

Say: "I think I understand the requirements. Let me present my proposed design in sections. Please confirm each section before I continue."

## Phase 2: Incremental Design

Present the design in small, digestible sections. Get validation before proceeding.

### Section Rules

1. **200-300 words per section** - Keep sections focused and readable
2. **Ask for confirmation** - End each section with a validation question
3. **Allow revisions** - Incorporate feedback before continuing
4. **Build progressively** - Later sections build on earlier ones

### Recommended Section Structure

**Section 1: Problem Summary** (what we're solving)
- Restate the problem in your own words
- Confirm the core user need
- Ask: "Does this accurately capture the problem?"

**Section 2: Proposed Approach** (high-level solution)
- Describe the overall strategy
- Explain why this approach fits
- Ask: "Does this approach make sense?"

**Section 3: Implementation Details** (how it works)
- Key components and their responsibilities
- Important technical decisions
- Ask: "Any concerns about this implementation?"

**Section 4: File Changes** (what we'll modify)
- List specific files to create/modify
- Brief description of each change
- Ask: "Are these the right files to touch?"

**Section 5: Verification** (how we'll know it works)
- Test cases to cover
- Edge cases to handle
- Ask: "Anything else we should test?"

### Handling Revisions

If user disagrees with a section:
1. Acknowledge the feedback
2. Ask clarifying questions if needed
3. Present revised section
4. Continue only after approval

## Phase 3: Bean Creation

Once all design sections are approved, create the spec bean.

### Bean Type Selection

Choose bean type based on scope:

| Scope | Bean Type |
|-------|-----------|
| Release target with deadline | `milestone` |
| Thematic group of related work | `epic` |
| User-facing capability | `feature` |
| Something broken to fix | `bug` |
| Concrete implementation task | `task` |

### Bean Structure

Create the bean with:

**Title**: Clear, action-oriented summary (50 chars max)

**Body Structure**:
```markdown
## Problem

[Concise problem statement from Phase 1]

## Solution

[High-level approach from Phase 2]

## Implementation

[Technical details from Phase 2]

## Files to Modify

- `path/to/file.ts` - Description of changes
- `path/to/other.ts` - Description of changes

## Verification

- [ ] Test case 1
- [ ] Test case 2
- [ ] Edge case handling
```

### Creating the Bean

Use the beans CLI:

```bash
beans create "Title here" \
  -t feature \
  -d "Full markdown body..." \
  -s draft
```

Set status to `draft` initially - user can promote to `todo` when ready.

### Setting Relationships

If this bean belongs to a parent:

```bash
beans update <new-bean-id> --parent <parent-id>
```

Hierarchy rules:
- milestone > epic > feature > task/bug
- Only set parent if explicitly discussed

## Tips for Success

1. **Don't rush** - Take time to understand before designing
2. **Stay curious** - Ask "why" when answers are vague
3. **Be concrete** - Use specific file paths and examples
4. **Embrace uncertainty** - It's okay to say "I need more context"
5. **Document decisions** - Include rationale in the bean body

## Reference Files

See [examples.md](references/examples.md) for complete brainstorming session examples.
