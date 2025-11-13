/**
 * Backblaze B2 Cloud Storage Service
 * Handles document upload, retrieval, deletion using S3-compatible API
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  DeleteObjectCommand,
  HeadObjectCommand,
  type PutObjectCommandInput,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export interface StoredDocument {
  id: string;
  name: string;
  url: string;
  size: number;
  uploadedAt: Date;
  owner: string;
}

// Initialize S3 client for Backblaze B2
const s3Client = new S3Client({
  region: import.meta.env.VITE_BACKBLAZE_REGION || 'eu-central-001',
  credentials: {
    accessKeyId: import.meta.env.VITE_BACKBLAZE_KEY_ID || '',
    secretAccessKey: import.meta.env.VITE_BACKBLAZE_KEY || '',
  },
  endpoint: `https://${import.meta.env.VITE_BACKBLAZE_ENDPOINT}`,
  forcePathStyle: true, // Required for Backblaze B2
});

const BUCKET_NAME = import.meta.env.VITE_BACKBLAZE_BUCKET_NAME || 'studium-canvas';
const EXPIRATION_TIME = 7 * 24 * 60 * 60; // 7 days in seconds

/**
 * Uploads a PDF file to Backblaze B2
 * @param file - The PDF file to upload
 * @param userId - The user's ID (for organizing files)
 * @returns Promise with document metadata
 */
export const uploadDocument = async (
  file: File,
  userId: string
): Promise<StoredDocument> => {
  if (!userId) {
    throw new Error('User ID is required to upload documents');
  }

  if (!file.type.includes('pdf')) {
    throw new Error('Only PDF files are supported');
  }

  if (file.size > 500 * 1024 * 1024) {
    throw new Error('File size must be less than 500 MB');
  }

  try {
    const fileName = `${Date.now()}-${file.name}`;
    const s3Key = `users/${userId}/documents/${fileName}`;

    console.log('[BackblazeService] Uploading to B2:', s3Key);

    const uploadParams: PutObjectCommandInput = {
      Bucket: BUCKET_NAME,
      Key: s3Key,
      Body: file,
      ContentType: 'application/pdf',
      Metadata: {
        'original-name': file.name,
        'uploaded-by': userId,
        'uploaded-at': new Date().toISOString(),
      },
    };

    const uploadCommand = new PutObjectCommand(uploadParams);
    await s3Client.send(uploadCommand);

    // Generate a signed URL for retrieval (7 days validity)
    const getCommand = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: s3Key,
    });
    const signedUrl = await getSignedUrl(s3Client, getCommand, {
      expiresIn: EXPIRATION_TIME,
    });

    console.log('[BackblazeService] Upload successful');

    return {
      id: fileName,
      name: file.name,
      url: signedUrl,
      size: file.size,
      uploadedAt: new Date(),
      owner: userId,
    };
  } catch (error) {
    console.error('[BackblazeService] Upload error:', error);
    throw new Error(`Failed to upload document: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

/**
 * Retrieves all documents for a user from Backblaze B2
 * @param userId - The user's ID
 * @returns Promise with array of user's stored documents
 */
export const getUserDocuments = async (userId: string): Promise<StoredDocument[]> => {
  if (!userId) {
    throw new Error('User ID is required to fetch documents');
  }

  try {
    console.log('[BackblazeService] Fetching documents for user:', userId);

    const listCommand = new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      Prefix: `users/${userId}/documents/`,
      MaxKeys: 100,
    });

    const listResponse = await s3Client.send(listCommand);
    const documents: StoredDocument[] = [];

    if (!listResponse.Contents) {
      console.log('[BackblazeService] No documents found');
      return documents;
    }

    // Process each file
    for (const file of listResponse.Contents) {
      if (!file.Key) continue;

      try {
        // Get file metadata
        const headCommand = new HeadObjectCommand({
          Bucket: BUCKET_NAME,
          Key: file.Key,
        });
        const headResponse = await s3Client.send(headCommand);

        // Generate signed URL for the file
        const getCommand = new GetObjectCommand({
          Bucket: BUCKET_NAME,
          Key: file.Key,
        });
        const signedUrl = await getSignedUrl(s3Client, getCommand, {
          expiresIn: EXPIRATION_TIME,
        });

        const originalName = headResponse.Metadata?.['original-name'] || file.Key.split('/').pop() || 'document.pdf';

        documents.push({
          id: file.Key.split('/').pop() || file.Key,
          name: originalName,
          url: signedUrl,
          size: headResponse.ContentLength || 0,
          uploadedAt: headResponse.LastModified || new Date(),
          owner: userId,
        });
      } catch (err) {
        console.warn('[BackblazeService] Error fetching metadata for', file.Key, err);
        // Continue with next file
      }
    }

    // Sort by upload date descending (newest first)
    documents.sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime());

    console.log('[BackblazeService] Fetched', documents.length, 'documents');
    return documents;
  } catch (error) {
    console.error('[BackblazeService] Fetch error:', error);
    throw new Error(`Failed to fetch documents: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

/**
 * Deletes a document from Backblaze B2
 * @param fileId - The file name/ID to delete
 * @param userId - The user's ID
 */
export const deleteDocument = async (fileId: string, userId: string): Promise<void> => {
  if (!userId || !fileId) {
    throw new Error('User ID and file ID are required to delete documents');
  }

  try {
    const s3Key = `users/${userId}/documents/${fileId}`;

    console.log('[BackblazeService] Deleting from B2:', s3Key);

    const deleteCommand = new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: s3Key,
    });

    await s3Client.send(deleteCommand);

    console.log('[BackblazeService] Delete successful');
  } catch (error) {
    console.error('[BackblazeService] Delete error:', error);
    throw new Error(`Failed to delete document: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

/**
 * Gets a signed download URL for a file (useful for sharing)
 * @param fileId - The file name/ID
 * @param userId - The user's ID
 * @returns Signed URL valid for 7 days
 */
export const getSignedDownloadUrl = async (fileId: string, userId: string): Promise<string> => {
  if (!userId || !fileId) {
    throw new Error('User ID and file ID are required');
  }

  try {
    const s3Key = `users/${userId}/documents/${fileId}`;

    const getCommand = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: s3Key,
    });

    return await getSignedUrl(s3Client, getCommand, {
      expiresIn: EXPIRATION_TIME,
    });
  } catch (error) {
    console.error('[BackblazeService] Error generating signed URL:', error);
    throw new Error(`Failed to generate download URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

export default {
  uploadDocument,
  getUserDocuments,
  deleteDocument,
  getSignedDownloadUrl,
};
