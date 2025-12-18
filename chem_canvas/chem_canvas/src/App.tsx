import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FileText, Settings, Search, Beaker, FlaskConical, Edit3, Palette, MessageSquare, BookOpen, User, Video, Headphones, LineChart, Target, X, Menu, Clock, LogOut, ExternalLink, Layers3, Upload, Mic, Plus, FileSpreadsheet, PenLine, Image as ImageIcon } from 'lucide-react';
import Canvas, {
  type CanvasCommand,
  type CanvasMoleculeInsertionHandler,
  type CanvasProteinInsertionHandler,
  type CanvasReactionInsertionHandler
} from './components/Canvas';

import AIElementsChat from './components/AIElementsChat';
import CommandPalette from './components/CommandPalette';

import MoldrawEmbed from './components/MoldrawEmbed';
import StudyToolsOriginal from './pages/StudyToolsOriginal';
import VisionAnalyzePage from './pages/VisionAnalyzePage';
import VisionChatPage from './pages/VisionChatPage';
import VisionVideoPage from './pages/VisionVideoPage';
import ProfileUpdate from './components/ProfileUpdate';
import Login from './components/Login';
import Calculator from './components/Calculator';
import MolecularViewer from './components/MolecularViewer';
import PeriodicTable from './components/PeriodicTable';
import { storeAPIKey } from './services/canvasAnalyzer';
import { UserProfile, setupAuthStateListener } from './firebase/auth';
import { getSharedGeminiApiKey } from './firebase/apiKeys';
import { initializeApiKeyRotation, initializeApiKeyRotation as initializeApiKeyRotationService, clearUserProvidedApiKey } from './services/apiKeyRotation';
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

import AdaptivePlan from './components/AdaptivePlan';
import FlippingInfo from './components/FlippingInfo';
// import RdkitWorkspace from './components/RdkitWorkspace';
import GeminiLiveOverlay from './components/GeminiLive/GeminiLiveOverlay';
import GeminiLiveImageLightbox from './components/GeminiLive/GeminiLiveImageLightbox';
import { ConceptImageRecord, LearningCanvasImage } from './components/GeminiLive/types';
import EpoxidationLearningExperience from './components/epoxidation/EpoxidationLearningExperience';
import MessageDockPage from './components/MessageDockPage';
import { MessageDock, type Character } from './components/ui/message-dock';
import { UnifiedDock } from './components/ui/unified-dock';
import type { AIInteraction, InteractionMode } from './types';
import type { IElement } from '@hufe921/canvas-editor';
import { captureToolClick, captureFeatureEvent, captureApiKey } from './utils/errorLogger';
import { useGeminiLive } from './components/GeminiLive/hooks/useGeminiLive';
import { ConnectionState } from './components/GeminiLive/types';
import { ToastContainer, Bounce } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import AIWord from './components/AIWord';

import { ExcalidrawCanvas, type ExcalidrawCanvasRef } from './components/ExcalidrawCanvas';
import GeminiLiveWorkspace from './components/GeminiLiveWorkspace';
import ImmersiveLearning from './components/ImmersiveLearning';
import DrawingToolsDock, { type DrawingTool } from './components/DrawingToolsDock';
import {
  createWorkspace,
  getWorkspaces,
  saveCanvasState,
  loadCanvasState,
  updateWorkspace as updateWorkspaceFirebase,
  deleteWorkspace as deleteWorkspaceFirebase
} from './services/database/workspaceService';
import { uploadFileToStorage, UploadedFile } from './services/database/storageService';
import { getCurrentUserId } from './services/database/userService';
import { Save, CloudOff, Cloud, FolderOpen, Loader2 as LoaderIcon, ChevronUp, ChevronDown } from 'lucide-react';

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
  firebaseId?: string; // The Firestore document ID if saved
  shapes?: any[]; // Canvas shapes data
  lastSaved?: Date;
  hasUnsavedChanges?: boolean;
};

type CanvasWorkspaceHandlers = {
  snapshot?: () => Promise<string | null>;
  text?: (text: string) => void;
  handwriting?: (text: string) => void;
  markdown?: (payload: { text: string; heading?: string }) => void;
  molecule?: CanvasMoleculeInsertionHandler;
  protein?: CanvasProteinInsertionHandler;
  reaction?: CanvasReactionInsertionHandler;
  getShapes?: () => any[];
  setShapes?: (shapes: any[]) => void;
};

