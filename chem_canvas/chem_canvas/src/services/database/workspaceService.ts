// Workspace Service - Manages canvas workspaces, nodes, and edges
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  Timestamp,
  writeBatch,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import { getCurrentUserId } from './userService';
import type {
  Workspace,
  CreateWorkspace,
  UpdateWorkspace,
  CanvasNode,
  CanvasEdge,
} from '../../types/database';

// ============================================
// WORKSPACES
// ============================================

/**
 * Get all workspaces for current user
 */
export const getWorkspaces = async (
  options: {
    includeArchived?: boolean;
    limit?: number;
    orderByField?: 'createdAt' | 'updatedAt' | 'name';
    orderDirection?: 'asc' | 'desc';
  } = {}
): Promise<Workspace[]> => {
  const uid = getCurrentUserId();
  if (!uid) throw new Error('User not authenticated');

  const {
    includeArchived = false,
    limit: limitCount = 50,
    orderByField = 'updatedAt',
    orderDirection = 'desc',
  } = options;

  try {
    const workspacesRef = collection(db, 'users', uid, 'workspaces');
    // Simple query without compound indexes - filter/sort client-side
    const snapshot = await getDocs(workspacesRef);
    let workspaces = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as Workspace[];

    // Filter archived client-side
    if (!includeArchived) {
      workspaces = workspaces.filter(ws => !ws.isArchived);
    }

    // Sort client-side
    workspaces.sort((a, b) => {
      const aVal = a[orderByField] as any;
      const bVal = b[orderByField] as any;
      
      // Handle Timestamp objects
      const aTime = aVal?.toMillis?.() || aVal?.seconds * 1000 || 
        (typeof aVal === 'string' ? new Date(aVal).getTime() : 0);
      const bTime = bVal?.toMillis?.() || bVal?.seconds * 1000 || 
        (typeof bVal === 'string' ? new Date(bVal).getTime() : 0);
      
      return orderDirection === 'desc' ? bTime - aTime : aTime - bTime;
    });

    // Apply limit
    return workspaces.slice(0, limitCount);
  } catch (error) {
    console.error('Error getting workspaces:', error);
    throw error;
  }
};

/**
 * Get a single workspace by ID
 */
export const getWorkspace = async (workspaceId: string): Promise<Workspace | null> => {
  const uid = getCurrentUserId();
  if (!uid) throw new Error('User not authenticated');

  try {
    const docRef = doc(db, 'users', uid, 'workspaces', workspaceId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as Workspace;
    }
    return null;
  } catch (error) {
    console.error('Error getting workspace:', error);
    throw error;
  }
};

/**
 * Helper to remove undefined values from an object
 */
const removeUndefined = (obj: Record<string, any>): Record<string, any> => {
  return Object.fromEntries(
    Object.entries(obj).filter(([_, value]) => value !== undefined)
  );
};

/**
 * Create a new workspace
 */
export const createWorkspace = async (
  workspace: CreateWorkspace
): Promise<Workspace> => {
  const uid = getCurrentUserId();
  if (!uid) throw new Error('User not authenticated');

  try {
    const workspacesRef = collection(db, 'users', uid, 'workspaces');
    const now = serverTimestamp();

    // Build workspace data without undefined values
    const workspaceData: Record<string, any> = {
      name: workspace.name,
      isArchived: false,
      tags: workspace.tags || [],
      settings: workspace.settings || {
        gridEnabled: true,
        snapToGrid: false,
        backgroundColor: '#ffffff',
        gridSize: 20,
      },
      createdAt: now,
      updatedAt: now,
    };

    // Add optional fields only if defined
    if (workspace.description) {
      workspaceData.description = workspace.description;
    }
    if (workspace.thumbnail) {
      workspaceData.thumbnail = workspace.thumbnail;
    }

    const docRef = await addDoc(workspacesRef, workspaceData);

    const newDoc = await getDoc(docRef);
    return { id: newDoc.id, ...newDoc.data() } as Workspace;
  } catch (error) {
    console.error('Error creating workspace:', error);
    throw error;
  }
};

/**
 * Update a workspace
 */
export const updateWorkspace = async (
  workspaceId: string,
  updates: UpdateWorkspace
): Promise<void> => {
  const uid = getCurrentUserId();
  if (!uid) throw new Error('User not authenticated');

  try {
    const docRef = doc(db, 'users', uid, 'workspaces', workspaceId);
    // Filter out undefined values
    const cleanUpdates = removeUndefined({
      ...updates,
      updatedAt: serverTimestamp(),
    });
    await updateDoc(docRef, cleanUpdates);
  } catch (error) {
    console.error('Error updating workspace:', error);
    throw error;
  }
};

/**
 * Delete a workspace and all its nodes/edges
 */
