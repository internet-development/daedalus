/**
 * External Editor Integration
 *
 * Opens the user's $EDITOR for multi-line input, following the
 * standard Unix pattern used by git commit, gh, kubectl, etc.
 *
 * Environment variable precedence: $EDITOR → vi (fallback)
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, unlinkSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// =============================================================================
// Separator Constants
// =============================================================================

const SEPARATOR_TOP    = '#  ╾━━━━━╼◉╾━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╼◉╾━━━━━╼';
const SEPARATOR_MIDDLE = '#         ⚱  DAEDALUS · Write your message below  ⚱';
export const SEPARATOR_BOTTOM = '#  ╾━━━━━╼◉╾━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╼◉╾━━━━━╼';

export const SEPARATOR = `${SEPARATOR_TOP}\n${SEPARATOR_MIDDLE}\n${SEPARATOR_BOTTOM}`;

// =============================================================================
// Separator Stripping
// =============================================================================

/**
 * Strip the separator and everything above it from editor content.
 *
 * Uses lastIndexOf on the bottom border line so that even if the agent
 * message coincidentally contains the separator text, the real separator
 * (always the last one) is found.
 *
 * Fallback: if separator is not found (user deleted it, or editor mangled
 * Unicode), treat the entire file content as the user's message.
 *
 * @returns The user's message, or null if empty/cancelled
 */
export function stripSeparator(content: string): string | null {
  const lastIndex = content.lastIndexOf(SEPARATOR_BOTTOM);

  if (lastIndex === -1) {
    // No separator found — treat entire content as user message
    return content.trim() || null;
  }

  // Take everything after the separator bottom line
  const afterSeparator = content.slice(lastIndex + SEPARATOR_BOTTOM.length);
  const trimmed = afterSeparator.trim();

  return trimmed || null;
}

// =============================================================================
// Editor Content Building
// =============================================================================

/**
 * Build the initial content for the editor.
 *
 * Layout:
 *   <agent message>     (if provided)
 *   <blank line>
 *   <separator>
 *   <blank line>
 *   <cursor here>
 *
 * @param agentMessage - Optional last agent message for context
 * @returns The initial editor content string
 */
export function buildEditorContent(agentMessage?: string): string {
  if (agentMessage) {
    return `${agentMessage}\n\n${SEPARATOR}\n\n`;
  }
  return `${SEPARATOR}\n\n`;
}

// =============================================================================
// Editor Options
// =============================================================================

export interface EditorOptions {
  agentMessage?: string;
}

// =============================================================================
// Open Editor
// =============================================================================

/**
 * Open the user's $EDITOR with a temp file and return the edited content.
 *
 * When an agentMessage is provided, the editor is pre-filled with the agent's
 * last message above a decorative separator. The user writes below the separator.
 * On save+exit, everything above the separator is stripped.
 *
 * @param options - Optional editor configuration
 * @returns The user's message, or null if cancelled/empty/error
 */
export function openEditor(options: EditorOptions = {}): string | null {
  const { agentMessage } = options;
  const editorEnv = process.env.EDITOR || 'vi';

  // Support $EDITOR with arguments (e.g., "vim -u NONE", "code --wait")
  const parts = editorEnv.split(/\s+/);
  const [cmd, ...editorArgs] = parts;

  // Build initial content with agent message context
  const initialContent = buildEditorContent(agentMessage);

  // Create temp file with restricted permissions
  const tempDir = mkdtempSync(join(tmpdir(), 'daedalus-'));
  const tempFile = join(tempDir, 'PLAN_MESSAGE.md');

  try {
    writeFileSync(tempFile, initialContent, { encoding: 'utf8', mode: 0o600 });

    const result = spawnSync(cmd, [...editorArgs, tempFile], {
      stdio: 'inherit',
    });

    if (result.error) {
      const err = result.error as NodeJS.ErrnoException;
      if (err.code === 'ENOENT') {
        console.error(
          `Editor '${cmd}' not found.\n` +
          `Set $EDITOR environment variable.\n` +
          `Example: export EDITOR=vim`
        );
      } else {
        console.error(`Editor error: ${err.message}`);
      }
      return null;
    }

    if (result.status !== 0) {
      return null; // Editor exited with error or was cancelled
    }

    const content = readFileSync(tempFile, 'utf8');
    return stripSeparator(content);
  } finally {
    try { unlinkSync(tempFile); } catch { /* ignore */ }
    try { rmdirSync(tempDir); } catch { /* ignore */ }
  }
}
