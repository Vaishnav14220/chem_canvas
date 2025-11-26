/**
 * Live Document Preview Component
 * 
 * Shows a live preview of the document being written by Deep Agent.
 * No Google authentication required - displays content in an embedded document-like view.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  FileText,
  ExternalLink,
  Loader2,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Copy,
  Download,
  Maximize2,
  Minimize2,
  Eye,
  EyeOff,
  Cloud,
  Edit3,
  Save,
  X,
  Printer,
  Share2
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

// ==========================================
// Types
// ==========================================

export interface GoogleDocsEmbeddedProps {
  /** Document ID if editing existing doc */
  documentId?: string;
  /** Initial title for new document */
  title?: string;
  /** Content to write/stream to the document */
  content?: string;
  /** Whether content is being streamed */
  isStreaming?: boolean;
  /** Callback when document is created */
  onDocumentCreated?: (doc: { documentId: string; title: string; documentUrl?: string }) => void;
  /** Callback when document is updated */
  onDocumentUpdated?: (doc: { documentId: string; title: string; documentUrl?: string }) => void;
  /** Callback on error */
  onError?: (error: string) => void;
  /** Whether to auto-create a new document */
  autoCreate?: boolean;
  /** Height of the embedded view */
  height?: string;
  /** Whether to show in compact mode */
  compact?: boolean;
  /** Class name for styling */
  className?: string;
}

// ==========================================
// Component
// ==========================================