export const deleteWorkspace = async (workspaceId: string): Promise<void> => {
  const uid = getCurrentUserId();
  if (!uid) throw new Error('User not authenticated');

  try {
    const batch = writeBatch(db);

    // Delete all nodes
    const nodesRef = collection(db, 'users', uid, 'workspaces', workspaceId, 'nodes');
    const nodesSnapshot = await getDocs(nodesRef);
    nodesSnapshot.docs.forEach(doc => batch.delete(doc.ref));

    // Delete all edges
    const edgesRef = collection(db, 'users', uid, 'workspaces', workspaceId, 'edges');
    const edgesSnapshot = await getDocs(edgesRef);
    edgesSnapshot.docs.forEach(doc => batch.delete(doc.ref));

    // Delete the workspace
    const workspaceRef = doc(db, 'users', uid, 'workspaces', workspaceId);
    batch.delete(workspaceRef);

    await batch.commit();
  } catch (error) {
    console.error('Error deleting workspace:', error);
    throw error;
  }
};

/**
 * Archive a workspace (soft delete)
 */
export const archiveWorkspace = async (workspaceId: string): Promise<void> => {
  await updateWorkspace(workspaceId, { isArchived: true });
};

/**
 * Restore an archived workspace
 */
export const restoreWorkspace = async (workspaceId: string): Promise<void> => {
  await updateWorkspace(workspaceId, { isArchived: false });
};

/**
 * Duplicate a workspace with all its nodes and edges
 */
export const duplicateWorkspace = async (
  workspaceId: string,
  newName?: string
): Promise<Workspace> => {
  const uid = getCurrentUserId();
  if (!uid) throw new Error('User not authenticated');

  try {
    // Get original workspace
    const original = await getWorkspace(workspaceId);
    if (!original) throw new Error('Workspace not found');

    // Get all nodes and edges
    const nodes = await getNodes(workspaceId);
    const edges = await getEdges(workspaceId);

    // Create new workspace
    const newWorkspace = await createWorkspace({
      name: newName || `${original.name} (Copy)`,
      description: original.description,
      isArchived: false,
      tags: original.tags,
      settings: original.settings,
    });

    // Copy nodes with new IDs
    const nodeIdMap = new Map<string, string>();
    for (const node of nodes) {
      const { id, createdAt, updatedAt, ...nodeData } = node;
      const newNode = await addNode(newWorkspace.id, nodeData);
      nodeIdMap.set(id, newNode.id);
    }

    // Copy edges with updated node references
    for (const edge of edges) {
      const { id, ...edgeData } = edge;
      const newSource = nodeIdMap.get(edge.source) || edge.source;
      const newTarget = nodeIdMap.get(edge.target) || edge.target;
      await addEdge(newWorkspace.id, {
        ...edgeData,
        source: newSource,
        target: newTarget,
      });
    }

    return newWorkspace;
  } catch (error) {
    console.error('Error duplicating workspace:', error);
    throw error;
  }
};

// ============================================
// CANVAS NODES
// ============================================

/**
 * Get all nodes in a workspace
 */
export const getNodes = async (workspaceId: string): Promise<CanvasNode[]> => {
  const uid = getCurrentUserId();
  if (!uid) throw new Error('User not authenticated');

  try {
    const nodesRef = collection(db, 'users', uid, 'workspaces', workspaceId, 'nodes');
    const snapshot = await getDocs(nodesRef);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as CanvasNode[];
  } catch (error) {
    console.error('Error getting nodes:', error);
    throw error;
  }
};

/**
 * Get a single node
 */
export const getNode = async (
  workspaceId: string,
  nodeId: string
): Promise<CanvasNode | null> => {
  const uid = getCurrentUserId();
  if (!uid) throw new Error('User not authenticated');

  try {
    const docRef = doc(db, 'users', uid, 'workspaces', workspaceId, 'nodes', nodeId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as CanvasNode;
    }
    return null;
  } catch (error) {
    console.error('Error getting node:', error);
    throw error;
  }
};

/**
 * Add a node to a workspace
 */
export const addNode = async (
  workspaceId: string,
  node: Omit<CanvasNode, 'id' | 'createdAt' | 'updatedAt'>
): Promise<CanvasNode> => {
  const uid = getCurrentUserId();
  if (!uid) throw new Error('User not authenticated');

  try {
    const nodesRef = collection(db, 'users', uid, 'workspaces', workspaceId, 'nodes');
    const now = serverTimestamp();

    const docRef = await addDoc(nodesRef, {
      ...node,
      createdAt: now,
      updatedAt: now,
    });

    // Update workspace's updatedAt
    await updateWorkspace(workspaceId, {});

    const newDoc = await getDoc(docRef);
    return { id: newDoc.id, ...newDoc.data() } as CanvasNode;
  } catch (error) {
    console.error('Error adding node:', error);
    throw error;
  }
};

/**
 * Update a node
 */
