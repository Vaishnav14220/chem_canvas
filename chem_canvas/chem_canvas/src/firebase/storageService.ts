/**
 * Firebase Storage Service
 * Handles document upload, retrieval, deletion for the learning app
 */

import {
  ref,
  uploadBytes,
  getDownloadURL,
  listAll,
  deleteObject,
  getMetadata,
  updateMetadata,
  type UploadMetadata,
} from 'firebase/storage';
import { storage } from './config';
import { auth } from './config';

export interface StoredDocument {
  id: string;
  name: string;
  url: string;
  size: number;
  uploadedAt: string;
  owner: string;
}

/**
 * Uploads a PDF file to Firebase Storage
 * @param file - The PDF file to upload
 * @param metadata - Optional custom metadata (title, etc.)
 * @returns Promise with download URL and document metadata
 */
export const uploadDocument = async (
  file: File,
  metadata?: Record<string, string>
): Promise<StoredDocument> => {
  if (!auth.currentUser) {
    throw new Error('User must be authenticated to upload documents');
  }

  const userId = auth.currentUser.uid;
  const fileName = `${Date.now()}-${file.name}`;
  const storagePath = `users/${userId}/documents/${fileName}`;
  const fileRef = ref(storage, storagePath);

  // Prepare upload metadata
  const uploadMeta: UploadMetadata = {
    customMetadata: {
      uploadedBy: userId,
      originalName: file.name,
      uploadedAt: new Date().toISOString(),
      ...metadata,
    },
  };

  // Upload file
  const snapshot = await uploadBytes(fileRef, file, uploadMeta);

  // Get download URL
  const downloadUrl = await getDownloadURL(snapshot.ref);

  // Return document metadata
  return {
    id: fileName,
    name: file.name,
    url: downloadUrl,
    size: file.size,
    uploadedAt: new Date().toISOString(),
    owner: userId,
  };
};

/**
 * Retrieves all documents uploaded by the current user
 * @returns Promise with array of user's stored documents
 */
export const getUserDocuments = async (): Promise<StoredDocument[]> => {
  if (!auth.currentUser) {
    throw new Error('User must be authenticated to fetch documents');
  }

  const userId = auth.currentUser.uid;
  const userDocumentsRef = ref(storage, `users/${userId}/documents`);

  const result = await listAll(userDocumentsRef);
  const documents: StoredDocument[] = [];

  for (const item of result.items) {
    const meta = await getMetadata(item);
    const url = await getDownloadURL(item);

    documents.push({
      id: item.name,
      name: meta.customMetadata?.originalName || item.name,
      url,
      size: meta.size,
      uploadedAt: meta.customMetadata?.uploadedAt || meta.timeCreated || '',
      owner: userId,
    });
  }

  // Sort by upload date descending (newest first)
  documents.sort(
    (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
  );

  return documents;
};

/**
 * Deletes a document from Firebase Storage
 * @param documentId - The file name/ID to delete
 */
export const deleteDocument = async (documentId: string): Promise<void> => {
  if (!auth.currentUser) {
    throw new Error('User must be authenticated to delete documents');
  }

  const userId = auth.currentUser.uid;
  const storagePath = `users/${userId}/documents/${documentId}`;
  const fileRef = ref(storage, storagePath);

  await deleteObject(fileRef);
};

/**
 * Updates metadata for a stored document (e.g., rename, tags)
 * @param documentId - The file name/ID to update
 * @param newMetadata - Metadata fields to update
 */
export const updateDocumentMetadata = async (
  documentId: string,
  newMetadata: Record<string, string>
): Promise<void> => {
  if (!auth.currentUser) {
    throw new Error('User must be authenticated to update document metadata');
  }

  const userId = auth.currentUser.uid;
  const storagePath = `users/${userId}/documents/${documentId}`;
  const fileRef = ref(storage, storagePath);

  await updateMetadata(fileRef, {
    customMetadata: newMetadata,
  });
};

export default {
  uploadDocument,
  getUserDocuments,
  deleteDocument,
  updateDocumentMetadata,
};
