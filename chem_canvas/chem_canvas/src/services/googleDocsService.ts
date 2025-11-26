/**
 * Google Docs Service
 * Provides functions to create, read, and update Google Docs
 * using the Google Docs API
 */

import { getAccessToken, isSignedIn, getCurrentUser } from './googleAuthService';

// ==========================================
// Types
// ==========================================

export interface GoogleDoc {
  documentId: string;
  title: string;
  revisionId?: string;
  documentUrl?: string;
}

export interface DocCreateResult {
  success: boolean;
  document?: GoogleDoc;
  error?: string;
}

export interface DocUpdateResult {
  success: boolean;
  writeControl?: { requiredRevisionId: string };
  error?: string;
}

export interface DocListResult {
  success: boolean;
  documents?: Array<{
    id: string;
    name: string;
    modifiedTime: string;
    webViewLink: string;
  }>;
  error?: string;
}

// Document info type for recent documents
export interface DocumentInfo {
  id: string;
  name: string;
  modifiedTime: string;
  webViewLink: string;
}

// Rich text formatting options
export interface TextStyle {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  fontSize?: number; // in points
  foregroundColor?: { red: number; green: number; blue: number };
  backgroundColor?: { red: number; green: number; blue: number };
  link?: { url: string };
}

export interface ParagraphStyle {
  namedStyleType?: 'NORMAL_TEXT' | 'TITLE' | 'HEADING_1' | 'HEADING_2' | 'HEADING_3' | 'HEADING_4' | 'HEADING_5' | 'HEADING_6';
  alignment?: 'START' | 'CENTER' | 'END' | 'JUSTIFIED';
  lineSpacing?: number; // percentage, e.g., 115 for 1.15 line spacing
  spaceAbove?: { magnitude: number; unit: 'PT' };
  spaceBelow?: { magnitude: number; unit: 'PT' };
}

// ==========================================
// API Base URL
// ==========================================

const DOCS_API = 'https://docs.googleapis.com/v1/documents';
const DRIVE_API = 'https://www.googleapis.com/drive/v3/files';

// ==========================================
// Helper Functions
// ==========================================

/**
 * Make an authenticated request to Google API
 */
async function googleFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = await getAccessToken();
  
  if (!token) {
    throw new Error('Not authenticated. Please sign in with Google.');
  }

  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    ...options.headers
  };

  return fetch(url, { ...options, headers });
}

/**
 * Convert markdown to Google Docs requests
 */
