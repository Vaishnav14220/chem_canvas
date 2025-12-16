/**
 * Immersive Learning Service
 * Manages immersive learning workspaces and files in Firebase
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from '../../firebase/config';
import { getCurrentUserId } from './userService';

// Types for Immersive Learning Workspace
export interface ImmersiveLearningWorkspace {
  id: string;
  name: string;
  description: string;
  createdAt: number | Timestamp;
  updatedAt: number | Timestamp;
  thumbnailEmoji: string;
  documentFileName: string;
  documentText: string;
  immersiveContent: any | null; // ImmersiveContent type
  sectionImages: { [key: string]: string };
  widgetImages: { [key: string]: { before: string; after: string } };
  quiz: any[]; // QuizQuestion[]
  audioScript: string | null;
  reactFlowData: any | null; // ReactFlowData
  relevantVideos: any[]; // RankedYouTubeVideo[]
  pdfUrl: string | null;
  activeSectionId: string | null;
  // File references stored in Firebase Storage
  documentFileUrl?: string | null;
  documentFileStoragePath?: string | null;
}

export interface UserSpace {
  id: string;
  mode: string; // LearningMode
  name: string;
  description: string;
  emoji: string;
  workspaceId: string | null;
  lastUsed: number;
  usageCount: number;
  thumbnailUrl?: string;
}

// ============================================
// WORKSPACES
// ============================================

/**
 * Get all immersive learning workspaces for current user
 */
export const getImmersiveLearningWorkspaces = async (): Promise<ImmersiveLearningWorkspace[]> => {
  const uid = getCurrentUserId();
  if (!uid) throw new Error('User not authenticated');

  try {
    const workspacesRef = collection(db, 'users', uid, 'immersiveLearningWorkspaces');
    const snapshot = await getDocs(query(workspacesRef, orderBy('updatedAt', 'desc')));
    
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toMillis?.() || data.createdAt || Date.now(),
        updatedAt: data.updatedAt?.toMillis?.() || data.updatedAt || Date.now(),
      } as ImmersiveLearningWorkspace;
    });
  } catch (error) {
    console.error('Error getting immersive learning workspaces:', error);
    throw error;
  }
};

/**
 * Get a single immersive learning workspace by ID
 */
export const getImmersiveLearningWorkspace = async (
  workspaceId: string
): Promise<ImmersiveLearningWorkspace | null> => {
  const uid = getCurrentUserId();
  if (!uid) throw new Error('User not authenticated');

  try {
    const docRef = doc(db, 'users', uid, 'immersiveLearningWorkspaces', workspaceId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        ...data,
        createdAt: data.createdAt?.toMillis?.() || data.createdAt || Date.now(),
        updatedAt: data.updatedAt?.toMillis?.() || data.updatedAt || Date.now(),
      } as ImmersiveLearningWorkspace;
    }
    return null;
  } catch (error) {
    console.error('Error getting immersive learning workspace:', error);
    throw error;
  }
};

/**
 * Create a new immersive learning workspace
 */
export const createImmersiveLearningWorkspace = async (
  workspace: Omit<ImmersiveLearningWorkspace, 'id' | 'createdAt' | 'updatedAt'>
): Promise<ImmersiveLearningWorkspace> => {
  const uid = getCurrentUserId();
  if (!uid) throw new Error('User not authenticated');

  try {
    const workspacesRef = collection(db, 'users', uid, 'immersiveLearningWorkspaces');
    const now = serverTimestamp();

    const docRef = await addDoc(workspacesRef, {
      ...workspace,
      createdAt: now,
      updatedAt: now,
    });

    const newDoc = await getDoc(docRef);
    const data = newDoc.data();
    return {
      id: newDoc.id,
      ...data,
      createdAt: data?.createdAt?.toMillis?.() || Date.now(),
      updatedAt: data?.updatedAt?.toMillis?.() || Date.now(),
    } as ImmersiveLearningWorkspace;
  } catch (error) {
    console.error('Error creating immersive learning workspace:', error);
    throw error;
  }
};

/**
 * Update an immersive learning workspace
 */
export const updateImmersiveLearningWorkspace = async (
  workspaceId: string,
  updates: Partial<ImmersiveLearningWorkspace>
): Promise<void> => {
  const uid = getCurrentUserId();
  if (!uid) throw new Error('User not authenticated');

  try {
    const docRef = doc(db, 'users', uid, 'immersiveLearningWorkspaces', workspaceId);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error updating immersive learning workspace:', error);
    throw error;
  }
};

