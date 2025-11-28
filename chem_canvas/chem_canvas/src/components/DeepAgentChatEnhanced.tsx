/**
 * Deep Agent Chat Component - Enhanced Version
 * 
 * Based on deep-agents-ui patterns from LangChain:
 * - Chat/Workflow toggle view
 * - Inline tasks and files panel
 * - SubAgent indicators with expand/collapse
 * - ToolCall boxes with argument details
 * - Resizable sidebar for thread history
 * - Real-time task progress
 * - Artifacts tab
 */

import React, { useState, useRef, useEffect, useCallback, useMemo, FormEvent, Fragment } from 'react';
import {
  Send,
  Brain,
  ListTodo,
  Users,
  Wrench,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Loader2,
  RefreshCcw,
  X,
  Beaker,
  BookOpen,
  Calculator,
  FlaskConical,
  Search,
  Globe,
  Key,
  CheckCircle2,
  Clock,
  Circle,
  FileText,
  Download,
  Copy,
  Eye,
  EyeOff,
  FolderOpen,
  File,
  FileCode,
  FilePlus,
  Trash2,
  Square,
  ArrowUp,
  AlertCircle,
  MessagesSquare,
  Settings2,
  PanelLeftClose,
  PanelLeft,
  GitBranch,
  Activity,
  Zap,
  Target,
  Code2,
  PenTool,
  MessageSquare,
  ArrowRight,
  Play,
  Pause,
  RotateCcw,
  Paperclip,
  Upload,
  FileImage,
  FileType
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
  getAvailableSubagents,
  getAvailableTools,
  resetDeepAgent,
  setTavilyApiKey,
  isTavilyConfigured,
  subscribeToTaskEvents,
  getFinalDocuments,
  getArtifacts,
  deleteArtifact,
  type DeepAgentMessage,
  type TodoItem as ServiceTodoItem,
  type TaskEvent,
  type TaskStatus,
  type FinalDocument,
  type Artifact
} from '../services/deepAgentService';
import { SubAgentIndicator, SubAgentContent } from './deep-agent/SubAgentIndicator';
import { ToolCallBox } from './deep-agent/ToolCallBox';
import { TasksFilesPanel } from './deep-agent/TasksFilesPanel';
import type { ToolCall, SubAgent, TodoItem, ChatMessage as ChatMessageType, ActiveTask, TaskProgressStep } from './deep-agent/types';
import { extractTextFromFile } from '../services/researchPaperAgentService';
import { GoogleDocsExportButton } from './GoogleDocsIntegration';
import 'katex/dist/katex.min.css';

// ==========================================
// Types
// ==========================================

interface DeepAgentChatProps {
  isOpen?: boolean;
  onClose?: () => void;
  className?: string;
  initialMessage?: string;
  tavilyApiKey?: string;
  debugMode?: boolean;
}

interface ProcessedMessage {
  message: ChatMessageType;
  toolCalls: ToolCall[];
  subAgents: SubAgent[];
  showAvatar: boolean;
}

// ==========================================
// Utility Functions
// ==========================================

const cleanMessageContent = (content: string): string => {
  let cleaned = content.replace(/```tool\s*[\s\S]*?```/g, '');
  cleaned = cleaned.replace(/\[TOOL:\s*\w+\][\s\S]*?\[\/TOOL\]/g, '');
  cleaned = cleaned.replace(/\[DELEGATE:\s*\S+\][\s\S]*?\[\/DELEGATE\]/g, '');
  cleaned = cleaned.replace(/^\s*\{\s*"tool"\s*:[\s\S]*?\}\s*$/gm, '');
  // Replace multiple newlines (including those with whitespace) with max 2
  cleaned = cleaned.replace(/\n\s*\n\s*\n/g, '\n\n');
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  return cleaned.trim();
};

const getStatusIcon = (status: TodoItem['status'], className?: string) => {
  switch (status) {
    case 'completed':
      return <CheckCircle2 className={`w-4 h-4 text-green-400 ${className || ''}`} />;
    case 'in_progress':
      return <Clock className={`w-4 h-4 text-blue-400 animate-pulse ${className || ''}`} />;
    default:
      return <Circle className={`w-4 h-4 text-gray-500 ${className || ''}`} />;
  }
};

// ==========================================
// Live Typing Animation Component
// ==========================================

const TypingIndicator: React.FC<{ text?: string }> = ({ text }) => (
  <div className="flex items-center gap-2">
    <div className="flex gap-1">
      <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
      <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
      <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
    </div>
    {text && <span className="text-sm text-gray-400 animate-pulse">{text}</span>}
  </div>
);

// Cursor blink animation for code typing effect
const BlinkingCursor: React.FC = () => (
  <span className="inline-block w-2 h-5 bg-purple-400 animate-pulse ml-0.5" style={{ animation: 'blink 1s infinite' }} />
);

// Live code block with typing animation
const LiveCodeBlock: React.FC<{ content: string; isStreaming: boolean }> = ({ content, isStreaming }) => {
  return (
    <div className="relative">
      <pre className="bg-gray-900 rounded-lg p-4 overflow-x-auto text-sm font-mono text-gray-300 border border-gray-700">
        <code>{content}</code>
        {isStreaming && <BlinkingCursor />}
      </pre>
      {isStreaming && (
        <div className="absolute top-2 right-2 flex items-center gap-2">
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          <span className="text-xs text-green-400">Writing...</span>
        </div>
      )}
    </div>
  );
};

// Workflow Step Component
interface WorkflowStepProps {
  step: {
    id: string;
    title: string;
    type: 'thinking' | 'tool' | 'search' | 'file' | 'subagent' | 'writing';
    status: 'pending' | 'in-progress' | 'completed' | 'error';
    message?: string;
    duration?: number;
  };
  isLast: boolean;
}

const WorkflowStep: React.FC<WorkflowStepProps> = ({ step, isLast }) => {
  const getStepIcon = () => {
    switch (step.type) {
      case 'thinking': return <Brain className="w-5 h-5" />;
      case 'tool': return <Wrench className="w-5 h-5" />;
      case 'search': return <Search className="w-5 h-5" />;
      case 'file': return <FileText className="w-5 h-5" />;
      case 'subagent': return <Users className="w-5 h-5" />;
      case 'writing': return <PenTool className="w-5 h-5" />;
      default: return <Zap className="w-5 h-5" />;
    }
  };

  const getStepColor = () => {
    switch (step.status) {
      case 'completed': return 'text-green-400 border-green-400 bg-green-400/10';
      case 'in-progress': return 'text-blue-400 border-blue-400 bg-blue-400/10';
      case 'error': return 'text-red-400 border-red-400 bg-red-400/10';
      default: return 'text-gray-500 border-gray-600 bg-gray-800';
    }
  };

  return (
    <div className="flex items-start gap-3">
      {/* Step Icon */}
      <div className={`flex-shrink-0 w-10 h-10 rounded-full border-2 flex items-center justify-center ${getStepColor()}`}>
        {step.status === 'in-progress' ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          getStepIcon()
        )}
      </div>

      {/* Step Content */}
      <div className="flex-1 min-w-0 pb-4">
        <div className="flex items-center gap-2">
          <span className={`font-medium ${step.status === 'in-progress' ? 'text-blue-300' : step.status === 'completed' ? 'text-green-300' : 'text-gray-300'}`}>
            {step.title}
          </span>
          {step.status === 'in-progress' && (
            <span className="flex items-center gap-1 text-xs text-blue-400 animate-pulse">
              <Activity className="w-3 h-3" />
              Processing...
            </span>
          )}
          {step.duration && step.status === 'completed' && (
            <span className="text-xs text-gray-500">{(step.duration / 1000).toFixed(1)}s</span>
          )}
        </div>
        {step.message && (
          <p className="text-sm text-gray-400 mt-1 truncate">{step.message}</p>
        )}

        {/* Connection Line */}
        {!isLast && (
          <div className={`absolute left-[19px] top-10 w-0.5 h-full ${step.status === 'completed' ? 'bg-green-400/50' : 'bg-gray-700'}`} />
        )}
      </div>
    </div>
  );
};

