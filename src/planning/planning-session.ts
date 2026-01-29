/**
 * Planning Session Module
 *
 * EventEmitter-based class for managing planning agent interactions.
 * Extracted from src/ui/hooks/usePlanningAgent.ts for use without React.
 *
 * Supported providers:
 * - 'anthropic' / 'claude': Direct Anthropic API (requires ANTHROPIC_API_KEY)
 * - 'openai': OpenAI API (requires OPENAI_API_KEY)
 * - 'claude_code': Claude CLI subscription (uses `claude` CLI)
 * - 'opencode': OpenCode CLI (uses `opencode` CLI)
 */
import { EventEmitter } from 'events';
import { streamText, stepCountIs, type ModelMessage } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import type { PlanningAgentConfig, ExpertsConfig } from '../config/index.js';
import type { Bean } from '../talos/beans-client.js';
import type { ChatMessage, ToolCall } from './chat-history.js';
import { getPlanningAgentSystemPrompt } from './system-prompts.js';
import { getEnabledTools } from './tools.js';
import { ClaudeCodeProvider } from './claude-code-provider.js';
import { OpenCodeProvider } from './opencode-provider.js';

// =============================================================================
// Types
// =============================================================================

export type PlanMode =
  | 'new'
  | 'refine'
  | 'critique'
  | 'sweep'
  | 'brainstorm'
  | 'breakdown';

export interface PlanningSessionOptions {
  config: PlanningAgentConfig;
  expertsConfig: ExpertsConfig;
  mode?: PlanMode;
  selectedBean?: Bean | null;
}

export interface PlanningSessionEvents {
  text: (text: string) => void;
  toolCall: (tc: ToolCall) => void;
  done: (fullContent: string, toolCalls: ToolCall[]) => void;
  error: (error: Error) => void;
}

// =============================================================================
// Helpers
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
      // Default to Anthropic
      const anthropic = createAnthropic({});
      return anthropic(config.model);
    }
  }
}

function convertToModelMessages(
  messages: ChatMessage[],
  systemPrompt: string
): ModelMessage[] {
  const modelMessages: ModelMessage[] = [];

  // Add system message
  modelMessages.push({
    role: 'system',
    content: systemPrompt,
  });

  // Convert chat messages
  for (const msg of messages) {
    if (msg.role === 'user') {
      modelMessages.push({
        role: 'user',
        content: msg.content,
      });
    } else if (msg.role === 'assistant') {
      modelMessages.push({
        role: 'assistant',
        content: msg.content,
      });
    }
    // Skip system messages (handled separately)
  }

  return modelMessages;
}

// =============================================================================
// PlanningSession Class
// =============================================================================

export class PlanningSession extends EventEmitter {
  private config: PlanningAgentConfig;
  private expertsConfig: ExpertsConfig;
  private mode: PlanMode;
  private selectedBean: Bean | null;
  private abortController: AbortController | null = null;
  private claudeCodeProvider: ClaudeCodeProvider | null = null;
  private openCodeProvider: OpenCodeProvider | null = null;
  private streaming = false;

  constructor(options: PlanningSessionOptions) {
    super();
    this.config = options.config;
    this.expertsConfig = options.expertsConfig;
    this.mode = options.mode ?? 'new';
    this.selectedBean = options.selectedBean ?? null;
  }

  // ===========================================================================
  // Mode Management
  // ===========================================================================

  setMode(mode: PlanMode): void {
    this.mode = mode;
  }

  getMode(): PlanMode {
    return this.mode;
  }

  setSelectedBean(bean: Bean | null): void {
    this.selectedBean = bean;
  }

  getSelectedBean(): Bean | null {
    return this.selectedBean;
  }

  // ===========================================================================
  // Streaming State
  // ===========================================================================

  isStreaming(): boolean {
    return this.streaming;
  }

  // ===========================================================================
  // Main Methods
  // ===========================================================================

  async sendMessage(message: string, history: ChatMessage[]): Promise<void> {
    const provider = this.config.provider.toLowerCase();

    if (provider === 'claude_code') {
      await this.sendMessageViaClaude(message, history);
    } else if (provider === 'opencode') {
      await this.sendMessageViaOpenCode(message, history);
    } else {
      await this.sendMessageViaApi(message, history);
    }
  }

  cancel(): void {
    // Cancel API-based stream
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }

    // Cancel Claude Code provider
    if (this.claudeCodeProvider?.isActive()) {
      this.claudeCodeProvider.cancel();
      this.claudeCodeProvider = null;
    }

    // Cancel OpenCode provider
    if (this.openCodeProvider?.isActive()) {
      this.openCodeProvider.cancel();
      this.openCodeProvider = null;
    }

