// useMoleculePersistence - Hook to manage saved molecules library
import { useState, useEffect, useCallback } from 'react';
import { getCurrentUserId } from '../services/database/userService';
import {
  getMolecules,
  getMolecule,
  saveMolecule,
  updateMolecule as updateMoleculeSvc,
  deleteMolecule,
  searchMolecules,
  getFavoriteMolecules,
  toggleMoleculeFavorite,
  addMoleculeTag,
  removeMoleculeTag,
} from '../services/database/moleculeService';
import type { SavedMolecule, CreateMolecule } from '../types/database';
import { logCreate, logDelete, logView } from '../services/database/activityService';

interface UseMoleculePersistenceOptions {
  initialCategory?: string;
  workspaceId?: string;
  onError?: (error: Error) => void;
}

interface UseMoleculePersistenceReturn {
  // Molecules list
  molecules: SavedMolecule[];
  favorites: SavedMolecule[];
  isLoading: boolean;
  
  // Actions
  loadMolecules: (category?: string) => Promise<void>;
  loadFavorites: () => Promise<void>;
  
  saveMoleculeToLibrary: (molecule: CreateMolecule) => Promise<SavedMolecule>;
  updateMolecule: (moleculeId: string, updates: Partial<CreateMolecule>) => Promise<void>;
  removeMolecule: (moleculeId: string) => Promise<void>;
  
  searchMoleculeLibrary: (query: string) => Promise<SavedMolecule[]>;
  filterByCategory: (category: string) => Promise<void>;
  
  toggleFavorite: (moleculeId: string) => Promise<void>;
  addTag: (moleculeId: string, tag: string) => Promise<void>;
  removeTag: (moleculeId: string, tag: string) => Promise<void>;
  
  useMolecule: (moleculeId: string) => Promise<SavedMolecule | null>;
  
  // Quick save helpers for different molecule types
  savePubChemMolecule: (data: any, name?: string, category?: string) => Promise<SavedMolecule>;
  savePDBMolecule: (data: any, name?: string, category?: string) => Promise<SavedMolecule>;
  saveCustomMolecule: (data: any, name: string, category?: string) => Promise<SavedMolecule>;
}

