import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FileText, Settings, Search, Beaker, FlaskConical, Edit3, Palette, MessageSquare, BookOpen, User, Video, Headphones, LineChart, Target, X, Menu, Clock, LogOut, ExternalLink, Layers3, Upload, Mic, Plus, FileSpreadsheet, PenLine, Image as ImageIcon, Gem, Atom, Scan, Sparkles, MessageCircle, GraduationCap } from 'lucide-react';
import Canvas, {
  type CanvasCommand,
  type CanvasMoleculeInsertionHandler,
  type CanvasProteinInsertionHandler,
  type CanvasReactionInsertionHandler
} from './components/Canvas';

import CommandPalette from './components/CommandPalette';
import AIElementsChat from './components/AIElementsChat';
import InlineMoleculeSearch from './components/InlineMoleculeSearch';

import MoldrawEmbed from './components/MoldrawEmbed';
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
import { clearAllFeatureSessions } from './utils/featureSessionStorage';
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
import { type SegmentedOption } from './components/SegmentedControl';

import AdaptivePlan from './components/AdaptivePlan';
import FlippingInfo from './components/FlippingInfo';
import DeskbaumPlanner from './components/DeskbaumPlanner';
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
import LearningTutorChat from './components/LearningTutorChat';
import GeminiLiveWorkspace from './components/GeminiLiveWorkspace';
import YouTubeVideos from './components/ImmersiveLearning';
import { CanvasUploadPieMenu } from './components/CanvasUploadPieMenu';
import type { DrawingTool } from './components/DrawingToolsDock';
import { type FeynmanGuide } from './components/FeynmanCoachPanel';
import { SocraticLearningMode } from './components/SocraticLearningMode';
import { FeynmanLearningMode } from './components/FeynmanLearningMode';
import { PdfStudyModeView } from './components/PdfStudyModeView';
import { LearningModeTopicSelector } from './components/LearningModeTopicSelector';
import {
  createWorkspace,
  getWorkspaces,
  saveCanvasState,
  loadCanvasState,
  updateWorkspace as updateWorkspaceFirebase,
  deleteWorkspace as deleteWorkspaceFirebase
} from './services/database/workspaceService';
import { getFeynmanLiveConfig } from './services/learningTheoriesService';
import { uploadFileToStorage, UploadedFile } from './services/database/storageService';
import { getCurrentUserId } from './services/database/userService';
import { Save, CloudOff, Cloud, FolderOpen, Loader2 as LoaderIcon, ChevronUp, ChevronDown } from 'lucide-react';
import FeatureSidebar, { type FeatureGroup, type FeatureItem } from './components/FeatureSidebar';
import FeatureGuideModal from './components/FeatureGuideModal';
import { useSourceStore } from './store/sourceStore';
import { addFileToSourceLibrary } from './utils/sourceLibrary';
import { analyzeDocumentForOptimalMode, type DocumentAnalysisResult } from './services/socraticFeynmanTutorService';

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
  type: 'document' | 'youtube' | 'weblink' | 'image' | 'paste' | 'pdf' | 'text' | 'markdown' | 'html';
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
  const { sources, activeSourceId, addSource: addSourceToStore, removeSource: removeSourceFromStore } = useSourceStore();

  // Sources logic moved to useSourceStore, but we access via hooks below where we define adapters

  // Backward compatibility for existing components that expect specific formats
  const youtubeSources = useMemo(() => sources.filter(source => source.type === 'youtube'), [sources]);
  const tutorSources = useMemo(() => {
    return sources
      .filter(source => source.content && source.content.trim())
      .map((source, index) => ({
        id: source.id,
        title: source.name || `Source ${index + 1}`,
        content: source.content || ''
      }));
  }, [sources]);
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
  const [chatMode, setChatMode] = useState<SegmentedOption>('auto');
  const [showLearningModePanel, setShowLearningModePanel] = useState(true);
  const [feynmanTopic, setFeynmanTopic] = useState('');
  const [feynmanGuide, setFeynmanGuide] = useState<FeynmanGuide | null>(null);
  const [isFeynmanGuideLoading, setIsFeynmanGuideLoading] = useState(false);
  const [feynmanGuideError, setFeynmanGuideError] = useState<string | null>(null);
  const [showChemistryPanel, setShowChemistryPanel] = useState(false);
  const [showNmrFullscreen, setShowNmrFullscreen] = useState(false);

  const [showAdaptivePlan, setShowAdaptivePlan] = useState(false);

  const [showGeminiLiveWorkspace, setShowGeminiLiveWorkspace] = useState(false); // Kept for compatibility if needed, or remove
  const [showAIWord, setShowAIWord] = useState(false);
  const [showYouTubeVideos, setShowYouTubeVideos] = useState(false);
  const [immersiveInitialMode, setImmersiveInitialMode] = useState<'assignment' | 'notebook' | 'immersive-text' | null>(null);
  const [showExcalidrawCanvas, setShowExcalidrawCanvas] = useState(false);
  const [showSocraticLearning, setShowSocraticLearning] = useState(false);
  const [showFeynmanLearning, setShowFeynmanLearning] = useState(false);
  const [showPdfStudyMode, setShowPdfStudyMode] = useState(false);
  const [learningModeTopic, setLearningModeTopic] = useState('');
  const [remainingTopics, setRemainingTopics] = useState<string[]>([]);
  const [learningModeDocumentData, setLearningModeDocumentData] = useState<{ mimeType: string; data: string } | undefined>(undefined);
  const [showTopicSelector, setShowTopicSelector] = useState(false);
  const [pendingLearningMode, setPendingLearningMode] = useState<'auto' | 'socratic' | 'feynman' | 'pdf-study' | null>(null);
  const [pendingCanvasNote, setPendingCanvasNote] = useState<string | null>(null);
  const [expandedImage, setExpandedImage] = useState<ConceptImageRecord | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [showQuickActionsPopup, setShowQuickActionsPopup] = useState(false);
  const [featureSidebarCollapsed, setFeatureSidebarCollapsed] = useState(false);
  const [activeFeatureGuide, setActiveFeatureGuide] = useState<FeatureItem | null>(null);
  const [activeFeatureId, setActiveFeatureId] = useState<string>('workspace-view');
  const [quickActionHandlers, setQuickActionHandlers] = useState<{
    onOpenMinerals: () => void;
    onOpenReactions: () => void;
    onOpenProteins: () => void;
    onOpenAR: () => void;
    getSelectedMoleculeCid: () => string | null;
    getReactionSearchActive: () => boolean;
  } | null>(null);

  const feynmanAutoConnectRef = useRef(false);
  const feynmanAutoScreenShareRef = useRef(false);
  const wasFeynmanModeRef = useRef(false);
  const isFeynmanMode = chatMode === 'feynman';

  const [uploadPieMenu, setUploadPieMenu] = useState<{ open: boolean; x: number; y: number }>({
    open: false,
    x: 0,
    y: 0
  });

  const resolvedFeynmanTopic = useMemo(() => {
    if (feynmanTopic.trim()) {
      return feynmanTopic.trim();
    }
    const fallbackTitle = sources.find(source => source.title && source.title.trim())?.title;
    return fallbackTitle?.trim() || '';
  }, [feynmanTopic, sources]);

  const feynmanKeyConcepts = useMemo(() => {
    if (!feynmanGuide) return [];
    const raw = [...(feynmanGuide.listenFor || []), ...(feynmanGuide.followUps || [])];
    const unique = Array.from(new Set(raw.map(item => item.trim()).filter(Boolean)));
    return unique.slice(0, 6);
  }, [feynmanGuide]);

  const feynmanSystemInstruction = useMemo(() => {
    if (!isFeynmanMode) return undefined;
    const topic = resolvedFeynmanTopic || 'the topic you chose';
    return getFeynmanLiveConfig(topic, feynmanKeyConcepts, 'curious-student').systemInstruction;
  }, [isFeynmanMode, resolvedFeynmanTopic, feynmanKeyConcepts]);

  const feynmanGreetingPrompt = useMemo(() => {
    if (!isFeynmanMode) return undefined;
    const topic = resolvedFeynmanTopic || 'the topic you chose';
    return `You are the student. Start by asking the user to teach you about "${topic}". Invite them to explain aloud and draw on the canvas.`;
  }, [isFeynmanMode, resolvedFeynmanTopic]);

  const geminiLiveOptions = useMemo(() => ({
    systemInstructionOverride: feynmanSystemInstruction,
    greetingPrompt: feynmanGreetingPrompt
  }), [feynmanSystemInstruction, feynmanGreetingPrompt]);

  // Ref for ExcalidrawCanvas to add handwriting text
  const excalidrawCanvasRef = useRef<ExcalidrawCanvasRef>(null);

  // Initialize global Gemini Live state
  const geminiLiveState = useGeminiLive(apiKey, 'en', geminiLiveOptions);
  const {
    connect,
    disconnect,
    startScreenShare,
    stopScreenShare,
    isScreenSharing,
    connectionState,
    isListening,
    isSpeaking,
    captureAndSendSnapshot,
    setRequestCanvasSnapshot,
    setCanvasTextInsertionHandler,
    setCanvasMarkdownInsertionHandler,
    setCanvasMoleculeInsertionHandler,
    setCanvasProteinInsertionHandler,
    setCanvasReactionInsertionHandler,
    setCanvasHandwritingHandler,
    setCanvasStickyNoteHandler,
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
      // Clear any existing interval before starting a new one to prevent leaks
      if (webcamIntervalRef.current) {
        clearInterval(webcamIntervalRef.current as number);
        webcamIntervalRef.current = null;
      }
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
        if (!ctx || connectionState !== ConnectionState.CONNECTED) return;

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

  const handleCanvasNote = useCallback((note: string) => {
    if (!note.trim()) return;
    setShowExcalidrawCanvas(true);
    if (excalidrawCanvasRef.current) {
      excalidrawCanvasRef.current.startNewSection();
      void excalidrawCanvasRef.current.addHandwrittenText(note);
      setPendingCanvasNote(null);
      return;
    }
    setPendingCanvasNote(note);
  }, []);

  useEffect(() => {
    if (!pendingCanvasNote || !showExcalidrawCanvas || !excalidrawCanvasRef.current) {
      return;
    }
    excalidrawCanvasRef.current.startNewSection();
    void excalidrawCanvasRef.current.addHandwrittenText(pendingCanvasNote);
    setPendingCanvasNote(null);
  }, [pendingCanvasNote, showExcalidrawCanvas]);

  const buildFallbackFeynmanGuide = useCallback((topic: string): FeynmanGuide => ({
    topic,
    openingPrompt: `Teach me ${topic} from scratch. Start with a plain-language overview.`,
    drawPrompt: 'Draw a quick diagram that shows the main parts and how they connect.',
    followUps: [
      `What is the first step in ${topic}?`,
      'What causes the change you just described?',
      `Where do people usually get confused about ${topic}?`
    ],
    listenFor: [
      'Missing definitions for core terms',
      'No cause-and-effect explanation',
      'Steps out of order or skipped'
    ],
    nextChallenge: `Explain ${topic} again in three sentences without jargon.`
  }), []);

  const generateFeynmanGuide = useCallback(async () => {
    const topic = resolvedFeynmanTopic.trim();
    if (!topic) {
      setFeynmanGuideError('Enter a topic to generate prompts.');
      return;
    }

    setIsFeynmanGuideLoading(true);
    setFeynmanGuideError(null);

    try {
      const prompt = [
        'You are a learning coach creating a Feynman teaching script for a student-led explanation.',
        'Return JSON only, using this schema:',
        '{',
        '  "topic": "string",',
        '  "openingPrompt": "string",',
        '  "drawPrompt": "string",',
        '  "followUps": ["string", "string", "string"],',
        '  "listenFor": ["string", "string", "string"],',
        '  "nextChallenge": "string"',
        '}',
        'Rules:',
        '- Keep each string under 140 characters.',
        '- Use plain text only. No markdown, no emojis.',
        '- Follow ups and listenFor must contain 3 items each.',
        `Topic: ${topic}`
      ].join('\n');

      const response = await geminiService.generateTextContent(prompt, {
        model: 'gemini-3-flash-preview',
        maxOutputTokens: 600
      });
      const json = geminiService.extractJsonBlock(response);
      const parsed = JSON.parse(json);

      const normalizeList = (value: unknown): string[] => {
        if (!Array.isArray(value)) return [];
        return value
          .map(item => (typeof item === 'string' ? item.trim() : String(item || '').trim()))
          .filter(Boolean)
          .slice(0, 3);
      };

      const guideTopic = typeof parsed.topic === 'string' && parsed.topic.trim()
        ? parsed.topic.trim()
        : topic;

      const followUps = normalizeList(parsed.followUps);
      const listenFor = normalizeList(parsed.listenFor);

      const guide: FeynmanGuide = {
        topic: guideTopic,
        openingPrompt: typeof parsed.openingPrompt === 'string' && parsed.openingPrompt.trim()
          ? parsed.openingPrompt.trim()
          : `Teach me ${guideTopic} in simple terms.`,
        drawPrompt: typeof parsed.drawPrompt === 'string' && parsed.drawPrompt.trim()
          ? parsed.drawPrompt.trim()
          : 'Sketch a simple diagram that shows how the parts connect.',
        followUps: followUps.length ? followUps : [
          `What is the first step in ${guideTopic}?`,
          'What causes the change you described?',
          'Where does this usually go wrong?'
        ],
        listenFor: listenFor.length ? listenFor : [
          'Missing definitions for core terms',
          'No cause-and-effect explanation',
          'Steps out of order or skipped'
        ],
        nextChallenge: typeof parsed.nextChallenge === 'string' && parsed.nextChallenge.trim()
          ? parsed.nextChallenge.trim()
          : `Explain ${guideTopic} again in three sentences without jargon.`
      };

      setFeynmanGuide(guide);
      if (!feynmanTopic.trim() && guideTopic) {
        setFeynmanTopic(guideTopic);
      }
    } catch (error) {
      setFeynmanGuideError(error instanceof Error ? error.message : 'Failed to generate coach prompts.');
      setFeynmanGuide(buildFallbackFeynmanGuide(topic));
    } finally {
      setIsFeynmanGuideLoading(false);
    }
  }, [buildFallbackFeynmanGuide, feynmanTopic, resolvedFeynmanTopic]);

  const handleFeynmanConnect = useCallback((forceReconnect = false) => {
    if (!forceReconnect && (connectionState === ConnectionState.CONNECTED || connectionState === ConnectionState.CONNECTING)) {
      return;
    }
    feynmanAutoConnectRef.current = true;
    connect();
  }, [connect, connectionState]);

  const handleFeynmanDisconnect = useCallback(() => {
    if (connectionState === ConnectionState.DISCONNECTED) {
      return;
    }
    feynmanAutoConnectRef.current = false;
    disconnect();
  }, [connectionState, disconnect]);

  const handleFeynmanStartScreenShare = useCallback(() => {
    if (isScreenSharing) {
      return;
    }
    feynmanAutoScreenShareRef.current = true;
    startScreenShare();
  }, [isScreenSharing, startScreenShare]);

  const handleFeynmanStopScreenShare = useCallback(() => {
    feynmanAutoScreenShareRef.current = false;
    stopScreenShare();
  }, [stopScreenShare]);

  const handleChatModeChange = useCallback((mode: SegmentedOption) => {
    setChatMode(mode);

    // Close any existing learning mode overlays first
    setShowSocraticLearning(false);
    setShowFeynmanLearning(false);
    setShowTopicSelector(false);

    // For all modes, show the topic selector (Launchpad) first
    setPendingLearningMode(mode === 'auto' ? 'auto' : mode);
    setShowTopicSelector(true);
    setShowChatPanel(false);

    if (feynmanAutoScreenShareRef.current) {
      handleFeynmanStopScreenShare();
    }
  }, [
    handleFeynmanStopScreenShare
  ]);
  useEffect(() => {
    if (!isFeynmanMode || !showFeynmanLearning) {
      return;
    }
    setShowExcalidrawCanvas(false);
    if (!feynmanTopic.trim() && resolvedFeynmanTopic) {
      setFeynmanTopic(resolvedFeynmanTopic);
    }
    if (!feynmanGuide && !isFeynmanGuideLoading) {
      void generateFeynmanGuide();
    }
  }, [
    feynmanGuide,
    generateFeynmanGuide,
    feynmanTopic,
    isFeynmanGuideLoading,
    isFeynmanMode,
    resolvedFeynmanTopic,
    showFeynmanLearning
  ]);

  useEffect(() => {
    const wasFeynmanMode = wasFeynmanModeRef.current;

    if (!isFeynmanMode && wasFeynmanMode) {
      if (feynmanAutoConnectRef.current) {
        handleFeynmanDisconnect();
      }
      if (feynmanAutoScreenShareRef.current) {
        handleFeynmanStopScreenShare();
      }
    }

    wasFeynmanModeRef.current = isFeynmanMode;
  }, [handleFeynmanDisconnect, handleFeynmanStopScreenShare, isFeynmanMode]);


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
  const [activeCanvasTab, setActiveCanvasTab] = useState<'workspace' | 'planner'>('workspace');
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
    (activeCanvasTab === 'workspace' || activeCanvasTab === 'planner') &&
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
  const noopStickyNoteHandler = useCallback(() => { }, []);

  const updateGeminiHandlers = useCallback(() => {
    const handlers = workspaceHandlersRef.current[activeWorkspaceId];

    // Force learning-canvas paths to no-ops; route handwriting only to Excalidraw
    setRequestCanvasSnapshot(noopSnapshotHandler);
    setCanvasTextInsertionHandler(noopTextHandler);
    setCanvasMarkdownInsertionHandler(noopMarkdownHandler);
    setCanvasMoleculeInsertionHandler(noopMoleculeHandler);
    setCanvasProteinInsertionHandler(noopProteinHandler);
    setCanvasReactionInsertionHandler(noopReactionHandler);
    setCanvasStickyNoteHandler(noopStickyNoteHandler);

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
    noopStickyNoteHandler,
    noopTextHandler,
    noopHandwritingHandler,
    setCanvasMarkdownInsertionHandler,
    setCanvasMoleculeInsertionHandler,
    setCanvasProteinInsertionHandler,
    setCanvasReactionInsertionHandler,
    setCanvasStickyNoteHandler,
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

  // Get current molecule handler for active workspace
  const currentMoleculeHandler = useMemo(() => {
    const handlers = workspaceHandlersRef.current[activeWorkspaceId];
    return handlers?.molecule ?? null;
  }, [activeWorkspaceId, handlersVersion]);

  // Route handwriting to Excalidraw canvas when it's open
  useEffect(() => {
    if (showExcalidrawCanvas && excalidrawCanvasRef.current) {
      // Set up handler that pushes text to Excalidraw
      setCanvasHandwritingHandler((text: string) => {
        console.log('[App] Routing handwriting to Excalidraw:', text.substring(0, 50) + '...');
        excalidrawCanvasRef.current?.addHandwrittenText(text);
      });
      setCanvasStickyNoteHandler((payload) => {
        if (!payload?.text?.trim()) return;
        excalidrawCanvasRef.current?.addStickyNote(payload);
      });
      // Enable excalidraw-only mode - skip other canvas outputs
      setExcalidrawOnlyMode(true);
    } else {
      // Restore the default handler when Excalidraw is closed
      updateGeminiHandlers();
      // Keep excalidraw-only mode forced on so outputs stay on Excalidraw
      setExcalidrawOnlyMode(true);
    }
  }, [
    showExcalidrawCanvas,
    setCanvasHandwritingHandler,
    setCanvasStickyNoteHandler,
    setExcalidrawOnlyMode,
    updateGeminiHandlers
  ]);

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
    setActiveCanvasTab('workspace');
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
    setActiveCanvasTab('workspace');
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
    setActiveCanvasTab('workspace');

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
    'inline-flex items-center gap-2 rounded-xl border border-slate-700/70 bg-[#171717] px-3 py-1.5 text-xs font-medium text-slate-200 shadow-sm shadow-black/20 transition-all duration-200' +
    ' hover:border-slate-500/70 hover:bg-[#1f1f1f] hover:text-white';
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
      (window as any).openYouTubeVideos = () => {
        setImmersiveInitialMode(null);
        setShowYouTubeVideos(true);
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
    clearAllFeatureSessions();
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

  const openDocStudio = () => {
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
  };

  // Helper to reset all overlays and return to the main workspace view
  const resetToWorkspace = () => {
    setShowNmrFullscreen(false);
    setShowGeminiLiveWorkspace(false);
    setShowYouTubeVideos(false);
    setShowSocraticLearning(false);
    setShowFeynmanLearning(false);
    setShowChatPanel(false);
    setShowChemistryPanel(false);
    setShowAIWord(false);
    setShowPeriodicTable(false);
    setShowMolView(false);
    setShowCalculator(false);
    setShowProfileUpdate(false);
    setShowSettings(false);
    setIsNmrAssistantActive(false);
    setShowNmrAssistant(false);
    setIsRdkitAssistantActive(false);
    setShowRdkitAssistant(false);
    setRdkitStatus('idle');
  };

  const openDrawingTools = () => {
    // Legacy support if needed, otherwise this is handled by resetToWorkspace + activeCanvasTab
    resetToWorkspace();
  };

  const openImmersiveLearning = (mode?: 'assignment' | 'notebook' | 'immersive-text') => {
    resetToWorkspace();
    setImmersiveInitialMode(mode ?? null);
    setShowYouTubeVideos(true);
    void captureToolClick('immersive_learning');
    startFeature('immersive_learning');
  };

  const openSocraticLearning = () => {
    resetToWorkspace();
    setShowSocraticLearning(true);
    void captureToolClick('socratic_learning');
    startFeature('socratic_learning');
  };

  const openFeynmanLearning = () => {
    resetToWorkspace();
    handleChatModeChange('feynman');
    void captureToolClick('feynman_learning');
  };

  const handleTopicSelected = useCallback((topic: string, mode: 'auto' | 'socratic' | 'feynman' | 'pdf-study', documentData?: { mimeType: string; data: string }, passedRemainingTopics?: string[]) => {
    setLearningModeTopic(topic);
    setLearningModeDocumentData(documentData);
    // Store remaining topics from the topic selector
    if (passedRemainingTopics && passedRemainingTopics.length > 0) {
      setRemainingTopics(passedRemainingTopics);
    }
    setShowTopicSelector(false); // Close the selector first to update state cleanly

    // We don't set chatMode to 'pdf-study' because it's not a chat mode (it's an immersive mode)
    if (mode !== 'pdf-study') {
      setChatMode(mode as any);
    }

    if (mode === 'socratic') {
      setShowSocraticLearning(true);
      setShowExcalidrawCanvas(false);
    } else if (mode === 'feynman') {
      setShowSocraticLearning(false);
      setShowFeynmanLearning(true);
      setShowChatPanel(false);
      setShowExcalidrawCanvas(false);
      if (feynmanAutoScreenShareRef.current) {
        handleFeynmanStopScreenShare();
      }
    } else if (mode === 'pdf-study') {
      // PDF Study Mode -> Open dedicated PDF study view
      setShowSocraticLearning(false);
      setShowFeynmanLearning(false);
      setShowChatPanel(false);
      setShowPdfStudyMode(true);
    } else {
      // Auto mode - analyze document with ToT/CoT to determine best mode
      if (documentData?.data) {
        // Analyze document without showing intermediate UI
        const analyzeAndRedirect = async () => {
          try {
            // For PDFs, we'll use the first portion of base64 content
            const textContent = atob(documentData.data).substring(0, 5000);

            const analysis = await analyzeDocumentForOptimalMode(
              textContent,
              topic,
              (stage) => console.log('[Auto Mode Analysis]', stage)
            );

            console.log('[Auto Mode] Analysis result:', analysis);

            // Use suggested topic if available
            if (analysis.suggestedTopic) {
              setLearningModeTopic(analysis.suggestedTopic);
            }

            // Redirect to recommended full learning mode page
            // Store remaining topics from analysis for continuous study
            if (analysis.keyConcepts && analysis.keyConcepts.length > 0) {
              // Filter out the selected topic from remaining topics
              const remainingFromAnalysis = analysis.keyConcepts.filter(t => t !== analysis.suggestedTopic);
              setRemainingTopics(remainingFromAnalysis);
            }

            if (analysis.recommendedMode === 'feynman') {
              setShowSocraticLearning(false);
              setShowChatPanel(false);
              setShowExcalidrawCanvas(false);
              setShowFeynmanLearning(true);
              startFeature('feynman_learning');
            } else {
              setShowFeynmanLearning(false);
              setShowChatPanel(false);
              setShowExcalidrawCanvas(false);
              setShowSocraticLearning(true);
              startFeature('socratic_learning');
            }
          } catch (error) {
            console.error('[Auto Mode] Analysis failed, defaulting to Socratic:', error);
            setShowChatPanel(false);
            setShowExcalidrawCanvas(false);
            setShowSocraticLearning(true);
            startFeature('socratic_learning');
          }
        };

        void analyzeAndRedirect();
      } else {
        // No document - default to Socratic for topic exploration
        setShowFeynmanLearning(false);
        setShowChatPanel(false);
        setShowExcalidrawCanvas(false);
        setShowSocraticLearning(true);
        startFeature('socratic_learning');
      }
    }
  }, [
    handleFeynmanStopScreenShare,
    openImmersiveLearning
  ]);

  const openNmrLab = () => {
    resetToWorkspace();
    setShowNmrFullscreen(true);
    startFeature('nmr_lab');
  };

  const open3dExplorer = () => {
    startFeature('3d_explorer');
    resetToWorkspace();
    openChemistryPanel();
  };

  const openChatPanel = () => {
    resetToWorkspace();
    setShowChatPanel(true);
    startFeature('chat');
  };

  const uploadPieItems = useMemo(
    () => [
      {
        id: 'assignment',
        label: 'ASSIGNMENT',
        icon: FileText,
        color: '#3b82f6',
        gradientStart: '#2563eb', // blue-600
        gradientEnd: '#60a5fa',   // blue-400
        onSelect: () => openImmersiveLearning('assignment')
      },
      {
        id: 'notebook',
        label: 'NOTEBOOK',
        icon: BookOpen,
        color: '#10b981',
        gradientStart: '#059669', // emerald-600
        gradientEnd: '#34d399',   // emerald-400
        onSelect: () => openImmersiveLearning('notebook')
      },
      {
        id: 'socratic',
        label: 'SOCRATIC',
        icon: MessageCircle,
        color: '#8b5cf6',
        gradientStart: '#7c3aed', // violet-600
        gradientEnd: '#a78bfa',   // violet-400
        onSelect: () => handleChatModeChange('socratic')
      },
      {
        id: 'feynman',
        label: 'FEYNMAN',
        icon: GraduationCap,
        color: '#f59e0b',
        gradientStart: '#d97706', // amber-600
        gradientEnd: '#fbbf24',   // amber-400
        onSelect: () => handleChatModeChange('feynman')
      }
    ],
    [handleChatModeChange, openImmersiveLearning]
  );

  const featureGroups: FeatureGroup[] = [
    {
      id: 'workspace',
      label: 'Workspace',
      items: [
        {
          id: 'workspace-view',
          label: 'Workspace View',
          description: 'Your main canvas for notes, diagrams, and study artifacts.',
          steps: [
            'Switch back to the primary workspace.',
            'Use the left tool rail to draw, type, or insert.',
            'Save progress from the workspace controls.'
          ],
          icon: Layers3,
          action: () => {
            setActiveCanvasTab('workspace');
            setIsMolecularMode(false);
          },
          children: [
            {
              id: 'workspace-tabs',
              label: 'Workspace tabs',
              description: 'Switch between multiple workspace tabs.',
              steps: [
                'Click a workspace tab to switch.',
                'Use the + button to add a new workspace.',
                'Use the x button to close a workspace.'
              ],
              icon: Layers3
            },
            {
              id: 'workspace-save-load',
              label: 'Open and save',
              description: 'Open saved workspaces and store updates.',
              steps: [
                'Click Open to load saved workspaces.',
                'Click Save to store changes.',
                'Watch the save status indicator for sync.'
              ],
              icon: Save
            },
            {
              id: 'workspace-learning-mode',
              label: 'Learning mode switcher',
              description: 'Pick the tutoring style for the session.',
              steps: [
                'Auto adapts to the conversation.',
                'Socratic prompts with questions.',
                'Feynman focuses on teach-back.'
              ],
              icon: MessageSquare
            }
          ]
        },
        {
          id: 'planner-view',
          label: 'Planner View',
          description: 'Deskbaum-style planner board for quick widgets and planning.',
          steps: [
            'Open the Planner tab next to your workspace.',
            'Choose a widget size and type.',
            'Click the grid to place widgets.'
          ],
          icon: Target,
          action: () => {
            resetToWorkspace();
            setActiveCanvasTab('planner');
            setIsMolecularMode(false);
          },
          children: [
            {
              id: 'planner-widget-size',
              label: 'Widget sizes',
              description: 'Pick a widget footprint before placing it.',
              steps: [
                'Single is one cell.',
                'Full Width spans two columns.',
                'Full Height spans two rows.'
              ],
              icon: Target
            },
            {
              id: 'planner-widget-types',
              label: 'Widget types',
              description: 'Available widget templates on the board.',
              steps: [
                'Greeting, Today\'s Focus, Date and Time.',
                'Custom Text for notes.',
                'Calendar, Tasks, GitHub, Gmail placeholders.'
              ],
              icon: FileText
            }
          ]
        },
        {
          id: 'canvas-studio',
          label: 'Canvas Studio',
          description: 'Default drawing canvas tools for notes and sketches.',
          steps: [
            'Activate Canvas Studio mode.',
            'Use pen, text, and shape tools.',
            'Share snapshots to the tutor when needed.'
          ],
          icon: Edit3,
          action: () => {
            resetToWorkspace();
            setIsMolecularMode(false);
            setActiveCanvasTab('workspace');
          },
          children: [
            {
              id: 'canvas-tools',
              label: 'Drawing tools',
              description: 'Core tools for sketching and annotation.',
              steps: [
                'Pen, text, and shapes for notes.',
                'Select and move items as needed.',
                'Eraser to clean up.'
              ],
              icon: Edit3
            }
          ]
        },
        {
          id: 'molecule-sketcher',
          label: 'Molecule Sketcher',
          description: 'Chemical structure sketching mode on the canvas.',
          steps: [
            'Switch to Molecule Sketcher.',
            'Draw structures directly on the canvas.',
            'Use chemistry tools for reactions or proteins.'
          ],
          icon: Beaker,
          action: () => {
            resetToWorkspace();
            setIsMolecularMode(true);
            setActiveCanvasTab('workspace');
          },
          children: [
            {
              id: 'molecule-mode-tools',
              label: 'Chemistry tools',
              description: 'Quick actions for chemistry workflows.',
              steps: [
                'Open reactions, minerals, or proteins.',
                'View selected molecules in AR.',
                'Switch back to Canvas Studio when done.'
              ],
              icon: Beaker
            }
          ]
        }
      ]
    },
    {
      id: 'resources',
      label: 'Resources',
      items: [
        {
          id: 'sources',
          label: 'Sources',
          description: 'Manage PDFs, images, links, and notes for your session.',
          steps: [
            'Open the Sources panel.',
            'Add or remove sources as you study.',
            'Click a source to review or cite it.'
          ],
          icon: FileText,
          action: () => setDocumentViewerOpen(true),
          children: [
            {
              id: 'sources-list',
              label: 'Source list',
              description: 'All uploaded and linked materials.',
              steps: [
                'Select a source to preview.',
                'Use remove to clean up.',
                'Search within sources if needed.'
              ],
              icon: FileText
            }
          ]
        },
        {
          id: 'upload',
          label: 'Upload to Canvas',
          description: 'Drop files directly onto the workspace for analysis.',
          steps: [
            'Open the upload picker.',
            'Select a PDF, image, or document.',
            'The file appears in Sources and on the canvas.'
          ],
          icon: Upload,
          action: () => handleHeaderUploadClick()
        },
        {
          id: '3d-explorer',
          label: '3D Explorer',
          description: 'Explore molecules and proteins in 3D.',
          steps: [
            'Open the 3D Explorer panel.',
            'Search for a structure to load.',
            'Inspect and rotate the model.'
          ],
          icon: Layers3,
          action: open3dExplorer,
          children: [
            {
              id: '3d-tabs-molecule',
              label: 'Molecules tab',
              description: 'Load small molecule structures.',
              steps: [
                'Search by name or identifier.',
                'Load the molecule to the viewport.',
                'Use the viewport controls to inspect.'
              ],
              icon: Layers3
            },
            {
              id: '3d-tabs-protein',
              label: 'Proteins tab',
              description: 'Load proteins and macromolecules.',
              steps: [
                'Search a PDB ID.',
                'Load a sample protein.',
                'Explore binding sites and chains.'
              ],
              icon: Layers3
            },
            {
              id: '3d-tabs-crystal',
              label: 'Crystals tab',
              description: 'Explore crystal structures.',
              steps: [
                'Search by COD ID.',
                'Load crystal lattice data.',
                'Inspect symmetry and cell data.'
              ],
              icon: Layers3
            },
            {
              id: '3d-tabs-reaction',
              label: 'Reactions tab',
              description: 'Animate and visualize reactions.',
              steps: [
                'Load a reaction sequence.',
                'Play the reaction animation.',
                'Inspect intermediates.'
              ],
              icon: Layers3
            }
          ]
        },
        {
          id: 'nmr-lab',
          label: 'NMR Lab',
          description: 'Open NMRium for spectral analysis.',
          steps: [
            'Launch the NMR Lab view.',
            'Load your spectrum or JCAMP-DX file.',
            'Use the assistant for peak guidance.'
          ],
          icon: LineChart,
          action: openNmrLab,
          children: [
            {
              id: 'nmr-assistant',
              label: 'NMR Assistant',
              description: 'Toggle the helper chat for NMR guidance.',
              steps: [
                'Open the assistant from the NMR header.',
                'Ask about peaks, assignments, or tips.',
                'Close the assistant to focus on spectra.'
              ],
              icon: Headphones
            },
            {
              id: 'nmr-open-tab',
              label: 'Open in new tab',
              description: 'Launch the NMR viewer in a separate tab.',
              steps: [
                'Use the Open in new tab button.',
                'Keep the main workspace open.',
                'Return when you need to sync.'
              ],
              icon: ExternalLink
            }
          ]
        }
      ]
    },
    {
      id: 'learning',
      label: 'Learning Modes',
      items: [
        {
          id: 'doc-studio',
          label: 'Doc Studio',
          description: 'AI word processor for long-form writing.',
          steps: [
            'Open Doc Studio.',
            'Start drafting or import content.',
            'Use AI tools to refine your writing.'
          ],
          icon: PenLine,
          action: openDocStudio,
          children: [
            {
              id: 'doc-studio-chat',
              label: 'Chat tab',
              description: 'Conversational drafting and assistance.',
              steps: [
                'Ask for outlines or rewrites.',
                'Paste text for feedback.',
                'Keep chat notes alongside drafts.'
              ],
              icon: MessageSquare
            },
            {
              id: 'doc-studio-editor',
              label: 'Editor tab',
              description: 'Main document editor workspace.',
              steps: [
                'Write directly in the editor.',
                'Use formatting tools for structure.',
                'Save progress regularly.'
              ],
              icon: PenLine
            },
            {
              id: 'doc-studio-googledoc',
              label: 'Google Doc tab',
              description: 'Sync and edit Google Docs.',
              steps: [
                'Connect a Google document.',
                'Edit inside the embedded view.',
                'Sync changes back to Drive.'
              ],
              icon: FileSpreadsheet
            },
            {
              id: 'doc-studio-latex',
              label: 'LaTeX tab',
              description: 'Compose LaTeX documents.',
              steps: [
                'Switch to the LaTeX view.',
                'Edit equations and sections.',
                'Preview compiled output.'
              ],
              icon: FileText
            },
            {
              id: 'doc-studio-deep-agent',
              label: 'Deep Agent tab',
              description: 'Multi-step AI agent workflows.',
              steps: [
                'Queue up complex tasks.',
                'Review agent outputs.',
                'Export results into your draft.'
              ],
              icon: Gem
            },
            {
              id: 'doc-studio-research',
              label: 'Research tab',
              description: 'Collect citations and research notes.',
              steps: [
                'Add sources for context.',
                'Summarize findings.',
                'Insert citations into your document.'
              ],
              icon: BookOpen
            }
          ]
        },
        {
          id: 'immersive-learning',
          label: 'Immersive Learning',
          description: 'Video-driven lessons with interactive tasks.',
          steps: [
            'Open Immersive Learning.',
            'Search for a lesson or video.',
            'Follow the activities and summaries.'
          ],
          icon: BookOpen,
          action: openImmersiveLearning,
          children: [
            {
              id: 'immersive-main-tabs',
              label: 'Mode tabs',
              description: 'Primary navigation within Immersive Learning.',
              steps: [
                'Subject, Simulator, Research.',
                'Coach, LaTeX, Assignment.',
                'Use these to switch learning views.'
              ],
              icon: BookOpen
            },
            {
              id: 'immersive-dashboard-tabs',
              label: 'Dashboard tabs',
              description: 'Organize notebooks and spaces.',
              steps: [
                'Notebooks for lesson content.',
                'Spaces for saved work.',
                'Search within each list.'
              ],
              icon: BookOpen
            },
            {
              id: 'immersive-notebook-tabs',
              label: 'Notebook tabs',
              description: 'Notebook activity sections.',
              steps: [
                'Summary, Mindmap.',
                'Audio, Chat.',
                'Switch tabs for different study modes.'
              ],
              icon: BookOpen
            },
            {
              id: 'immersive-assignments',
              label: 'Assignment tabs',
              description: 'Assignment preparation modes.',
              steps: [
                'Exam Prep.',
                'LaTeX Prep.',
                'Switch to match your workload.'
              ],
              icon: BookOpen
            },
            {
              id: 'immersive-audio-video',
              label: 'Audio and video tabs',
              description: 'Lesson media modes.',
              steps: [
                'Video for interactive lessons.',
                'Audio for podcast style.',
                'Use based on your focus.'
              ],
              icon: BookOpen
            },
            {
              id: 'immersive-video-content',
              label: 'Video content tabs',
              description: 'Segments within video lessons.',
              steps: [
                'Summary and Key Concepts.',
                'Clips and Transcript.',
                'Use to dive deeper.'
              ],
              icon: BookOpen
            },
            {
              id: 'immersive-video-interactive',
              label: 'Video interactive tabs',
              description: 'Activities alongside video lessons.',
              steps: [
                'Chat, Quiz, Flashcards.',
                'Complete quizzes for recall.',
                'Review flashcards for retention.'
              ],
              icon: BookOpen
            },
            {
              id: 'immersive-visual-activity',
              label: 'Visual activity tabs',
              description: 'Interactive visual tasks.',
              steps: [
                'Image-based activity.',
                '3D activity.',
                'Pick the format you prefer.'
              ],
              icon: BookOpen
            }
          ]
        },
        {
          id: 'socratic-learning',
          label: 'Socratic',
          description: 'Guided question-driven tutoring.',
          steps: [
            'Enter Socratic mode.',
            'Answer the tutor questions.',
            'Use hints to refine your understanding.'
          ],
          icon: MessageSquare,
          action: openSocraticLearning,
          children: [
            {
              id: 'socratic-tabs',
              label: 'Socratic tabs',
              description: 'Switch between learning activities.',
              steps: [
                'Concept Graph view.',
                'Flashcards practice.',
                'Quiz challenges.'
              ],
              icon: MessageSquare
            }
          ]
        },
        {
          id: 'feynman-learning',
          label: 'Feynman',
          description: 'Teach-back workflow with guided canvas.',
          steps: [
            'Enter Feynman mode.',
            'Explain the concept in your own words.',
            'Review the generated guide.'
          ],
          icon: Palette,
          action: openFeynmanLearning,
          children: [
            {
              id: 'feynman-guide',
              label: 'Feynman guide',
              description: 'AI-generated explanation checklist.',
              steps: [
                'Generate a guide for the topic.',
                'Follow the checklist prompts.',
                'Revise until the guide is complete.'
              ],
              icon: Palette
            }
          ]
        }
      ]
    },
    {
      id: 'assist',
      label: 'Assist',
      items: [
        {
          id: 'learning-tutor',
          label: 'Learning Tutor Chat',
          description: 'Open the right-side tutor chat panel.',
          steps: [
            'Open the chat panel.',
            'Ask a question or request feedback.',
            'Share a canvas snapshot when needed.'
          ],
          icon: MessageSquare,
          action: openChatPanel,
          children: [
            {
              id: 'learning-tutor-modes',
              label: 'Tutor modes',
              description: 'Change the tutoring style.',
              steps: [
                'Auto adapts to your needs.',
                'Socratic for question-led coaching.',
                'Feynman for teach-back practice.'
              ],
              icon: MessageSquare
            }
          ]
        }
      ]
    }
  ];

  // Sources handlers
  // Sources handlers - ADAPTER for backward compatibility
  // The store's addSource expects an object. The legacy addSource expected (type, data).
  // We rename the destructured addSource to addSourceToStore to avoid conflict here, 
  // then define addSource to match the expected signature.


  const addSource = useCallback(async (type: 'document' | 'youtube' | 'weblink' | 'image' | 'paste', data: any) => {
    const newSource = {
      id: data.id ?? generateSourceId(),
      type,
      name: data.title || 'Untitled', // Map title to name
      title: data.title || 'Untitled', // Keep title for compatibility
      url: data.url,
      content: data.content,
      description: data.description,
      thumbnail: data.thumbnail,
      videoId: data.videoId,
      channelTitle: data.channelTitle,
      channelSubscribers: data.channelSubscribers,
      data: data.data, // in case it is passed
      mimeType: data.mimeType
    };
    await addSourceToStore(newSource);
  }, [addSourceToStore]);

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
      // Ensure title is present (SourceFile has optional title, but SourceEntry expects string)
      const compatibleSource = {
        ...source,
        title: source.title || source.name || 'Untitled'
      };
      void summarizeVideoToCanvas(compatibleSource as any, { showSpinner: true });
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
        await summarizeVideoToCanvas(video as any, { showSpinner: false });
      }
    } finally {
      setSummarizingAll(false);
      setVideoSummaryLoadingId(null);
    }
  }, [summarizeVideoToCanvas, youtubeSources, summarizingAll]);


  const removeSource = useCallback((id: string) => {
    removeSourceFromStore(id);
  }, [removeSourceFromStore]);

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
    files.forEach((file) => {
      addFileToSourceLibrary(file).catch((error) => {
        console.warn('[App] Failed to add source to library:', error);
      });
    });
    requestCanvasFileUpload(files);
    event.target.value = '';
  };

  const handleHeaderUploadClick = () => {
    fileUploadInputRef.current?.click();
  };

  const handleCanvasContextMenu = useCallback((event: React.MouseEvent) => {
    const target = event.target as HTMLElement | null;
    if (target?.closest('button, input, textarea, [role="button"], [contenteditable="true"], [data-ignore-pie-menu="true"]')) {
      return;
    }
    event.preventDefault();
    const padding = 150;
    const viewportWidth = window.innerWidth || 0;
    const viewportHeight = window.innerHeight || 0;
    const safeX = Math.min(Math.max(event.clientX, padding), viewportWidth - padding);
    const safeY = Math.min(Math.max(event.clientY, padding), viewportHeight - padding);
    setUploadPieMenu({ open: true, x: safeX, y: safeY });
  }, []);

  const closeUploadPieMenu = useCallback(() => {
    setUploadPieMenu((prev) => ({ ...prev, open: false }));
  }, []);

  // Resize handlers
  useEffect(() => {
    const handleCustomContextMenu = (event: Event) => {
      const customEvent = event as CustomEvent<{ x: number; y: number }>;
      const { x, y } = customEvent.detail;

      const padding = 150;
      const viewportWidth = window.innerWidth || 0;
      const viewportHeight = window.innerHeight || 0;
      const safeX = Math.min(Math.max(x, padding), viewportWidth - padding);
      const safeY = Math.min(Math.max(y, padding), viewportHeight - padding);

      setUploadPieMenu({ open: true, x: safeX, y: safeY });
    };

    window.addEventListener('canvas-context-menu', handleCustomContextMenu);
    return () => window.removeEventListener('canvas-context-menu', handleCustomContextMenu);
  }, []);

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
          targetWindow.postMessage({ ...payload, type: 'nmrium' }, '*');
          targetWindow.postMessage({ ...payload, type: 'nmrium-load' }, '*');
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
              ? {
                ...interaction,
                response: finalText,
                toolResponses: actions.map(a => ({
                  ...a,
                  id: `nmr-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                  type: 'nmr'
                }))
              }
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
        setImmersiveInitialMode(null);
        setShowYouTubeVideos(true);

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
  // Consolidated Routing Logic (to comply with Rules of Hooks)
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

  if (location.pathname.startsWith('/ar/')) {
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
    <div className="min-h-screen bg-[#0b0f14] text-foreground dark">
      {/* Header */}
      {true && (
        <header
          className="sticky top-0 z-50 w-full border-b border-slate-800/60 shadow-sm"
          style={{
            background: '#171717',
            backdropFilter: 'blur-xl'
          }}
        >
          <input
            ref={fileUploadInputRef}
            type="file"
            multiple
            accept={UNIVERSAL_FILE_ACCEPT}
            className="hidden"
            onChange={handleHeaderFileChange}
          />
          <div
            className="mx-auto flex max-w-screen-2xl flex-col gap-3 px-4 py-3 sm:px-5 lg:px-6"
            style={{ background: '#171717' }}
          >
            <div className="flex flex-wrap items-center gap-3">
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
                  className="inline-flex h-10 w-full max-w-xl items-center justify-between rounded-xl border border-slate-700/80 bg-[#171717] px-4 text-sm font-medium text-slate-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition hover:border-slate-600/80 hover:bg-[#1f1f1f]"
                >
                  <span className="flex items-center gap-2 text-left">
                    <Search className="h-4 w-4 text-slate-400" />
                    <span className="text-slate-300">Quick Search (docs, tools, AI)</span>
                  </span>
                  <kbd className="inline-flex h-6 items-center gap-1 rounded-md border border-slate-700/70 bg-[#171717] px-2 font-mono text-[10px] text-slate-300">
                    Cmd+K
                  </kbd>
                </button>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2.5">
                {isAuthenticated && (() => {
                  const sessionStatus = getSessionStatus();
                  if (sessionStatus.isValid && sessionStatus.remainingHours) {
                    return (
                      <div
                        className="hidden sm:flex items-center gap-2 rounded-full border border-slate-700/70 bg-[#171717] px-3 py-1 text-[11px] font-semibold text-slate-200 cursor-default"
                      >
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
                            className="text-slate-200 underline-offset-2 hover:text-white hover:underline transition-colors font-medium"
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

                <div className="flex items-center gap-1 rounded-full border border-slate-800/70 bg-slate-900/70 p-1">
                  <button
                    onClick={() => setShowProfileUpdate(true)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full text-sm text-slate-300 transition-colors hover:bg-slate-800/80 hover:text-white"
                    title="Update Profile"
                  >
                    <User className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setShowSettings(!showSettings)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full text-sm text-slate-300 transition-colors hover:bg-slate-800/80 hover:text-white"
                  >
                    <Settings className="h-4 w-4" />
                  </button>
                  <button
                    onClick={handleLogout}
                    className="inline-flex items-center gap-2 rounded-full bg-rose-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-lg shadow-rose-500/20 transition-transform hover:scale-[1.01]"
                    title={`Logged in as ${user?.username || user?.displayName}`}
                  >
                    <LogOut className="h-4 w-4" />
                    <span className="hidden sm:inline">{user?.username || user?.displayName}</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setDocumentViewerOpen(!documentViewerOpen)}
                  className={`${pillButtonClasses} ${documentViewerOpen
                    ? 'border-blue-400/60 bg-blue-500/20 text-blue-100'
                    : ''}`}
                >
                  <FileText className="h-5 w-5 relative z-10" />
                  <span className="relative z-10">{documentViewerOpen ? 'Hide Sources' : 'Sources'}</span>
                </button>

                <button
                  onClick={handleHeaderUploadClick}
                  className={`${pillButtonClasses} border-dashed border-emerald-500/50 text-emerald-100 hover:border-emerald-400/70`}
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
                  className="inline-flex items-center gap-2 rounded-xl border border-teal-400/40 bg-[#171717] px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm shadow-teal-500/25 transition hover:bg-[#1f1f1f]"
                >
                  <PenLine className="h-4 w-4" />
                  <span>Doc Studio</span>
                </button>

                <button
                  onClick={() => {
                    setImmersiveInitialMode(null);
                    setShowYouTubeVideos(true);
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
                  className="inline-flex items-center gap-2 rounded-xl border border-violet-400/40 bg-[#171717] px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm shadow-violet-500/25 transition hover:bg-[#1f1f1f]"
                >
                  <BookOpen className="h-4 w-4" />
                  <span>Immersive Learning</span>
                </button>

                {/* Socratic Learning Button */}
                <button
                  onClick={() => {
                    setShowSocraticLearning(true);
                    setShowFeynmanLearning(false);
                    setShowYouTubeVideos(false);
                    void captureToolClick('socratic_learning');
                    startFeature('socratic_learning');
                  }}
                  className="inline-flex items-center gap-2 rounded-xl border border-blue-400/40 bg-[#171717] px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm shadow-blue-500/25 transition hover:bg-[#1f1f1f]"
                  title="Guided discovery through questions (hint ladder)"
                >
                  <MessageSquare className="h-4 w-4" />
                  <span>Socratic</span>
                </button>

                {/* Feynman Learning Button */}
                <button
                  onClick={() => {
                    setShowSocraticLearning(false);
                    setShowYouTubeVideos(false);
                    handleChatModeChange('feynman');
                    void captureToolClick('feynman_learning');
                  }}
                  className="inline-flex items-center gap-2 rounded-xl border border-pink-400/40 bg-[#171717] px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm shadow-pink-500/25 transition hover:bg-[#1f1f1f]"
                  title="Teach back to learn - with visual canvas"
                >
                  <Palette className="h-4 w-4" />
                  <span>Feynman</span>
                </button>

                <div className="inline-flex items-center gap-1 rounded-xl border border-slate-700/70 bg-slate-900/60 p-1 text-[11px] font-semibold">
                  <button
                    onClick={() => {
                      setIsMolecularMode(false);
                    }}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition ${!isMolecularMode
                      ? 'bg-amber-500 text-white shadow-sm'
                      : 'text-slate-300 hover:text-white'
                      }`}
                  >
                    <Edit3 className="h-4 w-4" />
                    <span>Canvas Studio</span>
                  </button>
                  <button
                    onClick={() => {
                      setIsMolecularMode(true);
                    }}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition ${isMolecularMode
                      ? 'bg-blue-500 text-white shadow-sm'
                      : 'text-slate-300 hover:text-white'
                      }`}
                  >
                    <Beaker className="h-4 w-4" />
                    <span>Molecule Sketcher</span>
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
            <FeatureSidebar
              groups={featureGroups}
              collapsed={featureSidebarCollapsed}
              activeId={activeFeatureId}
              onToggle={() => setFeatureSidebarCollapsed(prev => !prev)}
              onSelect={(feature) => {
                setActiveFeatureId(feature.id);
                if (feature.action) {
                  feature.action();
                } else {
                  setActiveFeatureGuide(feature);
                }
              }}
              onHelp={(feature) => setActiveFeatureGuide(feature)}
            />
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
                    <div className="space-y-6">
                      {/* Documents Section */}
                      {sources.some(s => s.type !== 'youtube') && (
                        <div>
                          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Documents</h4>
                          <div className="space-y-2">
                            {sources.filter(s => s.type !== 'youtube').map(source => (
                              <div key={source.id} className="group flex items-center justify-between p-3 rounded-xl border border-slate-700/50 bg-slate-800/30 hover:bg-slate-800/50 hover:border-slate-600 transition-all">
                                <div className="flex items-center gap-3 overflow-hidden">
                                  <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400 shrink-0">
                                    {source.type === 'pdf' ? <FileText className="h-4 w-4" /> :
                                      source.type === 'image' ? <ImageIcon className="h-4 w-4" /> :
                                        <FileText className="h-4 w-4" />}
                                  </div>
                                  <div className="truncate">
                                    <h5 className="text-sm font-medium text-slate-200 truncate">{source.name || source.title}</h5>
                                    <p className="text-[10px] text-slate-500">{source.type.toUpperCase()}</p>
                                  </div>
                                </div>
                                <button
                                  onClick={() => removeSource(source.id)}
                                  className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                                  title="Remove source"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Videos Section */}
                      {youtubeSources.length > 0 && (
                        <div>
                          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Videos</h4>
                          <div className="space-y-4">
                            {youtubeSources.map((source) => {
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
                                        onClick={() => handleExportVideoSummary(source as any)}
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
                                            onClick={() => handleToggleInlineVideo(source as any)}
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
                            })}
                          </div>
                        </div>
                      )}

                      {/* Empty State */}
                      {sources.length === 0 && (
                        <div className="text-center py-12">


                          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-800/60 ring-1 ring-slate-700/50 mx-auto mb-3">
                            <BookOpen className="h-6 w-6 text-slate-400" />
                          </div>
                          <p className="text-sm text-slate-300">No sources added yet</p>
                          <p className="text-xs text-slate-500 mt-1">Upload a document or add a video to get started.</p>
                        </div>
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
                <div className="flex-1 relative flex flex-col" onContextMenu={handleCanvasContextMenu}>
                  {isMolecularMode && activeCanvasTab !== 'planner' ? (
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
                              onClick={() => {
                                setActiveCanvasTab('planner');
                                setIsMolecularMode(false);
                              }}
                              className={`inline-flex items-center gap-2 rounded-2xl px-3 py-1.5 transition ${activeCanvasTab === 'planner'
                                ? 'border border-emerald-400/50 bg-emerald-500/20 text-emerald-100 shadow-sm'
                                : 'text-slate-400 border border-transparent hover:border-emerald-500/50 hover:text-emerald-100'
                                }`}
                              title="Planner"
                            >
                              <Target size={14} />
                              <span className="font-medium">Planner</span>
                            </button>
                            <button
                              onClick={handleAddWorkspace}
                              className="inline-flex items-center justify-center rounded-2xl border border-dashed border-slate-700 px-2.5 py-1.5 text-slate-300 hover:border-slate-500 hover:text-white"
                              title="Add workspace tab"
                            >
                              <Plus size={14} />
                            </button>

                            {/* Learning Mode Selector */}
                            <div className="flex items-center gap-2 mx-auto">
                              <button
                                onClick={() => {
                                  setPendingLearningMode(null);
                                  setShowTopicSelector(true);
                                }}
                                className="text-xs text-slate-500 font-medium hover:text-white transition-colors cursor-pointer"
                              >
                                LEARNING MODE
                              </button>
                              <div className="inline-flex items-center rounded-full border border-slate-700/50 bg-[#171717] backdrop-blur-sm p-0.5 text-xs font-semibold shadow-lg">
                                <button
                                  onClick={() => setChatMode('auto')}
                                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-200 ${chatMode === 'auto'
                                    ? 'bg-[#171717] text-white shadow-sm border border-slate-600/70'
                                    : 'text-slate-400 hover:text-slate-200'
                                    }`}
                                >
                                  Auto
                                </button>
                                <button
                                  onClick={() => handleChatModeChange('socratic')}
                                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-200 ${chatMode === 'socratic'
                                    ? 'bg-[#171717] text-white shadow-sm border border-slate-600/70'
                                    : 'text-slate-400 hover:text-slate-200'
                                    }`}
                                >
                                  Socratic
                                </button>
                                <button
                                  onClick={() => handleChatModeChange('feynman')}
                                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-200 ${chatMode === 'feynman'
                                    ? 'bg-[#171717] text-white shadow-sm border border-slate-600/70'
                                    : 'text-slate-400 hover:text-slate-200'
                                    }`}
                                >
                                  Feynman
                                </button>
                              </div>
                              <button
                                type="button"
                                onClick={() => setShowLearningModePanel((prev) => !prev)}
                                className="inline-flex items-center gap-1 rounded-full border border-slate-700/70 bg-black px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-200 hover:border-slate-400/80 hover:text-white transition"
                              >
                                {showLearningModePanel ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                                {showLearningModePanel ? 'Minimize' : 'Show'}
                              </button>
                            </div>

                            {/* Workspace Save/Load Controls */}
                            <div className="ml-auto flex items-center gap-2">
                              {/* Load saved workspaces */}
                              <button
                                onClick={handleLoadSavedWorkspaces}
                                disabled={isLoadingWorkspaces}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-600 bg-slate-800/80 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700 hover:text-white transition disabled:opacity-50"
                                title="Open saved workspace"
                              >
                                {isLoadingWorkspaces ? (
                                  <LoaderIcon size={14} className="animate-spin" />
                                ) : (
                                  <FolderOpen size={14} />
                                )}
                                <span>Open</span>
                              </button>

                              {/* Save current workspace */}
                              <button
                                onClick={handleSaveWorkspace}
                                disabled={isSavingWorkspace}
                                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${canvasWorkspaces.find(ws => ws.id === activeWorkspaceId)?.hasUnsavedChanges
                                  ? 'bg-emerald-600 text-white hover:bg-emerald-500 border border-emerald-500'
                                  : 'border border-slate-600 bg-slate-800/80 text-slate-200 hover:bg-slate-700 hover:text-white'
                                  } disabled:opacity-50`}
                                title={canvasWorkspaces.find(ws => ws.id === activeWorkspaceId)?.firebaseId ? "Save changes" : "Save workspace to cloud"}
                              >
                                {isSavingWorkspace ? (
                                  <LoaderIcon size={14} className="animate-spin" />
                                ) : (
                                  <Save size={14} />
                                )}
                                <span>Save</span>
                              </button>

                              {/* Start Chat Button */}
                              <button
                                onClick={() => {
                                  setShowChatPanel(true);
                                  startFeature('chat');
                                }}
                                className="group relative inline-flex items-center gap-1.5 rounded-lg overflow-hidden px-3 py-1.5 text-xs font-semibold text-white transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
                                style={{
                                  background: 'linear-gradient(135deg, #059669 0%, #10b981 50%, #34d399 100%)',
                                  boxShadow: '0 2px 8px rgba(16, 185, 129, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
                                  border: '1px solid rgba(255, 255, 255, 0.1)'
                                }}
                                title="Open AI Chat"
                              >
                                <div className="absolute inset-0 -z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                                  <div className="absolute inset-0 animate-shimmer-slide bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                                </div>
                                <MessageSquare size={14} className="relative z-10" />
                                <span className="relative z-10">Start Chat</span>
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
                        {activeCanvasTab === 'planner' ? (
                          <DeskbaumPlanner />
                        ) : (
                          <>
                            {canvasWorkspaces.map(workspace => (
                              <div
                                key={workspace.id}
                                className={`${workspace.id === activeWorkspaceId ? 'block' : 'hidden'} h-full w-full`}
                              >
                                <Canvas
                                  currentTool={currentTool}
                                  strokeWidth={strokeWidth}
                                  strokeColor={strokeColor}
                                  onToolChange={setCurrentTool}
                                  dockForceCollapsed={documentViewerOpen}
                                  onChemistryToolsClick={() => setShowQuickActionsPopup(true)}
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
                                  onRegisterQuickActionHandlers={(handlers) => {
                                    if (workspace.id === activeWorkspaceId) {
                                      setQuickActionHandlers(handlers);
                                    }
                                  }}
                                />
                              </div>
                            ))}
                          </>
                        )}
                      </div>
                    </>
                  )}
                </div>




                {/* Study Tools Panel */}
                {/* Study Tools Panel handled via full-screen workspace */}

                {/* Chat Mode Selector - Centered */}
                {!showChatPanel && !showNmrFullscreen && !showGeminiLiveWorkspace && showLearningModePanel && (
                  <div className="absolute top-20 left-1/2 -translate-x-1/2 z-10 flex w-full max-w-3xl flex-col items-center gap-6 px-4">
                    <div className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-200">Select Learning Mode</div>
                    <div className="grid w-full gap-4 md:grid-cols-3">
                      {[
                        {
                          id: 'auto' as const,
                          label: 'Auto Mode',
                          description: 'AI adapts to your pace and learning style automatically.',
                          icon: Sparkles,
                          accent: 'border-transparent bg-[#171717]/70 text-blue-50 shadow-[0_10px_25px_-18px_rgba(15,23,42,0.85)]',
                          ring: 'ring-blue-500/40',
                          recommended: true,
                          titleColor: 'text-blue-200',
                          bodyColor: 'text-blue-100/80'
                        },
                        {
                          id: 'socratic' as const,
                          label: 'Socratic',
                          description: 'Learn through guided questioning and deep inquiry.',
                          icon: MessageCircle,
                          accent: 'border-transparent bg-[#171717]/70 text-slate-100 shadow-[0_10px_25px_-18px_rgba(15,23,42,0.85)]',
                          ring: 'ring-emerald-500/40',
                          recommended: false,
                          titleColor: 'text-emerald-200',
                          bodyColor: 'text-emerald-100/80'
                        },
                        {
                          id: 'feynman' as const,
                          label: 'Feynman',
                          description: 'Master concepts by teaching them in simple terms.',
                          icon: GraduationCap,
                          accent: 'border-transparent bg-[#171717]/70 text-slate-100 shadow-[0_10px_25px_-18px_rgba(15,23,42,0.85)]',
                          ring: 'ring-violet-500/40',
                          recommended: false,
                          titleColor: 'text-violet-200',
                          bodyColor: 'text-violet-100/80'
                        },
                        {
                          id: 'pdf-study' as const,
                          label: 'PDF Study Mode',
                          description: 'Upload PDF to chat with AI and generate real-time notes.',
                          icon: Mic,
                          accent: 'border-transparent bg-[#171717]/70 text-slate-100 shadow-[0_10px_25px_-18px_rgba(15,23,42,0.85)]',
                          ring: 'ring-rose-500/40',
                          recommended: false,
                          titleColor: 'text-rose-200',
                          bodyColor: 'text-rose-100/80',
                          badge: 'New'
                        }
                      ].map((mode) => {
                        const Icon = mode.icon;
                        const isActive = chatMode === mode.id;
                        return (
                          <button
                            key={mode.id}
                            type="button"
                            onClick={() => handleChatModeChange(mode.id)}
                            className={`group relative flex h-full flex-col items-center gap-3 rounded-2xl border border-transparent px-5 py-6 text-left transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#1f1f1f] hover:shadow-[0_16px_30px_-18px_rgba(15,23,42,0.9)] ${mode.accent} ${isActive ? `ring-2 ${mode.ring}` : ''}`}
                          >
                            {mode.recommended && (
                              <span className="absolute -top-3 left-6 rounded-full bg-blue-600 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-white shadow-lg shadow-blue-600/30">
                                Recommended
                              </span>
                            )}
                            {(mode as any).badge && (
                              <span className="absolute -top-2 -right-2 rounded-full bg-rose-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-rose-200 shadow-sm ring-1 ring-inset ring-rose-500/40 backdrop-blur-sm">
                                {(mode as any).badge}
                              </span>
                            )}
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/20 bg-white/10 text-white">
                              <Icon className="h-5 w-5" />
                            </div>
                            <div className={`text-sm font-semibold ${mode.titleColor}`}>{mode.label}</div>
                            <p className={`text-xs text-center leading-relaxed ${mode.bodyColor}`}>
                              {mode.description}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                    <div className="w-full rounded-2xl border border-transparent bg-[#171717]/70 px-5 py-4 text-center shadow-[0_12px_28px_-20px_rgba(15,23,42,0.8)]">
                      <div className="text-base font-semibold text-teal-200">Ready to explore?</div>
                      <p className="mt-1 text-xs text-sky-100/80">
                        Select a learning mode to begin your session and open the guided launchpad.
                      </p>
                    </div>
                  </div>
                )}

                {/* Chat Start Button - Floating Right Corner */}
                {!showChatPanel && !showNmrFullscreen && !showGeminiLiveWorkspace && (
                  <div className="absolute top-16 right-8 z-10 flex flex-col gap-3 items-end">
                    {/* Gemini Live Share Canvas Button */}
                    {connectionState === ConnectionState.CONNECTED && (
                      <DarkButtonWithIcon
                        onClick={() => captureAndSendSnapshot()}
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
                          <h3 className="text-sm font-semibold">Learning Tutor</h3>
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
                        <LearningTutorChat
                          mode={chatMode}
                          onRequireApiKey={() => setShowSettings(true)}
                          groundingSources={tutorSources}
                          onOpenCanvas={!isFeynmanMode ? () => setShowExcalidrawCanvas(true) : undefined}
                          onCanvasNote={!isFeynmanMode ? handleCanvasNote : undefined}
                          audioConnectionState={connectionState}
                          isListening={isListening}
                          isSpeaking={isSpeaking}
                          onAudioConnect={() => {
                            if (connectionState === ConnectionState.CONNECTED || connectionState === ConnectionState.CONNECTING) {
                              return;
                            }
                            setShowExcalidrawCanvas(true);
                            connect();
                          }}
                          onAudioDisconnect={() => disconnect()}
                        />
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
        onCharacterSelect={(character, _index) => {
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
        isConnected={connectionState === ConnectionState.CONNECTED}
        isConnecting={connectionState === ConnectionState.CONNECTING}
        isListening={isListening}
        isSpeaking={isSpeaking}
        isScreenSharing={isScreenSharing}
        onConnect={() => connect()}
        onDisconnect={() => {
          disconnect();
          // Optionally close the Excalidraw canvas when disconnecting
          // setShowExcalidrawCanvas(false);
        }}
        onStartScreenShare={() => startScreenShare()}
        onStopScreenShare={() => stopScreenShare()}
        onShareCanvas={() => captureAndSendSnapshot()}
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
        className={isFeynmanMode ? 'lg:right-[440px]' : ''}
        title={isFeynmanMode ? 'Feynman Canvas' : 'Gemini Live Notes'}
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


      {/* Learning Mode Topic Selector Popup */}
      <LearningModeTopicSelector
        isOpen={showTopicSelector}
        onClose={() => {
          setShowTopicSelector(false);
          setPendingLearningMode(null);
          setChatMode('auto');
        }}
        onStart={handleTopicSelected}
        mode={pendingLearningMode}
      />

      <CanvasUploadPieMenu
        isOpen={uploadPieMenu.open}
        x={uploadPieMenu.x}
        y={uploadPieMenu.y}
        onClose={closeUploadPieMenu}
        onCenterClick={handleHeaderUploadClick}
        items={uploadPieItems}
        centerLabel="Upload"
      />

      {/* YouTube Videos */}
      {
        showYouTubeVideos && (
          <div className="fixed inset-0 z-[60] bg-background">
            <YouTubeVideos
              onClose={() => {
                setShowYouTubeVideos(false);
                setImmersiveInitialMode(null);
                endCurrentFeature();
              }}
              apiKey={apiKey}
              initialMode={immersiveInitialMode ?? undefined}
            />
          </div>
        )
      }

      {/* Socratic Learning Mode - Side Panel */}
      {
        showSocraticLearning && (
          <div
            className="fixed right-0 top-0 bottom-0 z-[55] bg-white dark:bg-slate-900 shadow-2xl border-l border-slate-200 dark:border-slate-700"
            style={{ width: '480px', maxWidth: '100vw' }}
          >
            <SocraticLearningMode
              topic={learningModeTopic || 'General Chemistry'}
              onBack={() => {
                setShowSocraticLearning(false);
                setChatMode('auto');
                endCurrentFeature();
              }}
              onSwitchToFeynman={(topic: string) => {
                setLearningModeTopic(topic);
                setShowSocraticLearning(false);
                setShowFeynmanLearning(false);
                setShowExcalidrawCanvas(false);
                setChatMode('feynman');
                setShowChatPanel(true);
                startFeature('chat');
              }}
              remainingTopics={remainingTopics}
              onTopicChange={(newTopic) => {
                setLearningModeTopic(newTopic);
                setRemainingTopics(prev => prev.filter(t => t !== newTopic));
              }}
              documentData={learningModeDocumentData}
            />
          </div>
        )
      }

      {/* Feynman Learning Mode - Full Screen */}
      {
        showFeynmanLearning && (
          <div className="fixed inset-0 z-[60] bg-white dark:bg-slate-900">
            <FeynmanLearningMode
              topic={learningModeTopic || 'General Chemistry'}
              onBack={() => {
                setShowFeynmanLearning(false);
                setChatMode('auto');
                endCurrentFeature();
              }}
              onSwitchToSocratic={(topic: string) => {
                setLearningModeTopic(topic);
                setShowFeynmanLearning(false);
                setShowSocraticLearning(true);
              }}
              remainingTopics={remainingTopics}
              onTopicChange={(newTopic) => {
                setLearningModeTopic(newTopic);
                // Remove from remaining topics when selected
                setRemainingTopics(prev => prev.filter(t => t !== newTopic));
              }}
              documentData={learningModeDocumentData}
            />
          </div>
        )
      }

      {/* PDF Study Mode - Full Screen Split Layout */}
      {
        showPdfStudyMode && (
          <div className="fixed inset-0 z-[60] bg-[#0f0f0f]">
            <PdfStudyModeView
              topic={learningModeTopic || 'Document Study'}
              documentData={learningModeDocumentData}
              onClose={() => {
                setShowPdfStudyMode(false);
                setChatMode('auto');
                endCurrentFeature();
              }}
            />
          </div>
        )
      }

      {/* Canvas Planner - AFFiNE-style infinite canvas */}
      {/* Quick Actions Popup */}
      {
        showQuickActionsPopup && quickActionHandlers && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowQuickActionsPopup(false)}>
            <div
              className="flex flex-col gap-4 rounded-2xl border px-4 py-3 shadow-xl backdrop-blur-lg bg-slate-900/95 max-w-2xl w-full"
              style={{ borderColor: 'rgba(6, 182, 212, 0.2)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-100">Chemistry Tools</h3>
                <button
                  onClick={() => setShowQuickActionsPopup(false)}
                  className="rounded-full p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
                  aria-label="Close"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Molecule Search Bar */}
              <div className="w-full">
                <InlineMoleculeSearch
                  className="w-full"
                  onSelectMolecule={async (moleculeData) => {
                    if (currentMoleculeHandler) {
                      try {
                        await currentMoleculeHandler(moleculeData);
                        setShowQuickActionsPopup(false);
                      } catch (error) {
                        console.error('Failed to insert molecule from search:', error);
                      }
                    }
                  }}
                />
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  onClick={() => {
                    quickActionHandlers.onOpenMinerals();
                    setShowQuickActionsPopup(false);
                  }}
                  className="group inline-flex items-center gap-2 rounded-2xl border px-3 py-1.5 text-sm font-semibold transition-all duration-200 bg-slate-900/40 text-slate-200 border-slate-700/60 hover:border-slate-500/50 hover:bg-slate-800/70 hover:text-white"
                  title="Search Minerals (COD 3D)"
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg text-[11px] bg-emerald-500/15 text-emerald-300">
                    <Gem size={14} />
                  </span>
                  <span>Minerals</span>
                </button>
                <button
                  onClick={() => {
                    quickActionHandlers.onOpenReactions();
                    setShowQuickActionsPopup(false);
                  }}
                  className={`group inline-flex items-center gap-2 rounded-2xl border px-3 py-1.5 text-sm font-semibold transition-all duration-200 ${quickActionHandlers.getReactionSearchActive()
                    ? 'bg-slate-800/95 text-white border-slate-500/80 shadow-lg ring-1 ring-orange-500/40 border-orange-500/60'
                    : 'bg-slate-900/40 text-slate-200 border-slate-700/60 hover:border-slate-500/50 hover:bg-slate-800/70 hover:text-white'
                    }`}
                  title="Search Reactions"
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg text-[11px] bg-orange-500/15 text-orange-300">
                    <FlaskConical size={14} />
                  </span>
                  <span>Reactions</span>
                </button>
                <button
                  onClick={() => {
                    quickActionHandlers.onOpenProteins();
                    setShowQuickActionsPopup(false);
                  }}
                  className="group inline-flex items-center gap-2 rounded-2xl border px-3 py-1.5 text-sm font-semibold transition-all duration-200 bg-slate-900/40 text-slate-200 border-slate-700/60 hover:border-slate-500/50 hover:bg-slate-800/70 hover:text-white"
                  title="Browse PDB Proteins"
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg text-[11px] bg-rose-500/15 text-rose-300">
                    <Atom size={14} />
                  </span>
                  <span>Proteins</span>
                </button>
                <button
                  onClick={() => {
                    quickActionHandlers.onOpenAR();
                    setShowQuickActionsPopup(false);
                  }}
                  disabled={!quickActionHandlers.getSelectedMoleculeCid()}
                  className={`group inline-flex items-center gap-2 rounded-2xl border px-3 py-1.5 text-sm font-semibold transition-all duration-200 ${!quickActionHandlers.getSelectedMoleculeCid()
                    ? 'opacity-50 cursor-not-allowed pointer-events-none'
                    : 'bg-slate-900/40 text-slate-200 border-slate-700/60 hover:border-slate-500/50 hover:bg-slate-800/70 hover:text-white'
                    }`}
                  title={quickActionHandlers.getSelectedMoleculeCid()
                    ? 'View selected molecule in AR'
                    : 'Select a molecule on the canvas to enable AR viewer'}
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg text-[11px] bg-purple-500/15 text-purple-300">
                    <Scan size={14} />
                  </span>
                  <span>AR</span>
                </button>
              </div>
            </div>
          </div>
        )
      }

      <FeatureGuideModal
        feature={activeFeatureGuide}
        onClose={() => setActiveFeatureGuide(null)}
        onOpen={(feature) => {
          feature.action?.();
          setActiveFeatureGuide(null);
        }}
      />

      {/* Webcam Preview - Small floating video when sharing */}
      {
        isWebcamSharing && (
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
        )
      }

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