    this.streaming = false;
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  private async sendMessageViaClaude(
    message: string,
    history: ChatMessage[]
  ): Promise<void> {
    // Cancel any existing stream
    if (this.claudeCodeProvider?.isActive()) {
      this.claudeCodeProvider.cancel();
    }

    this.streaming = true;
    this.abortController = new AbortController();

    // Create the provider
    const provider = new ClaudeCodeProvider({
      mode: this.mode,
      selectedBean: this.selectedBean,
      abortSignal: this.abortController.signal,
    });
    this.claudeCodeProvider = provider;

    // Track content and tool calls
    let fullContent = '';
    const toolCalls: ToolCall[] = [];

    // Set up event handlers - forward events
    provider.on('text', (text: string) => {
      fullContent += text;
      this.emit('text', text);
    });

    provider.on(
      'toolCall',
      (tc: { name: string; args: Record<string, unknown> }) => {
        const toolCall: ToolCall = {
          name: tc.name,
          args: tc.args,
        };
        toolCalls.push(toolCall);
        this.emit('toolCall', toolCall);
      }
    );

    provider.on('error', (err: Error) => {
      this.streaming = false;
      this.claudeCodeProvider = null;
      this.emit('error', err);
    });

    provider.on('done', () => {
      this.streaming = false;
      this.claudeCodeProvider = null;
      this.emit('done', fullContent, toolCalls);
    });

    // Convert history to simple format for Claude CLI
    const historyForCli = history
      .filter((msg) => msg.role === 'user' || msg.role === 'assistant')
      .map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

    try {
      await provider.send(message, historyForCli);
    } catch (err) {
      // Error is handled via event, but catch any unhandled
      if (!(err instanceof Error && err.message.includes('aborted'))) {
        const error = err instanceof Error ? err : new Error(String(err));
        this.streaming = false;
        this.claudeCodeProvider = null;
        this.emit('error', error);
      }
    }
  }

  private async sendMessageViaOpenCode(
    message: string,
    history: ChatMessage[]
  ): Promise<void> {
    // Cancel any existing stream
    if (this.openCodeProvider?.isActive()) {
      this.openCodeProvider.cancel();
    }

    this.streaming = true;
    this.abortController = new AbortController();

    // Create the provider
    const provider = new OpenCodeProvider({
      mode: this.mode,
      selectedBean: this.selectedBean,
      abortSignal: this.abortController.signal,
      model: this.config.model,
    });
    this.openCodeProvider = provider;

    // Track content and tool calls
    let fullContent = '';
    const toolCalls: ToolCall[] = [];

    // Set up event handlers - forward events
    provider.on('text', (text: string) => {
      fullContent += text;
      this.emit('text', text);
    });

    provider.on(
      'toolCall',
      (tc: { name: string; args: Record<string, unknown> }) => {
        const toolCall: ToolCall = {
          name: tc.name,
          args: tc.args,
        };
        toolCalls.push(toolCall);
        this.emit('toolCall', toolCall);
      }
    );

    provider.on('error', (err: Error) => {
      this.streaming = false;
      this.openCodeProvider = null;
      this.emit('error', err);
    });

    provider.on('done', () => {
      this.streaming = false;
      this.openCodeProvider = null;
      this.emit('done', fullContent, toolCalls);
    });

    // Convert history to simple format for OpenCode CLI
    const historyForCli = history
      .filter((msg) => msg.role === 'user' || msg.role === 'assistant')
      .map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

    try {
      await provider.send(message, historyForCli);
    } catch (err) {
      // Error is handled via event, but catch any unhandled
      if (!(err instanceof Error && err.message.includes('aborted'))) {
        const error = err instanceof Error ? err : new Error(String(err));
        this.streaming = false;
        this.openCodeProvider = null;
        this.emit('error', error);
      }
    }
  }

  private async sendMessageViaApi(
    message: string,
    history: ChatMessage[]
  ): Promise<void> {
    // Cancel any existing stream
    if (this.abortController) {
      this.abortController.abort();
    }

    this.abortController = new AbortController();
    this.streaming = true;

    try {
      // Get system prompt based on mode
      const systemPrompt = getPlanningAgentSystemPrompt(
        this.mode,
        this.selectedBean
      );

      // Get enabled tools
      const tools = getEnabledTools(this.config.tools);

      // Convert history to model messages
      const messages = convertToModelMessages(history, systemPrompt);

      // Add the new user message
      messages.push({
        role: 'user',
        content: message,
      });

      // Get the model
      const model = getModel(this.config);

      // Start streaming
      const result = streamText({
        model,
        messages,
        tools,
        stopWhen: stepCountIs(10), // Allow up to 10 tool call steps
        temperature: this.config.temperature,
        abortSignal: this.abortController.signal,
      });

      // Collect streamed text
      let fullContent = '';
      const toolCalls: ToolCall[] = [];

      for await (const part of result.textStream) {
        fullContent += part;
        this.emit('text', part);
      }

      // Get final result for tool calls
      const finalResult = await result;

      // Extract tool calls from steps
      const steps = await finalResult.steps;
      if (steps) {
        for (const step of steps) {
          if (step.toolCalls) {
            for (const tc of step.toolCalls) {
              const toolCall: ToolCall = {
                name: tc.toolName,
                args: tc.input as Record<string, unknown>,
              };
              toolCalls.push(toolCall);
              this.emit('toolCall', toolCall);
            }
          }
        }
      }

      // Complete
      this.streaming = false;
      this.emit('done', fullContent, toolCalls);
    } catch (err) {
      // Check if aborted
      if (err instanceof Error && err.name === 'AbortError') {
        this.streaming = false;
        return;
      }

      const error = err instanceof Error ? err : new Error(String(err));
      this.streaming = false;
      this.emit('error', error);
    }
  }
}

// =============================================================================
// Typed Event Emitter Helper
// =============================================================================

// Re-export with proper typing for consumers
export interface TypedPlanningSession {
  on<K extends keyof PlanningSessionEvents>(
    event: K,
    listener: PlanningSessionEvents[K]
  ): this;
  emit<K extends keyof PlanningSessionEvents>(
    event: K,
    ...args: Parameters<PlanningSessionEvents[K]>
  ): boolean;
}