export function useMoleculePersistence(
  options: UseMoleculePersistenceOptions = {}
): UseMoleculePersistenceReturn {
  const {
    initialCategory,
    onError,
  } = options;

  // State
  const [molecules, setMolecules] = useState<SavedMolecule[]>([]);
  const [favorites, setFavorites] = useState<SavedMolecule[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Load all molecules
  const loadMolecules = useCallback(async (category?: string) => {
    const userId = getCurrentUserId();
    if (!userId) return;

    setIsLoading(true);
    try {
      const data = await getMolecules({ category });
      setMolecules(data);
    } catch (error) {
      console.error('Error loading molecules:', error);
      onError?.(error as Error);
    } finally {
      setIsLoading(false);
    }
  }, [onError]);

  // Load favorite molecules
  const loadFavorites = useCallback(async () => {
    const userId = getCurrentUserId();
    if (!userId) return;

    try {
      const data = await getFavoriteMolecules();
      setFavorites(data);
    } catch (error) {
      console.error('Error loading favorites:', error);
      onError?.(error as Error);
    }
  }, [onError]);

  // Save a new molecule
  const saveMoleculeToLibrary = useCallback(async (
    molecule: CreateMolecule
  ): Promise<SavedMolecule> => {
    const userId = getCurrentUserId();
    if (!userId) throw new Error('User not authenticated');

    try {
      const saved = await saveMolecule(molecule);
      setMolecules(prev => [saved, ...prev]);

      // Log activity
      await logCreate('molecule', saved.id, saved.name);

      return saved;
    } catch (error) {
      console.error('Error saving molecule:', error);
      onError?.(error as Error);
      throw error;
    }
  }, [onError]);

  // Update a molecule
  const updateMolecule = useCallback(async (
    moleculeId: string,
    updates: Partial<CreateMolecule>
  ): Promise<void> => {
    try {
      await updateMoleculeSvc(moleculeId, updates);
      setMolecules(prev => prev.map(m => 
        m.id === moleculeId ? { ...m, ...updates } as SavedMolecule : m
      ));
    } catch (error) {
      console.error('Error updating molecule:', error);
      onError?.(error as Error);
      throw error;
    }
  }, [onError]);

  // Remove a molecule
  const removeMolecule = useCallback(async (moleculeId: string): Promise<void> => {
    try {
      const molecule = molecules.find(m => m.id === moleculeId);
      await deleteMolecule(moleculeId);
      setMolecules(prev => prev.filter(m => m.id !== moleculeId));
      setFavorites(prev => prev.filter(m => m.id !== moleculeId));

      // Log activity
      if (molecule) {
        await logDelete('molecule', moleculeId, molecule.name);
      }
    } catch (error) {
      console.error('Error removing molecule:', error);
      onError?.(error as Error);
      throw error;
    }
  }, [molecules, onError]);

  // Search molecules
  const searchMoleculeLibrary = useCallback(async (
    query: string
  ): Promise<SavedMolecule[]> => {
    try {
      return await searchMolecules(query);
    } catch (error) {
      console.error('Error searching molecules:', error);
      onError?.(error as Error);
      throw error;
    }
  }, [onError]);

  // Filter by category
  const filterByCategory = useCallback(async (category: string): Promise<void> => {
    await loadMolecules(category);
  }, [loadMolecules]);

  // Toggle favorite
  const toggleFavorite = useCallback(async (moleculeId: string): Promise<void> => {
    try {
      await toggleMoleculeFavorite(moleculeId);
      
      setMolecules(prev => prev.map(m => 
        m.id === moleculeId ? { ...m, isFavorite: !m.isFavorite } : m
      ));

      // Update favorites list
      const molecule = molecules.find(m => m.id === moleculeId);
      if (molecule) {
        if (molecule.isFavorite) {
          setFavorites(prev => prev.filter(m => m.id !== moleculeId));
        } else {
          setFavorites(prev => [{ ...molecule, isFavorite: true }, ...prev]);
        }
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
      onError?.(error as Error);
      throw error;
    }
  }, [molecules, onError]);

  // Add tag
  const addTag = useCallback(async (
    moleculeId: string,
    tag: string
  ): Promise<void> => {
    try {
      await addMoleculeTag(moleculeId, tag);
      setMolecules(prev => prev.map(m => 
        m.id === moleculeId 
          ? { ...m, tags: [...(m.tags || []), tag] } 
          : m
      ));
    } catch (error) {
      console.error('Error adding tag:', error);
      onError?.(error as Error);
      throw error;
    }
  }, [onError]);

  // Remove tag
  const removeTag = useCallback(async (
    moleculeId: string,
    tag: string
  ): Promise<void> => {
    try {
      await removeMoleculeTag(moleculeId, tag);
      setMolecules(prev => prev.map(m => 
        m.id === moleculeId 
          ? { ...m, tags: (m.tags || []).filter(t => t !== tag) } 
          : m
      ));
    } catch (error) {
      console.error('Error removing tag:', error);
      onError?.(error as Error);
      throw error;
    }
  }, [onError]);

  // Use a molecule (return molecule data and log view)
  const useMolecule = useCallback(async (
    moleculeId: string
  ): Promise<SavedMolecule | null> => {
    try {
      const molecule = await getMolecule(moleculeId);
      
      if (molecule) {
        await logView('molecule', moleculeId, molecule.name);
      }
      
      return molecule;
    } catch (error) {
      console.error('Error using molecule:', error);
      onError?.(error as Error);
      return null;
    }
  }, [onError]);

  // Quick save helper for PubChem molecules
  const savePubChemMolecule = useCallback(async (
    data: any,
    name?: string,
    category?: string
  ): Promise<SavedMolecule> => {
    return saveMoleculeToLibrary({
      name: name || data.name || data.IUPACName || 'PubChem Molecule',
      smiles: data.CanonicalSMILES || data.smiles || '',
      formula: data.MolecularFormula || data.formula,
      molWeight: data.MolecularWeight || data.molecularWeight,
      source: 'pubchem',
      cid: data.CID || data.cid,
      inchiKey: data.InChIKey || data.inchiKey,
      notes: data.description,
      structure3D: data.sdf,
      properties: data,
      category,
      tags: [],
      isFavorite: false,
    });
  }, [saveMoleculeToLibrary]);

  // Quick save helper for PDB molecules
  const savePDBMolecule = useCallback(async (
    data: any,
    name?: string,
    category?: string
  ): Promise<SavedMolecule> => {
    return saveMoleculeToLibrary({
      name: name || data.structureId || data.title || 'PDB Structure',
      smiles: data.smiles || '',
      formula: data.formula,
      source: 'import', // PDB imports
      notes: data.title || data.description,
      structure3D: data.pdbData,
      properties: {
        ...data,
        organism: data.organism,
        classification: data.classification,
        resolution: data.resolution,
      },
      category,
      tags: [],
      isFavorite: false,
    });
  }, [saveMoleculeToLibrary]);

  // Quick save helper for custom/drawn molecules
  const saveCustomMolecule = useCallback(async (
    data: any,
    name: string,
    category?: string
  ): Promise<SavedMolecule> => {
    return saveMoleculeToLibrary({
      name,
      smiles: data.smiles || '',
      formula: data.formula,
      molWeight: data.molecularWeight,
      source: 'user', // Custom user drawn
      notes: data.description,
      structure3D: data.mol,
      imageUrl: data.svg,
      properties: data,
      category,
      tags: [],
      isFavorite: false,
    });
  }, [saveMoleculeToLibrary]);

  // Load molecules on mount
  useEffect(() => {
    const userId = getCurrentUserId();
    if (userId) {
      loadMolecules(initialCategory);
      loadFavorites();
    }
  }, [initialCategory, loadMolecules, loadFavorites]);

  return {
    // Molecules list
    molecules,
    favorites,
    isLoading,
    
    // Actions
    loadMolecules,
    loadFavorites,
    
    saveMoleculeToLibrary,
    updateMolecule,
    removeMolecule,
    
    searchMoleculeLibrary,
    filterByCategory,
    
    toggleFavorite,
    addTag,
    removeTag,
    
    useMolecule,
    
    // Quick save helpers
    savePubChemMolecule,
    savePDBMolecule,
    saveCustomMolecule,
  };
}

export default useMoleculePersistence;
