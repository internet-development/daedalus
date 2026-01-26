/**
 * Configuration
 *
 * Loads and validates configuration from talos.yml and environment variables.
 */
import { readFileSync, existsSync } from 'fs';
import { parse as parseYaml } from 'yaml';
import { z } from 'zod';

// Configuration schema
const AgentConfigSchema = z.object({
  backend: z.enum(['opencode', 'claude', 'codex']).default('opencode'),
  opencode: z
    .object({
      model: z.string().optional(),
    })
    .optional(),
  claude: z
    .object({
      model: z.string().optional(),
      dangerously_skip_permissions: z.boolean().default(true),
    })
    .optional(),
  codex: z
    .object({
      model: z.string().optional(),
    })
    .optional(),
});

const TalosConfigSchema = z.object({
  // Agent settings
  agent: AgentConfigSchema.default({}),

  // Scheduler settings
  scheduler: z
    .object({
      maxConcurrent: z.number().min(1).default(1),
    })
    .default({}),

  // Watcher settings
  watcher: z
    .object({
      beansDir: z.string().default('.beans'),
    })
    .default({}),

  // Output settings
  output: z
    .object({
      dir: z.string().default('.talos/output'),
      autoComplete: z.boolean().default(false),
    })
    .default({}),
});

export type TalosConfig = z.infer<typeof TalosConfigSchema>;
export type AgentConfig = z.infer<typeof AgentConfigSchema>;

/**
 * Load configuration from talos.yml
 */
export function loadConfig(configPath: string = 'talos.yml'): TalosConfig {
  let rawConfig: unknown = {};

  if (existsSync(configPath)) {
    try {
      const contents = readFileSync(configPath, 'utf-8');
      rawConfig = parseYaml(contents) || {};
    } catch (error) {
      console.error(`Warning: Failed to parse ${configPath}:`, error);
    }
  }

  // Parse and validate with defaults
  const result = TalosConfigSchema.safeParse(rawConfig);

  if (!result.success) {
    console.error('Configuration validation errors:', result.error.format());
    // Return defaults on error
    return TalosConfigSchema.parse({});
  }

  return result.data;
}

/**
 * Get default configuration
 */
export function getDefaultConfig(): TalosConfig {
  return TalosConfigSchema.parse({});
}

export { TalosConfigSchema, AgentConfigSchema };
