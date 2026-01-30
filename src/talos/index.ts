/**
 * Talos Daemon Core
 *
 * This module exports the core Talos daemon functionality:
 * - Beans client for CLI interaction
 * - File system watcher for change detection
 * - Scheduler with priority queue and dependency resolution
 * - Agent runner for spawning coding agents
 * - Completion handler for post-execution tasks
 */

export { BeansClient } from './beans-client.js';
export { Watcher } from './watcher.js';
export { Scheduler } from './scheduler.js';
export { AgentRunner } from './agent-runner.js';
export { CompletionHandler } from './completion-handler.js';

// Event types for the daemon
export type TalosEvent =
  | { type: 'bean:created'; beanId: string }
  | { type: 'bean:updated'; beanId: string }
  | { type: 'bean:deleted'; beanId: string }
  | { type: 'agent:started'; beanId: string; agentId: string }
  | { type: 'agent:completed'; beanId: string; agentId: string; success: boolean }
  | { type: 'agent:output'; beanId: string; agentId: string; data: string };

// Daemon state
export interface TalosState {
  running: boolean;
  agents: Map<string, AgentState>;
  queue: string[];
}

export interface AgentState {
  beanId: string;
  startedAt: Date;
  status: 'running' | 'completed' | 'failed';
  output: string[];
}
