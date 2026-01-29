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

/**
 * Open the user's $EDITOR with a temp file and return the edited content.
 *
 * @param initialContent - Optional content to pre-fill the editor with
 * @returns The edited content, or null if cancelled/empty/error
 */
export function openEditor(initialContent = ''): string | null {
  const editorEnv = process.env.EDITOR || 'vi';

  // Support $EDITOR with arguments (e.g., "vim -u NONE", "code --wait")
  const parts = editorEnv.split(/\s+/);
  const [cmd, ...editorArgs] = parts;

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

    const content = readFileSync(tempFile, 'utf8').trim();

    if (!content) {
      return null; // Empty message
    }

    return content;
  } finally {
    try { unlinkSync(tempFile); } catch { /* ignore */ }
    try { rmdirSync(tempDir); } catch { /* ignore */ }
  }
}
