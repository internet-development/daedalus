/**
 * Tests for StreamingMarkdownRenderer.
 *
 * Line-buffered markdown-to-ANSI renderer for streaming planning output.
 * See bean daedalus-imv7.
 */
import { describe, test, expect, beforeEach } from 'vitest';
import { StreamingMarkdownRenderer } from './markdown-renderer.js';

// =============================================================================
// Helpers
// =============================================================================

const stripAnsi = (str: string) => str.replace(/\x1b\[[0-9;]*m/g, '');

/**
 * Captures process.stdout.write calls for testing renderer output.
 */
function captureStdout() {
  const writes: string[] = [];
  const originalWrite = process.stdout.write;

  process.stdout.write = ((...args: unknown[]) => {
    const str = typeof args[0] === 'string' ? args[0] : String(args[0]);
    writes.push(str);
    return true;
  }) as typeof process.stdout.write;

  return {
    writes,
    /** Get all captured output joined together */
    output() {
      return writes.join('');
    },
    /** Get all captured output with ANSI stripped */
    plain() {
      return stripAnsi(writes.join(''));
    },
    restore() {
      process.stdout.write = originalWrite;
    },
  };
}

// =============================================================================
// Line Buffering
// =============================================================================

describe('StreamingMarkdownRenderer - line buffering', () => {
  let renderer: StreamingMarkdownRenderer;
  let capture: ReturnType<typeof captureStdout>;

  beforeEach(() => {
    renderer = new StreamingMarkdownRenderer();
    capture = captureStdout();
  });

  afterEach(() => {
    capture.restore();
  });

  test('buffers partial lines until newline', () => {
    renderer.write('hello');
    expect(capture.writes).toHaveLength(0);

    renderer.write(' world\n');
    expect(capture.plain()).toContain('hello world');
  });

  test('processes multiple lines in a single chunk', () => {
    renderer.write('line one\nline two\n');
    const plain = capture.plain();
    expect(plain).toContain('line one');
    expect(plain).toContain('line two');
  });

  test('handles chunks split across multiple write calls', () => {
    renderer.write('hel');
    renderer.write('lo wo');
    renderer.write('rld\n');
    expect(capture.plain()).toContain('hello world');
  });

  test('flush outputs remaining buffer content', () => {
    renderer.write('partial content');
    expect(capture.writes).toHaveLength(0);

    renderer.flush();
    expect(capture.plain()).toContain('partial content');
  });

  test('flush is a no-op when buffer is empty', () => {
    renderer.flush();
    expect(capture.writes).toHaveLength(0);
  });

  test('reset clears buffer and state', () => {
    renderer.write('partial');
    renderer.reset();
    renderer.flush();
    // After reset, the partial content should be gone
    expect(capture.writes).toHaveLength(0);
  });

  test('preserves empty lines for paragraph spacing', () => {
    renderer.write('paragraph one\n\nparagraph two\n');
    const plain = capture.plain();
    expect(plain).toContain('paragraph one');
    expect(plain).toContain('\n\n');
    expect(plain).toContain('paragraph two');
  });

  test('passes through lines with only whitespace', () => {
    renderer.write('before\n   \nafter\n');
    const plain = capture.plain();
    expect(plain).toContain('before');
    expect(plain).toContain('after');
  });
});

// =============================================================================
// Inline Transforms
// =============================================================================

describe('StreamingMarkdownRenderer - inline transforms', () => {
  let renderer: StreamingMarkdownRenderer;
  let capture: ReturnType<typeof captureStdout>;

  beforeEach(() => {
    renderer = new StreamingMarkdownRenderer();
    capture = captureStdout();
  });

  afterEach(() => {
    capture.restore();
  });

  test('renders **bold** with ANSI bold', () => {
    renderer.write('this is **bold** text\n');
    const output = capture.output();
    // Should contain ANSI bold escape
    expect(output).toContain('\x1b[1m');
    // Plain text should have bold markers removed
    expect(capture.plain()).toContain('this is bold text');
    expect(capture.plain()).not.toContain('**');
  });

  test('renders *italic* with ANSI dim/italic', () => {
    renderer.write('this is *italic* text\n');
    const output = capture.output();
    // Should contain ANSI italic or dim escape
    expect(output).toMatch(/\x1b\[(3|2)m/);
    expect(capture.plain()).toContain('this is italic text');
    expect(capture.plain()).not.toContain('*italic*');
  });

  test('renders _italic_ with ANSI dim/italic', () => {
    renderer.write('this is _italic_ text\n');
    const output = capture.output();
    expect(output).toMatch(/\x1b\[(3|2)m/);
    expect(capture.plain()).toContain('this is italic text');
    expect(capture.plain()).not.toContain('_italic_');
  });

  test('renders `inline code` with cyan styling', () => {
    renderer.write('use `npm install` here\n');
    const output = capture.output();
    // Should contain cyan ANSI code
    expect(output).toContain('\x1b[36m');
    expect(capture.plain()).toContain('use npm install here');
    expect(capture.plain()).not.toContain('`');
  });

  test('handles multiple inline elements on one line', () => {
    renderer.write('**bold** and *italic* and `code`\n');
    const plain = capture.plain();
    expect(plain).toContain('bold');
    expect(plain).toContain('italic');
    expect(plain).toContain('code');
    expect(plain).not.toContain('**');
    expect(plain).not.toContain('`');
  });

  test('does not transform unmatched markers', () => {
    renderer.write('a single * star\n');
    const plain = capture.plain();
    expect(plain).toContain('a single * star');
  });

  test('handles ***bold italic*** gracefully', () => {
    renderer.write('***bold italic***\n');
    const plain = capture.plain();
    // Should strip the markers, content should be present
    expect(plain).toContain('bold italic');
    expect(plain).not.toContain('***');
  });
});

// =============================================================================
// Headings
// =============================================================================

describe('StreamingMarkdownRenderer - headings', () => {
  let renderer: StreamingMarkdownRenderer;
  let capture: ReturnType<typeof captureStdout>;

  beforeEach(() => {
    renderer = new StreamingMarkdownRenderer();
    capture = captureStdout();
  });

  afterEach(() => {
    capture.restore();
  });

  test('renders # heading with bold', () => {
    renderer.write('# Main Title\n');
    const output = capture.output();
    expect(output).toContain('\x1b[1m'); // bold
    expect(capture.plain()).toContain('Main Title');
    expect(capture.plain()).not.toContain('# ');
  });

  test('renders ## heading', () => {
    renderer.write('## Section Title\n');
    const output = capture.output();
    expect(output).toContain('\x1b[1m'); // bold
    expect(capture.plain()).toContain('Section Title');
    expect(capture.plain()).not.toContain('## ');
  });

  test('renders ### heading', () => {
    renderer.write('### Subsection\n');
    expect(capture.plain()).toContain('Subsection');
    expect(capture.plain()).not.toContain('### ');
  });

  test('renders up to ###### headings', () => {
    renderer.write('###### Deep Heading\n');
    expect(capture.plain()).toContain('Deep Heading');
  });

  test('does not treat # in middle of line as heading', () => {
    renderer.write('this is not # a heading\n');
    const plain = capture.plain();
    expect(plain).toContain('this is not # a heading');
  });
});

// =============================================================================
// Checklists
// =============================================================================

describe('StreamingMarkdownRenderer - checklists', () => {
  let renderer: StreamingMarkdownRenderer;
  let capture: ReturnType<typeof captureStdout>;

  beforeEach(() => {
    renderer = new StreamingMarkdownRenderer();
    capture = captureStdout();
  });

  afterEach(() => {
    capture.restore();
  });

  test('renders - [ ] as unchecked box', () => {
    renderer.write('- [ ] Todo item\n');
    const plain = capture.plain();
    expect(plain).toContain('\u2610'); // ☐
    expect(plain).toContain('Todo item');
  });

  test('renders - [x] as checked box', () => {
    renderer.write('- [x] Done item\n');
    const plain = capture.plain();
    expect(plain).toContain('\u2611'); // ☑
    expect(plain).toContain('Done item');
  });

  test('renders - [X] as checked box (uppercase)', () => {
    renderer.write('- [X] Done item\n');
    const plain = capture.plain();
    expect(plain).toContain('\u2611'); // ☑
  });

  test('applies color to checked items', () => {
    renderer.write('- [x] Done\n');
    const output = capture.output();
    // Should have green color for checked
    expect(output).toContain('\x1b[32m');
  });
});

// =============================================================================
// Bullet Lists
// =============================================================================

describe('StreamingMarkdownRenderer - bullet lists', () => {
  let renderer: StreamingMarkdownRenderer;
  let capture: ReturnType<typeof captureStdout>;

  beforeEach(() => {
    renderer = new StreamingMarkdownRenderer();
    capture = captureStdout();
  });

  afterEach(() => {
    capture.restore();
  });

  test('renders - item as bullet point', () => {
    renderer.write('- first item\n');
    const plain = capture.plain();
    expect(plain).toContain('\u2022'); // •
    expect(plain).toContain('first item');
  });

  test('renders * item as bullet point', () => {
    renderer.write('* another item\n');
    const plain = capture.plain();
    expect(plain).toContain('\u2022'); // •
    expect(plain).toContain('another item');
  });

  test('indents bullet points', () => {
    renderer.write('- indented item\n');
    const plain = capture.plain();
    // Should have leading spaces for indentation
    expect(plain).toMatch(/^\s+/);
  });
});

// =============================================================================
// Numbered Lists
// =============================================================================

describe('StreamingMarkdownRenderer - numbered lists', () => {
  let renderer: StreamingMarkdownRenderer;
  let capture: ReturnType<typeof captureStdout>;

  beforeEach(() => {
    renderer = new StreamingMarkdownRenderer();
    capture = captureStdout();
  });

  afterEach(() => {
    capture.restore();
  });

  test('renders numbered list with indentation', () => {
    renderer.write('1. first item\n');
    const plain = capture.plain();
    expect(plain).toContain('1.');
    expect(plain).toContain('first item');
    // Should be indented
    expect(plain).toMatch(/^\s+1\./);
  });

  test('handles multi-digit numbers', () => {
    renderer.write('10. tenth item\n');
    const plain = capture.plain();
    expect(plain).toContain('10.');
    expect(plain).toContain('tenth item');
  });
});

// =============================================================================
// Horizontal Rule
// =============================================================================

describe('StreamingMarkdownRenderer - horizontal rule', () => {
  let renderer: StreamingMarkdownRenderer;
  let capture: ReturnType<typeof captureStdout>;

  beforeEach(() => {
    renderer = new StreamingMarkdownRenderer();
    capture = captureStdout();
  });

  afterEach(() => {
    capture.restore();
  });

  test('renders --- as a line of dashes', () => {
    renderer.write('---\n');
    const plain = capture.plain();
    // Uses box-drawing ─ character for visual quality
    expect(plain).toMatch(/─{3,}/);
  });

  test('renders *** as horizontal rule', () => {
    renderer.write('***\n');
    const plain = capture.plain();
    expect(plain).toMatch(/─{3,}/);
  });

  test('renders ___ as horizontal rule', () => {
    renderer.write('___\n');
    const plain = capture.plain();
    expect(plain).toMatch(/─{3,}/);
  });

  test('horizontal rule is dim', () => {
    renderer.write('---\n');
    const output = capture.output();
    expect(output).toContain('\x1b[2m'); // dim
  });
});

// =============================================================================
// Code Blocks
// =============================================================================

describe('StreamingMarkdownRenderer - code blocks', () => {
  let renderer: StreamingMarkdownRenderer;
  let capture: ReturnType<typeof captureStdout>;

  beforeEach(() => {
    renderer = new StreamingMarkdownRenderer();
    capture = captureStdout();
  });

  afterEach(() => {
    capture.restore();
  });

  test('renders code block content as dim and indented', () => {
    renderer.write('```\nconst x = 1;\n```\n');
    const output = capture.output();
    expect(output).toContain('\x1b[2m'); // dim
    const plain = capture.plain();
    expect(plain).toContain('const x = 1;');
  });

  test('shows language label for code blocks', () => {
    renderer.write('```typescript\nconst x: number = 1;\n```\n');
    const plain = capture.plain();
    expect(plain).toContain('typescript');
    expect(plain).toContain('const x: number = 1;');
  });

  test('does not apply inline transforms inside code blocks', () => {
    renderer.write('```\nthis has **bold** and *italic* markers\n```\n');
    const plain = capture.plain();
    // Inside code block, markers should be preserved
    expect(plain).toContain('**bold**');
    expect(plain).toContain('*italic*');
  });

  test('tracks code block open/close state correctly', () => {
    renderer.write('before\n```\ncode\n```\nafter **bold**\n');
    const plain = capture.plain();
    expect(plain).toContain('before');
    expect(plain).toContain('code');
    // After closing code block, inline transforms should work again
    expect(plain).not.toContain('**bold**');
    expect(plain).toContain('after bold');
  });

  test('handles empty code blocks', () => {
    renderer.write('```\n```\n');
    // Should not throw
    expect(capture.plain()).toBeDefined();
  });

  test('indents code block content', () => {
    renderer.write('```\nline of code\n```\n');
    const plain = capture.plain();
    // Code lines should be indented
    expect(plain).toMatch(/\s+line of code/);
  });
});

// =============================================================================
// Blockquotes
// =============================================================================

describe('StreamingMarkdownRenderer - blockquotes', () => {
  let renderer: StreamingMarkdownRenderer;
  let capture: ReturnType<typeof captureStdout>;

  beforeEach(() => {
    renderer = new StreamingMarkdownRenderer();
    capture = captureStdout();
  });

  afterEach(() => {
    capture.restore();
  });

  test('renders > text with vertical bar', () => {
    renderer.write('> This is a quote\n');
    const plain = capture.plain();
    expect(plain).toContain('\u2502'); // │ vertical bar
    expect(plain).toContain('This is a quote');
  });

  test('blockquote is dim', () => {
    renderer.write('> quoted text\n');
    const output = capture.output();
    expect(output).toContain('\x1b[2m'); // dim
  });

  test('applies inline transforms inside blockquotes', () => {
    renderer.write('> this is **bold** in a quote\n');
    const plain = capture.plain();
    expect(plain).not.toContain('**');
    expect(plain).toContain('bold');
  });
});

// =============================================================================
// Streaming Simulation
// =============================================================================

describe('StreamingMarkdownRenderer - streaming simulation', () => {
  let renderer: StreamingMarkdownRenderer;
  let capture: ReturnType<typeof captureStdout>;

  beforeEach(() => {
    renderer = new StreamingMarkdownRenderer();
    capture = captureStdout();
  });

  afterEach(() => {
    capture.restore();
  });

  test('handles token-by-token streaming of a heading', () => {
    // Simulate streaming "## Title\n" token by token
    renderer.write('#');
    renderer.write('#');
    renderer.write(' ');
    renderer.write('T');
    renderer.write('itle');
    renderer.write('\n');
    const plain = capture.plain();
    expect(plain).toContain('Title');
    expect(plain).not.toContain('## ');
  });

  test('handles token-by-token streaming of bold text', () => {
    renderer.write('this is ');
    renderer.write('**');
    renderer.write('bold');
    renderer.write('**');
    renderer.write(' text\n');
    const plain = capture.plain();
    expect(plain).toContain('this is bold text');
    expect(plain).not.toContain('**');
  });

  test('handles code fence split across chunks', () => {
    renderer.write('`');
    renderer.write('``\n');
    renderer.write('code line\n');
    renderer.write('``');
    renderer.write('`\n');
    const plain = capture.plain();
    expect(plain).toContain('code line');
  });

  test('reset between messages clears all state', () => {
    // First message with open code block
    renderer.write('```\ncode\n');
    renderer.reset();

    // Second message should not be in code block mode
    renderer.write('**bold** text\n');
    const plain = capture.plain();
    expect(plain).toContain('bold text');
    expect(plain).not.toContain('**');
  });

  test('flush outputs partial line on cancellation', () => {
    renderer.write('partial line without newl');
    renderer.flush();
    expect(capture.plain()).toContain('partial line without newl');
  });
});

// =============================================================================
// Edge Cases
// =============================================================================

describe('StreamingMarkdownRenderer - edge cases', () => {
  let renderer: StreamingMarkdownRenderer;
  let capture: ReturnType<typeof captureStdout>;

  beforeEach(() => {
    renderer = new StreamingMarkdownRenderer();
    capture = captureStdout();
  });

  afterEach(() => {
    capture.restore();
  });

  test('handles empty string write', () => {
    renderer.write('');
    expect(capture.writes).toHaveLength(0);
  });

  test('handles write with only newlines', () => {
    renderer.write('\n\n\n');
    // Should output the empty lines
    expect(capture.writes.length).toBeGreaterThan(0);
  });

  test('handles line with only whitespace', () => {
    renderer.write('   \n');
    const plain = capture.plain();
    expect(plain).toContain('   ');
  });

  test('does not crash on deeply nested markdown', () => {
    renderer.write('**bold *italic `code` italic* bold**\n');
    // Should not throw, content should be present
    const plain = capture.plain();
    expect(plain).toContain('bold');
    expect(plain).toContain('italic');
    expect(plain).toContain('code');
  });

  test('handles consecutive code blocks', () => {
    renderer.write('```\nfirst\n```\n```\nsecond\n```\n');
    const plain = capture.plain();
    expect(plain).toContain('first');
    expect(plain).toContain('second');
  });

  test('handles code block with backticks in content', () => {
    renderer.write('```\nuse `backticks` here\n```\n');
    const plain = capture.plain();
    expect(plain).toContain('use `backticks` here');
  });
});

// Need afterEach import
import { afterEach } from 'vitest';
