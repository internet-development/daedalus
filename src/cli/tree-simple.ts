/**
 * Tree Command
 *
 * Displays beans in a hierarchical tree view using GraphQL to query
 * parent/child relationships.
 */
import { spawn } from 'child_process';

// =============================================================================
// Types
// =============================================================================

export interface TreeOptions {
  args: string[];
  /** Working directory for beans CLI (defaults to process.cwd()) */
  cwd?: string;
}

interface Bean {
  id: string;
  title: string;
  status: string;
  type: string;
  parentId: string | null;
}

// =============================================================================
// GraphQL Query
// =============================================================================

async function queryBeans(cwd?: string): Promise<Bean[]> {
  return new Promise((resolve, reject) => {
    const query = `{
      beans(filter: { excludeStatus: ["completed", "scrapped"] }) {
        id title status type parentId
      }
    }`;

    const child = spawn('beans', ['graphql', '--json', query], {
      cwd: cwd ?? process.cwd(),
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('error', reject);

    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(stderr || `beans graphql exited with code ${code}`));
        return;
      }

      try {
        const result = JSON.parse(stdout);
        resolve(result.beans || []);
      } catch {
        reject(new Error(`Failed to parse GraphQL response: ${stdout}`));
      }
    });
  });
}

// =============================================================================
// Tree Rendering
// =============================================================================

const STATUS_COLORS: Record<string, string> = {
  'in-progress': '\x1b[33m', // yellow
  todo: '\x1b[36m', // cyan
  draft: '\x1b[90m', // gray
};

const RESET = '\x1b[0m';
const DIM = '\x1b[2m';

function buildTree(
  beans: Bean[],
  parentId: string | null = null
): Array<{ bean: Bean; children: Array<{ bean: Bean; children: unknown[] }> }> {
  return beans
    .filter((b) => b.parentId === parentId)
    .map((bean) => ({
      bean,
      children: buildTree(beans, bean.id),
    }));
}

function renderTree(
  nodes: Array<{ bean: Bean; children: unknown[] }>,
  indent = ''
): void {
  for (let i = 0; i < nodes.length; i++) {
    const { bean, children } = nodes[i] as {
      bean: Bean;
      children: Array<{ bean: Bean; children: unknown[] }>;
    };
    const isLast = i === nodes.length - 1;
    const connector = isLast ? '└── ' : '├── ';
    const statusColor = STATUS_COLORS[bean.status] || '';
    const typeTag = `${DIM}[${bean.type}]${RESET}`;

    console.log(
      `${indent}${connector}${statusColor}${bean.id}${RESET} ${bean.title} ${typeTag}`
    );

    if (children.length > 0) {
      const childIndent = indent + (isLast ? '    ' : '│   ');
      renderTree(children, childIndent);
    }
  }
}

// =============================================================================
// Main Function
// =============================================================================

export async function runTree(options: TreeOptions): Promise<void> {
  // Check for help flag
  if (options.args.includes('--help') || options.args.includes('-h')) {
    console.log(`
Usage: daedalus tree [options]

Display beans in a hierarchical tree view.

Options:
  --help, -h     Show this help message

Note: This shows active beans (excludes completed/scrapped).
      For more options, use 'beans list'.
`);
    return;
  }

  try {
    const beans = await queryBeans(options.cwd);

    if (beans.length === 0) {
      console.log('No active beans found.');
      return;
    }

    const tree = buildTree(beans);
    console.log();
    renderTree(tree);
    console.log();
  } catch (err) {
    if (err instanceof Error && err.message.includes('ENOENT')) {
      console.error('Error: beans CLI not found. Please install beans first.');
      console.error('See: https://github.com/anomalyco/beans');
    } else {
      console.error(`Error: ${err instanceof Error ? err.message : err}`);
    }
    process.exit(1);
  }
}
