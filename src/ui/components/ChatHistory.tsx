/**
 * ChatHistory Component
 *
 * Displays chat messages with support for user, assistant, and system messages.
 * Includes rendering for expert quotes and tool call indicators.
 *
 * Architecture:
 * - Use <Static> from Ink for completed messages (they never re-render)
 * - Use StreamingMessage component for the active streaming content
 * - This eliminates flickering during rapid streaming updates
 */
import React from 'react';
import { Box, Text } from 'ink';
import { ExpertQuote } from './ExpertQuote.js';

// =============================================================================
// Types
// =============================================================================

export interface ToolCall {
  name: string;
  args?: Record<string, unknown>;
  result?: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  toolCalls?: ToolCall[];
  isStreaming?: boolean;
}

export interface ChatHistoryProps {
  messages: ChatMessage[];
  width?: number;
}

export interface MessageProps {
  message: ChatMessage;
  width?: number;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Parse expert quotes from assistant message content.
 * Format: > Pragmatist: "message here"
 */
function parseExpertQuotes(
  content: string
): Array<{ expert: string; quote: string }> {
  const quotes: Array<{ expert: string; quote: string }> = [];
  const regex = />\s*(\w+):\s*[""](.+?)[""]/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    quotes.push({
      expert: match[1],
      quote: match[2],
    });
  }
  return quotes;
}

/**
 * Parse tool use indicators from content.
 * Format: [Searching codebase for ...]
 */
function parseToolIndicators(content: string): string[] {
  const indicators: string[] = [];
  const regex = /\[([^\]]+)\]/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    // Filter out numbered choices like [1], [2]
    if (!/^\d+$/.test(match[1])) {
      indicators.push(match[1]);
    }
  }
  return indicators;
}

/**
 * Remove expert quotes and tool indicators from content for display.
 */
function cleanContent(content: string): string {
  // Remove expert quotes
  let cleaned = content.replace(/>\s*\w+:\s*[""].+?[""]\n?/g, '');
  // Don't remove tool indicators in brackets - they're informative
  return cleaned.trim();
}

// =============================================================================
// Individual Message Components (exported for use with <Static>)
// =============================================================================

export function UserMessage({ message, width }: MessageProps) {
  const maxWidth = width ? width - 10 : 60;
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box>
        <Text bold color="green">
          You:{' '}
        </Text>
        <Text wrap="wrap">{message.content.slice(0, maxWidth * 3)}</Text>
      </Box>
    </Box>
  );
}

export function AssistantMessage({ message }: MessageProps) {
  const expertQuotes = parseExpertQuotes(message.content);
  const toolIndicators = parseToolIndicators(message.content);
  const cleanedContent = cleanContent(message.content);

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box>
        <Text bold color="cyan">Planner: </Text>
      </Box>

      {/* Tool indicators */}
      {toolIndicators.length > 0 && (
        <Box flexDirection="column" marginLeft={2}>
          {toolIndicators.map((indicator, i) => (
            <Text key={`tool-${i}`} color="gray" dimColor>
              [{indicator}]
            </Text>
          ))}
        </Box>
      )}

      {/* Main content */}
      <Box marginLeft={2}>
        <Text wrap="wrap">{cleanedContent}</Text>
      </Box>

      {/* Expert quotes */}
      {expertQuotes.length > 0 && (
        <Box flexDirection="column" marginLeft={2} marginTop={1}>
          {expertQuotes.map((eq, i) => (
            <ExpertQuote key={`quote-${i}`} expert={eq.expert} quote={eq.quote} />
          ))}
        </Box>
      )}

      {/* Tool calls (if any) */}
      {message.toolCalls && message.toolCalls.length > 0 && (
        <Box flexDirection="column" marginLeft={2} marginTop={1}>
          {message.toolCalls.map((tc, i) => (
            <Text key={`tc-${i}`} color="gray" dimColor>
              [Tool: {tc.name}]
            </Text>
          ))}
        </Box>
      )}
    </Box>
  );
}

export function SystemMessage({ message }: MessageProps) {
  return (
    <Box marginBottom={1}>
      <Text color="yellow" dimColor>
        {message.content}
      </Text>
    </Box>
  );
}

// =============================================================================
// Streaming Message Component (renders separately from Static messages)
// =============================================================================

export interface StreamingMessageProps {
  content: string;
  width?: number;
}

/**
 * Dedicated component for streaming content.
 * Rendered separately so only this component re-renders during streaming.
 *
 * IMPORTANT: Keep this component minimal to reduce Ink render complexity.
 * Fewer child elements = fewer things for Ink to diff on each update.
 */
export function StreamingMessage({ content }: StreamingMessageProps) {
  if (!content) return null;

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text bold color="cyan">Planner: <Text color="yellow" dimColor>(typing...)</Text></Text>
      <Box marginLeft={2}>
        <Text wrap="wrap">{content}</Text>
      </Box>
    </Box>
  );
}

// =============================================================================
// Message Renderer (for use with <Static> component)
// =============================================================================

/**
 * Renders a single message. Used as the render function for Ink's <Static> component.
 *
 * Usage with Static:
 * <Static items={messages}>
 *   {(message, index) => renderMessage(message, index, width)}
 * </Static>
 */
export function renderMessage(message: ChatMessage, index: number, width?: number): React.ReactNode {
  switch (message.role) {
    case 'user':
      return <UserMessage key={message.timestamp || index} message={message} width={width} />;
    case 'assistant':
      return <AssistantMessage key={message.timestamp || index} message={message} width={width} />;
    case 'system':
      return <SystemMessage key={message.timestamp || index} message={message} width={width} />;
    default:
      return null;
  }
}

// =============================================================================
// Main Component (for backward compatibility)
// =============================================================================

export function ChatHistory({ messages, width }: ChatHistoryProps) {
  return (
    <Box flexDirection="column">
      {messages.map((message, i) => renderMessage(message, i, width))}
    </Box>
  );
}

export default ChatHistory;
