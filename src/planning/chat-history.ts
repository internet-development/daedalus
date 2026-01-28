/**
 * Chat History Module
 *
 * Pure TypeScript module for managing chat history with file persistence.
 * Extracted from src/ui/hooks/useChatHistory.ts for use without React.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';

// =============================================================================
// Types
// =============================================================================

export interface ToolCall {
  name: string;
  args?: Record<string, unknown>;
  result?: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  toolCalls?: ToolCall[];
}

export interface ChatSession {
  id: string;
  name: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

export interface ChatHistoryState {
  currentSessionId: string | null;
  sessions: ChatSession[];
}

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_STATE: ChatHistoryState = {
  currentSessionId: null,
  sessions: [],
};

// =============================================================================
// File I/O
// =============================================================================

/**
 * Get the chat history file path.
 * Searches upward for .talos directory, returns path to chat-history.json.
 */
export function getChatHistoryPath(): string {
  let dir = process.cwd();
  while (dir !== '/') {
    const talosDir = join(dir, '.talos');
    if (existsSync(talosDir)) {
      return join(talosDir, 'chat-history.json');
    }
    dir = dirname(dir);
  }
  return join(process.cwd(), '.talos', 'chat-history.json');
}

/**
 * Load chat history from file.
 * Handles legacy formats, returns default state if not found.
 */
export function loadChatHistory(): ChatHistoryState {
  const historyPath = getChatHistoryPath();
  try {
    if (existsSync(historyPath)) {
      const content = readFileSync(historyPath, 'utf-8');
      const parsed = JSON.parse(content);
      // Handle legacy format (just sessions array)
      if (Array.isArray(parsed)) {
        return {
          currentSessionId: parsed[0]?.id ?? null,
          sessions: parsed,
        };
      }
      // Validate structure
      if (parsed && typeof parsed === 'object') {
        return {
          currentSessionId: parsed.currentSessionId ?? null,
          sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
        };
      }
    }
  } catch {
    // File doesn't exist or is invalid
  }
  return { ...DEFAULT_STATE };
}

/**
 * Save chat history to file.
 * Creates directory if needed.
 */
export function saveChatHistory(state: ChatHistoryState): void {
  const historyPath = getChatHistoryPath();
  try {
    const dir = dirname(historyPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(historyPath, JSON.stringify(state, null, 2), 'utf-8');
  } catch (error) {
    console.error('Failed to save chat history:', error);
  }
}

// =============================================================================
// Session ID Generation
// =============================================================================

/**
 * Generate a unique session ID.
 * Format: session-{timestamp}-{random}
 */
export function generateSessionId(): string {
  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// =============================================================================
// Session Operations (immutable - return new state)
// =============================================================================

/**
 * Add a message to the current session.
 * Creates a new session if none exists.
 */
export function addMessage(
  state: ChatHistoryState,
  message: ChatMessage
): ChatHistoryState {
  // If no current session, create one
  if (!state.currentSessionId) {
    const newSessionId = generateSessionId();
    const newSession: ChatSession = {
      id: newSessionId,
      name: `Session ${state.sessions.length + 1}`,
      messages: [message],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    return {
      currentSessionId: newSessionId,
      sessions: [...state.sessions, newSession],
    };
  }

  // Update existing session
  return {
    ...state,
    sessions: state.sessions.map((session) =>
      session.id === state.currentSessionId
        ? {
            ...session,
            messages: [...session.messages, message],
            updatedAt: Date.now(),
          }
        : session
    ),
  };
}

/**
 * Clear messages in the current session.
 */
export function clearMessages(state: ChatHistoryState): ChatHistoryState {
  if (!state.currentSessionId) return state;
  return {
    ...state,
    sessions: state.sessions.map((session) =>
      session.id === state.currentSessionId
        ? {
            ...session,
            messages: [],
            updatedAt: Date.now(),
          }
        : session
    ),
  };
}

/**
 * Switch to a different session.
 */
export function switchSession(
  state: ChatHistoryState,
  sessionId: string
): ChatHistoryState {
  // Verify session exists
  const sessionExists = state.sessions.some((s) => s.id === sessionId);
  if (!sessionExists) return state;
  return {
    ...state,
    currentSessionId: sessionId,
  };
}

/**
 * Create a new session and make it current.
 */
export function createSession(
  state: ChatHistoryState,
  name?: string
): ChatHistoryState {
  const newSessionId = generateSessionId();
  const newSession: ChatSession = {
    id: newSessionId,
    name: name ?? `Session ${state.sessions.length + 1}`,
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  return {
    currentSessionId: newSessionId,
    sessions: [...state.sessions, newSession],
  };
}

/**
 * Delete a session.
 * Switches to another session if deleting the current one.
 */
export function deleteSession(
  state: ChatHistoryState,
  sessionId: string
): ChatHistoryState {
  const newSessions = state.sessions.filter((s) => s.id !== sessionId);
  let newCurrentId = state.currentSessionId;

  // If deleting current session, switch to another
  if (state.currentSessionId === sessionId) {
    newCurrentId = newSessions[0]?.id ?? null;
  }

  return {
    currentSessionId: newCurrentId,
    sessions: newSessions,
  };
}

/**
 * Rename a session (for AI-generated names).
 */
export function renameSession(
  state: ChatHistoryState,
  sessionId: string,
  name: string
): ChatHistoryState {
  return {
    ...state,
    sessions: state.sessions.map((session) =>
      session.id === sessionId
        ? { ...session, name, updatedAt: Date.now() }
        : session
    ),
  };
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Get the current session object.
 */
export function getCurrentSession(
  state: ChatHistoryState
): ChatSession | undefined {
  return state.sessions.find((s) => s.id === state.currentSessionId);
}

/**
 * Get sessions sorted by updatedAt descending (most recent first).
 */
export function getSessionsSortedByDate(
  state: ChatHistoryState
): ChatSession[] {
  return [...state.sessions].sort((a, b) => b.updatedAt - a.updatedAt);
}
