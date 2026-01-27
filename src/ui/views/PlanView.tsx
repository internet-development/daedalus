/**
 * PlanView
 *
 * AI-powered planning workbench for creating, refining, and critiquing beans.
 * Central to the Daedalus workflow - all beans originate through structured
 * conversation with a dedicated planning agent and its expert advisors.
 *
 * Modes:
 * - new: Create new beans through conversation
 * - refine: Refine existing draft beans
 * - critique: Run draft beans through expert review
 * - sweep: Final consistency check across related beans
 * - brainstorm: Socratic questioning workflow for design exploration
 * - breakdown: Task breakdown workflow for implementation planning
 */
import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { Box, Text, useInput, useStdout } from 'ink';
import { loadConfig } from '../../config/index.js';
import { ChatHistory, type ChatMessage, type ToolCall } from '../components/ChatHistory.js';
import { ChatInput } from '../components/ChatInput.js';
import { MultipleChoice } from '../components/MultipleChoice.js';
import { PromptSelector } from '../components/PromptSelector.js';
import { ModeSelector } from '../components/ModeSelector.js';
import { useChatHistory } from '../hooks/useChatHistory.js';
import { usePlanningAgent } from '../hooks/usePlanningAgent.js';
import type { Bean } from '../../talos/beans-client.js';

// =============================================================================
// Types
// =============================================================================

export type PlanMode = 'new' | 'refine' | 'critique' | 'sweep' | 'brainstorm' | 'breakdown';

// Ordered list of modes for cycling
const PLAN_MODES: PlanMode[] = ['new', 'refine', 'critique', 'sweep', 'brainstorm', 'breakdown'];

export interface PendingChoice {
  id: string;
  question: string;
  options: Array<{ label: string; value: string }>;
}

// =============================================================================
// Constants
// =============================================================================

const MODE_LABELS: Record<PlanMode, string> = {
  new: 'New Bean',
  refine: 'Refine',
  critique: 'Critique',
  sweep: 'Final Sweep',
  brainstorm: 'Brainstorm',
  breakdown: 'Breakdown',
};

const MODE_HINTS: Record<PlanMode, string> = {
  new: 'Creating new beans through conversation...',
  refine: 'Refining and improving draft beans...',
  critique: 'Running expert review...',
  sweep: 'Checking consistency across beans...',
  brainstorm: 'Asking Socratic questions...',
  breakdown: 'Breaking down into child beans...',
};

// =============================================================================
// Main Component
// =============================================================================

