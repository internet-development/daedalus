/**
 * Custom Prompts System
 *
 * Loads and manages custom prompts from .talos/prompts/ directory.
 * Prompts are markdown files with optional frontmatter for metadata.
 */
import { readFileSync, readdirSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import { join, basename } from 'path';

// =============================================================================
// Types
// =============================================================================

export interface CustomPrompt {
  /** Prompt name (filename without extension) */
  name: string;
  /** Short description (from frontmatter or first line) */
  description?: string;
  /** Full prompt content */
  content: string;
  /** Path to the prompt file */
  path: string;
  /** Whether this is a built-in default prompt */
  isDefault: boolean;
}

// =============================================================================
// Default Prompts
// =============================================================================

const DEFAULT_PROMPTS: Omit<CustomPrompt, 'path' | 'isDefault'>[] = [
  {
    name: 'Challenge',
    description: 'Challenge every assumption in this plan',
    content: `Challenge every assumption in this plan. For each decision or approach:
1. What assumptions are we making?
2. What if those assumptions are wrong?
3. What would we do differently?

Be thorough but constructive. The goal is to strengthen the plan, not tear it down.`,
  },
  {
    name: 'Simplify',
    description: 'Find ways to reduce complexity',
    content: `Look at this plan with fresh eyes and find ways to simplify:
1. What can we remove entirely?
2. What can we defer to a future iteration?
3. What's the absolute minimum we need for a useful first version?

Apply the principle: the best code is code you don't write.`,
  },
  {
    name: 'Research',
    description: 'Find existing solutions and approaches',
    content: `Before we build anything custom, let's research:
1. Are there existing libraries or packages that solve this?
2. How have other projects approached this problem?
3. What are the trade-offs of different approaches?

Search the web and our codebase for relevant prior art.`,
  },
  {
    name: 'Risks',
    description: 'Identify what could go wrong',
    content: `What could go wrong with this plan?
1. Technical risks: performance, scalability, edge cases
2. Implementation risks: complexity, dependencies, timeline
3. User risks: confusion, data loss, unexpected behavior

For each risk, suggest a mitigation strategy.`,
  },
  {
    name: 'Increments',
    description: 'Break into smallest possible steps',
    content: `Break this into the smallest possible increments, where each increment:
1. Is independently deployable
2. Provides some user value
3. Can be completed in a few hours of focused work

Prioritize the increments by risk and value.`,
  },
  {
    name: 'Dependencies',
    description: 'Identify blocking relationships',
    content: `Map out the dependencies in this plan:
1. What needs to happen first?
2. What can be parallelized?
3. What are the critical path items?

Create a suggested ordering for implementation.`,
  },
];

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Parse frontmatter from markdown content.
 * Returns description if found.
 */
function parseFrontmatter(content: string): {
  description?: string;
  body: string;
} {
  if (!content.startsWith('---')) {
    // No frontmatter, use first line as description
    const lines = content.trim().split('\n');
    const firstLine = lines[0];
    if (firstLine && firstLine.startsWith('#')) {
      return {
        description: firstLine.replace(/^#+\s*/, ''),
        body: lines.slice(1).join('\n').trim(),
      };
    }
    return { body: content };
  }

  const endIndex = content.indexOf('---', 3);
  if (endIndex === -1) {
    return { body: content };
  }

  const frontmatter = content.slice(3, endIndex).trim();
  const body = content.slice(endIndex + 3).trim();

  // Parse simple key: value pairs
  let description: string | undefined;
  for (const line of frontmatter.split('\n')) {
    const match = line.match(/^description:\s*(.+)/i);
    if (match) {
      description = match[1].trim().replace(/^["']|["']$/g, '');
    }
  }

  return { description, body };
}

/**
 * Get the prompts directory path.
 */
function getPromptsDir(): string {
  // Search for .talos directory starting from cwd
  let dir = process.cwd();
  while (dir !== '/') {
    const talosDir = join(dir, '.talos');
    if (existsSync(talosDir)) {
      return join(talosDir, 'prompts');
    }
    dir = join(dir, '..');
  }
  return join(process.cwd(), '.talos', 'prompts');
}

// =============================================================================
// Public Functions
// =============================================================================

/**
 * Load all prompts (defaults + custom from .talos/prompts/).
 */
export async function loadPrompts(): Promise<CustomPrompt[]> {
  const prompts: CustomPrompt[] = [];

  // Add default prompts first
  for (const defaultPrompt of DEFAULT_PROMPTS) {
    prompts.push({
      ...defaultPrompt,
      path: '',
      isDefault: true,
    });
  }

  // Load custom prompts from directory
  const promptsDir = getPromptsDir();
  if (existsSync(promptsDir)) {
    try {
      const files = readdirSync(promptsDir);
      for (const file of files) {
        if (!file.endsWith('.md') || file === '.gitkeep') continue;

        const filePath = join(promptsDir, file);
        try {
          const content = readFileSync(filePath, 'utf-8');
          const { description, body } = parseFrontmatter(content);
          const name = basename(file, '.md')
            .replace(/-/g, ' ')
            .replace(/\b\w/g, (c) => c.toUpperCase());

          prompts.push({
            name,
            description,
            content: body || content,
            path: filePath,
            isDefault: false,
          });
        } catch {
          // Skip files that can't be read
        }
      }
    } catch {
      // Directory exists but can't be read
    }
  }

  return prompts;
}

/**
 * Save a custom prompt to the prompts directory.
 */
export async function savePrompt(
  name: string,
  content: string,
  description?: string
): Promise<string> {
  const promptsDir = getPromptsDir();

  // Ensure directory exists
  if (!existsSync(promptsDir)) {
    mkdirSync(promptsDir, { recursive: true });
  }

  // Create filename from name
  const filename = name.toLowerCase().replace(/\s+/g, '-') + '.md';
  const filePath = join(promptsDir, filename);

  // Build content with frontmatter if description provided
  let fileContent = content;
  if (description) {
    fileContent = `---
description: ${description}
---

${content}`;
  }

  writeFileSync(filePath, fileContent, 'utf-8');
  return filePath;
}

/**
 * Get default prompts only (for initial setup).
 */
export function getDefaultPrompts(): Omit<CustomPrompt, 'path' | 'isDefault'>[] {
  return DEFAULT_PROMPTS;
}
