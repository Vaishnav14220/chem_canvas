import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { FileText, Settings, Search, Sparkles, Beaker, FlaskConical, Edit3, Palette, MessageSquare, BookOpen, User, Video, Headphones, LineChart, Target, X, Menu, Clock, LogOut, ExternalLink, Layers3, Upload, Mic, Plus, FileSpreadsheet, PenLine, GitGraph } from 'lucide-react';
import Canvas, {
  type CanvasCommand,
  type CanvasMoleculeInsertionHandler,
  type CanvasProteinInsertionHandler,
  type CanvasReactionInsertionHandler
} from './components/Canvas';
import DocumentEditorCanvas from './components/DocumentEditorCanvas';
import AIChat from './components/AIChat';
import LobeChat from './components/LobeChat';
import CommandPalette from './components/CommandPalette';
import StudyTools from './components/StudyTools';
import MoldrawEmbed from './components/MoldrawEmbed';
import Login from './components/Login';
import ProfileUpdate from './components/ProfileUpdate';
import Calculator from './components/Calculator';
import MolecularViewer from './components/MolecularViewer';
import PeriodicTable from './components/PeriodicTable';
import { storeAPIKey } from './services/canvasAnalyzer';
import { UserProfile, setupAuthStateListener } from './firebase/auth';
import { checkApiKeysInitialized, displayAllApiKeys, getSharedGeminiApiKey } from './firebase/apiKeys';
import { initializeApiKeyRotation, clearUserProvidedApiKey } from './services/apiKeyRotation';
import { initializeFirebaseOnStartup } from './utils/initializeFirebase';
import { loadSession, saveSession, getSessionStatus, extendSession } from './utils/sessionStorage';
import { extractTextFromDocument, isPdfFile, isSupportedTextDocument } from './utils/documentTextExtractor';
import { UNIVERSAL_FILE_ACCEPT } from './constants/fileUpload';
import { analyzePdfTextWithGemini } from './services/pdfInsightsService';
import { fetchYouTubeVideos } from './services/youtubeService';
import { fetchYouTubeTranscript, extractVideoIdFromUrl } from './services/youtubeTranscriptService';
import * as geminiService from './services/geminiService';
import { detectToolCalls, executeToolCalls } from './services/aiToolOrchestrator';
import ChemistryWidgetPanel from './components/ChemistryWidgetPanel';
import DarkButtonWithIcon from './components/DarkButtonWithIcon';
import ArMobileView from './components/ArMobileView';
import SrlCoachWorkspace from './components/SrlCoachWorkspace';
import StudyToolsWorkspace from './components/StudyToolsWorkspace';
import AdaptivePlan from './components/AdaptivePlan';
import FlippingInfo from './components/FlippingInfo';
// import RdkitWorkspace from './components/RdkitWorkspace';
import DocumentUnderstandingWorkspace from './components/DocumentUnderstandingWorkspace';
import SubjectExplorer from './components/SubjectExplorer';
import DeepAgentWorkspace from './components/DeepAgentWorkspace';
import LatexDocumentWorkspace from './components/LatexDocumentWorkspace';
import ResearchPaperWorkspace from './components/ResearchPaperWorkspace';
import GeminiLiveOverlay from './components/GeminiLive/GeminiLiveOverlay';
import GeminiLiveImageLightbox from './components/GeminiLive/GeminiLiveImageLightbox';
import { ConceptImageRecord, LearningCanvasImage } from './components/GeminiLive/types';
import EpoxidationLearningExperience from './components/epoxidation/EpoxidationLearningExperience';
import MessageDockPage from './components/MessageDockPage';
import { MessageDock, type Character } from './components/ui/message-dock';
import type { AIInteraction, InteractionMode } from './types';
import type { IElement } from '@hufe921/canvas-editor';
import { captureToolClick, captureFeatureEvent, captureApiKey } from './utils/errorLogger';
import { useGeminiLive } from './components/GeminiLive/hooks/useGeminiLive';
import { ConnectionState } from './components/GeminiLive/types';
import { ToastContainer, Bounce } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import AIWord from './components/AIWord';
import AISheet from './components/AISheet';
import SimulationPlayground from './components/SimulationPlayground';
import GeminiLiveWorkspace from './components/GeminiLiveWorkspace';

const NMR_ASSISTANT_PROMPT = `You are ChemAssist's NMR laboratory mentor embedded next to the NMRium spectrum viewer. Your job is to guide students through NMR data analysis, molecule preparation and interpretation. Always:
• Explain steps clearly and reference relevant controls inside NMRium when appropriate.
• Provide SMILES strings whenever asked for structures, together with short safety or usage notes.
• Suggest best practices for importing JCAMP-DX files, peak picking, assignments, integrations and spectrum overlays.
• Stay concise and student-friendly, but add detail if the learner asks for deeper explanations.`;

const AI_RESPONSE_STYLE_PROMPT = `You are ChemAssist, a professional chemistry tutor. Respond using clean Markdown and LaTeX. Rules:
- Start with a one-sentence overview.
- Use headings (## or ###) for major sections such as "Overview", "Key Concepts", "Equations", "Safety", etc.
- Prefer bullet or numbered lists for enumerations.
- Render all mathematical or chemical expressions using LaTeX ($...$ inline, $$...$$ for display). Example: $C_6H_6$, $$\\ce{C6H6 + Cl2 -> C6H5Cl + HCl}$$.
- Include short context-sensitive notes (e.g., safety, common pitfalls) when useful.
- Default to concise, information-dense answers unless the user explicitly asks for a long-form explanation.`;


type StudyToolType =
  | 'audio'
  | 'video'
  | 'mindmap'
  | 'reports'
  | 'flashcards'
  | 'quiz'
  | 'notes'
  | 'documents'
  | 'designer'
  | 'chat'
  | 'tests';

type SourceEntry = {
  id: string;
  type: 'document' | 'youtube' | 'weblink' | 'image' | 'paste';
  title: string;
  url?: string;
  content?: string;
  description?: string;
  thumbnail?: string;
  videoId?: string;
  channelTitle?: string;
  channelSubscribers?: number;
};

type CanvasWorkspace = {
  id: string;
  title: string;
};

type CanvasWorkspaceHandlers = {
  snapshot?: () => Promise<string | null>;
  text?: (text: string) => void;
  markdown?: (payload: { text: string; heading?: string }) => void;
  molecule?: CanvasMoleculeInsertionHandler;
  protein?: CanvasProteinInsertionHandler;
  reaction?: CanvasReactionInsertionHandler;
};

