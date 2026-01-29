/**
 * Session Naming Module
 *
 * Generates meaningful session names using AI with fallback to heuristics.
 */
import { generateText } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import type { ChatMessage } from '../planning/chat-history.js';

// =============================================================================
// Constants
// =============================================================================

/** Maximum time to wait for AI response */
const AI_TIMEOUT_MS = 5000;

/** Maximum length for session names */
const MAX_NAME_LENGTH = 30;

/** Model to use for naming (fast and cheap) */
const NAMING_MODEL = 'claude-3-5-haiku-latest';

/** Prompt template for AI naming */
const NAMING_PROMPT = `Summarize this conversation in 2-5 words for use as a session title.
Return ONLY the title, nothing else. No quotes, no punctuation, no emoji.

Conversation:
`;

// =============================================================================
// Types
// =============================================================================

export interface NamingOptions {
  /** Timeout in milliseconds (default: 5000) */
  timeout?: number;
  /** Model to use (default: claude-3-5-haiku-latest) */
  model?: string;
}

// =============================================================================
// Heuristic Naming
// =============================================================================

/**
 * Generate a session name using a simple heuristic.
 * Takes the first 5 words of the first user message.
 */
export function generateNameHeuristic(messages: ChatMessage[]): string | null {
  const firstUserMessage = messages.find((m) => m.role === 'user')?.content ?? '';
  
  // Filter out empty strings from split
  const words = firstUserMessage.split(/\s+/).filter((w) => w.length > 0).slice(0, 5);

  if (words.length === 0) return null;

  // Capitalize first letter of each word
  return words
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
    .slice(0, MAX_NAME_LENGTH);
}

// =============================================================================
// AI Naming
// =============================================================================

/**
 * Build the conversation context for the naming prompt.
 * Extracts first 2-3 user and assistant messages.
 */
export function buildConversationContext(messages: ChatMessage[]): string {
  const userMessages = messages
    .filter((m) => m.role === 'user')
    .slice(0, 3)
    .map((m) => `User: ${m.content.slice(0, 200)}`);

  const assistantMessages = messages
    .filter((m) => m.role === 'assistant')
    .slice(0, 2)
    .map((m) => `Assistant: ${m.content.slice(0, 200)}`);

  // Interleave messages (user first, then assistant)
  const context: string[] = [];
  const maxLen = Math.max(userMessages.length, assistantMessages.length);
  for (let i = 0; i < maxLen; i++) {
    if (userMessages[i]) context.push(userMessages[i]);
    if (assistantMessages[i]) context.push(assistantMessages[i]);
  }

  return context.join('\n');
}

/**
 * Clean up the AI response to get a valid session name.
 * - Trims whitespace
 * - Removes surrounding quotes
 * - Removes emoji and special characters
 * - Truncates to max length
 */
export function cleanSessionName(raw: string): string {
  let name = raw.trim();

  // Remove surrounding quotes
  if ((name.startsWith('"') && name.endsWith('"')) ||
      (name.startsWith("'") && name.endsWith("'"))) {
    name = name.slice(1, -1);
  }

  // Remove emoji and special characters (keep alphanumeric, spaces, hyphens)
  name = name.replace(/[^\w\s-]/g, '').trim();

  // Collapse multiple spaces
  name = name.replace(/\s+/g, ' ');

  // Truncate to max length
  if (name.length > MAX_NAME_LENGTH) {
    name = name.slice(0, MAX_NAME_LENGTH).trim();
  }

  return name;
}

/**
 * Generate a session name using AI.
 * Returns null if AI call fails or times out.
 */
export async function generateNameWithAI(
  messages: ChatMessage[],
  options: NamingOptions = {}
): Promise<string | null> {
  const timeout = options.timeout ?? AI_TIMEOUT_MS;
  const model = options.model ?? NAMING_MODEL;

  // Build the prompt
  const context = buildConversationContext(messages);
  if (!context.trim()) return null;

  const prompt = NAMING_PROMPT + context;

  // Create abort controller for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const anthropic = createAnthropic({});
    const result = await generateText({
      model: anthropic(model),
      prompt,
      maxOutputTokens: 20,
      abortSignal: controller.signal,
    });

    clearTimeout(timeoutId);

    const name = cleanSessionName(result.text);
    return name || null;
  } catch {
    clearTimeout(timeoutId);
    return null;
  }
}

/**
 * Generate a session name with AI, falling back to heuristic on failure.
 * This is the main entry point for session naming.
 */
export async function generateSessionName(
  messages: ChatMessage[],
  options: NamingOptions = {}
): Promise<string | null> {
  // Try AI naming first
  const aiName = await generateNameWithAI(messages, options);
  if (aiName) return aiName;

  // Fall back to heuristic
  return generateNameHeuristic(messages);
}
