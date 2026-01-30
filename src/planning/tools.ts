/**
 * Planning Agent Tools
 *
 * Tool definitions for the Vercel AI SDK. These tools allow the planning agent
 * to read files, search the codebase, run safe commands, and manage beans.
 */
import { tool, type Tool } from 'ai';
import { z, type ZodTypeAny } from 'zod';
import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, relative } from 'path';
import { execSync } from 'child_process';
import {
  listBeans,
  getBean,
  createBean,
  updateBeanStatus,
  updateBeanBody,
  setParent,
  addBlocking,
  removeBlocking,
  type Bean,
  type BeanStatus,
  type BeanType,
  type BeanPriority,
} from '../talos/beans-client.js';
import { EXPERT_PROMPTS, type ExpertType } from './system-prompts.js';

// =============================================================================
// Read File Tool
// =============================================================================

const readFileInputSchema = z.object({
  path: z
    .string()
    .describe(
      'The path to the file to read, relative to the project root'
    ),
  startLine: z
    .number()
    .optional()
    .describe('Optional start line number (1-indexed)'),
  endLine: z
    .number()
    .optional()
    .describe('Optional end line number (inclusive)'),
});

export const readFileTool = tool({
  description:
    'Read the contents of a file from the codebase. Use this to understand existing code.',
  inputSchema: readFileInputSchema,
  execute: async ({ path, startLine, endLine }: z.infer<typeof readFileInputSchema>) => {
    try {
      const fullPath = join(process.cwd(), path);
      if (!existsSync(fullPath)) {
        return { error: `File not found: ${path}` };
      }

      const content = readFileSync(fullPath, 'utf-8');
      const lines = content.split('\n');

      if (startLine || endLine) {
        const start = (startLine ?? 1) - 1;
        const end = endLine ?? lines.length;
        const selectedLines = lines.slice(start, end);
        return {
          content: selectedLines.join('\n'),
          totalLines: lines.length,
          showingLines: `${start + 1}-${end}`,
        };
      }

      // Truncate very long files
      if (lines.length > 500) {
        return {
          content: lines.slice(0, 500).join('\n'),
          totalLines: lines.length,
          truncated: true,
          message: 'File truncated to first 500 lines. Use startLine/endLine for specific sections.',
        };
      }

      return { content, totalLines: lines.length };
    } catch (error) {
      return {
        error: `Failed to read file: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
});

// =============================================================================
// Glob Tool
// =============================================================================

const globInputSchema = z.object({
  pattern: z
    .string()
    .describe(
      'The glob pattern to match (e.g., "src/**/*.ts", "*.json")'
    ),
  maxResults: z
    .number()
    .optional()
    .default(50)
    .describe('Maximum number of results to return'),
});

export const globTool = tool({
  description:
    'Find files matching a glob pattern. Use this to discover files in the codebase.',
  inputSchema: globInputSchema,
  execute: async ({ pattern, maxResults = 50 }: z.infer<typeof globInputSchema>) => {
    try {
      // Use find command for glob-like matching
      const command = `find . -type f -name "${pattern.replace(/\*\*/g, '*')}" 2>/dev/null | head -${maxResults}`;
      const result = execSync(command, {
        cwd: process.cwd(),
        encoding: 'utf-8',
        timeout: 10000,
      });

      const files = result
        .trim()
        .split('\n')
        .filter(Boolean)
        .map((f) => f.replace(/^\.\//, ''));

      return {
        files,
        count: files.length,
        truncated: files.length >= maxResults,
      };
    } catch (error) {
      return {
        error: `Failed to find files: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
});

// =============================================================================
// Grep Tool
// =============================================================================

const grepInputSchema = z.object({
  pattern: z.string().describe('The regex pattern to search for'),
  filePattern: z
    .string()
    .optional()
    .describe(
      'Optional file pattern to limit search (e.g., "*.ts", "src/**/*.tsx")'
    ),
  maxResults: z
    .number()
    .optional()
    .default(30)
    .describe('Maximum number of results'),
});

export const grepTool = tool({
  description:
    'Search for a pattern in files. Use this to find where things are defined or used.',
  inputSchema: grepInputSchema,
  execute: async ({ pattern, filePattern, maxResults = 30 }: z.infer<typeof grepInputSchema>) => {
    try {
      // Build grep command
      let command = `grep -rn --include="${filePattern ?? '*'}" "${pattern}" . 2>/dev/null | head -${maxResults}`;
      const result = execSync(command, {
        cwd: process.cwd(),
        encoding: 'utf-8',
        timeout: 15000,
      });

      const matches = result
        .trim()
        .split('\n')
        .filter(Boolean)
        .map((line) => {
          const match = line.match(/^\.\/(.+?):(\d+):(.*)$/);
          if (match) {
            return {
              file: match[1],
              line: parseInt(match[2], 10),
              content: match[3].slice(0, 200),
            };
          }
          return { raw: line.slice(0, 200) };
        });

      return {
        matches,
        count: matches.length,
        truncated: matches.length >= maxResults,
      };
    } catch (error) {
      // grep returns exit code 1 when no matches found
      const execError = error as { status?: number };
      if (execError.status === 1) {
        return { matches: [], count: 0 };
      }
      return {
        error: `Search failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
});

// =============================================================================
// Bash Readonly Tool
// =============================================================================

const ALLOWED_COMMANDS = [
  'ls',
  'tree',
  'cat',
  'head',
  'tail',
  'wc',
  'find',
  'git',
  'npm',
  'node',
  'pwd',
  'echo',
  'which',
  'env',
  'printenv',
];

const BLOCKED_COMMANDS = [
  'rm',
  'mv',
  'cp',
  'mkdir',
  'rmdir',
  'touch',
  'chmod',
  'chown',
  'dd',
  'mkfs',
  'kill',
  'pkill',
  'curl',
  'wget',
  'ssh',
  'scp',
  'sudo',
  'su',
];

const bashReadonlyInputSchema = z.object({
  command: z.string().describe('The bash command to run'),
});

export const bashReadonlyTool = tool({
  description:
    'Run a read-only bash command. Use this for commands like ls, git status, tree, etc. Cannot run commands that modify files.',
  inputSchema: bashReadonlyInputSchema,
  execute: async ({ command }: z.infer<typeof bashReadonlyInputSchema>) => {
    // Check for blocked commands
    const firstWord = command.trim().split(/\s+/)[0];
    if (BLOCKED_COMMANDS.includes(firstWord)) {
      return {
        error: `Command '${firstWord}' is not allowed. This tool only runs read-only commands.`,
      };
    }

    // Check for dangerous patterns
    if (
      command.includes('>') ||
      command.includes('>>') ||
      command.includes('|') && command.includes('tee')
    ) {
      return {
        error: 'Write operations are not allowed.',
      };
    }

    try {
      const result = execSync(command, {
        cwd: process.cwd(),
        encoding: 'utf-8',
        timeout: 30000,
        maxBuffer: 1024 * 1024, // 1MB
      });

      // Truncate long output
      const lines = result.split('\n');
      if (lines.length > 200) {
        return {
          output: lines.slice(0, 200).join('\n'),
          truncated: true,
          totalLines: lines.length,
        };
      }

      return { output: result };
    } catch (error) {
      return {
        error: `Command failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
});

// =============================================================================
// Web Search Tool (Placeholder)
// =============================================================================

const webSearchInputSchema = z.object({
  query: z.string().describe('The search query'),
});

export const webSearchTool = tool({
  description:
    'Search the web for solutions, patterns, and best practices. (Note: This is a placeholder - implement with actual web search API)',
  inputSchema: webSearchInputSchema,
  execute: async ({ query }: z.infer<typeof webSearchInputSchema>) => {
    // This is a placeholder - in a real implementation, you would integrate
    // with a web search API like Serper, Tavily, or Brave Search
    return {
      message: `Web search for "${query}" would return results here.`,
      suggestion:
        'Implement web search with Serper, Tavily, or Brave Search API.',
    };
  },
});

// =============================================================================
// Beans CLI Tool
// =============================================================================

const beansCliInputSchema = z.object({
  action: z
    .enum(['create', 'update', 'set_parent', 'add_blocking', 'remove_blocking', 'query', 'get'])
    .describe('The action to perform'),
  // Create parameters
  title: z.string().optional().describe('Bean title (for create)'),
  type: z
    .enum(['milestone', 'epic', 'feature', 'bug', 'task'])
    .optional()
    .describe('Bean type (for create)'),
  status: z
    .enum(['draft', 'todo', 'in-progress', 'completed', 'scrapped'])
    .optional()
    .describe('Bean status'),
  priority: z
    .enum(['critical', 'high', 'normal', 'low', 'deferred'])
    .optional()
    .describe('Bean priority'),
  body: z.string().optional().describe('Bean body/description'),
  parent: z.string().optional().describe('Parent bean ID (for create)'),
  blocking: z
    .array(z.string())
    .optional()
    .describe('Array of bean IDs this bean is blocking (for create)'),
  // Update/Get/Relationship parameters
  id: z.string().optional().describe('Bean ID (for update/get/relationship actions)'),
  // Relationship parameters
  parentId: z
    .string()
    .nullable()
    .optional()
    .describe('Parent bean ID for set_parent (null to remove parent)'),
  targetId: z
    .string()
    .optional()
    .describe('Target bean ID for add_blocking/remove_blocking'),
  // Query parameters
  filter: z
    .object({
      status: z.array(z.string()).optional(),
      type: z.array(z.string()).optional(),
      search: z.string().optional(),
    })
    .optional()
    .describe('Filter for query'),
});

export const beansCliTool = tool({
  description: `Manage beans (issues/tasks). Use this to create, update, query, and manage relationships between beans.

## Actions

- **create**: Create a new bean with title, type, status, priority, body, parent, and blocking relationships
- **update**: Update bean status or body
- **set_parent**: Set or clear a bean's parent (for hierarchy: milestone > epic > feature > task/bug)
- **add_blocking**: Add a blocking relationship (this bean blocks another)
- **remove_blocking**: Remove a blocking relationship
- **get**: Get a single bean by ID
- **query**: Query beans with filters

## Planning Workflow Examples

### Creating a feature with sub-tasks:
1. Create the feature: { action: "create", title: "Add user auth", type: "feature", status: "draft" }
2. Create sub-tasks with parent: { action: "create", title: "Implement login", type: "task", parent: "<feature-id>" }

### Creating beans with dependencies:
- Create a bean that blocks another: { action: "create", title: "Setup DB", type: "task", blocking: ["<dependent-bean-id>"] }
- Add blocking after creation: { action: "add_blocking", id: "<blocker-id>", targetId: "<blocked-id>" }

### Organizing work hierarchy:
- Set parent: { action: "set_parent", id: "<task-id>", parentId: "<epic-id>" }
- Remove parent: { action: "set_parent", id: "<task-id>", parentId: null }`,
  inputSchema: beansCliInputSchema,
  execute: async ({
    action,
    title,
    type,
    status,
    priority,
    body,
    parent,
    blocking,
    id,
    parentId,
    targetId,
    filter,
  }: z.infer<typeof beansCliInputSchema>) => {
    try {
      switch (action) {
        case 'create': {
          if (!title) {
            return { error: 'Title is required for creating a bean' };
          }
          const bean = await createBean({
            title,
            type: type as BeanType | undefined,
            status: (status as BeanStatus | undefined) ?? 'draft',
            priority: priority as BeanPriority | undefined,
            body,
            parent,
            blocking,
          });
          return {
            success: true,
            bean: {
              id: bean.id,
              title: bean.title,
              status: bean.status,
              type: bean.type,
              parentId: bean.parentId,
              blockingIds: bean.blockingIds,
            },
          };
        }

        case 'update': {
          if (!id) {
            return { error: 'Bean ID is required for update' };
          }
          let bean: Bean;
          if (status) {
            bean = await updateBeanStatus(id, status as BeanStatus);
          } else if (body) {
            bean = await updateBeanBody(id, body);
          } else {
            return { error: 'Provide status or body to update' };
          }
          return {
            success: true,
            bean: {
              id: bean.id,
              title: bean.title,
              status: bean.status,
            },
          };
        }

        case 'set_parent': {
          if (!id) {
            return { error: 'Bean ID is required for set_parent' };
          }
          // parentId can be null (to remove parent) or a string
          const bean = await setParent(id, parentId ?? null);
          return {
            success: true,
            bean: {
              id: bean.id,
              title: bean.title,
              parentId: bean.parentId,
            },
          };
        }

        case 'add_blocking': {
          if (!id) {
            return { error: 'Bean ID is required for add_blocking' };
          }
          if (!targetId) {
            return { error: 'Target bean ID is required for add_blocking' };
          }
          const bean = await addBlocking(id, targetId);
          return {
            success: true,
            bean: {
              id: bean.id,
              title: bean.title,
              blockingIds: bean.blockingIds,
            },
          };
        }

        case 'remove_blocking': {
          if (!id) {
            return { error: 'Bean ID is required for remove_blocking' };
          }
          if (!targetId) {
            return { error: 'Target bean ID is required for remove_blocking' };
          }
          const bean = await removeBlocking(id, targetId);
          return {
            success: true,
            bean: {
              id: bean.id,
              title: bean.title,
              blockingIds: bean.blockingIds,
            },
          };
        }

        case 'get': {
          if (!id) {
            return { error: 'Bean ID is required' };
          }
          const bean = await getBean(id);
          if (!bean) {
            return { error: `Bean not found: ${id}` };
          }
          return { bean };
        }

        case 'query': {
          const beans = await listBeans({
            status: filter?.status as BeanStatus[] | undefined,
            type: filter?.type as BeanType[] | undefined,
            search: filter?.search,
          });
          return {
            beans: beans.slice(0, 20).map((b) => ({
              id: b.id,
              title: b.title,
              status: b.status,
              type: b.type,
              priority: b.priority,
            })),
            total: beans.length,
            truncated: beans.length > 20,
          };
        }

        default:
          return { error: `Unknown action: ${action}` };
      }
    } catch (error) {
      return {
        error: `Beans operation failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
});

// =============================================================================
// Expert Consultation Tool
// =============================================================================

const consultExpertsInputSchema = z.object({
  context: z
    .string()
    .describe('The plan, approach, or content to get feedback on'),
  question: z
    .string()
    .optional()
    .describe('Optional specific question to ask the experts'),
  experts: z
    .array(
      z.enum([
        'pragmatist',
        'architect',
        'skeptic',
        'simplifier',
        'security',
        'researcher',
        'codebase-explorer',
        'ux-reviewer',
        'critic',
      ])
    )
    .describe('Which experts to consult'),
});

/**
 * Consult expert advisors by loading their full persona prompts.
 * The planning agent reads these prompts and role-plays each expert's perspective
 * in its response, rather than spawning separate LLM calls.
 */
export const consultExpertsTool = tool({
  description:
    'Consult expert advisors for feedback on a plan or approach. Returns the full persona prompt for each requested expert so you can respond from their perspective.',
  inputSchema: consultExpertsInputSchema,
  execute: async ({ context, question, experts }: z.infer<typeof consultExpertsInputSchema>) => {
    const found: { expert: string; prompt: string }[] = [];
    const notFound: string[] = [];

    for (const expert of experts) {
      const prompt = EXPERT_PROMPTS[expert as ExpertType];
      if (prompt) {
        found.push({ expert, prompt });
      } else {
        notFound.push(expert);
      }
    }

    const instruction = question
      ? `Review the following context from each expert's perspective and address this question: "${question}"\n\nContext:\n${context}`
      : `Review the following context from each expert's perspective and provide feedback.\n\nContext:\n${context}`;

    return {
      instruction,
      experts: found,
      ...(notFound.length > 0 ? { notFound } : {}),
    };
  },
});

// =============================================================================
// Tool Registry
// =============================================================================

export const PLANNING_TOOLS = {
  read_file: readFileTool,
  glob: globTool,
  grep: grepTool,
  bash_readonly: bashReadonlyTool,
  web_search: webSearchTool,
  beans_cli: beansCliTool,
  consult_experts: consultExpertsTool,
};

export type PlanningToolName = keyof typeof PLANNING_TOOLS;

/**
 * Get tools based on enabled tools from config.
 */
export function getEnabledTools(
  enabledToolNames: string[]
): typeof PLANNING_TOOLS {
  const tools: Partial<typeof PLANNING_TOOLS> = {};
  for (const name of enabledToolNames) {
    if (name in PLANNING_TOOLS) {
      const toolName = name as PlanningToolName;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (tools as any)[toolName] = PLANNING_TOOLS[toolName];
    }
  }
  return tools as typeof PLANNING_TOOLS;
}