function markdownToDocsRequests(markdown: string): Array<any> {
  const requests: any[] = [];
  let currentIndex = 1; // Google Docs index starts at 1

  // Split into lines and process
  const lines = markdown.split('\n');
  
  for (const line of lines) {
    if (!line.trim()) {
      // Empty line - insert paragraph break
      requests.push({
        insertText: {
          location: { index: currentIndex },
          text: '\n'
        }
      });
      currentIndex += 1;
      continue;
    }

    let text = line;
    let style: ParagraphStyle = { namedStyleType: 'NORMAL_TEXT' };
    let isList = false;
    let listPrefix = '';

    // Handle headings
    if (line.startsWith('# ')) {
      text = line.slice(2);
      style = { namedStyleType: 'HEADING_1' };
    } else if (line.startsWith('## ')) {
      text = line.slice(3);
      style = { namedStyleType: 'HEADING_2' };
    } else if (line.startsWith('### ')) {
      text = line.slice(4);
      style = { namedStyleType: 'HEADING_3' };
    } else if (line.startsWith('#### ')) {
      text = line.slice(5);
      style = { namedStyleType: 'HEADING_4' };
    } else if (line.startsWith('##### ')) {
      text = line.slice(6);
      style = { namedStyleType: 'HEADING_5' };
    } else if (line.startsWith('###### ')) {
      text = line.slice(7);
      style = { namedStyleType: 'HEADING_6' };
    }
    // Handle lists
    else if (line.match(/^[-*]\s/)) {
      text = line.slice(2);
      isList = true;
      listPrefix = '• ';
    } else if (line.match(/^\d+\.\s/)) {
      const match = line.match(/^(\d+)\.\s(.*)$/);
      if (match) {
        listPrefix = `${match[1]}. `;
        text = match[2];
        isList = true;
      }
    }
    // Handle blockquotes
    else if (line.startsWith('> ')) {
      text = line.slice(2);
      // Will apply italic style
    }

    // Insert the text
    const fullText = (isList ? listPrefix : '') + text + '\n';
    requests.push({
      insertText: {
        location: { index: currentIndex },
        text: fullText
      }
    });

    // Apply paragraph style
    if (style.namedStyleType && style.namedStyleType !== 'NORMAL_TEXT') {
      requests.push({
        updateParagraphStyle: {
          range: {
            startIndex: currentIndex,
            endIndex: currentIndex + fullText.length
          },
          paragraphStyle: style,
          fields: 'namedStyleType'
        }
      });
    }

    // Handle inline formatting (bold, italic)
    let searchText = text;
    let textStartIndex = currentIndex + (isList ? listPrefix.length : 0);

    // Bold: **text** or __text__
    const boldMatches = [...text.matchAll(/\*\*(.+?)\*\*|__(.+?)__/g)];
    for (const match of boldMatches) {
      const boldText = match[1] || match[2];
      const startOffset = text.indexOf(match[0]);
      requests.push({
        updateTextStyle: {
          range: {
            startIndex: textStartIndex + startOffset,
            endIndex: textStartIndex + startOffset + match[0].length
          },
          textStyle: { bold: true },
          fields: 'bold'
        }
      });
    }

    // Italic: *text* or _text_
    const italicMatches = [...text.matchAll(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)|(?<!_)_(?!_)(.+?)(?<!_)_(?!_)/g)];
    for (const match of italicMatches) {
      const italicText = match[1] || match[2];
      const startOffset = text.indexOf(match[0]);
      requests.push({
        updateTextStyle: {
          range: {
            startIndex: textStartIndex + startOffset,
            endIndex: textStartIndex + startOffset + match[0].length
          },
          textStyle: { italic: true },
          fields: 'italic'
        }
      });
    }

    currentIndex += fullText.length;
  }

  return requests;
}

/**
 * Convert plain text with basic formatting to Google Docs
 */
function textToDocsRequests(text: string, title?: string): Array<any> {
  const requests: any[] = [];
  let currentIndex = 1;

  // Add title if provided
  if (title) {
    requests.push({
      insertText: {
        location: { index: currentIndex },
        text: title + '\n\n'
      }
    });
    requests.push({
      updateParagraphStyle: {
        range: {
          startIndex: currentIndex,
          endIndex: currentIndex + title.length + 1
        },
        paragraphStyle: { namedStyleType: 'TITLE' },
        fields: 'namedStyleType'
      }
    });
    currentIndex += title.length + 2;
  }

  // Add the main text
  requests.push({
    insertText: {
      location: { index: currentIndex },
      text: text
    }
  });

  return requests;
}

// ==========================================
// Public API
// ==========================================

/**
 * Create a new Google Doc
 */
