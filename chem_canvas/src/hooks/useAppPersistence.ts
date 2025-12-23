// useAppPersistence - Main integration hook for database persistence in App.tsx
import { useState, useEffect, useCallback, useRef } from 'react';
import { useChatPersistence } from './useChatPersistence';
import { useWorkspacePersistence } from './useWorkspacePersistence';
import { useMoleculePersistence } from './useMoleculePersistence';
import { useAuth } from './useAuth';
import { getCurrentUserId } from '../services/database/userService';
import type { AIInteraction, InteractionMode, AIToolResponse } from '../types';
import type { Chat } from '../types/database';

interface CanvasWorkspace {
  id: string;
  title: string;
}

interface UseAppPersistenceOptions {
  autoSaveInterval?: number; // in milliseconds
  enableRealtime?: boolean;
  onError?: (error: Error) => void;
}

interface UseAppPersistenceReturn {
  // Auth state
  isAuthenticated: boolean;
  userId: string | null;
  
  // Chat persistence
  interactions: AIInteraction[];
  currentChatId: string | null;
  chatHistory: Chat[];
  isLoadingChat: boolean;
  saveInteraction: (userMessage: string, assistantMessage: string, mode: InteractionMode, toolResponses?: AIToolResponse[]) => Promise<void>;
  loadChatHistory: () => Promise<void>;
  loadChat: (chatId: string) => Promise<void>;
  createNewChat: (title?: string) => Promise<void>;
  deleteChat: (chatId: string) => Promise<void>;
  clearChat: () => Promise<void>;
  
  // Workspace persistence  
  workspaces: CanvasWorkspace[];
  activeWorkspaceId: string | null;
  isLoadingWorkspaces: boolean;
  isSaving: boolean;
  lastSaved: Date | null;
  loadWorkspaces: () => Promise<void>;
  loadWorkspaceData: (workspaceId: string) => Promise<any>;
  saveWorkspace: (workspaceId: string, data: any) => Promise<void>;
  createWorkspace: (title?: string) => Promise<CanvasWorkspace>;
  deleteWorkspace: (workspaceId: string) => Promise<void>;
  setActiveWorkspace: (workspaceId: string) => void;
  
  // Molecule persistence
  savedMolecules: any[];
  favoriteMolecules: any[];
  saveMolecule: (data: any, name: string, source: 'pubchem' | 'pdb' | 'custom') => Promise<void>;
  loadMoleculeLibrary: () => Promise<void>;
  
  // Sync utilities
  syncFromLocalState: (interactions: AIInteraction[], shapes?: any[]) => Promise<void>;
  isDataLoaded: boolean;
}

/**
 * Main integration hook that ties all persistence together for App.tsx
 * 
 * Usage in App.tsx:
 * ```tsx
 * const {
 *   interactions,
 *   saveInteraction,
 *   workspaces,
 *   saveWorkspace,
 *   // ... etc
 * } = useAppPersistence();
 * ```
 */