export function PlanView() {
  const { stdout } = useStdout();
  const terminalWidth = stdout?.columns ?? 80;

  // Load config for planning agent settings
  const config = useMemo(() => loadConfig().config, []);

  // State
  const [mode, setMode] = useState<PlanMode>('new');
  const [selectedBean, setSelectedBean] = useState<Bean | null>(null);
  const [showPromptSelector, setShowPromptSelector] = useState(false);
  const [showModeSelector, setShowModeSelector] = useState(false);
  const [pendingChoice, setPendingChoice] = useState<PendingChoice | null>(null);
  
  // Bean operation tracking
  const [recentBeanOps, setRecentBeanOps] = useState<Array<{
    action: string;
    beanId: string;
    title: string;
    timestamp: number;
  }>>([]);
  
  // Skill status tracking
  const [skillStatus, setSkillStatus] = useState<{
    loaded: boolean;
    skillName?: string;
    phase?: string;
  }>({ loaded: false });

  // Chat history hook
  const {
    messages,
    addMessage,
    clearMessages,
    isLoading: historyLoading,
  } = useChatHistory();

  // Planning agent hook
  const {
    sendMessage,
    isStreaming,
    streamingContent,
    cancelStream,
  } = usePlanningAgent({
    config: config.planning_agent,
    expertsConfig: config.experts,
    mode,
    selectedBean,
    onMessageComplete: (content: string, toolCalls?: ToolCall[]) => {
      addMessage({
        role: 'assistant',
        content,
        toolCalls,
        timestamp: Date.now(),
      });

      // Track bean operations from tool calls
      if (toolCalls) {
        const beanOps: typeof recentBeanOps = [];
        for (const tc of toolCalls) {
          if (tc.name === 'beans_cli') {
            const args = tc.args as { action?: string; title?: string; id?: string };
            if (args.action === 'create' && args.title) {
              beanOps.push({
                action: 'created',
                beanId: 'new', // ID comes from result, not available here
                title: args.title,
                timestamp: Date.now(),
              });
            } else if (args.action === 'update' && args.id) {
              beanOps.push({
                action: 'updated',
                beanId: args.id,
                title: args.id,
                timestamp: Date.now(),
              });
            }
          } else if (tc.name === 'skill') {
            const args = tc.args as { skillName?: string };
            if (args.skillName) {
              setSkillStatus({
                loaded: true,
                skillName: args.skillName,
              });
            }
          }
        }
        if (beanOps.length > 0) {
          setRecentBeanOps((prev) => [...beanOps, ...prev].slice(0, 5));
        }
      }

      // Check if the message contains a multiple choice question
      const choiceMatch = content.match(/\[(\d)\]\s+(.+?)(?:\n|$)/g);
      if (choiceMatch && choiceMatch.length >= 2) {
        // Extract question (line before the choices)
        const lines = content.split('\n');
        const choiceStartIndex = lines.findIndex((l: string) => l.match(/\[1\]/));
        if (choiceStartIndex > 0) {
          const question = lines[choiceStartIndex - 1];
          const options = choiceMatch.map((m: string) => {
            const match = m.match(/\[(\d)\]\s+(.+)/);
            return {
              label: match?.[2]?.trim() ?? '',
              value: match?.[1] ?? '',
            };
          });
          setPendingChoice({
            id: `choice-${Date.now()}`,
            question,
            options,
          });
        }
      }
    },
    onError: (err: Error) => {
      addMessage({
        role: 'system',
        content: `Error: ${err.message}`,
        timestamp: Date.now(),
      });
    },
  });

  // Handle sending a message
  const handleSend = useCallback(
    async (text: string) => {
      // Add user message to history
      addMessage({
        role: 'user',
        content: text,
        timestamp: Date.now(),
      });

      // Clear any pending choice
      setPendingChoice(null);

      // Send to planning agent
      await sendMessage(text, messages);
    },
    [addMessage, sendMessage, messages]
  );

  // Handle multiple choice selection
  const handleChoiceSelect = useCallback(
    (value: string) => {
      if (pendingChoice) {
        const selected = pendingChoice.options.find((o) => o.value === value);
        if (selected) {
          handleSend(selected.label);
        }
      }
      setPendingChoice(null);
    },
    [pendingChoice, handleSend]
  );

  // Handle prompt selection
  const handlePromptSelect = useCallback(
    (prompt: string) => {
      setShowPromptSelector(false);
      handleSend(prompt);
    },
    [handleSend]
  );

  // Handle mode change
  const handleModeChange = useCallback((newMode: PlanMode, bean?: Bean) => {
    setMode(newMode);
    setSelectedBean(bean ?? null);
    setShowModeSelector(false);
    // Reset skill status when changing modes
    setSkillStatus({ loaded: false });
  }, []);

  // Handle clear chat
  const handleClearChat = useCallback(() => {
    clearMessages();
    setPendingChoice(null);
    setRecentBeanOps([]);
    setSkillStatus({ loaded: false });
  }, [clearMessages]);

  // Cycle through modes (for Tab/Shift+Tab navigation)
  const cycleMode = useCallback((direction: 1 | -1) => {
    const currentIndex = PLAN_MODES.indexOf(mode);
    const nextIndex = (currentIndex + direction + PLAN_MODES.length) % PLAN_MODES.length;
    setMode(PLAN_MODES[nextIndex]);
  }, [mode]);

  // Keyboard shortcuts
  useInput(
    (input, key) => {
      // Don't capture input if prompt or mode selector is open
      if (showPromptSelector || showModeSelector) return;

      // Ctrl+P: Open prompt selector
      if (key.ctrl && input === 'p') {
        setShowPromptSelector(true);
        return;
      }

      // Tab: Cycle to next mode
      if (key.tab && !key.shift) {
        cycleMode(1);
        return;
      }

      // Shift+Tab: Cycle to previous mode
      if (key.tab && key.shift) {
        cycleMode(-1);
        return;
      }

      // Ctrl+L: Clear chat
      if (key.ctrl && input === 'l') {
        handleClearChat();
        return;
      }

      // Number keys for quick choice selection
      if (pendingChoice && input >= '1' && input <= '9') {
        const index = parseInt(input, 10) - 1;
        if (index < pendingChoice.options.length) {
          handleChoiceSelect(pendingChoice.options[index].value);
        }
        return;
      }
    },
    { isActive: !showPromptSelector && !showModeSelector }
  );

  // Layout dimensions no longer calculated from terminal height
  // Views use flexGrow to fill available space instead

  // Combine messages with streaming content
  const displayMessages = useMemo(() => {
    const result = [...messages];
    if (isStreaming && streamingContent) {
      result.push({
        role: 'assistant',
        content: streamingContent,
        timestamp: Date.now(),
        isStreaming: true,
      });
    }
    return result;
  }, [messages, isStreaming, streamingContent]);

  // Prompt selector overlay
  if (showPromptSelector) {
    return (
      <Box flexDirection="column" padding={1}>
        <PromptSelector
          onSelect={handlePromptSelect}
          onCancel={() => setShowPromptSelector(false)}
        />
      </Box>
    );
  }

  // Mode selector overlay
  if (showModeSelector) {
    return (
      <Box flexDirection="column" padding={1}>
        <ModeSelector
          currentMode={mode}
          onSelect={handleModeChange}
          onCancel={() => setShowModeSelector(false)}
        />
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1} width={terminalWidth - 4}>
      {/* Header with mode indicator */}
      <Box justifyContent="space-between" marginBottom={1}>
        <Text bold>Plan</Text>
        <Box>
          <Text color="gray">[Mode: </Text>
          <Text color="cyan">{MODE_LABELS[mode]}</Text>
          {selectedBean && (
            <>
              <Text color="gray"> - </Text>
              <Text color="yellow">{selectedBean.id.replace('beans-', '')}</Text>
            </>
          )}
          <Text color="gray">]</Text>
        </Box>
      </Box>

      {/* Mode-specific hint and skill status */}
      {isStreaming && (
        <Box marginBottom={1}>
          <Text color="yellow" dimColor>
            {MODE_HINTS[mode]}
          </Text>
          {skillStatus.loaded && skillStatus.skillName && (
            <Text color="magenta" dimColor>
              {' '}[Skill: {skillStatus.skillName}]
            </Text>
          )}
        </Box>
      )}

      {/* Recent bean operations */}
      {recentBeanOps.length > 0 && (
        <Box flexDirection="column" marginBottom={1}>
          {recentBeanOps.slice(0, 3).map((op, i) => (
            <Box key={`${op.beanId}-${op.timestamp}`}>
              <Text color="green">
                {op.action === 'created' ? '+' : '~'}
              </Text>
              <Text color="gray"> Bean {op.action}: </Text>
              <Text color="white">{op.title}</Text>
            </Box>
          ))}
        </Box>
      )}

      {/* Separator */}
      <Box marginBottom={1}>
        <Text color="gray">{'─'.repeat(Math.min(terminalWidth - 6, 70))}</Text>
      </Box>

      {/* Chat history */}
      <Box flexDirection="column" flexGrow={1} overflowY="hidden">
        {messages.length === 0 && !isStreaming ? (
          <Box flexDirection="column">
            <Text color="gray">Welcome to the Planning Workbench!</Text>
            <Text color="gray" dimColor>
              Describe what you want to build, and I'll help you plan it.
            </Text>
            <Box marginTop={1}>
              <Text color="gray">Tips:</Text>
            </Box>
            <Text color="gray" dimColor>
              • Be specific about the problem you're solving
            </Text>
            <Text color="gray" dimColor>
              • I'll research your codebase and consult expert advisors
            </Text>
            <Text color="gray" dimColor>
              • Press <Text color="cyan">Ctrl+P</Text> for custom prompts
            </Text>
            <Text color="gray" dimColor>
              • Press <Text color="cyan">Tab</Text> to cycle modes
            </Text>
          </Box>
        ) : (
          <ChatHistory messages={displayMessages} width={terminalWidth - 8} />
        )}
      </Box>

      {/* Multiple choice selector (if pending) */}
      {pendingChoice && (
        <Box marginY={1}>
          <MultipleChoice
            question={pendingChoice.question}
            options={pendingChoice.options}
            onSelect={handleChoiceSelect}
          />
        </Box>
      )}

      {/* Separator */}
      <Box marginTop={1}>
        <Text color="gray">{'─'.repeat(Math.min(terminalWidth - 6, 70))}</Text>
      </Box>

      {/* Input area */}
      <ChatInput
        onSend={handleSend}
        disabled={isStreaming}
        placeholder={isStreaming ? 'Waiting for response...' : 'Type your message...'}
      />

      {/* Footer hints */}
      <Box marginTop={1}>
        <Text color="gray">
          <Text color="cyan">[Enter]</Text> Send
          {'  '}
          <Text color="cyan">[Ctrl+P]</Text> Prompts
          {'  '}
          <Text color="cyan">[Tab]</Text> Mode
          {'  '}
          <Text color="cyan">[Ctrl+L]</Text> Clear
          {'  '}
          <Text color="cyan">[Esc]</Text> Back
        </Text>
      </Box>
    </Box>
  );
}

export default PlanView;
