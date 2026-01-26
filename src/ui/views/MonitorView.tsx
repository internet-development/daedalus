/**
 * MonitorView
 *
 * Bean list grouped by status with queue information and navigation.
 * 
 * Groups displayed:
 * - QUEUE: Beans with 'todo' status waiting to be worked on
 * - IN PROGRESS: Currently running beans
 * - STUCK: In-progress beans with 'blocked' or 'failed' tags
 * - RECENTLY COMPLETED: Last 5 completed beans
 * - DRAFTS: (toggleable) Beans in 'draft' status
 * 
 * Status Icons:
 * - ○ Queued (todo status)
 * - ● Next up (first in queue)
 * - ▶ In progress (running)
 * - ⚠ Stuck (in-progress with 'blocked' or 'failed' tag)
 * - ✓ Completed (in recent section)
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Box, Text, useInput, useStdout } from 'ink';
import { useTalos } from '../TalosContext.js';
import type { Bean, BeanPriority } from '../../talos/beans-client.js';
import { isStuck, listBeans } from '../../talos/beans-client.js';
import type { RunningBean } from '../../talos/talos.js';

// =============================================================================
// Types
// =============================================================================

interface BeanGroup {
  title: string;
  beans: DisplayBean[];
  emptyMessage: string;
}

interface DisplayBean {
  bean: Bean;
  icon: string;
  iconColor: string;
  subtitle?: string;
  tags?: string[];
  startedAt?: number;
}

type ContextAction = {
  key: string;
  label: string;
  action: () => void;
};

// =============================================================================
// Constants
// =============================================================================

const PRIORITY_COLORS: Record<BeanPriority, string | undefined> = {
  critical: 'red',
  high: 'yellow',
  normal: undefined, // default
  low: 'gray',
  deferred: 'gray',
};

const STATUS_ICONS = {
  queued: '○',
  nextUp: '●',
  inProgress: '▶',
  stuck: '⚠',
  completed: '✓',
  draft: '◌',
};

// =============================================================================
// Sub-components
// =============================================================================

interface BeanItemProps {
  displayBean: DisplayBean;
  isSelected: boolean;
  width?: number;
}

function BeanItem({ displayBean, isSelected, width }: BeanItemProps) {
  const { bean, icon, iconColor, subtitle, tags, startedAt } = displayBean;
  const priorityColor = PRIORITY_COLORS[bean.priority];

  // Calculate elapsed time for in-progress beans
  const elapsedText = useMemo(() => {
    if (!startedAt) return null;
    const elapsed = Date.now() - startedAt;
    const seconds = Math.floor(elapsed / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  }, [startedAt]);

  // Truncate title if needed
  const maxTitleLen = width ? width - 40 : 40;
  const truncatedTitle =
    bean.title.length > maxTitleLen
      ? bean.title.slice(0, maxTitleLen - 1) + '…'
      : bean.title;

  return (
    <Box flexDirection="column">
      <Box>
        {/* Selection indicator */}
        <Text color={isSelected ? 'cyan' : undefined}>
          {isSelected ? '>' : ' '}
        </Text>

        {/* Status icon */}
        <Text color={iconColor as any}> {icon}</Text>

        {/* Bean ID */}
        <Text color="gray"> {bean.id.replace('beans-', '')} </Text>

        {/* Title with priority color */}
        <Text color={priorityColor as any} bold={isSelected}>
          {truncatedTitle}
        </Text>

        {/* Type */}
        <Text color="gray"> {bean.type}</Text>

        {/* Priority (if not normal) */}
        {bean.priority !== 'normal' && (
          <Text color={priorityColor as any}> {bean.priority}</Text>
        )}

        {/* Tags */}
        {tags?.map((tag) => (
          <Text key={tag} color="red">
            {' '}
            [{tag}]
          </Text>
        ))}

        {/* Elapsed time */}
        {elapsedText && (
          <Text color="gray"> ({elapsedText})</Text>
        )}
      </Box>

      {/* Subtitle line (for blockers, etc.) */}
      {subtitle && (
        <Box marginLeft={4}>
          <Text color="gray">└─ {subtitle}</Text>
        </Box>
      )}
    </Box>
  );
}

interface BeanListGroupProps {
  group: BeanGroup;
  selectedIndex: number | null;
  globalIndexOffset: number;
}

function BeanListGroup({
  group,
  selectedIndex,
  globalIndexOffset,
}: BeanListGroupProps) {
  return (
    <Box flexDirection="column" marginBottom={1}>
      {/* Group header */}
      <Text bold color="cyan">
        {group.title}
        {group.beans.length > 0 && (
          <Text color="gray"> ({group.beans.length})</Text>
        )}
      </Text>

      {/* Beans or empty message */}
      {group.beans.length === 0 ? (
        <Text color="gray" dimColor>
          {' '}
          {group.emptyMessage}
        </Text>
      ) : (
        <Box flexDirection="column">
          {group.beans.map((displayBean, i) => (
            <BeanItem
              key={displayBean.bean.id}
              displayBean={displayBean}
              isSelected={selectedIndex === globalIndexOffset + i}
            />
          ))}
        </Box>
      )}
    </Box>
  );
}