export const updateNode = async (
  workspaceId: string,
  nodeId: string,
  updates: Partial<CanvasNode>
): Promise<void> => {
  const uid = getCurrentUserId();
  if (!uid) throw new Error('User not authenticated');

  try {
    const docRef = doc(db, 'users', uid, 'workspaces', workspaceId, 'nodes', nodeId);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    });

    // Update workspace's updatedAt
    await updateWorkspace(workspaceId, {});
  } catch (error) {
    console.error('Error updating node:', error);
    throw error;
  }
};

/**
 * Delete a node
 */
export const deleteNode = async (
  workspaceId: string,
  nodeId: string
): Promise<void> => {
  const uid = getCurrentUserId();
  if (!uid) throw new Error('User not authenticated');

  try {
    const docRef = doc(db, 'users', uid, 'workspaces', workspaceId, 'nodes', nodeId);
    await deleteDoc(docRef);

    // Also delete any edges connected to this node
    const edges = await getEdges(workspaceId);
    const connectedEdges = edges.filter(e => e.source === nodeId || e.target === nodeId);
    for (const edge of connectedEdges) {
      await deleteEdge(workspaceId, edge.id);
    }

    // Update workspace's updatedAt
    await updateWorkspace(workspaceId, {});
  } catch (error) {
    console.error('Error deleting node:', error);
    throw error;
  }
};

/**
 * Batch update nodes (for drag operations, etc.)
 */
export const batchUpdateNodes = async (
  workspaceId: string,
  updates: Array<{ id: string; updates: Partial<CanvasNode> }>
): Promise<void> => {
  const uid = getCurrentUserId();
  if (!uid) throw new Error('User not authenticated');

  try {
    const batch = writeBatch(db);

    for (const { id, updates: nodeUpdates } of updates) {
      const docRef = doc(db, 'users', uid, 'workspaces', workspaceId, 'nodes', id);
      batch.update(docRef, {
        ...nodeUpdates,
        updatedAt: serverTimestamp(),
      });
    }

    await batch.commit();

    // Update workspace's updatedAt
    await updateWorkspace(workspaceId, {});
  } catch (error) {
    console.error('Error batch updating nodes:', error);
    throw error;
  }
};

// ============================================
// CANVAS EDGES
// ============================================

/**
 * Get all edges in a workspace
 */
export const getEdges = async (workspaceId: string): Promise<CanvasEdge[]> => {
  const uid = getCurrentUserId();
  if (!uid) throw new Error('User not authenticated');

  try {
    const edgesRef = collection(db, 'users', uid, 'workspaces', workspaceId, 'edges');
    const snapshot = await getDocs(edgesRef);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as CanvasEdge[];
  } catch (error) {
    console.error('Error getting edges:', error);
    throw error;
  }
};

/**
 * Add an edge
 */
export const addEdge = async (
  workspaceId: string,
  edge: Omit<CanvasEdge, 'id'>
): Promise<CanvasEdge> => {
  const uid = getCurrentUserId();
  if (!uid) throw new Error('User not authenticated');

  try {
    const edgesRef = collection(db, 'users', uid, 'workspaces', workspaceId, 'edges');
    const docRef = await addDoc(edgesRef, edge);

    // Update workspace's updatedAt
    await updateWorkspace(workspaceId, {});

    const newDoc = await getDoc(docRef);
    return { id: newDoc.id, ...newDoc.data() } as CanvasEdge;
  } catch (error) {
    console.error('Error adding edge:', error);
    throw error;
  }
};

/**
 * Update an edge
 */
export const updateEdge = async (
  workspaceId: string,
  edgeId: string,
  updates: Partial<CanvasEdge>
): Promise<void> => {
  const uid = getCurrentUserId();
  if (!uid) throw new Error('User not authenticated');

  try {
    const docRef = doc(db, 'users', uid, 'workspaces', workspaceId, 'edges', edgeId);
    await updateDoc(docRef, updates);

    // Update workspace's updatedAt
    await updateWorkspace(workspaceId, {});
  } catch (error) {
    console.error('Error updating edge:', error);
    throw error;
  }
};

/**
 * Delete an edge
 */
export const deleteEdge = async (
  workspaceId: string,
  edgeId: string
): Promise<void> => {
  const uid = getCurrentUserId();
  if (!uid) throw new Error('User not authenticated');

  try {
    const docRef = doc(db, 'users', uid, 'workspaces', workspaceId, 'edges', edgeId);
    await deleteDoc(docRef);

    // Update workspace's updatedAt
    await updateWorkspace(workspaceId, {});
  } catch (error) {
    console.error('Error deleting edge:', error);
    throw error;
  }
};

// ============================================
// FULL CANVAS SAVE/LOAD
// ============================================

/**
 * Save entire canvas state (nodes + edges)
 */
