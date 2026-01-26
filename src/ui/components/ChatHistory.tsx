/**
 * ChatHistory Component
 *
 * Displays chat messages with support for user, assistant, and system messages.
 * Includes rendering for expert quotes and tool call indicators.
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
// Sub-components
// =============================================================================

interface MessageProps {
  message: ChatMessage;
  width?: number;
}

function UserMessage({ message, width }: MessageProps) {
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

function AssistantMessage({ message, width }: MessageProps) {
  const maxWidth = width ? width - 10 : 60;
  const expertQuotes = parseExpertQuotes(message.content);
  const toolIndicators = parseToolIndicators(message.content);
  const cleanedContent = cleanContent(message.content);

  // Split content into lines for wrapping
  const lines = cleanedContent.split('\n');

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box>
        <Text bold color="cyan">
          Planner:{' '}
        </Text>
        {message.isStreaming && (
          <Text color="yellow" dimColor>
            (typing...)
          </Text>
        )}
      </Box>

      {/* Tool indicators */}
      {toolIndicators.length > 0 && (
        <Box flexDirection="column" marginLeft={2}>
          {toolIndicators.map((indicator, i) => (
            <Text key={i} color="gray" dimColor>
              [{indicator}]
            </Text>
          ))}
        </Box>
      )}

      {/* Main content */}
      <Box flexDirection="column" marginLeft={2}>
        {lines.map((line, i) => (
          <Text key={i} wrap="wrap">
            {line.slice(0, maxWidth)}
          </Text>
        ))}
      </Box>

      {/* Expert quotes */}
      {expertQuotes.length > 0 && (
        <Box flexDirection="column" marginLeft={2} marginTop={1}>
          {expertQuotes.map((eq, i) => (
            <ExpertQuote key={i} expert={eq.expert} quote={eq.quote} />
          ))}
        </Box>
      )}

      {/* Tool calls (if any) */}
      {message.toolCalls && message.toolCalls.length > 0 && (
        <Box flexDirection="column" marginLeft={2} marginTop={1}>
          {message.toolCalls.map((tc, i) => (
            <Text key={i} color="gray" dimColor>
              [Tool: {tc.name}]
            </Text>
          ))}
        </Box>
      )}
    </Box>
  );
}

function SystemMessage({ message }: MessageProps) {
  return (
    <Box marginBottom={1}>
      <Text color="yellow" dimColor>
        {message.content}
      </Text>
    </Box>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function ChatHistory({ messages, width }: ChatHistoryProps) {
  return (
    <Box flexDirection="column">
      {messages.map((message, i) => {
        switch (message.role) {
          case 'user':
            return <UserMessage key={i} message={message} width={width} />;
          case 'assistant':
            return <AssistantMessage key={i} message={message} width={width} />;
          case 'system':
            return <SystemMessage key={i} message={message} width={width} />;
          default:
            return null;
        }
      })}
    </Box>
  );
}

export default ChatHistory;
