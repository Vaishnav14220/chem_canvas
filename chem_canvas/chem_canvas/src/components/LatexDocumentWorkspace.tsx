/**
 * LaTeX Document Workspace Component
 * 
 * A comprehensive workspace for creating LaTeX documents with AI assistance.
 * Features:
 * - AI Chat for document creation
 * - File explorer for project files
 * - Code editor with LaTeX syntax
 * - PDF preview using react-pdf (like latexit library)
 * - Task/Todo tracking
 * - Subagent visualization
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import {
  ArrowLeft,
  FileText,
  FolderOpen,
  Play,
  Save,
  Download,
  Trash2,
  Plus,
  File,
  ChevronRight,
  ChevronDown,
  MessageSquare,
  ListTodo,
  Users,
  Wrench,
  Settings,
  HelpCircle,
  Loader2,
  Send,
  RefreshCw,
  Maximize2,
  Minimize2,
  X,
  Check,
  Clock,
  AlertCircle,
  BookOpen,
  Code,
  Eye,
  Split,
  Sparkles,
  Zap,
  FileCode,
  FilePlus,
  PanelLeftClose,
  PanelLeft,
  Copy,
  ExternalLink
} from 'lucide-react';

import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { ScrollArea } from './ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { Progress } from './ui/progress';
import { Badge } from './ui/badge';

import {
  initializeLatexAgent,
  chatWithLatexAgent,
  streamFromLatexAgent,
  compileLatexProject,
  getLatexFiles,
  getLatexFile,
  writeLatexFile,
  deleteLatexFile,
  getLatexTodos,
  getLatexSubagents,
  getLatexTools,
  resetLatexAgent,
  isLatexEngineReady,
  loadLatexEngine,
  type LaTeXFile,
  type LaTeXAgentMessage,
  type LaTeXTodoItem,
  type CompileResult
} from '../services/latexAgentService';

interface LatexDocumentWorkspaceProps {
  onBack?: () => void;
}

// Quick start templates
const QUICK_STARTS = [
  {
    id: 'research-paper',
    title: 'Research Paper',
    description: 'Academic paper with abstract, sections, and references',
    prompt: 'Create a research paper template with title page, abstract, introduction, methodology, results, discussion, and references sections. Include proper academic formatting.'
  },
  {
    id: 'thesis',
    title: 'Thesis/Dissertation',
    description: 'Complete thesis structure with chapters',
    prompt: 'Create a thesis document structure with front matter, multiple chapters, and back matter. Include table of contents, list of figures, and bibliography setup.'
  },
  {
    id: 'beamer',
    title: 'Presentation',
    description: 'Beamer presentation slides',
    prompt: 'Create a Beamer presentation template with a professional theme, title slide, agenda, content slides with bullet points, and a closing slide.'
  },
  {
    id: 'lab-report',
    title: 'Lab Report',
    description: 'Scientific lab report format',
    prompt: 'Create a lab report template with objective, materials, procedure, observations, data tables, analysis, and conclusion sections.'
  },
  {
    id: 'homework',
    title: 'Homework Assignment',
    description: 'Math/Science homework template',
    prompt: 'Create a homework assignment template with space for problems and solutions, including proper math equation formatting with amsmath.'
  },
  {
    id: 'cv',
    title: 'CV/Resume',
    description: 'Professional curriculum vitae',
    prompt: 'Create a professional CV template with sections for personal info, education, experience, skills, publications, and references.'
  }
];

// Configure PDF.js worker (like latexit does)
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const LatexDocumentWorkspace: React.FC<LatexDocumentWorkspaceProps> = ({ onBack }) => {
  // State management
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Layout state
  const [activeTab, setActiveTab] = useState<'chat' | 'editor' | 'preview' | 'split'>('chat');
  const [showSidebar, setShowSidebar] = useState(true);
  const [sidebarTab, setSidebarTab] = useState<'files' | 'todos' | 'tools'>('files');
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Files state
  const [files, setFiles] = useState<LaTeXFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [editorContent, setEditorContent] = useState('');
  const [unsavedChanges, setUnsavedChanges] = useState(false);
  
  // Chat state
  const [messages, setMessages] = useState<LaTeXAgentMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  
  // Compilation state
  const [isCompiling, setIsCompiling] = useState(false);
  const [compileResult, setCompileResult] = useState<CompileResult | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  
  // PDF viewer state (like latexit uses react-pdf)
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pdfScale, setPdfScale] = useState<number>(1.0);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  
  // Store a stable reference to the PDF URL to prevent re-renders
  const pdfUrlRef = useRef<string | null>(null);
  
  // Memoize the PDF file prop to prevent unnecessary reloads
  // Only update the memoized value when pdfUrl actually changes to a new URL
  const pdfFile = useMemo(() => {
    if (pdfUrl && pdfUrl !== pdfUrlRef.current) {
      pdfUrlRef.current = pdfUrl;
    }
    return pdfUrlRef.current;
  }, [pdfUrl]);
  
  // Todos and tools
  const [todos, setTodos] = useState<LaTeXTodoItem[]>([]);
  const [subagents, setSubagents] = useState<Array<{ name: string; description: string }>>([]);
  const [tools, setTools] = useState<Array<{ name: string; description: string }>>([]);
  
  // Dialog state
  const [showNewFileDialog, setShowNewFileDialog] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [showHelpDialog, setShowHelpDialog] = useState(false);
  
  // Refs
  const chatEndRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLTextAreaElement>(null);

  // Initialize agent
  useEffect(() => {
    const init = async () => {
      try {
        setIsLoading(true);
        await initializeLatexAgent();
        
        // Load initial data
        setFiles(getLatexFiles());
        setTodos(getLatexTodos());
        setSubagents(getLatexSubagents());
        setTools(getLatexTools());
        
        // Select main.tex by default
        const mainFile = getLatexFile('/main.tex');
        if (mainFile) {
          setSelectedFile('/main.tex');
          setEditorContent(mainFile.content);
        }
        
        setIsInitialized(true);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to initialize');
      } finally {
        setIsLoading(false);
      }
    };
    
    init();
    
    // Cleanup on unmount
    return () => {
      if (pdfUrlRef.current) {
        URL.revokeObjectURL(pdfUrlRef.current);
        pdfUrlRef.current = null;
      }
    };
  }, []);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  // Refresh files
  const refreshFiles = useCallback(() => {
    setFiles(getLatexFiles());
    setTodos(getLatexTodos());
  }, []);

  // Handle file selection
  const handleSelectFile = (path: string) => {
    if (unsavedChanges) {
      if (!confirm('You have unsaved changes. Discard them?')) {
        return;
      }
    }
    
    const file = getLatexFile(path);
    if (file) {
      setSelectedFile(path);
      setEditorContent(file.content);
      setUnsavedChanges(false);
    }
  };

  // Handle file save
  const handleSaveFile = () => {
    if (selectedFile) {
      writeLatexFile(selectedFile, editorContent);
      setUnsavedChanges(false);
      refreshFiles();
    }
  };

  // Handle file creation
  const handleCreateFile = () => {
    if (!newFileName.trim()) return;
    
    const path = newFileName.startsWith('/') ? newFileName : `/${newFileName}`;
    writeLatexFile(path, '% New LaTeX file\n');
    setShowNewFileDialog(false);
    setNewFileName('');
    refreshFiles();
    handleSelectFile(path);
  };

  // Handle file deletion
  const handleDeleteFile = (path: string) => {
    if (confirm(`Delete ${path}?`)) {
      deleteLatexFile(path);
      if (selectedFile === path) {
        setSelectedFile(null);
        setEditorContent('');
      }
      refreshFiles();
    }
  };

  // Handle chat message
  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isStreaming) return;
    
    const userMessage: LaTeXAgentMessage = {
      role: 'user',
      content: inputMessage,
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsStreaming(true);
    setStreamingContent('');
    
    try {
      let fullContent = '';
      const stream = streamFromLatexAgent(inputMessage);
      
      for await (const chunk of stream) {
        fullContent += chunk;
        setStreamingContent(fullContent);
      }
      
      const assistantMessage: LaTeXAgentMessage = {
        role: 'assistant',
        content: fullContent,
        timestamp: new Date(),
        todos: getLatexTodos()
      };
      
      setMessages(prev => [...prev, assistantMessage]);
      refreshFiles();
      
    } catch (err) {
      const errorMessage: LaTeXAgentMessage = {
        role: 'assistant',
        content: `Error: ${err instanceof Error ? err.message : 'Unknown error'}`,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsStreaming(false);
      setStreamingContent('');
    }
  };

  // Handle quick start
  const handleQuickStart = (prompt: string) => {
    setInputMessage(prompt);
  };

  // Handle compilation
  const handleCompile = async () => {
    // Save current file first
    if (selectedFile && unsavedChanges) {
      handleSaveFile();
    }
    
    setIsCompiling(true);
    setCompileResult(null);
    setPdfError(null);
    
    // Clean up old PDF URL to prevent memory leaks
    if (pdfUrlRef.current) {
      URL.revokeObjectURL(pdfUrlRef.current);
      pdfUrlRef.current = null;
    }
    setPdfUrl(null);
    
    try {
      // Load engine if not ready
      if (!isLatexEngineReady()) {
        await loadLatexEngine();
      }
      
      const result = await compileLatexProject();
      setCompileResult(result);
      
      if (result.success && result.pdfUrl) {
        setPdfUrl(result.pdfUrl);
        setCurrentPage(1);
        setNumPages(0); // Reset pages, will be set on load
        if (activeTab === 'editor') {
          setActiveTab('split');
        }
      } else if (!result.success) {
        setPdfError(result.errors?.join('\n') || 'Compilation failed');
      }
    } catch (err) {
      setCompileResult({
        success: false,
        log: '',
        errors: [err instanceof Error ? err.message : 'Compilation failed'],
        warnings: []
      });
    } finally {
      setIsCompiling(false);
    }
  };

  // Download PDF
  const handleDownloadPdf = () => {
    if (pdfUrl) {
      const a = document.createElement('a');
      a.href = pdfUrl;
      a.download = 'document.pdf';
      a.click();
    }
  };

  // Download LaTeX source
  const handleDownloadSource = () => {
    const files = getLatexFiles();
    const mainFile = files.find(f => f.path === '/main.tex' || f.path === 'main.tex');
    if (mainFile) {
      const blob = new Blob([mainFile.content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'main.tex';
      a.click();
      URL.revokeObjectURL(url);
    } else if (selectedFile) {
      const file = getLatexFile(selectedFile);
      if (file) {
        const blob = new Blob([file.content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = selectedFile.split('/').pop() || 'document.tex';
        a.click();
        URL.revokeObjectURL(url);
      }
    }
  };

  // Copy source to clipboard
  const handleCopySource = async () => {
    const files = getLatexFiles();
    const mainFile = files.find(f => f.path === '/main.tex' || f.path === 'main.tex');
    if (mainFile) {
      await navigator.clipboard.writeText(mainFile.content);
      alert('LaTeX source copied to clipboard! You can paste it into Overleaf.');
    } else if (editorContent) {
      await navigator.clipboard.writeText(editorContent);
      alert('Current file copied to clipboard!');
    }
  };

  // Open in Overleaf
  const handleOpenInOverleaf = () => {
    window.open('https://www.overleaf.com/project', '_blank');
  };

  // Toggle fullscreen
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // Reset workspace
  const handleReset = () => {
    if (confirm('Reset workspace? All files and conversation will be lost.')) {
      resetLatexAgent();
      setMessages([]);
      setSelectedFile(null);
      setEditorContent('');
      setPdfUrl(null);
      setCompileResult(null);
      refreshFiles();
    }
  };

  // Render loading state
  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-purple-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Initializing LaTeX Agent...</p>
        </div>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-900">
        <Card className="max-w-md bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-red-400 flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              Initialization Error
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-400 mb-4">{error}</p>
            <Button onClick={() => window.location.reload()}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-900 text-white">
      {/* Header */}
      <header className="flex-shrink-0 flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-4">
          {onBack && (
            <Button variant="ghost" size="icon" onClick={onBack}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
          )}
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-gradient-to-r from-purple-500 to-blue-500">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">LaTeX Document Agent</h1>
              <p className="text-xs text-gray-400">AI-powered document creation</p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* View tabs */}
          <div className="flex bg-gray-700 rounded-lg p-1">
            <button
              onClick={() => setActiveTab('chat')}
              className={`px-3 py-1.5 rounded text-sm flex items-center gap-1.5 transition-colors ${
                activeTab === 'chat' ? 'bg-purple-500 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              Chat
            </button>
            <button
              onClick={() => setActiveTab('editor')}
              className={`px-3 py-1.5 rounded text-sm flex items-center gap-1.5 transition-colors ${
                activeTab === 'editor' ? 'bg-purple-500 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              <Code className="w-4 h-4" />
              Editor
            </button>
            <button
              onClick={() => setActiveTab('preview')}
              className={`px-3 py-1.5 rounded text-sm flex items-center gap-1.5 transition-colors ${
                activeTab === 'preview' ? 'bg-purple-500 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              <Eye className="w-4 h-4" />
              Preview
            </button>
            <button
              onClick={() => setActiveTab('split')}
              className={`px-3 py-1.5 rounded text-sm flex items-center gap-1.5 transition-colors ${
                activeTab === 'split' ? 'bg-purple-500 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              <Split className="w-4 h-4" />
              Split
            </button>
          </div>
          
          <div className="h-6 w-px bg-gray-700" />
          
          {/* Compile button */}
          <Button
            onClick={handleCompile}
            disabled={isCompiling}
            className="bg-green-600 hover:bg-green-700"
          >
            {isCompiling ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Play className="w-4 h-4 mr-2" />
            )}
            Compile
          </Button>
          
          {/* Download PDF */}
          {pdfUrl && (
            <Button variant="outline" onClick={handleDownloadPdf}>
              <Download className="w-4 h-4 mr-2" />
              PDF
            </Button>
          )}
          
          <div className="h-6 w-px bg-gray-700" />
          
          <Button variant="ghost" size="icon" onClick={() => setShowHelpDialog(true)}>
            <HelpCircle className="w-5 h-5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={toggleFullscreen}>
            {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
          </Button>
          <Button variant="ghost" size="icon" onClick={handleReset}>
            <RefreshCw className="w-5 h-5" />
          </Button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        {showSidebar && (
          <aside className="w-64 flex-shrink-0 bg-gray-800 border-r border-gray-700 flex flex-col">
            {/* Sidebar tabs */}
            <div className="flex border-b border-gray-700">
              <button
                onClick={() => setSidebarTab('files')}
                className={`flex-1 px-3 py-2 text-sm flex items-center justify-center gap-1.5 ${
                  sidebarTab === 'files' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                <FolderOpen className="w-4 h-4" />
                Files
              </button>
              <button
                onClick={() => setSidebarTab('todos')}
                className={`flex-1 px-3 py-2 text-sm flex items-center justify-center gap-1.5 ${
                  sidebarTab === 'todos' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                <ListTodo className="w-4 h-4" />
                Tasks
              </button>
              <button
                onClick={() => setSidebarTab('tools')}
                className={`flex-1 px-3 py-2 text-sm flex items-center justify-center gap-1.5 ${
                  sidebarTab === 'tools' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                <Wrench className="w-4 h-4" />
                Tools
              </button>
            </div>
            
            <ScrollArea className="flex-1">
              {/* Files tab */}
              {sidebarTab === 'files' && (
                <div className="p-2">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-500 uppercase tracking-wide">Project Files</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowNewFileDialog(true)}
                      className="h-6 px-2"
                    >
                      <Plus className="w-3 h-3" />
                    </Button>
                  </div>
                  
                  {files.map((file) => (
                    <div
                      key={file.path}
                      className={`group flex items-center justify-between px-2 py-1.5 rounded cursor-pointer ${
                        selectedFile === file.path
                          ? 'bg-purple-500/20 text-purple-300'
                          : 'hover:bg-gray-700 text-gray-300'
                      }`}
                      onClick={() => handleSelectFile(file.path)}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <FileCode className="w-4 h-4 flex-shrink-0" />
                        <span className="text-sm truncate">{file.name}</span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteFile(file.path);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              
              {/* Todos tab */}
              {sidebarTab === 'todos' && (
                <div className="p-2">
                  <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">
                    Task Progress
                  </div>
                  
                  {todos.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-4">
                      No tasks yet. Start a conversation to create a plan.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {todos.map((todo) => (
                        <div
                          key={todo.id}
                          className={`p-2 rounded-lg border ${
                            todo.status === 'completed'
                              ? 'bg-green-500/10 border-green-500/30'
                              : todo.status === 'in-progress'
                              ? 'bg-yellow-500/10 border-yellow-500/30'
                              : 'bg-gray-700/50 border-gray-600'
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            {todo.status === 'completed' ? (
                              <Check className="w-4 h-4 text-green-400 mt-0.5" />
                            ) : todo.status === 'in-progress' ? (
                              <Clock className="w-4 h-4 text-yellow-400 mt-0.5" />
                            ) : (
                              <div className="w-4 h-4 rounded-full border border-gray-500 mt-0.5" />
                            )}
                            <div>
                              <p className="text-sm font-medium">{todo.title}</p>
                              {todo.description && (
                                <p className="text-xs text-gray-500 mt-0.5">{todo.description}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              
              {/* Tools tab */}
              {sidebarTab === 'tools' && (
                <div className="p-2">
                  <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">
                    Available Tools
                  </div>
                  <div className="space-y-2 mb-4">
                    {tools.map((tool) => (
                      <div key={tool.name} className="p-2 bg-gray-700/50 rounded-lg">
                        <div className="text-sm font-medium text-purple-300">{tool.name}</div>
                        <div className="text-xs text-gray-500">{tool.description}</div>
                      </div>
                    ))}
                  </div>
                  
                  <div className="text-xs text-gray-500 uppercase tracking-wide mb-2 mt-4">
                    Subagents
                  </div>
                  <div className="space-y-2">
                    {subagents.map((agent) => (
                      <div key={agent.name} className="p-2 bg-gray-700/50 rounded-lg">
                        <div className="text-sm font-medium text-blue-300">{agent.name}</div>
                        <div className="text-xs text-gray-500">{agent.description}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </ScrollArea>
          </aside>
        )}
        
        {/* Toggle sidebar button */}
        <button
          onClick={() => setShowSidebar(!showSidebar)}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-gray-800 border border-gray-700 rounded-r-lg p-1 hover:bg-gray-700"
          style={{ left: showSidebar ? '256px' : '0' }}
        >
          {showSidebar ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeft className="w-4 h-4" />}
        </button>

        {/* Main content area */}
        <main className="flex-1 flex overflow-hidden">
          {/* Chat view */}
          {(activeTab === 'chat') && (
            <div className="flex-1 flex flex-col">
              <ScrollArea className="flex-1 p-4">
                {/* Quick starts */}
                {messages.length === 0 && (
                  <div className="max-w-3xl mx-auto">
                    <div className="text-center mb-8">
                      <div className="inline-flex p-4 rounded-full bg-purple-500/20 mb-4">
                        <Sparkles className="w-8 h-8 text-purple-400" />
                      </div>
                      <h2 className="text-2xl font-bold mb-2">LaTeX Document Agent</h2>
                      <p className="text-gray-400">
                        I can help you create complete LaTeX documents with planning, file management, and AI-powered content generation.
                      </p>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {QUICK_STARTS.map((qs) => (
                        <button
                          key={qs.id}
                          onClick={() => handleQuickStart(qs.prompt)}
                          className="p-4 text-left rounded-xl bg-gray-800 border border-gray-700 hover:border-purple-500/50 hover:bg-gray-750 transition-all group"
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <BookOpen className="w-4 h-4 text-purple-400" />
                            <span className="font-medium text-sm">{qs.title}</span>
                          </div>
                          <p className="text-xs text-gray-500 group-hover:text-gray-400">
                            {qs.description}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Messages */}
                <div className="max-w-3xl mx-auto space-y-4">
                  {messages.map((message, index) => (
                    <div
                      key={index}
                      className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-xl p-4 ${
                          message.role === 'user'
                            ? 'bg-purple-500/20 text-white'
                            : 'bg-gray-800 text-gray-100'
                        }`}
                      >
                        {message.role === 'assistant' ? (
                          <div className="prose prose-invert prose-sm max-w-none">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {message.content}
                            </ReactMarkdown>
                          </div>
                        ) : (
                          <p>{message.content}</p>
                        )}
                        
                        {/* Show tools used */}
                        {message.toolsUsed && message.toolsUsed.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-gray-700 flex flex-wrap gap-1">
                            {message.toolsUsed.map((tool, i) => (
                              <Badge key={i} variant="secondary" className="text-xs">
                                <Wrench className="w-3 h-3 mr-1" />
                                {tool}
                              </Badge>
                            ))}
                          </div>
                        )}
                        
                        {/* Show files modified */}
                        {message.filesModified && message.filesModified.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-gray-700 flex flex-wrap gap-1">
                            {message.filesModified.map((file, i) => (
                              <Badge key={i} variant="outline" className="text-xs">
                                <FileText className="w-3 h-3 mr-1" />
                                {file}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  
                  {/* Streaming content */}
                  {isStreaming && streamingContent && (
                    <div className="flex justify-start">
                      <div className="max-w-[85%] rounded-xl p-4 bg-gray-800 text-gray-100">
                        <div className="prose prose-invert prose-sm max-w-none">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {streamingContent}
                          </ReactMarkdown>
                        </div>
                        <Loader2 className="w-4 h-4 animate-spin mt-2 text-purple-400" />
                      </div>
                    </div>
                  )}
                  
                  <div ref={chatEndRef} />
                </div>
              </ScrollArea>
              
              {/* Chat input */}
              <div className="p-4 border-t border-gray-700 bg-gray-800">
                <div className="max-w-3xl mx-auto flex gap-2">
                  <Textarea
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    placeholder="Describe the document you want to create..."
                    className="flex-1 min-h-[48px] max-h-32 bg-gray-700 border-gray-600 resize-none"
                  />
                  <Button
                    onClick={handleSendMessage}
                    disabled={isStreaming || !inputMessage.trim()}
                    className="bg-purple-600 hover:bg-purple-700"
                  >
                    {isStreaming ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Send className="w-5 h-5" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}
          
          {/* Editor view */}
          {(activeTab === 'editor' || activeTab === 'split') && (
            <div className={`flex-1 flex flex-col ${activeTab === 'split' ? 'w-1/2' : 'w-full'}`}>
              {/* Editor toolbar */}
              <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
                <div className="flex items-center gap-2">
                  <FileCode className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-300">
                    {selectedFile || 'No file selected'}
                  </span>
                  {unsavedChanges && (
                    <span className="text-xs text-yellow-500">• Unsaved</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={handleSaveFile} disabled={!selectedFile}>
                    <Save className="w-4 h-4 mr-1" />
                    Save
                  </Button>
                </div>
              </div>
              
              {/* Editor */}
              {selectedFile ? (
                <textarea
                  ref={editorRef}
                  value={editorContent}
                  onChange={(e) => {
                    setEditorContent(e.target.value);
                    setUnsavedChanges(true);
                  }}
                  className="flex-1 w-full p-4 bg-gray-900 text-gray-100 font-mono text-sm resize-none focus:outline-none"
                  spellCheck={false}
                />
              ) : (
                <div className="flex-1 flex items-center justify-center text-gray-500">
                  <div className="text-center">
                    <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>Select a file to edit</p>
                  </div>
                </div>
              )}
            </div>
          )}
          
          {/* Preview view */}
          {(activeTab === 'preview' || activeTab === 'split') && (
            <div className={`flex-1 flex flex-col ${activeTab === 'split' ? 'w-1/2 border-l border-gray-700' : 'w-full'}`}>
              {/* Preview toolbar */}
              <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-300">PDF Preview</span>
                  {numPages > 0 && (
                    <span className="text-xs text-gray-500 ml-2">
                      Page {currentPage} of {numPages}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {/* Page navigation */}
                  {numPages > 1 && (
                    <div className="flex items-center gap-1 mr-2">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage <= 1}
                      >
                        ←
                      </Button>
                      <span className="text-xs text-gray-400 mx-1">{currentPage}/{numPages}</span>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => setCurrentPage(p => Math.min(numPages, p + 1))}
                        disabled={currentPage >= numPages}
                      >
                        →
                      </Button>
                    </div>
                  )}
                  {/* Zoom controls */}
                  <div className="flex items-center gap-1 mr-2">
                    <Button variant="ghost" size="sm" onClick={() => setPdfScale(s => Math.max(0.5, s - 0.1))}>−</Button>
                    <span className="text-xs text-gray-400 w-12 text-center">{Math.round(pdfScale * 100)}%</span>
                    <Button variant="ghost" size="sm" onClick={() => setPdfScale(s => Math.min(2, s + 0.1))}>+</Button>
                  </div>
                  <Button variant="ghost" size="sm" onClick={handleCopySource} title="Copy source to clipboard">
                    <Copy className="w-4 h-4 mr-1" />
                    Copy
                  </Button>
                  <Button variant="ghost" size="sm" onClick={handleDownloadSource} title="Download .tex file">
                    <FileCode className="w-4 h-4 mr-1" />
                    .tex
                  </Button>
                  {pdfUrl && (
                    <Button variant="ghost" size="sm" onClick={handleDownloadPdf}>
                      <Download className="w-4 h-4 mr-1" />
                      PDF
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={handleOpenInOverleaf} title="Open Overleaf">
                    <ExternalLink className="w-4 h-4 mr-1" />
                    Overleaf
                  </Button>
                </div>
              </div>
              
              {/* PDF viewer using react-pdf (like latexit) */}
              {pdfFile ? (
                <ScrollArea className="flex-1 bg-gray-600">
                  <div className="flex justify-center p-4">
                    <Document
                      file={pdfFile}
                      onLoadSuccess={({ numPages: n }) => {
                        setNumPages(n);
                        setPdfLoading(false);
                        setPdfError(null);
                      }}
                      onLoadError={(error) => {
                        console.error('PDF load error:', error);
                        setPdfError('Failed to load PDF preview');
                        setPdfLoading(false);
                      }}
                      loading={
                        <div className="flex flex-col items-center justify-center p-8">
                          <Loader2 className="w-8 h-8 animate-spin text-purple-400 mb-2" />
                          <p className="text-gray-400">Loading PDF...</p>
                        </div>
                      }
                      error={
                        <div className="flex flex-col items-center justify-center p-8 text-center">
                          <AlertCircle className="w-10 h-10 text-red-400 mb-2" />
                          <p className="text-red-400 mb-2">Failed to render PDF</p>
                          <p className="text-gray-500 text-sm mb-4">The document may have compilation errors</p>
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={handleCopySource}>
                              <Copy className="w-4 h-4 mr-1" />
                              Copy Source
                            </Button>
                            <Button variant="outline" size="sm" onClick={handleOpenInOverleaf}>
                              <ExternalLink className="w-4 h-4 mr-1" />
                              Try Overleaf
                            </Button>
                          </div>
                        </div>
                      }
                      className="shadow-xl"
                    >
                      <Page
                        pageNumber={currentPage}
                        scale={pdfScale}
                        renderTextLayer={true}
                        renderAnnotationLayer={true}
                        className="bg-white"
                        loading={
                          <div className="flex items-center justify-center p-8 bg-white min-h-[600px]">
                            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                          </div>
                        }
                      />
                    </Document>
                  </div>
                </ScrollArea>
              ) : (
                <div className="flex-1 flex items-center justify-center text-gray-500">
                  <div className="text-center p-8">
                    <Play className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p className="text-lg mb-2">Click "Compile" to generate PDF</p>
                    {isCompiling && (
                      <div className="mt-4">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto text-purple-400" />
                        <p className="text-sm mt-2">Compiling with LaTeX server...</p>
                      </div>
                    )}
                    <div className="mt-6 p-4 bg-gray-800/50 rounded-lg max-w-md mx-auto">
                      <p className="text-sm text-gray-400 mb-3">
                        <strong>Note:</strong> If compilation fails, you can:
                      </p>
                      <div className="flex flex-wrap gap-2 justify-center">
                        <Button variant="outline" size="sm" onClick={handleCopySource}>
                          <Copy className="w-4 h-4 mr-1" />
                          Copy Source
                        </Button>
                        <Button variant="outline" size="sm" onClick={handleOpenInOverleaf}>
                          <ExternalLink className="w-4 h-4 mr-1" />
                          Open Overleaf
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Compile errors/warnings */}
              {compileResult && !compileResult.success && (
                <div className="p-4 bg-red-500/10 border-t border-red-500/30">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 text-red-400">
                      <AlertCircle className="w-4 h-4" />
                      <span className="font-medium">Compilation Issue</span>
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={handleCopySource}
                        className="border-red-500/30 text-red-300 hover:bg-red-500/20"
                      >
                        <Copy className="w-3 h-3 mr-1" />
                        Copy Source
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={handleOpenInOverleaf}
                        className="border-red-500/30 text-red-300 hover:bg-red-500/20"
                      >
                        <ExternalLink className="w-3 h-3 mr-1" />
                        Try Overleaf
                      </Button>
                    </div>
                  </div>
                  <div className="text-sm text-red-300 font-mono space-y-1 max-h-32 overflow-auto">
                    {compileResult.errors.map((error, i) => (
                      <p key={i}>{error}</p>
                    ))}
                  </div>
                  {compileResult.warnings && compileResult.warnings.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-red-500/20">
                      <p className="text-yellow-400 text-sm mb-1">Warnings:</p>
                      {compileResult.warnings.map((warning, i) => (
                        <p key={i} className="text-yellow-300 text-xs">{warning}</p>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* New file dialog */}
      <Dialog open={showNewFileDialog} onOpenChange={setShowNewFileDialog}>
        <DialogContent className="bg-gray-800 border-gray-700">
          <DialogHeader>
            <DialogTitle>Create New File</DialogTitle>
            <DialogDescription>Enter a name for the new LaTeX file</DialogDescription>
          </DialogHeader>
          <Input
            value={newFileName}
            onChange={(e) => setNewFileName(e.target.value)}
            placeholder="filename.tex"
            className="bg-gray-700 border-gray-600"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewFileDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateFile} disabled={!newFileName.trim()}>
              <FilePlus className="w-4 h-4 mr-2" />
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Help dialog */}
      <Dialog open={showHelpDialog} onOpenChange={setShowHelpDialog}>
        <DialogContent className="bg-gray-800 border-gray-700 max-w-2xl">
          <DialogHeader>
            <DialogTitle>LaTeX Document Agent Help</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-4 pr-4">
              <section>
                <h3 className="font-semibold text-purple-400 mb-2">🎯 Planning</h3>
                <p className="text-sm text-gray-400">
                  The agent automatically creates a task plan for complex documents. View progress in the Tasks tab.
                </p>
              </section>
              
              <section>
                <h3 className="font-semibold text-purple-400 mb-2">📁 File System</h3>
                <p className="text-sm text-gray-400">
                  Manage multiple LaTeX files including .tex, .bib, .cls, and .sty files. The agent can create, read, edit, and organize files.
                </p>
              </section>
              
              <section>
                <h3 className="font-semibold text-purple-400 mb-2">👥 Subagents</h3>
                <p className="text-sm text-gray-400">
                  Specialized agents handle specific tasks:
                </p>
                <ul className="text-sm text-gray-400 list-disc list-inside mt-1">
                  <li><strong>Document Architect</strong>: Plans structure and organization</li>
                  <li><strong>Content Writer</strong>: Creates well-written sections</li>
                  <li><strong>Math Typesetter</strong>: Handles equations and proofs</li>
                  <li><strong>Figure Creator</strong>: Creates TikZ diagrams</li>
                  <li><strong>Table Formatter</strong>: Designs professional tables</li>
                  <li><strong>Bibliography Manager</strong>: Handles references</li>
                  <li><strong>LaTeX Debugger</strong>: Fixes compilation errors</li>
                </ul>
              </section>
              
              <section>
                <h3 className="font-semibold text-purple-400 mb-2">⚡ Quick Tips</h3>
                <ul className="text-sm text-gray-400 list-disc list-inside">
                  <li>Use natural language to describe your document</li>
                  <li>The agent will create a plan before writing</li>
                  <li>Save files before compiling (Ctrl+S)</li>
                  <li>Check the Tasks tab for progress</li>
                  <li>Use Split view to edit and preview simultaneously</li>
                </ul>
              </section>
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button onClick={() => setShowHelpDialog(false)}>Got it!</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LatexDocumentWorkspace;
