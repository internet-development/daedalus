/**
 * Streaming Markdown Renderer
 *
 * Line-buffered markdown-to-ANSI renderer for streaming planning output.
 * Accumulates tokens until newline, then regex-transforms the complete line.
 * This avoids partial-token issues (e.g. `**` split across chunks).
 *
 * See bean daedalus-imv7.
 */

// =============================================================================
// ANSI Escape Codes
// =============================================================================

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const ITALIC = '\x1b[3m';
const CYAN = '\x1b[36m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const MAGENTA = '\x1b[35m';
const BG_GRAY = '\x1b[48;5;236m';

// =============================================================================
// StreamingMarkdownRenderer
// =============================================================================

export class StreamingMarkdownRenderer {
  private buffer = '';
  private inCodeBlock = false;
  private codeBlockLang = '';

  /**
   * Feed a chunk of streamed text. Renders complete lines immediately.
   * Partial lines are buffered until the next newline.
   */
  write(chunk: string): void {
    if (!chunk) return;

    this.buffer += chunk;

    // Process all complete lines in the buffer
    let newlineIdx: number;
    while ((newlineIdx = this.buffer.indexOf('\n')) !== -1) {
      const line = this.buffer.slice(0, newlineIdx);
      this.buffer = this.buffer.slice(newlineIdx + 1);
      this.renderLine(line);
    }
  }

  /**
   * Flush remaining buffer content (call on done/cancel).
   * Outputs any buffered partial line.
   */
  flush(): void {
    if (this.buffer.length > 0) {
      this.renderLine(this.buffer);
      this.buffer = '';
    }
  }

  /**
   * Reset state between messages.
   * Clears buffer and code block tracking.
   */
  reset(): void {
    this.buffer = '';
    this.inCodeBlock = false;
    this.codeBlockLang = '';
  }

  // ===========================================================================
  // Line Rendering
  // ===========================================================================

  private renderLine(line: string): void {
    // Check for code fence (``` with optional language)
    if (this.isCodeFence(line)) {
      this.handleCodeFence(line);
      return;
    }

    // Inside code block: render as-is (dim, indented)
    if (this.inCodeBlock) {
      this.renderCodeLine(line);
      return;
    }

    // Outside code block: apply markdown transforms
    this.renderMarkdownLine(line);
  }

  private renderMarkdownLine(line: string): void {
    // Empty line: preserve for paragraph spacing
    if (line === '') {
      process.stdout.write('\n');
      return;
    }

    // Whitespace-only line: pass through
    if (line.trim() === '') {
      process.stdout.write(line + '\n');
      return;
    }

    // Horizontal rule: ---, ***, ___
    if (/^(\s*)([-*_])\2{2,}\s*$/.test(line)) {
      this.renderHorizontalRule();
      return;
    }

    // Heading: # to ######
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      this.renderHeading(headingMatch[1].length, headingMatch[2]);
      return;
    }

    // Checklist: - [ ] or - [x] or - [X]
    const checklistMatch = line.match(/^(\s*)[-*]\s+\[([ xX])\]\s+(.+)$/);
    if (checklistMatch) {
      const checked = checklistMatch[2] !== ' ';
      this.renderChecklist(checked, checklistMatch[3]);
      return;
    }

    // Bullet list: - item or * item
    const bulletMatch = line.match(/^(\s*)[-*]\s+(.+)$/);
    if (bulletMatch) {
      this.renderBullet(bulletMatch[2]);
      return;
    }

    // Numbered list: 1. item
    const numberedMatch = line.match(/^(\s*)(\d+)\.\s+(.+)$/);
    if (numberedMatch) {
      this.renderNumbered(numberedMatch[2], numberedMatch[3]);
      return;
    }

    // Blockquote: > text
    const blockquoteMatch = line.match(/^>\s?(.*)$/);
    if (blockquoteMatch) {
      this.renderBlockquote(blockquoteMatch[1]);
      return;
    }

    // Regular text with inline transforms
    process.stdout.write(this.applyInlineTransforms(line) + '\n');
  }

  // ===========================================================================
  // Block-Level Rendering
  // ===========================================================================

  private isCodeFence(line: string): boolean {
    return /^\s*```/.test(line);
  }

  private handleCodeFence(line: string): void {
    if (!this.inCodeBlock) {
      // Opening fence
      this.inCodeBlock = true;
      const langMatch = line.match(/^\s*```(\w+)?/);
      this.codeBlockLang = langMatch?.[1] ?? '';

      // Render fence header
      if (this.codeBlockLang) {
        process.stdout.write(`${DIM}  ── ${this.codeBlockLang} ──${RESET}\n`);
      } else {
        process.stdout.write(`${DIM}  ──────${RESET}\n`);
      }
    } else {
      // Closing fence
      this.inCodeBlock = false;
      this.codeBlockLang = '';
      process.stdout.write(`${DIM}  ──────${RESET}\n`);
    }
  }

  private renderCodeLine(line: string): void {
    // Indented, dim, no inline transforms
    process.stdout.write(`${DIM}    ${line}${RESET}\n`);
  }

  private renderHeading(level: number, text: string): void {
    // Color varies by level
    const colors: Record<number, string> = {
      1: MAGENTA,
      2: CYAN,
      3: YELLOW,
      4: GREEN,
      5: CYAN,
      6: DIM,
    };
    const color = colors[level] ?? CYAN;
    const transformed = this.applyInlineTransforms(text);
    process.stdout.write(`\n${BOLD}${color}${transformed}${RESET}\n`);
  }

  private renderChecklist(checked: boolean, text: string): void {
    const box = checked ? '\u2611' : '\u2610'; // ☑ or ☐
    const color = checked ? GREEN : YELLOW;
    const transformed = this.applyInlineTransforms(text);
    process.stdout.write(`  ${color}${box}${RESET} ${transformed}\n`);
  }

  private renderBullet(text: string): void {
    const transformed = this.applyInlineTransforms(text);
    process.stdout.write(`  \u2022 ${transformed}\n`);
  }

  private renderNumbered(num: string, text: string): void {
    const transformed = this.applyInlineTransforms(text);
    process.stdout.write(`  ${num}. ${transformed}\n`);
  }

  private renderHorizontalRule(): void {
    const width = process.stdout.columns || 80;
    const ruleWidth = Math.min(width, 80);
    process.stdout.write(`${DIM}${'─'.repeat(ruleWidth)}${RESET}\n`);
  }

  private renderBlockquote(text: string): void {
    const transformed = this.applyInlineTransforms(text);
    process.stdout.write(`${DIM}  \u2502 ${transformed}${RESET}\n`);
  }

  // ===========================================================================
  // Inline Transforms
  // ===========================================================================

  private applyInlineTransforms(text: string): string {
    // Order matters: process code first (to protect its contents),
    // then bold+italic, then bold, then italic

    // Inline code: `code`
    text = text.replace(/`([^`]+)`/g, `${CYAN}${BG_GRAY}$1${RESET}`);

    // Bold + italic: ***text*** or ___text___
    text = text.replace(/\*{3}(.+?)\*{3}/g, `${BOLD}${ITALIC}$1${RESET}`);
    text = text.replace(/_{3}(.+?)_{3}/g, `${BOLD}${ITALIC}$1${RESET}`);

    // Bold: **text**
    text = text.replace(/\*{2}(.+?)\*{2}/g, `${BOLD}$1${RESET}`);
    text = text.replace(/_{2}(.+?)_{2}/g, `${BOLD}$1${RESET}`);

    // Italic: *text* or _text_
    // Use negative lookbehind/ahead to avoid matching inside words for _
    text = text.replace(/\*([^*]+)\*/g, `${ITALIC}$1${RESET}`);
    text = text.replace(/(?<!\w)_([^_]+)_(?!\w)/g, `${ITALIC}$1${RESET}`);

    return text;
  }
}
