// useChatPersistence - Hook to manage AI chat persistence
import { useState, useEffect, useCallback, useRef } from 'react';
import { getCurrentUserId } from '../services/database/userService';
import {
  getChats,
  getChat,
  createChat,
  deleteChat as deleteChatSvc,
  getChatMessages,
  addChatMessage,
  addChatExchange,
  clearChatMessages,
  togglePinChat,
  renameChat,
  searchChats,
  exportChatAsMarkdown,
  subscribeToChats,
  subscribeToChatMessages,
} from '../services/database/chatService';
import type { Chat, ChatMessage, CreateChat } from '../types/database';
import type { AIInteraction, AIToolResponse, InteractionMode } from '../types';
import { logCreate, logView } from '../services/database/activityService';

interface UseChatPersistenceOptions {
  chatType?: Chat['chatType'];
  workspaceId?: string;
  enableRealtime?: boolean;
  onError?: (error: Error) => void;
}

interface UseChatPersistenceReturn {
  // Chats list
  chats: Chat[];
  isLoadingChats: boolean;
  
  // Current chat
  currentChat: Chat | null;
  messages: ChatMessage[];
  isLoadingMessages: boolean;
  
  // Convert to AIInteraction format (for existing components)
  interactions: AIInteraction[];
  
  // Actions
  loadChats: () => Promise<void>;
  loadChat: (chatId: string) => Promise<void>;
  createNewChat: (title?: string, type?: Chat['chatType']) => Promise<Chat>;
  sendMessage: (content: string, role?: 'user' | 'assistant', toolResponses?: AIToolResponse[]) => Promise<ChatMessage>;
  saveExchange: (userMessage: string, assistantMessage: string, toolResponses?: AIToolResponse[]) => Promise<void>;
  deleteCurrentChat: () => Promise<void>;
  clearCurrentChat: () => Promise<void>;
  pinChat: (chatId: string) => Promise<void>;
  renameCurrentChat: (newTitle: string) => Promise<void>;
  searchAllChats: (query: string) => Promise<Chat[]>;
  exportCurrentChat: () => Promise<string>;
  
  // For syncing with existing AIInteraction state
  syncFromInteractions: (interactions: AIInteraction[]) => Promise<void>;
}

