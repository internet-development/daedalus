/**
 * MonitorView
 *
 * Bean list grouped by status with queue information and navigation.
 * 
 * Groups displayed (in order):
 * - IN PROGRESS: Currently running beans (actively being worked on by agent)
 * - TODO QUEUE: Beans with 'todo' status waiting to be worked on
 * - STUCK: Beans with 'blocked' or 'failed' tags
 * - RECENTLY COMPLETED: Last 5 completed beans
 * - DRAFTS: (toggleable, shown by default) Beans in 'draft' status
 * 
 * Status Icons:
 * - ▶ In progress (running)
 * - ● Next up (first in queue)
 * - ○ Queued (todo status)
 * - ⚠ Stuck (with 'blocked' or 'failed' tag)
 * - ✓ Completed (in recent section)
 * - ◌ Draft
 * 
 * Tree View (toggle with 't'):
 * - Shows parent/child hierarchy
 * - Highlights ready-to-execute beans
 * - Shows execution path
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Box, Text, useInput, useStdout } from 'ink';
import { useTalos } from '../TalosContext.js';
import type { Bean, BeanPriority } from '../../talos/beans-client.js';
import { isStuck, listBeans } from '../../talos/beans-client.js';
import type { RunningBean } from '../../talos/talos.js';
import { TreeView, flattenTree, buildParentChildTree } from '../components/index.js';

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
    <Box flexDirection="column" marginBottom={0}>
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
  const [allBeans, setAllBeans] = useState<Bean[]>([]);
  const [showDrafts, setShowDrafts] = useState(true);
  const [showTreeView, setShowTreeView] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedTreeIndex, setSelectedTreeIndex] = useState(0);
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

  // Load all beans for tree view (excluding completed/scrapped by default)
  useEffect(() => {
    if (showTreeView) {
      listBeans({ excludeStatus: ['scrapped'] })
        .then(setAllBeans)
        .catch(() => setAllBeans([]));
    }
  }, [showTreeView]);

  // Build flattened tree for navigation
  const flatTreeNodes = useMemo(() => {
    if (!showTreeView || allBeans.length === 0) return [];
    const trees = buildParentChildTree(allBeans);
    return flattenTree(trees);
  }, [showTreeView, allBeans]);

  // Get running bean IDs for tree view highlighting
  const runningIds = useMemo(() => {
    const ids = new Set<string>();
    for (const [id] of inProgress) {
      ids.add(id);
    }
    return ids;
  }, [inProgress]);

  // Get selected bean ID for tree view
  const selectedTreeBeanId = useMemo(() => {
    if (!showTreeView || flatTreeNodes.length === 0) return undefined;
    const idx = Math.min(selectedTreeIndex, flatTreeNodes.length - 1);
    return flatTreeNodes[idx]?.node.bean.id;
  }, [showTreeView, flatTreeNodes, selectedTreeIndex]);

  // Subscribe to Talos events
  useEffect(() => {
    // Helper to refresh drafts when beans change
    const refreshDrafts = () => {
      if (showDrafts) {
        listBeans({ status: ['draft'] })
          .then(setDrafts)
          .catch(() => setDrafts([]));
      }
    };

    const handleQueueChanged = () => {
      setQueue(talos.getQueue());
      setStuck(talos.getStuck());
      refreshDrafts();
    };

    const handleBeanStarted = () => {
      setInProgress(talos.getInProgress());
    };

    const handleBeanCompleted = () => {
      setInProgress(talos.getInProgress());
      setRecentlyCompleted(talos.getRecentlyCompleted());
      refreshDrafts();
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
  }, [talos, showDrafts]);

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

    // In Progress group (FIRST - most important)
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

    // Todo Queue group
    const queueDisplayBeans: DisplayBean[] = queue.map((bean, i) => ({
      bean,
      icon: i === 0 ? STATUS_ICONS.nextUp : STATUS_ICONS.queued,
      iconColor: i === 0 ? 'green' : 'gray',
    }));
    result.push({
      title: 'TODO QUEUE',
      beans: queueDisplayBeans,
      emptyMessage: 'No beans in queue',
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

    // Drafts group (toggleable, shown by default)
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

      // Toggle tree view
      if (input === 't') {
        setShowTreeView((s) => !s);
        return;
      }

      // Navigation - different for tree view vs list view
      if (showTreeView) {
        if (key.upArrow || input === 'k') {
          setSelectedTreeIndex((i) => Math.max(0, i - 1));
          return;
        }

        if (key.downArrow || input === 'j') {
          setSelectedTreeIndex((i) => Math.min(flatTreeNodes.length - 1, i + 1));
          return;
        }
      } else {
        if (key.upArrow || input === 'k') {
          setSelectedIndex((i) => Math.max(0, i - 1));
          return;
        }

        if (key.downArrow || input === 'j') {
          setSelectedIndex((i) => Math.min(allDisplayBeans.length - 1, i + 1));
          return;
        }
      }

      // Toggle drafts (list view only)
      if (input === 'd' && !showTreeView) {
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
      {/* View mode header */}
      <Box marginBottom={1}>
        <Text bold color="cyan">
          {showTreeView ? 'Tree View' : 'List View'}
        </Text>
        <Text color="gray"> (press t to toggle)</Text>
      </Box>

      {/* Tree View */}
      {showTreeView ? (
        <TreeView
          beans={allBeans}
          selectedId={selectedTreeBeanId}
          runningIds={runningIds}
          width={terminalWidth - 4}
        />
      ) : (
        /* Bean groups (List View) */
        groupsWithOffsets.map(({ group, offset }) => (
          <BeanListGroup
            key={group.title}
            group={group}
            selectedIndex={selectedIndex}
            globalIndexOffset={offset}
          />
        ))
      )}

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
          <Text color="cyan">[t]</Text> {showTreeView ? 'list' : 'tree'} view{' '}
          {!showTreeView && (
            <>
              <Text color="cyan">[Enter]</Text> actions{' '}
              <Text color="cyan">[d]</Text> {showDrafts ? 'hide' : 'show'} drafts
            </>
          )}
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
