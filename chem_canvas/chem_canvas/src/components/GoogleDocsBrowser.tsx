/**
 * Google Docs Browser Component
 * 
 * Allows users to sign in with Google and browse/view their Google Docs
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  LogIn,
  LogOut,
  RefreshCw,
  Loader2,
  ExternalLink,
  Search,
  FolderOpen,
  AlertCircle,
  CheckCircle2,
  User,
  ChevronRight,
  Clock,
  Eye
} from 'lucide-react';
import {
  initGoogleAuth,
  signInWithGoogle,
  signOutGoogle,
  subscribeToAuthState,
  getAccessToken,
  isGoogleAuthConfigured,
  GoogleAuthState,
  GoogleUser
} from '../services/googleAuthService';

// ==========================================
// Types
// ==========================================

interface GoogleDocItem {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  webViewLink: string;
  iconLink?: string;
}

interface GoogleDocContent {
  documentId: string;
  title: string;
  body: any;
}

interface GoogleDocsBrowserProps {
  onDocumentSelect?: (doc: GoogleDocItem, content: string) => void;
  onContentLoad?: (content: string, title: string) => void;
  className?: string;
}

// ==========================================
// Component
// ==========================================

export const GoogleDocsBrowser: React.FC<GoogleDocsBrowserProps> = ({
  onDocumentSelect,
  onContentLoad,
  className = ''
}) => {
  // Auth state
  const [authState, setAuthState] = useState<GoogleAuthState>({
    isSignedIn: false,
    user: null,
    isLoading: true,
    error: null
  });

  // Documents state
  const [documents, setDocuments] = useState<GoogleDocItem[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(false);
  const [docsError, setDocsError] = useState<string | null>(null);
  
  // Selected document
  const [selectedDoc, setSelectedDoc] = useState<GoogleDocItem | null>(null);
  const [docContent, setDocContent] = useState<string>('');
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  
  // Search
  const [searchQuery, setSearchQuery] = useState('');

  // Initialize auth on mount
  useEffect(() => {
    initGoogleAuth();
    
    const unsubscribe = subscribeToAuthState((state) => {
      setAuthState(state);
      if (state.isSignedIn && !documents.length) {
        loadDocuments();
      }
    });

    return () => unsubscribe();
  }, []);

  // Load user's documents
  const loadDocuments = useCallback(async () => {
    setIsLoadingDocs(true);
    setDocsError(null);

    try {
      const token = await getAccessToken();
      if (!token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files?` +
        `pageSize=50&` +
        `q=mimeType='application/vnd.google-apps.document'&` +
        `fields=files(id,name,mimeType,modifiedTime,webViewLink,iconLink)&` +
        `orderBy=modifiedTime desc`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to load documents');
      }

      const data = await response.json();
      setDocuments(data.files || []);
    } catch (err) {
      console.error('Failed to load documents:', err);
      setDocsError(err instanceof Error ? err.message : 'Failed to load documents');
    } finally {
      setIsLoadingDocs(false);
    }
  }, []);

  // Load document content
  const loadDocumentContent = useCallback(async (doc: GoogleDocItem) => {
    setSelectedDoc(doc);
    setIsLoadingContent(true);

    try {
      const token = await getAccessToken();
      if (!token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(
        `https://docs.googleapis.com/v1/documents/${doc.id}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to load document');
      }

      const docData: GoogleDocContent = await response.json();
      
      // Extract text content from document body
      const content = extractTextFromDoc(docData);
      setDocContent(content);
      
      onDocumentSelect?.(doc, content);
      onContentLoad?.(content, doc.name);
    } catch (err) {
      console.error('Failed to load document content:', err);
      setDocContent('Error loading document content');
    } finally {
      setIsLoadingContent(false);
    }
  }, [onDocumentSelect, onContentLoad]);

  // Extract text from Google Doc body structure
  const extractTextFromDoc = (doc: GoogleDocContent): string => {
    if (!doc.body?.content) return '';

    let text = '';
    for (const element of doc.body.content) {
      if (element.paragraph?.elements) {
        for (const elem of element.paragraph.elements) {
          if (elem.textRun?.content) {
            text += elem.textRun.content;
          }
        }
      }
    }
    return text;
  };

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    return date.toLocaleDateString();
  };

  // Filter documents by search
  const filteredDocs = documents.filter(doc =>
    doc.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // ==========================================
  // Render - Not Configured
  // ==========================================
  
  if (!isGoogleAuthConfigured()) {
    return (
      <div className={`flex flex-col h-full bg-gray-900 rounded-lg ${className}`}>
        <div className="flex items-center justify-center flex-1 p-8">
          <div className="text-center max-w-md">
            <div className="w-16 h-16 mx-auto mb-4 bg-yellow-500/20 rounded-full flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-yellow-500" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Google Docs Not Configured</h3>
            <p className="text-gray-400 text-sm mb-4">
              To use Google Docs integration, you need to configure your Google Cloud credentials.
            </p>
            <div className="bg-gray-800 rounded-lg p-4 text-left text-sm">
              <p className="text-gray-300 mb-2">Add to your <code className="bg-gray-700 px-1 rounded">.env</code> file:</p>
              <code className="text-green-400 block">
                VITE_GOOGLE_CLIENT_ID=your_client_id
              </code>
            </div>
            <a
              href="https://console.cloud.google.com/apis/credentials"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 mt-4 text-blue-400 hover:text-blue-300 text-sm"
            >
              Get credentials from Google Cloud Console
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // Render - Loading Auth
  // ==========================================
  
  if (authState.isLoading) {
    return (
      <div className={`flex flex-col h-full bg-gray-900 rounded-lg ${className}`}>
        <div className="flex items-center justify-center flex-1">
          <div className="text-center">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-3" />
            <p className="text-gray-400">Initializing Google Auth...</p>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // Render - Not Signed In
  // ==========================================
  
  if (!authState.isSignedIn) {
    return (
      <div className={`flex flex-col h-full bg-gray-900 rounded-lg ${className}`}>
        <div className="flex items-center justify-center flex-1 p-8">
          <div className="text-center max-w-sm">
            <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
              <FileText className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Google Docs</h2>
            <p className="text-gray-400 mb-6">
              Sign in with your Google account to access and view your documents.
            </p>
            
            {authState.error && (
              <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 mb-4 text-left">
                <p className="text-red-400 text-sm">{authState.error}</p>
              </div>
            )}

            <button
              onClick={signInWithGoogle}
              className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-white hover:bg-gray-100 text-gray-800 font-medium rounded-lg transition-colors shadow-lg"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Sign in with Google
            </button>

            <p className="text-gray-500 text-xs mt-4">
              We only request access to view your Google Docs.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // Render - Signed In (Main UI)
  // ==========================================
  
  const user = authState.user!;

  return (
    <div className={`flex flex-col h-full bg-gray-900 rounded-lg overflow-hidden ${className}`}>
      {/* Header */}
      <div className="flex-shrink-0 bg-gray-800 border-b border-gray-700">
        {/* User info bar */}
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {user.picture ? (
              <img
                src={user.picture}
                alt={user.name}
                className="w-8 h-8 rounded-full"
              />
            ) : (
              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                <User className="w-4 h-4 text-white" />
              </div>
            )}
            <div>
              <p className="text-sm font-medium text-white">{user.name}</p>
              <p className="text-xs text-gray-400">{user.email}</p>
            </div>
          </div>
          <button
            onClick={signOutGoogle}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>

        {/* Search bar */}
        <div className="px-4 pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Document list */}
        <div className="w-1/2 border-r border-gray-700 overflow-y-auto">
          {/* Toolbar */}
          <div className="sticky top-0 bg-gray-850 px-4 py-2 flex items-center justify-between border-b border-gray-700">
            <h3 className="text-sm font-medium text-gray-300 flex items-center gap-2">
              <FolderOpen className="w-4 h-4" />
              My Documents
            </h3>
            <button
              onClick={loadDocuments}
              disabled={isLoadingDocs}
              className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isLoadingDocs ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Loading state */}
          {isLoadingDocs && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
            </div>
          )}

          {/* Error state */}
          {docsError && (
            <div className="p-4">
              <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3">
                <p className="text-red-400 text-sm">{docsError}</p>
                <button
                  onClick={loadDocuments}
                  className="text-red-300 hover:text-red-200 text-sm underline mt-2"
                >
                  Try again
                </button>
              </div>
            </div>
          )}

          {/* Empty state */}
          {!isLoadingDocs && !docsError && filteredDocs.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <FileText className="w-12 h-12 text-gray-600 mb-3" />
              <p className="text-gray-400 mb-4">
                {searchQuery ? 'No documents match your search' : 'No documents found'}
              </p>
              {!searchQuery && (
                <div className="bg-gray-800 p-4 rounded-lg max-w-xs">
                  <p className="text-xs text-gray-400 mb-3">
                    If you have documents but can't see them, you may need to grant additional permissions.
                  </p>
                  <button
                    onClick={() => {
                      signOutGoogle();
                      // The UI will update to show sign in button
                    }}
                    className="text-blue-400 hover:text-blue-300 text-xs font-medium underline"
                  >
                    Sign out and re-authorize
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Document list */}
          <div className="divide-y divide-gray-700">
            {filteredDocs.map((doc) => (
              <button
                key={doc.id}
                onClick={() => loadDocumentContent(doc)}
                className={`w-full px-4 py-3 flex items-start gap-3 text-left hover:bg-gray-800 transition-colors ${
                  selectedDoc?.id === doc.id ? 'bg-gray-800 border-l-2 border-blue-500' : ''
                }`}
              >
                <div className="flex-shrink-0 w-8 h-8 bg-blue-500/20 rounded flex items-center justify-center mt-0.5">
                  <FileText className="w-4 h-4 text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{doc.name}</p>
                  <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                    <Clock className="w-3 h-3" />
                    {formatDate(doc.modifiedTime)}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-500 flex-shrink-0 mt-1" />
              </button>
            ))}
          </div>
        </div>

        {/* Document preview */}
        <div className="w-1/2 bg-gray-850 overflow-y-auto">
          {!selectedDoc ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
              <Eye className="w-12 h-12 text-gray-600 mb-3" />
              <p className="text-gray-400">Select a document to preview</p>
            </div>
          ) : isLoadingContent ? (
            <div className="flex flex-col items-center justify-center h-full">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-3" />
              <p className="text-gray-400">Loading document...</p>
            </div>
          ) : (
            <div className="p-6">
              {/* Document header */}
              <div className="mb-6 pb-4 border-b border-gray-700">
                <h2 className="text-xl font-bold text-white mb-2">{selectedDoc.name}</h2>
                <div className="flex items-center gap-4 text-sm text-gray-400">
                  <span className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    Last modified: {formatDate(selectedDoc.modifiedTime)}
                  </span>
                  <a
                    href={selectedDoc.webViewLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-blue-400 hover:text-blue-300"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Open in Google Docs
                  </a>
                </div>
              </div>

              {/* Document content */}
              <div className="prose prose-invert prose-sm max-w-none">
                <pre className="whitespace-pre-wrap text-gray-300 font-sans text-sm leading-relaxed bg-transparent p-0">
                  {docContent || 'No content'}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GoogleDocsBrowser;
