/**
 * ChatInput Component
 *
 * Text input for the chat interface with keyboard handling.
 * Supports multi-line input with Shift+Enter.
 */
import React, { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';

// =============================================================================
// Types
// =============================================================================

export interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

// =============================================================================
// Main Component
// =============================================================================

export function ChatInput({ onSend, disabled = false, placeholder }: ChatInputProps) {
  const [value, setValue] = useState('');
  const [cursorPosition, setCursorPosition] = useState(0);

  // Handle input
  useInput(
    (input, key) => {
      if (disabled) return;

      // Enter: Send message (if not empty)
      if (key.return && !key.shift) {
        if (value.trim()) {
          onSend(value.trim());
          setValue('');
          setCursorPosition(0);
        }
        return;
      }

      // Shift+Enter: Add newline
      if (key.return && key.shift) {
        setValue((v) => v.slice(0, cursorPosition) + '\n' + v.slice(cursorPosition));
        setCursorPosition((p) => p + 1);
        return;
      }

      // Backspace: Delete character before cursor
      if (key.backspace || key.delete) {
        if (cursorPosition > 0) {
          setValue((v) => v.slice(0, cursorPosition - 1) + v.slice(cursorPosition));
          setCursorPosition((p) => p - 1);
        }
        return;
      }

      // Left arrow: Move cursor left
      if (key.leftArrow) {
        setCursorPosition((p) => Math.max(0, p - 1));
        return;
      }

      // Right arrow: Move cursor right
      if (key.rightArrow) {
        setCursorPosition((p) => Math.min(value.length, p + 1));
        return;
      }

      // Home/Ctrl+A: Move to start
      if (key.ctrl && input === 'a') {
        setCursorPosition(0);
        return;
      }

      // End/Ctrl+E: Move to end
      if (key.ctrl && input === 'e') {
        setCursorPosition(value.length);
        return;
      }

      // Ctrl+U: Clear input
      if (key.ctrl && input === 'u') {
        setValue('');
        setCursorPosition(0);
        return;
      }

      // Regular character input
      if (input && !key.ctrl && !key.meta) {
        setValue((v) => v.slice(0, cursorPosition) + input + v.slice(cursorPosition));
        setCursorPosition((p) => p + input.length);
      }
    },
    { isActive: !disabled }
  );

  // Display value with cursor
  const displayValue = value || '';
  const beforeCursor = displayValue.slice(0, cursorPosition);
  const afterCursor = displayValue.slice(cursorPosition);
  const cursorChar = displayValue[cursorPosition] || ' ';

  return (
    <Box flexDirection="column">
      <Box>
        <Text color={disabled ? 'gray' : 'cyan'}>&gt; </Text>
        {displayValue ? (
          <Box>
            <Text>{beforeCursor}</Text>
            <Text inverse>{cursorChar}</Text>
            <Text>{afterCursor.slice(1)}</Text>
          </Box>
        ) : (
          <Box>
            <Text inverse> </Text>
            <Text color="gray" dimColor>
              {placeholder ?? 'Type your message...'}
            </Text>
          </Box>
        )}
      </Box>
    </Box>
  );
}

export default ChatInput;