export function useChatPersistence(
  options: UseChatPersistenceOptions = {}
): UseChatPersistenceReturn {
  const {
    chatType = 'general',
    workspaceId,
    enableRealtime = false,
    onError,
  } = options;

  // State
  const [chats, setChats] = useState<Chat[]>([]);
  const [currentChat, setCurrentChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoadingChats, setIsLoadingChats] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);

  // Refs for realtime subscriptions
  const chatsUnsubscribeRef = useRef<(() => void) | null>(null);
  const messagesUnsubscribeRef = useRef<(() => void) | null>(null);

  // Convert messages to AIInteraction format
  const interactions: AIInteraction[] = [];
  let currentInteraction: Partial<AIInteraction> | null = null;

  for (const msg of messages) {
    if (msg.role === 'user') {
      // Start a new interaction
      if (currentInteraction && currentInteraction.prompt && currentInteraction.response) {
        interactions.push(currentInteraction as AIInteraction);
      }
      currentInteraction = {
        id: msg.id,
        prompt: msg.content,
        response: '',
        timestamp: msg.timestamp?.toDate?.() || new Date(),
        mode: 'chat' as InteractionMode,
      };
    } else if (msg.role === 'assistant' && currentInteraction) {
      // Complete the interaction
      currentInteraction.response = msg.content;
      currentInteraction.toolResponses = msg.toolCalls
        ?.filter(tc => tc.output)
        .map(tc => tc.output as AIToolResponse) || [];
      
      interactions.push(currentInteraction as AIInteraction);
      currentInteraction = null;
    }
  }

  // Load all chats
  const loadChats = useCallback(async () => {
    const userId = getCurrentUserId();
    if (!userId) return;

    setIsLoadingChats(true);
    try {
      const data = await getChats({ chatType, workspaceId });
      setChats(data);
    } catch (error) {
      console.error('Error loading chats:', error);
      onError?.(error as Error);
    } finally {
      setIsLoadingChats(false);
    }
  }, [chatType, workspaceId, onError]);

  // Load a specific chat and its messages
  const loadChat = useCallback(async (chatId: string) => {
    const userId = getCurrentUserId();
    if (!userId) return;

    setIsLoadingMessages(true);
    try {
      const chat = await getChat(chatId);
      if (!chat) {
        throw new Error('Chat not found');
      }

      setCurrentChat(chat);

      // Load messages
      const chatMessages = await getChatMessages(chatId);
      setMessages(chatMessages);

      // Log activity
      await logView('chat', chatId, chat.title);

      // Setup realtime subscription if enabled
      if (enableRealtime) {
        if (messagesUnsubscribeRef.current) {
          messagesUnsubscribeRef.current();
        }
        messagesUnsubscribeRef.current = subscribeToChatMessages(chatId, setMessages);
      }
    } catch (error) {
      console.error('Error loading chat:', error);
      onError?.(error as Error);
    } finally {
      setIsLoadingMessages(false);
    }
  }, [enableRealtime, onError]);

  // Create a new chat
  const createNewChat = useCallback(async (
    title?: string,
    type?: Chat['chatType']
  ): Promise<Chat> => {
    const userId = getCurrentUserId();
    if (!userId) throw new Error('User not authenticated');

    try {
      // Build chat data without undefined values
      const chatData: any = {
        title: title || `New Chat ${new Date().toLocaleDateString()}`,
        chatType: type || chatType,
        model: 'gemini-pro',
      };
      
      // Only add workspaceId if it's defined
      if (workspaceId) {
        chatData.workspaceId = workspaceId;
      }

      const newChat = await createChat(chatData);

      setChats(prev => [newChat, ...prev]);
      setCurrentChat(newChat);
      setMessages([]);

      // Log activity
      await logCreate('chat', newChat.id, newChat.title);

      return newChat;
    } catch (error) {
      console.error('Error creating chat:', error);
      onError?.(error as Error);
      throw error;
    }
  }, [chatType, workspaceId, onError]);

  // Send a single message
  const sendMessage = useCallback(async (
    content: string,
    role: 'user' | 'assistant' = 'user',
    toolResponses?: AIToolResponse[]
  ): Promise<ChatMessage> => {
    let chatId = currentChat?.id;
    
    if (!chatId) {
      // Create a new chat if none exists
      const newChat = await createNewChat();
      chatId = newChat.id;
    }

    try {
      const message = await addChatMessage(chatId, {
        role,
        content,
        toolCalls: toolResponses?.map(tr => ({
          name: tr.type,
          input: {},
          output: tr,
          status: 'success' as const,
        })),
      });

      setMessages(prev => [...prev, message]);
      return message;
    } catch (error) {
      console.error('Error sending message:', error);
      onError?.(error as Error);
      throw error;
    }
  }, [currentChat, createNewChat, onError]);

  // Save a user + assistant exchange together
  const saveExchange = useCallback(async (
    userMessage: string,
    assistantMessage: string,
    toolResponses?: AIToolResponse[]
  ): Promise<void> => {
    let chatId = currentChat?.id;

    // Create a new chat if none exists
    if (!chatId) {
      const newChat = await createNewChat(userMessage.slice(0, 50));
      chatId = newChat.id;
    }

    try {
      const { userMsg, assistantMsg } = await addChatExchange(
        chatId,
        userMessage,
        assistantMessage,
        {
          toolCalls: toolResponses?.map(tr => ({
            name: tr.type,
            input: {},
            output: tr,
            status: 'success' as const,
          })),
        }
      );

      setMessages(prev => [...prev, userMsg, assistantMsg]);
    } catch (error) {
      console.error('Error saving exchange:', error);
      onError?.(error as Error);
      throw error;
    }
  }, [currentChat, createNewChat, onError]);

  // Delete current chat
  const deleteCurrentChat = useCallback(async () => {
    if (!currentChat) return;

    try {
      await deleteChatSvc(currentChat.id);
      setChats(prev => prev.filter(c => c.id !== currentChat.id));
      setCurrentChat(null);
      setMessages([]);
    } catch (error) {
      console.error('Error deleting chat:', error);
      onError?.(error as Error);
      throw error;
    }
  }, [currentChat, onError]);

  // Clear current chat messages
  const clearCurrentChat = useCallback(async () => {
    if (!currentChat) return;

    try {
      await clearChatMessages(currentChat.id);
      setMessages([]);
    } catch (error) {
      console.error('Error clearing chat:', error);
      onError?.(error as Error);
      throw error;
    }
  }, [currentChat, onError]);

  // Pin/unpin a chat
  const pinChat = useCallback(async (chatId: string) => {
    try {
      await togglePinChat(chatId);
      setChats(prev => prev.map(c => 
        c.id === chatId ? { ...c, isPinned: !c.isPinned } : c
      ));
    } catch (error) {
      console.error('Error pinning chat:', error);
      onError?.(error as Error);
      throw error;
    }
  }, [onError]);

  // Rename current chat
  const renameCurrentChat = useCallback(async (newTitle: string) => {
    if (!currentChat) return;

    try {
      await renameChat(currentChat.id, newTitle);
      setCurrentChat(prev => prev ? { ...prev, title: newTitle } : null);
      setChats(prev => prev.map(c => 
        c.id === currentChat.id ? { ...c, title: newTitle } : c
      ));
    } catch (error) {
      console.error('Error renaming chat:', error);
      onError?.(error as Error);
      throw error;
    }
  }, [currentChat, onError]);

  // Search all chats
  const searchAllChats = useCallback(async (query: string): Promise<Chat[]> => {
    try {
      return await searchChats(query);
    } catch (error) {
      console.error('Error searching chats:', error);
      onError?.(error as Error);
      throw error;
    }
  }, [onError]);

  // Export current chat as markdown
  const exportCurrentChat = useCallback(async (): Promise<string> => {
    if (!currentChat) throw new Error('No chat selected');

    try {
      return await exportChatAsMarkdown(currentChat.id);
    } catch (error) {
      console.error('Error exporting chat:', error);
      onError?.(error as Error);
      throw error;
    }
  }, [currentChat, onError]);

  // Sync from existing AIInteraction array (for migration/compatibility)
  const syncFromInteractions = useCallback(async (
    interactionsToSync: AIInteraction[]
  ): Promise<void> => {
    if (!currentChat || interactionsToSync.length === 0) return;

    try {
      for (const interaction of interactionsToSync) {
        if (interaction.prompt && interaction.response) {
          await addChatExchange(
            currentChat.id,
            interaction.prompt,
            interaction.response,
            {
              toolCalls: interaction.toolResponses?.map(tr => ({
                name: tr.type,
                input: {},
                output: tr,
                status: 'success' as const,
              })),
            }
          );
        }
      }

      // Reload messages
      const updatedMessages = await getChatMessages(currentChat.id);
      setMessages(updatedMessages);
    } catch (error) {
      console.error('Error syncing interactions:', error);
      onError?.(error as Error);
      throw error;
    }
  }, [currentChat, onError]);

  // Setup realtime subscription for chats list
  useEffect(() => {
    if (!enableRealtime) return;

    const userId = getCurrentUserId();
    if (!userId) return;

    chatsUnsubscribeRef.current = subscribeToChats(setChats, { chatType });

    return () => {
      if (chatsUnsubscribeRef.current) {
        chatsUnsubscribeRef.current();
      }
    };
  }, [enableRealtime, chatType]);

  // Cleanup subscriptions on unmount
  useEffect(() => {
    return () => {
      if (chatsUnsubscribeRef.current) {
        chatsUnsubscribeRef.current();
      }
      if (messagesUnsubscribeRef.current) {
        messagesUnsubscribeRef.current();
      }
    };
  }, []);

  // Load chats on mount
  useEffect(() => {
    const userId = getCurrentUserId();
    if (userId) {
      loadChats();
    }
  }, [loadChats]);

  return {
    // Chats list
    chats,
    isLoadingChats,
    
    // Current chat
    currentChat,
    messages,
    isLoadingMessages,
    
    // Convert to AIInteraction format
    interactions,
    
    // Actions
    loadChats,
    loadChat,
    createNewChat,
    sendMessage,
    saveExchange,
    deleteCurrentChat,
    clearCurrentChat,
    pinChat,
    renameCurrentChat,
    searchAllChats,
    exportCurrentChat,
    syncFromInteractions,
  };
}

export default useChatPersistence;
