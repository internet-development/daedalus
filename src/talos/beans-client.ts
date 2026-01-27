/**
 * Beans Client
 *
 * Typed wrapper for the beans CLI with standalone functions.
 * All beans interaction is done via `beans query --json` for machine-readable output.
 */
import { execSync, spawn } from 'child_process';

// =============================================================================
// Types
// =============================================================================

/** Bean statuses (actual beans tracker values - NO 'blocked' status!) */
export type BeanStatus = 'draft' | 'todo' | 'in-progress' | 'completed' | 'scrapped';

/** Bean types */
export type BeanType = 'milestone' | 'epic' | 'feature' | 'bug' | 'task';

/** Bean priorities */
export type BeanPriority = 'critical' | 'high' | 'normal' | 'low' | 'deferred';

/**
 * Special tags used by Talos (not status, but tags!)
 * - 'blocked': agent hit an issue it can't resolve
 * - 'failed': agent crashed or errored unexpectedly
 */
export type TalosTag = 'blocked' | 'failed';

/** Core bean interface */
export interface Bean {
  id: string;
  slug: string;
  title: string;
  status: BeanStatus;
  type: BeanType;
  priority: BeanPriority;
  tags: string[];
  body: string;
  parentId?: string;
  blockingIds: string[];
  createdAt: string;
  updatedAt: string;
}

/** Filter for queries */
export interface BeanFilter {
  status?: BeanStatus[];
  excludeStatus?: BeanStatus[];
  type?: BeanType[];
  excludeType?: BeanType[];
  priority?: BeanPriority[];
  excludePriority?: BeanPriority[];
  tags?: string[];
  excludeTags?: string[];
  parentId?: string;
  isBlocked?: boolean;
  noParent?: boolean;
  search?: string;
}

/** Input for creating beans */
export interface CreateBeanInput {
  title: string;
  type?: BeanType;
  status?: BeanStatus;
  priority?: BeanPriority;
  tags?: string[];
  body?: string;
  parent?: string;
  blocking?: string[];
}

// =============================================================================
// Error Class
// =============================================================================

/** Error thrown for actual CLI failures (not "not found" cases) */
export class BeansCliError extends Error {
  constructor(
    message: string,
    public readonly command: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'BeansCliError';
  }
}

// =============================================================================
// Internal Helpers
// =============================================================================

/** Working directory for CLI commands */
let cwd: string = process.cwd();

/** Set the working directory for beans CLI commands */
export function setCwd(dir: string): void {
  cwd = dir;
}

/** Get the current working directory */
export function getCwd(): string {
  return cwd;
}

/**
 * Execute a beans CLI command and return stdout
 * @throws BeansCliError on failure
 */
