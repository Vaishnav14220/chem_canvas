// @ts-nocheck
/**
 * Backblaze B2 Storage Service (via Netlify Function Proxy)
 * 
 * This service proxies all Backblaze requests through a Netlify serverless function
 * to avoid CORS issues and keep credentials secure.
 */

import { auth } from './config';
import type { StoredDocument } from './backblazeStorageService';

// Use Netlify function URL (works both locally and in production)
const PROXY_URL = '/.netlify/functions/backblaze-proxy';

/**
 * Upload a document to Backblaze B2 via proxy
 */
export async function uploadDocument(
  file: File,
  metadata?: Record<string, string>
): Promise<StoredDocument> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('User must be authenticated to upload documents');
  }

  console.log('[BackblazeProxy] Uploading file:', file.name);

  try {
    const timestamp = Date.now();
    const fileName = `${timestamp}-${file.name}`;
    const objectKey = `users/${user.uid}/documents/${fileName}`;

    // Convert file to base64
    const arrayBuffer = await file.arrayBuffer();
    const base64Data = btoa(
      new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
    );

    // Call proxy function
    const response = await fetch(PROXY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'upload',
        key: objectKey,
        fileData: base64Data,
        contentType: file.type,
        metadata: {
          originalName: file.name,
          uploadedBy: user.uid,
          uploadedAt: new Date().toISOString(),
          ...metadata,
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Upload failed');
    }

    const data = await response.json();

    console.log('[BackblazeProxy] Upload successful:', data.url);

    return {
      id: objectKey,
      name: file.name,
      url: data.url,
      uploadedAt: new Date().toISOString(),
      size: file.size,
    };
  } catch (error: any) {
    console.error('[BackblazeProxy] Upload error:', error);
    throw new Error(`Failed to upload document: ${error.message}`);
  }
}

/**
 * Get all documents for the current user
 */
export async function getUserDocuments(): Promise<StoredDocument[]> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('User must be authenticated');
  }

  console.log('[BackblazeProxy] Fetching documents for user:', user.uid);

  try {
    const response = await fetch(PROXY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'list',
        prefix: `users/${user.uid}/documents/`,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to fetch documents');
    }

    const data = await response.json();

    console.log('[BackblazeProxy] Found documents:', data.documents.length);

    return data.documents.sort(
      (a: StoredDocument, b: StoredDocument) =>
        new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
    );
  } catch (error: any) {
    console.error('[BackblazeProxy] Error fetching documents:', error);
    throw new Error(`Failed to fetch documents: ${error.message}`);
  }
}

/**
 * Delete a document from Backblaze B2
 */
export async function deleteDocument(documentId: string): Promise<void> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('User must be authenticated');
  }

  console.log('[BackblazeProxy] Deleting document:', documentId);

  try {
    const response = await fetch(PROXY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'delete',
        key: documentId,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Delete failed');
    }

    console.log('[BackblazeProxy] Document deleted successfully');
  } catch (error: any) {
    console.error('[BackblazeProxy] Delete error:', error);
    throw new Error(`Failed to delete document: ${error.message}`);
  }
}

/**
 * Get a signed download URL for a document
 */
export async function getSignedDownloadUrl(documentId: string): Promise<string> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('User must be authenticated');
  }

  console.log('[BackblazeProxy] Getting signed URL for:', documentId);

  try {
    const response = await fetch(PROXY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'getSignedUrl',
        key: documentId,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to get signed URL');
    }

    const data = await response.json();

    console.log('[BackblazeProxy] Signed URL generated');

    return data.url;
  } catch (error: any) {
    console.error('[BackblazeProxy] Error getting signed URL:', error);
    throw new Error(`Failed to get signed URL: ${error.message}`);
  }
}