// ==========================================
// Main Component
// ==========================================

const DeepAgentChat: React.FC<DeepAgentChatProps> = ({
  isOpen = true,
  onClose,
  className = '',
  initialMessage,
  tavilyApiKey: propTavilyKey,
  debugMode = false
}) => {
  // Core State
  const [messages, setMessages] = useState<DeepAgentMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streamingContent, setStreamingContent] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);

  // View State
  const [viewMode, setViewMode] = useState<'chat' | 'workflow'>('chat');
  const [activeTab, setActiveTab] = useState<'chat' | 'artifacts'>('chat');
  const [showSidebar, setShowSidebar] = useState(false);
  const [metaOpen, setMetaOpen] = useState<'tasks' | 'files' | null>(null);

  // Agent State
  const [currentTodos, setCurrentTodos] = useState<TodoItem[]>([]);
  const [currentFiles, setCurrentFiles] = useState<Record<string, string>>({});
  const [activeSubagent, setActiveSubagent] = useState<string | null>(null);
  const [activeTasks, setActiveTasks] = useState<ActiveTask[]>([]);
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());

  // Tool Calls Tracking
  const [toolCalls, setToolCalls] = useState<ToolCall[]>([]);
  const [expandedSubAgents, setExpandedSubAgents] = useState<Record<string, boolean>>({});

  // Settings State
  const [showSettings, setShowSettings] = useState(false);
  const [tavilyKey, setTavilyKey] = useState(propTavilyKey || '');
  const [tavilyConfigured, setTavilyConfigured] = useState(false);

  // Final Document State
  const [finalDocument, setFinalDocument] = useState<FinalDocument | null>(null);
  const [showFinalDocument, setShowFinalDocument] = useState(false);

  // Artifacts State
  const [artifactsList, setArtifactsList] = useState<Artifact[]>([]);
  const [selectedArtifact, setSelectedArtifact] = useState<Artifact | null>(null);

  // Upload State
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Get available tools and subagents
  const availableTools = getAvailableTools();
  const availableSubagents = getAvailableSubagents();

  // Computed State
  const hasTasks = currentTodos.length > 0;
  const hasFiles = Object.keys(currentFiles).length > 0;

  const groupedTodos = useMemo(() => ({
    in_progress: currentTodos.filter(t => t.status === 'in_progress'),
    pending: currentTodos.filter(t => t.status === 'pending'),
    completed: currentTodos.filter(t => t.status === 'completed'),
  }), [currentTodos]);

  // Extract subagents from tool calls
  const subAgents = useMemo<SubAgent[]>(() => {
    return toolCalls
      .filter(tc => tc.name === 'task' && tc.args?.subagent_type)
      .map(tc => ({
        id: tc.id,
        name: tc.name,
        subAgentName: String(tc.args.subagent_type || ''),
        input: tc.args,
        output: tc.result ? { result: tc.result } : undefined,
        status: tc.status === 'completed'
          ? 'completed' as const
          : tc.status === 'error'
            ? 'error' as const
            : tc.status === 'pending'
              ? 'active' as const
              : 'pending' as const,
      }));
  }, [toolCalls]);

  // Subscribe to task events
  useEffect(() => {
    const unsubscribe = subscribeToTaskEvents((event: TaskEvent) => {
      console.log('Task event:', event);

      switch (event.type) {
        case 'task-start':
          setActiveTasks(prev => [...prev, {
            id: event.taskId,
            title: event.title || 'Processing',
            status: 'in-progress' as const,
            steps: [],
            startTime: Date.now()
          }]);
          setExpandedTasks(prev => new Set([...prev, event.taskId]));
          break;

        case 'thinking':
        case 'tool-call':
        case 'searching':
        case 'writing':
          setActiveTasks(prev => prev.map(task =>
            task.id === event.taskId ? {
              ...task,
              steps: [...task.steps, {
                id: `step-${Date.now()}`,
                title: event.message || event.title || 'Working...',
                status: 'in-progress' as const,
                type: event.type === 'tool-call' ? 'tool' :
                  event.type === 'searching' ? 'search' :
                    event.type === 'writing' ? 'file' : 'thinking',
                startTime: Date.now()
              }]
            } : task
          ));

          // Track tool calls
          if (event.type === 'tool-call' && event.data?.toolName) {
            const newToolCall: ToolCall = {
              id: `tc-${Date.now()}`,
              name: event.data.toolName,
              args: event.data.args || {},
              status: 'pending'
            };
            setToolCalls(prev => [...prev, newToolCall]);
          }
          break;

        case 'step-stream':
          setActiveTasks(prev => prev.map(task =>
            task.id === event.taskId ? {
              ...task,
              steps: task.steps.map((step, idx) =>
                idx === task.steps.length - 1 ? {
                  ...step,
                  streamContent: (step.streamContent || '') + (event.data?.content || '')
                } : step
              )
            } : task
          ));
          break;

        case 'step-complete':
          // Mark the most recent in-progress step as completed
          setActiveTasks(prev => prev.map(task =>
            task.id === event.taskId ? {
              ...task,
              steps: task.steps.map((step, idx) =>
                step.status === 'in-progress' ? {
                  ...step,
                  status: 'completed' as const,
                  endTime: Date.now()
                } : step
              )
            } : task
          ));
          break;

        case 'tool-result':
          setActiveTasks(prev => prev.map(task =>
            task.id === event.taskId ? {
              ...task,
              steps: task.steps.map((step, idx) =>
                idx === task.steps.length - 1 ? {
                  ...step,
                  status: 'completed' as const,
                  endTime: Date.now()
                } : step
              )
            } : task
          ));

          // Update tool call result
          if (event.data?.result) {
            setToolCalls(prev => prev.map((tc, idx) =>
              idx === prev.length - 1 ? {
                ...tc,
                result: String(event.data?.result || ''),
                status: 'completed' as const
              } : tc
            ));
          }
          break;

        case 'task-update':
          if (event.data?.todos) {
            const mappedTodos: TodoItem[] = event.data.todos.map((t: ServiceTodoItem) => ({
              id: t.id,
              content: t.title,
              status: t.status === 'in-progress' ? 'in_progress' : t.status as 'pending' | 'completed',
            }));
            setCurrentTodos(mappedTodos);
          }
          if (event.data?.files) {
            setCurrentFiles(event.data.files as Record<string, string>);
          }
          break;

        case 'task-complete':
          setActiveTasks(prev => prev.map(task =>
            task.id === event.taskId ? {
              ...task,
              status: 'completed' as const,
              endTime: Date.now()
            } : task
          ));
          setTimeout(() => {
            setExpandedTasks(prev => {
              const next = new Set(prev);
              next.delete(event.taskId);
              return next;
            });
          }, 2000);
          break;

        case 'task-error':
          setActiveTasks(prev => prev.map(task =>
            task.id === event.taskId ? {
              ...task,
              status: 'error' as const
            } : task
          ));
          break;

        case 'document-ready':
          if (event.data) {
            setFinalDocument(event.data as FinalDocument);
            setShowFinalDocument(true);
          }
          break;

        case 'artifact-created':
          setArtifactsList(getArtifacts());
          break;
      }
    });

    return unsubscribe;
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent, activeTasks]);

  // Set Tavily API key from props
  useEffect(() => {
    if (propTavilyKey) {
      setTavilyApiKey(propTavilyKey);
      setTavilyKey(propTavilyKey);
      setTavilyConfigured(true);
    }
  }, [propTavilyKey]);

  // Initialize deep agent
  useEffect(() => {
    const init = async () => {
      if (!isDeepAgentInitialized()) {
        setIsInitializing(true);
        try {
          await initializeDeepAgent({ tavilyApiKey: propTavilyKey });
          setTavilyConfigured(isTavilyConfigured());
          setError(null);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to initialize Deep Agent');
        } finally {
          setIsInitializing(false);
        }
      }
    };
    init();
  }, []);

  // Handle initial message
  useEffect(() => {
    if (initialMessage && isDeepAgentInitialized() && messages.length === 0) {
      handleSendMessage(initialMessage);
    }
  }, [initialMessage, isInitializing]);

  // Save Tavily API key
  const handleSaveTavilyKey = useCallback(() => {
    if (tavilyKey.trim()) {
      setTavilyApiKey(tavilyKey.trim());
      setTavilyConfigured(true);
      setShowSettings(false);
    }
  }, [tavilyKey]);

  // Send message handler
  const handleSendMessage = useCallback(async (messageContent?: string) => {
    const content = messageContent || inputMessage.trim();
    if (!content || isLoading) return;

    setInputMessage('');
    setError(null);
    setIsLoading(true);
    setIsStreaming(true);
    setStreamingContent('');
    setToolCalls([]);

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

      if (assistantMessage.todos && assistantMessage.todos.length > 0) {
        const mappedTodos: TodoItem[] = assistantMessage.todos.map(t => ({
          id: t.id,
          content: t.title,
          status: t.status === 'in-progress' ? 'in_progress' : t.status as 'pending' | 'completed',
        }));
        setCurrentTodos(mappedTodos);
      }

      if (assistantMessage.subagentUsed) {
        setActiveSubagent(assistantMessage.subagentUsed);
      }
    } catch (err) {
      console.error('Error sending message:', err);
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
  }, [inputMessage, isLoading, messages]);

  // Handle form submit
  const handleSubmit = useCallback((e?: FormEvent) => {
    e?.preventDefault();
    handleSendMessage();
  }, [handleSendMessage]);

  // Handle key press
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }, [handleSubmit]);

  // Handle file upload
  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsProcessingUpload(true);
    const newFiles: typeof uploadedFiles = [];

    for (const file of Array.from(files)) {
      // Add file to list with processing state
      const fileEntry = {
        file,
        name: file.name,
        type: file.type,
        size: file.size,
        isProcessing: true
      };
      newFiles.push(fileEntry);
    }

    setUploadedFiles(prev => [...prev, ...newFiles]);

    // Process each file
    for (let i = 0; i < newFiles.length; i++) {
      const fileEntry = newFiles[i];
      try {
        const result = await extractTextFromFile(fileEntry.file);
        setUploadedFiles(prev => prev.map(f =>
          f.name === fileEntry.name && f.size === fileEntry.size
            ? { ...f, content: result.text, isProcessing: false }
            : f
        ));
      } catch (error) {
        console.error('Error processing file:', error);
        setUploadedFiles(prev => prev.map(f =>
          f.name === fileEntry.name && f.size === fileEntry.size
            ? { ...f, error: 'Failed to extract content', isProcessing: false }
            : f
        ));
      }
    }

    setIsProcessingUpload(false);
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  // Remove uploaded file
  const removeUploadedFile = useCallback((fileName: string, fileSize: number) => {
    setUploadedFiles(prev => prev.filter(f => !(f.name === fileName && f.size === fileSize)));
  }, []);

  // Get file icon based on type
  const getFileIcon = (type: string) => {
    if (type.includes('pdf')) return <FileText className="w-4 h-4 text-red-400" />;
    if (type.includes('image')) return <FileImage className="w-4 h-4 text-blue-400" />;
    if (type.includes('text') || type.includes('json')) return <FileCode className="w-4 h-4 text-green-400" />;
    return <File className="w-4 h-4 text-gray-400" />;
  };

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Build message with file context
  const buildMessageWithFiles = useCallback((): string => {
    let message = inputMessage.trim();

    if (uploadedFiles.length > 0) {
      const fileContents = uploadedFiles
        .filter(f => f.content && !f.error)
        .map(f => `\n\n--- File: ${f.name} ---\n${f.content}`)
        .join('');

      if (fileContents) {
        message = message
          ? `${message}\n\nI'm sharing the following documents for context:${fileContents}`
          : `Please analyze the following documents:${fileContents}`;
      }
    }

    return message;
  }, [inputMessage, uploadedFiles]);

  // Modified send that includes files
  const handleSendWithFiles = useCallback(async () => {
    const messageWithFiles = buildMessageWithFiles();
    if (!messageWithFiles.trim()) return;

    // Clear files after sending
    setUploadedFiles([]);

    // Use the original send with the combined message
    setInputMessage(messageWithFiles);
    setTimeout(() => handleSendMessage(messageWithFiles), 0);
  }, [buildMessageWithFiles, handleSendMessage]);

  // Stop streaming
  const stopStream = useCallback(() => {
    setIsLoading(false);
    setIsStreaming(false);
  }, []);

  // Reset chat
  const handleReset = useCallback(() => {
    setMessages([]);
    setCurrentTodos([]);
    setCurrentFiles({});
    setActiveSubagent(null);
    setError(null);
    setStreamingContent('');
    setActiveTasks([]);
    setFinalDocument(null);
    setShowFinalDocument(false);
    setArtifactsList([]);
    setSelectedArtifact(null);
    setActiveTab('chat');
    setToolCalls([]);
    resetDeepAgent();
  }, []);

  // Handle artifact deletion
  const handleDeleteArtifact = useCallback((id: string) => {
    deleteArtifact(id);
    setArtifactsList(getArtifacts());
    if (selectedArtifact?.id === id) {
      setSelectedArtifact(null);
    }
  }, [selectedArtifact]);

  // Toggle subagent expanded
  const toggleSubAgent = useCallback((id: string) => {
    setExpandedSubAgents(prev => ({
      ...prev,
      [id]: prev[id] === undefined ? false : !prev[id]
    }));
  }, []);

  const isSubAgentExpanded = useCallback(
    (id: string) => expandedSubAgents[id] ?? true,
    [expandedSubAgents]
  );

  // Get artifact icon
  const getArtifactIcon = (type: Artifact['type']) => {
    switch (type) {
      case 'plan': return <ListTodo className="w-4 h-4 text-blue-400" />;
      case 'research': return <Search className="w-4 h-4 text-green-400" />;
      case 'notes': return <FileText className="w-4 h-4 text-yellow-400" />;
      case 'document': return <File className="w-4 h-4 text-purple-400" />;
      case 'code': return <FileCode className="w-4 h-4 text-orange-400" />;
      default: return <File className="w-4 h-4 text-gray-400" />;
    }
  };

  if (!isOpen) return null;

  // ==========================================
  // Render Chat/Workflow Toggle
  // ==========================================

  const ViewToggle = (
    <div className="flex justify-center py-2">
      <div className="flex h-8 items-center gap-0 overflow-hidden rounded-lg border border-gray-600 bg-gray-800 p-1 text-xs shadow-sm">
        <button
          onClick={() => setViewMode('chat')}
          className={`flex h-full items-center justify-center px-4 rounded transition-colors ${viewMode === 'chat' ? 'bg-purple-500/30 text-purple-300' : 'text-gray-400 hover:text-white'
            }`}
        >
          Chat
        </button>
        <button
          onClick={() => setViewMode('workflow')}
          className={`flex h-full items-center justify-center px-4 rounded transition-colors ${viewMode === 'workflow' ? 'bg-purple-500/30 text-purple-300' : 'text-gray-400 hover:text-white'
            }`}
        >
          Workflow
        </button>
      </div>
    </div>
  );

  // ==========================================
  // Main Render
  // ==========================================

  return (
    <div className={`flex flex-col h-full bg-gray-900 text-white font-sans ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-3">
          {/* Sidebar Toggle */}
          <button
            onClick={() => setShowSidebar(!showSidebar)}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
            title={showSidebar ? 'Hide sidebar' : 'Show sidebar'}
          >
            {showSidebar ? <PanelLeftClose className="w-5 h-5" /> : <PanelLeft className="w-5 h-5" />}
          </button>

          <div className="p-2 bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg">
            <Brain className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Deep Agent</h2>
            <p className="text-xs text-gray-400 flex items-center gap-1">
              Gemini • Tavily • Planning
              {tavilyConfigured && <CheckCircle2 className="w-3 h-3 text-green-400" />}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Google Docs Export - only show when there's content to export */}
          {(messages.length > 1 || finalDocument) && (
            <GoogleDocsExportButton
              content={finalDocument?.content || messages.map(m => `${m.role}: ${m.content}`).join('\n\n')}
              title={finalDocument?.title || 'Deep Agent Research'}
              exportType="deep-agent"
              conversationHistory={messages.map(m => ({
                role: m.role,
                content: m.content,
                timestamp: m.timestamp
              }))}
              variant="icon-only"
            />
          )}
          {finalDocument && (
            <button
              onClick={() => setShowFinalDocument(!showFinalDocument)}
              className="p-2 text-green-400 hover:bg-gray-700 rounded-lg transition-colors"
              title={showFinalDocument ? "Hide Document" : "Show Document"}
            >
              {showFinalDocument ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          )}
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`p-2 hover:bg-gray-700 rounded-lg transition-colors ${tavilyConfigured ? 'text-green-400' : 'text-yellow-400'
              }`}
            title="Configure API Keys"
          >
            <Key className="w-4 h-4" />
          </button>
          <button
            onClick={handleReset}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
            title="Reset conversation"
          >
            <RefreshCcw className="w-4 h-4" />
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-gray-700 bg-gray-800/50">
        <button
          onClick={() => setActiveTab('chat')}
          className={`flex-1 py-2 px-4 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${activeTab === 'chat'
            ? 'text-purple-400 border-b-2 border-purple-400 bg-gray-800/50'
            : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
            }`}
        >
          <Brain className="w-4 h-4" />
          Chat
        </button>
        <button
          onClick={() => {
            setActiveTab('artifacts');
            setArtifactsList(getArtifacts());
          }}
          className={`flex-1 py-2 px-4 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${activeTab === 'artifacts'
            ? 'text-purple-400 border-b-2 border-purple-400 bg-gray-800/50'
            : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
            }`}
        >
          <FolderOpen className="w-4 h-4" />
          Artifacts
          {artifactsList.length > 0 && (
            <span className="px-1.5 py-0.5 text-xs bg-purple-500/30 text-purple-300 rounded-full">
              {artifactsList.length}
            </span>
          )}
        </button>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="p-4 bg-gray-800 border-b border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium flex items-center gap-2">
              <Globe className="w-4 h-4" />
              Tavily API Key
            </h3>
            <button onClick={() => setShowSettings(false)} className="text-gray-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex gap-2">
            <input
              type="password"
              value={tavilyKey}
              onChange={(e) => setTavilyKey(e.target.value)}
              placeholder="Enter Tavily API key..."
              className="flex-1 px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <button
              onClick={handleSaveTavilyKey}
              disabled={!tavilyKey.trim()}
              className="px-4 py-2 bg-purple-500 hover:bg-purple-600 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors"
            >
              Save
            </button>
          </div>
          <p className="mt-2 text-xs text-gray-500">
            Get your key from <a href="https://tavily.com" target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:underline">tavily.com</a>
          </p>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        {showSidebar && (
          <div className="w-64 border-r border-gray-700 bg-gray-850 flex flex-col overflow-hidden">
            {/* Subagents Section */}
            <div className="p-3 border-b border-gray-700">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
                Available Subagents
              </h3>
              <div className="space-y-1">
                {availableSubagents.map((subagent: { name: string; description: string }) => (
                  <div
                    key={subagent.name}
                    className={`flex items-center gap-2 p-2 rounded-lg text-xs ${activeSubagent === subagent.name
                      ? 'bg-purple-500/20 border border-purple-500/50'
                      : 'bg-gray-800/50 hover:bg-gray-700/50'
                      }`}
                  >
                    <Users className={`w-4 h-4 ${activeSubagent === subagent.name ? 'text-purple-400' : 'text-gray-500'}`} />
                    <div className="min-w-0">
                      <div className="font-medium text-gray-200 truncate">{subagent.name}</div>
                      <div className="text-gray-500 truncate">{subagent.description}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Tools Section */}
            <div className="flex-1 overflow-y-auto p-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
                Available Tools
              </h3>
              <div className="space-y-1">
                {availableTools.map((tool: { name: string; description: string }) => (
                  <div
                    key={tool.name}
                    className="flex items-center gap-2 p-2 bg-gray-800/50 hover:bg-gray-700/50 rounded-lg text-xs"
                  >
                    <Wrench className="w-4 h-4 text-gray-500" />
                    <div className="min-w-0">
                      <div className="font-medium text-gray-200 truncate">{tool.name}</div>
                      <div className="text-gray-500 truncate">{tool.description}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Chat Tab Content */}
        {activeTab === 'chat' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {ViewToggle}

            {/* Workflow View */}
            {viewMode === 'workflow' && (
              <div className="flex-1 overflow-y-auto bg-gray-850 p-6">
                <div className="max-w-4xl mx-auto">
                  {/* Workflow Header */}
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-purple-500/20 rounded-lg">
                        <GitBranch className="w-6 h-6 text-purple-400" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-white">Agent Workflow</h3>
                        <p className="text-sm text-gray-400">Real-time task execution pipeline</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isLoading && (
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/20 rounded-full">
                          <Activity className="w-4 h-4 text-blue-400 animate-pulse" />
                          <span className="text-sm text-blue-400">Processing</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Live Pipeline Status */}
                  {(activeTasks.length > 0 || isLoading) && (
                    <div className="mb-6 p-4 bg-gray-800 rounded-xl border border-gray-700">
                      <h4 className="text-sm font-medium text-gray-300 mb-4 flex items-center gap-2">
                        <Target className="w-4 h-4 text-purple-400" />
                        Active Pipeline
                      </h4>
                      <div className="space-y-4">
                        {activeTasks.map(task => (
                          <div key={task.id} className="relative pl-6">
                            <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-gradient-to-b from-purple-500 to-purple-500/20" />
                            <div className="flex items-start gap-3 mb-2">
                              <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${task.status === 'completed' ? 'bg-green-500/20' :
                                task.status === 'error' ? 'bg-red-500/20' : 'bg-purple-500/20'
                                }`}>
                                {task.status === 'completed' ? (
                                  <CheckCircle2 className="w-5 h-5 text-green-400" />
                                ) : task.status === 'error' ? (
                                  <AlertCircle className="w-5 h-5 text-red-400" />
                                ) : (
                                  <Loader2 className="w-5 h-5 text-purple-400 animate-spin" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className={`font-medium ${task.status === 'completed' ? 'text-green-300' :
                                    task.status === 'error' ? 'text-red-300' : 'text-white'
                                    }`}>{task.title}</span>
                                  <span className="text-xs text-gray-500">
                                    {task.steps.filter(s => s.status === 'completed').length}/{task.steps.length}
                                  </span>
                                </div>
                                {/* Progress Bar */}
                                <div className="mt-2 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full transition-all duration-500 ${task.status === 'completed' ? 'bg-green-500' :
                                      task.status === 'error' ? 'bg-red-500' : 'bg-purple-500'
                                      }`}
                                    style={{ width: `${task.steps.length ? (task.steps.filter(s => s.status === 'completed').length / task.steps.length) * 100 : 0}%` }}
                                  />
                                </div>
                                {/* Steps */}
                                <div className="mt-3 space-y-2">
                                  {task.steps.map((step, idx) => (
                                    <div key={step.id || idx}>
                                      <div
                                        className={`flex items-center gap-2 p-2 rounded-lg ${step.status === 'completed' ? 'bg-gray-800/50' :
                                          step.status === 'error' ? 'bg-red-500/10' : 'bg-gray-800'
                                          }`}
                                      >
                                        {step.status === 'completed' ? (
                                          <CheckCircle2 className="w-4 h-4 text-green-400" />
                                        ) : step.status === 'error' ? (
                                          <AlertCircle className="w-4 h-4 text-red-400" />
                                        ) : (
                                          <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
                                        )}
                                        {step.type === 'thinking' && <Brain className="w-4 h-4 text-purple-400" />}
                                        {step.type === 'tool' && <Wrench className="w-4 h-4 text-yellow-400" />}
                                        {step.type === 'search' && <Globe className="w-4 h-4 text-blue-400" />}
                                        {step.type === 'file' && <FileText className="w-4 h-4 text-green-400" />}
                                        <span className="text-sm text-gray-300 flex-1 truncate">{step.title}</span>
                                        {step.endTime && step.startTime && (
                                          <span className="text-xs text-gray-500">{((step.endTime - step.startTime) / 1000).toFixed(1)}s</span>
                                        )}
                                      </div>
                                      {step.streamContent && (
                                        <div className="ml-8 mt-1 p-2 bg-gray-900/50 rounded text-xs font-mono text-gray-400 whitespace-pre-wrap max-h-32 overflow-y-auto border border-gray-700/50">
                                          {step.streamContent}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}

                        {/* Streaming indicator in workflow */}
                        {isStreaming && (
                          <div className="relative pl-6">
                            <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-gradient-to-b from-blue-500 to-blue-500/20" />
                            <div className="flex items-start gap-3">
                              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                                <PenTool className="w-5 h-5 text-blue-400" />
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-blue-300">Writing Response</span>
                                  <div className="flex gap-1">
                                    <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                    <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                    <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                  </div>
                                </div>
                                <div className="mt-2 p-3 bg-gray-800 rounded-lg border border-blue-500/30">
                                  <div className="text-xs text-gray-400 mb-2">{streamingContent.length} characters generated</div>
                                  <div className="text-sm text-gray-300 line-clamp-3">
                                    {streamingContent.slice(-200)}
                                    <span className="inline-block w-2 h-4 bg-blue-400 ml-0.5" style={{ animation: 'blink 1s infinite' }} />
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Tool Calls Timeline */}
                  {toolCalls.length > 0 && (
                    <div className="mb-6 p-4 bg-gray-800 rounded-xl border border-gray-700">
                      <h4 className="text-sm font-medium text-gray-300 mb-4 flex items-center gap-2">
                        <Wrench className="w-4 h-4 text-yellow-400" />
                        Tool Executions ({toolCalls.length})
                      </h4>
                      <div className="space-y-2">
                        {toolCalls.map((tc, idx) => (
                          <div
                            key={tc.id}
                            className={`flex items-center gap-3 p-3 rounded-lg border ${tc.status === 'completed' ? 'bg-green-500/10 border-green-500/30' :
                              tc.status === 'error' ? 'bg-red-500/10 border-red-500/30' :
                                'bg-gray-700 border-gray-600'
                              }`}
                          >
                            <div className="flex-shrink-0">
                              {tc.status === 'completed' ? (
                                <CheckCircle2 className="w-5 h-5 text-green-400" />
                              ) : tc.status === 'error' ? (
                                <AlertCircle className="w-5 h-5 text-red-400" />
                              ) : (
                                <Loader2 className="w-5 h-5 text-yellow-400 animate-spin" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-gray-200">{tc.name}</div>
                              {tc.args && <div className="text-xs text-gray-500 truncate">{JSON.stringify(tc.args).slice(0, 100)}</div>}
                            </div>
                            <ArrowRight className="w-4 h-4 text-gray-500" />
                            <div className="text-xs text-gray-400">
                              {tc.status === 'completed' ? 'Done' : tc.status === 'pending' ? 'Pending' : tc.status}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* SubAgents Section */}
                  {subAgents.length > 0 && (
                    <div className="mb-6 p-4 bg-gray-800 rounded-xl border border-gray-700">
                      <h4 className="text-sm font-medium text-gray-300 mb-4 flex items-center gap-2">
                        <Users className="w-4 h-4 text-purple-400" />
                        Specialized Subagents ({subAgents.length})
                      </h4>
                      <div className="grid grid-cols-2 gap-3">
                        {subAgents.map(sa => (
                          <div key={sa.id} className={`p-3 rounded-lg border ${sa.status === 'completed' ? 'bg-green-500/10 border-green-500/30' :
                            sa.status === 'error' ? 'bg-red-500/10 border-red-500/30' :
                              'bg-purple-500/10 border-purple-500/30'
                            }`}>
                            <div className="flex items-center gap-2 mb-2">
                              {sa.status === 'completed' ? (
                                <CheckCircle2 className="w-4 h-4 text-green-400" />
                              ) : sa.status === 'error' ? (
                                <AlertCircle className="w-4 h-4 text-red-400" />
                              ) : (
                                <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />
                              )}
                              <span className="font-medium text-gray-200">{sa.name}</span>
                            </div>
                            <p className="text-xs text-gray-400 line-clamp-2">{sa.input ? JSON.stringify(sa.input).slice(0, 50) : sa.name}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Empty State */}
                  {activeTasks.length === 0 && toolCalls.length === 0 && subAgents.length === 0 && !isLoading && (
                    <div className="text-center py-12">
                      <div className="inline-flex p-4 bg-gray-800 rounded-full mb-4">
                        <GitBranch className="w-8 h-8 text-gray-600" />
                      </div>
                      <h4 className="text-lg font-medium text-gray-400 mb-2">No Active Workflow</h4>
                      <p className="text-sm text-gray-500">Start a conversation to see the agent workflow visualization</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Chat View */}
            {viewMode === 'chat' && (
              <>
                {/* Messages Area */}
                <div
                  ref={scrollRef}
                  className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain"
                >
                  <div className="mx-auto w-full max-w-4xl px-6 pb-6 pt-4">
                    {/* Initialization State */}
                    {isInitializing && (
                      <div className="flex items-center justify-center py-8">
                        <div className="flex items-center gap-3 text-gray-400">
                          <Loader2 className="w-5 h-5 animate-spin" />
                          <span>Initializing Deep Agent...</span>
                        </div>
                      </div>
                    )}

                    {/* Error State */}
                    {error && !isInitializing && (
                      <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4 text-red-400 mb-4">
                        <div className="font-medium">Error</div>
                        <div className="text-sm mt-1">{error}</div>
                        <button
                          onClick={() => initializeDeepAgent().then(() => setError(null))}
                          className="mt-2 text-sm underline hover:no-underline"
                        >
                          Try again
                        </button>
                      </div>
                    )}

                    {/* Welcome Message */}
                    {messages.length === 0 && !isInitializing && !error && (
                      <div className="text-center py-8">
                        <div className="inline-flex p-4 bg-gradient-to-r from-purple-500/20 to-blue-500/20 rounded-full mb-4">
                          <Brain className="w-12 h-12 text-purple-400" />
                        </div>
                        <h3 className="text-xl font-semibold mb-2">Welcome to Deep Agent</h3>
                        <p className="text-gray-400 mb-6 max-w-md mx-auto">
                          Advanced chemistry assistant with planning, specialized tools, and expert subagents.
                        </p>
                        <div className="grid grid-cols-2 gap-2 max-w-sm mx-auto">
                          <button
                            onClick={() => handleSendMessage("Help me understand organic reaction mechanisms")}
                            className="p-3 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-left transition-colors"
                          >
                            <FlaskConical className="w-4 h-4 text-purple-400 mb-1" />
                            <div className="text-gray-200">Reaction Mechanisms</div>
                          </button>
                          <button
                            onClick={() => handleSendMessage("Generate practice problems for stoichiometry")}
                            className="p-3 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-left transition-colors"
                          >
                            <Calculator className="w-4 h-4 text-blue-400 mb-1" />
                            <div className="text-gray-200">Practice Problems</div>
                          </button>
                          <button
                            onClick={() => handleSendMessage("Search for information about caffeine molecule")}
                            className="p-3 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-left transition-colors"
                          >
                            <Search className="w-4 h-4 text-green-400 mb-1" />
                            <div className="text-gray-200">Molecule Search</div>
                          </button>
                          <button
                            onClick={() => handleSendMessage("Explain the concept of electronegativity")}
                            className="p-3 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-left transition-colors"
                          >
                            <BookOpen className="w-4 h-4 text-yellow-400 mb-1" />
                            <div className="text-gray-200">Concept Explanation</div>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Messages */}
                    {messages.map((message, index) => (
                      <div
                        key={index}
                        className={`flex w-full max-w-full overflow-x-hidden mb-4 ${message.role === 'user' ? 'justify-end' : 'justify-start'
                          }`}
                      >
                        <div className={`min-w-0 max-w-full ${message.role === 'user' ? 'max-w-[70%]' : 'w-full'}`}>
                          <div
                            className={`rounded-lg p-3 ${message.role === 'user'
                              ? 'bg-purple-500 text-white ml-auto'
                              : 'bg-gray-800 text-gray-100'
                              }`}
                          >
                            {message.role === 'assistant' && (
                              <div className="flex items-center gap-2 mb-2 pb-2 border-b border-gray-700">
                                <Sparkles className="w-4 h-4 text-purple-400" />
                                <span className="text-sm text-gray-400">Deep Agent</span>
                                {message.subagentUsed && (
                                  <span className="text-xs px-2 py-0.5 bg-purple-500/20 text-purple-400 rounded-full">
                                    via {message.subagentUsed}
                                  </span>
                                )}
                              </div>
                            )}
                            <div className="prose prose-invert prose-sm max-w-none">
                              <ReactMarkdown
                                remarkPlugins={[remarkGfm, remarkMath]}
                                rehypePlugins={[rehypeKatex]}
                              >
                                {cleanMessageContent(message.content)}
                              </ReactMarkdown>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}

                    {/* Streaming Content with Live Animation */}
                    {isStreaming && (
                      <div className="flex justify-start mb-4">
                        <div className="max-w-full w-full rounded-lg p-4 bg-gray-800 border border-purple-500/30">
                          {/* Animated Header */}
                          <div className="flex items-center justify-between mb-3 pb-3 border-b border-gray-700">
                            <div className="flex items-center gap-3">
                              <div className="relative">
                                <Brain className="w-6 h-6 text-purple-400" />
                                <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full animate-pulse" />
                              </div>
                              <div>
                                <span className="text-sm font-medium text-purple-300">Deep Agent</span>
                                <div className="flex items-center gap-2 text-xs text-gray-400">
                                  <Activity className="w-3 h-3 text-green-400 animate-pulse" />
                                  <span>Writing response...</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="flex gap-1">
                                <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                              </div>
                            </div>
                          </div>

                          {/* Live Content with Typing Effect */}
                          {streamingContent ? (
                            <div className="prose prose-invert prose-sm max-w-none">
                              <ReactMarkdown
                                remarkPlugins={[remarkGfm, remarkMath]}
                                rehypePlugins={[rehypeKatex]}
                                components={{
                                  code: ({ node, inline, className, children, ...props }: any) => {
                                    if (inline) {
                                      return <code className="bg-gray-700 px-1.5 py-0.5 rounded text-purple-300" {...props}>{children}</code>;
                                    }
                                    return (
                                      <div className="relative my-3">
                                        <pre className="bg-gray-900 rounded-lg p-4 overflow-x-auto border border-gray-700">
                                          <code className="text-gray-300 text-sm" {...props}>{children}</code>
                                          <span className="inline-block w-2 h-4 bg-purple-400 ml-0.5" style={{ animation: 'blink 1s infinite' }} />
                                        </pre>
                                        <div className="absolute top-2 right-2 flex items-center gap-2">
                                          <Code2 className="w-3 h-3 text-green-400" />
                                          <span className="text-xs text-green-400">Writing code...</span>
                                        </div>
                                      </div>
                                    );
                                  },
                                  p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
                                  ul: ({ children }) => <ul className="list-disc pl-4 mb-2 space-y-1">{children}</ul>,
                                  ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 space-y-1">{children}</ol>,
                                  li: ({ children }) => <li className="mb-0.5">{children}</li>,
                                  h1: ({ children }) => <h1 className="text-xl font-bold mb-3 mt-4 text-white">{children}</h1>,
                                  h2: ({ children }) => <h2 className="text-lg font-bold mb-2 mt-3 text-white">{children}</h2>,
                                  h3: ({ children }) => <h3 className="text-base font-bold mb-2 mt-3 text-white">{children}</h3>,
                                  blockquote: ({ children }) => <blockquote className="border-l-4 border-purple-500 pl-4 py-1 my-2 bg-gray-800/50 rounded-r italic">{children}</blockquote>
                                }}
                              >
                                {cleanMessageContent(streamingContent)}
                              </ReactMarkdown>
                              {/* Blinking cursor at end */}
                              <span className="inline-block w-2 h-4 bg-purple-400" style={{ animation: 'blink 1s infinite' }} />
                            </div>
                          ) : (
                            <div className="flex items-center gap-3 py-2">
                              <Loader2 className="w-5 h-5 text-purple-400 animate-spin" />
                              <span className="text-gray-400">Initializing response...</span>
                            </div>
                          )}

                          {/* Progress Indicator */}
                          <div className="mt-4 pt-3 border-t border-gray-700">
                            <div className="flex items-center justify-between text-xs text-gray-500">
                              <span>{streamingContent.length} characters</span>
                              <span className="flex items-center gap-1">
                                <Zap className="w-3 h-3 text-yellow-400" />
                                Gemini 2.0 Flash
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Tool Calls */}
                    {toolCalls.length > 0 && (
                      <div className="space-y-2 mb-4">
                        {toolCalls.filter(tc => tc.name !== 'task').map(tc => (
                          <ToolCallBox key={tc.id} toolCall={tc} />
                        ))}
                      </div>
                    )}

                    {/* SubAgents */}
                    {subAgents.length > 0 && (
                      <div className="flex flex-col gap-4 mb-4">
                        {subAgents.map(subAgent => (
                          <div key={subAgent.id} className="flex flex-col gap-2">
                            <SubAgentIndicator
                              subAgent={subAgent}
                              onClick={() => toggleSubAgent(subAgent.id)}
                              isExpanded={isSubAgentExpanded(subAgent.id)}
                            />
                            <SubAgentContent
                              subAgent={subAgent}
                              isExpanded={isSubAgentExpanded(subAgent.id)}
                            />
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Active Tasks Progress */}
                    {activeTasks.length > 0 && (
                      <div className="space-y-2 mb-4">
                        {activeTasks.map(task => (
                          <div
                            key={task.id}
                            className={`rounded-lg border ${task.status === 'completed'
                              ? 'bg-green-500/10 border-green-500/30'
                              : task.status === 'error'
                                ? 'bg-red-500/10 border-red-500/30'
                                : 'bg-purple-500/10 border-purple-500/30'
                              }`}
                          >
                            <button
                              onClick={() => {
                                setExpandedTasks(prev => {
                                  const next = new Set(prev);
                                  if (next.has(task.id)) next.delete(task.id);
                                  else next.add(task.id);
                                  return next;
                                });
                              }}
                              className="w-full flex items-center justify-between p-3 text-left"
                            >
                              <div className="flex items-center gap-2">
                                {task.status === 'completed' ? (
                                  <CheckCircle2 className="w-4 h-4 text-green-400" />
                                ) : task.status === 'error' ? (
                                  <AlertCircle className="w-4 h-4 text-red-400" />
                                ) : (
                                  <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />
                                )}
                                <span className={`text-sm font-medium ${task.status === 'completed' ? 'text-green-400' :
                                  task.status === 'error' ? 'text-red-400' : 'text-purple-400'
                                  }`}>
                                  {task.title}
                                </span>
                                <span className="text-xs text-gray-500">
                                  ({task.steps.filter(s => s.status === 'completed').length}/{task.steps.length} steps)
                                </span>
                              </div>
                              {expandedTasks.has(task.id) ? (
                                <ChevronUp className="w-4 h-4 text-gray-400" />
                              ) : (
                                <ChevronDown className="w-4 h-4 text-gray-400" />
                              )}
                            </button>

                            {task.status === 'in-progress' && task.steps.length > 0 && (
                              <div className="px-3 pb-2">
                                <div className="h-1 bg-gray-700 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-purple-500 transition-all duration-300"
                                    style={{
                                      width: `${(task.steps.filter(s => s.status === 'completed').length / task.steps.length) * 100}%`
                                    }}
                                  />
                                </div>
                              </div>
                            )}

                            {expandedTasks.has(task.id) && task.steps.length > 0 && (
                              <div className="px-3 pb-3 space-y-1">
                                {task.steps.map((step, idx) => (
                                  <div
                                    key={step.id || idx}
                                    className={`flex items-center gap-2 text-xs p-2 rounded ${step.status === 'completed'
                                      ? 'bg-gray-800/50 text-gray-400'
                                      : 'bg-gray-800 text-gray-200'
                                      }`}
                                  >
                                    {step.status === 'completed' ? (
                                      <CheckCircle2 className="w-3 h-3 text-green-400 flex-shrink-0" />
                                    ) : step.status === 'error' ? (
                                      <AlertCircle className="w-3 h-3 text-red-400 flex-shrink-0" />
                                    ) : (
                                      <Loader2 className="w-3 h-3 text-blue-400 animate-spin flex-shrink-0" />
                                    )}
                                    {step.type === 'tool' && <Wrench className="w-3 h-3 text-yellow-400 flex-shrink-0" />}
                                    {step.type === 'search' && <Globe className="w-3 h-3 text-blue-400 flex-shrink-0" />}
                                    {step.type === 'file' && <FileText className="w-3 h-3 text-purple-400 flex-shrink-0" />}
                                    {step.type === 'thinking' && <Brain className="w-3 h-3 text-purple-400 flex-shrink-0" />}
                                    <span className="truncate">{step.title}</span>
                                    {step.endTime && step.startTime && (
                                      <span className="text-gray-500 ml-auto">
                                        {((step.endTime - step.startTime) / 1000).toFixed(1)}s
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Loading Indicator */}
                    {isLoading && !streamingContent && activeTasks.length === 0 && (
                      <div className="flex justify-start mb-4">
                        <div className="bg-gray-800 rounded-lg p-3">
                          <div className="flex items-center gap-2">
                            <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />
                            <span className="text-sm text-gray-400">Processing...</span>
                          </div>
                        </div>
                      </div>
                    )}

                    <div ref={messagesEndRef} />
                  </div>
                </div>

                {/* Final Document Panel - Always visible when available */}
                {finalDocument && (
                  <div className={`flex-shrink-0 border-t border-gray-700 transition-all duration-300 ${showFinalDocument ? 'max-h-[60vh]' : 'max-h-14'}`}>
                    <div
                      className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-green-900/50 to-emerald-900/50 cursor-pointer hover:from-green-900/70 hover:to-emerald-900/70 transition-colors"
                      onClick={() => setShowFinalDocument(!showFinalDocument)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <FileText className="w-6 h-6 text-green-400" />
                          <CheckCircle2 className="absolute -bottom-1 -right-1 w-4 h-4 text-green-400 bg-gray-800 rounded-full" />
                        </div>
                        <div>
                          <span className="font-medium text-green-300">📄 Final Document Ready</span>
                          <p className="text-xs text-gray-400">{finalDocument.title}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400 bg-gray-800 px-2 py-1 rounded">
                          {finalDocument.content.length} chars
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigator.clipboard.writeText(finalDocument.content);
                          }}
                          className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                          title="Copy to clipboard"
                        >
                          <Copy className="w-4 h-4 text-gray-400 hover:text-white" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const blob = new Blob([finalDocument.content], { type: 'text/markdown' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `${finalDocument.title.replace(/[^a-zA-Z0-9]/g, '_')}.md`;
                            a.click();
                            URL.revokeObjectURL(url);
                          }}
                          className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                          title="Download as Markdown"
                        >
                          <Download className="w-4 h-4 text-gray-400 hover:text-white" />
                        </button>
                        <button className="p-2 hover:bg-gray-700 rounded-lg transition-colors">
                          {showFinalDocument ? (
                            <ChevronDown className="w-4 h-4 text-gray-400" />
                          ) : (
                            <ChevronUp className="w-4 h-4 text-gray-400" />
                          )}
                        </button>
                      </div>
                    </div>
                    {showFinalDocument && (
                      <div className="overflow-y-auto p-6 bg-gray-850/50 max-h-[calc(60vh-56px)]">
                        {/* Document Sections if available */}
                        {finalDocument.sections && finalDocument.sections.length > 0 && (
                          <div className="mb-4 pb-4 border-b border-gray-700">
                            <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">Table of Contents</h4>
                            <div className="flex flex-wrap gap-2">
                              {finalDocument.sections.map((section, idx) => (
                                <span key={idx} className="text-xs px-2 py-1 bg-gray-800 text-gray-400 rounded hover:bg-gray-700 cursor-pointer">
                                  {section.title}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        <div className="prose prose-invert prose-lg max-w-none">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm, remarkMath]}
                            rehypePlugins={[rehypeKatex]}
                            components={{
                              h1: ({ children }) => <h1 className="text-2xl font-bold text-white mb-4 pb-2 border-b border-gray-700">{children}</h1>,
                              h2: ({ children }) => <h2 className="text-xl font-semibold text-gray-200 mt-6 mb-3">{children}</h2>,
                              h3: ({ children }) => <h3 className="text-lg font-medium text-gray-300 mt-4 mb-2">{children}</h3>,
                              p: ({ children }) => <p className="text-gray-300 leading-relaxed mb-3">{children}</p>,
                              ul: ({ children }) => <ul className="list-disc list-inside space-y-1 text-gray-300 mb-3">{children}</ul>,
                              ol: ({ children }) => <ol className="list-decimal list-inside space-y-1 text-gray-300 mb-3">{children}</ol>,
                              code: ({ node, inline, children, ...props }: any) => (
                                inline
                                  ? <code className="bg-gray-700 px-1.5 py-0.5 rounded text-purple-300 text-sm" {...props}>{children}</code>
                                  : <pre className="bg-gray-900 rounded-lg p-4 overflow-x-auto border border-gray-700 my-3"><code className="text-sm text-gray-300" {...props}>{children}</code></pre>
                              ),
                              blockquote: ({ children }) => <blockquote className="border-l-4 border-purple-500 pl-4 italic text-gray-400 my-4">{children}</blockquote>,
                            }}
                          >
                            {finalDocument.content}
                          </ReactMarkdown>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Input Area with Inline Tasks/Files */}
                <div className="flex-shrink-0 bg-gray-900">
                  <div className="mx-auto w-full max-w-4xl px-4 pb-6">
                    <div className="flex flex-col overflow-hidden rounded-xl border border-gray-700 bg-gray-800">
                      {/* Inline Tasks/Files Panel */}
                      {(hasTasks || hasFiles) && (
                        <TasksFilesPanel
                          todos={currentTodos}
                          files={currentFiles}
                          onFileUpdate={(files) => setCurrentFiles(files)}
                          isLoading={isLoading}
                          position="inline"
                        />
                      )}

                      {/* Uploaded Files Preview */}
                      {uploadedFiles.length > 0 && (
                        <div className="px-3 py-2 border-b border-gray-700 bg-gray-850/50">
                          <div className="flex items-center gap-1 mb-2">
                            <Paperclip className="w-3 h-3 text-gray-400" />
                            <span className="text-xs text-gray-400">Attached files ({uploadedFiles.length})</span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {uploadedFiles.map((file, idx) => (
                              <div
                                key={`${file.name}-${idx}`}
                                className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs ${file.error
                                  ? 'bg-red-900/30 border border-red-700/50'
                                  : file.isProcessing
                                    ? 'bg-blue-900/30 border border-blue-700/50'
                                    : 'bg-gray-700/50 border border-gray-600'
                                  }`}
                              >
                                {file.isProcessing ? (
                                  <Loader2 className="w-3 h-3 text-blue-400 animate-spin" />
                                ) : (
                                  getFileIcon(file.type)
                                )}
                                <span className={`max-w-[120px] truncate ${file.error ? 'text-red-300' : 'text-gray-300'}`}>
                                  {file.name}
                                </span>
                                <span className="text-gray-500">{formatFileSize(file.size)}</span>
                                {file.content && (
                                  <CheckCircle2 className="w-3 h-3 text-green-400" />
                                )}
                                <button
                                  type="button"
                                  onClick={() => removeUploadedFile(file.name, file.size)}
                                  className="p-0.5 hover:bg-gray-600 rounded text-gray-400 hover:text-white"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Input */}
                      <form onSubmit={(e) => { e.preventDefault(); uploadedFiles.length > 0 ? handleSendWithFiles() : handleSubmit(); }} className="flex flex-col">
                        <textarea
                          ref={inputRef}
                          value={inputMessage}
                          onChange={(e) => setInputMessage(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              uploadedFiles.length > 0 ? handleSendWithFiles() : handleSubmit();
                            }
                          }}
                          placeholder={isLoading ? "Running..." : uploadedFiles.length > 0 ? "Add a message about these files (optional)..." : "Write your message or attach files..."}
                          className="flex-1 resize-none border-0 bg-transparent px-4 py-3 text-sm leading-7 text-white outline-none placeholder:text-gray-500"
                          rows={1}
                          disabled={isLoading || isInitializing}
                          style={{ minHeight: '48px', maxHeight: '120px' }}
                        />
                        <div className="flex justify-between gap-2 p-3 border-t border-gray-700">
                          <div className="flex items-center gap-3">
                            {/* File Upload Button */}
                            <input
                              ref={fileInputRef}
                              type="file"
                              multiple
                              accept=".pdf,.txt,.md,.json,.csv,.tex,.doc,.docx,.png,.jpg,.jpeg,.gif,.webp"
                              onChange={handleFileUpload}
                              className="hidden"
                            />
                            <button
                              type="button"
                              onClick={() => fileInputRef.current?.click()}
                              disabled={isLoading || isProcessingUpload}
                              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-gray-400 hover:text-white hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Upload documents (PDF, TXT, images, etc.)"
                            >
                              {isProcessingUpload ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Paperclip className="w-4 h-4" />
                              )}
                              <span>Attach</span>
                            </button>

                            {/* Status indicators */}
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                              {hasTasks && (
                                <span className="flex items-center gap-1">
                                  <ListTodo className="w-3 h-3" />
                                  {groupedTodos.completed.length}/{currentTodos.length}
                                </span>
                              )}
                              {hasFiles && (
                                <span className="flex items-center gap-1">
                                  <FolderOpen className="w-3 h-3" />
                                  {Object.keys(currentFiles).length}
                                </span>
                              )}
                            </div>
                          </div>
                          <button
                            type={isLoading ? 'button' : 'submit'}
                            onClick={isLoading ? stopStream : undefined}
                            disabled={!isLoading && (!inputMessage.trim() && uploadedFiles.length === 0) || isInitializing || isProcessingUpload}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${isLoading
                              ? 'bg-red-500 hover:bg-red-600 text-white'
                              : (!inputMessage.trim() && uploadedFiles.length === 0) || isInitializing || isProcessingUpload
                                ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                                : 'bg-purple-500 hover:bg-purple-600 text-white'
                              }`}
                          >
                            {isLoading ? (
                              <>
                                <Square className="w-4 h-4" />
                                <span>Stop</span>
                              </>
                            ) : (
                              <>
                                <ArrowUp className="w-4 h-4" />
                                <span>{uploadedFiles.length > 0 ? 'Send with Files' : 'Send'}</span>
                              </>
                            )}
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Artifacts Tab */}
        {activeTab === 'artifacts' && (
          <div className="flex-1 flex overflow-hidden">
            {/* Artifacts List */}
            <div className="w-1/3 border-r border-gray-700 overflow-y-auto">
              <div className="p-3 border-b border-gray-700 bg-gray-800/50">
                <h3 className="text-sm font-medium text-gray-300 flex items-center gap-2">
                  <FolderOpen className="w-4 h-4" />
                  All Artifacts ({artifactsList.length})
                </h3>
              </div>
              {artifactsList.length === 0 ? (
                <div className="p-4 text-center text-gray-500">
                  <FilePlus className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No artifacts yet</p>
                  <p className="text-xs mt-1">Artifacts will appear as agents work</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-700">
                  {artifactsList.map(artifact => (
                    <div
                      key={artifact.id}
                      onClick={() => setSelectedArtifact(artifact)}
                      className={`p-3 cursor-pointer hover:bg-gray-800 transition-colors ${selectedArtifact?.id === artifact.id ? 'bg-gray-800 border-l-2 border-purple-500' : ''
                        }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {getArtifactIcon(artifact.type)}
                          <span className="text-sm font-medium text-gray-200 truncate">
                            {artifact.title}
                          </span>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteArtifact(artifact.id);
                          }}
                          className="p-1 text-gray-500 hover:text-red-400 hover:bg-gray-700 rounded"
                          title="Delete"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
                        <span className="capitalize">{artifact.type}</span>
                        <span>•</span>
                        <span>{artifact.agentName}</span>
                      </div>
                      <div className="text-xs text-gray-600 mt-1">
                        {new Date(artifact.createdAt).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Artifact Content */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {selectedArtifact ? (
                <>
                  <div className="p-3 border-b border-gray-700 bg-gray-800/50 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getArtifactIcon(selectedArtifact.type)}
                      <div>
                        <h3 className="text-sm font-medium text-gray-200">{selectedArtifact.title}</h3>
                        <p className="text-xs text-gray-500">
                          by {selectedArtifact.agentName} • {new Date(selectedArtifact.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => navigator.clipboard.writeText(selectedArtifact.content)}
                        className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded"
                        title="Copy"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          const blob = new Blob([selectedArtifact.content], { type: 'text/markdown' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `${selectedArtifact.title.replace(/[^a-zA-Z0-9]/g, '_')}.md`;
                          a.click();
                          URL.revokeObjectURL(url);
                        }}
                        className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded"
                        title="Download"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4">
                    <div className="prose prose-invert prose-sm max-w-none">
                      <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                        {selectedArtifact.content}
                      </ReactMarkdown>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-gray-500">
                  <div className="text-center">
                    <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>Select an artifact to view</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DeepAgentChat;