/**
 * Delete an immersive learning workspace
 */
export const deleteImmersiveLearningWorkspace = async (workspaceId: string): Promise<void> => {
  const uid = getCurrentUserId();
  if (!uid) throw new Error('User not authenticated');

  try {
    // Get workspace to check for associated files
    const workspace = await getImmersiveLearningWorkspace(workspaceId);
    
    // Delete associated files from Storage
    if (workspace?.documentFileStoragePath) {
      try {
        const storageRef = ref(storage, workspace.documentFileStoragePath);
        await deleteObject(storageRef);
      } catch (error) {
        console.warn('Error deleting workspace file from storage:', error);
      }
    }

    // Delete workspace document
    const docRef = doc(db, 'users', uid, 'immersiveLearningWorkspaces', workspaceId);
    await deleteDoc(docRef);
  } catch (error) {
    console.error('Error deleting immersive learning workspace:', error);
    throw error;
  }
};

// ============================================
// USER SPACES
// ============================================

/**
 * Get all user spaces for current user
 */
export const getUserSpaces = async (): Promise<UserSpace[]> => {
  const uid = getCurrentUserId();
  if (!uid) throw new Error('User not authenticated');

  try {
    const spacesRef = collection(db, 'users', uid, 'immersiveLearningSpaces');
    const snapshot = await getDocs(query(spacesRef, orderBy('lastUsed', 'desc')));
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as UserSpace[];
  } catch (error) {
    console.error('Error getting user spaces:', error);
    throw error;
  }
};

/**
 * Create or update a user space
 */
export const saveUserSpace = async (space: Omit<UserSpace, 'id'>): Promise<UserSpace> => {
  const uid = getCurrentUserId();
  if (!uid) throw new Error('User not authenticated');

  try {
    const spacesRef = collection(db, 'users', uid, 'immersiveLearningSpaces');
    const docRef = await addDoc(spacesRef, space);

    const newDoc = await getDoc(docRef);
    return {
      id: newDoc.id,
      ...newDoc.data(),
    } as UserSpace;
  } catch (error) {
    console.error('Error saving user space:', error);
    throw error;
  }
};

/**
 * Update a user space
 */
export const updateUserSpace = async (
  spaceId: string,
  updates: Partial<UserSpace>
): Promise<void> => {
  const uid = getCurrentUserId();
  if (!uid) throw new Error('User not authenticated');

  try {
    const docRef = doc(db, 'users', uid, 'immersiveLearningSpaces', spaceId);
    await updateDoc(docRef, updates);
  } catch (error) {
    console.error('Error updating user space:', error);
    throw error;
  }
};

/**
 * Delete a user space
 */
export const deleteUserSpace = async (spaceId: string): Promise<void> => {
  const uid = getCurrentUserId();
  if (!uid) throw new Error('User not authenticated');

  try {
    const docRef = doc(db, 'users', uid, 'immersiveLearningSpaces', spaceId);
    await deleteDoc(docRef);
  } catch (error) {
    console.error('Error deleting user space:', error);
    throw error;
  }
};

// ============================================
// FILE UPLOADS
// ============================================

/**
 * Upload a file for immersive learning workspace
 * Includes fallback for certificate errors
 */
