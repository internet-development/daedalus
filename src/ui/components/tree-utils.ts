/**
 * Tree Utilities
 *
 * Shared logic for building and rendering bean dependency trees.
 * Used by both CLI tree command and TUI TreeView component.
 */

import type { Bean } from '../../talos/beans-client.js';

// =============================================================================
// Types
// =============================================================================

export interface TreeNode {
  bean: Bean;
  children: TreeNode[];
}

// =============================================================================
// Tree Building Logic
// =============================================================================

/**
 * Build a tree from parent/child relationships
 */
export function buildParentChildTree(beans: Bean[], rootId?: string): TreeNode[] {
  const beanMap = new Map<string, Bean>();
  const childrenMap = new Map<string, Bean[]>();

  // Index beans
  for (const bean of beans) {
    beanMap.set(bean.id, bean);
    if (!childrenMap.has(bean.id)) {
      childrenMap.set(bean.id, []);
    }
  }

  // Build children lists
  for (const bean of beans) {
    if (bean.parentId && beanMap.has(bean.parentId)) {
      const siblings = childrenMap.get(bean.parentId) || [];
      siblings.push(bean);
      childrenMap.set(bean.parentId, siblings);
    }
  }

  // Recursive tree builder
  function buildNode(bean: Bean): TreeNode {
    const children = childrenMap.get(bean.id) || [];
    // Sort children by type priority, then by title
    const sortedChildren = [...children].sort((a, b) => {
      const typePriority: Record<string, number> = {
        milestone: 0,
        epic: 1,
        feature: 2,
        task: 3,
        bug: 4,
      };
      const aPriority = typePriority[a.type] ?? 5;
      const bPriority = typePriority[b.type] ?? 5;
      if (aPriority !== bPriority) return aPriority - bPriority;
      return a.title.localeCompare(b.title);
    });
    return {
      bean,
      children: sortedChildren.map(buildNode),
    };
  }

  // If root ID specified, start from that bean
  if (rootId) {
    const rootBean = beanMap.get(rootId);
    if (rootBean) {
      return [buildNode(rootBean)];
    }
    // Try short ID match
    for (const bean of beans) {
      if (bean.id.endsWith(rootId) || bean.id === `daedalus-${rootId}`) {
        return [buildNode(bean)];
      }
    }
    return [];
  }

  // Otherwise, find all root beans (no parent)
  const roots = beans.filter((b) => !b.parentId || !beanMap.has(b.parentId));
  return roots.map(buildNode).sort((a, b) => {
    const typePriority: Record<string, number> = {
      milestone: 0,
      epic: 1,
      feature: 2,
      task: 3,
      bug: 4,
    };
    const aPriority = typePriority[a.bean.type] ?? 5;
    const bPriority = typePriority[b.bean.type] ?? 5;
    if (aPriority !== bPriority) return aPriority - bPriority;
    return a.bean.title.localeCompare(b.bean.title);
  });
}

/**
 * Build a tree from blocking relationships
 * Shows what each bean is blocking (downstream dependencies)
 */
export function buildBlockingTree(beans: Bean[], rootId?: string): TreeNode[] {
  const beanMap = new Map<string, Bean>();
  const blockingMap = new Map<string, Bean[]>(); // bean ID -> beans it's blocking

  // Index beans
  for (const bean of beans) {
    beanMap.set(bean.id, bean);
    if (!blockingMap.has(bean.id)) {
      blockingMap.set(bean.id, []);
    }
  }

  // Build blocking lists (reverse of blockedBy)
  for (const bean of beans) {
    for (const blockingId of bean.blockingIds) {
      if (beanMap.has(blockingId)) {
        const blockedBean = beanMap.get(blockingId)!;
        const blockers = blockingMap.get(bean.id) || [];
        blockers.push(blockedBean);
        blockingMap.set(bean.id, blockers);
      }
    }
  }

  // Track visited to avoid cycles
  const visited = new Set<string>();

  function buildNode(bean: Bean): TreeNode {
    if (visited.has(bean.id)) {
      return { bean, children: [] };
    }
    visited.add(bean.id);

    const blocking = blockingMap.get(bean.id) || [];
    return {
      bean,
      children: blocking.map(buildNode),
    };
  }

  // If root ID specified, start from that bean
  if (rootId) {
    const rootBean = beanMap.get(rootId);
    if (rootBean) {
      return [buildNode(rootBean)];
    }
    // Try short ID match
    for (const bean of beans) {
      if (bean.id.endsWith(rootId) || bean.id === `daedalus-${rootId}`) {
        return [buildNode(bean)];
      }
    }
    return [];
  }

  // Find beans that are not blocked by anything (starting points)
  const blockedIds = new Set<string>();
  for (const bean of beans) {
    for (const blockingId of bean.blockingIds) {
      blockedIds.add(blockingId);
    }
  }

  const roots = beans.filter((b) => !blockedIds.has(b.id) && b.blockingIds.length > 0);
  return roots.map(buildNode);
}

// =============================================================================
// Status Helpers
// =============================================================================

export function getStatusColor(status: string): string {
  switch (status) {
    case 'completed':
      return 'green';
    case 'in-progress':
      return 'yellow';
    case 'todo':
      return 'cyan';
    case 'draft':
      return 'gray';
    case 'scrapped':
      return 'red';
    default:
      return 'white';
  }
}

export function getTypeColor(type: string): string {
  switch (type) {
    case 'milestone':
      return 'magenta';
    case 'epic':
      return 'blue';
    case 'feature':
      return 'green';
    case 'bug':
      return 'red';
    case 'task':
      return 'white';
    default:
      return 'white';
  }
}

/**
 * Check if a bean is ready to execute (todo + not blocked)
 */
export function isReadyToExecute(bean: Bean, allBeans: Bean[]): boolean {
  if (bean.status !== 'todo') return false;
  
  // Check if any active blockers
  const beanMap = new Map(allBeans.map(b => [b.id, b]));
  
  for (const blockerId of bean.blockingIds) {
    const blocker = beanMap.get(blockerId);
    if (blocker && blocker.status !== 'completed' && blocker.status !== 'scrapped') {
      return false;
    }
  }
  
  return true;
}

/**
 * Flatten a tree into an array with depth info (for selection/navigation)
 */
export interface FlatTreeNode {
  node: TreeNode;
  depth: number;
  isLast: boolean;
  prefix: string;
}

export function flattenTree(
  trees: TreeNode[],
  depth: number = 0,
  prefix: string = '',
  parentIsLast: boolean = true
): FlatTreeNode[] {
  const result: FlatTreeNode[] = [];

  trees.forEach((tree, index) => {
    const isLast = index === trees.length - 1;
    const nodePrefix = depth === 0 ? '' : prefix + (isLast ? '└── ' : '├── ');
    const childPrefix = depth === 0 ? '' : prefix + (isLast ? '    ' : '│   ');

    result.push({
      node: tree,
      depth,
      isLast,
      prefix: nodePrefix,
    });

    if (tree.children.length > 0) {
      result.push(...flattenTree(tree.children, depth + 1, childPrefix, isLast));
    }
  });

  return result;
}
