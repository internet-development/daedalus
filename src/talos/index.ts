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

// Beans client - standalone functions and types
export {
  // Types
  type Bean,
  type BeanStatus,
  type BeanType,
  type BeanPriority,
  type BeanFilter,
  type CreateBeanInput,
  type TalosTag,
  type BeanWithChildren,
  // Error class
  BeansCliError,
  // Functions
  listBeans,
  getBean,
  getBlockedBy,
  getBeanWithChildren,
  getIncompleteChildren,
  addBlockingRelationship,
  updateBeanStatus,
  updateBeanBody,
  updateBeanTags,
  createBean,
  isStuck,
  isReviewModeType,
  getEpicAncestor,
  setCwd,
  getCwd,
  // Legacy class (deprecated)
  BeansClient,
} from './beans-client.js';
export { BeanWatcher, Watcher } from './watcher.js';
export { Scheduler, type SchedulerConfig, type SchedulerEvents } from './scheduler.js';
export {
  AgentRunner,
  generatePrompt,
  generateReviewPrompt,
  generatePromptForBean,
  isReviewMode,
  type AgentConfig,
  type OutputEvent,
  type ExitResult,
  type AgentRunnerEvents,
  type ReviewConfig,
} from './agent-runner.js';
export {
  CompletionHandler,
  type CompletionResult,
  type CompletionHandlerOptions,
  type CompletionHandlerEvents,
} from './completion-handler.js';
export { Talos, type RunningBean, type TalosEvents } from './talos.js';
export { DaemonManager, type DaemonStatus } from './daemon-manager.js';
export {
  createLogger,
  createLoggerFromConfig,
  initLogger,
  getLogger,
  logger,
  type CreateLoggerOptions,
} from './logger.js';

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
