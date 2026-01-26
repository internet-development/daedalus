/**
 * ExpertQuote Component
 *
 * Displays a quote from an expert advisor with distinct styling.
 * Each expert has a unique color for easy identification.
 */
import React from 'react';
import { Box, Text } from 'ink';

// =============================================================================
// Types
// =============================================================================

export type ExpertType =
  | 'pragmatist'
  | 'architect'
  | 'skeptic'
  | 'simplifier'
  | 'security';

export interface ExpertQuoteProps {
  expert: string;
  quote: string;
}

// =============================================================================
// Constants
// =============================================================================

const EXPERT_COLORS: Record<string, string> = {
  pragmatist: 'green',
  architect: 'blue',
  skeptic: 'yellow',
  simplifier: 'magenta',
  security: 'red',
};

const EXPERT_LABELS: Record<string, string> = {
  pragmatist: 'Pragmatist',
  architect: 'Architect',
  skeptic: 'Skeptic',
  simplifier: 'Simplifier',
  security: 'Security',
};

// =============================================================================
// Main Component
// =============================================================================

export function ExpertQuote({ expert, quote }: ExpertQuoteProps) {
  const normalizedExpert = expert.toLowerCase();
  const color = EXPERT_COLORS[normalizedExpert] ?? 'gray';
  const label = EXPERT_LABELS[normalizedExpert] ?? expert;

  return (
    <Box>
      <Text color={color as any} bold>
        {'> '}
        {label}:{' '}
      </Text>
      <Text color={color as any} dimColor>
        "{quote}"
      </Text>
    </Box>
  );
}

export default ExpertQuote;
