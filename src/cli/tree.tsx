/**
 * Tree Command
 *
 * Displays the bean dependency tree in the terminal using Unicode box-drawing characters.
 * Supports both parent/child hierarchies and blocking relationships.
 */
import React, { useState, useEffect } from 'react';
import { Box, Text, useApp } from 'ink';
import { spawn } from 'child_process';

// =============================================================================
// Types
// =============================================================================

interface Bean {
  id: string;
  title: string;
  status: string;
  type: string;
  priority: string;
  parentId: string | null;
  blockingIds: string[];
}

interface TreeNode {
  bean: Bean;
  children: TreeNode[];
}

export interface TreeCommandProps {
  /** Root bean ID to start the tree from (optional) */
  rootId?: string;
  /** Show blocking relationships instead of parent/child */
  blocking?: boolean;
  /** Filter by status (comma-separated) */
  status?: string;
  /** Exclude by status (comma-separated) */
  excludeStatus?: string;
  /** Compact mode - one line per bean without status */
  compact?: boolean;
}

// =============================================================================
// GraphQL Query Helper
// =============================================================================

async function queryBeans(query: string): Promise<{ beans: Bean[] }> {
  return new Promise((resolve, reject) => {
    const child = spawn('beans', ['query', '--json'], {
      cwd: process.cwd(),
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`beans query failed: ${stderr}`));
        return;
      }
      try {
        resolve(JSON.parse(stdout));
      } catch (e) {
        reject(new Error(`Failed to parse beans response: ${e}`));
      }
    });

    child.on('error', (err) => {
      reject(new Error(`Failed to spawn beans: ${err.message}`));
    });

    child.stdin.write(query);
    child.stdin.end();
  });
}

// =============================================================================
// Tree Building Logic
// =============================================================================

/**
 * Build a tree from parent/child relationships
 */
function buildParentChildTree(beans: Bean[], rootId?: string): TreeNode[] {
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
function buildBlockingTree(beans: Bean[], rootId?: string): TreeNode[] {
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

function getStatusColor(status: string): string {
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

function getTypeColor(type: string): string {
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

// =============================================================================
// Tree Rendering Components
// =============================================================================

interface TreeLineProps {
  node: TreeNode;
  prefix: string;
  isLast: boolean;
  compact: boolean;
  isBlocking: boolean;
}

function TreeLine({ node, prefix, isLast, compact, isBlocking }: TreeLineProps) {
  const { bean, children } = node;

  // Box-drawing characters
  const branch = isLast ? '└── ' : '├── ';
  const childPrefix = prefix + (isLast ? '    ' : '│   ');

  // Build the display line
  const statusColor = getStatusColor(bean.status);
  const typeColor = getTypeColor(bean.type);

  return (
    <Box flexDirection="column">
      <Text>
        <Text color="gray">{prefix}{branch}</Text>
        <Text color="gray">{bean.id}</Text>
        <Text>: </Text>
        <Text>{bean.title}</Text>
        {!compact && (
          <>
            <Text> </Text>
            <Text color={typeColor}>({bean.type})</Text>
            <Text> </Text>
            <Text color={statusColor}>[{bean.status}]</Text>
          </>
        )}
        {isBlocking && children.length > 0 && (
          <Text color="yellow"> → blocks {children.length}</Text>
        )}
      </Text>
      {children.map((child, index) => (
        <TreeLine
          key={child.bean.id}
          node={child}
          prefix={childPrefix}
          isLast={index === children.length - 1}
          compact={compact}
          isBlocking={isBlocking}
        />
      ))}
    </Box>
  );
}

interface RootNodeProps {
  node: TreeNode;
  compact: boolean;
  isBlocking: boolean;
}

function RootNode({ node, compact, isBlocking }: RootNodeProps) {
  const { bean, children } = node;
  const statusColor = getStatusColor(bean.status);
  const typeColor = getTypeColor(bean.type);

  return (
    <Box flexDirection="column">
      <Text>
        <Text color="gray">{bean.id}</Text>
        <Text>: </Text>
        <Text bold>{bean.title}</Text>
        {!compact && (
          <>
            <Text> </Text>
            <Text color={typeColor}>({bean.type})</Text>
            <Text> </Text>
            <Text color={statusColor}>[{bean.status}]</Text>
          </>
        )}
        {isBlocking && children.length > 0 && (
          <Text color="yellow"> → blocks {children.length}</Text>
        )}
      </Text>
      {children.map((child, index) => (
        <TreeLine
          key={child.bean.id}
          node={child}
          prefix=""
          isLast={index === children.length - 1}
          compact={compact}
          isBlocking={isBlocking}
        />
      ))}
    </Box>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function TreeCommand({
  rootId,
  blocking = false,
  status,
  excludeStatus,
  compact = false,
}: TreeCommandProps) {
  const { exit } = useApp();
  const [trees, setTrees] = useState<TreeNode[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadTree() {
      try {
        // Build filter for the query
        const filterParts: string[] = [];
        
        if (status) {
          const statuses = status.split(',').map((s) => `"${s.trim()}"`).join(', ');
          filterParts.push(`status: [${statuses}]`);
        }
        
        if (excludeStatus) {
          const statuses = excludeStatus.split(',').map((s) => `"${s.trim()}"`).join(', ');
          filterParts.push(`excludeStatus: [${statuses}]`);
        }

        const filterArg = filterParts.length > 0 
          ? `(filter: { ${filterParts.join(', ')} })` 
          : '';

        const query = `{
          beans${filterArg} {
            id
            title
            status
            type
            priority
            parentId
            blockingIds
          }
        }`;

        const result = await queryBeans(query);
        const beans = result.beans || [];

        if (beans.length === 0) {
          setTrees([]);
          setLoading(false);
          return;
        }

        // Build the tree based on mode
        const tree = blocking
          ? buildBlockingTree(beans, rootId)
          : buildParentChildTree(beans, rootId);

        setTrees(tree);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load beans');
      } finally {
        setLoading(false);
      }
    }

    loadTree();
  }, [rootId, blocking, status, excludeStatus]);

  useEffect(() => {
    // Exit after rendering
    if (!loading) {
      const timer = setTimeout(() => exit(), 100);
      return () => clearTimeout(timer);
    }
  }, [loading, exit]);

  if (loading) {
    return <Text color="yellow">Loading bean tree...</Text>;
  }

  if (error) {
    return <Text color="red">Error: {error}</Text>;
  }

  if (trees.length === 0) {
    if (rootId) {
      return <Text color="red">Bean not found: {rootId}</Text>;
    }
    return <Text color="gray">No beans found</Text>;
  }

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold color="cyan">
          {blocking ? 'Blocking Dependencies' : 'Bean Hierarchy'}
        </Text>
        {status && <Text color="gray"> (status: {status})</Text>}
        {excludeStatus && <Text color="gray"> (exclude: {excludeStatus})</Text>}
      </Box>
      {trees.map((tree, index) => (
        <Box key={tree.bean.id} marginBottom={index < trees.length - 1 ? 1 : 0}>
          <RootNode node={tree} compact={compact} isBlocking={blocking} />
        </Box>
      ))}
    </Box>
  );
}

export default TreeCommand;