export const GoogleDocsEmbedded: React.FC<GoogleDocsEmbeddedProps> = ({
  documentId: propDocumentId,
  title = 'Deep Agent Report',
  content = '',
  isStreaming = false,
  onDocumentCreated,
  onDocumentUpdated,
  onError,
  autoCreate = false,
  height = '400px',
  compact = false,
  className = ''
}) => {
  // Document state
  const [docTitle, setDocTitle] = useState(title);
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState(title);
  const [isExpanded, setIsExpanded] = useState(false);
  const [writeProgress, setWriteProgress] = useState(0);
  const [charactersWritten, setCharactersWritten] = useState(0);
  const [lastContent, setLastContent] = useState('');
  const [wordCount, setWordCount] = useState(0);

  // Refs
  const contentRef = useRef<HTMLDivElement>(null);
  const lastContentRef = useRef<string>('');

  // Update title when prop changes
  useEffect(() => {
    setDocTitle(title);
    setEditedTitle(title);
  }, [title]);

  // Handle content changes and streaming
  useEffect(() => {
    if (content !== lastContentRef.current) {
      const newChars = content.length - lastContentRef.current.length;
      setCharactersWritten(prev => prev + Math.max(0, newChars));
      lastContentRef.current = content;
      setLastContent(content);
      
      // Calculate word count
      const words = content.trim().split(/\s+/).filter(w => w.length > 0);
      setWordCount(words.length);
    }
  }, [content]);

  // Streaming progress animation
  useEffect(() => {
    if (isStreaming) {
      const interval = setInterval(() => {
        setWriteProgress(prev => (prev >= 100 ? 0 : prev + 5));
      }, 100);
      return () => clearInterval(interval);
    } else {
      setWriteProgress(100);
    }
  }, [isStreaming]);

  // Auto-scroll to bottom when streaming
  useEffect(() => {
    if (isStreaming && contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [content, isStreaming]);

  // Copy content to clipboard
  const copyContent = () => {
    navigator.clipboard.writeText(content);
  };

  // Download as markdown
  const downloadMarkdown = () => {
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${docTitle.replace(/[^a-zA-Z0-9]/g, '_')}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Download as HTML
  const downloadHTML = () => {
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${docTitle}</title>
  <style>
    body { font-family: 'Georgia', serif; max-width: 800px; margin: 0 auto; padding: 40px 20px; line-height: 1.6; color: #333; }
    h1 { font-size: 2em; border-bottom: 2px solid #333; padding-bottom: 10px; }
    h2 { font-size: 1.5em; margin-top: 30px; }
    h3 { font-size: 1.2em; margin-top: 25px; }
    p { margin: 15px 0; }
    code { background: #f4f4f4; padding: 2px 6px; border-radius: 3px; font-family: monospace; }
    pre { background: #f4f4f4; padding: 15px; border-radius: 5px; overflow-x: auto; }
    blockquote { border-left: 4px solid #ccc; margin: 20px 0; padding-left: 20px; color: #666; }
    ul, ol { margin: 15px 0; padding-left: 30px; }
    li { margin: 5px 0; }
  </style>
</head>
<body>
  <h1>${docTitle}</h1>
  ${content.replace(/\n/g, '<br>')}
</body>
</html>`;
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${docTitle.replace(/[^a-zA-Z0-9]/g, '_')}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Print document
  const printDocument = () => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>${docTitle}</title>
          <style>
            body { font-family: 'Georgia', serif; max-width: 800px; margin: 0 auto; padding: 40px; line-height: 1.6; }
            h1 { font-size: 2em; border-bottom: 2px solid #333; padding-bottom: 10px; }
            h2 { font-size: 1.5em; margin-top: 30px; }
            h3 { font-size: 1.2em; }
            pre { background: #f4f4f4; padding: 15px; border-radius: 5px; }
            code { background: #f4f4f4; padding: 2px 6px; }
            blockquote { border-left: 4px solid #ccc; padding-left: 20px; color: #666; }
          </style>
        </head>
        <body>
          <div id="content"></div>
          <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
          <script>
            document.getElementById('content').innerHTML = marked.parse(\`${content.replace(/`/g, '\\`')}\`);
            window.print();
          </script>
        </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  // Save title
  const saveTitle = () => {
    setDocTitle(editedTitle);
    setIsEditing(false);
  };

  // ==========================================
  // Compact Mode Render
  // ==========================================
  
  if (compact) {
    return (
      <div className={`bg-gray-800 rounded-lg border border-gray-700 ${className}`}>
        <div className="flex items-center justify-between p-3">
          <div className="flex items-center gap-3">
            <div className="relative">
              <FileText className="w-5 h-5 text-green-400" />
              {isStreaming && (
                <div className="absolute -top-1 -right-1 w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              )}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium text-white truncate">
                {docTitle}
              </div>
              <div className="text-xs text-gray-400 flex items-center gap-2">
                {isStreaming ? (
                  <>
                    <Edit3 className="w-3 h-3 text-green-400 animate-pulse" />
                    <span>Writing... ({charactersWritten} chars)</span>
                  </>
                ) : content ? (
                  <>
                    <CheckCircle2 className="w-3 h-3 text-green-400" />
                    <span>{wordCount} words • {content.length} chars</span>
                  </>
                ) : (
                  <span>Ready to write</span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {content && (
              <>
                <button
                  onClick={copyContent}
                  className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded"
                  title="Copy"
                >
                  <Copy className="w-4 h-4" />
                </button>
                <button
                  onClick={downloadMarkdown}
                  className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded"
                  title="Download"
                >
                  <Download className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>
        {/* Streaming progress bar */}
        {isStreaming && (
          <div className="h-1 bg-gray-700">
            <div 
              className="h-full bg-gradient-to-r from-green-500 to-blue-500 transition-all duration-100"
              style={{ width: `${writeProgress}%` }}
            />
          </div>
        )}
      </div>
    );
  }

  // ==========================================
  // Full Mode Render - Document Preview
  // ==========================================

  return (
    <div className={`bg-gray-800 rounded-xl border border-gray-700 overflow-hidden flex flex-col ${className}`} style={{ height: isExpanded ? '90vh' : height }}>
      {/* Document Header - Google Docs style */}
      <div className="flex-shrink-0 bg-gradient-to-r from-gray-800 to-gray-850 border-b border-gray-700">
        {/* Top toolbar */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-700/50">
          <div className="flex items-center gap-3">
            <FileText className="w-8 h-8 text-blue-400" />
            {isEditing ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={editedTitle}
                  onChange={(e) => setEditedTitle(e.target.value)}
                  className="px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-lg font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && saveTitle()}
                />
                <button onClick={saveTitle} className="p-1 text-green-400 hover:bg-gray-700 rounded">
                  <CheckCircle2 className="w-5 h-5" />
                </button>
                <button onClick={() => setIsEditing(false)} className="p-1 text-gray-400 hover:bg-gray-700 rounded">
                  <X className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <button 
                onClick={() => setIsEditing(true)}
                className="text-lg font-medium text-white hover:text-blue-400 transition-colors"
              >
                {docTitle}
              </button>
            )}
          </div>
          <div className="flex items-center gap-1">
            {content && (
              <>
                <button
                  onClick={copyContent}
                  className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                  title="Copy content"
                >
                  <Copy className="w-4 h-4" />
                </button>
                <button
                  onClick={downloadMarkdown}
                  className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                  title="Download as Markdown"
                >
                  <Download className="w-4 h-4" />
                </button>
                <button
                  onClick={printDocument}
                  className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                  title="Print"
                >
                  <Printer className="w-4 h-4" />
                </button>
              </>
            )}
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
              title={isExpanded ? 'Collapse' : 'Expand'}
            >
              {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Streaming indicator */}
        {isStreaming && (
          <div className="px-4 py-2 bg-gradient-to-r from-green-900/30 to-blue-900/30">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Edit3 className="w-4 h-4 text-green-400" />
                  <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-green-400 rounded-full animate-ping" />
                </div>
                <span className="text-green-400 font-medium">Deep Agent is writing...</span>
              </div>
              <span className="text-gray-400">{charactersWritten} characters • {wordCount} words</span>
            </div>
            <div className="mt-2 h-1 bg-gray-700 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-green-500 via-blue-500 to-purple-500 transition-all duration-100"
                style={{ width: `${writeProgress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Document Content - Paper style */}
      <div 
        ref={contentRef}
        className="flex-1 overflow-y-auto bg-gray-850"
        style={{ background: 'linear-gradient(to bottom, #1a1a2e, #16162a)' }}
      >
        {content ? (
          <div className="max-w-4xl mx-auto">
            {/* Paper effect */}
            <div 
              className="min-h-full bg-white shadow-2xl mx-4 my-6 rounded-lg overflow-hidden"
              style={{ 
                background: 'linear-gradient(to bottom right, #ffffff, #fafafa)',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
              }}
            >
              <div className="p-8 md:p-12">
                {/* Document Title */}
                <h1 className="text-3xl font-bold text-gray-900 mb-6 pb-4 border-b-2 border-gray-200">
                  {docTitle}
                </h1>
                
                {/* Document Content */}
                <div className="prose prose-lg max-w-none">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm, remarkMath]}
                    rehypePlugins={[rehypeKatex]}
                    components={{
                      h1: ({ children }) => <h1 className="text-2xl font-bold text-gray-900 mt-8 mb-4">{children}</h1>,
                      h2: ({ children }) => <h2 className="text-xl font-semibold text-gray-800 mt-6 mb-3 pb-2 border-b border-gray-200">{children}</h2>,
                      h3: ({ children }) => <h3 className="text-lg font-medium text-gray-800 mt-5 mb-2">{children}</h3>,
                      p: ({ children }) => <p className="text-gray-700 leading-relaxed mb-4">{children}</p>,
                      ul: ({ children }) => <ul className="list-disc list-outside ml-6 space-y-2 text-gray-700 mb-4">{children}</ul>,
                      ol: ({ children }) => <ol className="list-decimal list-outside ml-6 space-y-2 text-gray-700 mb-4">{children}</ol>,
                      li: ({ children }) => <li className="text-gray-700">{children}</li>,
                      blockquote: ({ children }) => (
                        <blockquote className="border-l-4 border-blue-500 pl-4 py-2 my-4 bg-blue-50 rounded-r-lg italic text-gray-600">
                          {children}
                        </blockquote>
                      ),
                      code: ({ node, inline, children, ...props }: any) => (
                        inline 
                          ? <code className="bg-gray-100 text-purple-600 px-1.5 py-0.5 rounded text-sm font-mono" {...props}>{children}</code>
                          : (
                            <pre className="bg-gray-900 text-gray-100 rounded-lg p-4 overflow-x-auto my-4 shadow-inner">
                              <code className="text-sm font-mono" {...props}>{children}</code>
                            </pre>
                          )
                      ),
                      table: ({ children }) => (
                        <div className="overflow-x-auto my-4">
                          <table className="min-w-full border border-gray-300 rounded-lg overflow-hidden">
                            {children}
                          </table>
                        </div>
                      ),
                      th: ({ children }) => <th className="bg-gray-100 px-4 py-2 text-left font-semibold text-gray-800 border-b border-gray-300">{children}</th>,
                      td: ({ children }) => <td className="px-4 py-2 text-gray-700 border-b border-gray-200">{children}</td>,
                      a: ({ href, children }) => <a href={href} className="text-blue-600 hover:text-blue-800 underline" target="_blank" rel="noopener noreferrer">{children}</a>,
                      strong: ({ children }) => <strong className="font-semibold text-gray-900">{children}</strong>,
                      em: ({ children }) => <em className="italic text-gray-700">{children}</em>,
                    }}
                  >
                    {content}
                  </ReactMarkdown>
                  
                  {/* Typing cursor when streaming */}
                  {isStreaming && (
                    <span className="inline-block w-0.5 h-5 bg-blue-500 ml-1 animate-pulse" />
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Empty state */
          <div className="flex items-center justify-center h-full">
            <div className="text-center p-8">
              <div className="w-20 h-20 mx-auto mb-4 bg-gray-700/50 rounded-full flex items-center justify-center">
                <FileText className="w-10 h-10 text-gray-500" />
              </div>
              <h3 className="text-lg font-medium text-gray-300 mb-2">Document Preview</h3>
              <p className="text-gray-500 text-sm max-w-sm">
                Start a conversation with Deep Agent and your research report will appear here in real-time.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Status bar */}
      <div className="flex-shrink-0 px-4 py-2 bg-gray-800 border-t border-gray-700 flex items-center justify-between text-xs text-gray-400">
        <div className="flex items-center gap-4">
          <span>{wordCount} words</span>
          <span>{content.length} characters</span>
          {content && (
            <span>~{Math.ceil(wordCount / 200)} min read</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isStreaming ? (
            <span className="flex items-center gap-1 text-green-400">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              Writing...
            </span>
          ) : content ? (
            <span className="flex items-center gap-1 text-green-400">
              <CheckCircle2 className="w-3 h-3" />
              Ready
            </span>
          ) : (
            <span>Waiting for content...</span>
          )}
        </div>
      </div>
    </div>
  );
};

// ==========================================
// Hook for managing document state
// ==========================================

export interface UseGoogleDocsAgentOptions {
  title: string;
  autoCreate?: boolean;
  onDocumentReady?: (docId: string, docUrl: string) => void;
}

export function useGoogleDocsAgent(options: UseGoogleDocsAgentOptions) {
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [documentUrl, setDocumentUrl] = useState<string | null>(null);
  const [content, setContent] = useState<string>('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createDocument = useCallback(async () => {
    const id = `doc-${Date.now()}`;
    setDocumentId(id);
    setDocumentUrl(`#document/${id}`);
    options.onDocumentReady?.(id, `#document/${id}`);
    return { documentId: id, title: options.title };
  }, [options.title]);

  const saveContent = useCallback(async (newContent: string) => {
    setContent(newContent);
    return true;
  }, []);

  const appendContent = useCallback(async (newContent: string) => {
    setContent(prev => prev + newContent);
    return true;
  }, []);

  return {
    documentId,
    documentUrl,
    content,
    isAuthenticated: true, // Always true since we don't need auth
    isCreating,
    error,
    createDocument,
    saveContent,
    appendContent
  };
}

export default GoogleDocsEmbedded;