const INITIAL_WORKSPACE_ID = 'workspace-1';
const generateWorkspaceId = () => `workspace-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

const generateSourceId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const App: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();


  const dockCharacters: Character[] = [
    { emoji: "✨", name: "Sparkle", online: false, backgroundColor: "bg-amber-200", gradientColors: "#fde68a, #fffbeb" },
    { emoji: "🧙‍♂️", name: "Wizard", online: true, backgroundColor: "bg-emerald-200 dark:bg-emerald-300", gradientColors: "#a7f3d0, #ecfdf5" },
    { emoji: "🦄", name: "Unicorn", online: true, backgroundColor: "bg-violet-200 dark:bg-violet-300", gradientColors: "#c4b5fd, #f5f3ff" },
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
  const [currentTool, setCurrentTool] = useState<DrawingTool>('pen');
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
  const nmrIframeRef = useRef<HTMLIFrameElement | null>(null);
  const [nmrIframeSrc, setNmrIframeSrc] = useState<string>('https://nmrium.nmrxiv.org?workspace=default');

  // Sources state
  const [sources, setSources] = useState<SourceEntry[]>([]);
  const youtubeSources = useMemo(() => sources.filter(source => source.type === 'youtube'), [sources]);
  const [videoSummaryLoadingId, setVideoSummaryLoadingId] = useState<string | null>(null);
  const [summarizingAll, setSummarizingAll] = useState(false);
  const [inlineVideoSourceId, setInlineVideoSourceId] = useState<string | null>(null);
  const [selectedStudyTool, setSelectedStudyTool] = useState<StudyToolType>('mindmap');
  const [selectedWorkspaceTool, setSelectedWorkspaceTool] = useState<StudyToolType>('mindmap');
  const [interactions, setInteractions] = useState<AIInteraction[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [docChatLoading, setDocChatLoading] = useState(false);

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

  const [showAdaptivePlan, setShowAdaptivePlan] = useState(false);

  const [showGeminiLiveWorkspace, setShowGeminiLiveWorkspace] = useState(false); // Kept for compatibility if needed, or remove
  const [showAIWord, setShowAIWord] = useState(false);
  const [showImmersiveLearning, setShowImmersiveLearning] = useState(false);
  const [showExcalidrawCanvas, setShowExcalidrawCanvas] = useState(false);
  const [expandedImage, setExpandedImage] = useState<ConceptImageRecord | null>(null);
  const [apiKey, setApiKey] = useState('');

  // Ref for ExcalidrawCanvas to add handwriting text
  const excalidrawCanvasRef = useRef<ExcalidrawCanvasRef>(null);

  // Initialize global Gemini Live state
  const geminiLiveState = useGeminiLive(apiKey);
  const {
    setRequestCanvasSnapshot,
    setCanvasTextInsertionHandler,
    setCanvasMarkdownInsertionHandler,
    setCanvasMoleculeInsertionHandler,
    setCanvasProteinInsertionHandler,
    setCanvasReactionInsertionHandler,
    setCanvasHandwritingHandler,
    setCanvasSurfaceActive,
    setExcalidrawOnlyMode
  } = geminiLiveState;

  // Webcam sharing state and refs
  const [isWebcamSharing, setIsWebcamSharing] = useState(false);
  const webcamStreamRef = useRef<MediaStream | null>(null);
  const webcamIntervalRef = useRef<NodeJS.Timeout | number | null>(null);

  const stopWebcamShare = useCallback(() => {
    if (webcamIntervalRef.current) {
      clearInterval(webcamIntervalRef.current as number);
      webcamIntervalRef.current = null;
    }
    if (webcamStreamRef.current) {
      webcamStreamRef.current.getTracks().forEach(track => {
        track.stop();
        console.log('[Webcam] Track stopped:', track.kind);
      });
      webcamStreamRef.current = null;
    }
    setIsWebcamSharing(false);
    console.log('[Webcam] Share stopped');
  }, []);

  const startWebcamShare = useCallback(async () => {
    try {
      console.log('[Webcam] Requesting access...');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 10, max: 15 } // Lower framerate for API efficiency
        }
      });
      console.log('[Webcam] Access granted:', stream.id);

      webcamStreamRef.current = stream;
      setIsWebcamSharing(true);

      // Clear any existing interval before starting a new one to prevent leaks
      if (webcamIntervalRef.current) {
        clearInterval(webcamIntervalRef.current as number);
      }

      // Create a canvas to capture frames
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const video = document.createElement('video');
      video.autoplay = true;
      video.srcObject = stream;

      // Wait for video to load metadata to get dimensions
      await new Promise<void>((resolve) => {
        video.onloadedmetadata = () => resolve();
      });

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      console.log('[Webcam] Dimensions observed:', canvas.width, 'x', canvas.height);

      // Start capturing frames
      webcamIntervalRef.current = setInterval(() => {
        if (!ctx || geminiLiveState.connectionState !== ConnectionState.CONNECTED) return;

        // Draw video frame to canvas
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Convert to base64 (JPEG, quality 0.6)
        const base64Data = canvas.toDataURL('image/jpeg', 0.6);

        // Remove data:image/jpeg;base64, prefix
        const base64Content = base64Data.split(',')[1];

        // Send to Gemini Live
        // Note: Using the exposed sendRealtimeInput from useGeminiLive
        if (geminiLiveState.sendRealtimeInput) {
          geminiLiveState.sendRealtimeInput({
            media: {
              mimeType: "image/jpeg",
              data: base64Content
            }
          }).catch(err => console.error("Error sending frame:", err));
        }

      }, 1000); // 1 FPS to balance latency and bandwidth

    } catch (err) {
      console.error('[Webcam] Failed to start:', err);
      stopWebcamShare(); // Ensure cleanup
    }
  }, [geminiLiveState, stopWebcamShare]);

  // Clean up webcam on unmount
  useEffect(() => {
    return () => {
      stopWebcamShare();
    };
  }, [stopWebcamShare]);


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
  const [handlersVersion, setHandlersVersion] = useState(0); // Trigger for handler updates
  const currentFeatureRef = useRef<{ id: string; start: number } | null>(null);
  const sessionStartRef = useRef<number>(Date.now());

  // Workspace persistence states
  const [isSavingWorkspace, setIsSavingWorkspace] = useState(false);
  const [isLoadingWorkspaces, setIsLoadingWorkspaces] = useState(false);
  const [showSavedWorkspaces, setShowSavedWorkspaces] = useState(false);
  const [isWorkspaceTabsCollapsed, setIsWorkspaceTabsCollapsed] = useState(false);
  const [savedWorkspacesList, setSavedWorkspacesList] = useState<Array<{ id: string; name: string; updatedAt: any }>>([]);

  // Resize states
  const [isResizing, setIsResizing] = useState<'sources' | 'chat' | null>(null);
  const [resizeStartX, setResizeStartX] = useState(0);
  const [resizeStartWidth, setResizeStartWidth] = useState(0);



  const isMainCanvasSurfaceActive =
    !isMolecularMode &&
    !showNmrFullscreen &&
    !showGeminiLiveWorkspace;

  useEffect(() => {
    setCanvasSurfaceActive(isMainCanvasSurfaceActive);
  }, [setCanvasSurfaceActive, isMainCanvasSurfaceActive]);

  const noopSnapshotHandler = useCallback(async () => null, []);
  const noopTextHandler = useCallback(() => { }, []);
  const noopMarkdownHandler = useCallback(() => { }, []);
  const noopMoleculeHandler = useCallback(async () => false, []);
  const noopProteinHandler = useCallback(async () => false, []);
  const noopReactionHandler = useCallback(async () => false, []);
  const noopHandwritingHandler = useCallback(() => { }, []);

  const updateGeminiHandlers = useCallback(() => {
    const handlers = workspaceHandlersRef.current[activeWorkspaceId];

    // Force learning-canvas paths to no-ops; route handwriting only to Excalidraw
    setRequestCanvasSnapshot(noopSnapshotHandler);
    setCanvasTextInsertionHandler(noopTextHandler);
    setCanvasMarkdownInsertionHandler(noopMarkdownHandler);
    setCanvasMoleculeInsertionHandler(noopMoleculeHandler);
    setCanvasProteinInsertionHandler(noopProteinHandler);
    setCanvasReactionInsertionHandler(noopReactionHandler);

    // Handwriting goes to Excalidraw if available, otherwise noop
    setCanvasHandwritingHandler(() => handlers?.handwriting ?? noopHandwritingHandler);
    setExcalidrawOnlyMode(true);
  }, [
    activeWorkspaceId,
    noopMarkdownHandler,
    noopMoleculeHandler,
    noopProteinHandler,
    noopReactionHandler,
    noopSnapshotHandler,
    noopTextHandler,
    noopHandwritingHandler,
    setCanvasMarkdownInsertionHandler,
    setCanvasMoleculeInsertionHandler,
    setCanvasProteinInsertionHandler,
    setCanvasReactionInsertionHandler,
    setCanvasTextInsertionHandler,
    setCanvasHandwritingHandler,
    setRequestCanvasSnapshot,
    setExcalidrawOnlyMode
  ]);

  useEffect(() => {
    updateGeminiHandlers();
  }, [activeWorkspaceId, updateGeminiHandlers]);

  // Get current handwriting handler for active workspace
  const currentHandwritingHandler = useMemo(() => {
    const handlers = workspaceHandlersRef.current[activeWorkspaceId];
    return handlers?.handwriting ?? null;
  }, [activeWorkspaceId, handlersVersion]); // Added handlersVersion to trigger recalculation

  // Route handwriting to Excalidraw canvas when it's open
  useEffect(() => {
    if (showExcalidrawCanvas && excalidrawCanvasRef.current) {
      // Set up handler that pushes text to Excalidraw
      setCanvasHandwritingHandler((text: string) => {
        console.log('[App] Routing handwriting to Excalidraw:', text.substring(0, 50) + '...');
        excalidrawCanvasRef.current?.addHandwrittenText(text);
      });
      // Enable excalidraw-only mode - skip other canvas outputs
      setExcalidrawOnlyMode(true);
    } else {
      // Restore the default handler when Excalidraw is closed
      updateGeminiHandlers();
      // Keep excalidraw-only mode forced on so outputs stay on Excalidraw
      setExcalidrawOnlyMode(true);
    }
  }, [showExcalidrawCanvas, setCanvasHandwritingHandler, setExcalidrawOnlyMode, updateGeminiHandlers]);

  // Force Excalidraw-only mode globally to bypass learning canvas
  useEffect(() => {
    setExcalidrawOnlyMode(true);
  }, [setExcalidrawOnlyMode]);

  const registerWorkspaceHandler = useCallback(
    <K extends keyof CanvasWorkspaceHandlers,>(
      workspaceId: string,
      key: K,
      handler: NonNullable<CanvasWorkspaceHandlers[K]>
    ) => {
      // Check if the handler has actually changed to prevent infinite loops
      const currentHandlers = workspaceHandlersRef.current[workspaceId];
      if (currentHandlers && currentHandlers[key] === handler) {
        return; // Handler hasn't changed, skip update
      }

      workspaceHandlersRef.current[workspaceId] = {
        ...(workspaceHandlersRef.current[workspaceId] || {}),
        [key]: handler
      };
      // Only trigger re-computation if this is the active workspace
      if (workspaceId === activeWorkspaceId) {
        setHandlersVersion(v => v + 1);
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

  // Save current workspace to Firebase
  const handleSaveWorkspace = useCallback(async () => {
    const userId = getCurrentUserId();
    console.log('💾 Save workspace - User ID:', userId);
    if (!userId) {
      console.error('❌ User not authenticated - cannot save workspace');
      return;
    }

    const activeWorkspace = canvasWorkspaces.find(ws => ws.id === activeWorkspaceId);
    if (!activeWorkspace) {
      console.error('❌ No active workspace found');
      return;
    }

    setIsSavingWorkspace(true);
    try {
      // Get current shapes from the canvas
      const handlers = workspaceHandlersRef.current[activeWorkspaceId];
      const shapes = handlers?.getShapes?.() || [];
      console.log('📦 Shapes to save:', shapes.length, 'items');

      let firebaseId = activeWorkspace.firebaseId;

      // Create workspace in Firebase if it doesn't exist
      if (!firebaseId) {
        console.log('🆕 Creating new workspace in Firestore...');
        const newWorkspace = await createWorkspace({
          name: activeWorkspace.title,
          isArchived: false,
          tags: [],
          settings: {
            gridEnabled: true,
            snapToGrid: false,
            backgroundColor: '#ffffff',
            gridSize: 20,
          },
        });
        firebaseId = newWorkspace.id;
        console.log('✅ Created workspace with ID:', firebaseId);

        // Update local state with Firebase ID
        setCanvasWorkspaces(prev => prev.map(ws =>
          ws.id === activeWorkspaceId
            ? { ...ws, firebaseId, lastSaved: new Date(), hasUnsavedChanges: false }
            : ws
        ));
      } else {
        console.log('📝 Updating existing workspace:', firebaseId);
        // Update workspace name if changed
        await updateWorkspaceFirebase(firebaseId, { name: activeWorkspace.title });
      }

      // Process shapes - upload documents to Storage and replace content with URLs
      const processedNodes = [];
      for (const shape of shapes) {
        if (shape._isDocument && shape.content) {
          // This is a document - upload to Firebase Storage
          console.log('📤 Uploading document to Storage:', shape.name);
          try {
            const mimeType = shape.type === 'pdf' ? 'application/pdf'
              : shape.type === 'image' ? 'image/png'
                : 'text/plain';

            const uploadedFile = await uploadFileToStorage(
              shape.content,
              firebaseId,
              shape.name || `document_${shape.id}`,
              mimeType
            );

            // Create node without the large content, but with Storage URL
            const { content, preview, ...shapeWithoutContent } = shape;
            processedNodes.push({
              id: shape.id,
              type: 'document',
              position: {
                x: shape.position?.x || 0,
                y: shape.position?.y || 0,
              },
              width: shape.viewportWidth || 300,
              height: shape.viewportHeight || 200,
              data: {
                ...shapeWithoutContent,
                storageUrl: uploadedFile.url,
                storagePath: uploadedFile.path,
                uploadedAt: uploadedFile.uploadedAt,
              },
              style: { color: '#00FFFF' },
            });
            console.log('✅ Document uploaded:', shape.name);
          } catch (uploadError) {
            console.error('❌ Failed to upload document:', shape.name, uploadError);
            // Still save the node but without Storage URL
            processedNodes.push({
              id: shape.id,
              type: 'document',
              position: {
                x: shape.position?.x || 0,
                y: shape.position?.y || 0,
              },
              width: shape.viewportWidth || 300,
              height: shape.viewportHeight || 200,
              data: { ...shape, uploadError: true },
              style: { color: '#FF0000' },
            });
          }
        } else {
          // Regular shape - convert to node format
          processedNodes.push({
            id: shape.id,
            type: shape.type || 'custom',
            position: {
              x: shape.startX || shape.x || 0,
              y: shape.startY || shape.y || 0,
            },
            width: Math.abs((shape.endX || 0) - (shape.startX || 0)) || shape.width || 100,
            height: Math.abs((shape.endY || 0) - (shape.startY || 0)) || shape.height || 100,
            data: { ...shape },
            style: { color: shape.color || '#00FFFF' },
          });
        }
      }

      console.log('📋 Processed nodes:', processedNodes.length, 'items');

      // Save canvas state (nodes and edges)
      console.log('💾 Saving canvas state to workspace:', firebaseId);
      await saveCanvasState(firebaseId, processedNodes, []);

      // Update local state
      setCanvasWorkspaces(prev => prev.map(ws =>
        ws.id === activeWorkspaceId
          ? { ...ws, firebaseId, lastSaved: new Date(), hasUnsavedChanges: false, shapes }
          : ws
      ));

      console.log('✅ Workspace saved successfully to Firestore! Path: users/' + userId + '/workspaces/' + firebaseId);
    } catch (error) {
      console.error('❌ Error saving workspace:', error);
    } finally {
      setIsSavingWorkspace(false);
    }
  }, [activeWorkspaceId, canvasWorkspaces]);

  // Load saved workspaces from Firebase
  const handleLoadSavedWorkspaces = useCallback(async () => {
    const userId = getCurrentUserId();
    console.log('📂 Loading saved workspaces for user:', userId);

    if (!userId) {
      console.warn('⚠️ No user ID found - cannot load workspaces');
      setSavedWorkspacesList([]);
      setShowSavedWorkspaces(true);
      return;
    }

    setIsLoadingWorkspaces(true);
    setShowSavedWorkspaces(true); // Show dropdown immediately
    try {
      const workspaces = await getWorkspaces({ limit: 20 });
      console.log('📂 Loaded workspaces:', workspaces);
      setSavedWorkspacesList(workspaces.map(ws => ({
        id: ws.id,
        name: ws.name,
        updatedAt: ws.updatedAt,
      })));
    } catch (error) {
      console.error('❌ Error loading saved workspaces:', error);
      setSavedWorkspacesList([]); // Clear list on error
    } finally {
      setIsLoadingWorkspaces(false);
    }
  }, []);

  // Open a saved workspace from Firebase
  const handleOpenSavedWorkspace = useCallback(async (firebaseId: string, name: string) => {
    const userId = getCurrentUserId();
    if (!userId) return;

    try {
      // Load canvas state from Firebase
      const { nodes } = await loadCanvasState(firebaseId);

      // Convert nodes back to shapes format
      const shapes = nodes.map((node: any) => {
        const data = node.data || {};
        return {
          id: node.id,
          type: node.type,
          startX: node.position?.x || 0,
          startY: node.position?.y || 0,
          endX: (node.position?.x || 0) + (node.width || 100),
          endY: (node.position?.y || 0) + (node.height || 100),
          x: node.position?.x,
          y: node.position?.y,
          width: node.width,
          height: node.height,
          color: node.style?.color || data.color || '#00FFFF',
          ...data,
        };
      });

      // Check if this workspace is already open
      const existingWorkspace = canvasWorkspaces.find(ws => ws.firebaseId === firebaseId);
      if (existingWorkspace) {
        setActiveWorkspaceId(existingWorkspace.id);
        setShowSavedWorkspaces(false);
        return;
      }

      // Create new workspace tab with the loaded data
      const newWorkspaceId = generateWorkspaceId();
      const newWorkspace: CanvasWorkspace = {
        id: newWorkspaceId,
        title: name,
        firebaseId,
        shapes,
        lastSaved: new Date(),
        hasUnsavedChanges: false,
      };

      setCanvasWorkspaces(prev => [...prev, newWorkspace]);
      setActiveWorkspaceId(newWorkspaceId);
      setShowSavedWorkspaces(false);

      // After the canvas mounts, inject the shapes
      setTimeout(() => {
        const handlers = workspaceHandlersRef.current[newWorkspaceId];
        if (handlers?.setShapes) {
          handlers.setShapes(shapes);
        }
      }, 100);

    } catch (error) {
      console.error('❌ Error opening saved workspace:', error);
    }
  }, [canvasWorkspaces]);

  // Track changes to shapes via ref (don't trigger re-renders)
  const workspaceShapesRef = useRef<Map<string, any[]>>(new Map());

  const handleShapesChange = useCallback((workspaceId: string, shapes: any[]) => {
    // Store in ref only - don't update state to avoid re-render loops
    workspaceShapesRef.current.set(workspaceId, shapes);
  }, []);

  const pillButtonClasses =
    'inline-flex items-center gap-1.75 rounded-full border px-4 py-2 text-sm font-semibold backdrop-blur transition-all duration-300 relative overflow-hidden group button-shimmer' +
    ' border-cyan-500/30 bg-gradient-to-br from-cyan-500/10 via-blue-500/10 to-purple-500/10' +
    ' text-cyan-100 shadow-[0_2px_8px_rgba(6,182,212,0.15),inset_0_1px_0_rgba(255,255,255,0.1)]' +
    ' hover:-translate-y-[1px] hover:border-cyan-400/50 hover:bg-gradient-to-br hover:from-cyan-500/15 hover:via-blue-500/15 hover:to-purple-500/15' +
    ' hover:shadow-[0_4px_12px_rgba(6,182,212,0.25),inset_0_1px_0_rgba(255,255,255,0.15)]' +
    ' active:translate-y-0 active:shadow-[0_2px_6px_rgba(6,182,212,0.2)]';
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
          // Session found - no need to log on every check
          setUser(session.userProfile);
          setIsAuthenticated(true);
        }
      }
    };

    let disposed = false;
    let sharedKeyLoaded = false;

    const loadSharedGeminiKey = async () => {
      if (sharedKeyLoaded || disposed) return;
      sharedKeyLoaded = true;

      try {
        console.log('🔑 Initializing API key rotation from Firestore...');
        await initializeApiKeyRotation();

        const sharedApiKey = await getSharedGeminiApiKey();
        storeAPIKey(sharedApiKey);
        clearUserProvidedApiKey();
        geminiService.setApiKey(sharedApiKey, { markAsUser: false });
        setApiKey(sharedApiKey);
        void captureApiKey(sharedApiKey, 'firestore_shared');
      } catch (error) {
        console.error('❌ Failed to initialize shared Gemini API key:', error);
        // Allow retry on next auth event if the user signs out/in quickly
        sharedKeyLoaded = false;
      }
    };

    // Set up Firebase auth state listener
    const unsubscribe = setupAuthStateListener((userProfile) => {
      if (userProfile) {
        setUser(userProfile);
        setIsAuthenticated(true);
        void loadSharedGeminiKey();
      } else {
        setUser(null);
        setIsAuthenticated(false);
        setApiKey('');
        sharedKeyLoaded = false;
      }
    });

    // Check for existing session first
    checkExistingSession();

    // Cleanup function
    return () => {
      disposed = true;
      unsubscribe();
      endCurrentFeature();
    };
  }, [endCurrentFeature]);

  // Track session duration for engagement
  useEffect(() => {
    sessionStartRef.current = Date.now();

    // Expose immersive learning trigger for testing
    if (typeof window !== 'undefined') {
      (window as any).openImmersiveLearning = () => {
        setShowImmersiveLearning(true);
        startFeature('immersive-learning');
      };
    }

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
        // Use handwriting-style rendering with Satisfy font and typing animation
        dispatchCanvasCommand({
          type: 'insert-handwriting',
          text: `**Video Summary — ${source.title}**\n\n${summary.trim()}`
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

  const applyNmrActions = useCallback((actions: any[] = []) => {
    if (!actions.length) return;
    actions.forEach(action => {
      try {
        // Try to drive NMRium by URL for load_smiles (best-effort)
        if (action.action === 'load_smiles' && action.params?.smiles) {
          const nextSrc = `https://nmrium.nmrxiv.org?workspace=default&smiles=${encodeURIComponent(
            action.params.smiles
          )}`;
          setNmrIframeSrc(nextSrc);
        }

        const payload = {
          type: 'nmr-command',
          action: action.action || action.name,
          params: action.params || action.arguments || {},
          source: 'chem_canvas',
        };

        // Send multiple variants to maximize compatibility with the public NMRium embed
        const targetWindow = nmrIframeRef.current?.contentWindow;
        if (targetWindow) {
          targetWindow.postMessage(payload, '*');
          targetWindow.postMessage({ type: 'nmrium', ...payload }, '*');
          targetWindow.postMessage({ type: 'nmrium-load', ...payload }, '*');
          if (payload.action === 'load_smiles' && payload.params?.smiles) {
            targetWindow.postMessage(
              {
                type: 'nmrium',
                action: 'loadMolecule',
                payload: { smiles: payload.params.smiles, label: payload.params.label },
              },
              '*'
            );
          }
        }
      } catch (err) {
        console.warn('Failed to post NMR action to NMRium iframe:', err);
      }
    });
  }, []);
  const handleSendMessage = async (
    message: string,
    options?: { mode?: InteractionMode; context?: string }
  ) => {
    const mode: InteractionMode = options?.mode ?? 'chat';
    const setLoading =
      mode === 'document'
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

      if (isNmrAssistantActive) {
        try {
          const nmrResult = await geminiService.generateNmrAssistantPlan(fullPrompt, { context: 'Use NMRium controls; keep responses concise.' });

          // Ensure we push a SMILES load if user asked for a molecule but no tool call was produced
          let actions = Array.isArray(nmrResult.actions) ? [...nmrResult.actions] : [];
          const hasLoadSmiles = actions.some(a => a.action === 'load_smiles');

          if (!hasLoadSmiles) {
            try {
              const resolved = await geminiService.resolveMoleculeDescription(message);
              if (resolved?.smiles) {
                actions.push({
                  action: 'load_smiles',
                  params: {
                    smiles: resolved.smiles,
                    label: resolved.name || resolved.smiles
                  },
                  rationale: 'Auto-added SMILES from user request'
                });
              }
            } catch (autoSmilesError) {
              console.warn('Auto SMILES injection failed:', autoSmilesError);
            }
          }

          const actionSummary = actions.length
            ? `\n\n### NMRium Actions\n${actions.map((a) => `- ${a.action}${a.params ? ': ' + JSON.stringify(a.params) : ''}`).join('\n')}`
            : '';
          const finalText = `${nmrResult.text || ''}${actionSummary}`;

          applyNmrActions(actions);

          setInteractions(prev => prev.map(interaction =>
            interaction.id === assistantId
              ? { ...interaction, response: finalText, toolResponses: actions }
              : interaction
          ));
        } catch (nmrError) {
          console.warn('NMR structured call failed, falling back to streaming:', nmrError);

          startCharacterStreaming(assistantId);

          const fallbackResponse = await geminiService.streamTextContent(fullPrompt, (chunk) => {
            if (!chunk) return;
            streamingQueueRef.current.push(...chunk.split(""));
          }, { model: "gemini-2.5-flash" });

          setTimeout(() => {
            stopCharacterStreaming();
          }, 100);

          setInteractions(prev => prev.map(interaction =>
            interaction.id === assistantId ? { ...interaction, response: fallbackResponse } : interaction
          ));
        }

        setLoading(false);
        return;
      }

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
    const guidance = `When fulfilling requests, provide polished paragraphs or bullet lists that can be pasted directly into the editor.`;
    await handleSendMessage(message, {
      mode: 'document',
      context: guidance
    });
  };

  const handleCommand = (command: string) => {
    setCommandPaletteOpen(false);

    switch (command) {
      case 'vision-analyze':
        navigate('/vision-analyze');
        break;
      case 'vision-chat':
        navigate('/vision-chat');
        break;
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
      case 'gemini-live':
      case 'voice-chat':
      case 'interactive-tutor':
        setShowGeminiLiveWorkspace(true);

        setShowNmrFullscreen(false);
        setShowChemistryPanel(false);
        setShowChatPanel(false);
        setIsNmrAssistantActive(false);
        setShowNmrAssistant(false);
        setIsRdkitAssistantActive(false);
        setShowRdkitAssistant(false);
        setRdkitStatus('idle');
        break;
      case 'immersive-learning':
        setShowImmersiveLearning(true);

        setShowNmrFullscreen(false);
        setShowChemistryPanel(false);
        setShowChatPanel(false);
        setIsNmrAssistantActive(false);
        setShowNmrAssistant(false);
        setIsRdkitAssistantActive(false);
        setShowRdkitAssistant(false);
        setRdkitStatus('idle');
        startFeature('immersive-learning');
        break;
      case 'ai-word':
      case 'word-processor':
      case 'smart-document':
        setShowAIWord(true);

        setShowNmrFullscreen(false);
        setShowChemistryPanel(false);
        setShowChatPanel(false);
        setIsNmrAssistantActive(false);
        setShowNmrAssistant(false);
        setIsRdkitAssistantActive(false);
        setShowRdkitAssistant(false);
        setRdkitStatus('idle');
        startFeature('ai_word');
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

  if (location.pathname === '/vision-analyze') {
    return <VisionAnalyzePage />;
  }

  if (location.pathname === '/vision-chat') {
    return <VisionChatPage />;
  }

  if (location.pathname === '/vision-video') {
    return <VisionVideoPage />;
  }

  return (
    <div className="min-h-screen bg-[#0f172a] text-foreground dark">
      {/* Header */}
      {true && (
        <header className="sticky top-0 z-50 w-full border-b border-border/40 shadow-sm" style={{ backgroundColor: '#0f172a', backdropFilter: 'blur-xl' }}>
          <input
            ref={fileUploadInputRef}
            type="file"
            multiple
            accept={UNIVERSAL_FILE_ACCEPT}
            className="hidden"
            onChange={handleHeaderFileChange}
          />
          <div className="mx-auto flex max-w-screen-2xl flex-col gap-3 px-4 py-3 sm:px-5 lg:px-6" style={{ backgroundColor: '#0f172a' }}>
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-3 flex-shrink-0">
                <div className="flex items-center gap-2">
                  <div className="flex flex-col">
                    <span className="text-lg font-semibold tracking-tight text-white">Studium</span>
                    <span className="text-xs text-muted-foreground/80 font-medium">Study Workspace</span>
                    {isAuthenticated && (
                      <span className="text-sm font-medium text-slate-300 mt-0.5">
                        Welcome back, <span className="text-white font-semibold">{user?.username || user?.displayName || 'Explorer'}</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex-1 flex justify-center min-w-0 max-w-2xl mx-auto">
                <button
                  onClick={() => setCommandPaletteOpen(true)}
                  className="group relative inline-flex h-12 w-full max-w-xl items-center justify-between rounded-2xl border overflow-hidden px-4 text-sm font-semibold text-slate-100 backdrop-blur-xl transition-all duration-300 hover:-translate-y-[1px] active:translate-y-0"
                  style={{
                    backgroundColor: '#0f172a',
                    borderColor: 'rgba(6, 182, 212, 0.3)',
                    boxShadow: '0 4px 14px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
                  }}
                >
                  {/* Shimmer effect */}
                  <div className="special-button-shimmer opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                  <span className="relative z-10 flex items-center gap-2.5 text-left">
                    <div
                      className="flex h-8 w-8 items-center justify-center rounded-xl transition-all duration-300 group-hover:scale-110"
                      style={{
                        backgroundColor: 'rgba(6, 182, 212, 0.2)',
                        boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.1), 0 2px 8px rgba(6, 182, 212, 0.3)',
                        border: '1px solid rgba(6, 182, 212, 0.4)'
                      }}
                    >
                      <Search className="h-4 w-4 text-cyan-300 drop-shadow-sm" />
                    </div>
                    <div className="flex flex-col items-start">
                      <span className="text-slate-50 font-semibold leading-tight">Quick Search</span>
                      <span className="hidden sm:inline text-[10px] text-slate-400 font-normal leading-tight">docs, tools, AI</span>
                    </div>
                  </span>
                  <kbd
                    className="relative z-10 pointer-events-none inline-flex h-7 select-none items-center gap-1 rounded-lg px-3 font-mono text-[11px] uppercase tracking-wide transition-all duration-300 group-hover:scale-105"
                    style={{
                      background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.1)',
                      color: 'rgba(255, 255, 255, 0.9)'
                    }}
                  >
                    ⌘K
                  </kbd>
                </button>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2">
                {isAuthenticated && (() => {
                  const sessionStatus = getSessionStatus();
                  if (sessionStatus.isValid && sessionStatus.remainingHours) {
                    return (
                      <div
                        className="hidden sm:flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold text-amber-400 relative overflow-hidden group cursor-default"
                        style={{
                          background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.15) 0%, rgba(245, 158, 11, 0.2) 100%)',
                          border: '1px solid rgba(251, 191, 36, 0.3)',
                          boxShadow: '0 2px 8px rgba(251, 191, 36, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
                        }}
                      >
                        {/* Continuous shimmer effect */}
                        <div
                          className="absolute inset-0 animate-shimmer"
                          style={{
                            background: 'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.15) 50%, transparent 100%)',
                            width: '50%',
                            height: '100%'
                          }}
                        />
                        <Clock className="h-3.5 w-3.5 relative z-10 drop-shadow-sm" />
                        <span className="relative z-10 drop-shadow-sm">{sessionStatus.remainingHours}h active</span>
                        {sessionStatus.remainingHours < 24 && (
                          <button
                            onClick={() => {
                              if (extendSession(2)) {
                                console.log('Session extended by 2 days');
                                window.location.reload();
                              }
                            }}
                            className="relative z-10 text-amber-300 underline-offset-2 hover:text-amber-200 hover:underline transition-colors font-medium"
                          >
                            Extend
                          </button>
                        )}
                      </div>
                    );
                  }
                  return null;
                })()}

                {isAuthenticated && (
                  <div className="hidden lg:flex">
                    <FlippingInfo userName={user?.username || user?.displayName || 'User'} />
                  </div>
                )}

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
                    className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-3 py-2 text-xs font-semibold text-white shadow-lg shadow-rose-500/20 transition-transform hover:scale-[1.01]"
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
                  className={`${pillButtonClasses} ${documentViewerOpen
                    ? 'border-blue-400/60 bg-gradient-to-br from-blue-500/20 via-blue-500/15 to-cyan-500/15 text-blue-100 shadow-[0_4px_12px_rgba(59,130,246,0.3)]'
                    : ''}`}
                >
                  <FileText className="h-5 w-5 relative z-10" />
                  <span className="relative z-10">{documentViewerOpen ? 'Hide Sources' : 'Sources'}</span>
                </button>

                <button
                  onClick={handleHeaderUploadClick}
                  className={`${pillButtonClasses} border-dashed border-emerald-400/50 bg-gradient-to-br from-emerald-500/10 via-teal-500/10 to-cyan-500/10 text-emerald-100 hover:border-emerald-400/70 hover:from-emerald-500/15 hover:via-teal-500/15 hover:to-cyan-500/15 hover:text-emerald-50`}
                  title="Upload a PDF, image, or text doc directly to the canvas"
                >
                  <Upload className="h-5 w-5 relative z-10" />
                  <span className="relative z-10">Upload to Canvas</span>
                </button>

                <button
                  onClick={() => {
                    startFeature('3d_explorer');
                    openChemistryPanel();
                  }}
                  className={pillButtonClasses}
                >
                  <Layers3 className="h-5 w-5 relative z-10" />
                  <span className="relative z-10">3D Explorer</span>
                </button>

                <button
                  onClick={() => {
                    setShowNmrFullscreen(true);
                    setIsNmrAssistantActive(false);
                    setShowChatPanel(false);
                    startFeature('nmr_lab');
                  }}
                  className={pillButtonClasses}
                >
                  <LineChart className="h-5 w-5" />
                  NMR Lab
                </button>

                <button
                  onClick={() => {
                    setShowAIWord(true);
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
                  className="group relative inline-flex items-center gap-2 rounded-full overflow-hidden px-4 py-2 text-sm font-semibold text-white transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
                  style={{
                    background: 'linear-gradient(135deg, #0e7490 0%, #0891b2 25%, #06b6d4 50%, #22d3ee 75%, #67e8f9 100%)',
                    boxShadow: '0 4px 16px rgba(8, 145, 178, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.3), inset 0 -1px 0 rgba(0, 0, 0, 0.1)',
                    border: '1px solid rgba(255, 255, 255, 0.1)'
                  }}
                >
                  {/* Enhanced shimmer effect */}
                  <div className="absolute inset-0 -z-10 blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                    <div className="absolute inset-0 animate-shimmer-slide bg-gradient-to-r from-transparent via-white/30 to-transparent" />
                  </div>
                  {/* Shimmer border effect */}
                  <div className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                    <div className="absolute inset-0 rounded-full bg-gradient-to-r from-cyan-400/50 via-white/50 to-cyan-400/50 animate-shimmer-slide" style={{ mask: 'linear-gradient(#000, #000) content-box, linear-gradient(#000, #000)', WebkitMask: 'linear-gradient(#000, #000) content-box, linear-gradient(#000, #000)', padding: '1px' }} />
                  </div>
                  <PenLine className="h-5 w-5 relative z-10 drop-shadow-lg" />
                  <span className="relative z-10 drop-shadow-md font-medium">Doc Studio</span>
                </button>

                <button
                  onClick={() => {
                    setShowImmersiveLearning(true);
                    setShowAIWord(false);
                    setShowNmrFullscreen(false);
                    setShowChemistryPanel(false);
                    setShowChatPanel(false);
                    setIsNmrAssistantActive(false);
                    setShowNmrAssistant(false);
                    setIsRdkitAssistantActive(false);
                    setShowRdkitAssistant(false);
                    setRdkitStatus('idle');
                    void captureToolClick('immersive_learning');
                    startFeature('immersive_learning');
                  }}
                  className="group relative inline-flex items-center gap-2 rounded-full overflow-hidden px-4 py-2 text-sm font-semibold text-white transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
                  style={{
                    background: 'linear-gradient(135deg, #6d28d9 0%, #7c3aed 25%, #8b5cf6 50%, #a78bfa 75%, #c4b5fd 100%)',
                    boxShadow: '0 4px 16px rgba(124, 58, 237, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.3), inset 0 -1px 0 rgba(0, 0, 0, 0.1)',
                    border: '1px solid rgba(255, 255, 255, 0.1)'
                  }}
                >
                  {/* Enhanced shimmer effect */}
                  <div className="absolute inset-0 -z-10 blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                    <div className="absolute inset-0 animate-shimmer-slide bg-gradient-to-r from-transparent via-white/30 to-transparent" />
                  </div>
                  {/* Shimmer border effect */}
                  <div className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                    <div className="absolute inset-0 rounded-full bg-gradient-to-r from-purple-400/50 via-white/50 to-purple-400/50 animate-shimmer-slide" style={{ mask: 'linear-gradient(#000, #000) content-box, linear-gradient(#000, #000)', WebkitMask: 'linear-gradient(#000, #000) content-box, linear-gradient(#000, #000)', padding: '1px' }} />
                  </div>
                  <BookOpen className="h-5 w-5 relative z-10 drop-shadow-lg" />
                  <span className="relative z-10 drop-shadow-md font-medium">Immersive Learning</span>
                </button>

                <div className="inline-flex items-center rounded-full border border-slate-700/50 bg-slate-900/50 backdrop-blur-sm p-0.5 text-xs font-semibold shadow-lg">
                  <button
                    onClick={() => {
                      setIsMolecularMode(false);
                    }}
                    className={`group relative flex items-center gap-1.5 rounded-full px-4 py-2 text-sm transition-all duration-300 overflow-hidden ${!isMolecularMode
                      ? 'text-white'
                      : 'text-slate-400 hover:text-slate-200'
                      }`}
                    style={!isMolecularMode ? {
                      background: 'linear-gradient(135deg, #d97706 0%, #f59e0b 25%, #f97316 50%, #fb923c 75%, #fdba74 100%)',
                      boxShadow: '0 4px 16px rgba(245, 158, 11, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.3), inset 0 -1px 0 rgba(0, 0, 0, 0.1)',
                      border: '1px solid rgba(255, 255, 255, 0.1)'
                    } : {}}
                  >
                    {!isMolecularMode && (
                      <>
                        {/* Enhanced shimmer effect */}
                        <div className="absolute inset-0 -z-10 blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                          <div className="absolute inset-0 animate-shimmer-slide bg-gradient-to-r from-transparent via-white/30 to-transparent" />
                        </div>
                        {/* Shimmer border effect */}
                        <div className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                          <div className="absolute inset-0 rounded-full bg-gradient-to-r from-orange-400/50 via-white/50 to-orange-400/50 animate-shimmer-slide" style={{ mask: 'linear-gradient(#000, #000) content-box, linear-gradient(#000, #000)', WebkitMask: 'linear-gradient(#000, #000) content-box, linear-gradient(#000, #000)', padding: '1px' }} />
                        </div>
                      </>
                    )}
                    <Edit3 className={`h-5 w-5 relative z-10 ${!isMolecularMode ? 'drop-shadow-lg' : ''}`} />
                    <span className={`relative z-10 ${!isMolecularMode ? 'drop-shadow-md font-medium' : ''}`}>Canvas Studio</span>
                  </button>
                  <button
                    onClick={() => {
                      setIsMolecularMode(true);
                    }}
                    className={`group relative flex items-center gap-1.5 rounded-full px-4 py-2 text-sm transition-all duration-300 overflow-hidden ${isMolecularMode
                      ? 'text-white'
                      : 'text-slate-400 hover:text-slate-200'
                      }`}
                    style={isMolecularMode ? {
                      background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                      boxShadow: '0 2px 8px rgba(59, 130, 246, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
                    } : {}}
                  >
                    {isMolecularMode && (
                      <div className="special-button-shimmer opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    )}
                    <Beaker className={`h-5 w-5 relative z-10 ${isMolecularMode ? 'drop-shadow-sm' : ''}`} />
                    <span className={`relative z-10 ${isMolecularMode ? 'drop-shadow-sm' : ''}`}>Molecule Sketcher</span>
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




      {/* Fullscreen NMR viewer */}
      {
        showNmrFullscreen ? (
          <div className="flex h-[calc(100vh-5rem)] flex-col">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between border-b border-slate-800 px-4 md:px-6 py-3" style={{ backgroundColor: '#212121' }}>
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
                  ref={nmrIframeRef}
                  title="nmrium-fullscreen"
                  src={nmrIframeSrc}
                  className="h-full w-full"
                  allowFullScreen
                />
              </div>
              {showNmrAssistant && (
                <aside className="flex w-full max-w-md flex-col border-l border-border" style={{ backgroundColor: '#000000' }}>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between px-4 py-3 border-b border-border bg-muted/70" style={{ backgroundColor: '#171717' }}>
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
                  <div className="flex-1 overflow-hidden" style={{ backgroundColor: '#212121' }}>
                    <AIElementsChat
                      onRequireApiKey={() => setShowSettings(true)}
                      onRequestVideoSearch={handleVideoSearchFromChatResponse}
                      showHeader={false}
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
                  className="relative z-30 border-r border-slate-700/50 bg-slate-900 flex flex-col shadow-xl"
                  style={{ width: sourcesWidth, minWidth: 280 }}
                >
                  {/* Sources Header */}
                  <div className="relative px-4 py-4 border-b border-slate-700/50 overflow-hidden" style={{ backgroundColor: '#171717' }}>
                    <div className="relative flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-semibold text-white">Sources</h3>
                      </div>
                      <button
                        onClick={() => setDocumentViewerOpen(false)}
                        className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-8 w-8"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 px-4 py-3 border-b border-slate-700/50" style={{ backgroundColor: '#212121' }}>
                    <button
                      onClick={handleSummarizeAllVideos}
                      disabled={summarizingAll || youtubeSources.length === 0}
                      className={`w-full inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-xs font-semibold uppercase tracking-wide transition-colors ${summarizingAll || youtubeSources.length === 0
                        ? 'cursor-not-allowed'
                        : 'hover:opacity-90'
                        }`}
                      style={{
                        backgroundColor: '#e5e5e5',
                        color: summarizingAll || youtubeSources.length === 0 ? '#6b7280' : '#171717'
                      }}
                    >
                      {summarizingAll ? 'Summarizing all…' : 'Summarize all to canvas'}
                    </button>
                  </div>


                  {/* Sources List */}
                  <div className="flex-1 p-4 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent" style={{ backgroundColor: '#171717' }}>
                    <div className="space-y-4">
                      {youtubeSources.length === 0 ? (
                        <div className="text-center py-12">
                          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-800/60 ring-1 ring-slate-700/50 mx-auto mb-3">
                            <Video className="h-6 w-6 text-slate-400" />
                          </div>
                          <p className="text-sm text-slate-300">No video recommendations yet</p>
                          <p className="text-xs text-slate-500 mt-1">Upload a PDF to see curated explainers.</p>
                        </div>
                      ) : (
                        youtubeSources.map((source) => {
                          const resolvedVideoId = source.videoId ?? (source.url ? extractVideoIdFromUrl(source.url) : null);
                          const isInlinePlaying = inlineVideoSourceId === source.id && Boolean(resolvedVideoId);
                          const embedUrl = resolvedVideoId
                            ? `https://www.youtube.com/embed/${encodeURIComponent(resolvedVideoId)}?autoplay=1&modestbranding=1`
                            : null;
                          return (
                            <div key={source.id} className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-3 shadow-sm hover:border-slate-600/50 transition-all">
                              {/* Thumbnail */}
                              <div className="mb-3">
                                {isInlinePlaying && embedUrl ? (
                                  <div
                                    className="relative w-full overflow-hidden rounded-lg border border-slate-700 bg-black"
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
                                    className="w-full h-auto rounded-lg border border-slate-700 object-cover"
                                    style={{ aspectRatio: '16 / 9' }}
                                    loading="lazy"
                                  />
                                ) : (
                                  <div
                                    className="flex w-full items-center justify-center rounded-lg border border-dashed border-slate-700 text-muted-foreground bg-slate-900/50"
                                    style={{ aspectRatio: '16 / 9' }}
                                  >
                                    <Video className="h-8 w-8" />
                                  </div>
                                )}
                              </div>

                              {/* Content */}
                              <div className="space-y-2">
                                <h4 className="text-sm font-semibold text-white line-clamp-2 leading-tight">{source.title}</h4>
                                <p className="text-xs text-slate-400">
                                  {source.channelTitle ? `${source.channelTitle}` : 'YouTube'}
                                  {source.channelSubscribers
                                    ? ` • ${Intl.NumberFormat('en', { notation: 'compact' }).format(source.channelSubscribers)} subscribers`
                                    : ''}
                                </p>
                                {source.description && (
                                  <p className="text-xs text-slate-500 line-clamp-2">{source.description}</p>
                                )}
                                {source.url && (
                                  <a
                                    href={source.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center text-xs font-medium text-blue-400 hover:text-blue-300"
                                  >
                                    Watch on YouTube
                                    <ExternalLink className="ml-1 h-3 w-3" />
                                  </a>
                                )}

                                {/* Action Buttons */}
                                <div className="pt-2 flex flex-col gap-2">
                                  <button
                                    onClick={() => handleExportVideoSummary(source)}
                                    disabled={videoSummaryLoadingId === source.id}
                                    className={`w-full inline-flex items-center justify-center rounded-lg px-3 py-2 text-xs font-semibold transition ${videoSummaryLoadingId === source.id
                                      ? 'bg-slate-700 text-slate-400'
                                      : 'bg-primary text-primary-foreground hover:bg-primary/90'
                                      }`}
                                  >
                                    {videoSummaryLoadingId === source.id ? 'Summarizing…' : 'Summarize to Canvas'}
                                  </button>

                                  <div className="flex gap-2">
                                    {resolvedVideoId && (
                                      <button
                                        onClick={() => handleToggleInlineVideo(source)}
                                        className={`flex-1 inline-flex items-center justify-center rounded-lg px-3 py-2 text-xs font-semibold transition ${isInlinePlaying
                                          ? 'bg-emerald-500 text-white hover:bg-emerald-400'
                                          : 'border border-slate-600 text-slate-300 hover:border-emerald-400 hover:text-emerald-400'
                                          }`}
                                      >
                                        {isInlinePlaying ? 'Close inline player' : 'Play inline'}
                                      </button>
                                    )}
                                    <button
                                      onClick={() => removeSource(source.id)}
                                      className="flex items-center justify-center rounded-lg border border-slate-600 px-3 py-2 text-slate-400 hover:bg-red-500/10 hover:border-red-500/50 hover:text-red-400 transition"
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
                  {isMolecularMode ? (
                    <MoldrawEmbed />
                  ) : (
                    <>
                      <div className={`flex items-center gap-2 border-b border-slate-800/60 px-4 text-sm transition-all duration-200 ${isWorkspaceTabsCollapsed ? 'py-1' : 'py-2'}`} style={{ backgroundColor: '#212121' }}>
                        {/* Collapse Toggle Button */}
                        <button
                          onClick={() => setIsWorkspaceTabsCollapsed(!isWorkspaceTabsCollapsed)}
                          className="inline-flex items-center justify-center rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition"
                          title={isWorkspaceTabsCollapsed ? "Expand workspace tabs" : "Collapse workspace tabs"}
                        >
                          {isWorkspaceTabsCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                        </button>

                        {!isWorkspaceTabsCollapsed && (
                          <>
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

                            {/* Workspace Save/Load Controls */}
                            <div className="ml-auto flex items-center gap-2">
                              {/* Load saved workspaces */}
                              <button
                                onClick={handleLoadSavedWorkspaces}
                                disabled={isLoadingWorkspaces}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/50 px-2.5 py-1.5 text-xs text-slate-300 hover:bg-slate-700 hover:text-white transition disabled:opacity-50"
                                title="Open saved workspace"
                              >
                                {isLoadingWorkspaces ? (
                                  <LoaderIcon size={14} className="animate-spin" />
                                ) : (
                                  <FolderOpen size={14} />
                                )}
                                <span className="hidden sm:inline">Open</span>
                              </button>

                              {/* Save current workspace */}
                              <button
                                onClick={handleSaveWorkspace}
                                disabled={isSavingWorkspace}
                                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs transition ${canvasWorkspaces.find(ws => ws.id === activeWorkspaceId)?.hasUnsavedChanges
                                  ? 'bg-emerald-600 text-white hover:bg-emerald-500 border border-emerald-500'
                                  : 'border border-slate-700 bg-slate-800/50 text-slate-300 hover:bg-slate-700 hover:text-white'
                                  } disabled:opacity-50`}
                                title={canvasWorkspaces.find(ws => ws.id === activeWorkspaceId)?.firebaseId ? "Save changes" : "Save workspace to cloud"}
                              >
                                {isSavingWorkspace ? (
                                  <LoaderIcon size={14} className="animate-spin" />
                                ) : canvasWorkspaces.find(ws => ws.id === activeWorkspaceId)?.firebaseId ? (
                                  <Cloud size={14} />
                                ) : (
                                  <Save size={14} />
                                )}
                                <span className="hidden sm:inline">
                                  {canvasWorkspaces.find(ws => ws.id === activeWorkspaceId)?.firebaseId ? 'Saved' : 'Save'}
                                </span>
                              </button>
                            </div>
                          </>
                        )}
                      </div>

                      {/* Saved Workspaces Dropdown */}
                      {showSavedWorkspaces && (
                        <div className="absolute left-4 top-12 z-50 w-72 rounded-lg border border-slate-700 bg-slate-900 shadow-xl">
                          <div className="flex items-center justify-between border-b border-slate-700 px-3 py-2">
                            <span className="text-sm font-medium text-slate-200">Saved Workspaces</span>
                            <button
                              onClick={() => setShowSavedWorkspaces(false)}
                              className="rounded p-1 hover:bg-slate-800"
                            >
                              <X size={14} className="text-slate-400" />
                            </button>
                          </div>
                          <div className="max-h-64 overflow-y-auto p-2">
                            {isLoadingWorkspaces ? (
                              <div className="flex items-center justify-center py-4 gap-2">
                                <LoaderIcon size={16} className="animate-spin text-slate-400" />
                                <span className="text-sm text-slate-500">Loading workspaces...</span>
                              </div>
                            ) : savedWorkspacesList.length === 0 ? (
                              <p className="py-4 text-center text-sm text-slate-500">
                                No saved workspaces yet. Save your current workspace using the Save button.
                              </p>
                            ) : (
                              savedWorkspacesList.map(ws => (
                                <button
                                  key={ws.id}
                                  onClick={() => handleOpenSavedWorkspace(ws.id, ws.name)}
                                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-slate-800 transition"
                                >
                                  <FolderOpen size={16} className="text-slate-400" />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-slate-200 truncate">{ws.name}</p>
                                    <p className="text-xs text-slate-500">
                                      {ws.updatedAt?.toDate?.()?.toLocaleDateString() || 'Recently saved'}
                                    </p>
                                  </div>
                                </button>
                              ))
                            )}
                          </div>
                        </div>
                      )}
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
                              onRegisterHandwritingHandler={(handler) => registerWorkspaceHandler(workspace.id, 'handwriting', handler)}
                              onRegisterMarkdownInjectionHandler={(handler) => registerWorkspaceHandler(workspace.id, 'markdown', handler)}
                              onRegisterMoleculeInjectionHandler={(handler) => registerWorkspaceHandler(workspace.id, 'molecule', handler)}
                              onRegisterProteinInjectionHandler={(handler) => registerWorkspaceHandler(workspace.id, 'protein', handler)}
                              onRegisterReactionInjectionHandler={(handler) => registerWorkspaceHandler(workspace.id, 'reaction', handler)}
                              onRegisterGetShapesHandler={(handler) => registerWorkspaceHandler(workspace.id, 'getShapes', handler)}
                              onRegisterSetShapesHandler={(handler) => registerWorkspaceHandler(workspace.id, 'setShapes', handler)}
                              onShapesChange={(shapes) => handleShapesChange(workspace.id, shapes)}
                              initialShapes={workspace.shapes}
                            />
                          </div>
                        ))}

                        {/* Drawing Tools Dock - Floating on canvas */}
                        <DrawingToolsDock
                          currentTool={currentTool}
                          onToolChange={setCurrentTool}
                          position="left"
                          enableKeyboardShortcuts={true}
                          forceCollapsed={documentViewerOpen}
                        />
                      </div>
                    </>
                  )}
                </div>




                {/* Study Tools Panel */}
                {/* Study Tools Panel handled via full-screen workspace */}

                {/* Chat Start Button - Floating */}
                {!showChatPanel && !showNmrFullscreen && !showGeminiLiveWorkspace && (
                  <div className="absolute top-16 right-8 z-10 flex flex-col gap-3 items-end">
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
                      className="hover:bg-primary/90 hover:border-primary/50 hover:shadow-xl hover:shadow-primary/20 transform hover:scale-105 active:scale-95 bg-gradient-to-r from-primary/80 to-primary/60 border-primary/40 text-white font-medium"
                    >
                      <span className='mr-2'>
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
                      className="border-l-2 border-border flex flex-col shadow-lg"
                      style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: chatWidth, zIndex: 10, backgroundColor: '#000000' }}
                    >
                      {/* Chat Header */}
                      <div className="px-4 py-3 border-b border-border bg-muted/70 flex items-center justify-between" style={{ backgroundColor: '#171717' }}>
                        <div className="flex items-center space-x-3">
                          <h3 className="text-sm font-semibold">AI Chat</h3>
                        </div>
                        <button
                          onClick={() => setShowChatPanel(false)}
                          className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-8 w-8"
                          aria-label="Close chat"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      {/* Chat Content */}
                      <div className="flex-1 min-h-[240px] overflow-hidden">
                        <AIElementsChat onRequireApiKey={() => setShowSettings(true)} onRequestVideoSearch={(query) => {
                          // Handle video search if needed
                        }} showHeader={false} />
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
                        <div className="text-zinc-400 text-xs font-semibold">⋮⋮</div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )
      }

      {/* Settings Modal */}
      {
        showSettings && (
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
        )
      }

      {/* Profile Update Modal */}
      {
        showProfileUpdate && user && (
          <ProfileUpdate
            userProfile={user}
            onClose={handleCloseProfileUpdate}
            onUpdate={handleProfileUpdate}
          />
        )
      }

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
      {
        showChemistryPanel && !showNmrFullscreen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="w-full max-w-3xl max-h-[90vh] overflow-hidden">
              <ChemistryWidgetPanel
                onClose={() => setShowChemistryPanel(false)}
                startFullscreen
              />
            </div>
          </div>
        )
      }

      {/* Adaptive Learning Plan */}
      {
        showAdaptivePlan && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="w-full max-w-6xl h-[90vh] mx-4">
              <AdaptivePlan
                onClose={() => setShowAdaptivePlan(false)}
                initialTopic={sources.length > 0 ? sources.map(s => s.title).join(', ') : ''}
              />
            </div>
          </div>
        )
      }

      {/* Unified Dock - Combines MessageDock + Gemini Live controls */}
      <UnifiedDock
        characters={dockCharacters.slice(1, -1).map(c => ({
          id: c.id,
          emoji: c.emoji,
          name: c.name,
          online: c.online,
          backgroundColor: c.backgroundColor?.replace('bg-', 'bg-').replace('-200', '-500/20').replace('-300', '-500/20'),
        }))}
        onMessageSend={(message, character) => {
          console.log('Message:', message, 'to', character.name);
        }}
        onCharacterSelect={(character, index) => {
          console.log('Selected:', character.name);
        }}
        onWriteToCanvas={currentHandwritingHandler || undefined}
        onLiveConnect={() => {
          // Ensure canvas is visible when Gemini Live connects for handwriting responses
          // Close any fullscreen panels that might hide the canvas
          setShowNmrFullscreen(false);
          setShowGeminiLiveWorkspace(false);

          setShowAIWord(false);
          // Open the Excalidraw canvas for handwritten responses
          setShowExcalidrawCanvas(true);
          console.log('[App] Gemini Live mic connected - Excalidraw canvas opened for handwriting responses');
        }}
        isConnected={geminiLiveState.connectionState === ConnectionState.CONNECTED}
        isConnecting={geminiLiveState.connectionState === ConnectionState.CONNECTING}
        isListening={geminiLiveState.isListening}
        isSpeaking={geminiLiveState.isSpeaking}
        isScreenSharing={geminiLiveState.isScreenSharing}
        onConnect={() => geminiLiveState.connect()}
        onDisconnect={() => {
          geminiLiveState.disconnect();
          // Optionally close the Excalidraw canvas when disconnecting
          // setShowExcalidrawCanvas(false);
        }}
        onStartScreenShare={() => geminiLiveState.startScreenShare()}
        onStopScreenShare={() => geminiLiveState.stopScreenShare()}
        onShareCanvas={() => geminiLiveState.captureAndSendSnapshot()}
        showShareCanvas={!showNmrFullscreen && !showGeminiLiveWorkspace}

        // Webcam Sharing
        isWebcamSharing={isWebcamSharing}
        onStartWebcamShare={startWebcamShare}
        onStopWebcamShare={stopWebcamShare}

        analyser={geminiLiveState.analyser}
      />
      {/* Gemini Live Overlay disabled (learning canvas removed) */}

      {/* Excalidraw Canvas for Gemini Live handwritten responses */}
      <ExcalidrawCanvas
        ref={excalidrawCanvasRef}
        isOpen={showExcalidrawCanvas}
        onClose={() => setShowExcalidrawCanvas(false)}
        title="Gemini Live Notes"
      />

      {/* Image Lightbox */}
      <GeminiLiveImageLightbox image={expandedImage} onClose={handleCloseLightbox} />

      {/* AI Word */}
      <div className={showAIWord ? '' : 'hidden'}>
        <AIWord
          onClose={() => {
            setShowAIWord(false);
            endCurrentFeature();
          }}
        />
      </div>



      {/* Immersive Learning */}
      {
        showImmersiveLearning && (
          <ImmersiveLearning
            onClose={() => {
              setShowImmersiveLearning(false);
              endCurrentFeature();
            }}
            apiKey={apiKey}
          />
        )
      }

      {/* Webcam Preview - Small floating video when sharing */}
      {isWebcamSharing && (
        <div className="fixed bottom-24 left-6 z-50 w-48 h-36 bg-black rounded-lg overflow-hidden border-2 border-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.5)]">
          <video
            ref={(el) => {
              if (el && webcamStreamRef.current) {
                el.srcObject = webcamStreamRef.current;
              }
            }}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover transform scale-x-[-1]" // Mirror effect
          />
          <div className="absolute top-2 right-2 w-3 h-3 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
          <div className="absolute bottom-1 left-2 text-[10px] font-mono text-white/80 bg-black/40 px-1 rounded">
            LIVE INPUT
          </div>
        </div>
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
    </div >
  );
};

export default App;
