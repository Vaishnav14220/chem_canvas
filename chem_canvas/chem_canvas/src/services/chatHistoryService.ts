import { ChatMessage } from '../types';

export interface ChatSession {
  id: string;
  title: string;
  updatedAt: number;
  preview: string;
  messages: ChatMessage[];
}

const STORAGE_KEY = 'gemini_live_chat_history';

export const chatHistoryService = {
  getAllSessions: (): ChatSession[] => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return [];
      const parsed = JSON.parse(stored);
      // Sort by most recent first
      return parsed.sort((a: ChatSession, b: ChatSession) => b.updatedAt - a.updatedAt);
    } catch (error) {
      console.error('Failed to load chat history:', error);
      return [];
    }
  },

  getSession: (id: string): ChatSession | undefined => {
    const sessions = chatHistoryService.getAllSessions();
    return sessions.find(s => s.id === id);
  },

  saveSession: (session: ChatSession): void => {
    const sessions = chatHistoryService.getAllSessions();
    const index = sessions.findIndex(s => s.id === session.id);
    
    if (index >= 0) {
      sessions[index] = { ...session, updatedAt: Date.now() };
    } else {
      sessions.push({ ...session, updatedAt: Date.now() });
    }
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  },

  createNewSession: (): ChatSession => {
    return {
      id: crypto.randomUUID(),
      title: 'New Chat',
      updatedAt: Date.now(),
      preview: '',
      messages: []
    };
  },

  deleteSession: (id: string): void => {
    const sessions = chatHistoryService.getAllSessions().filter(s => s.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  },

  // Helper to generate a title from the first message
  generateTitle: (message: string): string => {
    return message.slice(0, 40) + (message.length > 40 ? '...' : '');
  }
};


