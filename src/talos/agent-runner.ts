/**
 * Agent Runner
 *
 * Spawns and manages coding agents (like opencode, Claude Code, etc.)
 * for working on beans.
 */
import { spawn, type ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import type { Bean } from './beans-client.js';

export interface AgentConfig {
  command: string;
  args: string[];
  model?: string;
}

export interface RunningAgent {
  id: string;
  beanId: string;
  process: ChildProcess;
  startedAt: Date;
  output: string[];
}

export class AgentRunner extends EventEmitter {
  private agents: Map<string, RunningAgent> = new Map();
  private config: AgentConfig;
  private cwd: string;

  constructor(config: AgentConfig, cwd: string = process.cwd()) {
    super();
    this.config = config;
    this.cwd = cwd;
  }

  /**
   * Start an agent for a bean
   */
  async start(bean: Bean, prompt: string): Promise<string> {
    const agentId = `agent-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    const args = [...this.config.args];
    if (this.config.model) {
      args.push('--model', this.config.model);
    }

    const process = spawn(this.config.command, args, {
      cwd: this.cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...globalThis.process.env,
        FORCE_COLOR: '1',
      },
    });

    const agent: RunningAgent = {
      id: agentId,
      beanId: bean.id,
      process,
      startedAt: new Date(),
      output: [],
    };

    this.agents.set(agentId, agent);

    // Send prompt to stdin
    process.stdin?.write(prompt);
    process.stdin?.end();

    // Capture output
    process.stdout?.on('data', (data: Buffer) => {
      const text = data.toString();
      agent.output.push(text);
      this.emit('output', { agentId, beanId: bean.id, data: text });
    });

    process.stderr?.on('data', (data: Buffer) => {
      const text = data.toString();
      agent.output.push(text);
      this.emit('output', { agentId, beanId: bean.id, data: text });
    });

    // Handle completion
    process.on('close', (code) => {
      const success = code === 0;
      this.emit('completed', {
        agentId,
        beanId: bean.id,
        success,
        exitCode: code,
      });
      this.agents.delete(agentId);
    });

    process.on('error', (error) => {
      this.emit('error', { agentId, beanId: bean.id, error });
      this.agents.delete(agentId);
    });

    this.emit('started', { agentId, beanId: bean.id });

    return agentId;
  }

  /**
   * Stop a running agent
   */
  stop(agentId: string): void {
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.process.kill('SIGTERM');
      this.agents.delete(agentId);
      this.emit('stopped', { agentId, beanId: agent.beanId });
    }
  }

  /**
   * Stop all running agents
   */
  stopAll(): void {
    for (const [agentId] of this.agents) {
      this.stop(agentId);
    }
  }

  /**
   * Get all running agents
   */
  getRunning(): RunningAgent[] {
    return Array.from(this.agents.values());
  }

  /**
   * Get agent output
   */
  getOutput(agentId: string): string[] | null {
    return this.agents.get(agentId)?.output ?? null;
  }
}

export default AgentRunner;
