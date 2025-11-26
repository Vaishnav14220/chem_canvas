import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  X, Wand2, Plus, Minus, FileText, Sparkles, RefreshCw, MessageSquare,
  ChevronDown, ChevronUp, Loader2, PenLine, Upload, Link, ChevronRight,
  Copy, Send, Trash2, Settings, List, MoreHorizontal, Check, Search,
  Mic, Video, Brain, BookOpen, HelpCircle, Image, Presentation, StickyNote,
  PanelLeftClose, PanelRightClose, ChevronLeft, ExternalLink, Globe, Eye,
  LogIn, LogOut, FolderOpen, FilePlus, Save, User, File, Table, Film, Music,
  FileImage, Archive, Code, Home, ArrowLeft, Activity, Target, Zap, Clock,
  CheckCircle2, AlertCircle, FileCode, Download, Play, Pause, RotateCcw
} from 'lucide-react';
import { generateContentWithGemini } from '../services/geminiService';
import { 
  signInWithGoogle, 
  signOutGoogle, 
  isSignedIn as checkIsSignedIn, 
  getCurrentUser, 
  subscribeToAuthState,
  initGoogleAuth,
  type GoogleUser 
} from '../services/googleAuthService';
import {
  listGoogleDocs,
  createGoogleDoc,
  getGoogleDoc,
  updateGoogleDoc,
  listDriveFiles,
  searchDriveFiles,
  getDriveFileContent,
  type DocumentInfo,
  type DriveFile,
  createGoogleDocWithContent
} from '../services/googleDocsService';
import {
  invokeDeepAgent,
  streamDeepAgent,
  initializeDeepAgent,
  isDeepAgentInitialized,
  subscribeToTaskEvents,
  getArtifacts,
  getFinalDocuments,
  resetDeepAgent,
  type TaskEvent,
  type TaskStatus,
  type Artifact,
  type FinalDocument,
  type TodoItem
} from '../services/deepAgentService';
import ReactMarkdown from 'react-markdown';

// ============ TYPES ============
interface AIWordProps {
  onClose: () => void;
  initialContent?: string;
}

interface Source {
  id: string;
  name: string;
  type: 'pdf' | 'text' | 'url' | 'doc';
  selected: boolean;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  sources?: string[];
}

interface StudioTool {
  id: string;
  label: string;
  icon: React.ReactNode;
  action: () => void;
}

interface Note {
  id: string;
  title: string;
  content: string;
  timestamp: Date;
  sourceCount: number;
}

// Deep Agent types
interface AgentTask {
  id: string;
  title: string;
  status: TaskStatus;
  progress?: { current: number; total: number };
  message?: string;
  startTime: Date;
  endTime?: Date;
}

interface AgentStep {
  id: string;
  type: 'thinking' | 'searching' | 'writing' | 'tool' | 'complete';
  message: string;
  timestamp: Date;
}

interface AIAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  prompt: (text: string) => string;
  description: string;
}

// Agent interface for displaying agents in the UI
interface AgentConfig {
  id: string;
  name: string;
  description: string;
  skills: string[];
  icon: React.ReactNode;
  color: string;
  enabled: boolean;
  category: 'research' | 'chemistry' | 'writing' | 'utility';
}

// Document Editor URL
const DOCUMENT_EDITOR_URL = 'https://ranuts.github.io/document/?locale=en';

// ============ AVAILABLE AGENTS ============
const AVAILABLE_AGENTS: AgentConfig[] = [
  {
    id: 'research-agent',
    name: 'Research Agent',
    description: 'Conducts in-depth research on any topic using web search',
    skills: ['Web Search', 'Data Gathering', 'Source Citation', 'Report Writing'],
    icon: <Search className="h-5 w-5" />,
    color: 'blue',
    enabled: true,
    category: 'research'
  },
  {
    id: 'chemistry-researcher',
    name: 'Chemistry Researcher',
    description: 'Specialized research for chemistry topics with molecule databases',
    skills: ['Molecule Search', 'Reaction Analysis', 'PubChem Integration', 'Scientific Papers'],
    icon: <Sparkles className="h-5 w-5" />,
    color: 'green',
    enabled: true,
    category: 'chemistry'
  },
  {
    id: 'chemistry-tutor',
    name: 'Chemistry Tutor',
    description: 'Patient tutor for explaining chemistry concepts at any level',
    skills: ['Concept Explanation', 'Analogies', 'Practice Problems', 'Adaptive Teaching'],
    icon: <BookOpen className="h-5 w-5" />,
    color: 'yellow',
    enabled: true,
    category: 'chemistry'
  },
  {
    id: 'chemistry-problem-solver',
    name: 'Problem Solver',
    description: 'Solves chemistry problems with step-by-step calculations',
    skills: ['Stoichiometry', 'Equilibrium', 'Thermodynamics', 'Unit Conversion'],
    icon: <Target className="h-5 w-5" />,
    color: 'orange',
    enabled: true,
    category: 'chemistry'
  },
  {
    id: 'latex-formatter-agent',
    name: 'LaTeX Formatter',
    description: 'Formats documents with proper LaTeX math and structure',
    skills: ['LaTeX Syntax', 'Math Formatting', 'Document Structure', 'Academic Style'],
    icon: <FileCode className="h-5 w-5" />,
    color: 'purple',
    enabled: true,
    category: 'writing'
  },
  {
    id: 'documentation-agent',
    name: 'Documentation Agent',
    description: 'Creates polished final documentation from research',
    skills: ['Report Writing', 'Citation Management', 'Formatting', 'Organization'],
    icon: <FileText className="h-5 w-5" />,
    color: 'pink',
    enabled: true,
    category: 'writing'
  },
  {
    id: 'data-visualization',
    name: 'Data Visualizer',
    description: 'Creates charts and graphs from your data',
    skills: ['Bar Charts', 'Line Graphs', 'Pie Charts', 'Heatmaps', 'Scatter Plots'],
    icon: <Presentation className="h-5 w-5" />,
    color: 'cyan',
    enabled: true,
    category: 'utility'
  },
  {
    id: 'google-docs-agent',
    name: 'Google Docs Agent',
    description: 'Exports research and documents to Google Docs',
    skills: ['Google Integration', 'Document Export', 'Cloud Sync', 'Formatting'],
    icon: <Globe className="h-5 w-5" />,
    color: 'red',
    enabled: true,
    category: 'utility'
  },
  {
    id: 'general-purpose',
    name: 'General Purpose',
    description: 'Flexible agent for complex multi-step tasks',
    skills: ['Multi-step Tasks', 'Context Management', 'Tool Orchestration'],
    icon: <Zap className="h-5 w-5" />,
    color: 'gray',
    enabled: true,
    category: 'utility'
  }
];

// ============ AI ACTIONS (Legacy - kept for compatibility) ============
const AI_ACTIONS: AIAction[] = [
  {
    id: 'rephrase',
    label: 'Rephrase',
    icon: <RefreshCw className="h-4 w-4" />,
    prompt: (text) => `Rephrase the following text while maintaining its meaning. Make it clearer and more professional:\n\n${text}\n\nProvide only the rephrased text without any explanations.`,
    description: 'Rewrite text with better clarity'
  },
  {
    id: 'expand',
    label: 'Add More Info',
    icon: <Plus className="h-4 w-4" />,
    prompt: (text) => `Expand on the following text by adding more relevant information, examples, and details. Keep the same tone and style:\n\n${text}\n\nProvide the expanded version directly without any preamble.`,
    description: 'Add more details and examples'
  },
  {
    id: 'simplify',
    label: 'Simplify',
    icon: <Minus className="h-4 w-4" />,
    prompt: (text) => `Simplify the following text to make it easier to understand. Use simpler words and shorter sentences:\n\n${text}\n\nProvide only the simplified text.`,
    description: 'Make text easier to understand'
  },
  {
    id: 'formal',
    label: 'Make Formal',
    icon: <FileText className="h-4 w-4" />,
    prompt: (text) => `Rewrite the following text in a more formal, professional tone suitable for academic or business contexts:\n\n${text}\n\nProvide only the formal version.`,
    description: 'Convert to professional tone'
  },
  {
    id: 'casual',
    label: 'Make Casual',
    icon: <MessageSquare className="h-4 w-4" />,
    prompt: (text) => `Rewrite the following text in a more casual, friendly tone while keeping the meaning:\n\n${text}\n\nProvide only the casual version.`,
    description: 'Convert to friendly tone'
  },
  {
    id: 'bullets',
    label: 'Convert to Bullets',
    icon: <List className="h-4 w-4" />,
    prompt: (text) => `Convert the following text into a well-organized bullet point list. Extract key points and format them clearly:\n\n${text}\n\nProvide only the bullet points using - or • symbols.`,
    description: 'Convert to bullet points'
  },
  {
    id: 'improve',
    label: 'Improve Writing',
    icon: <Wand2 className="h-4 w-4" />,
    prompt: (text) => `Improve the following text by fixing grammar, improving word choice, and enhancing clarity. Make it more engaging:\n\n${text}\n\nProvide only the improved text.`,
    description: 'Fix grammar and enhance style'
  },
  {
    id: 'summarize',
    label: 'Summarize',
    icon: <Minus className="h-4 w-4" />,
    prompt: (text) => `Provide a concise summary of the following text, capturing the main points:\n\n${text}\n\nProvide only the summary.`,
    description: 'Get a brief summary'
  },
  {
    id: 'continue',
    label: 'Continue Writing',
    icon: <PenLine className="h-4 w-4" />,
    prompt: (text) => `Continue writing from where this text leaves off. Match the style, tone, and topic. Write 2-3 more paragraphs:\n\n${text}\n\nProvide only the continuation.`,
    description: 'Auto-continue the text'
  }
];

