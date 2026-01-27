/**
 * Configuration
 *
 * Loads and validates configuration from talos.yml.
 * Searches upward from cwd for config file, similar to how beans finds .beans.yml.
 */
import { readFileSync, existsSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { parse as parseYaml } from 'yaml';
import { z } from 'zod';
import type { Bean, BeanType } from '../talos/beans-client.js';

// =============================================================================
// Zod Schema Definition
// =============================================================================

/**
 * OpenCode backend configuration
 */
const OpenCodeConfigSchema = z.object({
  model: z.string().default('anthropic/claude-sonnet-4-20250514'),
});

/**
 * Claude backend configuration
 */
const ClaudeConfigSchema = z.object({
  model: z.string().default('claude-sonnet-4-20250514'),
  dangerously_skip_permissions: z.boolean().default(true),
});

/**
 * Codex backend configuration
 */
const CodexConfigSchema = z.object({
  model: z.string().default('codex-mini-latest'),
});

/**
 * Agent backend configuration
 */
const AgentConfigSchema = z.object({
  backend: z.enum(['opencode', 'claude', 'codex']).default('opencode'),
  opencode: OpenCodeConfigSchema.optional(),
  claude: ClaudeConfigSchema.optional(),
  codex: CodexConfigSchema.optional(),
});

/**
 * Scheduler settings
 */
const SchedulerConfigSchema = z.object({
  max_parallel: z.number().min(1).default(1),
  poll_interval: z.number().min(100).default(1000),
  auto_enqueue_on_startup: z.boolean().default(false),
});

/**
 * Commit style settings
 */
const CommitStyleConfigSchema = z.object({
  include_bean_id: z.boolean().default(true),
});

/**
 * Completion handling configuration
 */
const OnCompleteConfigSchema = z.object({
  auto_commit: z.boolean().default(true),
  push: z.boolean().default(false),
  commit_style: CommitStyleConfigSchema.default({}),
});

/**
 * Review mode configuration
 */
const ReviewConfigSchema = z.object({
  test_command: z.string().default('npm test'),
  conventions_file: z.string().optional(), // Path to CONVENTIONS.md or similar
});

/**
 * Blocker handling configuration
 */
const OnBlockedConfigSchema = z.object({
  create_blocker_bean: z.boolean().default(true),
});

/**
 * Planning agent tools
 */
const PlanningToolSchema = z.enum([
  'read_file',
  'glob',
  'grep',
  'bash_readonly',
  'web_search',
  'beans_cli',
]);

/**
 * Planning agent configuration
 * 
 * Supported providers:
 * - 'anthropic' / 'claude': Direct Anthropic API (requires ANTHROPIC_API_KEY)
 * - 'openai': OpenAI API (requires OPENAI_API_KEY)
 * - 'claude_code': Claude CLI subscription (requires `claude` CLI installed)
 */
const PlanningAgentConfigSchema = z.object({
  provider: z.enum(['anthropic', 'claude', 'openai', 'claude_code']).default('claude'),
  model: z.string().default('claude-sonnet-4-20250514'),
  temperature: z.number().min(0).max(2).default(0.7),
  tools: z.array(PlanningToolSchema).default([
    'read_file',
    'glob',
    'grep',
    'bash_readonly',
    'web_search',
    'beans_cli',
  ]),
});

/**
 * Expert persona types
 */
const PersonaSchema = z.enum([
  'pragmatist',
  'architect',
  'skeptic',
  'simplifier',
  'security',
]);

/**
 * Expert advisors configuration
 */
const ExpertsConfigSchema = z.object({
  enabled: z.boolean().default(true),
  personas: z.array(PersonaSchema).default(['pragmatist', 'architect', 'skeptic']),
});

/**
 * Bean types that can trigger brainstorm mode
 */
const BrainstormEnforceTypeSchema = z.enum(['feature', 'epic', 'milestone']);

/**
 * Brainstorm mode configuration
 */
const BrainstormModeConfigSchema = z.object({
  enabled: z.boolean().default(true),
  skill: z.string().default('beans-brainstorming'),
  enforce_for_types: z.array(BrainstormEnforceTypeSchema).default(['feature', 'epic', 'milestone']),
});

/**
 * Breakdown mode configuration
 */
const BreakdownModeConfigSchema = z.object({
  enabled: z.boolean().default(true),
  skill: z.string().default('beans-breakdown'),
  min_task_duration_minutes: z.number().min(1).default(2),
  max_task_duration_minutes: z.number().min(1).default(5),
  suggest_test_beans: z.boolean().default(true),
});

/**
 * Planning modes configuration
 */
const PlanningModesConfigSchema = z.object({
  brainstorm: BrainstormModeConfigSchema.default({}),
  breakdown: BreakdownModeConfigSchema.default({}),
});

/**
 * Planning configuration (skills directory and modes)
 */
const PlanningConfigSchema = z.object({
  skills_directory: z.string().default('./skills'),
  modes: PlanningModesConfigSchema.default({}),
});

/**
 * Watcher settings (legacy, kept for backwards compatibility)
 */
const WatcherConfigSchema = z.object({
  beansDir: z.string().default('.beans'),
});

/**
 * Output settings (legacy, kept for backwards compatibility)
 */
const OutputConfigSchema = z.object({
  dir: z.string().default('.talos/output'),
  autoComplete: z.boolean().default(false),
});

/**
 * Complete Talos configuration schema
 */
const TalosConfigSchema = z.object({
  agent: AgentConfigSchema.default({}),
  scheduler: SchedulerConfigSchema.default({}),
  on_complete: OnCompleteConfigSchema.default({}),
  on_blocked: OnBlockedConfigSchema.default({}),
  review: ReviewConfigSchema.default({}),
  planning_agent: PlanningAgentConfigSchema.default({}),
  experts: ExpertsConfigSchema.default({}),
  planning: PlanningConfigSchema.default({}),
  // Legacy fields for backwards compatibility
  watcher: WatcherConfigSchema.default({}),
  output: OutputConfigSchema.default({}),
});

// =============================================================================
// Type Exports
// =============================================================================

export type TalosConfig = z.infer<typeof TalosConfigSchema>;
export type AgentConfig = z.infer<typeof AgentConfigSchema>;
export type SchedulerConfig = z.infer<typeof SchedulerConfigSchema>;
export type OnCompleteConfig = z.infer<typeof OnCompleteConfigSchema>;
export type OnBlockedConfig = z.infer<typeof OnBlockedConfigSchema>;
export type ReviewConfig = z.infer<typeof ReviewConfigSchema>;
export type PlanningAgentConfig = z.infer<typeof PlanningAgentConfigSchema>;
export type ExpertsConfig = z.infer<typeof ExpertsConfigSchema>;
export type CommitStyleConfig = z.infer<typeof CommitStyleConfigSchema>;
export type PlanningTool = z.infer<typeof PlanningToolSchema>;
export type Persona = z.infer<typeof PersonaSchema>;
export type PlanningConfig = z.infer<typeof PlanningConfigSchema>;
export type PlanningModesConfig = z.infer<typeof PlanningModesConfigSchema>;
export type BrainstormModeConfig = z.infer<typeof BrainstormModeConfigSchema>;
export type BreakdownModeConfig = z.infer<typeof BreakdownModeConfigSchema>;
export type BrainstormEnforceType = z.infer<typeof BrainstormEnforceTypeSchema>;

// =============================================================================
// Discovered Paths Interface
// =============================================================================

/**
 * Paths discovered during configuration loading
 */
export interface DiscoveredPaths {
  /** Absolute path to the talos.yml config file (null if not found) */
  configPath: string | null;
  /** Absolute path to the .beans directory */
  beansPath: string;
  /** Absolute path to the project root (directory containing config or cwd) */
  projectRoot: string;
}

/**
 * Result of loading configuration
 */
export interface ConfigResult {
  config: TalosConfig;
  paths: DiscoveredPaths;
}

// =============================================================================
// Path Discovery Functions
// =============================================================================

/**
 * Search upward from startDir for a file with the given name
 * @returns Absolute path to the file, or null if not found
 */
function searchUpward(startDir: string, filename: string): string | null {
  let currentDir = resolve(startDir);
  const root = dirname(currentDir);

  while (currentDir !== root) {
    const candidate = join(currentDir, filename);
    if (existsSync(candidate)) {
      return candidate;
    }
    const parent = dirname(currentDir);
    if (parent === currentDir) break; // Reached filesystem root
    currentDir = parent;
  }

  // Check root directory too
  const rootCandidate = join(currentDir, filename);
  if (existsSync(rootCandidate)) {
    return rootCandidate;
  }

  return null;
}

/**
 * Search upward from startDir for a directory with the given name
 * @returns Absolute path to the directory, or null if not found
 */
function searchUpwardDir(startDir: string, dirname_: string): string | null {
  let currentDir = resolve(startDir);
  const root = dirname(currentDir);

  while (currentDir !== root) {
    const candidate = join(currentDir, dirname_);
    if (existsSync(candidate)) {
      return candidate;
    }
    const parent = dirname(currentDir);
    if (parent === currentDir) break; // Reached filesystem root
    currentDir = parent;
  }

  // Check root directory too
  const rootCandidate = join(currentDir, dirname_);
  if (existsSync(rootCandidate)) {
    return rootCandidate;
  }

  return null;
}

/**
 * Discover paths for config file, beans directory, and project root
 */
function discoverPaths(startDir: string = process.cwd()): DiscoveredPaths {
  // Search upward for talos.yml
  const configPath = searchUpward(startDir, 'talos.yml');

  // If config found, project root is its directory
  // Otherwise, search for .beans directory to determine project root
  let projectRoot: string;
  let beansPath: string;

  if (configPath) {
    projectRoot = dirname(configPath);
    // Look for .beans in the same directory as config, or search upward
    const beansInConfigDir = join(projectRoot, '.beans');
    if (existsSync(beansInConfigDir)) {
      beansPath = beansInConfigDir;
    } else {
      // Search upward from config location
      const foundBeans = searchUpwardDir(projectRoot, '.beans');
      beansPath = foundBeans ?? join(projectRoot, '.beans');
    }
  } else {
    // No config file, search for .beans directory
    const foundBeans = searchUpwardDir(startDir, '.beans');
    if (foundBeans) {
      beansPath = foundBeans;
      projectRoot = dirname(foundBeans);
    } else {
      // Fall back to cwd
      projectRoot = resolve(startDir);
      beansPath = join(projectRoot, '.beans');
    }
  }

  return {
    configPath,
    beansPath,
    projectRoot,
  };
}

// =============================================================================
// Configuration Loading
// =============================================================================

/**
 * Format Zod validation errors into helpful messages
 */
function formatValidationErrors(error: z.ZodError): string {
  const issues = error.issues.map((issue) => {
    const path = issue.path.join('.');
    const location = path ? `at '${path}'` : 'at root';
    return `  - ${location}: ${issue.message}`;
  });
  return `Configuration validation errors:\n${issues.join('\n')}`;
}

/**
 * Load configuration from talos.yml
 * Searches upward from the given directory (or cwd) for the config file.
 *
 * @param startDir - Directory to start searching from (defaults to cwd)
 * @returns Configuration and discovered paths
 */
export function loadConfig(startDir: string = process.cwd()): ConfigResult {
  const paths = discoverPaths(startDir);

  let rawConfig: unknown = {};

  if (paths.configPath) {
    try {
      const contents = readFileSync(paths.configPath, 'utf-8');
      rawConfig = parseYaml(contents) || {};
    } catch (error) {
      const err = error as Error;
      console.error(`Warning: Failed to parse ${paths.configPath}: ${err.message}`);
    }
  }

  // Parse and validate with defaults
  const result = TalosConfigSchema.safeParse(rawConfig);

  if (!result.success) {
    console.error(formatValidationErrors(result.error));
    // Return defaults on error
    return {
      config: TalosConfigSchema.parse({}),
      paths,
    };
  }

  return {
    config: result.data,
    paths,
  };
}

/**
 * Load configuration from a specific file path (for testing or explicit paths)
 */
export function loadConfigFromFile(configPath: string): TalosConfig {
  let rawConfig: unknown = {};

  if (existsSync(configPath)) {
    try {
      const contents = readFileSync(configPath, 'utf-8');
      rawConfig = parseYaml(contents) || {};
    } catch (error) {
      const err = error as Error;
      console.error(`Warning: Failed to parse ${configPath}: ${err.message}`);
    }
  }

  const result = TalosConfigSchema.safeParse(rawConfig);

  if (!result.success) {
    console.error(formatValidationErrors(result.error));
    return TalosConfigSchema.parse({});
  }

  return result.data;
}

/**
 * Get default configuration (no file loading)
 */
export function getDefaultConfig(): TalosConfig {
  return TalosConfigSchema.parse({});
}

// =============================================================================
// Skills Directory Resolution
// =============================================================================

/**
 * Resolve the skills directory path relative to the project root
 * @param skillsDir - The skills directory path from config (relative or absolute)
 * @param projectRoot - The project root directory
 * @returns Absolute path to the skills directory
 */
export function resolveSkillsDirectory(skillsDir: string, projectRoot: string): string {
  if (skillsDir.startsWith('/')) {
    return skillsDir;
  }
  return resolve(projectRoot, skillsDir);
}

/**
 * Validate that a skill name matches an existing skill in the skills directory
 * Supports both formats:
 * - Flat file: skills/skill-name.md
 * - Directory: skills/skill-name/SKILL.md (Agent Skills format)
 * 
 * @param skillName - The skill name to validate
 * @param skillsDir - Absolute path to the skills directory
 * @returns Object with isValid boolean and error message if invalid
 */
export function validateSkillExists(
  skillName: string,
  skillsDir: string
): { isValid: boolean; error?: string } {
  if (!existsSync(skillsDir)) {
    return {
      isValid: false,
      error: `Skills directory does not exist: ${skillsDir}`,
    };
  }
  
  // Check for Agent Skills format first (skill-name/SKILL.md)
  const agentSkillPath = join(skillsDir, skillName, 'SKILL.md');
  if (existsSync(agentSkillPath)) {
    return { isValid: true };
  }
  
  // Fall back to flat file format (skill-name.md)
  const flatSkillPath = join(skillsDir, `${skillName}.md`);
  if (existsSync(flatSkillPath)) {
    return { isValid: true };
  }
  
  return {
    isValid: false,
    error: `Skill not found: ${skillName} (tried ${agentSkillPath} and ${flatSkillPath})`,
  };
}

/**
 * Validate all skill references in the planning configuration
 * @param config - The planning configuration
 * @param projectRoot - The project root directory
 * @returns Array of validation errors (empty if all valid)
 */
export function validatePlanningSkills(
  config: z.infer<typeof PlanningConfigSchema>,
  projectRoot: string
): string[] {
  const errors: string[] = [];
  const skillsDir = resolveSkillsDirectory(config.skills_directory, projectRoot);
  
  // Only validate skills if the directory exists
  // If it doesn't exist, that's a soft warning - skills are optional
  if (!existsSync(skillsDir)) {
    return []; // Skills directory is optional, no errors
  }
  
  // Validate brainstorm skill if enabled
  if (config.modes.brainstorm.enabled) {
    const result = validateSkillExists(config.modes.brainstorm.skill, skillsDir);
    if (!result.isValid && result.error) {
      errors.push(`Brainstorm mode: ${result.error}`);
    }
  }
  
  // Validate breakdown skill if enabled
  if (config.modes.breakdown.enabled) {
    const result = validateSkillExists(config.modes.breakdown.skill, skillsDir);
    if (!result.isValid && result.error) {
      errors.push(`Breakdown mode: ${result.error}`);
    }
  }
  
  return errors;
}

// =============================================================================
// Commit Type Mapping
// =============================================================================

/**
 * Conventional commit types
 */
export type ConventionalCommitType = 'feat' | 'fix' | 'chore' | 'docs' | 'refactor' | 'test';

/**
 * Map bean type to conventional commit type
 * - feature → feat
 * - bug → fix
 * - task → chore
 * - epic → chore (epics shouldn't be committed directly, but just in case)
 * - milestone → chore (milestones shouldn't be committed directly)
 */
export function beanTypeToCommitType(beanType: BeanType): ConventionalCommitType {
  switch (beanType) {
    case 'feature':
      return 'feat';
    case 'bug':
      return 'fix';
    case 'task':
      return 'chore';
    case 'epic':
      return 'chore';
    case 'milestone':
      return 'chore';
    default:
      return 'chore';
  }
}

// =============================================================================
// Scope Extraction
// =============================================================================

/**
 * Callback to fetch a bean by ID (dependency injection for testability)
 */
export type BeanFetcher = (id: string) => Promise<Bean | null>;

/**
 * Walk up the parent chain to find the epic ancestor and extract its slug as scope
 * @param bean - The bean to find scope for
 * @param fetchBean - Function to fetch beans by ID
 * @returns The epic's slug as scope, or null if no epic ancestor found
 */
export async function extractScope(
  bean: Bean,
  fetchBean: BeanFetcher
): Promise<string | null> {
  // If this bean is an epic, use its own slug
  if (bean.type === 'epic') {
    return bean.slug;
  }

  // Walk up the parent chain
  let currentParentId = bean.parentId;

  while (currentParentId) {
    const parent = await fetchBean(currentParentId);
    if (!parent) {
      return null;
    }

    if (parent.type === 'epic') {
      return parent.slug;
    }

    currentParentId = parent.parentId;
  }

  return null;
}

/**
 * Format a complete conventional commit message for a bean
 * @param bean - The bean being committed
 * @param scope - Optional scope (from epic ancestor)
 * @param config - Commit style configuration
 * @returns Formatted commit message
 */
export function formatCommitMessage(
  bean: Bean,
  scope: string | null,
  config: CommitStyleConfig
): string {
  const type = beanTypeToCommitType(bean.type);

  // Build the header
  const header = scope ? `${type}(${scope}): ${bean.title}` : `${type}: ${bean.title}`;

  // Extract first paragraph from body for description
  const bodyParagraphs = bean.body.trim().split(/\n\n+/);
  const firstParagraph = bodyParagraphs[0]?.trim() || '';

  // Build the full message
  const parts: string[] = [header];

  if (firstParagraph) {
    parts.push(''); // Empty line after header
    parts.push(firstParagraph);
  }

  if (config.include_bean_id) {
    parts.push(''); // Empty line before bean reference
    parts.push(`Bean: ${bean.id}`);
  }

  return parts.join('\n');
}

// =============================================================================
// Schema Exports
// =============================================================================

export {
  TalosConfigSchema,
  AgentConfigSchema,
  SchedulerConfigSchema,
  OnCompleteConfigSchema,
  OnBlockedConfigSchema,
  ReviewConfigSchema,
  PlanningAgentConfigSchema,
  ExpertsConfigSchema,
  CommitStyleConfigSchema,
  OpenCodeConfigSchema,
  ClaudeConfigSchema,
  CodexConfigSchema,
  PlanningConfigSchema,
  PlanningModesConfigSchema,
  BrainstormModeConfigSchema,
  BreakdownModeConfigSchema,
};
