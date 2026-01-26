/**
 * ModeSelector Component
 *
 * UI for switching between planning modes and selecting beans for refinement/critique.
 */
import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { listBeans, type Bean } from '../../talos/beans-client.js';
import type { PlanMode } from '../views/PlanView.js';

// =============================================================================
// Types
// =============================================================================

export interface ModeSelectorProps {
  currentMode: PlanMode;
  onSelect: (mode: PlanMode, bean?: Bean) => void;
  onCancel: () => void;
}

interface ModeOption {
  mode: PlanMode;
  label: string;
  description: string;
  requiresBean: boolean;
}

// =============================================================================
// Constants
// =============================================================================

const MODE_OPTIONS: ModeOption[] = [
  {
    mode: 'new',
    label: 'New Bean',
    description: 'Create new beans through conversation',
    requiresBean: false,
  },
  {
    mode: 'refine',
    label: 'Refine Bean',
    description: 'Refine an existing draft bean',
    requiresBean: true,
  },
  {
    mode: 'critique',
    label: 'Critique Bean',
    description: 'Run a draft through expert review',
    requiresBean: true,
  },
  {
    mode: 'sweep',
    label: 'Final Sweep',
    description: 'Consistency check across related beans',
    requiresBean: false,
  },
];

// =============================================================================
// Main Component
// =============================================================================

export function ModeSelector({
  currentMode,
  onSelect,
  onCancel,
}: ModeSelectorProps) {
  const [step, setStep] = useState<'mode' | 'bean'>('mode');
  const [selectedModeIndex, setSelectedModeIndex] = useState(
    MODE_OPTIONS.findIndex((m) => m.mode === currentMode)
  );
  const [selectedBeanIndex, setSelectedBeanIndex] = useState(0);
  const [draftBeans, setDraftBeans] = useState<Bean[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load draft beans when entering bean selection step
  useEffect(() => {
    if (step === 'bean') {
      setLoading(true);
      setError(null);
      listBeans({ status: ['draft', 'todo'] })
        .then((beans) => {
          setDraftBeans(beans);
          setLoading(false);
        })
        .catch((err: Error) => {
          setError(err.message);
          setLoading(false);
        });
    }
  }, [step]);

  // Handle keyboard input
  useInput((input, key) => {
    // Cancel
    if (key.escape || input === 'q') {
      if (step === 'bean') {
        setStep('mode');
      } else {
        onCancel();
      }
      return;
    }

    if (step === 'mode') {
      // Mode selection
      if (key.upArrow || input === 'k') {
        setSelectedModeIndex((i) => Math.max(0, i - 1));
        return;
      }

      if (key.downArrow || input === 'j') {
        setSelectedModeIndex((i) => Math.min(MODE_OPTIONS.length - 1, i + 1));
        return;
      }

      if (key.return) {
        const selected = MODE_OPTIONS[selectedModeIndex];
        if (selected.requiresBean) {
          setStep('bean');
        } else {
          onSelect(selected.mode);
        }
        return;
      }

      // Number key quick select (1-4)
      if (input >= '1' && input <= '4') {
        const index = parseInt(input, 10) - 1;
        if (index < MODE_OPTIONS.length) {
          const selected = MODE_OPTIONS[index];
          if (selected.requiresBean) {
            setSelectedModeIndex(index);
            setStep('bean');
          } else {
            onSelect(selected.mode);
          }
        }
        return;
      }
    } else if (step === 'bean') {
      // Bean selection
      if (key.upArrow || input === 'k') {
        setSelectedBeanIndex((i) => Math.max(0, i - 1));
        return;
      }

      if (key.downArrow || input === 'j') {
        setSelectedBeanIndex((i) => Math.min(draftBeans.length - 1, i + 1));
        return;
      }

      if (key.return) {
        const selectedMode = MODE_OPTIONS[selectedModeIndex];
        const selectedBean = draftBeans[selectedBeanIndex];
        if (selectedBean) {
          onSelect(selectedMode.mode, selectedBean);
        }
        return;
      }
    }
  });

  if (step === 'bean') {
    // Bean selection step
    return (
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor="cyan"
        padding={1}
      >
        <Text color="cyan" bold>
          Select Bean to {MODE_OPTIONS[selectedModeIndex].label}
        </Text>

        {loading && (
          <Text color="gray">Loading beans...</Text>
        )}

        {error && (
          <Text color="red">Error: {error}</Text>
        )}

        {!loading && !error && draftBeans.length === 0 && (
          <Box flexDirection="column">
            <Text color="gray">No draft or todo beans found.</Text>
            <Text color="gray" dimColor>
              Create a bean first, or switch to New Bean mode.
            </Text>
          </Box>
        )}

        {!loading && !error && draftBeans.length > 0 && (
          <Box flexDirection="column" marginTop={1}>
            {draftBeans.slice(0, 10).map((bean, index) => (
              <Box key={bean.id}>
                <Text
                  color={selectedBeanIndex === index ? 'cyan' : undefined}
                  bold={selectedBeanIndex === index}
                >
                  {selectedBeanIndex === index ? '>' : ' '}
                </Text>
                <Text color="gray"> {bean.id.replace('beans-', '')} </Text>
                <Text
                  color={selectedBeanIndex === index ? 'white' : 'gray'}
                  bold={selectedBeanIndex === index}
                >
                  {bean.title.slice(0, 40)}
                  {bean.title.length > 40 ? '...' : ''}
                </Text>
                <Text color="gray" dimColor>
                  {' '}
                  [{bean.status}]
                </Text>
              </Box>
            ))}
            {draftBeans.length > 10 && (
              <Text color="gray" dimColor>
                ...and {draftBeans.length - 10} more
              </Text>
            )}
          </Box>
        )}

        <Box marginTop={1}>
          <Text color="gray" dimColor>
            [j/k] navigate [Enter] select [Esc] back
          </Text>
        </Box>
      </Box>
    );
  }

  // Mode selection step
  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="cyan"
      padding={1}
    >
      <Text color="cyan" bold>
        Select Planning Mode
      </Text>
      <Text color="gray" dimColor>
        Choose how you want to work
      </Text>

      <Box flexDirection="column" marginTop={1}>
        {MODE_OPTIONS.map((option, index) => (
          <Box key={option.mode} flexDirection="column">
            <Box>
              <Text
                color={selectedModeIndex === index ? 'cyan' : undefined}
                bold={selectedModeIndex === index}
              >
                {selectedModeIndex === index ? '>' : ' '}
              </Text>
              <Text color="cyan">[{index + 1}]</Text>
              <Text
                color={selectedModeIndex === index ? 'white' : 'gray'}
                bold={selectedModeIndex === index}
              >
                {' '}
                {option.label}
              </Text>
              {option.mode === currentMode && (
                <Text color="green" dimColor>
                  {' '}
                  (current)
                </Text>
              )}
            </Box>
            {selectedModeIndex === index && (
              <Box marginLeft={4}>
                <Text color="gray" dimColor>
                  {option.description}
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

export default ModeSelector;
