// Simulation Database Service - Manages saved simulations
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  Timestamp,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import { getCurrentUserId } from './userService';
import type {
  Simulation,
  SimulationType,
  SimulationSnapshot,
  CreateSimulation,
  UpdateSimulation,
} from '../../types/database';

// ============================================
// SIMULATIONS
// ============================================

/**
 * Get all simulations for current user
 */
export const getSimulations = async (
  options: {
    type?: SimulationType;
    workspaceId?: string;
    status?: Simulation['status'];
    limit?: number;
    orderByField?: 'createdAt' | 'updatedAt' | 'name';
    orderDirection?: 'asc' | 'desc';
  } = {}
): Promise<Simulation[]> => {
  const uid = getCurrentUserId();
  if (!uid) throw new Error('User not authenticated');

  const {
    type,
    workspaceId,
    status,
    limit: limitCount = 50,
    orderByField = 'updatedAt',
    orderDirection = 'desc',
  } = options;

  try {
    const simsRef = collection(db, 'users', uid, 'simulations');
    let q = query(
      simsRef,
      orderBy(orderByField, orderDirection),
      limit(limitCount)
    );

    if (type) {
      q = query(
        simsRef,
        where('type', '==', type),
        orderBy(orderByField, orderDirection),
        limit(limitCount)
      );
    }

    if (workspaceId) {
      q = query(
        simsRef,
        where('workspaceId', '==', workspaceId),
        orderBy(orderByField, orderDirection),
        limit(limitCount)
      );
    }

    if (status) {
      q = query(
        simsRef,
        where('status', '==', status),
        orderBy(orderByField, orderDirection),
        limit(limitCount)
      );
    }

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as Simulation[];
  } catch (error) {
    console.error('Error getting simulations:', error);
    throw error;
  }
};

/**
 * Get a single simulation by ID
 */
export const getSimulation = async (simulationId: string): Promise<Simulation | null> => {
  const uid = getCurrentUserId();
  if (!uid) throw new Error('User not authenticated');

  try {
    const docRef = doc(db, 'users', uid, 'simulations', simulationId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as Simulation;
    }
    return null;
  } catch (error) {
    console.error('Error getting simulation:', error);
    throw error;
  }
};

/**
 * Create a new simulation
 */
export const createSimulation = async (simulation: CreateSimulation): Promise<Simulation> => {
  const uid = getCurrentUserId();
  if (!uid) throw new Error('User not authenticated');

  try {
    const simsRef = collection(db, 'users', uid, 'simulations');
    const now = serverTimestamp();

    const docRef = await addDoc(simsRef, {
      ...simulation,
      status: simulation.status || 'draft',
      snapshots: [],
      createdAt: now,
      updatedAt: now,
    });

    const newDoc = await getDoc(docRef);
    return { id: newDoc.id, ...newDoc.data() } as Simulation;
  } catch (error) {
    console.error('Error creating simulation:', error);
    throw error;
  }
};

/**
 * Update a simulation
 */
export const updateSimulation = async (
  simulationId: string,
  updates: UpdateSimulation
): Promise<void> => {
  const uid = getCurrentUserId();
  if (!uid) throw new Error('User not authenticated');

  try {
    const docRef = doc(db, 'users', uid, 'simulations', simulationId);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error updating simulation:', error);
    throw error;
  }
};

/**
 * Delete a simulation
 */
export const deleteSimulation = async (simulationId: string): Promise<void> => {
  const uid = getCurrentUserId();
  if (!uid) throw new Error('User not authenticated');

  try {
    const docRef = doc(db, 'users', uid, 'simulations', simulationId);
    await deleteDoc(docRef);
  } catch (error) {
    console.error('Error deleting simulation:', error);
    throw error;
  }
};

/**
 * Duplicate a simulation
 */
export const duplicateSimulation = async (
  simulationId: string,
  newName?: string
): Promise<Simulation> => {
  const original = await getSimulation(simulationId);
  if (!original) throw new Error('Simulation not found');

  const { id, createdAt, updatedAt, ...simData } = original;

  return createSimulation({
    ...simData,
    name: newName || `${original.name} (Copy)`,
    status: 'draft',
    results: undefined, // Reset results
    snapshots: [], // Reset snapshots
  });
};

// ============================================
// SIMULATION STATE MANAGEMENT
// ============================================

/**
 * Save simulation parameters
 */
export const saveSimulationParameters = async (
  simulationId: string,
  parameters: Record<string, any>
): Promise<void> => {
  await updateSimulation(simulationId, { parameters });
};

/**
 * Save simulation results
 */
export const saveSimulationResults = async (
  simulationId: string,
  results: Record<string, any>
): Promise<void> => {
  await updateSimulation(simulationId, {
    results,
    status: 'completed',
  });
};

/**
 * Update simulation status
 */
export const updateSimulationStatus = async (
  simulationId: string,
  status: Simulation['status']
): Promise<void> => {
  await updateSimulation(simulationId, { status });
};

/**
 * Add a snapshot to simulation
 */
export const addSimulationSnapshot = async (
  simulationId: string,
  state: Record<string, any>,
  label?: string
): Promise<void> => {
  const uid = getCurrentUserId();
  if (!uid) throw new Error('User not authenticated');

  const simulation = await getSimulation(simulationId);
  if (!simulation) throw new Error('Simulation not found');

  const snapshot: SimulationSnapshot = {
    timestamp: Timestamp.now(),
    state,
    label,
  };

  const snapshots = [...(simulation.snapshots || []), snapshot];

  // Keep only last 20 snapshots
  const trimmedSnapshots = snapshots.slice(-20);

  await updateSimulation(simulationId, { snapshots: trimmedSnapshots });
};

/**
 * Get simulation snapshots
 */
