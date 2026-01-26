/**
 * PromptSelector Component
 *
 * UI for selecting custom prompts from .talos/prompts/ directory.
 * Includes built-in default prompts and user-defined prompts.
 */
import React, { useState, useEffect, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
import { loadPrompts, type CustomPrompt } from '../../planning/prompts.js';

// =============================================================================
// Types
// =============================================================================

export interface PromptSelectorProps {
  onSelect: (prompt: string) => void;
  onCancel: () => void;
}

// =============================================================================
// Main Component
// =============================================================================

export function PromptSelector({ onSelect, onCancel }: PromptSelectorProps) {
  const [prompts, setPrompts] = useState<CustomPrompt[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load prompts on mount
  useEffect(() => {
    loadPrompts()
      .then((loaded: CustomPrompt[]) => {
        setPrompts(loaded);
        setLoading(false);
      })
      .catch((err: Error) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  // Handle keyboard input
  useInput((input, key) => {
    // Cancel
    if (key.escape || input === 'q') {
      onCancel();
      return;
    }

    // Navigation
    if (key.upArrow || input === 'k') {
      setSelectedIndex((i) => Math.max(0, i - 1));
      return;
    }

    if (key.downArrow || input === 'j') {
      setSelectedIndex((i) => Math.min(prompts.length - 1, i + 1));
      return;
    }

    // Select
    if (key.return) {
      const selected = prompts[selectedIndex];
      if (selected) {
        onSelect(selected.content);
      }
      return;
    }

    // Number key quick select (1-9)
    if (input >= '1' && input <= '9') {
      const index = parseInt(input, 10) - 1;
      if (index < prompts.length) {
        onSelect(prompts[index].content);
      }
      return;
    }
  });

  if (loading) {
    return (
      <Box flexDirection="column" borderStyle="round" borderColor="cyan" padding={1}>
        <Text color="cyan" bold>
          Custom Prompts
        </Text>
        <Text color="gray">Loading prompts...</Text>
      </Box>
    );
  }

  if (error) {
    return (
      <Box flexDirection="column" borderStyle="round" borderColor="red" padding={1}>
        <Text color="red" bold>
          Error Loading Prompts
        </Text>
        <Text color="gray">{error}</Text>
        <Box marginTop={1}>
          <Text color="gray" dimColor>
            Press Esc to close
          </Text>
        </Box>
      </Box>
    );
  }

  if (prompts.length === 0) {
    return (
      <Box flexDirection="column" borderStyle="round" borderColor="cyan" padding={1}>
        <Text color="cyan" bold>
          Custom Prompts
        </Text>
        <Text color="gray">No prompts available.</Text>
        <Text color="gray" dimColor>
          Add prompts to .talos/prompts/ as markdown files.
        </Text>
        <Box marginTop={1}>
          <Text color="gray" dimColor>
            Press Esc to close
          </Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="cyan" padding={1}>
      <Text color="cyan" bold>
        Custom Prompts
      </Text>
      <Text color="gray" dimColor>
        Select a prompt to guide the planning conversation
      </Text>

      <Box flexDirection="column" marginTop={1}>
        {prompts.map((prompt, index) => (
          <Box key={prompt.name} flexDirection="column">
            <Box>
              <Text
                color={selectedIndex === index ? 'cyan' : undefined}
                bold={selectedIndex === index}
              >
                {selectedIndex === index ? '>' : ' '}
              </Text>
              <Text color="cyan">[{index + 1}]</Text>
              <Text color={selectedIndex === index ? 'white' : 'gray'} bold>
                {' '}
                {prompt.name}
              </Text>
            </Box>
            {selectedIndex === index && prompt.description && (
              <Box marginLeft={4}>
                <Text color="gray" dimColor>
                  {prompt.description}
                </Text>
              </Box>
            )}
          </Box>
        ))}
      </Box>

      <Box marginTop={1}>
        <Text color="gray" dimColor>
          [j/k] navigate [Enter] select [Esc] cancel
        </Text>
      </Box>
    </Box>
  );
}

export default PromptSelector;