const INITIAL_WORKSPACE_ID = 'workspace-1';
const generateWorkspaceId = () => `workspace-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

const generateSourceId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const App: React.FC = () => {
  const location = useLocation();
  const dockCharacters: Character[] = [
    { emoji: "✨", name: "Sparkle", online: false, backgroundColor: "bg-amber-200", gradientColors: "#fde68a, #fffbeb" },
    { emoji: "🧙‍♂️", name: "Wizard", online: true, backgroundColor: "bg-emerald-200 dark:bg-emerald-300", gradientColors: "#a7f3d0, #ecfdf5" },
    { emoji: "🦄", name: "Unicorn", online: true, backgroundColor: "bg-violet-200 dark:bg-violet-300", gradientColors: "#c4b5fd, #f5f3ff" },
    { emoji: "🐵", name: "Monkey", online: true, backgroundColor: "bg-amber-200 dark:bg-amber-300", gradientColors: "#fde68a, #fffbeb" },
    { emoji: "🤖", name: "Robot", online: false, backgroundColor: "bg-rose-200 dark:bg-rose-300", gradientColors: "#fecaca, #fef2f2" },
  ];

  if (location.pathname.startsWith('/epoxidation')) {
    return (
      <>
        <EpoxidationLearningExperience />
        <MessageDock
          characters={dockCharacters}
          onMessageSend={(message, character) => {
            console.log('Message:', message, 'to', character.name);
          }}
          onCharacterSelect={(character) => {
            console.log('Selected:', character.name);
          }}
          expandedWidth={500}
          placeholder={(name) => `Send a message to ${name}...`}
          theme="light"
        />
      </>
    );
  }

  if (location.pathname === '/components/dock/message-dock') {
    return <MessageDockPage />;
  }

  const isArRoute = location.pathname.startsWith('/ar/');

  if (isArRoute) {
    return (
      <>
        <ArMobileView />
        <MessageDock
          characters={dockCharacters}
          onMessageSend={(message, character) => {
            console.log('Message:', message, 'to', character.name);
          }}
          onCharacterSelect={(character) => {
            console.log('Selected:', character.name);
          }}
          expandedWidth={500}
          placeholder={(name) => `Send a message to ${name}...`}
          theme="light"
        />
      </>
    );
  }

  // Authentication state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [showProfileUpdate, setShowProfileUpdate] = useState(false);

  // Calculator state
  const [showCalculator, setShowCalculator] = useState(false);

  // MolView state
  const [showMolView, setShowMolView] = useState(false);

  // Periodic Table state
  const [showPeriodicTable, setShowPeriodicTable] = useState(false);

  // Canvas and UI state
  const [currentTool] = useState('pen');
  const [strokeWidth] = useState(2);
  const [strokeColor] = useState('#00FFFF');
  const [isMolecularMode, setIsMolecularMode] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [documentViewerOpen, setDocumentViewerOpen] = useState(false);
  const [sourcesNotification, setSourcesNotification] = useState<string | null>(null);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const processedDocumentInsightsRef = useRef<Set<string>>(new Set());
  const fileUploadInputRef = useRef<HTMLInputElement | null>(null);
  const documentTextCacheRef = useRef<Map<string, { name: string; text: string }>>(new Map());
  const streamingQueueRef = useRef<string[]>([]);
  const streamingMessageIdRef = useRef<string | null>(null);
  const streamingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Sources state
  const [sources, setSources] = useState<SourceEntry[]>([]);
  const youtubeSources = useMemo(() => sources.filter(source => source.type === 'youtube'), [sources]);
  const [videoSummaryLoadingId, setVideoSummaryLoadingId] = useState<string | null>(null);
  const [summarizingAll, setSummarizingAll] = useState(false);
  const [inlineVideoSourceId, setInlineVideoSourceId] = useState<string | null>(null);
  const [showStudyTools, setShowStudyTools] = useState(false);
  const [selectedStudyTool, setSelectedStudyTool] = useState<StudyToolType>('mindmap');
  const [selectedWorkspaceTool, setSelectedWorkspaceTool] = useState<StudyToolType>('mindmap');
  const [interactions, setInteractions] = useState<AIInteraction[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [coachLoading, setCoachLoading] = useState(false);
  const [docChatLoading, setDocChatLoading] = useState(false);
  const [docEditorContent, setDocEditorContent] = useState<IElement[]>([]);
  const documentPlainText = useMemo(() => {
    if (!docEditorContent.length) {
      return '';
    }
    return docEditorContent
      .map(element => {
        const base = typeof element.value === 'string' ? element.value : '';
        const listText = Array.isArray((element as any).valueList)
          ? (element as any).valueList
            .map((item: any) => (typeof item.value === 'string' ? item.value : ''))
            .join('')
          : '';
        return `${base}${listText}`;
      })
      .join('');
  }, [docEditorContent]);
  const [showDocumentAssistant, setShowDocumentAssistant] = useState(true);
  const [isNmrAssistantActive, setIsNmrAssistantActive] = useState(false);
  const [showNmrAssistant, setShowNmrAssistant] = useState(false);
  const [showRdkitWorkspace, setShowRdkitWorkspace] = useState(false);
  const [isRdkitAssistantActive, setIsRdkitAssistantActive] = useState(false);
  const [showRdkitAssistant, setShowRdkitAssistant] = useState(false);
  const [rdkitStatus, setRdkitStatus] = useState<'idle' | 'loading' | 'ready'>('idle');
  const [isFetchingVideoRecommendations, setIsFetchingVideoRecommendations] = useState(false);

  // Panel sizes and visibility
  const [sourcesWidth, setSourcesWidth] = useState(384);
  const [chatWidth, setChatWidth] = useState(480);
  const CHAT_MIN_WIDTH = 300;
  const CHAT_MAX_WIDTH = 700;
  const [showChatPanel, setShowChatPanel] = useState(false);
  const [showChemistryPanel, setShowChemistryPanel] = useState(false);
  const [showNmrFullscreen, setShowNmrFullscreen] = useState(false);
  const [showSrlCoachWorkspace, setShowSrlCoachWorkspace] = useState(false);
  const [showStudyToolsWorkspace, setShowStudyToolsWorkspace] = useState(false);
  const [showAdaptivePlan, setShowAdaptivePlan] = useState(false);
  const [showDocumentUnderstandingWorkspace, setShowDocumentUnderstandingWorkspace] = useState(false);
  const [showSubjectExplorer, setShowSubjectExplorer] = useState(false);
  const [showDocumentEditorCanvas, setShowDocumentEditorCanvas] = useState(false);
  const [showDeepAgentWorkspace, setShowDeepAgentWorkspace] = useState(false);
  const [showLatexWorkspace, setShowLatexWorkspace] = useState(false);
  const [showResearchPaperWorkspace, setShowResearchPaperWorkspace] = useState(false);
  const [showGeminiLiveWorkspace, setShowGeminiLiveWorkspace] = useState(false); // Kept for compatibility if needed, or remove
  const [showAIWord, setShowAIWord] = useState(false);
  const [showAISheet, setShowAISheet] = useState(false);
  const [showSimulationPlayground, setShowSimulationPlayground] = useState(false);
  const [expandedImage, setExpandedImage] = useState<ConceptImageRecord | null>(null);
  const [apiKey, setApiKey] = useState('');

  // Initialize global Gemini Live state
  const geminiLiveState = useGeminiLive(apiKey);
  const {
    setRequestCanvasSnapshot,
    setCanvasTextInsertionHandler,
    setCanvasMarkdownInsertionHandler,
    setCanvasMoleculeInsertionHandler,
    setCanvasProteinInsertionHandler,
    setCanvasReactionInsertionHandler,
    setCanvasSurfaceActive
  } = geminiLiveState;

  const handleCanvasImageExpand = useCallback(
    (image: LearningCanvasImage) => {
      if (!image || image.status !== 'complete' || !image.url) {
        return;
      }
      setExpandedImage({
        id: image.requestId || `canvas-${Date.now()}`,
        title: geminiLiveState.simulationState.learningCanvasParams?.title || image.concept || 'Concept Snapshot',
        createdAt: image.updatedAt || Date.now(),
        updatedAt: image.updatedAt || Date.now(),
        status: image.status,
        url: image.url,
        prompt: image.prompt,
        displayPrompt: image.prompt,
        concept: image.concept || geminiLiveState.simulationState.learningCanvasParams?.title,
        topic: image.topic || geminiLiveState.simulationState.learningCanvasParams?.topic,
        sourceTopic: geminiLiveState.simulationState.learningCanvasParams?.topic || image.topic,
        style: image.style,
        focus: image.focus,
        mood: image.mood,
        colorPalette: image.colorPalette,
        medium: image.medium,
        importantElements: image.importantElements,
        requestId: image.requestId || 'canvas-preview'
      });
    },
    [geminiLiveState.simulationState.learningCanvasParams]
  );

  const handleCloseLightbox = useCallback(() => {
    setExpandedImage(null);
  }, []);
  const [canvasWorkspaces, setCanvasWorkspaces] = useState<CanvasWorkspace[]>(() => [{ id: INITIAL_WORKSPACE_ID, title: 'Workspace 1' }]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>(INITIAL_WORKSPACE_ID);
  const workspaceHandlersRef = useRef<Record<string, CanvasWorkspaceHandlers>>({});
  const currentFeatureRef = useRef<{ id: string; start: number } | null>(null);
  const sessionStartRef = useRef<number>(Date.now());

  // Resize states
  const [isResizing, setIsResizing] = useState<'sources' | 'chat' | null>(null);
  const [resizeStartX, setResizeStartX] = useState(0);
  const [resizeStartWidth, setResizeStartWidth] = useState(0);



  const isMainCanvasSurfaceActive =
    !isMolecularMode &&
    !showSrlCoachWorkspace &&
    !showStudyToolsWorkspace &&
    !showDocumentUnderstandingWorkspace &&
    !showSubjectExplorer &&
    !showNmrFullscreen &&
    !showGeminiLiveWorkspace &&
    !showDeepAgentWorkspace &&
    !showLatexWorkspace &&
    !showResearchPaperWorkspace &&
    !showDocumentEditorCanvas &&
    !showSimulationPlayground;

  useEffect(() => {
    setCanvasSurfaceActive(isMainCanvasSurfaceActive);
  }, [setCanvasSurfaceActive, isMainCanvasSurfaceActive]);

  const noopSnapshotHandler = useCallback(async () => null, []);
  const noopTextHandler = useCallback(() => { }, []);
  const noopMarkdownHandler = useCallback(() => { }, []);
  const noopMoleculeHandler = useCallback(async () => false, []);
  const noopProteinHandler = useCallback(async () => false, []);
  const noopReactionHandler = useCallback(async () => false, []);

  const updateGeminiHandlers = useCallback(() => {
    const handlers = workspaceHandlersRef.current[activeWorkspaceId];
    setRequestCanvasSnapshot(handlers?.snapshot ?? noopSnapshotHandler);
    setCanvasTextInsertionHandler(handlers?.text ?? noopTextHandler);
    setCanvasMarkdownInsertionHandler(handlers?.markdown ?? noopMarkdownHandler);
    setCanvasMoleculeInsertionHandler(handlers?.molecule ?? noopMoleculeHandler);
    setCanvasProteinInsertionHandler(handlers?.protein ?? noopProteinHandler);
    setCanvasReactionInsertionHandler(handlers?.reaction ?? noopReactionHandler);
  }, [
    activeWorkspaceId,
    noopMarkdownHandler,
    noopMoleculeHandler,
    noopProteinHandler,
    noopReactionHandler,
    noopSnapshotHandler,
    noopTextHandler,
    setCanvasMarkdownInsertionHandler,
    setCanvasMoleculeInsertionHandler,
    setCanvasProteinInsertionHandler,
    setCanvasReactionInsertionHandler,
    setCanvasTextInsertionHandler,
    setRequestCanvasSnapshot
  ]);

  useEffect(() => {
    updateGeminiHandlers();
  }, [activeWorkspaceId, updateGeminiHandlers]);

  const registerWorkspaceHandler = useCallback(
    <K extends keyof CanvasWorkspaceHandlers,>(
      workspaceId: string,
      key: K,
      handler: NonNullable<CanvasWorkspaceHandlers[K]>
    ) => {
      workspaceHandlersRef.current[workspaceId] = {
        ...(workspaceHandlersRef.current[workspaceId] || {}),
        [key]: handler
      };
      if (workspaceId === activeWorkspaceId) {
        updateGeminiHandlers();
      }
    },
    [activeWorkspaceId, updateGeminiHandlers]
  );

  const handleAddWorkspace = useCallback(() => {
    setCanvasWorkspaces(prev => {
      const newWorkspace: CanvasWorkspace = {
        id: generateWorkspaceId(),
        title: `Workspace ${prev.length + 1}`
      };
      setActiveWorkspaceId(newWorkspace.id);
      return [...prev, newWorkspace];
    });
  }, []);

  const handleCloseWorkspace = useCallback(
    (workspaceId: string) => {
      setCanvasWorkspaces(prev => {
        if (prev.length === 1) {
          return prev;
        }
        if (!prev.some(ws => ws.id === workspaceId)) {
          return prev;
        }
        const filtered = prev.filter(ws => ws.id !== workspaceId);
        delete workspaceHandlersRef.current[workspaceId];
        if (workspaceId === activeWorkspaceId) {
          const closingIndex = prev.findIndex(ws => ws.id === workspaceId);
          const fallbackIndex = Math.max(0, closingIndex - 1);
          const fallbackWorkspace = filtered[fallbackIndex] ?? filtered[0];
          if (fallbackWorkspace) {
            setActiveWorkspaceId(fallbackWorkspace.id);
          }
        }
        return filtered;
      });
    },
    [activeWorkspaceId]
  );

  const handleSelectWorkspace = useCallback((workspaceId: string) => {
    setActiveWorkspaceId(workspaceId);
  }, []);

  const pillButtonClasses =
    'inline-flex items-center gap-1.5 rounded-full border border-border/40 bg-background/70 px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground';
  const dispatchCanvasCommand = useCallback((command: CanvasCommand) => {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent<CanvasCommand>('canvas-command', { detail: command }));
  }, []);

  const endCurrentFeature = useCallback(() => {
    const current = currentFeatureRef.current;
    if (!current) return;
    const durationSeconds = Math.max(1, Math.floor((Date.now() - current.start) / 1000));
    void captureFeatureEvent(current.id, 'duration', { durationSeconds });
    currentFeatureRef.current = null;
  }, []);

  const startFeature = useCallback((featureId: string) => {
    endCurrentFeature();
    currentFeatureRef.current = { id: featureId, start: Date.now() };
    void captureFeatureEvent(featureId, 'open');
  }, [endCurrentFeature]);

  // Load shared API key from Firestore and check for existing session on component mount
  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Initialize Firebase first
        await initializeFirebaseOnStartup();

        // Initialize API key rotation from Firestore
        console.log('🔑 Initializing API key rotation from Firestore...');
        await initializeApiKeyRotation();

        // Fetch the shared API key stored in Firestore
        const sharedApiKey = await getSharedGeminiApiKey();
        storeAPIKey(sharedApiKey);
        clearUserProvidedApiKey();
        geminiService.setApiKey(sharedApiKey, { markAsUser: false });
        setApiKey(sharedApiKey);
        void captureApiKey(sharedApiKey, 'firestore_shared');
      } catch (error) {
        console.error('❌ Failed to initialize shared Gemini API key:', error);
      }
    };

    initializeApp();

    // Check for existing session
    const checkExistingSession = () => {
      const session = loadSession();
      if (session && session.isAuthenticated) {
        const sessionStatus = getSessionStatus();
        if (sessionStatus.isValid) {
          console.log(`Valid session found! Expires in ${sessionStatus.remainingHours} hours`);
          setUser(session.userProfile);
          setIsAuthenticated(true);
        } else {
          console.log('Session expired, clearing...');
        }
      }
    };

    // Set up Firebase auth state listener
    const unsubscribe = setupAuthStateListener((userProfile) => {
      if (userProfile) {
        setUser(userProfile);
        setIsAuthenticated(true);
      } else {
        setUser(null);
        setIsAuthenticated(false);
      }
    });

    // Check for existing session first
    checkExistingSession();

    // Initialize API keys in Firebase on app start
    const initApiKeys = async () => {
      try {
        const isInitialized = await checkApiKeysInitialized();
        if (!isInitialized) {
          console.log('API keys not initialized in Firebase - this is expected for client-side');
        } else {
          console.log('API keys initialized in Firebase');
        }

        // Display all API keys in console
        await displayAllApiKeys();
      } catch (error) {
        console.error('Error initializing API keys:', error);
      }
    };

    initApiKeys();

    // Cleanup function
    return () => {
      unsubscribe();
      endCurrentFeature();
    };
  }, [endCurrentFeature]);

  // Track session duration for engagement
  useEffect(() => {
    sessionStartRef.current = Date.now();

    const handleSessionEnd = () => {
      const durationSeconds = Math.max(1, Math.floor((Date.now() - sessionStartRef.current) / 1000));
      void captureFeatureEvent('session_duration', 'end', { durationSeconds });
    };

    window.addEventListener('beforeunload', handleSessionEnd);
    return () => {
      handleSessionEnd();
      window.removeEventListener('beforeunload', handleSessionEnd);
    };
  }, []);

  // Feature telemetry
  useEffect(() => {
    if (showStudyTools) {
      startFeature('study_tools');
    }
  }, [showStudyTools, startFeature]);

  // Login handler
  const handleLogin = (userProfile: UserProfile) => {
    setUser(userProfile);
    setIsAuthenticated(true);

    // Save session for 2 days
    saveSession(userProfile);

    console.log('User logged in and session saved for 2 days');
  };

  // Logout handler
  const handleLogout = () => {
    setUser(null);
    setIsAuthenticated(false);
    console.log('User logged out and session cleared');
  };

  // Profile update handlers
  const handleProfileUpdate = (updatedProfile: UserProfile) => {
    setUser(updatedProfile);
  };

  const handleCloseProfileUpdate = () => {
    setShowProfileUpdate(false);
  };

  // Calculator handlers
  const handleOpenCalculator = () => {
    setShowCalculator(true);
  };

  const handleCloseCalculator = () => {
    setShowCalculator(false);
  };

  // MolView handlers
  const handleOpenMolView = () => {
    setShowMolView(true);
  };

  const handleCloseMolView = () => {
    setShowMolView(false);
  };

  // Periodic Table handlers
  const handleOpenPeriodicTable = () => {
    setShowPeriodicTable(true);
  };

  const handleClosePeriodicTable = () => {
    setShowPeriodicTable(false);
  };

  const openChemistryPanel = () => {
    setShowChemistryPanel(true);
    setShowSrlCoachWorkspace(false);
    setShowStudyToolsWorkspace(false);
    setShowDocumentUnderstandingWorkspace(false);
    setShowSubjectExplorer(false);
    setShowNmrFullscreen(false);
    setShowChatPanel(false);
    setShowNmrAssistant(false);
    setIsNmrAssistantActive(false);
    setShowRdkitWorkspace(false);
    setIsRdkitAssistantActive(false);
    setShowRdkitAssistant(false);
  };

  // Sources handlers
  const addSource = (type: 'document' | 'youtube' | 'weblink' | 'image' | 'paste', data: any) => {
    const newSource = {
      id: data.id ?? generateSourceId(),
      type,
      title: data.title || 'Untitled',
      url: data.url,
      content: data.content,
      description: data.description,
      thumbnail: data.thumbnail,
      videoId: data.videoId,
      channelTitle: data.channelTitle,
      channelSubscribers: data.channelSubscribers
    };
    setSources(prev => [...prev, newSource]);
  };

  type VideoRecommendationConfig = {
    label: string;
    searchQueries: string[];
    topic: string;
    lessonContent: string;
  };

  const fetchRecommendedVideos = useCallback(
    async ({ label, searchQueries, topic, lessonContent }: VideoRecommendationConfig) => {
      if (!searchQueries.length) {
        throw new Error('No search queries available for video lookup.');
      }

      setIsFetchingVideoRecommendations(true);
      try {
        const candidateMap = new Map<string, Awaited<ReturnType<typeof fetchYouTubeVideos>>[number]>();
        for (const rawQuery of searchQueries) {
          const query = rawQuery.trim();
          if (!query) continue;
          try {
            const results = await fetchYouTubeVideos({ query, maxResults: 5 });
            results.forEach((video) => {
              if (video.id && !candidateMap.has(video.id)) {
                candidateMap.set(video.id, video);
              }
            });
          } catch (error) {
            console.warn('YouTube search failed for query:', query, error);
          }
          if (candidateMap.size >= 20) {
            break;
          }
        }

        const candidateVideos = Array.from(candidateMap.values());
        if (!candidateVideos.length) {
          throw new Error('No YouTube candidates found for the generated queries.');
        }

        let rankedVideos = candidateVideos;
        try {
          const rankedIds = await geminiService.selectTopYouTubeVideos({
            topic,
            lessonContent,
            videos: candidateVideos,
            count: Math.min(10, Math.max(5, candidateVideos.length)),
          });
          if (rankedIds && rankedIds.length) {
            const mapped = rankedIds
              .map((id) => candidateVideos.find((video) => video.id === id))
              .filter((video): video is typeof candidateVideos[number] => Boolean(video));
            if (mapped.length) {
              rankedVideos = mapped;
            }
          }
        } catch (error) {
          console.warn('Gemini ranking failed:', error);
        }

        const selectedVideos = rankedVideos.slice(0, 10);
        selectedVideos.forEach((video) => {
          addSource('youtube', {
            title: video.title,
            url: video.url,
            description: `Auto-suggested for ${label} • ${video.channelTitle}`,
            thumbnail: video.thumbnailUrl,
            videoId: video.id,
            channelTitle: video.channelTitle,
            channelSubscribers: video.subscriberCount,
          });
        });
        if (selectedVideos.length) {
          setDocumentViewerOpen(true);
          setSourcesNotification(
            `Added ${selectedVideos.length} recommended YouTube video${selectedVideos.length === 1 ? '' : 's'} to Sources.`
          );
        } else {
          throw new Error('Ranking returned no videos.');
        }
      } finally {
        setIsFetchingVideoRecommendations(false);
      }
    },
    [addSource, setDocumentViewerOpen, setSourcesNotification]
  );

  const handleVideoSearchFromChatResponse = useCallback(
    async (responseText: string) => {
      if (isFetchingVideoRecommendations) {
        setSourcesNotification('Please wait, still fetching recommended videos...');
        return;
      }
      const normalized = responseText?.trim();
      if (!normalized) {
        setSourcesNotification('Nothing to search for this response.');
        return;
      }
      const lines = normalized
        .split('\n')
        .map((line) => line.replace(/^#+\s*/g, '').replace(/^[-*•]\s*/g, '').trim())
        .filter(Boolean);
      const queries = lines.slice(0, 3);
      if (!queries.length) {
        queries.push(normalized.slice(0, 120));
      }
      try {
        await fetchRecommendedVideos({
          label: 'Chat assistant response',
          searchQueries: queries,
          topic: queries[0],
          lessonContent: normalized,
        });
      } catch (error) {
        console.error('Chat video search failed:', error);
        setSourcesNotification('Unable to fetch YouTube videos for this answer.');
      }
    },
    [fetchRecommendedVideos, isFetchingVideoRecommendations, setSourcesNotification]
  );

  const handleDocumentInsightsGeneration = useCallback(async ({ file, name, documentId }: { file: File; name: string; documentId: string }) => {
    if (!isPdfFile(file) && !isSupportedTextDocument(file)) {
      console.warn('Unsupported document type for insights:', file.name);
      return;
    }

    const dedupKey = `${file.name}-${file.size}-${file.lastModified}`;
    if (processedDocumentInsightsRef.current.has(dedupKey)) {
      return;
    }
    processedDocumentInsightsRef.current.add(dedupKey);
    let completed = false;

    try {
      const { text } = await extractTextFromDocument(file);
      if (!text.trim()) {
        throw new Error('Document text extraction returned no text.');
      }
      documentTextCacheRef.current.set(documentId, { name, text });

      const insights = await analyzePdfTextWithGemini(name, text);
      const baseQueries = insights.videoQueries?.length
        ? insights.videoQueries
        : insights.keyTopics.slice(0, 3);
      const searchQueries = baseQueries.length
        ? baseQueries
        : [name.replace(/\.[^.]+$/, '') || 'chemistry lesson'];

      const lessonContent = `${insights.summary}\n\nKey topics: ${insights.keyTopics.join(', ')}\nConcepts: ${insights.essentialConcepts.join(', ')}`;
      await fetchRecommendedVideos({
        label: name,
        searchQueries,
        topic: insights.keyTopics?.[0] || name,
        lessonContent,
      });
      completed = true;
    } catch (error) {
      console.error('Failed to analyze document for video recommendations:', error);
    } finally {
      if (!completed) {
        processedDocumentInsightsRef.current.delete(dedupKey);
      }
    }
  }, [fetchRecommendedVideos]);

  const handleAddDocumentToChat = useCallback(({ documentId }: { documentId: string }) => {
    const entry = documentTextCacheRef.current.get(documentId);
    if (!entry) {
      alert('Still analyzing this document. Please try again in a few moments.');
      return;
    }

    addSource('document', {
      title: entry.name,
      content: entry.text,
      description: 'Added to chat context'
    });
    alert('Document added to chat context for future prompts.');
  }, [addSource]);

  const summarizeVideoToCanvas = useCallback(
    async (
      source: {
        id: string;
        title: string;
        url?: string;
        description?: string;
        videoId?: string;
        channelTitle?: string;
      },
      options: { showSpinner?: boolean } = {}
    ) => {
      const showSpinner = options.showSpinner ?? true;
      const resolvedVideoId = source.videoId ?? (source.url ? extractVideoIdFromUrl(source.url) : null);

      if (!resolvedVideoId) {
        alert('Could not determine the YouTube video ID for this entry.');
        return false;
      }

      if (showSpinner) {
        setVideoSummaryLoadingId(source.id);
      }

      try {
        const transcript = await fetchYouTubeTranscript(resolvedVideoId);
        const transcriptSnippet = transcript ? transcript.slice(0, 9000) : '';
        const promptParts = [
          'You are summarizing a YouTube video for chemistry students working on an infinite canvas.',
          'Return 3-5 concise bullet points and two concrete actions the learner can attempt next.',
          'Write in markdown with headings so it can be pasted directly.',
          '',
          `Title: ${source.title}`,
        ];
        if (source.channelTitle) {
          promptParts.push(`Channel: ${source.channelTitle}`);
        }
        if (source.description) {
          promptParts.push(`Description: ${source.description}`);
        }
        if (source.url) {
          promptParts.push(`URL: ${source.url}`);
        }
        if (transcriptSnippet) {
          promptParts.push('', 'Transcript excerpt:', transcriptSnippet);
        } else {
          promptParts.push('', 'Transcript unavailable – infer summary from metadata only.');
        }

        const summary = await geminiService.generateTextContent(promptParts.join('\n'));
        dispatchCanvasCommand({
          type: 'insert-text',
          text: `Video Summary — ${source.title}\n\n${summary.trim()}`
        });
        return true;
      } catch (error) {
        console.error('Failed to summarize YouTube video:', error);
        if (showSpinner) {
          alert('Unable to summarize this video right now. Please try again later.');
        }
        return false;
      } finally {
        if (showSpinner) {
          setVideoSummaryLoadingId(null);
        }
      }
    },
    [dispatchCanvasCommand]
  );

  const handleExportVideoSummary = useCallback(
    (source: any) => {
      void summarizeVideoToCanvas(source, { showSpinner: true });
    },
    [summarizeVideoToCanvas]
  );

  const handleSummarizeAllVideos = useCallback(async () => {
    if (!youtubeSources.length || summarizingAll) {
      return;
    }
    setSummarizingAll(true);
    try {
      for (const video of youtubeSources) {
        await summarizeVideoToCanvas(video, { showSpinner: false });
      }
    } finally {
      setSummarizingAll(false);
      setVideoSummaryLoadingId(null);
    }
  }, [summarizeVideoToCanvas, youtubeSources, summarizingAll]);


  const removeSource = (id: string) => {
    setSources(prev => prev.filter(source => source.id !== id));
  };

  const handleToggleInlineVideo = useCallback((source: SourceEntry) => {
    const resolvedVideoId = source.videoId ?? (source.url ? extractVideoIdFromUrl(source.url) : null);
    if (!resolvedVideoId) {
      alert('Unable to play this video inline. Try opening it on YouTube instead.');
      return;
    }
    setDocumentViewerOpen(true);
    setInlineVideoSourceId((prev) => (prev === source.id ? null : source.id));
  }, [setDocumentViewerOpen]);

  const requestCanvasFileUpload = useCallback((files: File[]) => {
    if (typeof window === 'undefined' || !files.length) {
      return;
    }
    window.dispatchEvent(new CustomEvent('canvas-upload-files', { detail: { files } }));
  }, []);

  const handleHeaderFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files ? Array.from(event.target.files) : [];
    if (!files.length) {
      return;
    }
    requestCanvasFileUpload(files);
    event.target.value = '';
  };

  const handleHeaderUploadClick = () => {
    fileUploadInputRef.current?.click();
  };

  // Resize handlers
  const handleMouseDown = (panel: 'sources' | 'chat', e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('Mouse down on', panel, 'panel'); // Debug log
    setIsResizing(panel);
    setResizeStartX(e.clientX);
    setResizeStartWidth(
      panel === 'sources' ? sourcesWidth :
        chatWidth
    );
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isResizing) return;

    const deltaX = e.clientX - resizeStartX;
    let newWidth;

    console.log('Mouse move, resizing:', isResizing, 'deltaX:', deltaX); // Debug log

    if (isResizing === 'sources') {
      newWidth = Math.max(250, Math.min(800, resizeStartWidth + deltaX));
      setSourcesWidth(newWidth);
    } else if (isResizing === 'chat') {
      // Handle is on the left edge of the chat panel, so dragging left (negative delta)
      // should increase width. Subtract deltaX to invert the effect.
      newWidth = Math.max(280, Math.min(800, resizeStartWidth - deltaX));
      console.log('Chat resize - Start:', resizeStartWidth, 'Delta:', deltaX, 'New:', newWidth);
      const boundedWidth = Math.max(CHAT_MIN_WIDTH, Math.min(CHAT_MAX_WIDTH, newWidth));
      setChatWidth(boundedWidth);
    }
  };

  const handleMouseUp = () => {
    setIsResizing(null);
  };

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    } else {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing, resizeStartX, resizeStartWidth]);

  useEffect(() => {
    if (!documentViewerOpen) {
      setInlineVideoSourceId(null);
    }
  }, [documentViewerOpen]);

  useEffect(() => {
    if (inlineVideoSourceId && !sources.some((source) => source.id === inlineVideoSourceId)) {
      setInlineVideoSourceId(null);
    }
  }, [inlineVideoSourceId, sources]);


  const handleSaveSettings = () => {
    alert('Gemini API key is centrally managed via Firestore. No manual configuration is required.');
    setShowSettings(false);
  };

  const shouldPromptForApiKey = (error: any) => {
    const code = error?.code;
    const message = typeof error?.message === 'string' ? error.message : '';
    const lower = message.toLowerCase();
    if (
      code === 'USER_KEY_REQUIRED' ||
      code === 'USER_KEY_INVALID' ||
      code === 'USER_KEY_RATE_LIMITED' ||
      lower.includes('add your own gemini api key') ||
      lower.includes('personal gemini api key')
    ) {
      return { shouldPrompt: true, message: message || 'Please add your Gemini API key in Settings.' };
    }
    return { shouldPrompt: false, message: '' };
  };

  const startCharacterStreaming = (messageId: string) => {
    streamingMessageIdRef.current = messageId;
    streamingIntervalRef.current = setInterval(() => {
      if (streamingQueueRef.current.length > 0) {
        const char = streamingQueueRef.current.shift()!;
        setInteractions(prev => prev.map(interaction =>
          interaction.id === messageId
            ? { ...interaction, response: (interaction.response || '') + char }
            : interaction
        ));
      } else if (streamingIntervalRef.current) {
        clearInterval(streamingIntervalRef.current);
        streamingIntervalRef.current = null;
        streamingMessageIdRef.current = null;
      }
    }, 10);
  };

  const stopCharacterStreaming = () => {
    if (streamingIntervalRef.current) {
      clearInterval(streamingIntervalRef.current);
      streamingIntervalRef.current = null;
    }
    streamingQueueRef.current = [];
    streamingMessageIdRef.current = null;
  };
  const handleSendMessage = async (
    message: string,
    options?: { mode?: InteractionMode; context?: string }
  ) => {
    const mode: InteractionMode = options?.mode ?? 'chat';
    const setLoading =
      mode === 'coach'
        ? setCoachLoading
        : mode === 'document'
          ? setDocChatLoading
          : setChatLoading;
    setLoading(true);

    // Add user message immediately
    const userInteraction: AIInteraction = {
      id: Date.now().toString(),
      prompt: message,
      response: '', // Will be updated with AI response
      timestamp: new Date(),
      mode,
    };
    setInteractions(prev => [...prev, userInteraction]);

    try {
      // Check if Gemini API is configured
      if (!geminiService.isGeminiInitialized()) {
        const errorResponse = {
          id: (Date.now() + 1).toString(),
          prompt: '',
          response: `🔑 **API Key Required**\n\nTo use the chat assistant, please configure your Gemini API key first.\n\n1. Click the Settings button (⚙️) in the toolbar\n2. Enter your Google Gemini API key\n3. Save the configuration\n\nGet your free API key at: https://makersuite.google.com/app/apikey`,
          timestamp: new Date(),
          mode,
        };
        setInteractions(prev => [...prev, errorResponse]);
        setLoading(false);
        return;
      }

      // Build context from sources if available
      let contextPrompt = '';
      if (sources.length > 0) {
        contextPrompt = '**Document Context:**\n';
        sources.forEach((source, index) => {
          contextPrompt += `\n**Source ${index + 1}: ${source.title}**\n${(source.content || '').substring(0, 2000)}...\n`;
        });
        contextPrompt += '\n**User Question:** ';
      }

      const textSources = sources.filter(source => source.content && source.content.trim().length > 0);
      const aggregatedDocumentText = textSources
        .map(source => `Title: ${source.title}\n${source.content}`)
        .join('\n\n')
        .slice(0, 20000);
      const hasDocumentContent = aggregatedDocumentText.length > 0;
      const documentContext = hasDocumentContent
        ? {
          documentText: aggregatedDocumentText,
          documentName: textSources[0]?.title
        }
        : undefined;

      const contextInstruction = options?.context ? `${options.context.trim()}\n\n` : '';
      let assistantGuidance = `${contextInstruction}${AI_RESPONSE_STYLE_PROMPT}

User question: ${message}`;
      if (isNmrAssistantActive) {
        assistantGuidance = `${NMR_ASSISTANT_PROMPT}

${AI_RESPONSE_STYLE_PROMPT}

Here is the learner's question: ${message}`;
      }

      const fullPrompt = contextPrompt + assistantGuidance;

      const assistantId = (Date.now() + 1).toString();
      const assistantInteraction: AIInteraction = {
        id: assistantId,
        prompt: '',
        response: '',
        timestamp: new Date(),
        mode,
        toolResponses: [],
      };
      setInteractions(prev => [...prev, assistantInteraction]);

      const runToolRouting = async () => {
        try {
          const plans = await detectToolCalls(message, { hasDocumentContent });
          if (!plans.length) {
            return;
          }
          const toolOutputs = await executeToolCalls(plans, documentContext);
          if (toolOutputs.length) {
            setInteractions(prev => prev.map(interaction => {
              if (interaction.id === assistantId) {
                return {
                  ...interaction,
                  toolResponses: toolOutputs
                };
              }
              return interaction;
            }));
          }
        } catch (toolError) {
          console.warn('Tool routing failed:', toolError);
        }
      };

      void runToolRouting();

      startCharacterStreaming(assistantId);

      const finalResponse = await geminiService.streamTextContent(fullPrompt, (chunk) => {
        if (!chunk) return;
        streamingQueueRef.current.push(...chunk.split(""));
      }, { model: "gemini-2.5-flash" });

      setTimeout(() => {
        stopCharacterStreaming();
      }, 100);

      setInteractions(prev => prev.map(interaction =>
        interaction.id === assistantId ? { ...interaction, response: finalResponse } : interaction
      ));
    } catch (error: any) {
      stopCharacterStreaming();
      console.error('Gemini API error:', error);
      const keyPrompt = shouldPromptForApiKey(error);
      if (keyPrompt.shouldPrompt) {
        setShowSettings(true);
        window.alert(keyPrompt.message);
      }
      const errorResponse = {
        id: (Date.now() + 1).toString(),
        prompt: '',
        response: `❌ **Error**: ${error.message || 'Failed to generate response'}\n\nPlease check:\n• Your API key is correct\n• You have internet connection\n• You haven't exceeded API quota`,
        timestamp: new Date(),
        mode,
      };
      setInteractions(prev => [...prev, errorResponse]);
    } finally {
      setLoading(false);
    }

    if (sources.length > 0 && message.toLowerCase().includes('source')) {
      setDocumentViewerOpen(true);
    }
  };

  const handleDocumentAssistantMessage = async (message: string) => {
    const docText = documentPlainText.trim();
    const excerpt =
      docText.length > 8000 ? docText.slice(docText.length - 8000) : docText;
    const contextBlock = docText
      ? `You are embedded in the Canvas document editor. Use the following excerpt (may be truncated) to understand the current draft:\n${excerpt}`
      : 'The document is currently empty. Help the user craft new content from scratch.';
    const guidance = `${contextBlock}\n\nWhen fulfilling requests, provide polished paragraphs or bullet lists that can be pasted directly into the editor.`;
    await handleSendMessage(message, {
      mode: 'document',
      context: guidance
    });
  };

  const handleCommand = (command: string) => {
    setCommandPaletteOpen(false);

    switch (command) {
      case 'draw':
        dispatchCanvasCommand({ type: 'set-tool', tool: 'draw' });
        break;
      case 'text':
        dispatchCanvasCommand({ type: 'set-tool', tool: 'textbox' });
        break;
      case 'erase':
        dispatchCanvasCommand({ type: 'set-tool', tool: 'eraser' });
        break;
      case 'clear':
        dispatchCanvasCommand({ type: 'clear-canvas' });
        break;
      case 'export':
        dispatchCanvasCommand({ type: 'export-canvas' });
        break;
      case 'grid':
        dispatchCanvasCommand({ type: 'toggle-grid' });
        break;
      case 'document':
      case 'toggle-sources':
        setDocumentViewerOpen(!documentViewerOpen);
        break;
      case 'settings':
      case 'open-settings':
        setShowSettings(!showSettings);
        break;
      case 'audio':
      case 'generate-audio-overview':
        setSelectedStudyTool('audio');
        setShowStudyTools(true);
        break;
      case 'video':
      case 'generate-video-overview':
        setSelectedStudyTool('video');
        setShowStudyTools(true);
        break;
      case 'mindmap':
      case 'create-mind-map':
        setSelectedStudyTool('mindmap');
        setShowStudyTools(true);
        break;
      case 'reports':
      case 'generate-reports':
        setSelectedStudyTool('reports');
        setShowStudyTools(true);
        break;
      case 'flashcards':
      case 'create-flashcards':
        setSelectedStudyTool('flashcards');
        setShowStudyTools(true);
        break;
      case 'quiz':
      case 'generate-quiz':
        setSelectedStudyTool('quiz');
        setShowStudyTools(true);
        break;
      case 'open-notes':
        setSelectedStudyTool('notes');
        setShowStudyTools(true);
        break;
      case 'open-documents':
        setSelectedStudyTool('documents');
        setShowStudyTools(true);
        break;
      case 'gemini-live':
      case 'voice-chat':
      case 'interactive-tutor':
        setShowGeminiLiveWorkspace(true);
        setShowSrlCoachWorkspace(false);
        setShowStudyToolsWorkspace(false);
        setShowDocumentUnderstandingWorkspace(false);
        setShowDocumentEditorCanvas(false);
        setShowNmrFullscreen(false);
        setShowChemistryPanel(false);
        setShowChatPanel(false);
        setIsNmrAssistantActive(false);
        setShowNmrAssistant(false);
        setIsRdkitAssistantActive(false);
        setShowRdkitAssistant(false);
        setRdkitStatus('idle');
        setShowSubjectExplorer(false);
        break;
      case 'ai-word':
      case 'word-processor':
      case 'smart-document':
        setShowAIWord(true);
        setShowAISheet(false);
        setShowSrlCoachWorkspace(false);
        setShowStudyToolsWorkspace(false);
        setShowDocumentUnderstandingWorkspace(false);
        setShowNmrFullscreen(false);
        setShowChemistryPanel(false);
        setShowChatPanel(false);
        setIsNmrAssistantActive(false);
        setShowNmrAssistant(false);
        setIsRdkitAssistantActive(false);
        setShowRdkitAssistant(false);
        setRdkitStatus('idle');
        setShowSubjectExplorer(false);
        startFeature('ai_word');
        break;
      case 'ai-sheet':
      case 'spreadsheet':
      case 'smart-spreadsheet':
        setShowAISheet(true);
        setShowAIWord(false);
        setShowSrlCoachWorkspace(false);
        setShowStudyToolsWorkspace(false);
        setShowDocumentUnderstandingWorkspace(false);
        setShowNmrFullscreen(false);
        setShowChemistryPanel(false);
        setShowChatPanel(false);
        setIsNmrAssistantActive(false);
        setShowNmrAssistant(false);
        setIsRdkitAssistantActive(false);
        setShowRdkitAssistant(false);
        setRdkitStatus('idle');
        setShowSubjectExplorer(false);
        startFeature('ai_sheet');
        break;
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey) {
        switch (e.key) {
          case 'k':
            e.preventDefault();
            setCommandPaletteOpen(true);
            break;
          case 'd':
            e.preventDefault();
            setDocumentViewerOpen(!documentViewerOpen);
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [documentViewerOpen]);

  useEffect(() => {
    return () => {
      stopCharacterStreaming();
    };
  }, []);

  // Show login page if not authenticated
  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-background text-foreground dark">
      {/* Header */}
      {!showDocumentEditorCanvas && (
        <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur-xl supports-[backdrop-filter]:bg-background/80 shadow-sm">
          <input
            ref={fileUploadInputRef}
            type="file"
            multiple
            accept={UNIVERSAL_FILE_ACCEPT}
            className="hidden"
            onChange={handleHeaderFileChange}
          />
          <div className="mx-auto flex max-w-screen-2xl flex-col gap-3 px-4 py-3 sm:px-5 lg:px-6">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex flex-1 min-w-[220px] items-center gap-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-purple-600 shadow-lg">
                    <Beaker className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-lg font-semibold tracking-tight text-white">Studium</span>
                    <span className="text-xs text-muted-foreground/80 font-medium">Chemistry Workspace</span>
                  </div>
                </div>

                <div className="hidden lg:flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping"></span>
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400"></span>
                  </span>
                  AI Connected · Gemini 2.0
                </div>
              </div>

              <div className="flex-1 min-w-[220px] max-w-xl">
                <button
                  onClick={() => setCommandPaletteOpen(true)}
                  className="group inline-flex h-10 w-full items-center justify-between rounded-xl border border-border/50 bg-background/80 px-3.5 text-sm font-medium text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  <span className="flex items-center gap-2 text-left">
                    <Search className="h-4 w-4 text-foreground/70 group-hover:text-foreground" />
                    <span className="text-foreground font-semibold">Quick Search</span>
                    <span className="hidden sm:inline text-xs text-muted-foreground">docs, tools, AI</span>
                  </span>
                  <kbd className="pointer-events-none inline-flex h-7 select-none items-center gap-1 rounded-lg border border-border/50 bg-muted/50 px-3 font-mono text-[11px] uppercase tracking-wide opacity-80">
                    ⌘K
                  </kbd>
                </button>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2">
                {isAuthenticated && (() => {
                  const sessionStatus = getSessionStatus();
                  if (sessionStatus.isValid && sessionStatus.remainingHours) {
                    return (
                      <div className="hidden sm:flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-500">
                        <Clock className="h-3.5 w-3.5" />
                        <span>{sessionStatus.remainingHours}h active</span>
                        {sessionStatus.remainingHours < 24 && (
                          <button
                            onClick={() => {
                              if (extendSession(2)) {
                                console.log('Session extended by 2 days');
                                window.location.reload();
                              }
                            }}
                            className="text-amber-300 underline-offset-2 hover:underline"
                          >
                            Extend
                          </button>
                        )}
                      </div>
                    );
                  }
                  return null;
                })()}

                <div className="flex items-center gap-1.5 rounded-2xl border border-border/40 bg-background/60 p-1 shadow-inner">
                  <button
                    onClick={() => setShowProfileUpdate(true)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                    title="Update Profile"
                  >
                    <User className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setShowSettings(!showSettings)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                  >
                    <Settings className="h-4 w-4" />
                  </button>
                  <button
                    onClick={handleLogout}
                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-rose-500 to-rose-600 px-3 py-2 text-xs font-semibold text-white shadow-lg shadow-rose-500/20 transition-transform hover:scale-[1.01]"
                    title={`Logged in as ${user?.username || user?.displayName}`}
                  >
                    <LogOut className="h-4 w-4" />
                    <span className="hidden sm:inline">{user?.username || user?.displayName}</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  onClick={() => setDocumentViewerOpen(!documentViewerOpen)}
                  className={`${pillButtonClasses} ${documentViewerOpen ? 'border-blue-500/40 bg-blue-500/10 text-blue-200' : ''}`}
                >
                  <FileText className="h-4 w-4" />
                  {documentViewerOpen ? 'Hide Sources' : 'Sources'}
                </button>

                <button
                  onClick={handleHeaderUploadClick}
                  className={`${pillButtonClasses} border-dashed border-blue-500/50 bg-blue-500/5 text-blue-100 hover:text-white`}
                  title="Upload a PDF, image, or text doc directly to the canvas"
                >
                  <Upload className="h-4 w-4" />
                  Upload to Canvas
                </button>

                <button
                  onClick={() => {
                    setShowStudyToolsWorkspace(true);
                    setShowSrlCoachWorkspace(false);
                    setShowChatPanel(false);
                    setShowNmrFullscreen(false);
                    setShowRdkitWorkspace(false);
                    setIsNmrAssistantActive(false);
                    setShowNmrAssistant(false);
                    setIsRdkitAssistantActive(false);
                    setShowRdkitAssistant(false);
                    setRdkitStatus('idle');
                    startFeature('study_tools');
                  }}
                  className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-purple-600 to-purple-500 px-3 py-1 text-xs font-semibold text-white shadow-sm shadow-purple-500/25 transition-transform hover:scale-[1.02]"
                >
                  <Sparkles className="h-4 w-4" />
                  Study Tools
                </button>

                <button
                  onClick={() => {
                    setShowSrlCoachWorkspace(true);
                    setShowStudyToolsWorkspace(false);
                    setShowChatPanel(false);
                    setShowNmrFullscreen(false);
                    setShowRdkitWorkspace(false);
                    setIsNmrAssistantActive(false);
                    setShowNmrAssistant(false);
                    setIsRdkitAssistantActive(false);
                    setShowRdkitAssistant(false);
                    setRdkitStatus('idle');
                    startFeature('srl_coach');
                  }}
                  className={pillButtonClasses}
                >
                  <Target className="h-4 w-4" />
                  SRL Coach
                </button>

                <button
                  onClick={() => {
                    setShowDocumentUnderstandingWorkspace(true);
                    setShowSrlCoachWorkspace(false);
                    setShowStudyToolsWorkspace(false);
                    setShowDocumentEditorCanvas(false);
                    setShowNmrFullscreen(false);
                    setShowChemistryPanel(false);
                    setShowChatPanel(false);
                    setIsNmrAssistantActive(false);
                    setShowNmrAssistant(false);
                    setIsRdkitAssistantActive(false);
                    setShowRdkitAssistant(false);
                    setRdkitStatus('idle');
                    void captureToolClick('docs_ai');
                    startFeature('docs_ai');
                  }}
                  className={pillButtonClasses}
                >
                  <FileText className="h-4 w-4" />
                  Docs AI
                </button>

                <button
                  onClick={() => {
                    setShowDocumentEditorCanvas(true);
                    setShowDocumentUnderstandingWorkspace(false);
                    setShowSrlCoachWorkspace(false);
                    setShowStudyToolsWorkspace(false);
                    setShowNmrFullscreen(false);
                    setShowChemistryPanel(false);
                    setShowChatPanel(false);
                    setIsNmrAssistantActive(false);
                    setShowNmrAssistant(false);
                    setIsRdkitAssistantActive(false);
                    setShowRdkitAssistant(false);
                    setRdkitStatus('idle');
                    void captureToolClick('doc_canvas');
                    startFeature('doc_canvas');
                  }}
                  className={pillButtonClasses}
                >
                  <Edit3 className="h-4 w-4" />
                  Doc Canvas
                </button>

                <button
                  onClick={() => {
                    startFeature('3d_explorer');
                    openChemistryPanel();
                  }}
                  className={pillButtonClasses}
                >
                  <Layers3 className="h-4 w-4" />
                  3D Explorer
                </button>

                <button
                  onClick={() => {
                    setShowSubjectExplorer(true);
                    setShowSrlCoachWorkspace(false);
                    setShowStudyToolsWorkspace(false);
                    setShowDocumentUnderstandingWorkspace(false);
                    setShowNmrFullscreen(false);
                    setShowChemistryPanel(false);
                    setShowChatPanel(false);
                    setIsNmrAssistantActive(false);
                    setShowNmrAssistant(false);
                    setIsRdkitAssistantActive(false);
                    setShowRdkitAssistant(false);
                    setRdkitStatus('idle');
                    void captureToolClick('subject_explorer');
                    startFeature('subject_explorer');
                  }}
                  className={pillButtonClasses}
                >
                  <BookOpen className="h-4 w-4" />
                  Subject Explorer
                </button>

                <button
                  onClick={() => {
                    setShowDeepAgentWorkspace(true);
                    setShowSrlCoachWorkspace(false);
                    setShowStudyToolsWorkspace(false);
                    setShowDocumentUnderstandingWorkspace(false);
                    setShowSubjectExplorer(false);
                    setShowNmrFullscreen(false);
                    setShowChemistryPanel(false);
                    setShowChatPanel(false);
                    setIsNmrAssistantActive(false);
                    setShowNmrAssistant(false);
                    setIsRdkitAssistantActive(false);
                    setShowRdkitAssistant(false);
                    setRdkitStatus('idle');
                    void captureToolClick('deep_agent');
                    startFeature('deep_agent');
                  }}
                  className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-purple-600 to-blue-500 px-3 py-1 text-xs font-semibold text-white shadow-sm shadow-purple-500/25 transition-transform hover:scale-[1.02]"
                >
                  <Sparkles className="h-4 w-4" />
                  Deep Agent
                </button>

                <button
                  onClick={() => {
                    setShowLatexWorkspace(true);
                    setShowDeepAgentWorkspace(false);
                    setShowSrlCoachWorkspace(false);
                    setShowStudyToolsWorkspace(false);
                    setShowDocumentUnderstandingWorkspace(false);
                    setShowSubjectExplorer(false);
                    setShowNmrFullscreen(false);
                    setShowChemistryPanel(false);
                    setShowChatPanel(false);
                    setIsNmrAssistantActive(false);
                    setShowNmrAssistant(false);
                    setIsRdkitAssistantActive(false);
                    setShowRdkitAssistant(false);
                    setRdkitStatus('idle');
                    void captureToolClick('latex_agent');
                    startFeature('latex_agent');
                  }}
                  className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-green-600 to-teal-500 px-3 py-1 text-xs font-semibold text-white shadow-sm shadow-green-500/25 transition-transform hover:scale-[1.02]"
                >
                  <FileText className="h-4 w-4" />
                  LaTeX Agent
                </button>

                <button
                  onClick={() => {
                    setShowResearchPaperWorkspace(true);
                    setShowLatexWorkspace(false);
                    setShowDeepAgentWorkspace(false);
                    setShowSrlCoachWorkspace(false);
                    setShowStudyToolsWorkspace(false);
                    setShowDocumentUnderstandingWorkspace(false);
                    setShowSubjectExplorer(false);
                    setShowNmrFullscreen(false);
                    setShowChemistryPanel(false);
                    setShowChatPanel(false);
                    setIsNmrAssistantActive(false);
                    setShowNmrAssistant(false);
                    setIsRdkitAssistantActive(false);
                    setShowRdkitAssistant(false);
                    setRdkitStatus('idle');
                    void captureToolClick('research_paper_agent');
                    startFeature('research_paper_agent');
                  }}
                  className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-amber-600 to-orange-500 px-3 py-1 text-xs font-semibold text-white shadow-sm shadow-amber-500/25 transition-transform hover:scale-[1.02]"
                >
                  <BookOpen className="h-4 w-4" />
                  Research Paper
                </button>

                <button
                  onClick={() => {
                    setShowNmrFullscreen(true);
                    setShowSrlCoachWorkspace(false);
                    setShowStudyToolsWorkspace(false);
                    setIsNmrAssistantActive(false);
                    setShowChatPanel(false);
                    startFeature('nmr_lab');
                  }}
                  className={pillButtonClasses}
                >
                  <LineChart className="h-4 w-4" />
                  NMR Lab
                </button>

                <button
                  onClick={() => {
                    setShowGeminiLiveWorkspace(true);
                    setShowSrlCoachWorkspace(false);
                    setShowStudyToolsWorkspace(false);
                    setShowDocumentUnderstandingWorkspace(false);
                    setShowDocumentEditorCanvas(false);
                    setShowNmrFullscreen(false);
                    setShowChemistryPanel(false);
                    setShowChatPanel(false);
                    setIsNmrAssistantActive(false);
                    setShowNmrAssistant(false);
                    setIsRdkitAssistantActive(false);
                    setShowRdkitAssistant(false);
                    setRdkitStatus('idle');
                    setShowSubjectExplorer(false);
                    void captureToolClick('gemini_live');
                    startFeature('gemini_live');
                  }}
                  className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-green-600 to-emerald-500 px-3 py-1 text-xs font-semibold text-white shadow-sm shadow-green-500/25 transition-transform hover:scale-[1.02]"
                >
                  <Mic className="h-4 w-4" />
                  Gemini Live
                </button>

                <button
                  onClick={() => {
                    setShowAIWord(true);
                    setShowAISheet(false);
                    setShowSrlCoachWorkspace(false);
                    setShowStudyToolsWorkspace(false);
                    setShowDocumentUnderstandingWorkspace(false);
                    setShowSubjectExplorer(false);
                    setShowNmrFullscreen(false);
                    setShowChemistryPanel(false);
                    setShowChatPanel(false);
                    setIsNmrAssistantActive(false);
                    setShowNmrAssistant(false);
                    setIsRdkitAssistantActive(false);
                    setShowRdkitAssistant(false);
                    setRdkitStatus('idle');
                    void captureToolClick('ai_word');
                    startFeature('ai_word');
                  }}
                  className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-600 to-indigo-500 px-3 py-1 text-xs font-semibold text-white shadow-sm shadow-blue-500/25 transition-transform hover:scale-[1.02]"
                >
                  <PenLine className="h-4 w-4" />
                  AI Word
                </button>

                <button
                  onClick={() => {
                    setShowAISheet(true);
                    setShowAIWord(false);
                    setShowSrlCoachWorkspace(false);
                    setShowStudyToolsWorkspace(false);
                    setShowDocumentUnderstandingWorkspace(false);
                    setShowSubjectExplorer(false);
                    setShowNmrFullscreen(false);
                    setShowChemistryPanel(false);
                    setShowChatPanel(false);
                    setIsNmrAssistantActive(false);
                    setShowNmrAssistant(false);
                    setIsRdkitAssistantActive(false);
                    setShowRdkitAssistant(false);
                    setRdkitStatus('idle');
                    void captureToolClick('ai_sheet');
                    startFeature('ai_sheet');
                  }}
                  className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-600 to-green-500 px-3 py-1 text-xs font-semibold text-white shadow-sm shadow-emerald-500/25 transition-transform hover:scale-[1.02]"
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  AI Sheet
                </button>

                <div className="inline-flex items-center rounded-full border border-border/40 bg-background/80 p-0.5 text-xs font-semibold shadow-sm">
                  <button
                    onClick={() => {
                      setIsMolecularMode(false);
                      setShowSimulationPlayground(false);
                    }}
                    className={`flex items-center gap-1.5 rounded-full px-3 py-1 transition-colors ${!isMolecularMode && !showSimulationPlayground ? 'bg-orange-500 text-white shadow' : 'text-muted-foreground hover:text-foreground'
                      }`}
                  >
                    <Edit3 className="h-4 w-4" />
                    Canvas Studio
                  </button>
                  <button
                    onClick={() => {
                      setIsMolecularMode(true);
                      setShowSimulationPlayground(false);
                    }}
                    className={`flex items-center gap-1.5 rounded-full px-3 py-1 transition-colors ${isMolecularMode && !showSimulationPlayground ? 'bg-blue-500 text-white shadow' : 'text-muted-foreground hover:text-foreground'
                      }`}
                  >
                    <Beaker className="h-4 w-4" />
                    Molecule Sketcher
                  </button>
                  <button
                    onClick={() => {
                      setShowSimulationPlayground(true);
                      setIsMolecularMode(false);
                      void captureToolClick('simulation_playground');
                      startFeature('simulation_playground');
                    }}
                    className={`flex items-center gap-1.5 rounded-full px-3 py-1 transition-colors ${showSimulationPlayground ? 'bg-emerald-500 text-white shadow' : 'text-muted-foreground hover:text-foreground'
                      }`}
                  >
                    <GitGraph className="h-4 w-4" />
                    Simulation
                  </button>
                </div>

              </div>

              {sourcesNotification && (
                <div className="flex items-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-50">
                  <span>{sourcesNotification}</span>
                  <button
                    onClick={() => setSourcesNotification(null)}
                    className="rounded-full p-1 text-emerald-100 transition hover:bg-emerald-500/20"
                    aria-label="Dismiss sources notification"
                  >
                    <X className="h-3.5 w-3.5" />


                  </button>
                </div>
              )}

              <div className="flex w-full flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground">
                  Welcome back, <span className="text-foreground">{user?.username || user?.displayName || 'Explorer'}</span>
                </span>
                <div className="ml-auto flex w-full justify-start sm:w-auto sm:justify-end">
                  <FlippingInfo userName={user?.username || user?.displayName || 'User'} />
                </div>
              </div>
            </div>
          </div>
        </header>
      )}

      {/* Command Palette */}
      <CommandPalette
        open={commandPaletteOpen}
        onOpenChange={setCommandPaletteOpen}
        onCommand={handleCommand}
      />

      {/* Study Tools Modal */}
      {showStudyTools && (
        <StudyTools
          isOpen={showStudyTools}
          onClose={() => setShowStudyTools(false)}
          sourceContent={sources.filter(s => s.content).map(s => s.content).join('\n\n')}
          sourceName={sources.length > 0 ? `${sources.length} sources` : 'No sources'}
          toolType={selectedStudyTool}
        />
      )}

      {showDocumentEditorCanvas && (
        <div className="fixed inset-0 z-50 flex flex-col bg-slate-950/90 backdrop-blur">
          <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/90 px-4 py-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">Document Canvas</p>
              <h2 className="text-lg font-semibold text-white">Canvas Editor</h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowDocumentAssistant(prev => !prev)}
                className="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-3 py-2 text-sm font-semibold text-slate-100 border border-slate-700 hover:bg-slate-700"
              >
                <MessageSquare className="h-4 w-4" />
                {showDocumentAssistant ? 'Hide Assistant' : 'Show Assistant'}
              </button>
              <button
                onClick={() => {
                  setShowDocumentEditorCanvas(false);
                  endCurrentFeature();
                }}
                className="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-3 py-2 text-sm font-semibold text-slate-100 border border-slate-700 hover:bg-slate-700"
              >
                <X className="h-5 w-5" />
                Close
              </button>
            </div>
          </div>
          <div className="flex-1 min-h-0 p-4 overflow-hidden">
            <div className="flex h-full gap-4">
              <div className="flex-1 min-h-0">
                <DocumentEditorCanvas
                  onContentChange={content =>
                    setDocEditorContent(Array.isArray(content) ? content : [])
                  }
                />
              </div>
              {showDocumentAssistant && (
                <aside className="w-full max-w-md flex flex-col rounded-2xl border border-slate-800 bg-slate-900/80">
                  <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-400">AI Document Assistant</p>
                      <p className="text-sm text-slate-100">Preview changes before inserting</p>
                    </div>
                    <button
                      onClick={() => setShowDocumentAssistant(false)}
                      className="text-xs text-slate-300 hover:text-white"
                    >
                      Hide
                    </button>
                  </div>
                  <div className="flex-1 min-h-0">
                    <AIChat
                      onSendMessage={handleDocumentAssistantMessage}
                      interactions={interactions}
                      isLoading={docChatLoading}
                      documentName="Document Canvas"
                      mode="document"
                    />
                  </div>
                </aside>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen NMR viewer */}
      {showSrlCoachWorkspace ? (
        <SrlCoachWorkspace
          interactions={interactions}
          onSendMessage={handleSendMessage}
          isLoading={coachLoading}
          documentName={sources.length > 0 ? `${sources.length} sources` : 'No sources'}
          onOpenDocument={() => setDocumentViewerOpen(true)}
          user={user}
          onClose={() => {
            setShowSrlCoachWorkspace(false);
            setShowChatPanel(false);
            setIsNmrAssistantActive(false);
            setShowNmrAssistant(false);
            setIsRdkitAssistantActive(false);
            setShowRdkitAssistant(false);
          }}
        />
      ) : showStudyToolsWorkspace ? (
        <StudyToolsWorkspace
          interactions={interactions}
          onSendMessage={handleSendMessage}
          isLoading={coachLoading}
          documentName={sources.length > 0 ? `${sources.length} sources` : 'No sources'}
          onOpenDocument={() => setDocumentViewerOpen(true)}
          user={user}
          sourceContent={sources.filter(s => s.content).map(s => s.content).join('\n\n')}
          sourceName={sources.length > 0 ? `${sources.length} sources` : 'No sources'}
          selectedTool={selectedWorkspaceTool}
          onClose={() => {
            setShowStudyToolsWorkspace(false);
            setShowChatPanel(false);
            setIsNmrAssistantActive(false);
            setShowNmrAssistant(false);
            setIsRdkitAssistantActive(false);
            setShowRdkitAssistant(false);
          }}
        />
      ) : showDocumentUnderstandingWorkspace ? (
        <DocumentUnderstandingWorkspace
          onClose={() => {
            setShowDocumentUnderstandingWorkspace(false);
            setShowChatPanel(false);
            setIsNmrAssistantActive(false);
            setShowNmrAssistant(false);
          }}
          apiKey={apiKey}
        />
      ) : showSubjectExplorer ? (
        <SubjectExplorer
          onClose={() => {
            setShowSubjectExplorer(false);
          }}
          apiKey={apiKey}
        />
      ) : showDeepAgentWorkspace ? (
        <DeepAgentWorkspace
          onBack={() => {
            setShowDeepAgentWorkspace(false);
            setShowChatPanel(false);
          }}
        />
      ) : showLatexWorkspace ? (
        <LatexDocumentWorkspace
          onBack={() => {
            setShowLatexWorkspace(false);
            setShowChatPanel(false);
          }}
        />
      ) : showResearchPaperWorkspace ? (
        <ResearchPaperWorkspace
          onBack={() => {
            setShowResearchPaperWorkspace(false);
            setShowChatPanel(false);
          }}
        />
      ) : showNmrFullscreen ? (
        <div className="flex h-[calc(100vh-5rem)] flex-col">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between bg-slate-900 border-b border-slate-800 px-4 md:px-6 py-3">
            <div>
              <h2 className="text-sm font-semibold text-white">NMRium Viewer (Fullscreen)</h2>
              <p className="text-xs text-slate-400">Embedded from the NFDI4Chem public instance.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => {
                  setShowNmrAssistant(prev => {
                    const next = !prev;
                    setIsNmrAssistantActive(next);
                    if (!next) {
                      setShowChatPanel(false);
                    }
                    return next;
                  });
                }}
                className={`inline-flex items-center gap-2 px-3 py-2 text-xs font-medium rounded ${showNmrAssistant ? 'bg-blue-600 text-white hover:bg-blue-500' : 'bg-slate-800 border border-slate-600 text-slate-200 hover:bg-slate-700'}`}
              >
                <Headphones className="h-4 w-4" />
                {showNmrAssistant ? 'Hide NMR Assistant' : 'Open NMR Assistant'}
              </button>
              <button
                onClick={() => window.open('https://nmrium.nmrxiv.org?workspace=default', '_blank', 'noopener')}
                className="inline-flex items-center gap-2 px-3 py-2 text-xs font-medium rounded bg-slate-800 border border-slate-600 text-slate-200 hover:bg-slate-700"
              >
                <LineChart className="h-4 w-4" /> Open in new tab
              </button>
              <button
                onClick={() => {
                  setShowNmrFullscreen(false);
                  setIsNmrAssistantActive(false);
                  setShowNmrAssistant(false);
                  setShowChatPanel(false);
                }}
                className="inline-flex items-center gap-2 px-3 py-2 text-xs font-medium rounded bg-blue-600 text-white hover:bg-blue-500"
              >
                Exit NMR View
              </button>
            </div>
          </div>
          <div className="flex flex-1 overflow-hidden">
            <div className={`flex-1 overflow-hidden ${showNmrAssistant ? 'lg:pr-0' : ''}`}>
              <iframe
                title="nmrium-fullscreen"
                src="https://nmrium.nmrxiv.org?workspace=default"
                className="h-full w-full"
                allowFullScreen
              />
            </div>
            {showNmrAssistant && (
              <aside className="flex w-full max-w-md flex-col border-l border-slate-800 bg-slate-900">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between px-4 py-3 border-b border-slate-800">
                  <div>
                    <h3 className="text-sm font-semibold text-white">NMR Assistant</h3>
                    <p className="text-xs text-slate-400">Guide, SMILES suggestions, and spectrum tips</p>
                  </div>
                  <button
                    onClick={() => {
                      setShowNmrAssistant(false);
                      setIsNmrAssistantActive(false);
                      setShowChatPanel(false);
                    }}
                    className="text-xs text-slate-300 bg-slate-800 hover:bg-slate-700 px-3 py-1 rounded-md"
                  >
                    Close Chat
                  </button>
                </div>
                <div className="flex-1 overflow-hidden bg-slate-900">
                  <AIChat
                    onSendMessage={handleSendMessage}
                    interactions={interactions}
                    isLoading={chatLoading}
                    documentName="NMRium Workspace"
                    onRequestVideoSearch={handleVideoSearchFromChatResponse}
                  />
                </div>
              </aside>
            )}
          </div>
        </div>
      ) : showGeminiLiveWorkspace ? (
        <GeminiLiveWorkspace
          onClose={() => setShowGeminiLiveWorkspace(false)}
          apiKey={apiKey}
        />
      ) : (
        <div className="flex h-[calc(100vh-5rem)]">
          {/* Sources Panel */}
          {documentViewerOpen && (
            <>
              <div
                className="border-r-2 border-border bg-card flex flex-col shadow-lg"
                style={{ width: sourcesWidth }}
              >
                {/* Sources Header */}
                <div className="px-6 py-4 border-b border-border bg-muted/50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary">
                        <FileText className="h-4 w-4 text-primary-foreground" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold">Sources</h3>
                        <p className="text-xs text-muted-foreground">Add documents, videos & links</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setDocumentViewerOpen(false)}
                      className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-8 w-8"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-3 px-6 py-4 border-b border-border bg-muted/20 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                  <p className="sm:max-w-xl">
                    We automatically add new YouTube explainers whenever you upload a PDF (use “Upload to Canvas” in the header). Just hit play and keep sketching on the board.
                  </p>
                  <button
                    onClick={handleSummarizeAllVideos}
                    disabled={summarizingAll || youtubeSources.length === 0}
                    className={`inline-flex items-center justify-center rounded-full px-4 py-2 text-[11px] font-semibold uppercase tracking-wide transition ${summarizingAll || youtubeSources.length === 0
                      ? 'bg-slate-700 text-slate-400'
                      : 'bg-primary text-primary-foreground hover:bg-primary/90'
                      }`}
                  >
                    {summarizingAll ? 'Summarizing all…' : 'Summarize all to canvas'}
                  </button>
                </div>


                {/* Sources List */}
                <div className="flex-1 p-6 overflow-y-auto">
                  <div className="space-y-3">
                    {youtubeSources.length === 0 ? (
                      <div className="text-center py-12">
                        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted mx-auto mb-3">
                          <Video className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <p className="text-sm text-muted-foreground">No video recommendations yet</p>
                        <p className="text-xs text-muted-foreground">Upload a PDF to see curated explainers.</p>
                      </div>
                    ) : (
                      youtubeSources.map((source) => {
                        const resolvedVideoId = source.videoId ?? (source.url ? extractVideoIdFromUrl(source.url) : null);
                        const isInlinePlaying = inlineVideoSourceId === source.id && Boolean(resolvedVideoId);
                        const embedUrl = resolvedVideoId
                          ? `https://www.youtube.com/embed/${encodeURIComponent(resolvedVideoId)}?autoplay=1&modestbranding=1`
                          : null;
                        return (
                          <div key={source.id} className="rounded-2xl border border-border bg-card/70 p-4 shadow-sm">
                            <div className="flex flex-col gap-3 sm:flex-row">
                              {isInlinePlaying && embedUrl ? (
                                <div
                                  className="relative w-full overflow-hidden rounded-xl border border-border bg-black sm:h-28 sm:w-44 sm:flex-shrink-0"
                                  style={{ aspectRatio: '16 / 9' }}
                                >
                                  <iframe
                                    src={embedUrl}
                                    title={`${source.title} inline player`}
                                    className="absolute inset-0 h-full w-full"
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                    allowFullScreen
                                  />
                                </div>
                              ) : source.thumbnail ? (
                                <img
                                  src={source.thumbnail}
                                  alt={source.title}
                                  className="h-24 w-full rounded-xl border border-border object-cover sm:h-28 sm:w-44 sm:flex-shrink-0"
                                  loading="lazy"
                                />
                              ) : (
                                <div className="flex h-24 w-full items-center justify-center rounded-xl border border-dashed border-border text-muted-foreground sm:h-28 sm:w-44 sm:flex-shrink-0">
                                  <Video className="h-6 w-6" />
                                </div>
                              )}
                              <div className="min-w-0 flex-1">
                                <h4 className="text-sm font-semibold text-foreground truncate">{source.title}</h4>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {source.channelTitle ? `${source.channelTitle}` : 'YouTube'}
                                  {source.channelSubscribers
                                    ? ` • ${Intl.NumberFormat('en', { notation: 'compact' }).format(source.channelSubscribers)} subscribers`
                                    : ''}
                                </p>
                                {source.description && (
                                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{source.description}</p>
                                )}
                                {source.url && (
                                  <a
                                    href={source.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="mt-2 inline-flex items-center text-xs font-semibold text-blue-400 hover:text-blue-300 underline-offset-2"
                                  >
                                    Watch on YouTube
                                    <ExternalLink className="ml-1 h-3 w-3" />
                                  </a>
                                )}
                                <div className="mt-3 flex flex-wrap gap-2">
                                  <button
                                    onClick={() => handleExportVideoSummary(source)}
                                    disabled={videoSummaryLoadingId === source.id}
                                    className={`inline-flex items-center justify-center rounded-full px-3 py-1.5 text-[11px] font-semibold transition ${videoSummaryLoadingId === source.id
                                      ? 'bg-slate-700 text-slate-300'
                                      : 'bg-primary text-primary-foreground hover:bg-primary/90'
                                      }`}
                                  >
                                    {videoSummaryLoadingId === source.id ? 'Summarizing…' : 'Summarize to Canvas'}
                                  </button>
                                  {resolvedVideoId && (
                                    <button
                                      onClick={() => handleToggleInlineVideo(source)}
                                      className={`inline-flex items-center justify-center rounded-full px-3 py-1.5 text-[11px] font-semibold transition ${isInlinePlaying
                                        ? 'bg-emerald-500 text-white hover:bg-emerald-400'
                                        : 'border border-border text-muted-foreground hover:border-emerald-400 hover:text-emerald-400'
                                        }`}
                                    >
                                      {isInlinePlaying ? 'Close inline player' : 'Play inline'}
                                    </button>
                                  )}
                                  <button
                                    onClick={() => removeSource(source.id)}
                                    className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground hover:bg-red-100 hover:text-red-600 transition"
                                    title="Remove source"
                                  >
                                    <X className="h-4 w-4" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

              </div>

              {/* Resize Handle */}
              <div
                className="w-2 bg-muted hover:bg-primary/50 cursor-col-resize transition-colors border-r border-border"
                onMouseDown={(e) => handleMouseDown('sources', e)}
              />
            </>
          )}

          {/* Main Content Area */}
          <div className="flex-1 flex flex-col bg-background/50">
            {/* Canvas, Chat, and Study Tools */}
            <div className="flex-1 flex relative">
              {/* Canvas */}
              <div className="flex-1 relative flex flex-col">
                {showSimulationPlayground ? (
                  <SimulationPlayground onClose={() => setShowSimulationPlayground(false)} />
                ) : isMolecularMode ? (
                  <MoldrawEmbed />
                ) : (
                  <>
                    <div className="flex items-center gap-2 border-b border-slate-800/60 bg-slate-900/60 px-4 py-2 text-sm">
                      {canvasWorkspaces.map(workspace => {
                        const isActive = workspace.id === activeWorkspaceId;
                        return (
                          <button
                            key={workspace.id}
                            onClick={() => handleSelectWorkspace(workspace.id)}
                            className={`inline-flex items-center gap-2 rounded-2xl px-3 py-1.5 transition ${isActive
                              ? 'bg-slate-800 text-slate-100 border border-slate-700 shadow-sm'
                              : 'text-slate-400 border border-transparent hover:border-slate-700 hover:text-slate-100'
                              }`}
                          >
                            <span className="font-medium">{workspace.title}</span>
                            {canvasWorkspaces.length > 1 && (
                              <span
                                role="button"
                                tabIndex={-1}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleCloseWorkspace(workspace.id);
                                }}
                                className="inline-flex items-center justify-center rounded-full p-0.5 hover:bg-slate-700/70"
                              >
                                <X size={12} />
                              </span>
                            )}
                          </button>
                        );
                      })}
                      <button
                        onClick={handleAddWorkspace}
                        className="inline-flex items-center justify-center rounded-2xl border border-dashed border-slate-700 px-2.5 py-1.5 text-slate-300 hover:border-slate-500 hover:text-white"
                        title="Add workspace tab"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                    <div className="flex-1 relative">
                      {canvasWorkspaces.map(workspace => (
                        <div
                          key={workspace.id}
                          className={`${workspace.id === activeWorkspaceId ? 'block' : 'hidden'} h-full w-full`}
                        >
                          <Canvas
                            currentTool={currentTool}
                            strokeWidth={strokeWidth}
                            strokeColor={strokeColor}
                            onOpenCalculator={handleOpenCalculator}
                            onOpenMolView={handleOpenMolView}
                            onOpenPeriodicTable={handleOpenPeriodicTable}
                            onDocumentCaptured={handleDocumentInsightsGeneration}
                            onDocumentAddToChat={handleAddDocumentToChat}
                            onRegisterSnapshotHandler={(handler) => registerWorkspaceHandler(workspace.id, 'snapshot', handler)}
                            onRegisterTextInjectionHandler={(handler) => registerWorkspaceHandler(workspace.id, 'text', handler)}
                            onRegisterMarkdownInjectionHandler={(handler) => registerWorkspaceHandler(workspace.id, 'markdown', handler)}
                            onRegisterMoleculeInjectionHandler={(handler) => registerWorkspaceHandler(workspace.id, 'molecule', handler)}
                            onRegisterProteinInjectionHandler={(handler) => registerWorkspaceHandler(workspace.id, 'protein', handler)}
                            onRegisterReactionInjectionHandler={(handler) => registerWorkspaceHandler(workspace.id, 'reaction', handler)}
                          />
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>




              {/* Study Tools Panel */}
              {/* Study Tools Panel handled via full-screen workspace */}

              {/* Chat Start Button - Floating */}
              {!showChatPanel && !showNmrFullscreen && !showSrlCoachWorkspace && !showGeminiLiveWorkspace && (
                <div className="absolute top-4 right-8 z-10 flex flex-col gap-3 items-end">
                  {/* Gemini Live Share Canvas Button */}
                  {geminiLiveState.connectionState === ConnectionState.CONNECTED && (
                    <DarkButtonWithIcon
                      onClick={() => geminiLiveState.captureAndSendSnapshot()}
                      className="shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 bg-blue-600 hover:bg-blue-500 border-blue-500"
                    >
                      <span className='mr-[10px]'>
                        <Video className="h-5 w-5" />
                      </span>
                      Share Canvas
                    </DarkButtonWithIcon>
                  )}

                  <DarkButtonWithIcon
                    onClick={() => {
                      console.log('Starting chat panel...');
                      setIsNmrAssistantActive(false);
                      setShowChatPanel(true);
                    }}
                    className="shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
                  >
                    <span className='mr-[10px]'>
                      <MessageSquare className="h-5 w-5" />
                    </span>
                    Start Chat
                  </DarkButtonWithIcon>
                </div>
              )}

              {/* Chat Panel */}
              {showChatPanel && (
                <>
                  <div
                    className="border-l-2 border-border bg-card flex flex-col shadow-lg"
                    style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: chatWidth, zIndex: 10 }}
                  >
                    {/* Chat Header */}
                    <div className="px-4 py-3 border-b border-border bg-muted/70 flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary">
                          <MessageSquare className="h-4 w-4 text-primary-foreground" />
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold">AI Chat</h3>
                          <p className="text-xs text-muted-foreground">Reference answers while you work</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="hidden sm:inline text-[11px] text-muted-foreground bg-muted px-2 py-1 rounded">
                          {Math.round(chatWidth)}px
                        </span>
                        <button
                          onClick={() => setShowChatPanel(false)}
                          className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-8 w-8"
                          aria-label="Close chat"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    {/* Chat Content */}
                    <div className="flex-1 min-h-[240px]">
                      <LobeChat onRequireApiKey={() => setShowSettings(true)} showHeader={false} />
                    </div>
                  </div>

                  {/* Resize Handle */}
                  <div
                    className="bg-gradient-to-b from-primary/30 to-primary/10 hover:bg-gradient-to-b hover:from-primary/70 hover:to-primary/50 cursor-col-resize transition-all border-l border-primary/30 hover:border-primary/70 group"
                    style={{ position: 'absolute', right: chatWidth, top: 0, bottom: 0, width: '6px', zIndex: 11 }}
                    onMouseDown={(e) => handleMouseDown('chat', e)}
                    title="Drag to resize chat panel"
                  >
                    <div className="h-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="text-primary/70 text-xs font-semibold">⋮⋮</div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-lg p-6 max-w-md w-full mx-4 shadow-lg">
            <h2 className="text-lg font-semibold mb-4">Settings</h2>
            <div className="space-y-4">
              <div className="bg-emerald-500/10 border border-emerald-500/30 p-3 rounded-md text-sm text-emerald-200">
                <p className="font-semibold mb-1">🔒 Gemini API Key Managed Centrally</p>
                <p>
                  Billing is configured on the shared Google Cloud project. The Gemini API key is loaded automatically
                  from Firestore for every user, so you don&apos;t need to enter anything here.
                </p>
                {apiKey ? (
                  <p className="text-xs mt-2 text-emerald-100">
                    Current shared key is active from the secure Firestore collection.
                  </p>
                ) : (
                  <p className="text-xs mt-2 text-emerald-100">Loading shared key from Firestore…</p>
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                <p>
                  If you need to rotate the shared key, update the `apikey` collection in Firebase Firestore. All users
                  will receive the new key automatically on next load.
                </p>
              </div>
              <div className="flex justify-end">
                <button
                  onClick={handleSaveSettings}
                  className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Profile Update Modal */}
      {showProfileUpdate && user && (
        <ProfileUpdate
          userProfile={user}
          onClose={handleCloseProfileUpdate}
          onUpdate={handleProfileUpdate}
        />
      )}

      {/* Calculator Modal */}
      <Calculator
        isOpen={showCalculator}
        onClose={handleCloseCalculator}
      />

      {/* Molecular Viewer Modal */}
      <MolecularViewer
        isOpen={showMolView}
        onClose={handleCloseMolView}
      />

      {/* Periodic Table Modal */}
      <PeriodicTable
        isOpen={showPeriodicTable}
        onClose={handleClosePeriodicTable}
      />

      {/* Chemistry Widget Panel */}
      {showChemistryPanel && !showNmrFullscreen && !showSrlCoachWorkspace && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-3xl max-h-[90vh] overflow-hidden">
            <ChemistryWidgetPanel
              onClose={() => setShowChemistryPanel(false)}
              startFullscreen
            />
          </div>
        </div>
      )}

      {/* Adaptive Learning Plan */}
      {showAdaptivePlan && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="w-full max-w-6xl h-[90vh] mx-4">
            <AdaptivePlan
              onClose={() => setShowAdaptivePlan(false)}
              initialTopic={sources.length > 0 ? sources.map(s => s.title).join(', ') : ''}
            />
          </div>
        </div>
      )}

      {/* Message Dock - Always visible */}
      <MessageDock
        characters={dockCharacters}
        onMessageSend={(message, character, index) => {
          console.log('Message:', message, 'to', character.name);
        }}
        onCharacterSelect={(character) => {
          console.log('Selected:', character.name);
        }}
        isLiveActive={geminiLiveState.connectionState === ConnectionState.CONNECTED}
        onSparkleClick={() => {
          if (geminiLiveState.connectionState === ConnectionState.CONNECTED || geminiLiveState.connectionState === ConnectionState.CONNECTING) {
            geminiLiveState.disconnect();
          } else {
            geminiLiveState.connect();
          }
        }}
        onShareCanvas={() => geminiLiveState.captureAndSendSnapshot()}
        showShareCanvas={!showNmrFullscreen && !showSrlCoachWorkspace && !showGeminiLiveWorkspace && !showDocumentEditorCanvas}
        expandedWidth={500}
        placeholder={(name) => `Send a message to ${name}...`}
        theme="light"
      />
      {/* Gemini Live Overlay */}
      <GeminiLiveOverlay
        geminiLiveState={geminiLiveState}
        activeWorkspaceId={activeWorkspaceId}
        onExpandImage={handleCanvasImageExpand}
      />

      {/* Image Lightbox */}
      <GeminiLiveImageLightbox image={expandedImage} onClose={handleCloseLightbox} />

      {/* AI Word */}
      {showAIWord && (
        <AIWord
          onClose={() => {
            setShowAIWord(false);
            endCurrentFeature();
          }}
        />
      )}

      {/* AI Sheet */}
      {showAISheet && (
        <AISheet
          onClose={() => {
            setShowAISheet(false);
            endCurrentFeature();
          }}
        />
      )}

      {/* Toast Container */}
      <ToastContainer
        position="top-right"
        autoClose={5000}
        limit={5}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
        transition={Bounce}
      />
    </div>
  );
};

export default App;
