import React, { useState, useEffect } from 'react';
import { Text } from 'ink';

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
const FRAME_INTERVAL = 80;

export function ThinkingIndicator() {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setFrame(f => (f + 1) % SPINNER_FRAMES.length);
    }, FRAME_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  return (
    <Text color="cyan">
      {SPINNER_FRAMES[frame]} Thinking...
    </Text>
  );
}
