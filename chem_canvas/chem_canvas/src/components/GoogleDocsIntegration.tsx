/**
 * Google Docs Integration Component
 * 
 * Allows users to:
 * - Connect their Google account
 * - Export research papers and Deep Agent outputs to Google Docs
 * - View and manage their documents
 */

import React, { useState, useEffect, useCallback } from 'react';
import { 
  FileText, 
  LogOut, 
  ExternalLink, 
  Loader2, 
  CheckCircle, 
  AlertCircle,
  RefreshCw,
  FolderOpen,
  Upload,
  X,
  UploadCloud
} from 'lucide-react';
import {
  initializeGoogleAuth,
  signInWithGoogle,
  signOut,
  getAccessToken,
  getCurrentUser,
  isGoogleAuthInitialized,
  GoogleUserInfo
} from '../services/googleAuthService';
import {
  exportResearchPaperToDocs,
  exportDeepAgentOutputToDocs,
  getRecentDocuments,
  DocumentInfo
} from '../services/googleDocsService';

interface GoogleDocsIntegrationProps {
  isOpen: boolean;
  onClose: () => void;
  // Content to export
  content?: string;
  title?: string;
  exportType?: 'research-paper' | 'deep-agent';
  // For research paper export
  paperMetadata?: {
    abstract?: string;
    keywords?: string[];
    author?: string;
    date?: string;
  };
  // For deep agent export
  conversationHistory?: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp?: Date;
  }>;
  onExportSuccess?: (docUrl: string) => void;
}

