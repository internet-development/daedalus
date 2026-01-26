/**
 * TreeView Component
 *
 * Renders bean dependencies as an interactive tree with navigation.
 * Shows parent/child hierarchy with status indicators and colors.
 */
import React, { useMemo } from 'react';
import { Box, Text } from 'ink';
import type { Bean } from '../../talos/beans-client.js';
import {
  buildParentChildTree,
  buildBlockingTree,
  getStatusColor,
  getTypeColor,
  isReadyToExecute,
  flattenTree,
  type TreeNode,
  type FlatTreeNode,
} from './tree-utils.js';

// =============================================================================
// Types
// =============================================================================

export interface TreeViewProps {
  /** Beans to display in the tree */
  beans: Bean[];
  /** Root bean ID to start from (optional) */
  rootId?: string;
  /** Show blocking relationships instead of parent/child */
  blocking?: boolean;
  /** Currently selected bean ID */
  selectedId?: string;
  /** Set of bean IDs that are currently running */
  runningIds?: Set<string>;
  /** Compact mode - less verbose display */
  compact?: boolean;
  /** Maximum width for display */
  width?: number;
}

// =============================================================================
// Sub-components
// =============================================================================

interface TreeNodeRowProps {
  flatNode: FlatTreeNode;
  isSelected: boolean;
  isRunning: boolean;
  isReady: boolean;
  allBeans: Bean[];
  blocking: boolean;
  compact: boolean;
  width?: number;
}

function TreeNodeRow({
  flatNode,
  isSelected,
  isRunning,
  isReady,
  allBeans,
  blocking,
  compact,
  width,
}: TreeNodeRowProps) {
  const { node, prefix } = flatNode;
  const { bean, children } = node;

  const statusColor = getStatusColor(bean.status);
  const typeColor = getTypeColor(bean.type);

  // Determine icon based on state
  let icon = '';
  let iconColor = statusColor;
  
  if (isRunning) {
    icon = '▶';
    iconColor = 'green';
  } else if (isReady) {
    icon = '●';
    iconColor = 'green';
  } else if (bean.status === 'completed') {
    icon = '✓';
    iconColor = 'green';
  } else if (bean.status === 'in-progress') {
    icon = '▶';
    iconColor = 'yellow';
  } else if (bean.status === 'todo') {
    icon = '○';
    iconColor = 'cyan';
  } else if (bean.status === 'draft') {
    icon = '◌';
    iconColor = 'gray';
  } else if (bean.status === 'scrapped') {
    icon = '✗';
    iconColor = 'red';
  }

  // Calculate max title length
  const maxTitleLen = width ? Math.max(20, width - prefix.length - 30) : 40;
  const truncatedTitle =
    bean.title.length > maxTitleLen
      ? bean.title.slice(0, maxTitleLen - 1) + '…'
      : bean.title;

  return (
    <Box>
      {/* Selection indicator */}
      <Text color={isSelected ? 'cyan' : undefined}>
        {isSelected ? '>' : ' '}
      </Text>

      {/* Tree prefix (box-drawing chars) */}
      <Text color="gray">{prefix}</Text>

      {/* Status icon */}
      <Text color={iconColor as any}>{icon}</Text>

      {/* Bean ID (short) */}
      <Text color="gray"> {bean.id.replace('daedalus-', '')} </Text>

      {/* Title */}
      <Text bold={isSelected}>{truncatedTitle}</Text>

      {/* Type and status (unless compact) */}
      {!compact && (
        <>
          <Text> </Text>
          <Text color={typeColor as any}>({bean.type})</Text>
          <Text> </Text>
          <Text color={statusColor as any}>[{bean.status}]</Text>
        </>
      )}

      {/* Ready indicator */}
      {isReady && !isRunning && (
        <Text color="green"> READY</Text>
      )}

      {/* Blocking count */}
      {blocking && children.length > 0 && (
        <Text color="yellow"> → {children.length}</Text>
      )}
    </Box>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function TreeView({
  beans,
  rootId,
  blocking = false,
  selectedId,
  runningIds = new Set(),
  compact = false,
  width,
}: TreeViewProps) {
  // Build tree
  const trees = useMemo(() => {
    if (beans.length === 0) return [];
    return blocking
      ? buildBlockingTree(beans, rootId)
      : buildParentChildTree(beans, rootId);
  }, [beans, rootId, blocking]);

  // Flatten for rendering
  const flatNodes = useMemo(() => {
    return flattenTree(trees);
  }, [trees]);

  if (flatNodes.length === 0) {
    return (
      <Text color="gray">
        {beans.length === 0 ? 'No beans found' : 'Bean not found'}
      </Text>
    );
  }

  return (
    <Box flexDirection="column">
      {flatNodes.map((flatNode) => {
        const beanId = flatNode.node.bean.id;
        const isSelected = selectedId === beanId;
        const isRunning = runningIds.has(beanId);
        const isReady = isReadyToExecute(flatNode.node.bean, beans);

        return (
          <TreeNodeRow
            key={beanId}
            flatNode={flatNode}
            isSelected={isSelected}
            isRunning={isRunning}
            isReady={isReady}
            allBeans={beans}
            blocking={blocking}
            compact={compact}
            width={width}
          />
        );
      })}
    </Box>
  );
}

export default TreeView;