export function useAppPersistence(
  options: UseAppPersistenceOptions = {}
): UseAppPersistenceReturn {
  const {
    autoSaveInterval = 30000, // 30 seconds default
    enableRealtime = false,
    onError,
  } = options;

  // Auth hook
  const auth = useAuth();
  
  // Chat persistence hook
  const chatPersistence = useChatPersistence({
    chatType: 'general',
    enableRealtime,
    onError,
  });
  
  // Workspace persistence hook
  const workspacePersistence = useWorkspacePersistence({
    autoSaveInterval,
    onError,
  });
  
  // Molecule persistence hook
  const moleculePersistence = useMoleculePersistence({
    onError,
  });

  // Local state for tracking
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const pendingSaveRef = useRef<NodeJS.Timeout | null>(null);

  // Get user ID
  const userId = getCurrentUserId();
  const isAuthenticated = !!userId;

  // Convert internal workspace format
  const workspaces: CanvasWorkspace[] = workspacePersistence.workspaces.map(ws => ({
    id: ws.id,
    title: ws.name,
  }));

  // Save an interaction (called after each AI response)
  const saveInteraction = useCallback(async (
    userMessage: string,
    assistantMessage: string,
    mode: InteractionMode,
    toolResponses?: AIToolResponse[]
  ): Promise<void> => {
    if (!isAuthenticated) return;
    
    try {
      await chatPersistence.saveExchange(userMessage, assistantMessage, toolResponses);
    } catch (error) {
      console.error('Error saving interaction:', error);
      onError?.(error as Error);
    }
  }, [isAuthenticated, chatPersistence, onError]);

  // Load chat history list
  const loadChatHistory = useCallback(async (): Promise<void> => {
    if (!isAuthenticated) return;
    await chatPersistence.loadChats();
  }, [isAuthenticated, chatPersistence]);

  // Load a specific chat
  const loadChat = useCallback(async (chatId: string): Promise<void> => {
    if (!isAuthenticated) return;
    await chatPersistence.loadChat(chatId);
  }, [isAuthenticated, chatPersistence]);

  // Create a new chat
  const createNewChat = useCallback(async (title?: string): Promise<void> => {
    if (!isAuthenticated) return;
    await chatPersistence.createNewChat(title);
  }, [isAuthenticated, chatPersistence]);

  // Delete a chat
  const deleteChat = useCallback(async (chatId: string): Promise<void> => {
    if (!isAuthenticated) return;
    
    // If deleting current chat, clear it first
    if (chatPersistence.currentChat?.id === chatId) {
      await chatPersistence.deleteCurrentChat();
    } else {
      // Load and delete
      await chatPersistence.loadChat(chatId);
      await chatPersistence.deleteCurrentChat();
    }
  }, [isAuthenticated, chatPersistence]);

  // Clear current chat
  const clearChat = useCallback(async (): Promise<void> => {
    if (!isAuthenticated) return;
    await chatPersistence.clearCurrentChat();
  }, [isAuthenticated, chatPersistence]);

  // Load all workspaces
  const loadWorkspaces = useCallback(async (): Promise<void> => {
    if (!isAuthenticated) return;
    await workspacePersistence.loadWorkspaces();
  }, [isAuthenticated, workspacePersistence]);

  // Load workspace data (shapes, nodes, edges)
  const loadWorkspaceData = useCallback(async (workspaceId: string): Promise<any> => {
    if (!isAuthenticated) return null;
    
    const workspace = await workspacePersistence.loadWorkspace(workspaceId);
    return workspacePersistence.shapes || [];
  }, [isAuthenticated, workspacePersistence]);

  // Save workspace data
  const saveWorkspace = useCallback(async (
    workspaceId: string, 
    data: any
  ): Promise<void> => {
    if (!isAuthenticated) return;
    
    // Debounce saves
    if (pendingSaveRef.current) {
      clearTimeout(pendingSaveRef.current);
    }
    
    pendingSaveRef.current = setTimeout(async () => {
      try {
        await workspacePersistence.saveCurrentWorkspace(data);
      } catch (error) {
        console.error('Error saving workspace:', error);
        onError?.(error as Error);
      }
    }, 1000); // 1 second debounce
  }, [isAuthenticated, workspacePersistence, onError]);

  // Create a new workspace
  const createWorkspace = useCallback(async (title?: string): Promise<CanvasWorkspace> => {
    if (!isAuthenticated) {
      throw new Error('User not authenticated');
    }
    
    const newWorkspace = await workspacePersistence.createNewWorkspace(title);
    return {
      id: newWorkspace.id,
      title: newWorkspace.name,
    };
  }, [isAuthenticated, workspacePersistence]);

  // Delete a workspace
  const deleteWorkspace = useCallback(async (workspaceId: string): Promise<void> => {
    if (!isAuthenticated) return;
    
    // Load the workspace first if needed
    if (workspacePersistence.currentWorkspace?.id !== workspaceId) {
      await workspacePersistence.loadWorkspace(workspaceId);
    }
    await workspacePersistence.deleteCurrentWorkspace();
  }, [isAuthenticated, workspacePersistence]);

  // Set active workspace
  const setActiveWorkspace = useCallback((workspaceId: string): void => {
    // This triggers loading the workspace
    workspacePersistence.loadWorkspace(workspaceId);
  }, [workspacePersistence]);

  // Save a molecule to library
  const saveMolecule = useCallback(async (
    data: any, 
    name: string, 
    source: 'pubchem' | 'pdb' | 'custom'
  ): Promise<void> => {
    if (!isAuthenticated) return;
    
    try {
      switch (source) {
        case 'pubchem':
          await moleculePersistence.savePubChemMolecule(data, name);
          break;
        case 'pdb':
          await moleculePersistence.savePDBMolecule(data, name);
          break;
        case 'custom':
          await moleculePersistence.saveCustomMolecule(data, name);
          break;
      }
    } catch (error) {
      console.error('Error saving molecule:', error);
      onError?.(error as Error);
    }
  }, [isAuthenticated, moleculePersistence, onError]);

  // Load molecule library
  const loadMoleculeLibrary = useCallback(async (): Promise<void> => {
    if (!isAuthenticated) return;
    await moleculePersistence.loadMolecules();
    await moleculePersistence.loadFavorites();
  }, [isAuthenticated, moleculePersistence]);

  // Sync from local state (for migration or backup)
  const syncFromLocalState = useCallback(async (
    localInteractions: AIInteraction[],
    shapes?: any[]
  ): Promise<void> => {
    if (!isAuthenticated) return;
    
    try {
      // Sync interactions to current chat
      if (localInteractions.length > 0) {
        await chatPersistence.syncFromInteractions(localInteractions);
      }
      
      // Sync shapes to current workspace
      if (shapes && shapes.length > 0 && workspacePersistence.currentWorkspace) {
        await workspacePersistence.saveCurrentWorkspace(shapes);
      }
    } catch (error) {
      console.error('Error syncing local state:', error);
      onError?.(error as Error);
    }
  }, [isAuthenticated, chatPersistence, workspacePersistence, onError]);

  // Initial data load when authenticated
  useEffect(() => {
    if (isAuthenticated && !isDataLoaded) {
      const loadInitialData = async () => {
        try {
          await Promise.all([
            loadChatHistory(),
            loadWorkspaces(),
            loadMoleculeLibrary(),
          ]);
          setIsDataLoaded(true);
        } catch (error) {
          console.error('Error loading initial data:', error);
          onError?.(error as Error);
        }
      };
      
      loadInitialData();
    }
  }, [isAuthenticated, isDataLoaded, loadChatHistory, loadWorkspaces, loadMoleculeLibrary, onError]);

  // Cleanup pending saves on unmount
  useEffect(() => {
    return () => {
      if (pendingSaveRef.current) {
        clearTimeout(pendingSaveRef.current);
      }
    };
  }, []);

  return {
    // Auth state
    isAuthenticated,
    userId,
    
    // Chat persistence
    interactions: chatPersistence.interactions,
    currentChatId: chatPersistence.currentChat?.id || null,
    chatHistory: chatPersistence.chats,
    isLoadingChat: chatPersistence.isLoadingMessages,
    saveInteraction,
    loadChatHistory,
    loadChat,
    createNewChat,
    deleteChat,
    clearChat,
    
    // Workspace persistence
    workspaces,
    activeWorkspaceId: workspacePersistence.currentWorkspace?.id || null,
    isLoadingWorkspaces: workspacePersistence.isLoading,
    isSaving: workspacePersistence.isSaving,
    lastSaved: workspacePersistence.lastSaved,
    loadWorkspaces,
    loadWorkspaceData,
    saveWorkspace,
    createWorkspace,
    deleteWorkspace,
    setActiveWorkspace,
    
    // Molecule persistence
    savedMolecules: moleculePersistence.molecules,
    favoriteMolecules: moleculePersistence.favorites,
    saveMolecule,
    loadMoleculeLibrary,
    
    // Sync utilities
    syncFromLocalState,
    isDataLoaded,
  };
}

export default useAppPersistence;
