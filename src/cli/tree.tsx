/**
 * Tree Command
 *
 * Displays the bean dependency tree in the terminal.
 */
import React, { useState, useEffect } from 'react';
import { Box, Text, useApp } from 'ink';
import { execSync } from 'child_process';

interface Bean {
  id: string;
  title: string;
  status: string;
  type: string;
  children?: Bean[];
}

export function TreeCommand() {
  const { exit } = useApp();
  const [beans, setBeans] = useState<Bean[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      // Query beans via CLI
      const result = execSync(
        'beans query \'{ beans { id title status type } }\' --json',
        { encoding: 'utf-8' }
      );
      const data = JSON.parse(result);
      setBeans(data.beans || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to query beans');
    } finally {
      setLoading(false);
    }

    // Exit after rendering
    const timer = setTimeout(() => exit(), 100);
    return () => clearTimeout(timer);
  }, [exit]);

  if (loading) {
    return <Text color="yellow">Loading beans...</Text>;
  }

  if (error) {
    return <Text color="red">Error: {error}</Text>;
  }

  if (beans.length === 0) {
    return <Text color="gray">No beans found</Text>;
  }

  return (
    <Box flexDirection="column">
      <Text bold color="cyan">
        Bean Tree
      </Text>
      <Box marginTop={1} flexDirection="column">
        {beans.map((bean) => (
          <BeanNode key={bean.id} bean={bean} depth={0} />
        ))}
      </Box>
    </Box>
  );
}

interface BeanNodeProps {
  bean: Bean;
  depth: number;
}

function BeanNode({ bean, depth }: BeanNodeProps) {
  const indent = '  '.repeat(depth);
  const statusColor = getStatusColor(bean.status);

  return (
    <Box flexDirection="column">
      <Text>
        {indent}
        <Text color={statusColor}>{getStatusIcon(bean.status)}</Text>
        <Text> </Text>
        <Text color="gray">{bean.id.slice(-4)}</Text>
        <Text> </Text>
        <Text>{bean.title}</Text>
      </Text>
      {bean.children?.map((child) => (
        <BeanNode key={child.id} bean={child} depth={depth + 1} />
      ))}
    </Box>
  );
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'completed':
      return 'green';
    case 'in-progress':
      return 'yellow';
    case 'todo':
      return 'blue';
    case 'draft':
      return 'gray';
    case 'scrapped':
      return 'red';
    default:
      return 'white';
  }
}

function getStatusIcon(status: string): string {
  switch (status) {
    case 'completed':
      return '[x]';
    case 'in-progress':
      return '[~]';
    case 'todo':
      return '[ ]';
    case 'draft':
      return '[?]';
    case 'scrapped':
      return '[-]';
    default:
      return '[ ]';
  }
}

export default TreeCommand;