interface ContextMenuProps {
  actions: ContextAction[];
  onClose: () => void;
}

function ContextMenu({ actions, onClose }: ContextMenuProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  useInput((input, key) => {
    if (key.escape || input === 'q') {
      onClose();
      return;
    }

    if (key.upArrow || input === 'k') {
      setSelectedIndex((i) => Math.max(0, i - 1));
      return;
    }

    if (key.downArrow || input === 'j') {
      setSelectedIndex((i) => Math.min(actions.length - 1, i + 1));
      return;
    }

    if (key.return) {
      actions[selectedIndex]?.action();
      onClose();
      return;
    }

    // Check for direct hotkey
    const action = actions.find((a) => a.key === input);
    if (action) {
      action.action();
      onClose();
    }
  });

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      paddingX={1}
      marginLeft={2}
    >
      <Text bold color="cyan">
        Actions
      </Text>
      {actions.map((action, i) => (
        <Box key={action.key}>
          <Text color={selectedIndex === i ? 'cyan' : undefined}>
            {selectedIndex === i ? '>' : ' '}
          </Text>
          <Text color="cyan">[{action.key}]</Text>
          <Text color={selectedIndex === i ? 'white' : 'gray'}>
            {' '}
            {action.label}
          </Text>
        </Box>
      ))}
      <Text dimColor color="gray">
        [Esc] close
      </Text>
    </Box>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function MonitorView() {
  const talos = useTalos();
  const { stdout } = useStdout();

  // State
  const [queue, setQueue] = useState<Bean[]>(talos.getQueue());
  const [inProgress, setInProgress] = useState<Map<string, RunningBean>>(
    talos.getInProgress()
  );
  const [stuck, setStuck] = useState<Bean[]>(talos.getStuck());
  const [recentlyCompleted, setRecentlyCompleted] = useState<Bean[]>(
    talos.getRecentlyCompleted()
  );
  const [drafts, setDrafts] = useState<Bean[]>([]);
  const [showDrafts, setShowDrafts] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [elapsedTick, setElapsedTick] = useState(0);

  // Calculate terminal dimensions
  const terminalWidth = stdout?.columns ?? 80;

  // Load drafts when toggle is enabled
  useEffect(() => {
    if (showDrafts) {
      listBeans({ status: ['draft'] })
        .then(setDrafts)
        .catch(() => setDrafts([]));
    }
  }, [showDrafts]);

  // Subscribe to Talos events
  useEffect(() => {
    const handleQueueChanged = () => {
      setQueue(talos.getQueue());
      setStuck(talos.getStuck());
    };

    const handleBeanStarted = () => {
      setInProgress(talos.getInProgress());
    };

    const handleBeanCompleted = () => {
      setInProgress(talos.getInProgress());
      setRecentlyCompleted(talos.getRecentlyCompleted());
    };

    const handleBeanBlocked = () => {
      setStuck(talos.getStuck());
      setInProgress(talos.getInProgress());
    };

    const handleBeanFailed = () => {
      setStuck(talos.getStuck());
      setInProgress(talos.getInProgress());
    };

    talos.on('queue-changed', handleQueueChanged);
    talos.on('bean-started', handleBeanStarted);
    talos.on('bean-completed', handleBeanCompleted);
    talos.on('bean-blocked', handleBeanBlocked);
    talos.on('bean-failed', handleBeanFailed);

    return () => {
      talos.off('queue-changed', handleQueueChanged);
      talos.off('bean-started', handleBeanStarted);
      talos.off('bean-completed', handleBeanCompleted);
      talos.off('bean-blocked', handleBeanBlocked);
      talos.off('bean-failed', handleBeanFailed);
    };
  }, [talos]);

  // Timer for elapsed time updates
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedTick((t) => t + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Build display groups
  const groups = useMemo((): BeanGroup[] => {
    const result: BeanGroup[] = [];

    // Queue group
    const queueDisplayBeans: DisplayBean[] = queue.map((bean, i) => ({
      bean,
      icon: i === 0 ? STATUS_ICONS.nextUp : STATUS_ICONS.queued,
      iconColor: i === 0 ? 'green' : 'gray',
    }));
    result.push({
      title: 'QUEUE',
      beans: queueDisplayBeans,
      emptyMessage: 'No beans in queue',
    });

    // In Progress group
    const inProgressDisplayBeans: DisplayBean[] = [];
    for (const [, running] of inProgress) {
      inProgressDisplayBeans.push({
        bean: running.bean,
        icon: STATUS_ICONS.inProgress,
        iconColor: 'green',
        startedAt: running.startedAt,
      });
    }
    result.push({
      title: 'IN PROGRESS',
      beans: inProgressDisplayBeans,
      emptyMessage: 'No beans running',
    });

    // Stuck group
    const stuckDisplayBeans: DisplayBean[] = stuck.map((bean) => {
      const stuckTags = bean.tags.filter((t) => t === 'blocked' || t === 'failed');
      return {
        bean,
        icon: STATUS_ICONS.stuck,
        iconColor: 'yellow',
        tags: stuckTags,
        subtitle: stuckTags.includes('blocked')
          ? 'Agent hit a blocker'
          : 'Agent crashed or errored',
      };
    });
    if (stuckDisplayBeans.length > 0) {
      result.push({
        title: 'STUCK',
        beans: stuckDisplayBeans,
        emptyMessage: '',
      });
    }

    // Recently Completed group
    const completedDisplayBeans: DisplayBean[] = recentlyCompleted.map((bean) => ({
      bean,
      icon: STATUS_ICONS.completed,
      iconColor: 'green',
    }));
    result.push({
      title: 'RECENTLY COMPLETED',
      beans: completedDisplayBeans,
      emptyMessage: 'No recent completions',
    });

    // Drafts group (if toggled)
    if (showDrafts) {
      const draftDisplayBeans: DisplayBean[] = drafts.map((bean) => ({
        bean,
        icon: STATUS_ICONS.draft,
        iconColor: 'gray',
      }));
      result.push({
        title: 'DRAFTS',
        beans: draftDisplayBeans,
        emptyMessage: 'No draft beans',
      });
    }

    return result;
  }, [queue, inProgress, stuck, recentlyCompleted, showDrafts, drafts, elapsedTick]);

  // Flatten beans for selection
  const allDisplayBeans = useMemo(() => {
    return groups.flatMap((g) => g.beans);
  }, [groups]);

  // Clamp selection to valid range
  useEffect(() => {
    if (allDisplayBeans.length === 0) {
      setSelectedIndex(0);
    } else if (selectedIndex >= allDisplayBeans.length) {
      setSelectedIndex(allDisplayBeans.length - 1);
    }
  }, [allDisplayBeans.length, selectedIndex]);

  // Get selected bean
  const selectedBean = allDisplayBeans[selectedIndex]?.bean ?? null;

  // Build context menu actions based on selected bean
  const contextActions = useMemo((): ContextAction[] => {
    if (!selectedBean) return [];

    const actions: ContextAction[] = [];

    // View output (if has output)
    const output = talos.getOutput(selectedBean.id);
    if (output) {
      actions.push({
        key: 'o',
        label: 'View output',
        action: () => {
          // TODO: Switch to execute view with this bean's output
          console.log('View output for', selectedBean.id);
        },
      });
    }

    // Status-specific actions
    if (isStuck(selectedBean)) {
      actions.push({
        key: 'r',
        label: 'Retry',
        action: () => {
          talos.retry(selectedBean.id);
        },
      });
    }

    // Cancel (if in progress)
    if (inProgress.has(selectedBean.id)) {
      actions.push({
        key: 'c',
        label: 'Cancel',
        action: () => {
          talos.cancel(selectedBean.id);
        },
      });
    }

    return actions;
  }, [selectedBean, talos, inProgress]);

  // Keyboard navigation
  useInput(
    (input, key) => {
      // Don't handle input if context menu is open
      if (showContextMenu) return;

      // Navigation
      if (key.upArrow || input === 'k') {
        setSelectedIndex((i) => Math.max(0, i - 1));
        return;
      }

      if (key.downArrow || input === 'j') {
        setSelectedIndex((i) => Math.min(allDisplayBeans.length - 1, i + 1));
        return;
      }

      // Toggle drafts
      if (input === 'd') {
        setShowDrafts((s) => !s);
        return;
      }

      // Open context menu on Enter
      if (key.return && selectedBean && contextActions.length > 0) {
        setShowContextMenu(true);
        return;
      }

      // Quick retry shortcut
      if (input === 'r' && selectedBean && isStuck(selectedBean)) {
        talos.retry(selectedBean.id);
        return;
      }
    },
    { isActive: !showContextMenu }
  );

  // Calculate group index offsets for selection
  let currentOffset = 0;
  const groupsWithOffsets = groups.map((group) => {
    const offset = currentOffset;
    currentOffset += group.beans.length;
    return { group, offset };
  });

  return (
    <Box flexDirection="column" padding={1} width={terminalWidth - 4}>
      {/* Bean groups */}
      {groupsWithOffsets.map(({ group, offset }) => (
        <BeanListGroup
          key={group.title}
          group={group}
          selectedIndex={selectedIndex}
          globalIndexOffset={offset}
        />
      ))}

      {/* Context menu overlay */}
      {showContextMenu && selectedBean && (
        <Box position="absolute" marginTop={2}>
          <ContextMenu
            actions={contextActions}
            onClose={() => setShowContextMenu(false)}
          />
        </Box>
      )}

      {/* Footer hints */}
      <Box marginTop={1} borderStyle="single" borderLeft={false} borderRight={false} borderBottom={false} paddingTop={0}>
        <Text color="gray">
          <Text color="cyan">[j/k]</Text> navigate{' '}
          <Text color="cyan">[Enter]</Text> actions{' '}
          <Text color="cyan">[d]</Text> {showDrafts ? 'hide' : 'show'} drafts
          {selectedBean && isStuck(selectedBean) && (
            <>
              {' '}
              <Text color="cyan">[r]</Text> retry
            </>
          )}
        </Text>
      </Box>
    </Box>
  );
}

export default MonitorView;
