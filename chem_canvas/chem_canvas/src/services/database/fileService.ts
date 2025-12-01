// File Service - Manages file uploads to Firebase Storage
import {
  ref,
  uploadBytes,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
  listAll,
  getMetadata,
  UploadTaskSnapshot,
} from 'firebase/storage';
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
} from 'firebase/firestore';
import { storage, db } from '../../firebase/config';
import { getCurrentUserId } from './userService';
import type { FileUpload, FileMetadata } from '../../types/database';

// ============================================
// FILE UPLOAD
// ============================================

/**
 * Upload a file to Firebase Storage
 */
export const uploadFile = async (
  file: File,
  options: {
    folder?: string;
    workspaceId?: string;
    tags?: string[];
    onProgress?: (progress: number) => void;
  } = {}
): Promise<FileUpload> => {
  const uid = getCurrentUserId();
  if (!uid) throw new Error('User not authenticated');

  const { folder = 'uploads', workspaceId, tags = [], onProgress } = options;

  try {
    // Generate unique filename
    const timestamp = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const storagePath = `users/${uid}/${folder}/${timestamp}_${safeName}`;
    const storageRef = ref(storage, storagePath);

    // Upload with progress tracking
    let downloadUrl: string;

    if (onProgress) {
      const uploadTask = uploadBytesResumable(storageRef, file);

      downloadUrl = await new Promise<string>((resolve, reject) => {
        uploadTask.on(
          'state_changed',
          (snapshot: UploadTaskSnapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            onProgress(progress);
          },
          (error) => reject(error),
          async () => {
            const url = await getDownloadURL(uploadTask.snapshot.ref);
            resolve(url);
          }
        );
      });
    } else {
      await uploadBytes(storageRef, file);
      downloadUrl = await getDownloadURL(storageRef);
    }

    // Get metadata for images/videos
    let metadata: FileMetadata = {};
    if (file.type.startsWith('image/')) {
      metadata = await getImageMetadata(file);
    }

    // Save file record to Firestore
    const filesRef = collection(db, 'users', uid, 'files');
    const docRef = await addDoc(filesRef, {
      name: file.name,
      type: file.type,
      size: file.size,
      storagePath,
      downloadUrl,
      uploadedAt: serverTimestamp(),
      workspaceId: workspaceId || null,
      tags,
      metadata,
    });

    const newDoc = await getDoc(docRef);
    return { id: newDoc.id, ...newDoc.data() } as FileUpload;
  } catch (error) {
    console.error('Error uploading file:', error);
    throw error;
  }
};

/**
 * Upload multiple files
 */
export const uploadFiles = async (
  files: File[],
  options: {
    folder?: string;
    workspaceId?: string;
    onProgress?: (fileIndex: number, progress: number) => void;
  } = {}
): Promise<FileUpload[]> => {
  const { folder, workspaceId, onProgress } = options;
  const results: FileUpload[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const upload = await uploadFile(file, {
      folder,
      workspaceId,
      onProgress: onProgress ? (progress) => onProgress(i, progress) : undefined,
    });
    results.push(upload);
  }

  return results;
};

/**
 * Get image dimensions
 */
const getImageMetadata = (file: File): Promise<FileMetadata> => {
  return new Promise((resolve) => {
    if (!file.type.startsWith('image/')) {
      resolve({});
      return;
    }

    const img = new Image();
    img.onload = () => {
      resolve({
        width: img.width,
        height: img.height,
      });
      URL.revokeObjectURL(img.src);
    };
    img.onerror = () => {
      resolve({});
      URL.revokeObjectURL(img.src);
    };
    img.src = URL.createObjectURL(file);
  });
};

// ============================================
// FILE MANAGEMENT
// ============================================

/**
 * Get all files for current user
 */
export const getFiles = async (
  options: {
    workspaceId?: string;
    folder?: string;
    type?: string;
    limit?: number;
  } = {}
): Promise<FileUpload[]> => {
  const uid = getCurrentUserId();
  if (!uid) throw new Error('User not authenticated');

  const {
    workspaceId,
    type,
    limit: limitCount = 100,
  } = options;

  try {
    const filesRef = collection(db, 'users', uid, 'files');
    let q = query(
      filesRef,
      orderBy('uploadedAt', 'desc'),
      limit(limitCount)
    );

    if (workspaceId) {
      q = query(
        filesRef,
        where('workspaceId', '==', workspaceId),
        orderBy('uploadedAt', 'desc'),
        limit(limitCount)
      );
    }

    if (type) {
      q = query(
        filesRef,
        where('type', '==', type),
        orderBy('uploadedAt', 'desc'),
        limit(limitCount)
      );
    }

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as FileUpload[];
  } catch (error) {
    console.error('Error getting files:', error);
    throw error;
  }
};

/**
 * Get a single file by ID
 */
export const getFile = async (fileId: string): Promise<FileUpload | null> => {
  const uid = getCurrentUserId();
  if (!uid) throw new Error('User not authenticated');

  try {
    const docRef = doc(db, 'users', uid, 'files', fileId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as FileUpload;
    }
    return null;
  } catch (error) {
    console.error('Error getting file:', error);
    throw error;
  }
};

/**
 * Delete a file
 */