async function execBeans(args: string[]): Promise<string> {
  const command = `beans ${args.join(' ')}`;
  try {
    const result = execSync(command, {
      cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return result;
  } catch (error: unknown) {
    const err = error as { message?: string; stderr?: string };
    throw new BeansCliError(
      `Beans CLI command failed: ${err.message ?? 'Unknown error'}`,
      command,
      error
    );
  }
}

/**
 * Execute a GraphQL query and parse the JSON response
 * @throws BeansCliError on failure or parse error
 */
async function execBeansQuery<T>(query: string): Promise<T> {
  const command = `beans query --json`;
  try {
    // Use spawn to avoid shell escaping issues with complex queries
    return await new Promise<T>((resolve, reject) => {
      const child = spawn('beans', ['query', '--json'], {
        cwd,
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
          reject(
            new BeansCliError(
              `Beans query failed (exit code ${code}): ${stderr}`,
              command,
              { stdout, stderr, code }
            )
          );
          return;
        }

        try {
          const result = JSON.parse(stdout) as T;
          resolve(result);
        } catch (parseError) {
          reject(
            new BeansCliError(
              `Failed to parse beans query response: ${parseError}`,
              command,
              { stdout, parseError }
            )
          );
        }
      });

      child.on('error', (error) => {
        reject(
          new BeansCliError(
            `Failed to spawn beans CLI: ${error.message}`,
            command,
            error
          )
        );
      });

      // Write query to stdin and close
      child.stdin.write(query);
      child.stdin.end();
    });
  } catch (error) {
    if (error instanceof BeansCliError) {
      throw error;
    }
    throw new BeansCliError(
      `Beans query failed: ${error}`,
      command,
      error
    );
  }
}

/**
 * Build a GraphQL filter string from a BeanFilter object
 */
function buildFilterArg(filter?: BeanFilter): string {
  if (!filter) return '';

  const parts: string[] = [];

  if (filter.status?.length) {
    parts.push(`status: [${filter.status.map((s) => `"${s}"`).join(', ')}]`);
  }
  if (filter.excludeStatus?.length) {
    parts.push(`excludeStatus: [${filter.excludeStatus.map((s) => `"${s}"`).join(', ')}]`);
  }
  if (filter.type?.length) {
    parts.push(`type: [${filter.type.map((t) => `"${t}"`).join(', ')}]`);
  }
  if (filter.excludeType?.length) {
    parts.push(`excludeType: [${filter.excludeType.map((t) => `"${t}"`).join(', ')}]`);
  }
  if (filter.priority?.length) {
    parts.push(`priority: [${filter.priority.map((p) => `"${p}"`).join(', ')}]`);
  }
  if (filter.excludePriority?.length) {
    parts.push(`excludePriority: [${filter.excludePriority.map((p) => `"${p}"`).join(', ')}]`);
  }
  if (filter.tags?.length) {
    parts.push(`tags: [${filter.tags.map((t) => `"${t}"`).join(', ')}]`);
  }
  if (filter.excludeTags?.length) {
    parts.push(`excludeTags: [${filter.excludeTags.map((t) => `"${t}"`).join(', ')}]`);
  }
  if (filter.parentId) {
    parts.push(`parentId: "${filter.parentId}"`);
  }
  if (filter.isBlocked !== undefined) {
    parts.push(`isBlocked: ${filter.isBlocked}`);
  }
  if (filter.noParent !== undefined) {
    parts.push(`noParent: ${filter.noParent}`);
  }
  if (filter.search) {
    parts.push(`search: "${filter.search}"`);
  }

  return parts.length > 0 ? `(filter: { ${parts.join(', ')} })` : '';
}

/** Standard fields to fetch for a bean */
const BEAN_FIELDS = `
  id
  slug
  title
  status
  type
  priority
  tags
  body
  parentId
  blockingIds
  createdAt
  updatedAt
`;

// =============================================================================
// Public Functions
// =============================================================================

/**
 * List beans with optional filtering
 * @returns Empty array if no matches
 */
export async function listBeans(filter?: BeanFilter): Promise<Bean[]> {
  const filterArg = buildFilterArg(filter);
  const query = `{ beans${filterArg} { ${BEAN_FIELDS} } }`;
  const result = await execBeansQuery<{ beans: Bean[] }>(query);
  return result.beans ?? [];
}

/**
 * Get a single bean by ID
 * @returns null if bean not found
 */
export async function getBean(id: string): Promise<Bean | null> {
  const query = `{ bean(id: "${id}") { ${BEAN_FIELDS} } }`;
  const result = await execBeansQuery<{ bean: Bean | null }>(query);
  return result.bean;
}

/**
 * Get beans that are blocking the given bean
 * Only returns beans that are not yet completed (actual blockers)
 */
export async function getBlockedBy(id: string): Promise<Bean[]> {
  const query = `{
    bean(id: "${id}") {
      blockedBy(filter: { excludeStatus: ["completed", "scrapped"] }) {
        ${BEAN_FIELDS}
      }
    }
  }`;
  const result = await execBeansQuery<{ bean: { blockedBy: Bean[] } | null }>(query);
  return result.bean?.blockedBy ?? [];
}

/**
 * Update a bean's status
 * @throws BeansCliError if bean not found or update fails
 */
export async function updateBeanStatus(id: string, status: BeanStatus): Promise<Bean> {
  const query = `mutation {
    updateBean(id: "${id}", input: { status: "${status}" }) {
      ${BEAN_FIELDS}
    }
  }`;
  const result = await execBeansQuery<{ updateBean: Bean }>(query);
  return result.updateBean;
}

/**
 * Update a bean's body content (for checklist updates)
 * Uses stdin to avoid shell escaping issues
 */
export async function updateBeanBody(id: string, body: string): Promise<Bean> {
  return new Promise<Bean>((resolve, reject) => {
    const child = spawn('beans', ['update', id, '--body', '-', '--json'], {
      cwd,
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
        reject(
          new BeansCliError(
            `Failed to update bean body (exit code ${code}): ${stderr}`,
            `beans update ${id} --body -`,
            { stdout, stderr, code }
          )
        );
        return;
      }

      try {
        const result = JSON.parse(stdout) as Bean;
        resolve(result);
      } catch {
        // If --json isn't supported on update, fetch the bean
        getBean(id).then((bean) => {
          if (bean) {
            resolve(bean);
          } else {
            reject(
              new BeansCliError(
                `Bean not found after update: ${id}`,
                `beans update ${id} --body -`,
                { stdout, stderr }
              )
            );
          }
        }).catch(reject);
      }
    });

    child.on('error', (error) => {
      reject(
        new BeansCliError(
          `Failed to spawn beans CLI: ${error.message}`,
          `beans update ${id} --body -`,
          error
        )
      );
    });

    child.stdin.write(body);
    child.stdin.end();
  });
}

