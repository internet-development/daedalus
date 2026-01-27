/**
 * Planning Agent Orchestrator
 *
 * Integrates the three-layer architecture:
 * - Layer 1 (Tools): PLANNING_TOOLS + skill tool
 * - Layer 2 (System Prompts): Mode-specific prompts
 * - Layer 3 (Skills): Agent Skills format workflows
 *
 * This module provides the main entry point for creating configured
 * planning agents with skills support.
 */
import { streamText, stepCountIs, type ModelMessage, type Tool, type StreamTextResult } from 'ai';
import { experimental_createSkillTool as createSkillTool, type SkillToolkit } from 'bash-tool';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import type { PlanningAgentConfig } from '../config/index.js';
import type { Bean } from '../talos/beans-client.js';
import { PLANNING_TOOLS } from './tools.js';
import {
  getPlanningAgentSystemPrompt,
  basePlanningPrompt,
  brainstormModePrompt,
  breakdownModePrompt,
} from './system-prompts.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyTool = Tool<any, any>;

// =============================================================================
// Types
// =============================================================================

/**
 * Planning modes supported by the agent.
 * Each mode configures different behaviors and system prompts.
 */
export type PlanningMode = 'new' | 'refine' | 'critique' | 'sweep' | 'brainstorm' | 'breakdown';

/**
 * Configuration for creating a planning agent.
 */
export interface CreatePlanningAgentConfig {
  /** Agent configuration from talos.yml */
  config: PlanningAgentConfig;
  /** Current planning mode */
  mode: PlanningMode;
  /** Optional selected bean for context */
  selectedBean?: Bean | null;
  /** Directory containing skill definitions */
  skillsDirectory?: string;
  /** Chat history messages */
  messages: ModelMessage[];
  /** Abort signal for cancellation */
  abortSignal?: AbortSignal;
}

/**
 * Result from loading skills.
 */
export interface SkillLoadResult {
  /** The skill tool for AI to discover and load skills */
  skillTool: AnyTool | null;
  /** Files to provide to sandbox (if using bash-tool) */
  files: Record<string, string>;
  /** Instructions to inject into system prompt */
  instructions: string;
  /** List of discovered skill names */
  skillNames: string[];
}

/**
 * Combined tools type (planning tools + optional skill tool)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type CombinedTools = Record<string, AnyTool>;

/**
 * Configured planning agent ready for streaming.
 */
export interface PlanningAgentResult {
  /** Combined tools (planning + skills) */
  tools: CombinedTools;
  /** Full system prompt with skill instructions */
  systemPrompt: string;
  /** Execute the agent and stream responses */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  stream: () => StreamTextResult<any, any>;
}

// =============================================================================
// Model Provider Setup
// =============================================================================

/**
 * Get the language model based on config provider.
 */
function getModel(config: PlanningAgentConfig) {
  const provider = config.provider.toLowerCase();

  switch (provider) {
    case 'anthropic':
    case 'claude': {
      const anthropic = createAnthropic({});
      return anthropic(config.model);
    }

    case 'openai': {
      const openai = createOpenAI({});
      return openai(config.model);
    }

    default: {
      // Default to Anthropic
      const anthropic = createAnthropic({});
      return anthropic(config.model);
    }
  }
}

// =============================================================================
// Skills Loading
// =============================================================================

/**
 * Load skills from the skills directory.
 *
 * @param skillsDirectory - Path to the skills directory (default: ./skills)
 * @returns Skill tool, files, instructions, and skill names
 */
export async function loadSkills(skillsDirectory: string = './skills'): Promise<{
  skillTool: AnyTool | null;
  files: Record<string, string>;
  instructions: string;
  skillNames: string[];
}> {
  try {
    const { skill, files, instructions, skills } = await createSkillTool({
      skillsDirectory,
    });

    const skillNames = skills.map((s) => s.name);

    return {
      skillTool: skill as AnyTool,
      files,
      instructions,
      skillNames,
    };
  } catch (error) {
    // Skills loading failed - this is not fatal, just proceed without skills
    console.error(
      `Warning: Failed to load skills from ${skillsDirectory}:`,
      error instanceof Error ? error.message : String(error)
    );

    return {
      skillTool: null,
      files: {},
      instructions: '',
      skillNames: [],
    };
  }
}

// =============================================================================
// System Prompt Composition
// =============================================================================

