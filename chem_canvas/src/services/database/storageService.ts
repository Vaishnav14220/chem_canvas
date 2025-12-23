/**
 * Firebase Storage Service
 * Handles file uploads and downloads for workspace documents
 */

import { ref, uploadBytes, getDownloadURL, deleteObject, listAll, getBlob } from 'firebase/storage';
import { storage } from '../../firebase/config';
import { getCurrentUserId } from './userService';

export interface UploadedFile {
  id: string;
  name: string;
  url: string;
  path: string;
  size: number;
  type: string;
  uploadedAt: number;
}

/**
 * Convert a base64 string to ArrayBuffer
 * Handles both raw base64 and data URLs
 */
const base64ToArrayBuffer = (base64String: string): ArrayBuffer => {
  // Remove data URL prefix if present (e.g., "data:application/pdf;base64,")
  let base64Content = base64String;
  if (base64String.includes(',')) {
    base64Content = base64String.split(',')[1];
  }
  
  // Clean up the base64 string - remove any whitespace or invalid characters
  base64Content = base64Content.replace(/[\s\r\n]/g, '');
  
  // Decode base64 to binary string
  try {
    const binaryString = atob(base64Content);
    const bytes = new ArrayBuffer(binaryString.length);
    const uint8Array = new Uint8Array(bytes);
    for (let i = 0; i < binaryString.length; i++) {
      uint8Array[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  } catch (error) {
    console.error('Failed to decode base64:', error);
    throw new Error('Invalid base64 content');
  }
};

/**
 * Fetch a blob URL and return as Blob
 */
const fetchBlobUrl = async (blobUrl: string): Promise<Blob> => {
  console.log('📥 Fetching blob URL:', blobUrl);
  const response = await fetch(blobUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch blob URL: ${response.status}`);
  }
  return response.blob();
};

/**
 * Upload a file to Firebase Storage
 * @param file - The file to upload (File object, Blob, or base64 data URL string)
 * @param workspaceId - The workspace ID to associate the file with
 * @param fileName - The name of the file
 * @param fileType - The MIME type of the file
 * @returns The uploaded file metadata with download URL
 */
export const uploadFileToStorage = async (
  fileData: File | Blob | string,
  workspaceId: string,
  fileName: string,
  fileType: string
): Promise<UploadedFile> => {
  const userId = getCurrentUserId();
  if (!userId) throw new Error('User not authenticated');

  const fileId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  // Sanitize filename for storage path
  const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const filePath = `users/${userId}/workspaces/${workspaceId}/documents/${fileId}_${sanitizedFileName}`;
  const storageRef = ref(storage, filePath);

  console.log('📤 Uploading file to Storage:', fileName, 'Path:', filePath);

  let blob: Blob;
  let size: number;

  if (typeof fileData === 'string') {
    console.log('📦 Processing string content, type check...');
    console.log('  - Content starts with:', fileData.substring(0, 50));
    
    // Check if it's a blob URL (created by URL.createObjectURL)
    if (fileData.startsWith('blob:')) {
      console.log('🔗 Content is a blob URL, fetching...');
      try {
        blob = await fetchBlobUrl(fileData);
        size = blob.size;
        console.log('✅ Fetched blob from URL:', size, 'bytes');
      } catch (error) {
        console.error('❌ Failed to fetch blob URL:', error);
        throw new Error('Failed to fetch blob URL - the file may have been released from memory');
      }
    }
    // Check if it's a data URL (base64 encoded)
    else if (fileData.startsWith('data:')) {
      console.log('📄 Content is a data URL, converting...');
      // Extract mime type from data URL if available
      const mimeMatch = fileData.match(/^data:([^;]+);/);
      const mimeType = mimeMatch ? mimeMatch[1] : fileType;
      
      try {
        const buffer = base64ToArrayBuffer(fileData);
        blob = new Blob([buffer], { type: mimeType });
        size = blob.size;
        console.log('✅ Converted data URL to blob:', size, 'bytes');
      } catch (error) {
        console.error('❌ Failed to convert data URL:', error);
        throw error;
      }
    }
    // Otherwise try to treat as raw base64
    else {
      console.log('🔤 Content appears to be raw base64 or text, trying conversion...');
      try {
        const buffer = base64ToArrayBuffer(fileData);
        blob = new Blob([buffer], { type: fileType });
        size = blob.size;
        console.log('✅ Converted raw base64 to blob:', size, 'bytes');
      } catch (error) {
        // If base64 fails, treat as plain text content
        console.warn('⚠️ Base64 decode failed, treating as plain text');
        blob = new Blob([fileData], { type: 'text/plain' });
        size = blob.size;
        console.log('✅ Created text blob:', size, 'bytes');
      }
    }
  } else if (fileData instanceof Blob) {
    // Handle Blob or File object
    blob = fileData;
    size = fileData.size;
  } else {
    throw new Error('Invalid file data type');
  }

  // Upload to Firebase Storage
  const metadata = {
    contentType: fileType,
    customMetadata: {
      workspaceId,
      userId,
      originalName: fileName,
    },
  };

  console.log('📤 Uploading blob to Firebase Storage...');
  await uploadBytes(storageRef, blob, metadata);
  
  // Get download URL
  const downloadUrl = await getDownloadURL(storageRef);
  
  console.log('✅ File uploaded successfully:', fileName, 'Size:', size, 'bytes');
  console.log('✅ File uploaded successfully:', fileName, 'URL:', downloadUrl.substring(0, 50) + '...');

  return {
    id: fileId,
    name: fileName,
    url: downloadUrl,
    path: filePath,
    size,
    type: fileType,
    uploadedAt: Date.now(),
  };
};

/**
 * Delete a file from Firebase Storage
 * @param filePath - The path of the file in Storage
 */
export const deleteFileFromStorage = async (filePath: string): Promise<void> => {
  const userId = getCurrentUserId();
  if (!userId) throw new Error('User not authenticated');

  console.log('🗑️ Deleting file from Storage:', filePath);
  
  const storageRef = ref(storage, filePath);
  await deleteObject(storageRef);
  
  console.log('✅ File deleted successfully');
};

/**
 * List all files in a workspace
 * @param workspaceId - The workspace ID
 * @returns List of file paths
 */
export const listWorkspaceFiles = async (workspaceId: string): Promise<string[]> => {
  const userId = getCurrentUserId();
  if (!userId) throw new Error('User not authenticated');

  const folderPath = `users/${userId}/workspaces/${workspaceId}/documents`;
  const folderRef = ref(storage, folderPath);
  
  try {
    const result = await listAll(folderRef);
    return result.items.map(item => item.fullPath);
  } catch (error) {
    console.error('Error listing workspace files:', error);
    return [];
  }
};

/**
 * Delete all files in a workspace
 * @param workspaceId - The workspace ID
 */
export const deleteWorkspaceFiles = async (workspaceId: string): Promise<void> => {
  const userId = getCurrentUserId();
  if (!userId) throw new Error('User not authenticated');

  console.log('🗑️ Deleting all files for workspace:', workspaceId);
  
  const files = await listWorkspaceFiles(workspaceId);
  
  for (const filePath of files) {
    try {
      const storageRef = ref(storage, filePath);
      await deleteObject(storageRef);
    } catch (error) {
      console.error('Error deleting file:', filePath, error);
    }
  }
  
  console.log('✅ All workspace files deleted');
};

/**
 * Get download URL for a file
 * @param filePath - The path of the file in Storage
 * @returns The download URL
 */
export const getFileDownloadUrl = async (filePath: string): Promise<string> => {
  const storageRef = ref(storage, filePath);
  return getDownloadURL(storageRef);
};

/**
 * Download a file from Firebase Storage as a Blob
 * Uses Firebase SDK to bypass CORS issues
 * @param storageUrl - The Firebase Storage download URL
 * @returns The file as a Blob
 */
export const downloadFileFromStorage = async (storageUrl: string): Promise<Blob> => {
  console.log('📥 Downloading file from Storage URL:', storageUrl.substring(0, 80) + '...');
  
  try {
    // Extract the path from the URL if it's a full Firebase Storage URL
    // The URL format is: https://firebasestorage.googleapis.com/v0/b/BUCKET/o/ENCODED_PATH?alt=media&token=TOKEN
    const urlObj = new URL(storageUrl);
    const pathMatch = urlObj.pathname.match(/\/o\/(.+)$/);
    
    if (pathMatch) {
      // Decode the path (it's URL encoded in the URL)
      const encodedPath = pathMatch[1];
      const decodedPath = decodeURIComponent(encodedPath);
      console.log('📍 Extracted storage path:', decodedPath);
      
      // Create a reference using the path
      const storageRef = ref(storage, decodedPath);
      
      try {
        // Try getBlob first (requires CORS to be configured)
        const blob = await getBlob(storageRef);
        console.log('✅ Downloaded file via getBlob:', blob.size, 'bytes');
        return blob;
      } catch (blobError) {
        console.log('⚠️ getBlob failed (CORS issue), trying getDownloadURL fallback...');
        
        // Fallback: Get a fresh download URL with token and fetch
        const freshUrl = await getDownloadURL(storageRef);
        console.log('📎 Got fresh download URL with token');
        
        // Fetch using no-cors mode and create blob manually
        // For PDFs, we can use the URL directly in iframe
        const response = await fetch(freshUrl, { 
          mode: 'cors',
          credentials: 'omit'
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error: ${response.status}`);
        }
        
        const blob = await response.blob();
        console.log('✅ Downloaded file via fetch:', blob.size, 'bytes');
        return blob;
      }
    } else {
      // If we can't extract the path, try direct fetch as fallback
      console.log('⚠️ Could not extract path from URL, trying direct fetch...');
      const response = await fetch(storageUrl);
      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }
      return response.blob();
    }
  } catch (error) {
    console.error('❌ Failed to download file from Storage:', error);
    throw error;
  }
};

/**
 * Get a fresh download URL for a file in Firebase Storage
 * This URL includes a token that allows direct access
 * @param storageUrl - The Firebase Storage URL
 * @returns Fresh download URL with token
 */
export const getFreshDownloadUrl = async (storageUrl: string): Promise<string> => {
  try {
    const urlObj = new URL(storageUrl);
    const pathMatch = urlObj.pathname.match(/\/o\/(.+)$/);
    
    if (pathMatch) {
      const encodedPath = pathMatch[1];
      const decodedPath = decodeURIComponent(encodedPath);
      const storageRef = ref(storage, decodedPath);
      const freshUrl = await getDownloadURL(storageRef);
      console.log('📎 Generated fresh download URL');
      return freshUrl;
    }
    
    return storageUrl;
  } catch (error) {
    console.error('❌ Failed to get fresh download URL:', error);
    return storageUrl;
  }
};