/**
 * Update a bean's tags (add and/or remove)
 */
export async function updateBeanTags(
  id: string,
  add?: string[],
  remove?: string[]
): Promise<Bean> {
  const args = ['update', id];

  if (add?.length) {
    for (const tag of add) {
      args.push('--tag', tag);
    }
  }

  if (remove?.length) {
    for (const tag of remove) {
      args.push('--remove-tag', tag);
    }
  }

  await execBeans(args);
  
  // Fetch and return the updated bean
  const bean = await getBean(id);
  if (!bean) {
    throw new BeansCliError(
      `Bean not found after tag update: ${id}`,
      `beans ${args.join(' ')}`,
      null
    );
  }
  return bean;
}

/**
 * Create a new bean
 */
export async function createBean(input: CreateBeanInput): Promise<Bean> {
  const args = ['create', input.title];

  if (input.type) {
    args.push('-t', input.type);
  }
  if (input.status) {
    args.push('-s', input.status);
  }
  if (input.priority) {
    args.push('-p', input.priority);
  }
  if (input.tags?.length) {
    for (const tag of input.tags) {
      args.push('--tag', tag);
    }
  }
  if (input.parent) {
    args.push('--parent', input.parent);
  }
  if (input.blocking?.length) {
    for (const blockingId of input.blocking) {
      args.push('--blocking', blockingId);
    }
  }

  // Handle body via stdin if provided
  if (input.body) {
    return new Promise<Bean>((resolve, reject) => {
      args.push('-d', '-'); // Read description from stdin
      args.push('--json');

      const child = spawn('beans', args, {
        cwd,
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
          reject(
            new BeansCliError(
              `Failed to create bean (exit code ${code}): ${stderr}`,
              `beans ${args.join(' ')}`,
              { stdout, stderr, code }
            )
          );
          return;
        }

        try {
          const result = JSON.parse(stdout) as Bean;
          resolve(result);
        } catch {
          // If --json output isn't available, we need to find the created bean
          // This is a fallback - ideally beans create would support --json
          reject(
            new BeansCliError(
              `Failed to parse created bean: ${stdout}`,
              `beans ${args.join(' ')}`,
              { stdout, stderr }
            )
          );
        }
      });

      child.on('error', (error) => {
        reject(
          new BeansCliError(
            `Failed to spawn beans CLI: ${error.message}`,
            `beans ${args.join(' ')}`,
            error
          )
        );
      });

      child.stdin.write(input.body);
      child.stdin.end();
    });
  }

  // No body - use simple exec
  args.push('--json');
  const output = await execBeans(args);
  
  try {
    return JSON.parse(output) as Bean;
  } catch {
    throw new BeansCliError(
      `Failed to parse created bean response`,
      `beans ${args.join(' ')}`,
      { output }
    );
  }
}

/**
 * Check if a bean is stuck (has blocked or failed tag)
 */
export function isStuck(bean: Bean): boolean {
  return bean.tags.includes('blocked') || bean.tags.includes('failed');
}

/**
 * Walk up the parent chain to find the epic ancestor
 * @returns The epic bean if found, null otherwise
 */
export async function getEpicAncestor(beanId: string): Promise<Bean | null> {
  let currentId: string | undefined = beanId;

  while (currentId) {
    const bean = await getBean(currentId);
    if (!bean) {
      return null;
    }

    if (bean.type === 'epic') {
      return bean;
    }

    currentId = bean.parentId;
  }

  return null;
}

