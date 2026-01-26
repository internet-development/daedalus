/**
 * useChatHistory Hook
 *
 * Manages chat history state with persistence to .talos/chat-history.json.
 * Supports multiple chat sessions.
 */
import { useState, useEffect, useCallback } from 'react';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import type { ChatMessage } from '../components/ChatHistory.js';

// =============================================================================
// Types
// =============================================================================

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

export interface UseChatHistoryResult {
  messages: ChatMessage[];
  addMessage: (message: ChatMessage) => void;
  clearMessages: () => void;
  isLoading: boolean;
  sessions: ChatSession[];
  currentSessionId: string | null;
  switchSession: (sessionId: string) => void;
  createSession: (name?: string) => string;
  deleteSession: (sessionId: string) => void;
}

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_STATE: ChatHistoryState = {
  currentSessionId: null,
  sessions: [],
};

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get the chat history file path.
 */
function getChatHistoryPath(): string {
  // Search for .talos directory starting from cwd
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
 */
function loadChatHistory(): ChatHistoryState {
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
  return DEFAULT_STATE;
}

/**
 * Save chat history to file.
 */
function saveChatHistory(state: ChatHistoryState): void {
  const historyPath = getChatHistoryPath();
  try {
    // Ensure directory exists
    const dir = dirname(historyPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(historyPath, JSON.stringify(state, null, 2), 'utf-8');
  } catch (error) {
    console.error('Failed to save chat history:', error);
  }
}

/**
 * Generate a unique session ID.
 */
function generateSessionId(): string {
  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// =============================================================================
// Hook
// =============================================================================

export function useChatHistory(): UseChatHistoryResult {
  const [state, setState] = useState<ChatHistoryState>(DEFAULT_STATE);
  const [isLoading, setIsLoading] = useState(true);

  // Load history on mount
  useEffect(() => {
    const loaded = loadChatHistory();
    setState(loaded);
    setIsLoading(false);
  }, []);

  // Save history whenever state changes (after initial load)
  useEffect(() => {
    if (!isLoading) {
      saveChatHistory(state);
    }
  }, [state, isLoading]);

  // Get current session
  const currentSession = state.sessions.find(
    (s) => s.id === state.currentSessionId
  );

  // Add a message to the current session
  const addMessage = useCallback((message: ChatMessage) => {
    setState((prev) => {
      // If no current session, create one
      if (!prev.currentSessionId) {
        const newSessionId = generateSessionId();
        const newSession: ChatSession = {
          id: newSessionId,
          name: `Session ${prev.sessions.length + 1}`,
          messages: [message],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        return {
          currentSessionId: newSessionId,
          sessions: [...prev.sessions, newSession],
        };
      }

      // Update existing session
      return {
        ...prev,
        sessions: prev.sessions.map((session) =>
          session.id === prev.currentSessionId
            ? {
                ...session,
                messages: [...session.messages, message],
                updatedAt: Date.now(),
              }
            : session
        ),
      };
    });
  }, []);

  // Clear messages in current session
  const clearMessages = useCallback(() => {
    setState((prev) => {
      if (!prev.currentSessionId) return prev;
      return {
        ...prev,
        sessions: prev.sessions.map((session) =>
          session.id === prev.currentSessionId
            ? {
                ...session,
                messages: [],
                updatedAt: Date.now(),
              }
            : session
        ),
      };
    });
  }, []);

  // Switch to a different session
  const switchSession = useCallback((sessionId: string) => {
    setState((prev) => ({
      ...prev,
      currentSessionId: sessionId,
    }));
  }, []);

  // Create a new session
  const createSession = useCallback((name?: string): string => {
    const newSessionId = generateSessionId();
    setState((prev) => {
      const newSession: ChatSession = {
        id: newSessionId,
        name: name ?? `Session ${prev.sessions.length + 1}`,
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      return {
        currentSessionId: newSessionId,
        sessions: [...prev.sessions, newSession],
      };
    });
    return newSessionId;
  }, []);

  // Delete a session
  const deleteSession = useCallback((sessionId: string) => {
    setState((prev) => {
      const newSessions = prev.sessions.filter((s) => s.id !== sessionId);
      let newCurrentId = prev.currentSessionId;
      
      // If deleting current session, switch to another
      if (prev.currentSessionId === sessionId) {
        newCurrentId = newSessions[0]?.id ?? null;
      }

      return {
        currentSessionId: newCurrentId,
        sessions: newSessions,
      };
    });
  }, []);

  return {
    messages: currentSession?.messages ?? [],
    addMessage,
    clearMessages,
    isLoading,
    sessions: state.sessions,
    currentSessionId: state.currentSessionId,
    switchSession,
    createSession,
    deleteSession,
  };
}

export default useChatHistory;
