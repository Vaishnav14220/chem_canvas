// Template Service - Manages public templates
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
  increment,
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import { getCurrentUserId } from './userService';
import type { Template } from '../../types/database';

// ============================================
// TEMPLATES
// ============================================

/**
 * Get public templates
 */
export const getPublicTemplates = async (
  options: {
    type?: Template['type'];
    tags?: string[];
    limit?: number;
    orderByField?: 'createdAt' | 'usageCount' | 'name';
    orderDirection?: 'asc' | 'desc';
  } = {}
): Promise<Template[]> => {
  const {
    type,
    limit: limitCount = 50,
    orderByField = 'usageCount',
    orderDirection = 'desc',
  } = options;

  try {
    const templatesRef = collection(db, 'templates');
    let q = query(
      templatesRef,
      where('isPublic', '==', true),
      orderBy(orderByField, orderDirection),
      limit(limitCount)
    );

    if (type) {
      q = query(
        templatesRef,
        where('isPublic', '==', true),
        where('type', '==', type),
        orderBy(orderByField, orderDirection),
        limit(limitCount)
      );
    }

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as Template[];
  } catch (error) {
    console.error('Error getting templates:', error);
    throw error;
  }
};

/**
 * Get my templates (created by current user)
 */
export const getMyTemplates = async (
  options: {
    type?: Template['type'];
    limit?: number;
  } = {}
): Promise<Template[]> => {
  const uid = getCurrentUserId();
  if (!uid) throw new Error('User not authenticated');

  const { type, limit: limitCount = 50 } = options;

  try {
    const templatesRef = collection(db, 'templates');
    let q = query(
      templatesRef,
      where('createdBy', '==', uid),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );

    if (type) {
      q = query(
        templatesRef,
        where('createdBy', '==', uid),
        where('type', '==', type),
        orderBy('createdAt', 'desc'),
        limit(limitCount)
      );
    }

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as Template[];
  } catch (error) {
    console.error('Error getting my templates:', error);
    throw error;
  }
};

/**
 * Get a single template by ID
 */
export const getTemplate = async (templateId: string): Promise<Template | null> => {
  try {
    const docRef = doc(db, 'templates', templateId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as Template;
    }
    return null;
  } catch (error) {
    console.error('Error getting template:', error);
    throw error;
  }
};

/**
 * Create a new template
 */
export const createTemplate = async (
  template: Omit<Template, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'usageCount'>
): Promise<Template> => {
  const uid = getCurrentUserId();
  if (!uid) throw new Error('User not authenticated');

  try {
    const templatesRef = collection(db, 'templates');
    const now = serverTimestamp();

    const docRef = await addDoc(templatesRef, {
      ...template,
      createdBy: uid,
      usageCount: 0,
      tags: template.tags || [],
      isPublic: template.isPublic ?? true,
      createdAt: now,
      updatedAt: now,
    });

    const newDoc = await getDoc(docRef);
    return { id: newDoc.id, ...newDoc.data() } as Template;
  } catch (error) {
    console.error('Error creating template:', error);
    throw error;
  }
};

/**
 * Update a template (only owner can update)
 */
export const updateTemplate = async (
  templateId: string,
  updates: Partial<Omit<Template, 'id' | 'createdAt' | 'createdBy'>>
): Promise<void> => {
  const uid = getCurrentUserId();
  if (!uid) throw new Error('User not authenticated');

  try {
    // Verify ownership
    const template = await getTemplate(templateId);
    if (!template) throw new Error('Template not found');
    if (template.createdBy !== uid) throw new Error('Not authorized to update this template');

    const docRef = doc(db, 'templates', templateId);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error updating template:', error);
    throw error;
  }
};

/**
 * Delete a template (only owner can delete)
 */
export const deleteTemplate = async (templateId: string): Promise<void> => {
  const uid = getCurrentUserId();
  if (!uid) throw new Error('User not authenticated');

  try {
    // Verify ownership
    const template = await getTemplate(templateId);
    if (!template) throw new Error('Template not found');
    if (template.createdBy !== uid) throw new Error('Not authorized to delete this template');

    const docRef = doc(db, 'templates', templateId);
    await deleteDoc(docRef);
  } catch (error) {
    console.error('Error deleting template:', error);
    throw error;
  }
};

/**
 * Use a template (increments usage count)
 */
