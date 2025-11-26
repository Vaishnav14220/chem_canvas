/**
 * AI Word with Deep Agent Integration
 * 
 * Left side: Document Editor (OnlyOffice iframe or Google Docs embed)
 * Right side: Deep Agent Chat for research and content generation
 * 
 * Flow:
 * 1. User asks Deep Agent to create content
 * 2. Deep Agent generates content and creates Google Doc
 * 3. Google Doc opens in the document editor
 * 4. User can edit the document directly
 */

import React, { useState, useRef, useCallback, useEffect, FormEvent } from 'react';
import {
  X, FileText, Sparkles, RefreshCw, Loader2, ExternalLink, 
  Brain, Send, ChevronDown, ChevronUp, CheckCircle2, Cloud,
  AlertCircle, Copy, Download, Maximize2, Minimize2, Settings,
  PanelRightClose, PanelRight, FileUp, Link, Globe, Eye,
  Paperclip, Upload, FileImage, FileCode, File, Plus, Trash2
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import {
  invokeDeepAgent,
  streamDeepAgent,
  isDeepAgentInitialized,
  initializeDeepAgent,
  resetDeepAgent,
  setTavilyApiKey,
  isTavilyConfigured,
  type DeepAgentMessage,
} from '../services/deepAgentService';
import {
  isSignedIn as isGoogleSignedIn,
  signInWithGoogle,
  signOutGoogle,
  createGoogleDoc,
  updateGoogleDoc,
  getCurrentUser,
  subscribeToAuthState,
  initGoogleAuth,
} from '../services/googleAuthService';
import { extractTextFromFile } from '../services/researchPaperAgentService';
import 'katex/dist/katex.min.css';

interface AIWordWithDeepAgentProps {
  onClose: () => void;
  initialContent?: string;
}

const DOCUMENT_EDITOR_URL = 'https://ranuts.github.io/document/?locale=en';

const AIWordWithDeepAgent: React.FC<AIWordWithDeepAgentProps> = ({ onClose, initialContent }) => {
  // Document Editor State
  const [documentMode, setDocumentMode] = useState<'editor' | 'google'>('editor');
  const [googleDocId, setGoogleDocId] = useState<string | null>(null);
  const [googleDocTitle, setGoogleDocTitle] = useState<string | null>(null);
  const [googleDocUrl, setGoogleDocUrl] = useState<string | null>(null);
  const [documentUrl, setDocumentUrl] = useState('');
  const [showUrlInput, setShowUrlInput] = useState(false);

  // Deep Agent State
  const [messages, setMessages] = useState<DeepAgentMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Google Auth State
  const [isGoogleConnected, setIsGoogleConnected] = useState(false);
  const [googleUser, setGoogleUser] = useState<any>(null);

  // UI State
  const [isPanelExpanded, setIsPanelExpanded] = useState(true);
  const [notification, setNotification] = useState<string | null>(null);
  const [isSavingToGoogle, setIsSavingToGoogle] = useState(false);
  const [lastSavedContent, setLastSavedContent] = useState('');

  // File Upload State
  const [uploadedFiles, setUploadedFiles] = useState<Array<{
    file: File;
    name: string;
    type: string;
    size: number;
    content?: string;
    isProcessing: boolean;
    error?: string;
  }>>([]);
  const [isProcessingUpload, setIsProcessingUpload] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Initialize
  useEffect(() => {
    initGoogleAuth();
    const unsubscribe = subscribeToAuthState((state) => {
      setIsGoogleConnected(state.isSignedIn);
      setGoogleUser(state.user);
    });
    return () => unsubscribe();
  }, []);

  // Initialize Deep Agent
  useEffect(() => {
    if (!isDeepAgentInitialized()) {
      initializeDeepAgent({});
    }
  }, []);

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  // Auto-save to Google Docs - only save clean content, not tool calls/JSON
  useEffect(() => {
    const saveContent = async () => {
      if (!googleDocId || !isGoogleConnected) return;
      
      const assistantMessages = messages.filter(m => m.role === 'assistant');
      if (assistantMessages.length === 0) return;
      
      // Filter and clean messages - remove tool calls and JSON
      const cleanedMessages = assistantMessages
        .map(m => m.content)
        .filter(content => {
          // Skip messages that are mostly JSON/tool calls
          if (content.includes('"tool":') || content.includes('"params":')) return false;
          if (content.includes('"todos":')) return false;
          if (content.trim().startsWith('{') && content.trim().endsWith('}')) return false;
          if (content.trim().startsWith('[') && content.trim().endsWith(']')) return false;
          return true;
        })
        .map(content => {
          // Clean any remaining JSON blocks
          return content
            .replace(/```json[\s\S]*?```/g, '')
            .replace(/{\s*"tool"[\s\S]*?}\s*}/g, '')
            .replace(/────+/g, '')
            .trim();
        })
        .filter(content => content.length > 50); // Only keep substantial content
      
      const contentToSave = cleanedMessages.join('\n\n---\n\n');
      
      // Don't save if content hasn't changed or is too short
      if (contentToSave === lastSavedContent || !contentToSave.trim() || contentToSave.length < 100) return;
      
      setIsSavingToGoogle(true);
      try {
        await updateGoogleDoc(googleDocId, contentToSave);
        setLastSavedContent(contentToSave);
        showNotification('✓ Saved to Google Docs');
      } catch (err) {
        console.error('Failed to save:', err);
      } finally {
        setIsSavingToGoogle(false);
      }
    };

    const timeout = setTimeout(saveContent, 3000);
    return () => clearTimeout(timeout);
  }, [messages, googleDocId, isGoogleConnected, lastSavedContent]);

  // Show notification
  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  // Handle Google Sign In
  const handleGoogleSignIn = async () => {
    try {
      await signInWithGoogle();
    } catch (err) {
      console.error('Sign in failed:', err);
      showNotification('Failed to sign in with Google');
    }
  };

  // Handle sending message to Deep Agent
  const handleSendMessage = useCallback(async (messageContent?: string) => {
    const content = messageContent || inputMessage.trim();
    if (!content || isLoading) return;

    setInputMessage('');
    setError(null);
    setIsLoading(true);
    setIsStreaming(true);
    setStreamingContent('');

    // Create Google Doc when user sends first message
    if (isGoogleConnected && !googleDocId) {
      try {
        const docTitle = `Deep Agent: ${content.length > 40 ? content.substring(0, 40) + '...' : content}`;
        const doc = await createGoogleDoc(docTitle);
        setGoogleDocId(doc.documentId);
        setGoogleDocTitle(docTitle);
        setGoogleDocUrl(`https://docs.google.com/document/d/${doc.documentId}/edit`);
        setDocumentMode('google');
        showNotification(`✓ Created: "${docTitle}"`);
      } catch (err) {
        console.error('Failed to create Google Doc:', err);
      }
    }

    const userMessage: DeepAgentMessage = {
      role: 'user',
      content,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMessage]);

    try {
      let fullContent = '';
      
      for await (const chunk of streamDeepAgent(content, messages)) {
        fullContent += chunk;
        setStreamingContent(fullContent);
      }

      const assistantMessage: DeepAgentMessage = {
        role: 'assistant',
        content: fullContent || 'I apologize, but I could not generate a response.',
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);
      setStreamingContent('');
    } catch (err) {
      console.error('Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to get response');
      
      const errorMessage: DeepAgentMessage = {
        role: 'assistant',
        content: `⚠️ Error: ${err instanceof Error ? err.message : 'Failed to process your request'}`,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      setIsStreaming(false);
    }
  }, [inputMessage, isLoading, messages, isGoogleConnected, googleDocId]);

  // Handle form submit
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    handleSendMessage();
  };

  // Handle key press
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Reset conversation
  const handleReset = () => {
    setMessages([]);
    setStreamingContent('');
    setGoogleDocId(null);
    setGoogleDocTitle(null);
    setGoogleDocUrl(null);
    setLastSavedContent('');
    setDocumentMode('editor');
    resetDeepAgent();
    showNotification('Started new conversation');
  };

  // Load document from URL
  const handleLoadDocument = () => {
    if (documentUrl.trim()) {
      const iframe = document.getElementById('document-editor-frame') as HTMLIFrameElement;
      if (iframe) {
        iframe.src = `${DOCUMENT_EDITOR_URL}&src=${encodeURIComponent(documentUrl)}`;
      }
      setShowUrlInput(false);
      showNotification('Loading document...');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-slate-800 bg-slate-900/95 px-4 py-2">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-purple-600">
            <FileText className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-white">AI Document Studio</h1>
            <p className="text-xs text-slate-400">Deep Agent + Document Editor</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Google Doc Status */}
          {googleDocId && (
            <a
              href={googleDocUrl || '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-lg bg-green-900/50 border border-green-700/50 px-3 py-1.5 text-sm text-green-300 hover:bg-green-900/70"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span className="max-w-[150px] truncate">{googleDocTitle}</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          )}

          {/* Saving indicator */}
          {isSavingToGoogle && (
            <span className="flex items-center gap-1 text-xs text-blue-400">
              <Loader2 className="h-3 w-3 animate-spin" />
              Saving...
            </span>
          )}

          <button
            onClick={() => setShowUrlInput(!showUrlInput)}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-700"
          >
            <Link className="h-4 w-4" />
            Load URL
          </button>

          <button
            onClick={() => setIsPanelExpanded(!isPanelExpanded)}
            className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium ${
              isPanelExpanded 
                ? 'bg-purple-600 text-white' 
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            {isPanelExpanded ? <PanelRightClose className="h-4 w-4" /> : <PanelRight className="h-4 w-4" />}
            Deep Agent
          </button>

          <button
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-lg bg-slate-800 p-2 text-slate-300 hover:bg-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* URL Input Bar */}
      {showUrlInput && (
        <div className="flex items-center gap-2 border-b border-slate-800 bg-slate-900/80 px-4 py-2">
          <input
            type="url"
            value={documentUrl}
            onChange={(e) => setDocumentUrl(e.target.value)}
            placeholder="Enter document URL..."
            className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-white placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
            onKeyDown={(e) => e.key === 'Enter' && handleLoadDocument()}
          />
          <button onClick={handleLoadDocument} className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-500">
            Load
          </button>
          <button onClick={() => setShowUrlInput(false)} className="rounded-lg bg-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-600">
            Cancel
          </button>
        </div>
      )}

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Document Editor - Left Side */}
        <div className={`flex-1 flex flex-col transition-all duration-300`}>
          {/* Document Tabs */}
          <div className="flex items-center gap-2 border-b border-slate-800 bg-slate-900/50 px-4 py-2">
            <button
              onClick={() => setDocumentMode('editor')}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                documentMode === 'editor'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              <FileText className="h-4 w-4 inline mr-1" />
              Document Editor
            </button>
            {googleDocId && (
              <button
                onClick={() => setDocumentMode('google')}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  documentMode === 'google'
                    ? 'bg-green-600 text-white'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                }`}
              >
                <Cloud className="h-4 w-4 inline mr-1" />
                Google Doc
              </button>
            )}
          </div>

          {/* Document Content */}
          <div className="flex-1 bg-white">
            {documentMode === 'editor' ? (
              <iframe
                id="document-editor-frame"
                src={DOCUMENT_EDITOR_URL}
                className="h-full w-full border-none"
                title="Document Editor"
                allow="clipboard-read; clipboard-write"
              />
            ) : googleDocId ? (
              <iframe
                src={`https://docs.google.com/document/d/${googleDocId}/edit?embedded=true`}
                className="h-full w-full border-none"
                title="Google Doc"
                allow="clipboard-read; clipboard-write"
              />
            ) : (
              <div className="flex items-center justify-center h-full bg-slate-900">
                <p className="text-slate-500">No Google Doc created yet</p>
              </div>
            )}
          </div>
        </div>

        {/* Deep Agent Panel - Right Side */}
        {isPanelExpanded && (
          <div className="w-[450px] flex flex-col border-l border-slate-800 bg-slate-900/95">
            {/* Panel Header */}
            <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
              <div className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-purple-400" />
                <span className="font-medium text-white">Deep Agent</span>
              </div>
              <div className="flex items-center gap-2">
                {isGoogleConnected ? (
                  <div className="flex items-center gap-2">
                    {googleUser?.picture && (
                      <img src={googleUser.picture} alt="" className="w-6 h-6 rounded-full" />
                    )}
                    <span className="text-xs text-green-400">Connected</span>
                  </div>
                ) : (
                  <button
                    onClick={handleGoogleSignIn}
                    className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded"
                  >
                    <Cloud className="h-3 w-3" />
                    Sign in
                  </button>
                )}
                <button
                  onClick={handleReset}
                  className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded"
                  title="New conversation"
                >
                  <RefreshCw className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Google Doc Created Banner */}
            {googleDocId && (
              <div className="bg-green-900/30 border-b border-green-700/50 px-4 py-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-400" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-green-300 truncate">{googleDocTitle}</p>
                  </div>
                  <a
                    href={googleDocUrl || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-green-400 hover:text-green-300"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
              </div>
            )}

            {/* Not signed in banner */}
            {!isGoogleConnected && (
              <div className="bg-yellow-900/20 border-b border-yellow-700/30 px-4 py-2">
                <p className="text-xs text-yellow-400">
                  Sign in with Google to auto-save documents to your Drive
                </p>
              </div>
            )}

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 && !streamingContent ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <Brain className="h-12 w-12 text-purple-500/50 mb-3" />
                  <h3 className="text-lg font-medium text-white mb-2">Deep Agent</h3>
                  <p className="text-sm text-slate-400 max-w-xs">
                    Ask me to create documents, research topics, or generate content. 
                    I'll save everything to Google Docs automatically.
                  </p>
                  <div className="mt-6 space-y-2 w-full max-w-xs">
                    <button
                      onClick={() => handleSendMessage("Write a comprehensive report on organic reaction mechanisms")}
                      className="w-full px-4 py-2 text-sm text-left bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300"
                    >
                      📝 Write about organic reaction mechanisms
                    </button>
                    <button
                      onClick={() => handleSendMessage("Create study notes on electronegativity")}
                      className="w-full px-4 py-2 text-sm text-left bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300"
                    >
                      📚 Create study notes on electronegativity
                    </button>
                    <button
                      onClick={() => handleSendMessage("Explain the periodic table trends")}
                      className="w-full px-4 py-2 text-sm text-left bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300"
                    >
                      🔬 Explain periodic table trends
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {messages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[90%] rounded-lg px-4 py-2 ${
                          msg.role === 'user'
                            ? 'bg-purple-600 text-white'
                            : 'bg-slate-800 text-slate-200'
                        }`}
                      >
                        {msg.role === 'user' ? (
                          <p className="text-sm">{msg.content}</p>
                        ) : (
                          <div className="prose prose-invert prose-sm max-w-none">
                            <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                              {msg.content}
                            </ReactMarkdown>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Streaming content */}
                  {streamingContent && (
                    <div className="flex justify-start">
                      <div className="max-w-[90%] rounded-lg px-4 py-2 bg-slate-800 text-slate-200">
                        <div className="prose prose-invert prose-sm max-w-none">
                          <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                            {streamingContent}
                          </ReactMarkdown>
                          <span className="inline-block w-2 h-4 bg-purple-400 animate-pulse ml-1" />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Loading indicator */}
                  {isLoading && !streamingContent && (
                    <div className="flex justify-start">
                      <div className="bg-slate-800 rounded-lg px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin text-purple-400" />
                          <span className="text-sm text-slate-400">Thinking...</span>
                        </div>
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            {/* Input Area */}
            <div className="border-t border-slate-800 p-4">
              <form onSubmit={handleSubmit} className="flex gap-2">
                <textarea
                  ref={inputRef}
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask Deep Agent to create content..."
                  className="flex-1 resize-none rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-white placeholder:text-slate-500 focus:border-purple-500 focus:outline-none min-h-[44px] max-h-32"
                  rows={1}
                  disabled={isLoading}
                />
                <button
                  type="submit"
                  disabled={isLoading || !inputMessage.trim()}
                  className="flex items-center justify-center rounded-lg bg-purple-600 px-4 text-white hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Send className="h-5 w-5" />
                  )}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>

      {/* Notification */}
      {notification && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full border border-slate-700 bg-slate-900 px-5 py-2.5 text-sm text-white shadow-xl">
          {notification}
        </div>
      )}
    </div>
  );
};

export default AIWordWithDeepAgent;