/** Extended bean with children for review mode */
export interface BeanWithChildren extends Bean {
  children: Bean[];
}

/**
 * Get a bean with its children
 * @returns The bean with children array, or null if not found
 */
export async function getBeanWithChildren(id: string): Promise<BeanWithChildren | null> {
  const query = `{
    bean(id: "${id}") {
      ${BEAN_FIELDS}
      children {
        ${BEAN_FIELDS}
      }
    }
  }`;
  const result = await execBeansQuery<{ bean: BeanWithChildren | null }>(query);
  return result.bean;
}

/**
 * Get incomplete children of a bean
 * @returns Array of children that are not completed/scrapped
 */
export async function getIncompleteChildren(id: string): Promise<Bean[]> {
  const query = `{
    bean(id: "${id}") {
      children(filter: { excludeStatus: ["completed", "scrapped"] }) {
        ${BEAN_FIELDS}
      }
    }
  }`;
  const result = await execBeansQuery<{ bean: { children: Bean[] } | null }>(query);
  return result.bean?.children ?? [];
}

/**
 * Add a blocking relationship: child blocks parent
 * @param childId The child bean that is blocking
 * @param parentId The parent bean that is being blocked
 * @deprecated Use addBlocking instead
 */
export async function addBlockingRelationship(childId: string, parentId: string): Promise<void> {
  const args = ['update', childId, '--blocking', parentId];
  await execBeans(args);
}

/**
 * Set or clear the parent of a bean
 * @param id The bean to update
 * @param parentId The new parent ID, or null to remove parent
 * @returns The updated bean
 */
export async function setParent(id: string, parentId: string | null): Promise<Bean> {
  const query = `mutation {
    setParent(id: "${id}", parentId: ${parentId ? `"${parentId}"` : 'null'}) {
      ${BEAN_FIELDS}
    }
  }`;
  const result = await execBeansQuery<{ setParent: Bean }>(query);
  return result.setParent;
}

/**
 * Add a blocking relationship
 * @param id The bean that will be blocking another
 * @param targetId The bean that will be blocked
 * @returns The updated bean
 */
export async function addBlocking(id: string, targetId: string): Promise<Bean> {
  const query = `mutation {
    addBlocking(id: "${id}", targetId: "${targetId}") {
      ${BEAN_FIELDS}
    }
  }`;
  const result = await execBeansQuery<{ addBlocking: Bean }>(query);
  return result.addBlocking;
}

/**
 * Remove a blocking relationship
 * @param id The bean that is blocking another
 * @param targetId The bean that will no longer be blocked
 * @returns The updated bean
 */
export async function removeBlocking(id: string, targetId: string): Promise<Bean> {
  const query = `mutation {
    removeBlocking(id: "${id}", targetId: "${targetId}") {
      ${BEAN_FIELDS}
    }
  }`;
  const result = await execBeansQuery<{ removeBlocking: Bean }>(query);
  return result.removeBlocking;
}

/**
 * Check if bean type requires review mode (epic or milestone)
 */
export function isReviewModeType(type: BeanType): boolean {
  return type === 'epic' || type === 'milestone';
}

// =============================================================================
// Legacy Class (for backwards compatibility during migration)
// =============================================================================

/**
 * @deprecated Use standalone functions instead
 */
export class BeansClient {
  constructor(cwdPath: string = process.cwd()) {
    setCwd(cwdPath);
  }

  async query<T>(graphql: string): Promise<T> {
    return execBeansQuery<T>(graphql);
  }

  async getBeans(filter?: BeanFilter): Promise<Bean[]> {
    return listBeans(filter);
  }

  async getBean(id: string): Promise<Bean | null> {
    return getBean(id);
  }

  async getActionableBeans(): Promise<Bean[]> {
    return listBeans({
      excludeStatus: ['completed', 'scrapped', 'draft'],
      isBlocked: false,
    });
  }

  async updateStatus(id: string, status: string): Promise<void> {
    await updateBeanStatus(id, status as BeanStatus);
  }

  async updateBody(id: string, body: string): Promise<void> {
    await updateBeanBody(id, body);
  }
}

export default BeansClient;
