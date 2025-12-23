// Molecule Service - Manages saved molecules library
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
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import { getCurrentUserId } from './userService';
import type {
  SavedMolecule,
  CreateMolecule,
  UpdateMolecule,
} from '../../types/database';

// ============================================
// MOLECULES
// ============================================

/**
 * Get all saved molecules for current user
 */
export const getMolecules = async (
  options: {
    category?: string;
    isFavorite?: boolean;
    tags?: string[];
    limit?: number;
    orderByField?: 'createdAt' | 'name' | 'molWeight';
    orderDirection?: 'asc' | 'desc';
  } = {}
): Promise<SavedMolecule[]> => {
  const uid = getCurrentUserId();
  if (!uid) throw new Error('User not authenticated');

  const {
    category,
    isFavorite,
    limit: limitCount = 100,
    orderByField = 'createdAt',
    orderDirection = 'desc',
  } = options;

  try {
    const moleculesRef = collection(db, 'users', uid, 'molecules');
    let q = query(
      moleculesRef,
      orderBy(orderByField, orderDirection),
      limit(limitCount)
    );

    if (category) {
      q = query(
        moleculesRef,
        where('category', '==', category),
        orderBy(orderByField, orderDirection),
        limit(limitCount)
      );
    }

    if (isFavorite !== undefined) {
      q = query(
        moleculesRef,
        where('isFavorite', '==', isFavorite),
        orderBy(orderByField, orderDirection),
        limit(limitCount)
      );
    }

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as SavedMolecule[];
  } catch (error) {
    console.error('Error getting molecules:', error);
    throw error;
  }
};

/**
 * Get a single molecule by ID
 */
export const getMolecule = async (moleculeId: string): Promise<SavedMolecule | null> => {
  const uid = getCurrentUserId();
  if (!uid) throw new Error('User not authenticated');

  try {
    const docRef = doc(db, 'users', uid, 'molecules', moleculeId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as SavedMolecule;
    }
    return null;
  } catch (error) {
    console.error('Error getting molecule:', error);
    throw error;
  }
};

/**
 * Get molecule by SMILES (to check if already saved)
 */
export const getMoleculeBySmiles = async (smiles: string): Promise<SavedMolecule | null> => {
  const uid = getCurrentUserId();
  if (!uid) throw new Error('User not authenticated');

  try {
    const moleculesRef = collection(db, 'users', uid, 'molecules');
    const q = query(moleculesRef, where('smiles', '==', smiles), limit(1));
    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
      const doc = snapshot.docs[0];
      return { id: doc.id, ...doc.data() } as SavedMolecule;
    }
    return null;
  } catch (error) {
    console.error('Error getting molecule by SMILES:', error);
    throw error;
  }
};

/**
 * Save a new molecule
 */
export const saveMolecule = async (molecule: CreateMolecule): Promise<SavedMolecule> => {
  const uid = getCurrentUserId();
  if (!uid) throw new Error('User not authenticated');

  try {
    // Check if molecule already exists
    const existing = await getMoleculeBySmiles(molecule.smiles);
    if (existing) {
      throw new Error('Molecule already saved');
    }

    const moleculesRef = collection(db, 'users', uid, 'molecules');
    const docRef = await addDoc(moleculesRef, {
      ...molecule,
      tags: molecule.tags || [],
      isFavorite: molecule.isFavorite || false,
      createdAt: serverTimestamp(),
    });

    const newDoc = await getDoc(docRef);
    return { id: newDoc.id, ...newDoc.data() } as SavedMolecule;
  } catch (error) {
    console.error('Error saving molecule:', error);
    throw error;
  }
};

/**
 * Update a molecule
 */
export const updateMolecule = async (
  moleculeId: string,
  updates: UpdateMolecule
): Promise<void> => {
  const uid = getCurrentUserId();
  if (!uid) throw new Error('User not authenticated');

  try {
    const docRef = doc(db, 'users', uid, 'molecules', moleculeId);
    await updateDoc(docRef, updates);
  } catch (error) {
    console.error('Error updating molecule:', error);
    throw error;
  }
};

/**
 * Delete a molecule
 */
export const deleteMolecule = async (moleculeId: string): Promise<void> => {
  const uid = getCurrentUserId();
  if (!uid) throw new Error('User not authenticated');

  try {
    const docRef = doc(db, 'users', uid, 'molecules', moleculeId);
    await deleteDoc(docRef);
  } catch (error) {
    console.error('Error deleting molecule:', error);
    throw error;
  }
};

/**
 * Toggle favorite status
 */
export const toggleMoleculeFavorite = async (moleculeId: string): Promise<void> => {
  const molecule = await getMolecule(moleculeId);
  if (molecule) {
    await updateMolecule(moleculeId, { isFavorite: !molecule.isFavorite });
  }
};

/**
 * Add tag to molecule
 */
export const addMoleculeTag = async (moleculeId: string, tag: string): Promise<void> => {
  const molecule = await getMolecule(moleculeId);
  if (molecule) {
    const tags = molecule.tags || [];
    if (!tags.includes(tag)) {
      await updateMolecule(moleculeId, { tags: [...tags, tag] });
    }
  }
};

