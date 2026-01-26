/**
 * MultipleChoice Component
 *
 * Displays a multiple choice question with numbered options.
 * Supports keyboard selection via number keys or arrow navigation.
 */
import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';

// =============================================================================
// Types
// =============================================================================

export interface ChoiceOption {
  label: string;
  value: string;
}

export interface MultipleChoiceProps {
  question: string;
  options: ChoiceOption[];
  onSelect: (value: string) => void;
}

// =============================================================================
// Main Component
// =============================================================================

export function MultipleChoice({
  question,
  options,
  onSelect,
}: MultipleChoiceProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  useInput((input, key) => {
    // Number key selection (1-9)
    if (input >= '1' && input <= '9') {
      const index = parseInt(input, 10) - 1;
      if (index < options.length) {
        onSelect(options[index].value);
      }
      return;
    }

    // Arrow key navigation
    if (key.upArrow || input === 'k') {
      setSelectedIndex((i) => Math.max(0, i - 1));
      return;
    }

    if (key.downArrow || input === 'j') {
      setSelectedIndex((i) => Math.min(options.length - 1, i + 1));
      return;
    }

    // Enter to confirm selection
    if (key.return) {
      onSelect(options[selectedIndex].value);
      return;
    }

    // Tab to cycle through options
    if (key.tab) {
      setSelectedIndex((i) => (i + 1) % options.length);
      return;
    }
  });

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1}>
      <Text bold color="cyan">
        {question}
      </Text>
      <Box flexDirection="column" marginTop={1}>
        {options.map((option, index) => (
          <Box key={option.value}>
            <Text
              color={selectedIndex === index ? 'cyan' : undefined}
              bold={selectedIndex === index}
            >
              {selectedIndex === index ? '>' : ' '}
            </Text>
            <Text color="cyan">[{index + 1}]</Text>
            <Text color={selectedIndex === index ? 'white' : 'gray'}>
              {' '}
              {option.label}
            </Text>
          </Box>
        ))}
      </Box>
      <Box marginTop={1}>
        <Text color="gray" dimColor>
          Press 1-{options.length} or Enter to select
        </Text>
      </Box>
    </Box>
  );
}

export default MultipleChoice;