// ============ MAIN COMPONENT ============
const AIWordNotebookStyle: React.FC<AIWordProps> = ({ onClose, initialContent = '' }) => {
  // Panel visibility states
  const [leftPanelOpen, setLeftPanelOpen] = useState(true);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  
  // View state - 'chat' for AI tools, 'editor' for document editor, 'googledoc' for Google Docs
  const [activeView, setActiveView] = useState<'chat' | 'editor' | 'googledoc'>('chat');
  
  // Sources state
  const [sources, setSources] = useState<Source[]>([
    { id: '1', name: 'Document_1.pdf', type: 'pdf', selected: true },
  ]);
  const [selectAllSources, setSelectAllSources] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState(initialContent);
  const [isProcessing, setIsProcessing] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  
  // Notes state
  const [notes, setNotes] = useState<Note[]>([]);
  
  // Custom prompt
  const [customPrompt, setCustomPrompt] = useState('');
  
  // Document URL state
  const [documentUrl, setDocumentUrl] = useState('');
  const [showUrlInput, setShowUrlInput] = useState(false);
  
  // Notification state
  const [notification, setNotification] = useState<string | null>(null);
  
  // Chat history for side panel
  const [chatHistory, setChatHistory] = useState<Array<{role: 'user' | 'ai', content: string}>>([]);
  
  // Output text for quick reference
  const [outputText, setOutputText] = useState('');
  
  // Google Auth state
  const [googleUser, setGoogleUser] = useState<GoogleUser | null>(null);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [googleDocs, setGoogleDocs] = useState<DocumentInfo[]>([]);
  const [selectedGoogleDoc, setSelectedGoogleDoc] = useState<DocumentInfo | null>(null);
  const [showGoogleDocsModal, setShowGoogleDocsModal] = useState(false);
  const [googleDocContent, setGoogleDocContent] = useState('');
  
  // Import Modal state
  const [showImportModal, setShowImportModal] = useState(false);
  const [importTab, setImportTab] = useState<'google' | 'drive' | 'url' | 'upload'>('google');
  const [importUrl, setImportUrl] = useState('');
  
  // Google Drive browser state
  const [driveFiles, setDriveFiles] = useState<DriveFile[]>([]);
  const [driveLoading, setDriveLoading] = useState(false);
  const [driveFolderStack, setDriveFolderStack] = useState<{id: string; name: string}[]>([{id: 'root', name: 'My Drive'}]);
  const [driveSearchQuery, setDriveSearchQuery] = useState('');
  const [selectedDriveFiles, setSelectedDriveFiles] = useState<DriveFile[]>([]);
  
  // Google Docs embed mode - 'embed' for iframe, 'content' for text content
  const [googleDocViewMode, setGoogleDocViewMode] = useState<'embed' | 'content'>('embed');

  // ============ DEEP AGENT STATE ============
  const [isDeepAgentActive, setIsDeepAgentActive] = useState(false);
  const [deepAgentTasks, setDeepAgentTasks] = useState<AgentTask[]>([]);
  const [deepAgentSteps, setDeepAgentSteps] = useState<AgentStep[]>([]);
  const [deepAgentStatus, setDeepAgentStatus] = useState<'idle' | 'thinking' | 'searching' | 'writing' | 'complete'>('idle');
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [finalDocument, setFinalDocument] = useState<FinalDocument | null>(null);
  const [researchDocId, setResearchDocId] = useState<string | null>(null);
  const [showArtifactModal, setShowArtifactModal] = useState(false);
  const [selectedArtifact, setSelectedArtifact] = useState<Artifact | null>(null);
  const deepAgentStepsRef = useRef<HTMLDivElement>(null);

  // Enhanced Deep Agent State
  const [streamingContent, setStreamingContent] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [toolCalls, setToolCalls] = useState<any[]>([]);
  const [activeSubagent, setActiveSubagent] = useState<string | null>(null);
  const [currentTodos, setCurrentTodos] = useState<TodoItem[]>([]);

  // Agent Configuration State
  const [enabledAgents, setEnabledAgents] = useState<Set<string>>(
    new Set(AVAILABLE_AGENTS.filter(a => a.enabled).map(a => a.id))
  );
  const [showAgentConfig, setShowAgentConfig] = useState(false);
  const [agentSelectionMode, setAgentSelectionMode] = useState<'auto' | 'manual'>('auto');

  // Scroll to bottom of chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Scroll to bottom of agent steps
  useEffect(() => {
    deepAgentStepsRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [deepAgentSteps]);

  // Subscribe to Deep Agent task events
  useEffect(() => {
    const unsubscribe = subscribeToTaskEvents((event: TaskEvent) => {
      console.log('📝 Deep Agent Event:', event);
      
      switch (event.type) {
        case 'task-start':
          setDeepAgentTasks(prev => [...prev, {
            id: event.taskId,
            title: event.title || 'Processing...',
            status: 'in-progress',
            startTime: new Date(),
            message: event.message
          }]);
          setIsDeepAgentActive(true);
          break;
          
        case 'thinking':
          setDeepAgentStatus('thinking');
          setDeepAgentSteps(prev => [...prev, {
            id: Date.now().toString(),
            type: 'thinking',
            message: event.message || 'Analyzing request...',
            timestamp: new Date()
          }]);
          break;
          
        case 'searching':
          setDeepAgentStatus('searching');
          setDeepAgentSteps(prev => [...prev, {
            id: Date.now().toString(),
            type: 'searching',
            message: event.message || 'Searching for information...',
            timestamp: new Date()
          }]);
          break;
          
        case 'writing':
          setDeepAgentStatus('writing');
          setDeepAgentSteps(prev => [...prev, {
            id: Date.now().toString(),
            type: 'writing',
            message: event.message || 'Writing content...',
            timestamp: new Date()
          }]);
          break;
          
        case 'tool-call':
          setDeepAgentSteps(prev => [...prev, {
            id: Date.now().toString(),
            type: 'tool',
            message: `Using tool: ${event.data?.tool || event.data?.toolName || 'unknown'}`,
            timestamp: new Date()
          }]);
          if (event.data?.toolName) {
             setToolCalls(prev => [...prev, {
               id: `tc-${Date.now()}`,
               name: event.data.toolName,
               args: event.data.args || {},
               status: 'pending'
             }]);
          }
          break;

        case 'tool-result':
           // Update tool call result
           if (event.data?.result) {
             setToolCalls(prev => prev.map((tc, idx) => 
               idx === prev.length - 1 ? {
                 ...tc,
                 result: String(event.data?.result || ''),
                 status: 'completed'
               } : tc
             ));
           }
           break;

        case 'task-update':
          if (event.data?.todos) {
            setCurrentTodos(event.data.todos);
            // Update tasks UI based on todos
            const newTasks = event.data.todos.map((todo: TodoItem) => ({
              id: todo.id,
              title: todo.title,
              status: todo.status === 'completed' ? 'completed' : 
                      todo.status === 'in-progress' ? 'in-progress' : 'pending',
              startTime: new Date(),
              message: todo.description
            }));
            setDeepAgentTasks(newTasks as AgentTask[]);
          }
          if (event.data?.subagent) {
            setActiveSubagent(event.data.subagent);
            setDeepAgentSteps(prev => [...prev, {
              id: Date.now().toString(),
              type: 'searching',
              message: `Consulting ${event.data.subagent}...`,
              timestamp: new Date()
            }]);
          }
          break;
          
        case 'artifact-created':
          if (event.data) {
            setArtifacts(prev => [...prev, event.data as Artifact]);
          }
          break;
          
        case 'document-ready':
          if (event.data) {
            setFinalDocument(event.data as FinalDocument);
          }
          setDeepAgentStatus('complete');
          break;
          
        case 'task-complete':
          setDeepAgentTasks(prev => prev.map(t => 
            t.id === event.taskId 
              ? { ...t, status: 'completed' as TaskStatus, endTime: new Date() }
              : t
          ));
          setDeepAgentSteps(prev => [...prev, {
            id: Date.now().toString(),
            type: 'complete',
            message: event.message || 'Task completed',
            timestamp: new Date()
          }]);
          break;
          
        case 'task-error':
          setDeepAgentTasks(prev => prev.map(t => 
            t.id === event.taskId 
              ? { ...t, status: 'error' as TaskStatus, message: event.message }
              : t
          ));
          setIsDeepAgentActive(false);
          break;
      }
    });
    
    return () => unsubscribe();
  }, []);

  // Initialize Google Auth state
  useEffect(() => {
    // Initialize Google Auth (loads Google Identity Services script)
    const initAuth = async () => {
      console.log('🔐 Initializing Google Auth...');
      try {
        await initGoogleAuth();
        console.log('✅ Google Auth initialized successfully');
        // Check if already signed in after init
        if (checkIsSignedIn()) {
          const user = getCurrentUser();
          console.log('👤 User already signed in:', user?.email);
          setGoogleUser(user);
        }
      } catch (error) {
        console.error('❌ Failed to initialize Google Auth:', error);
      }
    };
    
    initAuth();
    
    // Subscribe to auth state changes
    const unsubscribe = subscribeToAuthState((state) => {
      console.log('🔄 Auth state changed:', { isSignedIn: state.isSignedIn, isLoading: state.isLoading, user: state.user?.email });
      setGoogleUser(state.user);
      setIsGoogleLoading(state.isLoading);
      if (state.error) {
        console.error('❌ Auth error:', state.error);
      }
      // Load Google Docs when user signs in
      if (state.isSignedIn && state.user && !state.isLoading) {
        console.log('📄 User signed in, loading Google Docs...');
        loadGoogleDocs();
      }
    });
    
    return unsubscribe;
  }, []);

  // Show notification helper
  const showNotification = useCallback((message: string) => {
    setNotification(message);
    setTimeout(() => setNotification(null), 3000);
  }, []);

  // ==================== GOOGLE AUTH HANDLERS ====================
  
  // Handle Google Sign In
  const handleGoogleSignIn = async () => {
    console.log('🔐 Starting Google Sign In...');
    setIsGoogleLoading(true);
    try {
      signInWithGoogle();
      // Note: signInWithGoogle is async and the actual sign-in happens via callback
      // The auth state will be updated via subscribeToAuthState
      console.log('📝 Google Sign In popup should have opened');
    } catch (error) {
      console.error('❌ Google sign in failed:', error);
      showNotification('Failed to sign in to Google');
      setIsGoogleLoading(false);
    }
  };

  // Handle Google Sign Out
  const handleGoogleSignOut = () => {
    signOutGoogle();
    setGoogleUser(null);
    setGoogleDocs([]);
    setSelectedGoogleDoc(null);
    showNotification('Signed out from Google');
  };

  // Load Google Docs
  const loadGoogleDocs = async () => {
    if (!checkIsSignedIn()) return;
    
    setIsGoogleLoading(true);
    try {
      const result = await listGoogleDocs(20);
      if (result.success && result.documents) {
        setGoogleDocs(result.documents);
        
        // Add Google Docs as sources
        const googleSources: Source[] = result.documents.map((doc: DocumentInfo) => ({
          id: `gdoc-${doc.id}`,
          name: doc.name,
          type: 'doc' as const,
          selected: false
        }));
        
        setSources(prev => {
          // Remove old Google Doc sources and add new ones
          const nonGoogleSources = prev.filter(s => !s.id.startsWith('gdoc-'));
          return [...nonGoogleSources, ...googleSources];
        });
      }
    } catch (error) {
      console.error('Failed to load Google Docs:', error);
      showNotification('Failed to load Google Docs');
    } finally {
      setIsGoogleLoading(false);
    }
  };

  // Open a Google Doc
  const handleOpenGoogleDoc = async (doc: DocumentInfo) => {
    setIsGoogleLoading(true);
    try {
      const result = await getGoogleDoc(doc.id);
      if (result.success && result.document) {
        // Extract text content from Google Doc structure
        const extractText = (document: any): string => {
          if (!document?.body?.content) return '';
          return document.body.content
            .filter((element: any) => element.paragraph)
            .map((element: any) => 
              element.paragraph.elements
                ?.map((e: any) => e.textRun?.content || '')
                .join('') || ''
            )
            .join('');
        };
        
        const content = extractText(result.document);
        setGoogleDocContent(content);
        setSelectedGoogleDoc(doc);
        setActiveView('googledoc');
        setShowGoogleDocsModal(false);
        
        // Add to sources as selected
        setSources(prev => prev.map(s => 
          s.id === `gdoc-${doc.id}` ? { ...s, selected: true } : s
        ));
        
        showNotification(`✓ Opened: ${doc.name}`);
      } else {
        showNotification('Failed to load document content');
      }
    } catch (error) {
      console.error('Failed to open Google Doc:', error);
      showNotification('Failed to open document');
    } finally {
      setIsGoogleLoading(false);
    }
  };

  // Create new Google Doc
  const handleCreateGoogleDoc = async () => {
    if (!checkIsSignedIn()) {
      showNotification('Please sign in to Google first');
      return;
    }
    
    setIsGoogleLoading(true);
    try {
      const title = `AI Word Document - ${new Date().toLocaleDateString()}`;
      const result = await createGoogleDoc(title);
      
      if (result.success && result.document) {
        showNotification(`✓ Created: ${title}`);
        await loadGoogleDocs();
        
        // Open the new doc in a new tab
        window.open(`https://docs.google.com/document/d/${result.document.documentId}/edit`, '_blank');
      } else {
        showNotification('Failed to create document');
      }
    } catch (error) {
      console.error('Failed to create Google Doc:', error);
      showNotification('Failed to create document');
    } finally {
      setIsGoogleLoading(false);
    }
  };

  // Save current output to Google Doc
  const handleSaveToGoogleDoc = async () => {
    if (!checkIsSignedIn()) {
      showNotification('Please sign in to Google first');
      return;
    }
    
    if (!outputText) {
      showNotification('No output to save');
      return;
    }
    
    setIsGoogleLoading(true);
    try {
      const title = `AI Word Export - ${new Date().toLocaleDateString()}`;
      const result = await createGoogleDoc(title);
      
      if (result.success && result.document) {
        // Update the doc with content
        await updateGoogleDoc(result.document.documentId, outputText);
        showNotification(`✓ Saved to Google Docs: ${title}`);
        window.open(`https://docs.google.com/document/d/${result.document.documentId}/edit`, '_blank');
        await loadGoogleDocs();
      } else {
        showNotification('Failed to save to Google Docs');
      }
    } catch (error) {
      console.error('Failed to save to Google Docs:', error);
      showNotification('Failed to save to Google Docs');
    } finally {
      setIsGoogleLoading(false);
    }
  };

  // Use Google Doc content as input
  const handleUseGoogleDocAsInput = () => {
    if (googleDocContent) {
      setInputText(googleDocContent);
      setActiveView('chat');
      showNotification('✓ Google Doc content loaded as input');
    }
  };

  // Handle file upload
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        
        // Add as source
        const newSource: Source = {
          id: Date.now().toString() + Math.random(),
          name: file.name,
          type: file.name.endsWith('.pdf') ? 'pdf' : 'text',
          selected: true
        };
        setSources(prev => [...prev, newSource]);
        
        // If text file, also set as input
        if (file.type.startsWith('text/') || file.name.endsWith('.txt') || file.name.endsWith('.md')) {
          setInputText(prev => prev ? `${prev}\n\n---\n\n${content}` : content);
        }
        
        showNotification(`✓ Imported: ${file.name}`);
      };
      
      if (file.type.startsWith('text/') || file.name.endsWith('.txt') || file.name.endsWith('.md')) {
        reader.readAsText(file);
      } else {
        // For PDF and other files, just add as source
        const newSource: Source = {
          id: Date.now().toString() + Math.random(),
          name: file.name,
          type: 'pdf',
          selected: true
        };
        setSources(prev => [...prev, newSource]);
        showNotification(`✓ Added source: ${file.name}`);
      }
    });
    
    setShowImportModal(false);
  };

  // Handle URL import
  const handleUrlImport = async () => {
    if (!importUrl.trim()) return;
    
    try {
      setIsGoogleLoading(true);
      
      // Check if it's a Google Doc URL
      const googleDocMatch = importUrl.match(/docs\.google\.com\/document\/d\/([a-zA-Z0-9-_]+)/);
      if (googleDocMatch && googleUser) {
        const docId = googleDocMatch[1];
        const result = await getGoogleDoc(docId);
        if (result.success && result.document) {
          const doc: DocumentInfo = {
            id: docId,
            name: result.document.title || 'Imported Google Doc',
            modifiedTime: new Date().toISOString(),
            webViewLink: `https://docs.google.com/document/d/${docId}/edit`
          };
          handleOpenGoogleDoc(doc);
          setShowImportModal(false);
          setImportUrl('');
          return;
        }
      }
      
      // For other URLs, add as source
      const urlName = importUrl.split('/').pop() || 'Web Document';
      const newSource: Source = {
        id: Date.now().toString(),
        name: urlName,
        type: 'url',
        selected: true
      };
      setSources(prev => [...prev, newSource]);
      showNotification(`✓ Added URL source: ${urlName}`);
      setShowImportModal(false);
      setImportUrl('');
    } catch (error) {
      console.error('Failed to import URL:', error);
      showNotification('Failed to import URL');
    } finally {
      setIsGoogleLoading(false);
    }
  };

  // Load Drive files for current folder
  const loadDriveFiles = async (folderId: string = 'root') => {
    if (!googleUser) return;
    
    setDriveLoading(true);
    try {
      const result = await listDriveFiles(folderId);
      if (result.success && result.files) {
        setDriveFiles(result.files);
      } else {
        console.error('Drive list error:', result.error);
        if (result.error?.includes('insufficient permissions') || result.error?.includes('403') || result.error?.includes('scope')) {
             showNotification('Permission denied. Please sign out and sign in again to grant access.');
        } else {
             showNotification('Failed to load Drive files');
        }
      }
    } catch (error) {
      console.error('Error loading Drive files:', error);
      showNotification('Error loading Drive files');
    } finally {
      setDriveLoading(false);
    }
  };

  // Search Drive files
  const handleDriveSearch = async () => {
    if (!driveSearchQuery.trim()) {
      loadDriveFiles(driveFolderStack[driveFolderStack.length - 1].id);
      return;
    }
    
    setDriveLoading(true);
    try {
      const result = await searchDriveFiles(driveSearchQuery);
      if (result.success && result.files) {
        setDriveFiles(result.files);
      }
    } catch (error) {
      console.error('Error searching Drive:', error);
    } finally {
      setDriveLoading(false);
    }
  };

  // Navigate to folder in Drive
  const navigateToFolder = (folder: DriveFile) => {
    setDriveFolderStack(prev => [...prev, { id: folder.id, name: folder.name }]);
    setDriveSearchQuery('');
    loadDriveFiles(folder.id);
  };

  // Navigate back in folder stack
  const navigateBack = () => {
    if (driveFolderStack.length <= 1) return;
    const newStack = driveFolderStack.slice(0, -1);
    setDriveFolderStack(newStack);
    setDriveSearchQuery('');
    loadDriveFiles(newStack[newStack.length - 1].id);
  };

  // Navigate to specific folder in breadcrumb
  const navigateToBreadcrumb = (index: number) => {
    const newStack = driveFolderStack.slice(0, index + 1);
    setDriveFolderStack(newStack);
    setDriveSearchQuery('');
    loadDriveFiles(newStack[newStack.length - 1].id);
  };

  // Toggle file selection
  const toggleDriveFileSelection = (file: DriveFile) => {
    setSelectedDriveFiles(prev => {
      const exists = prev.find(f => f.id === file.id);
      if (exists) {
        return prev.filter(f => f.id !== file.id);
      } else {
        return [...prev, file];
      }
    });
  };

  // Import selected Drive files
  const importSelectedDriveFiles = async () => {
    if (selectedDriveFiles.length === 0) return;
    
    setDriveLoading(true);
    try {
      for (const file of selectedDriveFiles) {
        // Check if it's a Google Doc
        if (file.mimeType === 'application/vnd.google-apps.document') {
          const doc: DocumentInfo = {
            id: file.id,
            name: file.name,
            modifiedTime: file.modifiedTime,
            webViewLink: file.webViewLink || `https://docs.google.com/document/d/${file.id}/edit`
          };
          // Add to googleDocs list if not already there
          setGoogleDocs(prev => {
            if (prev.find(d => d.id === doc.id)) return prev;
            return [...prev, doc];
          });
        }
        
        // Add as source
        const newSource: Source = {
          id: file.id,
          name: file.name,
          type: file.mimeType.includes('document') ? 'doc' : 
                file.mimeType.includes('pdf') ? 'pdf' : 'text',
          selected: true
        };
        setSources(prev => {
          if (prev.find(s => s.id === file.id)) return prev;
          return [...prev, newSource];
        });
      }
      
      showNotification(`✓ Imported ${selectedDriveFiles.length} file(s)`);
      setSelectedDriveFiles([]);
      setShowImportModal(false);
    } catch (error) {
      console.error('Error importing files:', error);
      showNotification('Error importing files');
    } finally {
      setDriveLoading(false);
    }
  };

  // Get icon for file type
  const getFileIcon = (mimeType: string) => {
    if (mimeType === 'application/vnd.google-apps.folder') return <FolderOpen className="h-5 w-5 text-yellow-400" />;
    if (mimeType === 'application/vnd.google-apps.document') return <FileText className="h-5 w-5 text-blue-400" />;
    if (mimeType === 'application/vnd.google-apps.spreadsheet') return <Table className="h-5 w-5 text-green-400" />;
    if (mimeType === 'application/vnd.google-apps.presentation') return <Presentation className="h-5 w-5 text-orange-400" />;
    if (mimeType.includes('pdf')) return <FileText className="h-5 w-5 text-red-400" />;
    if (mimeType.includes('image')) return <FileImage className="h-5 w-5 text-purple-400" />;
    if (mimeType.includes('video')) return <Film className="h-5 w-5 text-pink-400" />;
    if (mimeType.includes('audio')) return <Music className="h-5 w-5 text-cyan-400" />;
    if (mimeType.includes('zip') || mimeType.includes('archive')) return <Archive className="h-5 w-5 text-gray-400" />;
    if (mimeType.includes('text') || mimeType.includes('json') || mimeType.includes('javascript')) return <Code className="h-5 w-5 text-emerald-400" />;
    return <File className="h-5 w-5 text-gray-400" />;
  };

  // Open import modal
  const openImportModal = (tab: 'google' | 'drive' | 'url' | 'upload' = 'google') => {
    setImportTab(tab);
    setShowImportModal(true);
    // Load Drive files when opening Drive tab
    if (tab === 'drive' && googleUser) {
      loadDriveFiles('root');
    }
  };

  // Toggle select all sources
  const handleSelectAll = () => {
    const newValue = !selectAllSources;
    setSelectAllSources(newValue);
    setSources(sources.map(s => ({ ...s, selected: newValue })));
  };

  // Toggle individual source
  const toggleSource = (id: string) => {
    setSources(sources.map(s => 
      s.id === id ? { ...s, selected: !s.selected } : s
    ));
  };

  // Add source
  const addSource = () => {
    const newSource: Source = {
      id: Date.now().toString(),
      name: `New_Source_${sources.length + 1}.pdf`,
      type: 'pdf',
      selected: true
    };
    setSources([...sources, newSource]);
  };

  // Check if input is a research request
  const isResearchRequest = (text: string): boolean => {
    const researchKeywords = [
      'research', 'investigate', 'find out', 'explore', 'analyze',
      'study', 'report on', 'write about', 'explain', 'deep dive',
      'comprehensive', 'detailed analysis', 'in-depth', 'thorough'
    ];
    const lowerText = text.toLowerCase();
    return researchKeywords.some(keyword => lowerText.includes(keyword));
  };

  // Helper to clean tool calls and artifacts from content
  const cleanMessageContent = (content: string): string => {
    let cleaned = content.replace(/```tool\s*[\s\S]*?```/g, '');
    cleaned = cleaned.replace(/\[TOOL:\s*\w+\][\s\S]*?\[\/TOOL\]/g, '');
    cleaned = cleaned.replace(/\[DELEGATE:\s*\S+\][\s\S]*?\[\/DELEGATE\]/g, '');
    cleaned = cleaned.replace(/^\s*\{\s*"tool"\s*:[\s\S]*?\}\s*$/gm, '');
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
    return cleaned.trim();
  };

  // Handle Deep Agent research
  const handleDeepAgentResearch = async (query: string) => {
    // Clear previous state
    setDeepAgentTasks([]);
    setDeepAgentSteps([]);
    setFinalDocument(null);
    setResearchDocId(null);
    setIsDeepAgentActive(true);
    setDeepAgentStatus('thinking');
    setStreamingContent('');
    setIsStreaming(true);
    setToolCalls([]);
    setActiveSubagent(null);
    setCurrentTodos([]);

    // Add user message
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: query,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMessage]);

    // Build context from selected sources
    const selectedSourceNames = sources.filter(s => s.selected).map(s => s.name);
    const contextPrompt = selectedSourceNames.length > 0 
      ? `\n\nContext from sources: ${selectedSourceNames.join(', ')}`
      : '';

    try {
      // Initialize Deep Agent if needed
      if (!isDeepAgentInitialized()) {
        await initializeDeepAgent();
      }

      // Create placeholder assistant message for streaming
      const assistantMsgId = (Date.now() + 1).toString();
      const assistantMessage: ChatMessage = {
        id: assistantMsgId,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        sources: selectedSourceNames
      };
      setMessages(prev => [...prev, assistantMessage]);

      let fullContent = '';
      
      // Use streamDeepAgent for real-time updates
      // Append instruction to use latex-formatter-agent
      const enhancedQuery = query + contextPrompt + "\n\nPlease ensure the final output is well-formatted using LaTeX for any math. You may use the latex-formatter-agent to verify the formatting.";

      for await (const chunk of streamDeepAgent(enhancedQuery)) {
        fullContent += chunk;
        setStreamingContent(fullContent);
        setMessages(prev => prev.map(msg => 
          msg.id === assistantMsgId 
            ? { ...msg, content: fullContent }
            : msg
        ));
      }

      setIsStreaming(false);
      setDeepAgentStatus('complete');

      // Clean content for final document
      const cleanedContent = cleanMessageContent(fullContent);

      // Create final document
      const finalDoc: FinalDocument = {
        id: Date.now().toString(),
        title: `Research: ${query.substring(0, 50)}...`,
        content: cleanedContent,
        format: 'markdown',
        createdAt: new Date()
      };
      setFinalDocument(finalDoc);

      // Create artifact
      const newArtifact: Artifact = {
        id: Date.now().toString(),
        type: 'research',
        title: `Research: ${query.substring(0, 30)}...`,
        content: cleanedContent,
        agentName: 'Deep Research Agent',
        createdAt: new Date(),
        updatedAt: new Date()
      };
      setArtifacts(prev => [...prev, newArtifact]);

      // Auto-create Google Doc if signed in
      if (googleUser) {
        try {
          showNotification('📝 Creating Google Doc...');
          const docResult = await createGoogleDocWithContent(
            `Research: ${query.substring(0, 50)}`,
            cleanedContent,
            'markdown'
          );
          if (docResult.success && docResult.document) {
            setResearchDocId(docResult.document.documentId);
            
            // Add to Google Docs list
            const newDoc: DocumentInfo = {
              id: docResult.document.documentId,
              name: docResult.document.title || `Research: ${query.substring(0, 50)}`,
              modifiedTime: new Date().toISOString(),
              webViewLink: `https://docs.google.com/document/d/${docResult.document.documentId}/edit`
            };
            setGoogleDocs(prev => [newDoc, ...prev]);
            setSelectedGoogleDoc(newDoc);
            
            showNotification('✓ Research saved to Google Docs!');
            
            // Switch to Google Doc view
            setActiveView('googledoc');
          }
        } catch (error) {
          console.error('Failed to auto-create Google Doc:', error);
          showNotification('⚠️ Failed to save to Google Docs');
        }
      }

    } catch (error) {
      console.error('Deep Agent Error:', error);
      setDeepAgentStatus('idle');
      setIsStreaming(false);
      
      const errorMessage: ChatMessage = {
        id: Date.now().toString(),
        role: 'assistant',
        content: 'I encountered an error while researching. Please try again.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    }
  };

  // Handle submit - detect if research or regular action
  const handleSubmit = async () => {
    if (!inputText.trim() || isProcessing) return;

    if (isResearchRequest(inputText)) {
      await handleDeepAgentResearch(inputText);
    } else {
      // Use regular Gemini for simple requests
      const userMessage: ChatMessage = {
        id: Date.now().toString(),
        role: 'user',
        content: inputText,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, userMessage]);
      setIsProcessing(true);

      try {
        const response = await generateContentWithGemini(inputText);
        const assistantMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: response || 'No response generated.',
          timestamp: new Date(),
          sources: sources.filter(s => s.selected).map(s => s.name)
        };
        setMessages(prev => [...prev, assistantMessage]);
        setOutputText(response || '');
      } catch (error) {
        const errorMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: 'Sorry, an error occurred.',
          timestamp: new Date()
        };
        setMessages(prev => [...prev, errorMessage]);
      } finally {
        setIsProcessing(false);
      }
    }
    setInputText('');
  };

  // Handle AI action
  const handleAIAction = async (action: AIAction) => {
    if (!inputText.trim() || isProcessing) {
      if (!inputText.trim()) {
        showNotification('Please paste some text in the input area first');
      }
      return;
    }

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: `[${action.label}]: ${inputText.substring(0, 100)}${inputText.length > 100 ? '...' : ''}`,
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setChatHistory(prev => [...prev, { role: 'user', content: `${action.label}: ${inputText.substring(0, 100)}...` }]);
    setIsProcessing(true);

    try {
      const response = await generateContentWithGemini(action.prompt(inputText));
      
      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response || 'No response generated.',
        timestamp: new Date(),
        sources: sources.filter(s => s.selected).map(s => s.name)
      };
      
      setMessages(prev => [...prev, assistantMessage]);
      setChatHistory(prev => [...prev, { role: 'ai', content: response || 'No response generated.' }]);
      setOutputText(response || '');
      showNotification(`✓ ${action.label} applied successfully`);
    } catch (error) {
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, an error occurred while processing your request.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
      setChatHistory(prev => [...prev, { role: 'ai', content: 'Error: Failed to process request.' }]);
      showNotification('Failed to process text. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle custom prompt
  const handleCustomPrompt = async () => {
    if (!inputText.trim() || !customPrompt.trim() || isProcessing) {
      if (!customPrompt.trim()) {
        showNotification('Please enter an instruction');
      }
      return;
    }

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: customPrompt,
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setChatHistory(prev => [...prev, { role: 'user', content: customPrompt }]);
    setIsProcessing(true);

    try {
      const prompt = `${customPrompt}\n\nText to work with:\n${inputText}`;
      const response = await generateContentWithGemini(prompt);
      
      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response || 'No response generated.',
        timestamp: new Date(),
        sources: sources.filter(s => s.selected).map(s => s.name)
      };
      
      setMessages(prev => [...prev, assistantMessage]);
      setChatHistory(prev => [...prev, { role: 'ai', content: response || 'No response generated.' }]);
      setOutputText(response || '');
      setCustomPrompt('');
      showNotification('✓ Custom action applied');
    } catch (error) {
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, an error occurred while processing your request.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
      setChatHistory(prev => [...prev, { role: 'ai', content: 'Error: Failed to process request.' }]);
      showNotification('Failed to process. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Load document from URL
  const handleLoadDocument = useCallback(() => {
    if (documentUrl.trim()) {
      const encodedUrl = encodeURIComponent(documentUrl);
      const newUrl = `${DOCUMENT_EDITOR_URL}&src=${encodedUrl}`;
      const iframe = document.getElementById('document-editor-frame') as HTMLIFrameElement;
      if (iframe) {
        iframe.src = newUrl;
      }
      setShowUrlInput(false);
      showNotification('✓ Loading document...');
      
      // Add as source
      const newSource: Source = {
        id: Date.now().toString(),
        name: documentUrl.split('/').pop() || 'Loaded Document',
        type: 'url',
        selected: true
      };
      setSources(prev => [...prev, newSource]);
    }
  }, [documentUrl, showNotification]);

  // Save to note
  const saveToNote = (content: string) => {
    const newNote: Note = {
      id: Date.now().toString(),
      title: content.substring(0, 50) + (content.length > 50 ? '...' : ''),
      content: content,
      timestamp: new Date(),
      sourceCount: sources.filter(s => s.selected).length
    };
    setNotes(prev => [...prev, newNote]);
  };

  // Copy to clipboard
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showNotification('✓ Copied to clipboard');
  };

  // Clear chat
  const clearChat = () => {
    setMessages([]);
    setChatHistory([]);
    setInputText('');
    setOutputText('');
  };

  // Studio tools
  const studioTools: StudioTool[] = [
    { id: 'audio', label: 'Audio Overview', icon: <Mic className="h-5 w-5" />, action: () => {} },
    { id: 'video', label: 'Video Overview', icon: <Video className="h-5 w-5" />, action: () => {} },
    { id: 'mindmap', label: 'Mind Map', icon: <Brain className="h-5 w-5" />, action: () => {} },
    { id: 'reports', label: 'Reports', icon: <FileText className="h-5 w-5" />, action: () => {} },
    { id: 'flashcards', label: 'Flashcards', icon: <BookOpen className="h-5 w-5" />, action: () => {} },
    { id: 'quiz', label: 'Quiz', icon: <HelpCircle className="h-5 w-5" />, action: () => {} },
    { id: 'infographic', label: 'Infographic', icon: <Image className="h-5 w-5" />, action: () => {} },
    { id: 'slides', label: 'Slide deck', icon: <Presentation className="h-5 w-5" />, action: () => {} },
  ];

  // Get source icon
  const getSourceIcon = (type: string) => {
    switch (type) {
      case 'pdf': return <FileText className="h-4 w-4 text-red-400" />;
      case 'url': return <Link className="h-4 w-4 text-blue-400" />;
      case 'doc': return <FileText className="h-4 w-4 text-blue-400" />;
      default: return <FileText className="h-4 w-4 text-gray-400" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#1a1a1a] text-white">
      {/* ============ HEADER ============ */}
      <header className="h-14 flex items-center justify-between px-4 border-b border-white/10 bg-[#1a1a1a]">
        {/* Left - Logo & Title */}
        <div className="flex items-center gap-4">
          <button
            onClick={onClose}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
              <FileText className="h-4 w-4 text-white" />
            </div>
          </button>
          <input
            type="text"
            defaultValue="AI Word Document"
            className="bg-transparent text-white text-lg font-medium border-none outline-none focus:ring-0 max-w-[300px]"
          />
        </div>

        {/* Center - View Toggle */}
        <div className="flex items-center gap-1 bg-[#2d2d2d] rounded-full p-1">
          <button
            onClick={() => setActiveView('chat')}
            className={`px-4 py-1.5 rounded-full text-sm transition-colors ${
              activeView === 'chat' 
                ? 'bg-purple-500 text-white' 
                : 'text-gray-400 hover:text-white'
            }`}
          >
            AI Tools
          </button>
          <button
            onClick={() => setActiveView('editor')}
            className={`px-4 py-1.5 rounded-full text-sm transition-colors ${
              activeView === 'editor' 
                ? 'bg-purple-500 text-white' 
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Editor
          </button>
          {googleUser && (
            <button
              onClick={() => setShowGoogleDocsModal(true)}
              className={`px-4 py-1.5 rounded-full text-sm transition-colors ${
                activeView === 'googledoc' 
                  ? 'bg-purple-500 text-white' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Google Docs
            </button>
          )}
        </div>

        {/* Right - Actions */}
        <div className="flex items-center gap-2">
          {/* Google Auth Button */}
          {googleUser ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowGoogleDocsModal(true)}
                className="px-3 py-1.5 rounded-full bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 text-sm flex items-center gap-2 transition-colors"
              >
                <FolderOpen className="h-4 w-4" />
                My Docs
              </button>
              <button
                onClick={handleCreateGoogleDoc}
                disabled={isGoogleLoading}
                className="px-3 py-1.5 rounded-full bg-green-500/20 hover:bg-green-500/30 text-green-400 text-sm flex items-center gap-2 transition-colors disabled:opacity-50"
              >
                <FilePlus className="h-4 w-4" />
                New Doc
              </button>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#2d2d2d]">
                {googleUser.picture ? (
                  <img src={googleUser.picture} alt="" className="w-5 h-5 rounded-full" />
                ) : (
                  <User className="h-4 w-4 text-gray-400" />
                )}
                <span className="text-sm text-gray-300 max-w-[100px] truncate">{googleUser.name}</span>
                <button
                  onClick={handleGoogleSignOut}
                  className="p-1 hover:bg-[#3d3d3d] rounded transition-colors"
                  title="Sign out"
                >
                  <LogOut className="h-3 w-3 text-gray-400" />
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={handleGoogleSignIn}
              disabled={isGoogleLoading}
              className="px-3 py-1.5 rounded-full bg-blue-500 hover:bg-blue-600 text-white text-sm flex items-center gap-2 transition-colors disabled:opacity-50"
            >
              {isGoogleLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <LogIn className="h-4 w-4" />
              )}
              Sign in with Google
            </button>
          )}
          
          <button 
            onClick={() => setShowUrlInput(!showUrlInput)}
            className="px-3 py-1.5 rounded-full bg-[#2d2d2d] hover:bg-[#3d3d3d] text-sm flex items-center gap-2 transition-colors"
          >
            <Globe className="h-4 w-4" />
            Load URL
          </button>
          <a
            href={DOCUMENT_EDITOR_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 rounded-full bg-[#2d2d2d] hover:bg-[#3d3d3d] text-sm flex items-center gap-2 transition-colors"
          >
            <ExternalLink className="h-4 w-4" />
            Open External
          </a>
          <button className="p-2 rounded-full hover:bg-[#2d2d2d] transition-colors">
            <Settings className="h-5 w-5 text-gray-400" />
          </button>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-[#2d2d2d] transition-colors"
          >
            <X className="h-5 w-5 text-gray-400" />
          </button>
        </div>
      </header>

      {/* URL Input Bar */}
      {showUrlInput && (
        <div className="flex items-center gap-3 px-4 py-3 bg-[#252525] border-b border-white/10">
          <Globe className="h-5 w-5 text-gray-400" />
          <input
            type="url"
            value={documentUrl}
            onChange={(e) => setDocumentUrl(e.target.value)}
            placeholder="Enter document URL (e.g., https://example.com/document.docx)"
            className="flex-1 px-4 py-2 rounded-lg bg-[#2d2d2d] border border-white/10 text-white placeholder:text-gray-500 focus:border-purple-500/50 focus:outline-none text-sm"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleLoadDocument();
            }}
          />
          <button
            onClick={handleLoadDocument}
            className="px-5 py-2 rounded-lg bg-purple-500 text-white font-medium text-sm hover:bg-purple-600 transition-colors"
          >
            Load
          </button>
          <button
            onClick={() => setShowUrlInput(false)}
            className="px-4 py-2 rounded-lg border border-white/10 text-gray-400 hover:text-white text-sm transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Google Docs Modal */}
      {showGoogleDocsModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-2xl max-h-[80vh] bg-[#1a1a1a] rounded-2xl border border-white/10 shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                  <FileText className="h-4 w-4 text-blue-400" />
                </div>
                <h2 className="text-lg font-medium">Google Docs</h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={loadGoogleDocs}
                  disabled={isGoogleLoading}
                  className="p-2 hover:bg-[#2d2d2d] rounded-lg transition-colors"
                  title="Refresh"
                >
                  <RefreshCw className={`h-4 w-4 text-gray-400 ${isGoogleLoading ? 'animate-spin' : ''}`} />
                </button>
                <button
                  onClick={() => setShowGoogleDocsModal(false)}
                  className="p-2 hover:bg-[#2d2d2d] rounded-lg transition-colors"
                >
                  <X className="h-4 w-4 text-gray-400" />
                </button>
              </div>
            </div>
            
            {/* Modal Body */}
            <div className="p-4 overflow-y-auto max-h-[60vh]">
              {isGoogleLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-purple-400" />
                </div>
              ) : googleDocs.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="h-12 w-12 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-400 mb-2">No documents found</p>
                  <button
                    onClick={handleCreateGoogleDoc}
                    className="px-4 py-2 rounded-lg bg-purple-500 text-white text-sm hover:bg-purple-600 transition-colors"
                  >
                    Create New Document
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {googleDocs.map((doc) => (
                    <button
                      key={doc.id}
                      onClick={() => handleOpenGoogleDoc(doc)}
                      className="w-full p-4 rounded-xl bg-[#2d2d2d] hover:bg-[#3d3d3d] border border-white/5 hover:border-blue-500/30 text-left transition-all group"
                    >
                      <div className="flex items-center gap-3">
                        <FileText className="h-5 w-5 text-blue-400" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{doc.name}</p>
                          <p className="text-xs text-gray-500">
                            Modified: {new Date(doc.modifiedTime).toLocaleDateString()}
                          </p>
                        </div>
                        <ExternalLink className="h-4 w-4 text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            
            {/* Modal Footer */}
            <div className="flex items-center justify-between p-4 border-t border-white/10 bg-[#151515]">
              <p className="text-xs text-gray-500">{googleDocs.length} documents</p>
              <button
                onClick={handleCreateGoogleDoc}
                disabled={isGoogleLoading}
                className="px-4 py-2 rounded-lg bg-purple-500 text-white text-sm hover:bg-purple-600 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                New Document
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Sources Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-2xl max-h-[80vh] bg-[#1a1a1a] rounded-2xl border border-white/10 shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
                  <Upload className="h-4 w-4 text-purple-400" />
                </div>
                <h2 className="text-lg font-medium">Import Sources</h2>
              </div>
              <button
                onClick={() => setShowImportModal(false)}
                className="p-2 hover:bg-[#2d2d2d] rounded-lg transition-colors"
              >
                <X className="h-4 w-4 text-gray-400" />
              </button>
            </div>
            
            {/* Import Tabs */}
            <div className="flex border-b border-white/10">
              <button
                onClick={() => setImportTab('google')}
                className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
                  importTab === 'google' 
                    ? 'text-blue-400 border-b-2 border-blue-400 bg-blue-500/5' 
                    : 'text-gray-400 hover:text-white hover:bg-[#2d2d2d]'
                }`}
              >
                <FileText className="h-4 w-4 inline mr-2" />
                Google Docs
              </button>
              <button
                onClick={() => {
                  setImportTab('drive');
                  if (googleUser && driveFiles.length === 0) {
                    loadDriveFiles('root');
                  }
                }}
                className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
                  importTab === 'drive' 
                    ? 'text-green-400 border-b-2 border-green-400 bg-green-500/5' 
                    : 'text-gray-400 hover:text-white hover:bg-[#2d2d2d]'
                }`}
              >
                <FolderOpen className="h-4 w-4 inline mr-2" />
                Google Drive
              </button>
              <button
                onClick={() => setImportTab('url')}
                className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
                  importTab === 'url' 
                    ? 'text-purple-400 border-b-2 border-purple-400 bg-purple-500/5' 
                    : 'text-gray-400 hover:text-white hover:bg-[#2d2d2d]'
                }`}
              >
                <Link className="h-4 w-4 inline mr-2" />
                URL
              </button>
              <button
                onClick={() => setImportTab('upload')}
                className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
                  importTab === 'upload' 
                    ? 'text-orange-400 border-b-2 border-orange-400 bg-orange-500/5' 
                    : 'text-gray-400 hover:text-white hover:bg-[#2d2d2d]'
                }`}
              >
                <Upload className="h-4 w-4 inline mr-2" />
                Upload
              </button>
            </div>
            
            {/* Modal Body */}
            <div className="p-4 overflow-y-auto max-h-[50vh]">
              {/* Google Docs Tab */}
              {importTab === 'google' && (
                <div>
                  {!googleUser ? (
                    <div className="text-center py-8">
                      <FileText className="h-12 w-12 text-gray-600 mx-auto mb-3" />
                      <p className="text-gray-400 mb-4">Sign in to access your Google Docs</p>
                      <button
                        onClick={handleGoogleSignIn}
                        disabled={isGoogleLoading}
                        className="px-6 py-2.5 rounded-lg bg-blue-500 text-white text-sm hover:bg-blue-600 transition-colors flex items-center gap-2 mx-auto"
                      >
                        <svg className="h-4 w-4" viewBox="0 0 24 24">
                          <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        </svg>
                        Sign in with Google
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between items-center mb-4 px-1">
                        <div className="text-xs text-gray-400">
                          Signed in as <span className="text-white">{googleUser.name}</span>
                        </div>
                        <button
                          onClick={handleGoogleSignOut}
                          className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1"
                        >
                          <LogOut className="h-3 w-3" />
                          Sign Out
                        </button>
                      </div>
                      {googleDocs.length === 0 ? (
                        <div className="text-center py-8">
                          <FileText className="h-12 w-12 text-gray-600 mx-auto mb-3" />
                          <p className="text-gray-400">No documents found</p>
                          <button
                            onClick={loadGoogleDocs}
                            disabled={isGoogleLoading}
                            className="mt-3 px-4 py-2 rounded-lg bg-[#2d2d2d] text-sm hover:bg-[#3d3d3d] transition-colors"
                          >
                            {isGoogleLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Refresh'}
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {googleDocs.map((doc) => (
                            <button
                              key={doc.id}
                              onClick={() => handleOpenGoogleDoc(doc)}
                              className="w-full p-3 rounded-xl bg-[#2d2d2d] hover:bg-[#3d3d3d] border border-white/5 hover:border-blue-500/30 text-left transition-all group"
                            >
                              <div className="flex items-center gap-3">
                                <FileText className="h-5 w-5 text-blue-400" />
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium truncate text-sm">{doc.name}</p>
                                  <p className="text-xs text-gray-500">
                                    {new Date(doc.modifiedTime).toLocaleDateString()}
                                  </p>
                                </div>
                                <span className="text-xs text-blue-400 opacity-0 group-hover:opacity-100">Import</span>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
              
              {/* Google Drive Tab */}
              {importTab === 'drive' && (
                <div className="h-[400px] flex flex-col">
                  {!googleUser ? (
                    <div className="flex-1 flex flex-col items-center justify-center py-8">
                      <FolderOpen className="h-12 w-12 text-gray-600 mb-3" />
                      <p className="text-gray-400 mb-4">Sign in to access Google Drive</p>
                      <button
                        onClick={handleGoogleSignIn}
                        disabled={isGoogleLoading}
                        className="px-6 py-2.5 rounded-lg bg-green-500 text-white text-sm hover:bg-green-600 transition-colors"
                      >
                        Sign in with Google
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between items-center mb-3 px-1">
                        <div className="text-xs text-gray-400">
                          Signed in as <span className="text-white">{googleUser.name}</span>
                        </div>
                        <button
                          onClick={handleGoogleSignOut}
                          className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1"
                        >
                          <LogOut className="h-3 w-3" />
                          Sign Out
                        </button>
                      </div>

                      {/* Search Bar */}
                      <div className="flex gap-2 mb-3">
                        <div className="flex-1 relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                          <input
                            type="text"
                            value={driveSearchQuery}
                            onChange={(e) => setDriveSearchQuery(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleDriveSearch()}
                            placeholder="Search in Drive..."
                            className="w-full pl-10 pr-4 py-2 rounded-lg bg-[#2d2d2d] border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-green-500 text-sm"
                          />
                        </div>
                        <button
                          onClick={handleDriveSearch}
                          className="px-4 py-2 rounded-lg bg-[#2d2d2d] hover:bg-[#3d3d3d] text-sm transition-colors"
                        >
                          Search
                        </button>
                      </div>
                      
                      {/* Breadcrumb Navigation */}
                      <div className="flex items-center gap-1 mb-3 px-2 py-1.5 bg-[#2d2d2d] rounded-lg overflow-x-auto">
                        <button
                          onClick={() => navigateToBreadcrumb(0)}
                          className="flex items-center gap-1 px-2 py-1 rounded hover:bg-[#3d3d3d] text-sm text-gray-300 flex-shrink-0"
                        >
                          <Home className="h-4 w-4" />
                        </button>
                        {driveFolderStack.map((folder, index) => (
                          <React.Fragment key={folder.id}>
                            <ChevronRight className="h-4 w-4 text-gray-600 flex-shrink-0" />
                            <button
                              onClick={() => navigateToBreadcrumb(index)}
                              className={`px-2 py-1 rounded text-sm flex-shrink-0 ${
                                index === driveFolderStack.length - 1 
                                  ? 'text-white font-medium' 
                                  : 'text-gray-400 hover:bg-[#3d3d3d] hover:text-white'
                              }`}
                            >
                              {folder.name}
                            </button>
                          </React.Fragment>
                        ))}
                      </div>
                      
                      {/* File List */}
                      <div className="flex-1 overflow-y-auto border border-white/10 rounded-lg bg-[#1a1a1a]">
                        {driveLoading ? (
                          <div className="flex items-center justify-center py-12">
                            <Loader2 className="h-8 w-8 animate-spin text-green-400" />
                          </div>
                        ) : driveFiles.length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                            <FolderOpen className="h-12 w-12 mb-2 opacity-50" />
                            <p>No files found</p>
                          </div>
                        ) : (
                          <div className="divide-y divide-white/5">
                            {/* Back button if not at root */}
                            {driveFolderStack.length > 1 && (
                              <button
                                onClick={navigateBack}
                                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#2d2d2d] transition-colors text-left"
                              >
                                <ArrowLeft className="h-5 w-5 text-gray-400" />
                                <span className="text-gray-400">..</span>
                              </button>
                            )}
                            
                            {/* Files */}
                            {driveFiles.map((file) => {
                              const isFolder = file.mimeType === 'application/vnd.google-apps.folder';
                              const isSelected = selectedDriveFiles.some(f => f.id === file.id);
                              
                              return (
                                <div
                                  key={file.id}
                                  className={`flex items-center gap-3 px-4 py-3 hover:bg-[#2d2d2d] transition-colors cursor-pointer ${
                                    isSelected ? 'bg-green-500/10 border-l-2 border-green-500' : ''
                                  }`}
                                  onClick={() => {
                                    if (isFolder) {
                                      navigateToFolder(file);
                                    } else {
                                      toggleDriveFileSelection(file);
                                    }
                                  }}
                                >
                                  {/* Checkbox for non-folders */}
                                  {!isFolder && (
                                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                                      isSelected 
                                        ? 'bg-green-500 border-green-500' 
                                        : 'border-gray-600 hover:border-green-400'
                                    }`}>
                                      {isSelected && <Check className="h-3 w-3 text-white" />}
                                    </div>
                                  )}
                                  
                                  {/* File icon */}
                                  <div className="flex-shrink-0">
                                    {getFileIcon(file.mimeType)}
                                  </div>
                                  
                                  {/* File info */}
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">{file.name}</p>
                                    <p className="text-xs text-gray-500">
                                      {new Date(file.modifiedTime).toLocaleDateString()}
                                      {file.size && ` • ${(parseInt(file.size) / 1024).toFixed(1)} KB`}
                                    </p>
                                  </div>
                                  
                                  {/* Folder arrow */}
                                  {isFolder && (
                                    <ChevronRight className="h-5 w-5 text-gray-500" />
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      
                      {/* Selection Footer */}
                      {selectedDriveFiles.length > 0 && (
                        <div className="flex items-center justify-between mt-3 p-3 bg-green-500/10 rounded-lg border border-green-500/30">
                          <div className="flex items-center gap-2">
                            <Check className="h-4 w-4 text-green-400" />
                            <span className="text-sm text-green-400">
                              {selectedDriveFiles.length} file(s) selected
                            </span>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setSelectedDriveFiles([])}
                              className="px-3 py-1.5 rounded-lg bg-[#2d2d2d] text-sm hover:bg-[#3d3d3d] transition-colors"
                            >
                              Clear
                            </button>
                            <button
                              onClick={importSelectedDriveFiles}
                              disabled={driveLoading}
                              className="px-4 py-1.5 rounded-lg bg-green-500 text-white text-sm hover:bg-green-600 transition-colors disabled:opacity-50 flex items-center gap-2"
                            >
                              {driveLoading ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Upload className="h-4 w-4" />
                              )}
                              Import Selected
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
              
              {/* URL Tab */}
              {importTab === 'url' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      Enter URL to import content
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="url"
                        value={importUrl}
                        onChange={(e) => setImportUrl(e.target.value)}
                        placeholder="https://example.com/article"
                        className="flex-1 px-4 py-2.5 rounded-lg bg-[#2d2d2d] border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                      />
                      <button
                        onClick={() => {
                          handleUrlImport();
                        }}
                        disabled={!importUrl}
                        className="px-4 py-2.5 rounded-lg bg-purple-500 text-white text-sm hover:bg-purple-600 transition-colors disabled:opacity-50"
                      >
                        Import
                      </button>
                    </div>
                  </div>
                  <div className="pt-4 border-t border-white/10">
                    <p className="text-xs text-gray-500 mb-3">Supported URL types:</p>
                    <div className="grid grid-cols-2 gap-2 text-xs text-gray-400">
                      <div className="flex items-center gap-2 p-2 rounded-lg bg-[#2d2d2d]">
                        <Globe className="h-4 w-4 text-blue-400" />
                        Web pages
                      </div>
                      <div className="flex items-center gap-2 p-2 rounded-lg bg-[#2d2d2d]">
                        <FileText className="h-4 w-4 text-green-400" />
                        Google Docs links
                      </div>
                      <div className="flex items-center gap-2 p-2 rounded-lg bg-[#2d2d2d]">
                        <Presentation className="h-4 w-4 text-yellow-400" />
                        Google Slides
                      </div>
                      <div className="flex items-center gap-2 p-2 rounded-lg bg-[#2d2d2d]">
                        <BookOpen className="h-4 w-4 text-purple-400" />
                        Articles
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Upload Tab */}
              {importTab === 'upload' && (
                <div className="space-y-4">
                  <div 
                    className="border-2 border-dashed border-white/20 rounded-xl p-8 text-center hover:border-orange-500/50 transition-colors cursor-pointer"
                    onClick={() => {
                      const input = document.createElement('input');
                      input.type = 'file';
                      input.accept = '.pdf,.doc,.docx,.txt,.md,.json';
                      input.multiple = true;
                      input.onchange = (e) => {
                        handleFileUpload(e as unknown as React.ChangeEvent<HTMLInputElement>);
                      };
                      input.click();
                    }}
                  >
                    <Upload className="h-12 w-12 text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-400 mb-2">Drop files here or click to upload</p>
                    <p className="text-xs text-gray-500">Supports PDF, DOC, DOCX, TXT, MD, JSON</p>
                  </div>
                  <div className="text-xs text-gray-500 text-center">
                    Maximum file size: 10MB per file
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============ MAIN CONTENT ============ */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* ============ LEFT PANEL - SOURCES ============ */}
        {leftPanelOpen && (
          <aside className="w-72 border-r border-white/10 flex flex-col bg-[#1a1a1a]">
            {/* Sources Header */}
            <div className="p-4 flex items-center justify-between">
              <h2 className="text-sm font-medium text-gray-400">Sources</h2>
              <button
                onClick={() => setLeftPanelOpen(false)}
                className="p-1 hover:bg-[#2d2d2d] rounded transition-colors"
              >
                <PanelLeftClose className="h-4 w-4 text-gray-400" />
              </button>
            </div>

            {/* Add Sources Buttons */}
            <div className="px-4 pb-4 space-y-2">
              <button
                onClick={() => setShowImportModal(true)}
                className="w-full py-2.5 rounded-lg bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white text-sm font-medium flex items-center justify-center gap-2 transition-all shadow-lg"
              >
                <Upload className="h-4 w-4" />
                Import Sources
              </button>
              
              <button
                onClick={addSource}
                className="w-full py-2.5 rounded-lg bg-[#2d2d2d] hover:bg-[#3d3d3d] text-sm flex items-center justify-center gap-2 transition-colors"
              >
                <Plus className="h-4 w-4" />
                Add sources
              </button>
              
              {/* Google Docs Button */}
              {googleUser ? (
                <button
                  onClick={() => setShowGoogleDocsModal(true)}
                  className="w-full py-2.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 text-sm flex items-center justify-center gap-2 transition-colors border border-blue-500/30"
                >
                  <FileText className="h-4 w-4" />
                  Import from Google Docs
                </button>
              ) : (
                <button
                  onClick={handleGoogleSignIn}
                  disabled={isGoogleLoading}
                  className="w-full py-2.5 rounded-lg bg-[#2d2d2d] hover:bg-[#3d3d3d] text-sm flex items-center justify-center gap-2 transition-colors border border-white/5"
                >
                  {isGoogleLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <svg className="h-4 w-4" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                      </svg>
                      Connect Google Docs
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Google Docs Section (when signed in) */}
            {googleUser && googleDocs.length > 0 && (
              <div className="px-4 pb-4">
                <div className="text-xs text-gray-500 mb-2 flex items-center justify-between">
                  <span>Your Google Docs</span>
                  <button
                    onClick={loadGoogleDocs}
                    disabled={isGoogleLoading}
                    className="p-1 hover:bg-[#2d2d2d] rounded transition-colors"
                    title="Refresh"
                  >
                    <RefreshCw className={`h-3 w-3 text-gray-500 ${isGoogleLoading ? 'animate-spin' : ''}`} />
                  </button>
                </div>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {googleDocs.slice(0, 5).map((doc) => (
                    <button
                      key={doc.id}
                      onClick={() => handleOpenGoogleDoc(doc)}
                      className="w-full p-2 rounded-lg bg-[#2d2d2d] hover:bg-[#3d3d3d] text-left text-xs transition-colors flex items-center gap-2 group"
                    >
                      <FileText className="h-3 w-3 text-blue-400 flex-shrink-0" />
                      <span className="truncate flex-1">{doc.name}</span>
                      <ExternalLink className="h-3 w-3 text-gray-500 opacity-0 group-hover:opacity-100 flex-shrink-0" />
                    </button>
                  ))}
                  {googleDocs.length > 5 && (
                    <button
                      onClick={() => setShowGoogleDocsModal(true)}
                      className="w-full p-2 text-center text-xs text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      View all {googleDocs.length} documents →
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Deep Research Hint */}
            <div className="px-4 pb-4">
              <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20 text-sm">
                <span className="text-purple-400">🔎 Try Deep Research</span>
                <span className="text-gray-400"> for an in-depth report!</span>
              </div>
            </div>

            {/* Search Sources */}
            <div className="px-4 pb-4">
              <div className="flex items-center gap-2 p-2 rounded-lg bg-[#2d2d2d] border border-white/5">
                <Search className="h-4 w-4 text-gray-500" />
                <input
                  type="text"
                  placeholder="Search sources..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 bg-transparent text-sm border-none outline-none placeholder:text-gray-500"
                />
              </div>
            </div>

            {/* Select All */}
            <div className="px-4 py-2 flex items-center gap-2 border-b border-white/5">
              <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-400">
                <div 
                  onClick={handleSelectAll}
                  className={`w-4 h-4 rounded border ${selectAllSources ? 'bg-blue-500 border-blue-500' : 'border-gray-500'} flex items-center justify-center transition-colors`}
                >
                  {selectAllSources && <Check className="h-3 w-3 text-white" />}
                </div>
                Select all sources
              </label>
            </div>

            {/* Sources List */}
            <div className="flex-1 overflow-y-auto px-4 py-2">
              {sources.map((source) => (
                <div
                  key={source.id}
                  className="flex items-center gap-2 py-2 px-2 rounded-lg hover:bg-[#2d2d2d] transition-colors cursor-pointer group"
                >
                  <div 
                    onClick={() => toggleSource(source.id)}
                    className={`w-4 h-4 rounded border ${source.selected ? 'bg-blue-500 border-blue-500' : 'border-gray-500'} flex items-center justify-center transition-colors`}
                  >
                    {source.selected && <Check className="h-3 w-3 text-white" />}
                  </div>
                  {getSourceIcon(source.type)}
                  <span className="flex-1 text-sm truncate">{source.name}</span>
                  <button className="opacity-0 group-hover:opacity-100 p-1 hover:bg-[#3d3d3d] rounded transition-all">
                    <MoreHorizontal className="h-4 w-4 text-gray-400" />
                  </button>
                </div>
              ))}
            </div>
          </aside>
        )}

        {/* Toggle Left Panel (when closed) */}
        {!leftPanelOpen && (
          <button
            onClick={() => setLeftPanelOpen(true)}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 p-2 bg-[#2d2d2d] hover:bg-[#3d3d3d] rounded-r-lg transition-colors"
          >
            <ChevronRight className="h-4 w-4 text-gray-400" />
          </button>
        )}

        {/* ============ CENTER PANEL - CHAT OR EDITOR ============ */}
        <main className="flex-1 flex flex-col overflow-hidden bg-[#202020]">
          {/* ============ EDITOR VIEW ============ */}
          {activeView === 'editor' && (
            <div className="flex-1 flex flex-col">
              {/* Editor Header */}
              <div className="p-4 border-b border-white/5 flex items-center justify-between bg-[#1a1a1a]">
                <div className="flex items-center gap-4">
                  <h2 className="text-sm font-medium text-gray-400">Document Editor</h2>
                  <span className="text-xs text-gray-500">External Editor by Ranuts</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setActiveView('chat')}
                    className="px-3 py-1.5 rounded-lg bg-purple-500/20 text-purple-400 text-sm hover:bg-purple-500/30 transition-colors"
                  >
                    <Sparkles className="h-4 w-4 inline mr-1" />
                    AI Tools
                  </button>
                </div>
              </div>
              
              {/* Document Editor iframe */}
              <div className="flex-1 relative">
                <iframe
                  id="document-editor-frame"
                  src={DOCUMENT_EDITOR_URL}
                  className="absolute inset-0 w-full h-full border-none bg-white"
                  title="Document Editor"
                  allow="clipboard-read; clipboard-write"
                />
              </div>
            </div>
          )}

          {/* ============ GOOGLE DOC VIEW ============ */}
          {activeView === 'googledoc' && selectedGoogleDoc && (
            <div className="flex-1 flex flex-col">
              {/* Google Doc Header */}
              <div className="p-3 border-b border-white/5 flex items-center justify-between bg-[#1a1a1a]">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                      <FileText className="h-4 w-4 text-blue-400" />
                    </div>
                    <div>
                      <h2 className="text-sm font-medium">{selectedGoogleDoc.name}</h2>
                      <p className="text-xs text-gray-500">Google Docs</p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {/* View Mode Toggle */}
                  <div className="flex items-center bg-[#2d2d2d] rounded-lg p-0.5">
                    <button
                      onClick={() => setGoogleDocViewMode('embed')}
                      className={`px-3 py-1 text-xs rounded-md transition-colors ${
                        googleDocViewMode === 'embed' 
                          ? 'bg-blue-500 text-white' 
                          : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      <Eye className="h-3 w-3 inline mr-1" />
                      Embed
                    </button>
                    <button
                      onClick={() => setGoogleDocViewMode('content')}
                      className={`px-3 py-1 text-xs rounded-md transition-colors ${
                        googleDocViewMode === 'content' 
                          ? 'bg-blue-500 text-white' 
                          : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      <FileText className="h-3 w-3 inline mr-1" />
                      Text
                    </button>
                  </div>
                  <button
                    onClick={handleUseGoogleDocAsInput}
                    className="px-3 py-1.5 rounded-lg bg-green-500/20 text-green-400 text-xs hover:bg-green-500/30 transition-colors flex items-center gap-1"
                  >
                    <Upload className="h-3 w-3" />
                    Use as Input
                  </button>
                  <a
                    href={`https://docs.google.com/document/d/${selectedGoogleDoc.id}/edit`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 rounded-lg bg-blue-500/20 text-blue-400 text-xs hover:bg-blue-500/30 transition-colors flex items-center gap-1"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Open in Docs
                  </a>
                  <button
                    onClick={() => {
                      setActiveView('chat');
                      setSelectedGoogleDoc(null);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-purple-500/20 text-purple-400 text-xs hover:bg-purple-500/30 transition-colors"
                  >
                    <Sparkles className="h-3 w-3 inline mr-1" />
                    AI Tools
                  </button>
                </div>
              </div>
              
              {/* Google Doc Content - Embedded or Text */}
              <div className="flex-1 relative bg-[#1a1a1a]">
                {googleDocViewMode === 'embed' ? (
                  /* Embedded Google Doc iframe */
                  <iframe
                    src={`https://docs.google.com/document/d/${selectedGoogleDoc.id}/edit?embedded=true`}
                    className="absolute inset-0 w-full h-full border-none"
                    title={selectedGoogleDoc.name}
                    allow="clipboard-read; clipboard-write"
                    sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
                  />
                ) : (
                  /* Text Content View */
                  <div className="absolute inset-0 overflow-auto p-6">
                    <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-xl p-8 min-h-full">
                      <div className="prose prose-sm max-w-none text-gray-800 whitespace-pre-wrap">
                        {googleDocContent || (
                          <p className="text-gray-400 italic">This document is empty or content couldn't be loaded</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ============ CHAT VIEW ============ */}
          {activeView === 'chat' && (
            <>
          {/* Chat Header */}
          <div className="p-4 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h2 className="text-sm font-medium text-gray-400">Chat</h2>
              <button className="p-1 hover:bg-[#2d2d2d] rounded transition-colors">
                <Settings className="h-4 w-4 text-gray-400" />
              </button>
            </div>
            <button
              onClick={clearChat}
              className="p-1 hover:bg-[#2d2d2d] rounded transition-colors"
              title="Clear chat"
            >
              <Trash2 className="h-4 w-4 text-gray-400" />
            </button>
          </div>

          {/* Document Title Area */}
          <div className="p-6 border-b border-white/5">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs text-gray-500">〰️</span>
            </div>
            <h1 className="text-2xl font-semibold mb-2">AI Word Assistant</h1>
            <p className="text-sm text-gray-400">{sources.filter(s => s.selected).length} source{sources.filter(s => s.selected).length !== 1 ? 's' : ''} selected</p>
            
            {/* Quick Action Buttons */}
            <div className="flex gap-2 mt-4">
              <button 
                onClick={() => setActiveView('editor')}
                className="px-4 py-2 rounded-full bg-purple-500 hover:bg-purple-600 text-white text-sm flex items-center gap-2 transition-colors"
              >
                <Eye className="h-4 w-4" />
                Open Editor
              </button>
              <button className="px-4 py-2 rounded-full bg-[#2d2d2d] hover:bg-[#3d3d3d] text-sm flex items-center gap-2 transition-colors">
                <Video className="h-4 w-4" />
                Video Overview
              </button>
              <button className="px-4 py-2 rounded-full bg-[#2d2d2d] hover:bg-[#3d3d3d] text-sm flex items-center gap-2 transition-colors">
                <Mic className="h-4 w-4" />
                Audio Overview
              </button>
              <button className="px-4 py-2 rounded-full bg-[#2d2d2d] hover:bg-[#3d3d3d] text-sm flex items-center gap-2 transition-colors">
                <Brain className="h-4 w-4" />
                Mind map
              </button>
            </div>
          </div>

          {/* Input Text Area */}
          <div className="p-4 border-b border-white/5">
            <div className="p-4 rounded-xl bg-[#2d2d2d] border border-white/5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-500">Input Text / Research Query</span>
                <span className="text-xs text-gray-500">{inputText.length} chars</span>
              </div>
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && e.ctrlKey) {
                    handleSubmit();
                  }
                }}
                placeholder="Type a research topic (e.g., 'Research the effects of climate change on coral reefs') or paste text to transform..."
                className="w-full h-32 bg-transparent text-sm text-white placeholder:text-gray-500 resize-none outline-none"
              />
              {inputText.trim() && (
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5">
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    {isResearchRequest(inputText) ? (
                      <>
                        <Brain className="h-4 w-4 text-purple-400" />
                        <span className="text-purple-400">Deep Research mode detected</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 text-blue-400" />
                        <span>Quick AI mode</span>
                      </>
                    )}
                  </div>
                  <button
                    onClick={handleSubmit}
                    disabled={isProcessing || isDeepAgentActive}
                    className="px-4 py-2 rounded-lg bg-purple-500 hover:bg-purple-600 text-white text-sm flex items-center gap-2 transition-colors disabled:opacity-50"
                  >
                    {isProcessing || isDeepAgentActive ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    {isResearchRequest(inputText) ? 'Start Research' : 'Send'}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* AI Agents Panel */}
          <div className="p-4 border-b border-white/5">
            {/* Header with Config Toggle */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Brain className="h-4 w-4 text-purple-400" />
                <p className="text-sm font-medium">AI Agents</p>
                <span className="text-xs text-gray-500">({enabledAgents.size} active)</span>
              </div>
              <div className="flex items-center gap-2">
                {/* Selection Mode Toggle */}
                <div className="flex items-center gap-1 bg-[#2d2d2d] rounded-lg p-1">
                  <button
                    onClick={() => setAgentSelectionMode('auto')}
                    className={`px-2 py-1 rounded text-xs transition-colors ${
                      agentSelectionMode === 'auto' 
                        ? 'bg-purple-500/30 text-purple-300' 
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    Auto
                  </button>
                  <button
                    onClick={() => setAgentSelectionMode('manual')}
                    className={`px-2 py-1 rounded text-xs transition-colors ${
                      agentSelectionMode === 'manual' 
                        ? 'bg-purple-500/30 text-purple-300' 
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    Manual
                  </button>
                </div>
                <button
                  onClick={() => setShowAgentConfig(!showAgentConfig)}
                  className={`p-1.5 rounded-lg transition-colors ${
                    showAgentConfig ? 'bg-purple-500/20 text-purple-400' : 'hover:bg-[#2d2d2d] text-gray-400'
                  }`}
                >
                  <Settings className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Mode Description */}
            <p className="text-xs text-gray-500 mb-3">
              {agentSelectionMode === 'auto' 
                ? '🤖 AI will automatically select the best agents for your query'
                : '👆 Click agents to enable/disable them for your research'}
            </p>

            {/* Agent Cards Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
              {AVAILABLE_AGENTS.map((agent) => {
                const isEnabled = enabledAgents.has(agent.id);
                const colorClasses: Record<string, { bg: string; border: string; text: string }> = {
                  blue: { bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-400' },
                  green: { bg: 'bg-green-500/10', border: 'border-green-500/30', text: 'text-green-400' },
                  yellow: { bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', text: 'text-yellow-400' },
                  orange: { bg: 'bg-orange-500/10', border: 'border-orange-500/30', text: 'text-orange-400' },
                  purple: { bg: 'bg-purple-500/10', border: 'border-purple-500/30', text: 'text-purple-400' },
                  pink: { bg: 'bg-pink-500/10', border: 'border-pink-500/30', text: 'text-pink-400' },
                  cyan: { bg: 'bg-cyan-500/10', border: 'border-cyan-500/30', text: 'text-cyan-400' },
                  red: { bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-400' },
                  gray: { bg: 'bg-gray-500/10', border: 'border-gray-500/30', text: 'text-gray-400' },
                };
                const colors = colorClasses[agent.color] || colorClasses.gray;

                return (
                  <div
                    key={agent.id}
                    onClick={() => {
                      if (agentSelectionMode === 'manual') {
                        setEnabledAgents(prev => {
                          const newSet = new Set(prev);
                          if (newSet.has(agent.id)) {
                            newSet.delete(agent.id);
                          } else {
                            newSet.add(agent.id);
                          }
                          return newSet;
                        });
                      }
                    }}
                    className={`relative p-3 rounded-lg border transition-all cursor-pointer ${
                      isEnabled 
                        ? `${colors.bg} ${colors.border}` 
                        : 'bg-[#2d2d2d] border-white/5 opacity-50'
                    } ${agentSelectionMode === 'manual' ? 'hover:scale-[1.02]' : ''}`}
                  >
                    {/* Enabled Indicator */}
                    {isEnabled && (
                      <div className={`absolute top-2 right-2 w-2 h-2 rounded-full ${colors.text.replace('text-', 'bg-')}`} />
                    )}
                    
                    {/* Agent Header */}
                    <div className="flex items-center gap-2 mb-2">
                      <span className={colors.text}>{agent.icon}</span>
                      <span className="text-sm font-medium truncate">{agent.name}</span>
                    </div>
                    
                    {/* Description */}
                    <p className="text-xs text-gray-500 mb-2 line-clamp-2">{agent.description}</p>
                    
                    {/* Skills */}
                    {showAgentConfig && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {agent.skills.slice(0, 3).map((skill, idx) => (
                          <span 
                            key={idx} 
                            className={`px-1.5 py-0.5 rounded text-[10px] ${colors.bg} ${colors.text}`}
                          >
                            {skill}
                          </span>
                        ))}
                        {agent.skills.length > 3 && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-white/5 text-gray-500">
                            +{agent.skills.length - 3}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Start Research Button */}
            <div className="mt-4">
              <button
                onClick={() => {
                  if (inputText.trim()) {
                    // Pass enabled agents to the research function
                    const activeAgentsList = Array.from(enabledAgents).join(', ');
                    const agentInstruction = agentSelectionMode === 'manual' 
                      ? `\n\n[User has selected these agents: ${activeAgentsList}. Prefer using these agents when delegating tasks.]`
                      : '';
                    handleDeepAgentResearch(inputText + agentInstruction);
                  }
                }}
                disabled={isProcessing || isDeepAgentActive || !inputText.trim()}
                className="w-full p-4 rounded-xl bg-gradient-to-r from-purple-500/20 via-blue-500/20 to-cyan-500/20 hover:from-purple-500/30 hover:via-blue-500/30 hover:to-cyan-500/30 border border-purple-500/30 text-left transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-purple-500/20">
                      <Brain className="h-5 w-5 text-purple-400" />
                    </div>
                    <div>
                      <span className="text-sm font-medium text-white">Start Deep Research</span>
                      <p className="text-xs text-gray-500">
                        {agentSelectionMode === 'auto' 
                          ? 'AI will select the best agents automatically'
                          : `Using ${enabledAgents.size} selected agents`}
                      </p>
                    </div>
                  </div>
                  {isDeepAgentActive ? (
                    <Loader2 className="h-5 w-5 animate-spin text-purple-400" />
                  ) : (
                    <ChevronRight className="h-5 w-5 text-purple-400 group-hover:translate-x-1 transition-transform" />
                  )}
                </div>
              </button>
            </div>

            {/* Quick Select Buttons */}
            {agentSelectionMode === 'manual' && (
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/5">
                <button
                  onClick={() => setEnabledAgents(new Set(AVAILABLE_AGENTS.map(a => a.id)))}
                  className="px-3 py-1.5 rounded-lg bg-[#2d2d2d] hover:bg-[#3d3d3d] text-xs text-gray-400 hover:text-white transition-colors"
                >
                  Select All
                </button>
                <button
                  onClick={() => setEnabledAgents(new Set())}
                  className="px-3 py-1.5 rounded-lg bg-[#2d2d2d] hover:bg-[#3d3d3d] text-xs text-gray-400 hover:text-white transition-colors"
                >
                  Clear All
                </button>
                <button
                  onClick={() => setEnabledAgents(new Set(
                    AVAILABLE_AGENTS.filter(a => a.category === 'chemistry').map(a => a.id)
                  ))}
                  className="px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/30 text-xs text-green-400 hover:bg-green-500/20 transition-colors"
                >
                  Chemistry Only
                </button>
                <button
                  onClick={() => setEnabledAgents(new Set(
                    AVAILABLE_AGENTS.filter(a => a.category === 'research' || a.category === 'writing').map(a => a.id)
                  ))}
                  className="px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/30 text-xs text-blue-400 hover:bg-blue-500/20 transition-colors"
                >
                  Research & Writing
                </button>
              </div>
            )}
          </div>

          {/* Deep Agent Status Panel */}
          {(isDeepAgentActive || deepAgentSteps.length > 0) && (
            <div className="border-b border-white/5 bg-gradient-to-r from-purple-900/10 to-blue-900/10">
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Activity className={`h-4 w-4 ${isDeepAgentActive ? 'text-purple-400 animate-pulse' : 'text-green-400'}`} />
                    <span className="text-sm font-medium">
                      {isDeepAgentActive ? 'Deep Agent Working...' : 'Research Complete'}
                    </span>
                  </div>
                  {deepAgentStatus !== 'idle' && (
                    <span className={`px-2 py-0.5 rounded-full text-xs ${
                      deepAgentStatus === 'thinking' ? 'bg-yellow-500/20 text-yellow-400' :
                      deepAgentStatus === 'searching' ? 'bg-blue-500/20 text-blue-400' :
                      deepAgentStatus === 'writing' ? 'bg-purple-500/20 text-purple-400' :
                      'bg-green-500/20 text-green-400'
                    }`}>
                      {deepAgentStatus === 'thinking' ? '🧠 Thinking' :
                       deepAgentStatus === 'searching' ? '🔍 Searching' :
                       deepAgentStatus === 'writing' ? '✍️ Writing' :
                       '✅ Complete'}
                    </span>
                  )}
                </div>
                
                {/* Agent Steps */}
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {deepAgentSteps.slice(-5).map((step) => (
                    <div key={step.id} className="flex items-center gap-2 text-xs">
                      {step.type === 'thinking' && <Brain className="h-3 w-3 text-yellow-400" />}
                      {step.type === 'searching' && <Search className="h-3 w-3 text-blue-400" />}
                      {step.type === 'writing' && <PenLine className="h-3 w-3 text-purple-400" />}
                      {step.type === 'tool' && <Zap className="h-3 w-3 text-orange-400" />}
                      {step.type === 'complete' && <CheckCircle2 className="h-3 w-3 text-green-400" />}
                      <span className="text-gray-400">{step.message}</span>
                      <span className="text-gray-600 ml-auto">
                        {step.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                    </div>
                  ))}
                  <div ref={deepAgentStepsRef} />
                </div>
                
                {/* Tasks Progress */}
                {deepAgentTasks.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-white/5">
                    {deepAgentTasks.map((task) => (
                      <div key={task.id} className="flex items-center gap-2">
                        {task.status === 'in-progress' && <Loader2 className="h-3 w-3 animate-spin text-purple-400" />}
                        {task.status === 'completed' && <CheckCircle2 className="h-3 w-3 text-green-400" />}
                        {task.status === 'error' && <AlertCircle className="h-3 w-3 text-red-400" />}
                        <span className="text-xs text-gray-300">{task.title}</span>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Final Document Link */}
                {finalDocument && researchDocId && (
                  <div className="mt-3 pt-3 border-t border-white/5">
                    <button
                      onClick={() => {
                        const doc: DocumentInfo = {
                          id: researchDocId,
                          name: finalDocument.title,
                          modifiedTime: new Date().toISOString(),
                          webViewLink: `https://docs.google.com/document/d/${researchDocId}/edit`
                        };
                        setSelectedGoogleDoc(doc);
                        setActiveView('googledoc');
                      }}
                      className="w-full p-2 rounded-lg bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 text-green-400 text-sm flex items-center gap-2 transition-colors"
                    >
                      <FileText className="h-4 w-4" />
                      View Research Document
                      <ExternalLink className="h-3 w-3 ml-auto" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="w-16 h-16 rounded-full bg-purple-500/10 flex items-center justify-center mb-4">
                  <Sparkles className="h-8 w-8 text-purple-400" />
                </div>
                <p className="text-gray-400 mb-2">AI responses will appear here</p>
                <p className="text-sm text-gray-500">Paste text and select an action to begin</p>
              </div>
            )}
            
            {messages.map((message) => (
              <div
                key={message.id}
                className={`${message.role === 'assistant' ? 'bg-[#2d2d2d] rounded-xl p-4' : ''}`}
              >
                {message.role === 'user' ? (
                  <div className="flex items-start gap-3">
                    <div className="text-xs text-gray-500">Today • {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                    <p className="text-sm text-gray-300">{message.content}</p>
                  </div>
                ) : (
                  <>
                    <div className="text-sm text-gray-200 whitespace-pre-wrap leading-relaxed mb-4">
                      {message.content}
                    </div>
                    {message.sources && message.sources.length > 0 && (
                      <div className="flex items-center gap-2 mb-3">
                        {message.sources.slice(0, 3).map((source, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 text-xs"
                          >
                            {idx + 1}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center gap-2 pt-3 border-t border-white/5">
                      <button
                        onClick={() => saveToNote(message.content)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-[#3d3d3d] text-sm text-gray-400 hover:text-white transition-colors"
                      >
                        <StickyNote className="h-4 w-4" />
                        Save to note
                      </button>
                      <button
                        onClick={() => copyToClipboard(message.content)}
                        className="p-1.5 rounded-lg hover:bg-[#3d3d3d] text-gray-400 hover:text-white transition-colors"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
            
            {isProcessing && (
              <div className="bg-[#2d2d2d] rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <Loader2 className="h-5 w-5 animate-spin text-purple-400" />
                  <span className="text-sm text-gray-400">Processing...</span>
                </div>
              </div>
            )}
            
            <div ref={chatEndRef} />
          </div>

          {/* Chat Input */}
          <div className="p-4 border-t border-white/10">
            <div className="flex items-center gap-3 p-3 rounded-full bg-[#2d2d2d] border border-white/5">
              <input
                type="text"
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="Ask a custom question..."
                onKeyDown={(e) => e.key === 'Enter' && handleCustomPrompt()}
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-gray-500"
              />
              <span className="text-xs text-gray-500">{sources.filter(s => s.selected).length} source{sources.filter(s => s.selected).length !== 1 ? 's' : ''}</span>
              <button
                onClick={handleCustomPrompt}
                disabled={isProcessing || !customPrompt.trim() || !inputText.trim()}
                className="p-2 rounded-full bg-purple-500 hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Send className="h-4 w-4 text-white" />
              </button>
            </div>
          </div>
            </>
          )}
        </main>

        {/* ============ RIGHT PANEL - STUDIO ============ */}
        {rightPanelOpen && (
          <aside className="w-72 border-l border-white/10 flex flex-col bg-[#1a1a1a]">
            {/* Studio Header */}
            <div className="p-4 flex items-center justify-between border-b border-white/5">
              <h2 className="text-sm font-medium text-gray-400">Studio</h2>
              <button
                onClick={() => setRightPanelOpen(false)}
                className="p-1 hover:bg-[#2d2d2d] rounded transition-colors"
              >
                <PanelRightClose className="h-4 w-4 text-gray-400" />
              </button>
            </div>

            {/* Studio Tools Grid */}
            <div className="p-4">
              <div className="grid grid-cols-2 gap-2">
                {studioTools.map((tool) => (
                  <button
                    key={tool.id}
                    onClick={tool.action}
                    className="p-3 rounded-xl bg-[#2d2d2d] hover:bg-[#3d3d3d] border border-white/5 hover:border-purple-500/30 text-left transition-all group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-purple-400 group-hover:text-purple-300">{tool.icon}</span>
                      <PenLine className="h-3 w-3 text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <p className="text-xs text-gray-400 mt-2">{tool.label}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Artifacts Section */}
            <div className="flex-1 overflow-y-auto border-t border-white/5">
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-gray-400">Artifacts</h3>
                  {artifacts.length > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 text-xs">
                      {artifacts.length}
                    </span>
                  )}
                </div>
                
                {artifacts.length === 0 && notes.length === 0 ? (
                  <div className="text-center py-8">
                    <FileCode className="h-8 w-8 text-gray-600 mx-auto mb-2" />
                    <p className="text-xs text-gray-500">No artifacts yet</p>
                    <p className="text-xs text-gray-600">Research outputs will appear here</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {/* Artifacts from Deep Agent */}
                    {artifacts.map((artifact) => (
                      <div
                        key={artifact.id}
                        onClick={() => {
                          setSelectedArtifact(artifact);
                          setShowArtifactModal(true);
                        }}
                        className="p-3 rounded-lg bg-[#2d2d2d] hover:bg-[#3d3d3d] cursor-pointer transition-colors group border-l-2 border-purple-500"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            {artifact.type === 'research' && <Brain className="h-4 w-4 text-purple-400" />}
                            {artifact.type === 'document' && <FileText className="h-4 w-4 text-blue-400" />}
                            {artifact.type === 'code' && <Code className="h-4 w-4 text-green-400" />}
                            {artifact.type === 'notes' && <StickyNote className="h-4 w-4 text-yellow-400" />}
                            <span className="text-sm font-medium truncate max-w-[130px]">{artifact.title}</span>
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                navigator.clipboard.writeText(artifact.content);
                                showNotification('Copied to clipboard');
                              }}
                              className="p-1 hover:bg-[#4d4d4d] rounded"
                            >
                              <Copy className="h-4 w-4 text-gray-400" />
                            </button>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setArtifacts(prev => prev.filter(a => a.id !== artifact.id));
                              }}
                              className="p-1 hover:bg-red-500/20 rounded"
                            >
                              <Trash2 className="h-4 w-4 text-red-400" />
                            </button>
                          </div>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {artifact.agentName} · {artifact.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    ))}
                    
                    {/* Legacy Notes */}
                    {notes.map((note) => (
                      <div
                        key={note.id}
                        className="p-3 rounded-lg bg-[#2d2d2d] hover:bg-[#3d3d3d] cursor-pointer transition-colors group"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            <StickyNote className="h-4 w-4 text-yellow-500" />
                            <span className="text-sm font-medium truncate max-w-[150px]">{note.title}</span>
                          </div>
                          <button className="opacity-0 group-hover:opacity-100 p-1 hover:bg-[#4d4d4d] rounded transition-all">
                            <MoreHorizontal className="h-3 w-3 text-gray-400" />
                          </button>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {note.sourceCount} source{note.sourceCount !== 1 ? 's' : ''} · {note.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Add Note Button */}
            <div className="p-4 border-t border-white/5">
              <button 
                onClick={() => {
                  const newNote: Note = {
                    id: Date.now().toString(),
                    title: 'New Note',
                    content: '',
                    timestamp: new Date(),
                    sourceCount: 0
                  };
                  setNotes(prev => [...prev, newNote]);
                }}
                className="w-full py-2.5 rounded-full bg-[#2d2d2d] hover:bg-[#3d3d3d] text-sm flex items-center justify-center gap-2 transition-colors"
              >
                <Plus className="h-4 w-4" />
                Add note
              </button>
            </div>
          </aside>
        )}

        {/* Toggle Right Panel (when closed) */}
        {!rightPanelOpen && (
          <button
            onClick={() => setRightPanelOpen(true)}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 p-2 bg-[#2d2d2d] hover:bg-[#3d3d3d] rounded-l-lg transition-colors"
          >
            <ChevronLeft className="h-4 w-4 text-gray-400" />
          </button>
        )}
      </div>

      {/* ============ ARTIFACT MODAL ============ */}
      {showArtifactModal && selectedArtifact && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-4xl max-h-[90vh] bg-[#1a1a1a] rounded-2xl border border-white/10 shadow-2xl overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                {selectedArtifact.type === 'research' && <Brain className="h-5 w-5 text-purple-400" />}
                {selectedArtifact.type === 'document' && <FileText className="h-5 w-5 text-blue-400" />}
                {selectedArtifact.type === 'code' && <Code className="h-5 w-5 text-green-400" />}
                <div>
                  <h2 className="text-lg font-medium">{selectedArtifact.title}</h2>
                  <p className="text-xs text-gray-500">{selectedArtifact.agentName} · {selectedArtifact.createdAt.toLocaleString()}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(selectedArtifact.content);
                    showNotification('Copied to clipboard');
                  }}
                  className="p-2 hover:bg-[#2d2d2d] rounded-lg transition-colors"
                  title="Copy"
                >
                  <Copy className="h-4 w-4 text-gray-400" />
                </button>
                <button
                  onClick={async () => {
                    if (googleUser) {
                      try {
                        showNotification('Creating Google Doc...');
                        const result = await createGoogleDocWithContent(
                          selectedArtifact.title,
                          selectedArtifact.content,
                          'markdown'
                        );
                        if (result.success && result.document) {
                          const newDoc: DocumentInfo = {
                            id: result.document.documentId,
                            name: result.document.title || selectedArtifact.title,
                            modifiedTime: new Date().toISOString(),
                            webViewLink: `https://docs.google.com/document/d/${result.document.documentId}/edit`
                          };
                          setGoogleDocs(prev => [newDoc, ...prev]);
                          setSelectedGoogleDoc(newDoc);
                          setShowArtifactModal(false);
                          setActiveView('googledoc');
                          showNotification('✓ Saved to Google Docs!');
                        }
                      } catch (error) {
                        showNotification('Failed to save to Google Docs');
                      }
                    } else {
                      showNotification('Sign in with Google to save');
                    }
                  }}
                  className="p-2 hover:bg-[#2d2d2d] rounded-lg transition-colors"
                  title="Save to Google Docs"
                >
                  <Save className="h-4 w-4 text-blue-400" />
                </button>
                <button
                  onClick={() => setShowArtifactModal(false)}
                  className="p-2 hover:bg-[#2d2d2d] rounded-lg transition-colors"
                >
                  <X className="h-4 w-4 text-gray-400" />
                </button>
              </div>
            </div>
            
            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="prose prose-invert prose-sm max-w-none">
                <ReactMarkdown>{selectedArtifact.content}</ReactMarkdown>
              </div>
            </div>
            
            {/* Modal Footer */}
            <div className="flex items-center justify-between p-4 border-t border-white/10 bg-[#151515]">
              <p className="text-xs text-gray-500">
                {selectedArtifact.content.split(/\s+/).length} words
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setInputText(selectedArtifact.content);
                    setShowArtifactModal(false);
                    showNotification('Content loaded to input');
                  }}
                  className="px-4 py-2 rounded-lg bg-purple-500/20 text-purple-400 text-sm hover:bg-purple-500/30 transition-colors"
                >
                  Use as Input
                </button>
                <button
                  onClick={() => setShowArtifactModal(false)}
                  className="px-4 py-2 rounded-lg bg-[#2d2d2d] text-sm hover:bg-[#3d3d3d] transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="h-8 flex items-center justify-between px-4 border-t border-white/5 bg-[#1a1a1a]">
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span>Powered by Gemini AI</span>
          <span>•</span>
          <span>© 2025 AI Word</span>
        </div>
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span>{activeView === 'editor' ? '[EDITOR MODE]' : '[AI TOOLS]'}</span>
          <span className="text-purple-400">●</span>
          <span>Ready</span>
        </div>
      </footer>

      {/* ============ NOTIFICATION TOAST ============ */}
      {notification && (
        <div className="fixed bottom-12 left-1/2 z-50 -translate-x-1/2 px-6 py-3 rounded-full bg-purple-500 text-white font-medium text-sm shadow-lg shadow-purple-500/20 animate-pulse">
          {notification}
        </div>
      )}
    </div>
  );
};

export default AIWordNotebookStyle;