/**
 * Remove tag from molecule
 */
export const removeMoleculeTag = async (moleculeId: string, tag: string): Promise<void> => {
  const molecule = await getMolecule(moleculeId);
  if (molecule) {
    const tags = (molecule.tags || []).filter(t => t !== tag);
    await updateMolecule(moleculeId, { tags });
  }
};

/**
 * Set molecule category
 */
export const setMoleculeCategory = async (
  moleculeId: string,
  category: string
): Promise<void> => {
  await updateMolecule(moleculeId, { category });
};

// ============================================
// SEARCH & FILTER
// ============================================

/**
 * Search molecules by name, formula, or SMILES
 */
export const searchMolecules = async (searchQuery: string): Promise<SavedMolecule[]> => {
  const uid = getCurrentUserId();
  if (!uid) throw new Error('User not authenticated');

  try {
    const allMolecules = await getMolecules({ limit: 500 });
    const query = searchQuery.toLowerCase();

    return allMolecules.filter(mol =>
      mol.name.toLowerCase().includes(query) ||
      mol.smiles.toLowerCase().includes(query) ||
      mol.formula?.toLowerCase().includes(query) ||
      mol.tags?.some(tag => tag.toLowerCase().includes(query))
    );
  } catch (error) {
    console.error('Error searching molecules:', error);
    throw error;
  }
};

/**
 * Get all unique categories
 */
export const getMoleculeCategories = async (): Promise<string[]> => {
  const allMolecules = await getMolecules({ limit: 500 });
  const categorySet = new Set<string>();

  allMolecules.forEach(mol => {
    if (mol.category) categorySet.add(mol.category);
  });

  return Array.from(categorySet).sort();
};

/**
 * Get all unique tags
 */
export const getMoleculeTags = async (): Promise<string[]> => {
  const allMolecules = await getMolecules({ limit: 500 });
  const tagSet = new Set<string>();

  allMolecules.forEach(mol => {
    mol.tags?.forEach(tag => tagSet.add(tag));
  });

  return Array.from(tagSet).sort();
};

/**
 * Get favorite molecules
 */
export const getFavoriteMolecules = async (): Promise<SavedMolecule[]> => {
  return getMolecules({ isFavorite: true });
};

/**
 * Get recent molecules
 */
export const getRecentMolecules = async (count: number = 10): Promise<SavedMolecule[]> => {
  return getMolecules({ limit: count, orderByField: 'createdAt', orderDirection: 'desc' });
};

// ============================================
// IMPORT / EXPORT
// ============================================

/**
 * Export all molecules as JSON
 */
export const exportMolecules = async (): Promise<SavedMolecule[]> => {
  return getMolecules({ limit: 1000 });
};

/**
 * Import molecules from JSON
 */
export const importMolecules = async (
  molecules: CreateMolecule[],
  skipDuplicates: boolean = true
): Promise<{ imported: number; skipped: number }> => {
  let imported = 0;
  let skipped = 0;

  for (const mol of molecules) {
    try {
      if (skipDuplicates) {
        const existing = await getMoleculeBySmiles(mol.smiles);
        if (existing) {
          skipped++;
          continue;
        }
      }
      await saveMolecule(mol);
      imported++;
    } catch (error) {
      skipped++;
    }
  }

  return { imported, skipped };
};

/**
 * Export molecules as SDF (Structure Data Format)
 */
export const exportMoleculesAsSdf = async (): Promise<string> => {
  const molecules = await getMolecules({ limit: 1000 });
  
  let sdf = '';
  for (const mol of molecules) {
    if (mol.structure3D) {
      sdf += mol.structure3D;
      sdf += `\n> <NAME>\n${mol.name}\n\n`;
      sdf += `> <SMILES>\n${mol.smiles}\n\n`;
      if (mol.formula) sdf += `> <FORMULA>\n${mol.formula}\n\n`;
      if (mol.molWeight) sdf += `> <MW>\n${mol.molWeight}\n\n`;
      sdf += '$$$$\n';
    }
  }

  return sdf;
};

// ============================================
// REAL-TIME LISTENERS
// ============================================

/**
 * Subscribe to molecules changes
 */
export const subscribeToMolecules = (
  onUpdate: (molecules: SavedMolecule[]) => void,
  options: { limit?: number; isFavorite?: boolean } = {}
): Unsubscribe => {
  const uid = getCurrentUserId();
  if (!uid) {
    onUpdate([]);
    return () => {};
  }

  const { limit: limitCount = 100, isFavorite } = options;

  const moleculesRef = collection(db, 'users', uid, 'molecules');
  let q = query(
    moleculesRef,
    orderBy('createdAt', 'desc'),
    limit(limitCount)
  );

  if (isFavorite !== undefined) {
    q = query(
      moleculesRef,
      where('isFavorite', '==', isFavorite),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );
  }

  return onSnapshot(q, (snapshot) => {
    const molecules = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as SavedMolecule[];
    onUpdate(molecules);
  });
};