export const useTemplate = async (templateId: string): Promise<Template> => {
  try {
    const template = await getTemplate(templateId);
    if (!template) throw new Error('Template not found');

    // Increment usage count
    const docRef = doc(db, 'templates', templateId);
    await updateDoc(docRef, {
      usageCount: increment(1),
    });

    return template;
  } catch (error) {
    console.error('Error using template:', error);
    throw error;
  }
};

/**
 * Toggle template public/private
 */
export const toggleTemplateVisibility = async (templateId: string): Promise<void> => {
  const template = await getTemplate(templateId);
  if (template) {
    await updateTemplate(templateId, { isPublic: !template.isPublic });
  }
};

// ============================================
// SEARCH
// ============================================

/**
 * Search templates
 */
export const searchTemplates = async (
  searchQuery: string,
  options: { type?: Template['type']; limit?: number } = {}
): Promise<Template[]> => {
  const { type, limit: limitCount = 50 } = options;

  try {
    let templates = await getPublicTemplates({ type, limit: limitCount * 2 });
    const query = searchQuery.toLowerCase();

    return templates.filter(t =>
      t.name.toLowerCase().includes(query) ||
      t.description?.toLowerCase().includes(query) ||
      t.tags?.some(tag => tag.toLowerCase().includes(query))
    ).slice(0, limitCount);
  } catch (error) {
    console.error('Error searching templates:', error);
    throw error;
  }
};

/**
 * Get templates by tag
 */
export const getTemplatesByTag = async (
  tag: string,
  type?: Template['type']
): Promise<Template[]> => {
  try {
    const templatesRef = collection(db, 'templates');
    let q = query(
      templatesRef,
      where('isPublic', '==', true),
      where('tags', 'array-contains', tag),
      orderBy('usageCount', 'desc'),
      limit(50)
    );

    const snapshot = await getDocs(q);
    let templates = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as Template[];

    if (type) {
      templates = templates.filter(t => t.type === type);
    }

    return templates;
  } catch (error) {
    console.error('Error getting templates by tag:', error);
    throw error;
  }
};

/**
 * Get popular templates
 */
export const getPopularTemplates = async (
  type?: Template['type'],
  count: number = 10
): Promise<Template[]> => {
  return getPublicTemplates({
    type,
    limit: count,
    orderByField: 'usageCount',
    orderDirection: 'desc',
  });
};

/**
 * Get recent templates
 */
export const getRecentTemplates = async (
  type?: Template['type'],
  count: number = 10
): Promise<Template[]> => {
  return getPublicTemplates({
    type,
    limit: count,
    orderByField: 'createdAt',
    orderDirection: 'desc',
  });
};

// ============================================
// TEMPLATE CREATION HELPERS
// ============================================

/**
 * Create workspace template from existing workspace
 */
export const createWorkspaceTemplate = async (
  name: string,
  description: string,
  workspaceData: Record<string, any>,
  options: {
    tags?: string[];
    isPublic?: boolean;
    thumbnail?: string;
  } = {}
): Promise<Template> => {
  return createTemplate({
    name,
    description,
    type: 'workspace',
    data: workspaceData,
    tags: options.tags || [],
    isPublic: options.isPublic ?? true,
    thumbnail: options.thumbnail,
  });
};

/**
 * Create document template
 */
export const createDocumentTemplate = async (
  name: string,
  description: string,
  content: string,
  options: {
    tags?: string[];
    isPublic?: boolean;
  } = {}
): Promise<Template> => {
  return createTemplate({
    name,
    description,
    type: 'document',
    data: { content },
    tags: options.tags || [],
    isPublic: options.isPublic ?? true,
  });
};

/**
 * Create simulation template
 */
export const createSimulationTemplate = async (
  name: string,
  description: string,
  simulationData: Record<string, any>,
  options: {
    tags?: string[];
    isPublic?: boolean;
  } = {}
): Promise<Template> => {
  return createTemplate({
    name,
    description,
    type: 'simulation',
    data: simulationData,
    tags: options.tags || [],
    isPublic: options.isPublic ?? true,
  });
};

// ============================================
// STATISTICS
// ============================================

/**
 * Get template statistics for current user
 */
export const getTemplateStats = async (): Promise<{
  totalCreated: number;
  totalUsage: number;
  byType: Record<string, number>;
}> => {
  const templates = await getMyTemplates({ limit: 500 });

  const byType: Record<string, number> = {};
  let totalUsage = 0;

  templates.forEach(t => {
    byType[t.type] = (byType[t.type] || 0) + 1;
    totalUsage += t.usageCount;
  });

  return {
    totalCreated: templates.length,
    totalUsage,
    byType,
  };
};
