/**
 * Expert Advisor System
 *
 * Implements expert consultation for the planning agent.
 * Each expert is a sub-agent with a distinct personality that provides
 * feedback from their unique perspective.
 */
import { generateText } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import type { PlanningAgentConfig } from '../config/index.js';
import { getExpertSystemPrompt, type ExpertType, EXPERT_PROMPTS } from './system-prompts.js';

// =============================================================================
// Types
// =============================================================================

export interface ExpertFeedback {
  expert: ExpertType;
  feedback: string;
  timestamp: number;
}

export interface ExpertConsultationResult {
  feedbacks: ExpertFeedback[];
  synthesis: string;
}

export interface ConsultExpertsOptions {
  /** The context/content to review */
  context: string;
  /** The specific question to answer */
  question?: string;
  /** Which experts to consult */
  experts: ExpertType[];
  /** Planning agent config for model selection */
  config: PlanningAgentConfig;
}

// =============================================================================
// Helper Functions
// =============================================================================

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
      const anthropic = createAnthropic({});
      return anthropic(config.model);
    }
  }
}

// =============================================================================
// Expert Consultation
// =============================================================================

/**
 * Consult a single expert advisor.
 */
export async function consultExpert(
  expert: ExpertType,
  context: string,
  question: string | undefined,
  config: PlanningAgentConfig
): Promise<ExpertFeedback> {
  const model = getModel(config);
  const systemPrompt = getExpertSystemPrompt(expert);

  const userMessage = question
    ? `Please review the following and answer the question from your perspective as the ${expert}.

## Context
${context}

## Question
${question}`
    : `Please review the following from your perspective as the ${expert}. Provide your feedback concisely (2-3 sentences max).

${context}`;

  try {
    const result = await generateText({
      model,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: userMessage,
        },
      ],
      temperature: 0.7,
      maxOutputTokens: 300, // Keep expert responses concise
    });

    return {
      expert,
      feedback: result.text.trim(),
      timestamp: Date.now(),
    };
  } catch (error) {
    return {
      expert,
      feedback: `[Error consulting ${expert}: ${error instanceof Error ? error.message : String(error)}]`,
      timestamp: Date.now(),
    };
  }
}

/**
 * Consult multiple expert advisors in parallel.
 */
export async function consultExperts(
  options: ConsultExpertsOptions
): Promise<ExpertFeedback[]> {
  const { context, question, experts, config } = options;

  // Run expert consultations in parallel
  const feedbackPromises = experts.map((expert) =>
    consultExpert(expert, context, question, config)
  );

  const feedbacks = await Promise.all(feedbackPromises);
  return feedbacks;
}

/**
 * Synthesize expert feedback into a cohesive summary with recommendations.
 */
export async function synthesizeExpertFeedback(
  feedbacks: ExpertFeedback[],
  context: string,
  config: PlanningAgentConfig
): Promise<string> {
  if (feedbacks.length === 0) {
    return 'No expert feedback to synthesize.';
  }

  const model = getModel(config);

  // Format expert feedback for synthesis
  const feedbackSummary = feedbacks
    .map((f) => `**${f.expert}**: ${f.feedback}`)
    .join('\n\n');

  const result = await generateText({
    model,
    system: `You are synthesizing feedback from multiple expert advisors. Your job is to:
1. Identify common themes and areas of agreement
2. Highlight key disagreements or tensions
3. Formulate 2-3 actionable questions for the user to consider
4. Be concise and practical

Do NOT repeat each expert's full feedback - instead, synthesize it into insights.`,
    messages: [
      {
        role: 'user',
        content: `## Original Context
${context}

## Expert Feedback
${feedbackSummary}

Please synthesize this feedback into actionable insights and questions for the user.`,
      },
    ],
    temperature: 0.5,
    maxOutputTokens: 500,
  });

  return result.text.trim();
}

/**
 * Full expert consultation with synthesis.
 */
export async function consultExpertsWithSynthesis(
  options: ConsultExpertsOptions
): Promise<ExpertConsultationResult> {
  // Get individual expert feedback
  const feedbacks = await consultExperts(options);

  // Synthesize the feedback
  const synthesis = await synthesizeExpertFeedback(
    feedbacks,
    options.context,
    options.config
  );

  return {
    feedbacks,
    synthesis,
  };
}

/**
 * Format expert feedback for display in chat.
 */
export function formatExpertFeedbackForChat(
  feedbacks: ExpertFeedback[],
  synthesis?: string
): string {
  const parts: string[] = [];

  // Add individual expert quotes
  parts.push('**Expert Perspectives:**\n');
  for (const feedback of feedbacks) {
    const expertLabel = feedback.expert.charAt(0).toUpperCase() + feedback.expert.slice(1);
    parts.push(`> ${expertLabel}: "${feedback.feedback}"\n`);
  }

  // Add synthesis if provided
  if (synthesis) {
    parts.push('\n**Synthesis:**\n');
    parts.push(synthesis);
  }

  return parts.join('');
}

/**
 * Get available expert types.
 */
export function getAvailableExperts(): ExpertType[] {
  return Object.keys(EXPERT_PROMPTS) as ExpertType[];
}