export const uploadImmersiveLearningFile = async (
  file: File,
  workspaceId?: string
): Promise<{ url: string; storagePath: string; isFallback?: boolean }> => {
  const uid = getCurrentUserId();
  if (!uid) throw new Error('User not authenticated');

  const timestamp = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const storagePath = workspaceId
    ? `users/${uid}/immersiveLearning/${workspaceId}/files/${timestamp}_${safeName}`
    : `users/${uid}/immersiveLearning/files/${timestamp}_${safeName}`;
  
  // Try Firebase Storage upload with retry logic
  const maxRetries = 2;
  let lastError: Error | null = null;
  let hasNetworkError = false;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const storageRef = ref(storage, storagePath);
      
      const metadata = {
        contentType: file.type,
        customMetadata: {
          originalName: file.name,
          workspaceId: workspaceId || '',
          uploadedAt: new Date().toISOString(),
        },
      };

      // Set a timeout to detect hanging requests
      const uploadPromise = uploadBytes(storageRef, file, metadata);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Upload timeout')), 30000)
      );
      
      await Promise.race([uploadPromise, timeoutPromise]);
      const downloadUrl = await getDownloadURL(storageRef);

      console.log('✅ File uploaded successfully to Firebase Storage');
      return {
        url: downloadUrl,
        storagePath,
        isFallback: false,
      };
    } catch (error: any) {
      hasNetworkError = true;
      lastError = error;
      
      // Check if it's a certificate error - check multiple error properties
      const errorMessage = String(error?.message || error?.toString() || '');
      const errorCode = String(error?.code || '');
      const errorName = String(error?.name || '');
      const errorStack = String(error?.stack || '');
      const errorString = String(error || '');
      
      // More comprehensive certificate error detection
      // Network-level certificate errors may not have Firebase error codes
      const isCertError = 
        errorCode === 'storage/unknown' ||
        errorCode === 'storage/network-request-failed' ||
        errorName === 'NetworkError' ||
        errorName === 'TypeError' ||
        errorMessage.toLowerCase().includes('cert') ||
        errorMessage.toLowerCase().includes('certificate') ||
        errorMessage.includes('ERR_CERT') ||
        errorMessage.toLowerCase().includes('common name') ||
        errorMessage.toLowerCase().includes('invalid') ||
        errorStack.toLowerCase().includes('cert') ||
        errorStack.toLowerCase().includes('certificate') ||
        errorString.toLowerCase().includes('cert') ||
        // Check for specific network errors
        (errorMessage.includes('Failed to fetch') && errorMessage.includes('firebasestorage')) ||
        // Check if error is related to network request failure
        (errorCode === '' && errorName === '' && errorMessage === '');
      
      console.log(`Upload attempt ${attempt + 1} failed:`, {
        errorCode,
        errorName,
        errorMessage: errorMessage.substring(0, 200),
        isCertError,
      });
      
      if (isCertError && attempt < maxRetries) {
        console.warn(`⚠️ Certificate/network error on attempt ${attempt + 1}, retrying in ${1000 * (attempt + 1)}ms...`);
        // Wait before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
        continue;
      }
      
      // If it's a certificate error and we've exhausted retries, use fallback
      if (isCertError) {
        console.warn('⚠️ Firebase Storage certificate/network error detected after retries. Using fallback blob URL.');
        console.warn('💡 This is likely due to browser extension interference (injectScriptAdjust.js detected).');
        console.warn('💡 File will work locally but won\'t persist across sessions.');
        console.warn('💡 To fix: Disable browser extensions, especially ad blockers or privacy tools.');
        
        // Create a blob URL as fallback
        const blobUrl = URL.createObjectURL(file);
        
        return {
          url: blobUrl,
          storagePath: `fallback/${storagePath}`, // Mark as fallback
          isFallback: true,
        };
      }
      
      // Check if it's an authentication error (should throw, not fallback)
      const isAuthError = 
        errorCode === 'storage/unauthorized' ||
        errorCode === 'storage/permission-denied' ||
        errorMessage.toLowerCase().includes('permission') ||
        errorMessage.toLowerCase().includes('unauthorized');
      
      // If it's an auth error, throw immediately
      if (isAuthError) {
        throw error;
      }
      
      // If we've exhausted retries, use fallback for any network/upload errors
      if (attempt >= maxRetries) {
        console.warn('⚠️ Firebase Storage upload failed after all retries. Using fallback blob URL.');
        console.warn('💡 File will work locally but won\'t persist across sessions.');
        
        const blobUrl = URL.createObjectURL(file);
        return {
          url: blobUrl,
          storagePath: `fallback/${storagePath}`,
          isFallback: true,
        };
      }
    }
  }

  // If we get here, all retries failed - use fallback
  console.warn('⚠️ All Firebase Storage upload attempts failed. Using fallback blob URL.');
  const blobUrl = URL.createObjectURL(file);
  return {
    url: blobUrl,
    storagePath: `fallback/${storagePath}`,
    isFallback: true,
  };
};

/**
 * Delete a file from immersive learning storage
 */
export const deleteImmersiveLearningFile = async (storagePath: string): Promise<void> => {
  const uid = getCurrentUserId();
  if (!uid) throw new Error('User not authenticated');

  try {
    const storageRef = ref(storage, storagePath);
    await deleteObject(storageRef);
  } catch (error) {
    console.error('Error deleting immersive learning file:', error);
    throw error;
  }
};

