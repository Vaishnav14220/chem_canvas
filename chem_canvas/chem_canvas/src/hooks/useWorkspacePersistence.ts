// useWorkspacePersistence - Hook to manage canvas workspace persistence
import { useState, useEffect, useCallback, useRef } from 'react';
import { getCurrentUserId } from '../services/database/userService';
import {
  getWorkspaces,
  getWorkspace,
  createWorkspace,
  updateWorkspace,
  deleteWorkspace as deleteWorkspaceSvc,
  archiveWorkspace,
  duplicateWorkspace,
  saveCanvasState,
  loadCanvasState,
  subscribeToWorkspace,
} from '../services/database/workspaceService';
import type { Workspace, CanvasNode, CanvasEdge } from '../types/database';
import { logCreate, logDelete, logView } from '../services/database/activityService';

interface UseWorkspacePersistenceOptions {
  autoSaveInterval?: number; // in milliseconds, 0 to disable
  onError?: (error: Error) => void;
}

interface UseWorkspacePersistenceReturn {
  // Workspace list
  workspaces: Workspace[];
  isLoading: boolean;
  
  // Current workspace
  currentWorkspace: Workspace | null;
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  
  // Saving state
  isSaving: boolean;
  lastSaved: Date | null;
  hasUnsavedChanges: boolean;
  
  // For React Flow integration - convert to shapes format
  shapes: any[];
  
  // Actions
  loadWorkspaces: () => Promise<void>;
  loadWorkspace: (workspaceId: string) => Promise<Workspace | null>;
  createNewWorkspace: (name?: string) => Promise<Workspace>;
  saveCurrentWorkspace: (shapesData?: any[]) => Promise<void>;
  deleteCurrentWorkspace: () => Promise<void>;
  archiveCurrentWorkspace: () => Promise<void>;
  duplicateCurrentWorkspace: () => Promise<Workspace>;
  renameWorkspace: (name: string) => Promise<void>;
  
  // Sync helpers
  setShapesFromCanvas: (shapes: any[]) => void;
}

/**
 * Shape to CanvasNode-like object for saving
 * Shapes from Canvas.tsx have: id, type, startX, startY, endX, endY, color, moleculeData, etc.
 */
const shapeToNodeData = (shape: any): any => {
  return {
    id: shape.id,
    type: shape.type || 'custom',
    position: {
      x: shape.startX || shape.x || 0,
      y: shape.startY || shape.y || 0,
    },
    width: Math.abs((shape.endX || 0) - (shape.startX || 0)) || shape.width || 100,
    height: Math.abs((shape.endY || 0) - (shape.startY || 0)) || shape.height || 100,
    data: {
      ...shape,
      moleculeData: shape.moleculeData,
      proteinData: shape.proteinData,
      reactionData: shape.reactionData,
      imageData: shape.imageData,
      text: shape.text,
      color: shape.color,
    },
    style: {
      color: shape.color || '#00FFFF',
      strokeWidth: shape.strokeWidth || 2,
    },
  };
};

/**
 * CanvasNode to Shape conversion for existing Canvas component
 */
const nodeToShape = (node: CanvasNode): any => {
  const data = node.data || {};
  return {
    id: node.id,
    type: node.type,
    startX: node.position?.x || 0,
    startY: node.position?.y || 0,
    endX: (node.position?.x || 0) + (node.width || 100),
    endY: (node.position?.y || 0) + (node.height || 100),
    x: node.position?.x,
    y: node.position?.y,
    width: node.width,
    height: node.height,
    color: node.style?.color || data.color || '#00FFFF',
    strokeWidth: node.style?.strokeWidth || 2,
    // Restore special fields
    moleculeData: data.moleculeData,
    proteinData: data.proteinData,
    reactionData: data.reactionData,
    imageData: data.imageData,
    text: data.text,
    ...data,
  };
};

