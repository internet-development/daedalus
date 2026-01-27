/**
 * usePlanningAgent Hook
 *
 * Manages interaction with the planning agent via Vercel AI SDK or Claude CLI.
 * Supports streaming responses and tool calls.
 *
 * Supported providers:
 * - 'anthropic' / 'claude': Direct Anthropic API (requires ANTHROPIC_API_KEY)
 * - 'openai': OpenAI API (requires OPENAI_API_KEY)
 * - 'claude_code': Claude CLI subscription (uses `claude` CLI)
 */
import { useState, useCallback, useRef } from 'react';
import { streamText, stepCountIs, type ModelMessage } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import type { PlanningAgentConfig, ExpertsConfig } from '../../config/index.js';
import type { PlanMode } from '../views/PlanView.js';
import type { Bean } from '../../talos/beans-client.js';
import type { ChatMessage, ToolCall } from '../components/ChatHistory.js';
import { getPlanningAgentSystemPrompt } from '../../planning/system-prompts.js';
import { getEnabledTools } from '../../planning/tools.js';
import { ClaudeCodeProvider } from '../../planning/claude-code-provider.js';

// =============================================================================
// Types
// =============================================================================

export interface UsePlanningAgentOptions {
  config: PlanningAgentConfig;
  expertsConfig: ExpertsConfig;
  mode: PlanMode;
  selectedBean?: Bean | null;
  onMessageComplete: (content: string, toolCalls?: ToolCall[]) => void;
  onError: (error: Error) => void;
}

export interface UsePlanningAgentResult {
  sendMessage: (message: string, history: ChatMessage[]) => Promise<void>;
  isStreaming: boolean;
  streamingContent: string;
  cancelStream: () => void;
}

// =============================================================================
// Provider Setup
// =============================================================================

function getModel(config: PlanningAgentConfig) {
  const provider = config.provider.toLowerCase();

  switch (provider) {
    case 'anthropic':
    case 'claude': {
      const anthropic = createAnthropic({
        // Uses ANTHROPIC_API_KEY env var by default
      });
      return anthropic(config.model);
    }

    case 'openai': {
      const openai = createOpenAI({
        // Uses OPENAI_API_KEY env var by default
      });
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
// Message Conversion
// =============================================================================

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
// Hook
// =============================================================================

export function usePlanningAgent({
  config,
  expertsConfig,
  mode,
  selectedBean,
  onMessageComplete,
  onError,
}: UsePlanningAgentOptions): UsePlanningAgentResult {
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const abortControllerRef = useRef<AbortController | null>(null);
  const claudeCodeProviderRef = useRef<ClaudeCodeProvider | null>(null);

  // Send message using Claude Code CLI provider
  const sendMessageViaClaude = useCallback(
    async (message: string, history: ChatMessage[]) => {
      // Cancel any existing stream
      if (claudeCodeProviderRef.current?.isActive()) {
        claudeCodeProviderRef.current.cancel();
      }

      setIsStreaming(true);
      setStreamingContent('');

      // Create abort controller for cancellation
      abortControllerRef.current = new AbortController();

      // Create the provider
      const provider = new ClaudeCodeProvider({
        mode,
        selectedBean,
        abortSignal: abortControllerRef.current.signal,
      });
      claudeCodeProviderRef.current = provider;

      // Track content and tool calls
      let fullContent = '';
      const toolCalls: ToolCall[] = [];
      let updateScheduled = false;

      // Set up event handlers with throttled UI updates
      // Use 200ms throttle to prevent Ink rendering issues - terminals can't handle rapid updates
      provider.on('text', (text: string) => {
        fullContent += text;
        if (!updateScheduled) {
          updateScheduled = true;
          setTimeout(() => {
            setStreamingContent(fullContent);
            updateScheduled = false;
          }, 200);
        }
      });

      provider.on('toolCall', (tc: { name: string; args: Record<string, unknown> }) => {
        toolCalls.push({
          name: tc.name,
          args: tc.args,
        });
      });

      provider.on('error', (err: Error) => {
        setIsStreaming(false);
        setStreamingContent('');
        claudeCodeProviderRef.current = null;
        onError(err);
      });

      provider.on('done', () => {
        setIsStreaming(false);
        setStreamingContent('');
        claudeCodeProviderRef.current = null;
        onMessageComplete(fullContent, toolCalls.length > 0 ? toolCalls : undefined);
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
          setIsStreaming(false);
          setStreamingContent('');
          claudeCodeProviderRef.current = null;
          onError(error);
        }
      }
    },
    [mode, selectedBean, onMessageComplete, onError]
  );

  // Send message using Vercel AI SDK (API-based providers)
  const sendMessageViaApi = useCallback(
    async (message: string, history: ChatMessage[]) => {
      // Cancel any existing stream
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Create new abort controller
      abortControllerRef.current = new AbortController();

      setIsStreaming(true);
      setStreamingContent('');

      try {
        // Get system prompt based on mode
        const systemPrompt = getPlanningAgentSystemPrompt(mode, selectedBean);

        // Get enabled tools
        const tools = getEnabledTools(config.tools);

        // Convert history to model messages
        const messages = convertToModelMessages(history, systemPrompt);

        // Add the new user message
        messages.push({
          role: 'user',
          content: message,
        });

        // Get the model
        const model = getModel(config);

        // Start streaming
        const result = streamText({
          model,
          messages,
          tools,
          stopWhen: stepCountIs(10), // Allow up to 10 tool call steps
          temperature: config.temperature,
          abortSignal: abortControllerRef.current.signal,
        });

        // Collect streamed text
        let fullContent = '';
        const toolCalls: ToolCall[] = [];

        for await (const part of result.textStream) {
          fullContent += part;
          setStreamingContent(fullContent);
        }

        // Get final result for tool calls
        const finalResult = await result;
        
        // Extract tool calls from steps
        const steps = await finalResult.steps;
        if (steps) {
          for (const step of steps) {
            if (step.toolCalls) {
              for (const tc of step.toolCalls) {
                toolCalls.push({
                  name: tc.toolName,
                  args: tc.input as Record<string, unknown>,
                });
              }
            }
          }
        }

        // Complete
        setIsStreaming(false);
        setStreamingContent('');
        onMessageComplete(fullContent, toolCalls.length > 0 ? toolCalls : undefined);
      } catch (err) {
        // Check if aborted
        if (err instanceof Error && err.name === 'AbortError') {
          setIsStreaming(false);
          setStreamingContent('');
          return;
        }

        const error = err instanceof Error ? err : new Error(String(err));
        setIsStreaming(false);
        setStreamingContent('');
        // Only call onError - error shows in chat history, not a separate error box
        onError(error);
      }
    },
    [config, mode, selectedBean, onMessageComplete, onError]
  );

  // Main send function - routes to appropriate provider
  const sendMessage = useCallback(
    async (message: string, history: ChatMessage[]) => {
      const provider = config.provider.toLowerCase();
      
      if (provider === 'claude_code') {
        await sendMessageViaClaude(message, history);
      } else {
        await sendMessageViaApi(message, history);
      }
    },
    [config.provider, sendMessageViaClaude, sendMessageViaApi]
  );

  const cancelStream = useCallback(() => {
    // Cancel API-based stream
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    
    // Cancel Claude Code provider
    if (claudeCodeProviderRef.current?.isActive()) {
      claudeCodeProviderRef.current.cancel();
      claudeCodeProviderRef.current = null;
    }
    
    setIsStreaming(false);
    setStreamingContent('');
  }, []);

  return {
    sendMessage,
    isStreaming,
    streamingContent,
    cancelStream,
  };
}

export default usePlanningAgent;
