/**
 * Beans Client
 *
 * Interacts with the beans CLI to query and update issues.
 * All beans interaction is done via `beans query --json` for machine-readable output.
 */
import { execSync, spawn } from 'child_process';

export interface Bean {
  id: string;
  title: string;
  status: string;
  type: string;
  priority: string;
  body: string;
  parentId?: string;
  blockingIds: string[];
}

export interface BeanFilter {
  status?: string[];
  excludeStatus?: string[];
  type?: string[];
  priority?: string[];
  isBlocked?: boolean;
}

export class BeansClient {
  private cwd: string;

  constructor(cwd: string = process.cwd()) {
    this.cwd = cwd;
  }

  /**
   * Execute a GraphQL query against beans
   */
  async query<T>(graphql: string): Promise<T> {
    try {
      const result = execSync(`beans query '${graphql}' --json`, {
        cwd: this.cwd,
        encoding: 'utf-8',
      });
      return JSON.parse(result) as T;
    } catch (error) {
      throw new Error(`Beans query failed: ${error}`);
    }
  }

  /**
   * Get all beans with optional filtering
   */
  async getBeans(filter?: BeanFilter): Promise<Bean[]> {
    const filterArg = filter
      ? `(filter: ${JSON.stringify(filter).replace(/"/g, '')})`
      : '';

    const result = await this.query<{ beans: Bean[] }>(`
      { beans${filterArg} { id title status type priority body parentId blockingIds } }
    `);

    return result.beans;
  }

  /**
   * Get a single bean by ID
   */
  async getBean(id: string): Promise<Bean | null> {
    const result = await this.query<{ bean: Bean | null }>(`
      { bean(id: "${id}") { id title status type priority body parentId blockingIds } }
    `);

    return result.bean;
  }

  /**
   * Get actionable beans (not completed, not draft, not blocked)
   */
  async getActionableBeans(): Promise<Bean[]> {
    return this.getBeans({
      excludeStatus: ['completed', 'scrapped', 'draft'],
      isBlocked: false,
    });
  }

  /**
   * Update a bean's status
   */
  async updateStatus(id: string, status: string): Promise<void> {
    execSync(`beans update ${id} --status ${status}`, {
      cwd: this.cwd,
      encoding: 'utf-8',
    });
  }

  /**
   * Update a bean's body (for checklist progress)
   */
  async updateBody(id: string, body: string): Promise<void> {
    // Use stdin to avoid shell escaping issues
    const child = spawn('beans', ['update', id, '--body', '-'], {
      cwd: this.cwd,
      stdio: ['pipe', 'inherit', 'inherit'],
    });

    child.stdin.write(body);
    child.stdin.end();

    await new Promise<void>((resolve, reject) => {
      child.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`beans update failed with code ${code}`));
      });
    });
  }
}

export default BeansClient;
