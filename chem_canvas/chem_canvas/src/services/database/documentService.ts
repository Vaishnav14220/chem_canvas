// Document Service - Manages AIWord documents
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
  Document,
  CreateDocument,
  UpdateDocument,
} from '../../types/database';

// ============================================
// DOCUMENTS
// ============================================

/**
 * Get all documents for current user
 */
export const getDocuments = async (
  options: {
    workspaceId?: string;
    tags?: string[];
    isTemplate?: boolean;
    limit?: number;
    orderByField?: 'createdAt' | 'updatedAt' | 'title';
    orderDirection?: 'asc' | 'desc';
  } = {}
): Promise<Document[]> => {
  const uid = getCurrentUserId();
  if (!uid) throw new Error('User not authenticated');

  const {
    workspaceId,
    isTemplate,
    limit: limitCount = 50,
    orderByField = 'updatedAt',
    orderDirection = 'desc',
  } = options;

  try {
    const docsRef = collection(db, 'users', uid, 'documents');
    let q = query(
      docsRef,
      orderBy(orderByField, orderDirection),
      limit(limitCount)
    );

    if (workspaceId) {
      q = query(
        docsRef,
        where('workspaceId', '==', workspaceId),
        orderBy(orderByField, orderDirection),
        limit(limitCount)
      );
    }

    if (isTemplate !== undefined) {
      q = query(
        docsRef,
        where('isTemplate', '==', isTemplate),
        orderBy(orderByField, orderDirection),
        limit(limitCount)
      );
    }

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as Document[];
  } catch (error) {
    console.error('Error getting documents:', error);
    throw error;
  }
};

/**
 * Get a single document by ID
 */
export const getDocument = async (documentId: string): Promise<Document | null> => {
  const uid = getCurrentUserId();
  if (!uid) throw new Error('User not authenticated');

  try {
    const docRef = doc(db, 'users', uid, 'documents', documentId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as Document;
    }
    return null;
  } catch (error) {
    console.error('Error getting document:', error);
    throw error;
  }
};

/**
 * Create a new document
 */
export const createDocument = async (document: CreateDocument): Promise<Document> => {
  const uid = getCurrentUserId();
  if (!uid) throw new Error('User not authenticated');

  try {
    const docsRef = collection(db, 'users', uid, 'documents');
    const now = serverTimestamp();

    // Calculate word count
    const wordCount = document.content
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .split(/\s+/)
      .filter(word => word.length > 0).length;

    const docRef = await addDoc(docsRef, {
      ...document,
      tags: document.tags || [],
      isTemplate: document.isTemplate || false,
      format: document.format || 'markdown',
      wordCount,
      createdAt: now,
      updatedAt: now,
    });

    const newDoc = await getDoc(docRef);
    return { id: newDoc.id, ...newDoc.data() } as Document;
  } catch (error) {
    console.error('Error creating document:', error);
    throw error;
  }
};

/**
 * Update a document
 */