export function useWorkspacePersistence(
  options: UseWorkspacePersistenceOptions = {}
): UseWorkspacePersistenceReturn {
  const {
    autoSaveInterval = 30000, // 30 seconds default
    onError,
  } = options;

  // State
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);
  const [nodes, setNodes] = useState<CanvasNode[]>([]);
  const [edges, setEdges] = useState<CanvasEdge[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Refs
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingShapesRef = useRef<any[] | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // Convert nodes to shapes format for Canvas component
  const shapes = nodes.map(nodeToShape);

  // Load all workspaces
  const loadWorkspaces = useCallback(async () => {
    const userId = getCurrentUserId();
    if (!userId) return;

    setIsLoading(true);
    try {
      const data = await getWorkspaces();
      setWorkspaces(data);
    } catch (error) {
      console.error('Error loading workspaces:', error);
      onError?.(error as Error);
    } finally {
      setIsLoading(false);
    }
  }, [onError]);

  // Load a specific workspace
  const loadWorkspace = useCallback(async (workspaceId: string): Promise<Workspace | null> => {
    const userId = getCurrentUserId();
    if (!userId) return null;

    setIsLoading(true);
    try {
      const workspace = await getWorkspace(workspaceId);
      if (!workspace) {
        throw new Error('Workspace not found');
      }

      setCurrentWorkspace(workspace);

      // Load canvas state
      const { nodes: loadedNodes, edges: loadedEdges } = await loadCanvasState(workspaceId);
      setNodes(loadedNodes);
      setEdges(loadedEdges);
      setHasUnsavedChanges(false);

      // Log activity
      await logView('workspace', workspaceId, workspace.name);

      return workspace;
    } catch (error) {
      console.error('Error loading workspace:', error);
      onError?.(error as Error);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [onError]);

  // Create a new workspace
  const createNewWorkspace = useCallback(async (name?: string): Promise<Workspace> => {
    const userId = getCurrentUserId();
    if (!userId) throw new Error('User not authenticated');

    try {
      const newWorkspace = await createWorkspace({
        name: name || `Workspace ${workspaces.length + 1}`,
        isArchived: false,
        tags: [],
        settings: {
          gridEnabled: true,
          snapToGrid: false,
          backgroundColor: '#ffffff',
          gridSize: 20,
        },
      });

      setWorkspaces(prev => [newWorkspace, ...prev]);
      setCurrentWorkspace(newWorkspace);
      setNodes([]);
      setEdges([]);
      setHasUnsavedChanges(false);

      // Log activity
      await logCreate('workspace', newWorkspace.id, newWorkspace.name);

      return newWorkspace;
    } catch (error) {
      console.error('Error creating workspace:', error);
      onError?.(error as Error);
      throw error;
    }
  }, [workspaces.length, onError]);

  // Save current workspace
  const saveCurrentWorkspace = useCallback(async (shapesData?: any[]): Promise<void> => {
    if (!currentWorkspace) return;

    setIsSaving(true);
    try {
      // Convert shapes to node data if provided
      const nodesToSave = shapesData 
        ? shapesData.map(shapeToNodeData)
        : nodes;

      await saveCanvasState(currentWorkspace.id, nodesToSave as any, edges);
      
      setNodes(nodesToSave as CanvasNode[]);
      setLastSaved(new Date());
      setHasUnsavedChanges(false);

      // Update workspace updatedAt
      await updateWorkspace(currentWorkspace.id, {});

      // No need to log update for auto-save
    } catch (error) {
      console.error('Error saving workspace:', error);
      onError?.(error as Error);
      throw error;
    } finally {
      setIsSaving(false);
    }
  }, [currentWorkspace, nodes, edges, onError]);

  // Delete current workspace
  const deleteCurrentWorkspace = useCallback(async (): Promise<void> => {
    if (!currentWorkspace) return;

    try {
      const name = currentWorkspace.name;
      const id = currentWorkspace.id;
      
      await deleteWorkspaceSvc(currentWorkspace.id);
      
      setWorkspaces(prev => prev.filter(w => w.id !== id));
      setCurrentWorkspace(null);
      setNodes([]);
      setEdges([]);
      
      // Log activity
      await logDelete('workspace', id, name);
    } catch (error) {
      console.error('Error deleting workspace:', error);
      onError?.(error as Error);
      throw error;
    }
  }, [currentWorkspace, onError]);

  // Archive current workspace
  const archiveCurrentWorkspace = useCallback(async (): Promise<void> => {
    if (!currentWorkspace) return;

    try {
      await archiveWorkspace(currentWorkspace.id);
      
      setWorkspaces(prev => prev.map(w => 
        w.id === currentWorkspace.id ? { ...w, isArchived: true } : w
      ));
      setCurrentWorkspace(prev => prev ? { ...prev, isArchived: true } : null);
    } catch (error) {
      console.error('Error archiving workspace:', error);
      onError?.(error as Error);
      throw error;
    }
  }, [currentWorkspace, onError]);

  // Duplicate current workspace
  const duplicateCurrentWorkspace = useCallback(async (): Promise<Workspace> => {
    if (!currentWorkspace) throw new Error('No workspace selected');

    try {
      const newWorkspace = await duplicateWorkspace(currentWorkspace.id);
      setWorkspaces(prev => [newWorkspace, ...prev]);
      
      // Log activity
      await logCreate('workspace', newWorkspace.id, newWorkspace.name);
      
      return newWorkspace;
    } catch (error) {
      console.error('Error duplicating workspace:', error);
      onError?.(error as Error);
      throw error;
    }
  }, [currentWorkspace, onError]);

  // Rename current workspace
  const renameWorkspace = useCallback(async (name: string): Promise<void> => {
    if (!currentWorkspace) return;

    try {
      await updateWorkspace(currentWorkspace.id, { name });
      
      setCurrentWorkspace(prev => prev ? { ...prev, name } : null);
      setWorkspaces(prev => prev.map(w => 
        w.id === currentWorkspace.id ? { ...w, name } : w
      ));
    } catch (error) {
      console.error('Error renaming workspace:', error);
      onError?.(error as Error);
      throw error;
    }
  }, [currentWorkspace, onError]);

  // Set shapes from canvas (triggers auto-save)
  const setShapesFromCanvas = useCallback((newShapes: any[]) => {
    pendingShapesRef.current = newShapes;
    setHasUnsavedChanges(true);

    // Debounce auto-save
    if (autoSaveInterval > 0) {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
      autoSaveTimeoutRef.current = setTimeout(async () => {
        if (pendingShapesRef.current) {
          await saveCurrentWorkspace(pendingShapesRef.current);
          pendingShapesRef.current = null;
        }
      }, autoSaveInterval);
    }
  }, [autoSaveInterval, saveCurrentWorkspace]);

  // Load workspaces on mount
  useEffect(() => {
    const userId = getCurrentUserId();
    if (userId) {
      loadWorkspaces();
    }
  }, [loadWorkspaces]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, []);

  return {
    // Workspace list
    workspaces,
    isLoading,
    
    // Current workspace
    currentWorkspace,
    nodes,
    edges,
    
    // Saving state
    isSaving,
    lastSaved,
    hasUnsavedChanges,
    
    // Shapes format
    shapes,
    
    // Actions
    loadWorkspaces,
    loadWorkspace,
    createNewWorkspace,
    saveCurrentWorkspace,
    deleteCurrentWorkspace,
    archiveCurrentWorkspace,
    duplicateCurrentWorkspace,
    renameWorkspace,
    setShapesFromCanvas,
  };
}

export default useWorkspacePersistence;
