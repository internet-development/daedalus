/**
 * Spinner Utilities
 *
 * Terminal spinner animations for the planning CLI.
 * Provides both a general "Thinking..." spinner and tool-specific
 * spinners that show progress during tool execution.
 *
 * See bean daedalus-pjmp.
 */

// =============================================================================
// Spinner Frames
// =============================================================================

/**
 * Spinner frame sets curated from cli-spinners.
 * Reference: https://github.com/sindresorhus/cli-spinners/blob/main/spinners.json
 */
export const SPINNERS = {
  dots: { frames: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'], interval: 80 },
  moon: { frames: ['🌑', '🌒', '🌓', '🌔', '🌕', '🌖', '🌗', '🌘'], interval: 80 },
  clock: { frames: ['🕛', '🕐', '🕑', '🕒', '🕓', '🕔', '🕕', '🕖', '🕗', '🕘', '🕙', '🕚'], interval: 100 },
  earth: { frames: ['🌍', '🌎', '🌏'], interval: 180 },
  arc: { frames: ['◜', '◠', '◝', '◞', '◡', '◟'], interval: 100 },
} as const;

export type SpinnerName = keyof typeof SPINNERS;

// =============================================================================
// ANSI Helpers
// =============================================================================

const CLEAR_LINE = '\r\x1b[K';
const CYAN = '\x1b[36m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

// =============================================================================
// Thinking Spinner
// =============================================================================

export interface Spinner {
  start: () => void;
  stop: () => void;
}

/**
 * Create a "Thinking..." spinner that animates in the terminal.
 * Defaults to the `dots` spinner animation.
 */
export function createSpinner(name: SpinnerName = 'dots'): Spinner {
  const { frames, interval } = SPINNERS[name];
  let frameIndex = 0;
  let intervalId: NodeJS.Timeout | null = null;

  return {
    start() {
      if (intervalId) return;
      process.stdout.write(`${CYAN}${frames[0]}${RESET} Thinking...`);
      intervalId = setInterval(() => {
        frameIndex = (frameIndex + 1) % frames.length;
        process.stdout.write(`\r${CYAN}${frames[frameIndex]}${RESET} Thinking...`);
      }, interval);
    },
    stop() {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
        process.stdout.write(CLEAR_LINE);
      }
    },
  };
}

// =============================================================================
// Tool Call Line Formatting
// =============================================================================

/**
 * Truncate a string to maxLen, adding ellipsis if needed.
 */
function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + '...';
}

/**
 * Format a tool call line with a status indicator.
 *
 * Uses terminal width to dynamically calculate how much of the args string
 * to show, filling the remaining space after the prefix.
 *
 * @param toolName - Display name of the tool (e.g. "Bash", "Read")
 * @param argsStr - Formatted args string (e.g. "git status", "/src/foo.ts")
 * @param indicator - Status indicator character (spinner frame, ✓, or ✗)
 * @returns Formatted line string with ANSI colors
 *
 * @example
 * formatToolCallLine('Bash', 'git status', '⠋')
 * // => "  [Bash] ⠋ git status"
 */
export function formatToolCallLine(
  toolName: string,
  argsStr: string,
  indicator: string
): string {
  const cols = process.stdout.columns || 120;
  // Prefix: "  [ToolName] X " where X is the indicator (1 char)
  // "  " (2) + "[" (1) + toolName + "]" (1) + " " (1) + indicator (1) + " " (1)
  const prefixLen = 2 + 1 + toolName.length + 1 + 1 + 1 + 1;
  const maxArgs = Math.max(20, cols - prefixLen);
  const truncatedArgs = argsStr ? truncate(argsStr, maxArgs) : '';

  const coloredIndicator = indicator === '✓'
    ? `${GREEN}${indicator}${RESET}`
    : indicator === '✗'
      ? `${RED}${indicator}${RESET}`
      : `${CYAN}${indicator}${RESET}`;

  const suffix = truncatedArgs ? ` ${DIM}${truncatedArgs}${RESET}` : '';
  return `  ${YELLOW}[${toolName}]${RESET} ${coloredIndicator}${suffix}`;
}

// =============================================================================
// Tool Spinner
// =============================================================================

export interface ToolSpinner {
  /** Stop the spinner and show success (✓) or error (✗) */
  stop: (success: boolean) => void;
}

/**
 * Create a tool spinner that shows progress during tool execution.
 *
 * Immediately writes the tool name and command with a spinning indicator.
 * Call `stop(success)` when the tool completes to show ✓ or ✗.
 *
 * @param toolName - Display name of the tool (e.g. "Bash", "Read")
 * @param argsStr - Formatted args string (e.g. "git status", "/src/foo.ts")
 * @returns ToolSpinner with a stop() method
 */
export function createToolSpinner(toolName: string, argsStr: string): ToolSpinner {
  const { frames, interval } = SPINNERS.dots;
  let frameIndex = 0;
  let intervalId: NodeJS.Timeout | null = null;
  let stopped = false;

  // Write initial line immediately
  process.stdout.write(formatToolCallLine(toolName, argsStr, frames[0]));

  // Start animation
  intervalId = setInterval(() => {
    frameIndex = (frameIndex + 1) % frames.length;
    process.stdout.write(`\r${formatToolCallLine(toolName, argsStr, frames[frameIndex])}`);
  }, interval);

  return {
    stop(success: boolean) {
      if (stopped) return;
      stopped = true;

      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }

      const indicator = success ? '✓' : '✗';
      process.stdout.write(`\r${formatToolCallLine(toolName, argsStr, indicator)}\n`);
    },
  };
}