export async function createGoogleDoc(title: string): Promise<DocCreateResult> {
  if (!isSignedIn()) {
    return { success: false, error: 'Not signed in' };
  }

  try {
    const response = await googleFetch(DOCS_API, {
      method: 'POST',
      body: JSON.stringify({ title })
    });

    if (!response.ok) {
      const error = await response.json();
      return { 
        success: false, 
        error: error.error?.message || 'Failed to create document' 
      };
    }

    const doc = await response.json();
    return {
      success: true,
      document: {
        documentId: doc.documentId,
        title: doc.title,
        revisionId: doc.revisionId,
        documentUrl: `https://docs.google.com/document/d/${doc.documentId}/edit`
      }
    };
  } catch (error) {
    console.error('Error creating Google Doc:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Update a Google Doc with content
 */
export async function updateGoogleDoc(
  documentId: string,
  content: string,
  format: 'markdown' | 'text' = 'markdown',
  title?: string
): Promise<DocUpdateResult> {
  if (!isSignedIn()) {
    return { success: false, error: 'Not signed in' };
  }

  try {
    // First, clear the document (except for empty docs)
    const getResponse = await googleFetch(`${DOCS_API}/${documentId}`);
    if (!getResponse.ok) {
      return { success: false, error: 'Failed to read document' };
    }

    const doc = await getResponse.json();
    const endIndex = doc.body?.content?.[doc.body.content.length - 1]?.endIndex || 1;

    const requests: any[] = [];

    // Clear existing content if there is any
    if (endIndex > 2) {
      requests.push({
        deleteContentRange: {
          range: {
            startIndex: 1,
            endIndex: endIndex - 1
          }
        }
      });
    }

    // Add new content
    if (format === 'markdown') {
      requests.push(...markdownToDocsRequests(content));
    } else {
      requests.push(...textToDocsRequests(content, title));
    }

    // Execute the update
    const updateResponse = await googleFetch(`${DOCS_API}/${documentId}:batchUpdate`, {
      method: 'POST',
      body: JSON.stringify({ requests })
    });

    if (!updateResponse.ok) {
      const error = await updateResponse.json();
      return {
        success: false,
        error: error.error?.message || 'Failed to update document'
      };
    }

    const result = await updateResponse.json();
    return {
      success: true,
      writeControl: result.writeControl
    };
  } catch (error) {
    console.error('Error updating Google Doc:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Create a new Google Doc with content
 */
export async function createGoogleDocWithContent(
  title: string,
  content: string,
  format: 'markdown' | 'text' = 'markdown'
): Promise<DocCreateResult> {
  // First create the document
  const createResult = await createGoogleDoc(title);
  
  if (!createResult.success || !createResult.document) {
    return createResult;
  }

  // Then add the content
  const updateResult = await updateGoogleDoc(
    createResult.document.documentId,
    content,
    format
  );

  if (!updateResult.success) {
    return {
      success: false,
      document: createResult.document,
      error: updateResult.error
    };
  }

  return createResult;
}

/**
 * List recent Google Docs
 */
export async function listGoogleDocs(maxResults: number = 20): Promise<DocListResult> {
  if (!isSignedIn()) {
    return { success: false, error: 'Not signed in' };
  }

  try {
    const query = encodeURIComponent("mimeType='application/vnd.google-apps.document'");
    const url = `${DRIVE_API}?q=${query}&orderBy=modifiedTime desc&pageSize=${maxResults}&fields=files(id,name,modifiedTime,webViewLink)`;
    
    const response = await googleFetch(url);

    if (!response.ok) {
      const error = await response.json();
      return {
        success: false,
        error: error.error?.message || 'Failed to list documents'
      };
    }

    const data = await response.json();
    return {
      success: true,
      documents: data.files || []
    };
  } catch (error) {
    console.error('Error listing Google Docs:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Drive file types with their icons
export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  iconLink?: string;
  webViewLink?: string;
  parents?: string[];
  size?: string;
  thumbnailLink?: string;
}

export interface DriveListResult {
  success: boolean;
  files?: DriveFile[];
  nextPageToken?: string;
  error?: string;
}

/**
 * List files from Google Drive with optional folder navigation
 */
export async function listDriveFiles(
  folderId: string = 'root',
  pageToken?: string,
  maxResults: number = 50
): Promise<DriveListResult> {
  if (!isSignedIn()) {
    return { success: false, error: 'Not signed in' };
  }

  try {
    // Query for files in the specified folder, excluding trashed files
    const query = encodeURIComponent(`'${folderId}' in parents and trashed=false`);
    const fields = 'nextPageToken,files(id,name,mimeType,modifiedTime,iconLink,webViewLink,parents,size,thumbnailLink)';
    let url = `${DRIVE_API}?q=${query}&orderBy=folder,name&pageSize=${maxResults}&fields=${fields}`;
    
    if (pageToken) {
      url += `&pageToken=${pageToken}`;
    }
    
    const response = await googleFetch(url);

    if (!response.ok) {
      const error = await response.json();
      return {
        success: false,
        error: error.error?.message || 'Failed to list files'
      };
    }

    const data = await response.json();
    return {
      success: true,
      files: data.files || [],
      nextPageToken: data.nextPageToken
    };
  } catch (error) {
    console.error('Error listing Drive files:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Search files in Google Drive
 */
export async function searchDriveFiles(
  searchQuery: string,
  maxResults: number = 30
): Promise<DriveListResult> {
  if (!isSignedIn()) {
    return { success: false, error: 'Not signed in' };
  }

  try {
    const query = encodeURIComponent(`name contains '${searchQuery}' and trashed=false`);
    const fields = 'files(id,name,mimeType,modifiedTime,iconLink,webViewLink,parents,size,thumbnailLink)';
    const url = `${DRIVE_API}?q=${query}&orderBy=modifiedTime desc&pageSize=${maxResults}&fields=${fields}`;
    
    const response = await googleFetch(url);

    if (!response.ok) {
      const error = await response.json();
      return {
        success: false,
        error: error.error?.message || 'Failed to search files'
      };
    }

    const data = await response.json();
    return {
      success: true,
      files: data.files || []
    };
  } catch (error) {
    console.error('Error searching Drive files:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Get file content from Google Drive (for text-based files)
 */
export async function getDriveFileContent(fileId: string, mimeType: string): Promise<{
  success: boolean;
  content?: string;
  error?: string;
}> {
  if (!isSignedIn()) {
    return { success: false, error: 'Not signed in' };
  }

  try {
    let exportMimeType = 'text/plain';
    
    // Determine export format based on file type
    if (mimeType === 'application/vnd.google-apps.document') {
      exportMimeType = 'text/plain';
    } else if (mimeType === 'application/vnd.google-apps.spreadsheet') {
      exportMimeType = 'text/csv';
    } else if (mimeType === 'application/vnd.google-apps.presentation') {
      exportMimeType = 'text/plain';
    }
    
    // For Google Workspace files, use export
    if (mimeType.startsWith('application/vnd.google-apps.')) {
      const url = `${DRIVE_API}/${fileId}/export?mimeType=${encodeURIComponent(exportMimeType)}`;
      const response = await googleFetch(url);
      
      if (!response.ok) {
        throw new Error('Failed to export file');
      }
      
      const content = await response.text();
      return { success: true, content };
    } else {
      // For regular files, download directly
      const url = `${DRIVE_API}/${fileId}?alt=media`;
      const response = await googleFetch(url);
      
      if (!response.ok) {
        throw new Error('Failed to download file');
      }
      
      const content = await response.text();
      return { success: true, content };
    }
  } catch (error) {
    console.error('Error getting file content:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Get a Google Doc by ID
 */
export async function getGoogleDoc(documentId: string): Promise<{
  success: boolean;
  document?: any;
  error?: string;
}> {
  if (!isSignedIn()) {
    return { success: false, error: 'Not signed in' };
  }

  try {
    const response = await googleFetch(`${DOCS_API}/${documentId}`);

    if (!response.ok) {
      const error = await response.json();
      return {
        success: false,
        error: error.error?.message || 'Failed to get document'
      };
    }

    const doc = await response.json();
    return { success: true, document: doc };
  } catch (error) {
    console.error('Error getting Google Doc:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Append content to an existing Google Doc
 */
export async function appendToGoogleDoc(
  documentId: string,
  content: string,
  format: 'markdown' | 'text' = 'text'
): Promise<DocUpdateResult> {
  if (!isSignedIn()) {
    return { success: false, error: 'Not signed in' };
  }

  try {
    // Get the document to find the end index
    const getResponse = await googleFetch(`${DOCS_API}/${documentId}`);
    if (!getResponse.ok) {
      return { success: false, error: 'Failed to read document' };
    }

    const doc = await getResponse.json();
    const bodyContent = doc.body?.content || [];
    const lastElement = bodyContent[bodyContent.length - 1];
    const endIndex = lastElement?.endIndex ? lastElement.endIndex - 1 : 1;

    // Add a newline before the new content
    const textToAdd = '\n\n' + content;
    
    const requests: any[] = [{
      insertText: {
        location: { index: endIndex },
        text: textToAdd
      }
    }];

    const updateResponse = await googleFetch(`${DOCS_API}/${documentId}:batchUpdate`, {
      method: 'POST',
      body: JSON.stringify({ requests })
    });

    if (!updateResponse.ok) {
      const error = await updateResponse.json();
      return {
        success: false,
        error: error.error?.message || 'Failed to append to document'
      };
    }

    return { success: true };
  } catch (error) {
    console.error('Error appending to Google Doc:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Delete a Google Doc
 */
export async function deleteGoogleDoc(documentId: string): Promise<{ success: boolean; error?: string }> {
  if (!isSignedIn()) {
    return { success: false, error: 'Not signed in' };
  }

  try {
    const response = await googleFetch(`${DRIVE_API}/${documentId}`, {
      method: 'DELETE'
    });

    if (!response.ok && response.status !== 204) {
      const error = await response.json();
      return {
        success: false,
        error: error.error?.message || 'Failed to delete document'
      };
    }

    return { success: true };
  } catch (error) {
    console.error('Error deleting Google Doc:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Export research paper to Google Docs
 * Handles markdown conversion and proper formatting
 */
export async function exportResearchPaperToGoogleDocs(
  title: string,
  content: string,
  options: {
    includeTimestamp?: boolean;
    folderName?: string;
  } = {}
): Promise<DocCreateResult> {
  const { includeTimestamp = true } = options;
  
  // Add timestamp to title if requested
  const docTitle = includeTimestamp 
    ? `${title} - ${new Date().toLocaleDateString()}`
    : title;

  // Create document with content
  const result = await createGoogleDocWithContent(docTitle, content, 'markdown');
  
  if (result.success && result.document) {
    console.log(`Research paper exported to Google Docs: ${result.document.documentUrl}`);
  }
  
  return result;
}

/**
 * Export research paper to Google Docs (alias for GoogleDocsIntegration component)
 * Returns the document URL on success
 */
export async function exportResearchPaperToDocs(
  title: string,
  content: string,
  metadata?: {
    abstract?: string;
    keywords?: string[];
    author?: string;
    date?: string;
  }
): Promise<string> {
  // Build content with metadata if provided
  let fullContent = content;
  
  if (metadata) {
    const metadataSection: string[] = [];
    if (metadata.author) metadataSection.push(`**Author:** ${metadata.author}`);
    if (metadata.date) metadataSection.push(`**Date:** ${metadata.date}`);
    if (metadata.abstract) metadataSection.push(`\n**Abstract:**\n${metadata.abstract}`);
    if (metadata.keywords?.length) metadataSection.push(`\n**Keywords:** ${metadata.keywords.join(', ')}`);
    
    if (metadataSection.length > 0) {
      fullContent = metadataSection.join('\n') + '\n\n---\n\n' + content;
    }
  }

  const result = await exportResearchPaperToGoogleDocs(title, fullContent, { includeTimestamp: true });
  
  if (!result.success || !result.document?.documentUrl) {
    throw new Error(result.error || 'Failed to export document');
  }
  
  return result.document.documentUrl;
}

/**
 * Export Deep Agent conversation to Google Docs
 */
export async function exportDeepAgentOutputToDocs(
  title: string,
  conversationHistory: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp?: Date;
  }>
): Promise<string> {
  // Format conversation history as markdown
  const formattedContent = conversationHistory.map(msg => {
    const timestamp = msg.timestamp ? ` (${msg.timestamp.toLocaleString()})` : '';
    const role = msg.role === 'user' ? '**User**' : '**Assistant**';
    return `### ${role}${timestamp}\n\n${msg.content}`;
  }).join('\n\n---\n\n');

  const fullContent = `# ${title}\n\n*Exported from Deep Agent on ${new Date().toLocaleString()}*\n\n---\n\n${formattedContent}`;

  const result = await createGoogleDocWithContent(title, fullContent, 'markdown');
  
  if (!result.success || !result.document?.documentUrl) {
    throw new Error(result.error || 'Failed to export Deep Agent output');
  }
  
  return result.document.documentUrl;
}

/**
 * Get recent documents from Google Drive
 */
export async function getRecentDocuments(maxResults: number = 10): Promise<DocumentInfo[]> {
  const result = await listGoogleDocs(maxResults);
  
  if (!result.success || !result.documents) {
    return [];
  }
  
  return result.documents;
}

export default {
  createGoogleDoc,
  updateGoogleDoc,
  createGoogleDocWithContent,
  listGoogleDocs,
  getGoogleDoc,
  appendToGoogleDoc,
  deleteGoogleDoc,
  exportResearchPaperToGoogleDocs,
  exportResearchPaperToDocs,
  exportDeepAgentOutputToDocs,
  getRecentDocuments
};