export const saveCanvasState = async (
  workspaceId: string,
  nodes: Array<Omit<CanvasNode, 'createdAt' | 'updatedAt'>>,
  edges: CanvasEdge[]
): Promise<void> => {
  const uid = getCurrentUserId();
  if (!uid) throw new Error('User not authenticated');

  console.log('💾 saveCanvasState called with', nodes.length, 'nodes and', edges.length, 'edges');
  console.log('💾 Workspace ID:', workspaceId, 'User ID:', uid);

  try {
    const batch = writeBatch(db);
    const now = serverTimestamp();

    // Clear existing nodes
    console.log('🗑️ Clearing existing nodes...');
    const existingNodes = await getNodes(workspaceId);
    console.log('  Found', existingNodes.length, 'existing nodes to delete');
    for (const node of existingNodes) {
      const docRef = doc(db, 'users', uid, 'workspaces', workspaceId, 'nodes', node.id);
      batch.delete(docRef);
    }

    // Clear existing edges
    console.log('🗑️ Clearing existing edges...');
    const existingEdges = await getEdges(workspaceId);
    console.log('  Found', existingEdges.length, 'existing edges to delete');
    for (const edge of existingEdges) {
      const docRef = doc(db, 'users', uid, 'workspaces', workspaceId, 'edges', edge.id);
      batch.delete(docRef);
    }

    // Add new nodes
    console.log('➕ Adding', nodes.length, 'new nodes...');
    for (const node of nodes) {
      // Check if node data is too large (Firestore limit is ~1MB)
      const nodeSize = JSON.stringify(node).length;
      if (nodeSize > 900000) {
        console.warn('⚠️ Node', node.id, 'is very large:', Math.round(nodeSize / 1024), 'KB - may fail to save');
      }
      
      const docRef = doc(db, 'users', uid, 'workspaces', workspaceId, 'nodes', node.id);
      batch.set(docRef, {
        ...node,
        createdAt: now,
        updatedAt: now,
      });
    }

    // Add new edges
    console.log('➕ Adding', edges.length, 'new edges...');
    for (const edge of edges) {
      const docRef = doc(db, 'users', uid, 'workspaces', workspaceId, 'edges', edge.id);
      batch.set(docRef, edge);
    }

    // Update workspace
    console.log('📝 Updating workspace timestamp...');
    const workspaceRef = doc(db, 'users', uid, 'workspaces', workspaceId);
    batch.update(workspaceRef, { updatedAt: now });

    console.log('📤 Committing batch...');
    await batch.commit();
    console.log('✅ Canvas state saved successfully!');
  } catch (error) {
    console.error('❌ Error saving canvas state:', error);
    throw error;
  }
};

/**
 * Load entire canvas state (nodes + edges)
 */
export const loadCanvasState = async (
  workspaceId: string
): Promise<{ nodes: CanvasNode[]; edges: CanvasEdge[] }> => {
  const [nodes, edges] = await Promise.all([
    getNodes(workspaceId),
    getEdges(workspaceId),
  ]);

  return { nodes, edges };
};

// ============================================
// REAL-TIME LISTENERS
// ============================================

/**
 * Subscribe to workspace changes
 */
export const subscribeToWorkspace = (
  workspaceId: string,
  onUpdate: (workspace: Workspace | null) => void
): Unsubscribe => {
  const uid = getCurrentUserId();
  if (!uid) {
    onUpdate(null);
    return () => {};
  }

  const docRef = doc(db, 'users', uid, 'workspaces', workspaceId);
  return onSnapshot(docRef, (snapshot) => {
    if (snapshot.exists()) {
      onUpdate({ id: snapshot.id, ...snapshot.data() } as Workspace);
    } else {
      onUpdate(null);
    }
  });
};

/**
 * Subscribe to nodes changes (for real-time collaboration)
 */
export const subscribeToNodes = (
  workspaceId: string,
  onUpdate: (nodes: CanvasNode[]) => void
): Unsubscribe => {
  const uid = getCurrentUserId();
  if (!uid) {
    onUpdate([]);
    return () => {};
  }

  const nodesRef = collection(db, 'users', uid, 'workspaces', workspaceId, 'nodes');
  return onSnapshot(nodesRef, (snapshot) => {
    const nodes = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as CanvasNode[];
    onUpdate(nodes);
  });
};

/**
 * Subscribe to edges changes
 */
export const subscribeToEdges = (
  workspaceId: string,
  onUpdate: (edges: CanvasEdge[]) => void
): Unsubscribe => {
  const uid = getCurrentUserId();
  if (!uid) {
    onUpdate([]);
    return () => {};
  }

  const edgesRef = collection(db, 'users', uid, 'workspaces', workspaceId, 'edges');
  return onSnapshot(edgesRef, (snapshot) => {
    const edges = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as CanvasEdge[];
    onUpdate(edges);
  });
};