export const getSimulationSnapshots = async (
  simulationId: string
): Promise<SimulationSnapshot[]> => {
  const simulation = await getSimulation(simulationId);
  return simulation?.snapshots || [];
};

/**
 * Restore simulation from snapshot
 */
export const restoreSimulationFromSnapshot = async (
  simulationId: string,
  snapshotIndex: number
): Promise<void> => {
  const simulation = await getSimulation(simulationId);
  if (!simulation) throw new Error('Simulation not found');

  const snapshot = simulation.snapshots?.[snapshotIndex];
  if (!snapshot) throw new Error('Snapshot not found');

  await updateSimulation(simulationId, {
    parameters: snapshot.state,
    status: 'draft',
  });
};

// ============================================
// SIMULATION TYPES HELPERS
// ============================================

/**
 * Create a kinetics simulation
 */
export const createKineticsSimulation = async (params: {
  name: string;
  reactants: Array<{ name: string; concentration: number }>;
  products: Array<{ name: string }>;
  rateConstant: number;
  reactionOrder: number;
  temperature?: number;
  workspaceId?: string;
}): Promise<Simulation> => {
  return createSimulation({
    name: params.name,
    type: 'kinetics',
    parameters: {
      reactants: params.reactants,
      products: params.products,
      rateConstant: params.rateConstant,
      reactionOrder: params.reactionOrder,
      temperature: params.temperature || 298,
    },
    workspaceId: params.workspaceId,
    status: 'draft',
  });
};

/**
 * Create an acid-base simulation
 */
export const createAcidBaseSimulation = async (params: {
  name: string;
  acid?: { name: string; concentration: number; pKa: number };
  base?: { name: string; concentration: number; pKb: number };
  volume?: number;
  workspaceId?: string;
}): Promise<Simulation> => {
  return createSimulation({
    name: params.name,
    type: 'acid-base',
    parameters: {
      acid: params.acid,
      base: params.base,
      volume: params.volume || 100,
    },
    workspaceId: params.workspaceId,
    status: 'draft',
  });
};

/**
 * Create an electrochemistry simulation
 */
export const createElectrochemistrySimulation = async (params: {
  name: string;
  anode: { material: string; potential: number };
  cathode: { material: string; potential: number };
  electrolyte: { name: string; concentration: number };
  workspaceId?: string;
}): Promise<Simulation> => {
  return createSimulation({
    name: params.name,
    type: 'electrochemistry',
    parameters: params,
    workspaceId: params.workspaceId,
    status: 'draft',
  });
};

/**
 * Create a thermodynamics simulation
 */
export const createThermodynamicsSimulation = async (params: {
  name: string;
  system: {
    type: 'ideal-gas' | 'real-gas' | 'liquid' | 'solid';
    substance: string;
    amount: number; // moles
  };
  initialState: {
    temperature: number;
    pressure: number;
    volume?: number;
  };
  process: 'isothermal' | 'isobaric' | 'isochoric' | 'adiabatic';
  workspaceId?: string;
}): Promise<Simulation> => {
  return createSimulation({
    name: params.name,
    type: 'thermodynamics',
    parameters: params,
    workspaceId: params.workspaceId,
    status: 'draft',
  });
};

// ============================================
// SEARCH & FILTER
// ============================================

/**
 * Search simulations by name
 */
export const searchSimulations = async (searchQuery: string): Promise<Simulation[]> => {
  const uid = getCurrentUserId();
  if (!uid) throw new Error('User not authenticated');

  try {
    const allSims = await getSimulations({ limit: 200 });
    const query = searchQuery.toLowerCase();

    return allSims.filter(sim =>
      sim.name.toLowerCase().includes(query) ||
      sim.notes?.toLowerCase().includes(query)
    );
  } catch (error) {
    console.error('Error searching simulations:', error);
    throw error;
  }
};

/**
 * Get simulations by type
 */
export const getSimulationsByType = async (type: SimulationType): Promise<Simulation[]> => {
  return getSimulations({ type });
};

/**
 * Get recent simulations
 */
export const getRecentSimulations = async (count: number = 10): Promise<Simulation[]> => {
  return getSimulations({ limit: count, orderByField: 'updatedAt', orderDirection: 'desc' });
};

// ============================================
// REAL-TIME LISTENERS
// ============================================

/**
 * Subscribe to simulation changes
 */
export const subscribeToSimulation = (
  simulationId: string,
  onUpdate: (simulation: Simulation | null) => void
): Unsubscribe => {
  const uid = getCurrentUserId();
  if (!uid) {
    onUpdate(null);
    return () => {};
  }

  const docRef = doc(db, 'users', uid, 'simulations', simulationId);
  return onSnapshot(docRef, (snapshot) => {
    if (snapshot.exists()) {
      onUpdate({ id: snapshot.id, ...snapshot.data() } as Simulation);
    } else {
      onUpdate(null);
    }
  });
};

/**
 * Subscribe to simulations list
 */
export const subscribeToSimulations = (
  onUpdate: (simulations: Simulation[]) => void,
  options: { type?: SimulationType; limit?: number } = {}
): Unsubscribe => {
  const uid = getCurrentUserId();
  if (!uid) {
    onUpdate([]);
    return () => {};
  }

  const { type, limit: limitCount = 50 } = options;

  const simsRef = collection(db, 'users', uid, 'simulations');
  let q = query(
    simsRef,
    orderBy('updatedAt', 'desc'),
    limit(limitCount)
  );

  if (type) {
    q = query(
      simsRef,
      where('type', '==', type),
      orderBy('updatedAt', 'desc'),
      limit(limitCount)
    );
  }

  return onSnapshot(q, (snapshot) => {
    const simulations = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as Simulation[];
    onUpdate(simulations);
  });
};
