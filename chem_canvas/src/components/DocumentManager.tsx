/**
 * Document Manager Component
 * Allows users to upload PDFs and view/manage their stored documents
 * Uses localStorage for document storage (no cloud backend)
 */

import React, { useState, useEffect } from 'react';
import { Upload, Trash2, FileText, Clock, HardDrive, AlertCircle, CheckCircle, Download } from 'lucide-react';
import { auth } from '../firebase/config';

interface StoredDocument {
  id: string;
  name: string;
  url: string;
  uploadedAt: string;
  size: number;
}

interface DocumentManagerProps {
  onDocumentSelected?: (document: StoredDocument) => void;
}

const STORAGE_KEY = 'chem_canvas_documents';

// Helper functions for localStorage
const getStoredDocuments = (userId: string): StoredDocument[] => {
  try {
    const data = localStorage.getItem(`${STORAGE_KEY}_${userId}`);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Error reading documents from localStorage:', error);
    return [];
  }
};

const saveDocuments = (userId: string, docs: StoredDocument[]) => {
  try {
    localStorage.setItem(`${STORAGE_KEY}_${userId}`, JSON.stringify(docs));
  } catch (error) {
    console.error('Error saving documents to localStorage:', error);
  }
};

export const DocumentManager: React.FC<DocumentManagerProps> = ({ onDocumentSelected }) => {
  const [documents, setDocuments] = useState<StoredDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Load user's documents from localStorage on mount
  useEffect(() => {
    const loadDocuments = () => {
      try {
        setLoading(true);
        setError(null);
        if (!auth.currentUser) {
          throw new Error('User not authenticated');
        }
        const docs = getStoredDocuments(auth.currentUser.uid);
        setDocuments(docs);
      } catch (err) {
        console.error('[DocumentManager] Error loading documents:', err);
        setError(err instanceof Error ? err.message : 'Failed to load documents');
      } finally {
        setLoading(false);
      }
    };

    if (auth.currentUser) {
      loadDocuments();
    }
  }, []);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.includes('pdf')) {
      setError('Only PDF files are supported');
      return;
    }

    // Validate file size (max 50 MB for localStorage)
    if (file.size > 50 * 1024 * 1024) {
      setError('File size must be less than 50 MB');
      return;
    }

    try {
      setUploading(true);
      setError(null);
      console.log('[DocumentManager] Uploading file:', file.name);

      if (!auth.currentUser) {
        throw new Error('User not authenticated');
      }

      // Convert file to base64 data URL
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const dataUrl = await base64Promise;

      const newDoc: StoredDocument = {
        id: `${Date.now()}-${file.name}`,
        name: file.name,
        url: dataUrl, // Data URL for localStorage
        uploadedAt: new Date().toISOString(),
        size: file.size,
      };

      // Save to localStorage
      const currentDocs = getStoredDocuments(auth.currentUser.uid);
      const updatedDocs = [newDoc, ...currentDocs];
      saveDocuments(auth.currentUser.uid, updatedDocs);

      // Update UI
      setDocuments(updatedDocs);
      setSuccess(`✓ "${file.name}" saved successfully!`);

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);

      // Reset file input
      event.target.value = '';
    } catch (err) {
      console.error('[DocumentManager] Upload error:', err);
      setError(err instanceof Error ? err.message : 'Failed to save document');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (docId: string, docName: string) => {
    if (!window.confirm(`Delete "${docName}"? This cannot be undone.`)) {
      return;
    }

    try {
      setError(null);
      console.log('[DocumentManager] Deleting document:', docId);

      if (!auth.currentUser) {
        throw new Error('User not authenticated');
      }

      // Delete from localStorage
      const currentDocs = getStoredDocuments(auth.currentUser.uid);
      const updatedDocs = currentDocs.filter((doc) => doc.id !== docId);
      saveDocuments(auth.currentUser.uid, updatedDocs);

      // Remove from UI
      setDocuments(updatedDocs);
      setSuccess(`✓ "${docName}" deleted`);

      setTimeout(() => setSuccess(null), 2000);
    } catch (err) {
      console.error('[DocumentManager] Delete error:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete document');
    }
  };

  const handleSelectDocument = (doc: StoredDocument) => {
    onDocumentSelected?.(doc);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateInput: string | Date): string => {
    const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
    });
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-6 bg-slate-900 rounded-lg border border-slate-700">
      <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
        <FileText className="h-6 w-6 text-blue-400" />
        My Documents
      </h2>

      {/* Upload Section */}
      <div className="mb-6 p-4 bg-slate-800/50 border-2 border-dashed border-slate-600 rounded-lg hover:border-blue-500 transition-colors">
        <label className="flex items-center justify-center cursor-pointer">
          <input
            type="file"
            accept=".pdf"
            onChange={handleFileUpload}
            disabled={uploading}
            className="hidden"
          />
          <div className="text-center">
            <Upload className="h-8 w-8 text-slate-400 mx-auto mb-2" />
            <p className="text-slate-300 font-medium">
              {uploading ? 'Uploading...' : 'Click to upload PDF or drag and drop'}
            </p>
            <p className="text-xs text-slate-500 mt-1">Max 50 MB • PDF only</p>
          </div>
        </label>
      </div>

      {/* Messages */}
      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/50 rounded-lg flex items-start gap-3 text-sm text-red-200">
          <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 bg-green-500/10 border border-green-500/50 rounded-lg flex items-start gap-3 text-sm text-green-200">
          <CheckCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
          <span>{success}</span>
        </div>
      )}

      {/* Documents List */}
      <div>
        <h3 className="text-sm font-semibold text-slate-300 mb-3 uppercase tracking-wide">
          {documents.length} Document{documents.length !== 1 ? 's' : ''}
        </h3>

        {loading ? (
          <div className="text-center py-8 text-slate-400">
            <div className="inline-flex items-center gap-2">
              <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full" />
              Loading documents...
            </div>
          </div>
        ) : documents.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No documents yet. Upload your first PDF to get started!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between p-3 bg-slate-800/50 border border-slate-700 rounded-lg hover:bg-slate-800 transition-colors group"
              >
                <button
                  onClick={() => handleSelectDocument(doc)}
                  className="flex-1 text-left hover:text-blue-300 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-blue-400 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-200 truncate">{doc.name}</p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                        <div className="flex items-center gap-1">
                          <HardDrive className="h-3 w-3" />
                          {formatFileSize(doc.size)}
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDate(doc.uploadedAt)}
                        </div>
                      </div>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => handleDelete(doc.id, doc.name)}
                  className="ml-3 p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors opacity-0 group-hover:opacity-100"
                  title="Delete document"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="text-xs text-slate-500 mt-4">
        💾 Documents are stored locally in your browser and organized by user.
      </p>
    </div>
  );
};

export default DocumentManager;