export const GoogleDocsIntegration: React.FC<GoogleDocsIntegrationProps> = ({
  isOpen,
  onClose,
  content,
  title,
  exportType = 'research-paper',
  paperMetadata,
  conversationHistory,
  onExportSuccess
}) => {
  const [isInitializing, setIsInitializing] = useState(true);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [user, setUser] = useState<GoogleUserInfo | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [exportedDocUrl, setExportedDocUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [recentDocs, setRecentDocs] = useState<DocumentInfo[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(false);

  // Initialize Google Auth
  useEffect(() => {
    const initAuth = async () => {
      setIsInitializing(true);
      try {
        const initialized = await initializeGoogleAuth();
        if (initialized) {
          const token = await getAccessToken();
          if (token) {
            const currentUser = await getCurrentUser();
            setUser(currentUser);
            setIsSignedIn(!!currentUser);
          }
        }
      } catch (error) {
        console.error('Failed to initialize Google Auth:', error);
      } finally {
        setIsInitializing(false);
      }
    };

    if (isOpen) {
      initAuth();
    }
  }, [isOpen]);

  // Load recent docs when signed in
  useEffect(() => {
    const loadRecentDocs = async () => {
      if (isSignedIn) {
        setIsLoadingDocs(true);
        try {
          const docs = await getRecentDocuments();
          setRecentDocs(docs);
        } catch (error) {
          console.error('Failed to load recent docs:', error);
        } finally {
          setIsLoadingDocs(false);
        }
      }
    };

    loadRecentDocs();
  }, [isSignedIn]);

  const handleSignIn = async () => {
    try {
      const userInfo = await signInWithGoogle();
      if (userInfo) {
        setUser(userInfo);
        setIsSignedIn(true);
      }
    } catch (error) {
      console.error('Sign in failed:', error);
      setErrorMessage('Failed to sign in with Google. Please try again.');
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      setUser(null);
      setIsSignedIn(false);
      setRecentDocs([]);
    } catch (error) {
      console.error('Sign out failed:', error);
    }
  };

  const handleExport = async () => {
    if (!content && !conversationHistory) {
      setErrorMessage('No content to export');
      return;
    }

    setIsExporting(true);
    setExportStatus('idle');
    setErrorMessage(null);

    try {
      let docUrl: string;

      if (exportType === 'research-paper' && content) {
        docUrl = await exportResearchPaperToDocs(
          title || 'Research Paper',
          content,
          paperMetadata
        );
      } else if (exportType === 'deep-agent' && conversationHistory) {
        docUrl = await exportDeepAgentOutputToDocs(
          title || 'Deep Agent Research',
          conversationHistory
        );
      } else if (content) {
        // Fallback to research paper export
        docUrl = await exportResearchPaperToDocs(
          title || 'Document',
          content
        );
      } else {
        throw new Error('No content to export');
      }

      setExportedDocUrl(docUrl);
      setExportStatus('success');
      onExportSuccess?.(docUrl);
    } catch (error) {
      console.error('Export failed:', error);
      setExportStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Export failed');
    } finally {
      setIsExporting(false);
    }
  };

  const refreshDocs = async () => {
    setIsLoadingDocs(true);
    try {
      const docs = await getRecentDocuments();
      setRecentDocs(docs);
    } catch (error) {
      console.error('Failed to refresh docs:', error);
    } finally {
      setIsLoadingDocs(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-xl border border-gray-700 w-full max-w-lg mx-4 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <FileText className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Google Docs</h2>
              <p className="text-xs text-gray-400">Export your work to Google Docs</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {isInitializing ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
              <span className="ml-2 text-gray-400">Connecting to Google...</span>
            </div>
          ) : !isSignedIn ? (
            /* Sign In View */
            <div className="text-center py-6">
              <div className="w-16 h-16 mx-auto mb-4 bg-blue-500/20 rounded-full flex items-center justify-center">
                <UploadCloud className="w-8 h-8 text-blue-400" />
              </div>
              <h3 className="text-lg font-medium text-white mb-2">
                Connect Your Google Account
              </h3>
              <p className="text-gray-400 text-sm mb-6">
                Sign in with Google to save your research papers and documents directly to Google Docs.
              </p>
              <button
                onClick={handleSignIn}
                className="flex items-center gap-3 mx-auto px-6 py-3 bg-white hover:bg-gray-100 text-gray-800 rounded-lg font-medium transition-colors"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
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
              {errorMessage && (
                <p className="mt-4 text-red-400 text-sm">{errorMessage}</p>
              )}
            </div>
          ) : (
            /* Signed In View */
            <div className="space-y-4">
              {/* User Info */}
              <div className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                <div className="flex items-center gap-3">
                  {user?.picture ? (
                    <img
                      src={user.picture}
                      alt={user.name}
                      className="w-10 h-10 rounded-full"
                    />
                  ) : (
                    <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-medium">
                      {user?.name?.charAt(0) || 'U'}
                    </div>
                  )}
                  <div>
                    <p className="text-white font-medium">{user?.name}</p>
                    <p className="text-gray-400 text-sm">{user?.email}</p>
                  </div>
                </div>
                <button
                  onClick={handleSignOut}
                  className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                  title="Sign out"
                >
                  <LogOut className="w-4 h-4 text-gray-400" />
                </button>
              </div>

              {/* Export Section */}
              {(content || conversationHistory) && (
                <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                  <h4 className="text-sm font-medium text-white mb-2">
                    Export to Google Docs
                  </h4>
                  <p className="text-xs text-gray-400 mb-3">
                    {exportType === 'research-paper'
                      ? 'Your research paper will be exported with proper formatting.'
                      : 'Your conversation and final document will be exported.'}
                  </p>
                  <div className="flex items-center gap-2 mb-3 p-2 bg-gray-900/50 rounded">
                    <FileText className="w-4 h-4 text-blue-400" />
                    <span className="text-sm text-gray-300 truncate flex-1">
                      {title || 'Untitled Document'}
                    </span>
                  </div>

                  {exportStatus === 'success' && exportedDocUrl ? (
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2 text-green-400">
                        <CheckCircle className="w-4 h-4" />
                        <span className="text-sm">Successfully exported!</span>
                      </div>
                      <a
                        href={exportedDocUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                      >
                        <ExternalLink className="w-4 h-4" />
                        Open in Google Docs
                      </a>
                    </div>
                  ) : exportStatus === 'error' ? (
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2 text-red-400">
                        <AlertCircle className="w-4 h-4" />
                        <span className="text-sm">{errorMessage}</span>
                      </div>
                      <button
                        onClick={handleExport}
                        disabled={isExporting}
                        className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 text-white rounded-lg transition-colors"
                      >
                        Try Again
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={handleExport}
                      disabled={isExporting}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 text-white rounded-lg transition-colors"
                    >
                      {isExporting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Exporting...
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4" />
                          Export to Google Docs
                        </>
                      )}
                    </button>
                  )}
                </div>
              )}

              {/* Recent Documents */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-medium text-white">Recent Documents</h4>
                  <button
                    onClick={refreshDocs}
                    disabled={isLoadingDocs}
                    className="p-1 hover:bg-gray-700 rounded transition-colors"
                    title="Refresh"
                  >
                    <RefreshCw className={`w-4 h-4 text-gray-400 ${isLoadingDocs ? 'animate-spin' : ''}`} />
                  </button>
                </div>
                
                {isLoadingDocs ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
                  </div>
                ) : recentDocs.length > 0 ? (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {recentDocs.map((doc) => (
                      <a
                        key={doc.documentId}
                        href={doc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 p-2 hover:bg-gray-800 rounded-lg transition-colors group"
                      >
                        <FileText className="w-4 h-4 text-blue-400" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-300 truncate group-hover:text-white">
                            {doc.title}
                          </p>
                          {doc.lastModified && (
                            <p className="text-xs text-gray-500">
                              {new Date(doc.lastModified).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                        <ExternalLink className="w-3 h-3 text-gray-500 group-hover:text-gray-300" />
                      </a>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-center py-4 text-gray-500">
                    <FolderOpen className="w-5 h-5 mr-2" />
                    <span className="text-sm">No recent documents</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-700 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * Compact button for triggering Google Docs export
 */
export const GoogleDocsExportButton: React.FC<{
  content: string;
  title: string;
  exportType?: 'research-paper' | 'deep-agent';
  paperMetadata?: {
    abstract?: string;
    keywords?: string[];
    author?: string;
    date?: string;
  };
  conversationHistory?: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp?: Date;
  }>;
  variant?: 'default' | 'compact' | 'icon-only';
  className?: string;
}> = ({
  content,
  title,
  exportType = 'research-paper',
  paperMetadata,
  conversationHistory,
  variant = 'default',
  className = ''
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);

  const handleExportSuccess = (docUrl: string) => {
    setExportSuccess(true);
    setTimeout(() => setExportSuccess(false), 3000);
  };

  return (
    <>
      {variant === 'icon-only' ? (
        <button
          onClick={() => setIsModalOpen(true)}
          className={`p-2 hover:bg-gray-700 rounded-lg transition-colors ${className}`}
          title="Save to Google Docs"
        >
          {exportSuccess ? (
            <CheckCircle className="w-5 h-5 text-green-400" />
          ) : (
            <FileText className="w-5 h-5 text-gray-400 hover:text-white" />
          )}
        </button>
      ) : variant === 'compact' ? (
        <button
          onClick={() => setIsModalOpen(true)}
          className={`flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white rounded-lg transition-colors ${className}`}
        >
          <FileText className="w-4 h-4" />
          <span>Google Docs</span>
        </button>
      ) : (
        <button
          onClick={() => setIsModalOpen(true)}
          className={`flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors ${className}`}
        >
          <FileText className="w-4 h-4" />
          <span>Save to Google Docs</span>
        </button>
      )}

      <GoogleDocsIntegration
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        content={content}
        title={title}
        exportType={exportType}
        paperMetadata={paperMetadata}
        conversationHistory={conversationHistory}
        onExportSuccess={handleExportSuccess}
      />
    </>
  );
};

export default GoogleDocsIntegration;