export const deleteFile = async (fileId: string): Promise<void> => {
  const uid = getCurrentUserId();
  if (!uid) throw new Error('User not authenticated');

  try {
    // Get file record
    const file = await getFile(fileId);
    if (!file) throw new Error('File not found');

    // Delete from Storage
    const storageRef = ref(storage, file.storagePath);
    try {
      await deleteObject(storageRef);
    } catch (error) {
      // File might already be deleted from storage
      console.warn('Could not delete from storage:', error);
    }

    // Delete from Firestore
    const docRef = doc(db, 'users', uid, 'files', fileId);
    await deleteDoc(docRef);
  } catch (error) {
    console.error('Error deleting file:', error);
    throw error;
  }
};

/**
 * Update file metadata
 */
export const updateFile = async (
  fileId: string,
  updates: Partial<Pick<FileUpload, 'name' | 'tags' | 'workspaceId'>>
): Promise<void> => {
  const uid = getCurrentUserId();
  if (!uid) throw new Error('User not authenticated');

  try {
    const docRef = doc(db, 'users', uid, 'files', fileId);
    await updateDoc(docRef, updates);
  } catch (error) {
    console.error('Error updating file:', error);
    throw error;
  }
};

/**
 * Move file to workspace
 */
export const moveFileToWorkspace = async (
  fileId: string,
  workspaceId: string | null
): Promise<void> => {
  await updateFile(fileId, { workspaceId: workspaceId || undefined });
};

/**
 * Add tag to file
 */
export const addFileTag = async (fileId: string, tag: string): Promise<void> => {
  const file = await getFile(fileId);
  if (file) {
    const tags = file.tags || [];
    if (!tags.includes(tag)) {
      await updateFile(fileId, { tags: [...tags, tag] });
    }
  }
};

// ============================================
// FILE TYPE HELPERS
// ============================================

/**
 * Get images
 */
export const getImages = async (workspaceId?: string): Promise<FileUpload[]> => {
  const files = await getFiles({ workspaceId });
  return files.filter(f => f.type.startsWith('image/'));
};

/**
 * Get documents (PDFs, docs, etc.)
 */
export const getDocumentFiles = async (workspaceId?: string): Promise<FileUpload[]> => {
  const files = await getFiles({ workspaceId });
  const docTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument'];
  return files.filter(f => docTypes.some(t => f.type.startsWith(t)));
};

/**
 * Get molecule files (mol, sdf, pdb)
 */
export const getMoleculeFiles = async (workspaceId?: string): Promise<FileUpload[]> => {
  const files = await getFiles({ workspaceId });
  const molExtensions = ['.mol', '.sdf', '.pdb', '.xyz', '.cif'];
  return files.filter(f => molExtensions.some(ext => f.name.toLowerCase().endsWith(ext)));
};

// ============================================
// STORAGE USAGE
// ============================================

/**
 * Get total storage used by user
 */
export const getStorageUsage = async (): Promise<{
  totalBytes: number;
  totalFiles: number;
  byType: Record<string, { count: number; bytes: number }>;
}> => {
  const files = await getFiles({ limit: 1000 });

  const byType: Record<string, { count: number; bytes: number }> = {};
  let totalBytes = 0;

  files.forEach(file => {
    totalBytes += file.size;

    const category = getFileCategory(file.type);
    if (!byType[category]) {
      byType[category] = { count: 0, bytes: 0 };
    }
    byType[category].count++;
    byType[category].bytes += file.size;
  });

  return {
    totalBytes,
    totalFiles: files.length,
    byType,
  };
};

/**
 * Get file category from MIME type
 */
const getFileCategory = (mimeType: string): string => {
  if (mimeType.startsWith('image/')) return 'images';
  if (mimeType.startsWith('video/')) return 'videos';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType === 'application/pdf') return 'documents';
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return 'spreadsheets';
  if (mimeType.includes('document') || mimeType.includes('word')) return 'documents';
  return 'other';
};

/**
 * Format bytes to human readable string
 */
export const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// ============================================
// PROFILE & WORKSPACE SPECIFIC UPLOADS
// ============================================

/**
 * Upload profile picture
 */
export const uploadProfilePicture = async (
  file: File,
  onProgress?: (progress: number) => void
): Promise<string> => {
  const uid = getCurrentUserId();
  if (!uid) throw new Error('User not authenticated');

  const storagePath = `users/${uid}/profile/avatar`;
  const storageRef = ref(storage, storagePath);

  if (onProgress) {
    const uploadTask = uploadBytesResumable(storageRef, file);

    return new Promise<string>((resolve, reject) => {
      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          onProgress(progress);
        },
        reject,
        async () => {
          const url = await getDownloadURL(uploadTask.snapshot.ref);
          resolve(url);
        }
      );
    });
  } else {
    await uploadBytes(storageRef, file);
    return getDownloadURL(storageRef);
  }
};

/**
 * Upload workspace thumbnail
 */
export const uploadWorkspaceThumbnail = async (
  workspaceId: string,
  file: File | Blob
): Promise<string> => {
  const uid = getCurrentUserId();
  if (!uid) throw new Error('User not authenticated');

  const storagePath = `users/${uid}/workspaces/${workspaceId}/thumbnail`;
  const storageRef = ref(storage, storagePath);

  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
};

/**
 * Upload molecule structure file
 */
export const uploadMoleculeFile = async (
  moleculeId: string,
  file: File
): Promise<string> => {
  const uid = getCurrentUserId();
  if (!uid) throw new Error('User not authenticated');

  const storagePath = `users/${uid}/molecules/${moleculeId}/structure${getExtension(file.name)}`;
  const storageRef = ref(storage, storagePath);

  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
};

/**
 * Get file extension
 */
const getExtension = (filename: string): string => {
  const lastDot = filename.lastIndexOf('.');
  return lastDot !== -1 ? filename.substring(lastDot) : '';
};