export const updateDocument = async (
  documentId: string,
  updates: UpdateDocument
): Promise<void> => {
  const uid = getCurrentUserId();
  if (!uid) throw new Error('User not authenticated');

  try {
    const docRef = doc(db, 'users', uid, 'documents', documentId);
    
    // Recalculate word count if content changed
    let wordCount: number | undefined;
    if (updates.content) {
      wordCount = updates.content
        .replace(/<[^>]*>/g, '')
        .split(/\s+/)
        .filter(word => word.length > 0).length;
    }

    await updateDoc(docRef, {
      ...updates,
      ...(wordCount !== undefined && { wordCount }),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error updating document:', error);
    throw error;
  }
};

/**
 * Delete a document
 */
export const deleteDocument = async (documentId: string): Promise<void> => {
  const uid = getCurrentUserId();
  if (!uid) throw new Error('User not authenticated');

  try {
    const docRef = doc(db, 'users', uid, 'documents', documentId);
    await deleteDoc(docRef);
  } catch (error) {
    console.error('Error deleting document:', error);
    throw error;
  }
};

/**
 * Duplicate a document
 */
export const duplicateDocument = async (
  documentId: string,
  newTitle?: string
): Promise<Document> => {
  const original = await getDocument(documentId);
  if (!original) throw new Error('Document not found');

  const { id, createdAt, updatedAt, ...documentData } = original;
  
  return createDocument({
    ...documentData,
    title: newTitle || `${original.title} (Copy)`,
    isTemplate: false,
  });
};

/**
 * Save document as template
 */
export const saveAsTemplate = async (
  documentId: string,
  templateName?: string
): Promise<Document> => {
  const original = await getDocument(documentId);
  if (!original) throw new Error('Document not found');

  const { id, createdAt, updatedAt, ...documentData } = original;
  
  return createDocument({
    ...documentData,
    title: templateName || `${original.title} (Template)`,
    isTemplate: true,
  });
};

// ============================================
// AUTO-SAVE
// ============================================

/**
 * Auto-save document with debounce tracking
 * Returns a function to call for auto-saving
 */
export const createAutoSaver = (
  documentId: string,
  debounceMs: number = 2000
): {
  save: (content: string) => void;
  flush: () => Promise<void>;
} => {
  let timeoutId: NodeJS.Timeout | null = null;
  let pendingContent: string | null = null;

  const save = (content: string) => {
    pendingContent = content;

    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(async () => {
      if (pendingContent !== null) {
        try {
          await updateDocument(documentId, { content: pendingContent });
          pendingContent = null;
        } catch (error) {
          console.error('Auto-save failed:', error);
        }
      }
    }, debounceMs);
  };

  const flush = async () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    if (pendingContent !== null) {
      await updateDocument(documentId, { content: pendingContent });
      pendingContent = null;
    }
  };

  return { save, flush };
};

// ============================================
// SEARCH & EXPORT
// ============================================

/**
 * Search documents by title or content
 */
export const searchDocuments = async (searchQuery: string): Promise<Document[]> => {
  const uid = getCurrentUserId();
  if (!uid) throw new Error('User not authenticated');

  try {
    const allDocs = await getDocuments({ limit: 200 });
    const query = searchQuery.toLowerCase();

    return allDocs.filter(doc =>
      doc.title.toLowerCase().includes(query) ||
      doc.content.toLowerCase().includes(query) ||
      doc.tags?.some(tag => tag.toLowerCase().includes(query))
    );
  } catch (error) {
    console.error('Error searching documents:', error);
    throw error;
  }
};

/**
 * Get documents by tag
 */
export const getDocumentsByTag = async (tag: string): Promise<Document[]> => {
  const uid = getCurrentUserId();
  if (!uid) throw new Error('User not authenticated');

  try {
    const docsRef = collection(db, 'users', uid, 'documents');
    const q = query(
      docsRef,
      where('tags', 'array-contains', tag),
      orderBy('updatedAt', 'desc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as Document[];
  } catch (error) {
    console.error('Error getting documents by tag:', error);
    throw error;
  }
};

/**
 * Get all unique tags from documents
 */
export const getDocumentTags = async (): Promise<string[]> => {
  const allDocs = await getDocuments({ limit: 500 });
  const tagSet = new Set<string>();

  allDocs.forEach(doc => {
    doc.tags?.forEach(tag => tagSet.add(tag));
  });

  return Array.from(tagSet).sort();
};

/**
 * Export document as HTML
 */
export const exportDocumentAsHtml = async (documentId: string): Promise<string> => {
  const doc = await getDocument(documentId);
  if (!doc) throw new Error('Document not found');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${doc.title}</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
    h1 { border-bottom: 1px solid #eee; padding-bottom: 10px; }
  </style>
</head>
<body>
  <h1>${doc.title}</h1>
  <div>${doc.format === 'markdown' ? markdownToHtml(doc.content) : doc.content}</div>
</body>
</html>`;
};

/**
 * Simple markdown to HTML converter
 */
const markdownToHtml = (markdown: string): string => {
  return markdown
    .replace(/^### (.*$)/gm, '<h3>$1</h3>')
    .replace(/^## (.*$)/gm, '<h2>$1</h2>')
    .replace(/^# (.*$)/gm, '<h1>$1</h1>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br>');
};

// ============================================
// REAL-TIME LISTENERS
// ============================================

/**
 * Subscribe to document changes
 */
export const subscribeToDocument = (
  documentId: string,
  onUpdate: (document: Document | null) => void
): Unsubscribe => {
  const uid = getCurrentUserId();
  if (!uid) {
    onUpdate(null);
    return () => {};
  }

  const docRef = doc(db, 'users', uid, 'documents', documentId);
  return onSnapshot(docRef, (snapshot) => {
    if (snapshot.exists()) {
      onUpdate({ id: snapshot.id, ...snapshot.data() } as Document);
    } else {
      onUpdate(null);
    }
  });
};

/**
 * Subscribe to documents list
 */
export const subscribeToDocuments = (
  onUpdate: (documents: Document[]) => void,
  options: { limit?: number } = {}
): Unsubscribe => {
  const uid = getCurrentUserId();
  if (!uid) {
    onUpdate([]);
    return () => {};
  }

  const { limit: limitCount = 50 } = options;

  const docsRef = collection(db, 'users', uid, 'documents');
  const q = query(
    docsRef,
    orderBy('updatedAt', 'desc'),
    limit(limitCount)
  );

  return onSnapshot(q, (snapshot) => {
    const documents = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as Document[];
    onUpdate(documents);
  });
};
