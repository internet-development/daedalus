/**
 * Changelog Extraction
 *
 * Extracts the ## Changelog section from bean body for use in
 * squash commit messages. The changelog documents what was actually
 * implemented, deviations from spec, and decisions made.
 */
import type { Bean } from '../talos/beans-client.js';
import type { CommitStyleConfig } from '../config/index.js';
import { beanTypeToCommitType } from '../config/index.js';

// =============================================================================
// Changelog Extraction
// =============================================================================

/**
 * Extract the ## Changelog section from a bean body.
 *
 * Looks for a line matching `## Changelog` (case-insensitive) and extracts
 * everything until the next `## ` heading or end of string.
 *
 * @param body The bean body markdown
 * @returns The changelog content (without the ## Changelog heading), or null if not found
 */
export function extractChangelog(body: string): string | null {
  const lines = body.split('\n');
  let inChangelog = false;
  const changelogLines: string[] = [];

  for (const line of lines) {
    if (inChangelog) {
      // Stop at next h2 heading
      if (/^## /i.test(line) && !/^## changelog/i.test(line)) {
        break;
      }
      changelogLines.push(line);
    } else if (/^## changelog\s*$/i.test(line)) {
      inChangelog = true;
    }
  }

  if (!inChangelog) {
    return null;
  }

  const content = changelogLines.join('\n').trim();
  return content.length > 0 ? content : null;
}

// =============================================================================
// Squash Commit Message Formatting
// =============================================================================

/**
 * Format a squash commit message for a bean.
 *
 * Format:
 * ```
 * type(scope): Bean title
 *
 * ### Implemented
 * - Did thing A
 * - Did thing B
 *
 * ### Deviations from Spec
 * - Changed X because Y
 *
 * Bean: daedalus-abc1
 * ```
 *
 * @param bean The bean being committed
 * @param scope Optional scope (from epic ancestor)
 * @returns Formatted commit message
 */
export function formatSquashCommitMessage(
  bean: Bean,
  scope: string | null,
  config: CommitStyleConfig
): string {
  const type = beanTypeToCommitType(bean.type);
  const header = scope
    ? `${type}(${scope}): ${bean.title}`
    : `${type}: ${bean.title}`;

  const parts: string[] = [header];

  // Try to extract changelog, fall back to first paragraph
  const changelog = extractChangelog(bean.body);
  if (changelog) {
    parts.push(''); // Empty line after header
    parts.push(changelog);
  } else {
    const bodyParagraphs = bean.body.trim().split(/\n\n+/);
    const firstParagraph = bodyParagraphs[0]?.trim() || '';
    if (firstParagraph) {
      parts.push(''); // Empty line after header
      parts.push(firstParagraph);
    }
  }

  if (config.include_bean_id) {
    parts.push(''); // Empty line before bean reference
    parts.push(`Bean: ${bean.id}`);
  }

  return parts.join('\n');
}