/**
 * Get the system prompt for a given mode, optionally with skill instructions.
 *
 * This function composes the full system prompt by:
 * 1. Getting the base mode-specific prompt
 * 2. Appending skill instructions if available
 *
 * @param mode - The planning mode
 * @param selectedBean - Optional bean for context
 * @param skillInstructions - Optional skill instructions to append
 * @returns Complete system prompt
 */
export function getSystemPromptForMode(
  mode: PlanningMode,
  selectedBean?: Bean | null,
  skillInstructions?: string
): string {
  // Get the base prompt for this mode
  const basePrompt = getPlanningAgentSystemPrompt(mode, selectedBean);

  // If no skill instructions, return base prompt
  if (!skillInstructions) {
    return basePrompt;
  }

  // Append skill instructions
  return `${basePrompt}

## Available Skills

${skillInstructions}

When appropriate, use the \`skill\` tool to load detailed instructions for a skill before using it.`;
}

/**
 * Get a short description of what each mode does.
 */
export function getModeDescription(mode: PlanningMode): string {
  const descriptions: Record<PlanningMode, string> = {
    new: 'Create new beans through guided conversation',
    refine: 'Improve and clarify existing draft beans',
    critique: 'Run expert review on draft beans',
    sweep: 'Check consistency across related beans',
    brainstorm: 'Explore design options with Socratic questioning',
    breakdown: 'Decompose work into actionable child beans',
  };

  return descriptions[mode];
}

// =============================================================================
// Agent Factory
// =============================================================================

/**
 * Create a configured planning agent.
 *
 * This is the main entry point for creating planning agents. It:
 * 1. Loads skills from the skills directory
 * 2. Combines planning tools with the skill tool
 * 3. Composes the system prompt with skill instructions
 * 4. Returns a ready-to-use agent
 *
 * @example
 * ```typescript
 * const agent = await createPlanningAgent({
 *   config: planningConfig,
 *   mode: 'brainstorm',
 *   selectedBean: null,
 *   messages: chatHistory,
 * });
 *
 * for await (const part of agent.stream().textStream) {
 *   process.stdout.write(part);
 * }
 * ```
 */
export async function createPlanningAgent(
  options: CreatePlanningAgentConfig
): Promise<PlanningAgentResult> {
  const {
    config,
    mode,
    selectedBean,
    skillsDirectory = './skills',
    messages,
    abortSignal,
  } = options;

  // Load skills (Layer 3)
  const { skillTool, instructions } = await loadSkills(skillsDirectory);

  // Combine tools (Layer 1)
  const tools = skillTool
    ? { ...PLANNING_TOOLS, skill: skillTool }
    : PLANNING_TOOLS;

  // Get system prompt (Layer 2) + inject skill instructions
  const systemPrompt = getSystemPromptForMode(mode, selectedBean, instructions);

  // Get the model
  const model = getModel(config);

  // Return the configured agent
  return {
    tools,
    systemPrompt,
    stream: () =>
      streamText({
        model,
        system: systemPrompt,
        messages,
        tools,
        stopWhen: stepCountIs(10), // Allow up to 10 tool call steps
        temperature: config.temperature,
        abortSignal,
      }),
  };
}

/**
 * Simple helper to run a planning agent and collect the full response.
 *
 * @example
 * ```typescript
 * const result = await runPlanningAgent({
 *   config: planningConfig,
 *   mode: 'new',
 *   messages: [{ role: 'user', content: 'Help me plan a new feature' }],
 * });
 *
 * console.log(result.text);
 * console.log(result.toolCalls);
 * ```
 */
export async function runPlanningAgent(
  options: CreatePlanningAgentConfig
): Promise<{
  text: string;
  toolCalls: Array<{ name: string; input: unknown }>;
}> {
  const agent = await createPlanningAgent(options);
  const result = agent.stream();

  // Collect text
  let text = '';
  for await (const part of result.textStream) {
    text += part;
  }

  // Collect tool calls
  const toolCalls: Array<{ name: string; input: unknown }> = [];
  const finalResult = await result;
  const steps = await finalResult.steps;

  if (steps) {
    for (const step of steps) {
      if (step.toolCalls) {
        for (const tc of step.toolCalls) {
          toolCalls.push({
            name: tc.toolName,
            input: tc.input,
          });
        }
      }
    }
  }

  return { text, toolCalls };
}

// =============================================================================
// Exports
// =============================================================================

export {
  // Re-export tools for convenience
  PLANNING_TOOLS,
  // Re-export prompt building blocks
  basePlanningPrompt,
  brainstormModePrompt,
  breakdownModePrompt,
};
