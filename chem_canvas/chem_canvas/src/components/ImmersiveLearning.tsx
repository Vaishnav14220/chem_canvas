import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { flushSync } from 'react-dom';
import { X, Upload, FileText, Loader2, Volume2, BookOpen, Play, Brain, ChevronLeft, ChevronRight, HelpCircle, CheckCircle2, Info, RefreshCw, Box, Mail, Sparkles, ChevronDown, Send, MessageCircle, Hand, Atom, Maximize2, Minimize2, Mic, Film, Move, Globe, ExternalLink, Copy, Image as ImageIcon, Lightbulb, Zap, Target, Award, Eye, EyeOff, Code2, Terminal as TerminalIcon, Save, RotateCcw, Download } from 'lucide-react';
import CodeMirror from '@uiw/react-codemirror';
import { autocompletion, closeBrackets } from '@codemirror/autocomplete';
import { python } from '@codemirror/lang-python';
import { SrlCoachWorkspace } from './SrlCoachWorkspace';
import { InteractiveAssignmentWorkspace } from './InteractiveAssignmentWorkspace';
import { LaTeXAssignmentPrep } from './LaTeXAssignmentPrep';
import { javascript } from '@codemirror/lang-javascript';
import { java } from '@codemirror/lang-java';
import { cpp } from '@codemirror/lang-cpp';
import { vscodeDark } from '@uiw/codemirror-theme-vscode';
import { dracula } from '@uiw/codemirror-theme-dracula';
import LaserCursor from './LaserCursor';
import HandControlled3DMolecule from './HandControlled3DMolecule';
import { useHandTracking } from '../hooks/useHandTracking';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { Terminal, AnimatedSpan, TypingAnimation, ProgressTerminal } from './ui/terminal';
import { Highlighter } from './ui/highlighter';
import { WarpBackground } from './ui/warp-background';
import { MessageDock, type Character } from './ui/message-dock';
import GeminiLiveOverlay from './GeminiLive/GeminiLiveOverlay';
import { useGeminiLive } from './GeminiLive/hooks/useGeminiLive';
import { ConnectionState, LearningCanvasImage } from './GeminiLive/types';
import {
    analyzeDocumentForImmersive,
    streamAnalyzeDocumentForImmersive,
    generateImmersiveQuiz,
    generateParagraphQuiz,
    generateAudioScript,
    generateEnhancedTermInfo,
    generateBrainstormActivity,
    generateWhatIfActivity,

    generateReactFlowData,
    generateImmersiveImage,
    fetchAndRankYouTubeVideos,
    generateVideoSummary,
    chatAboutVideo,
    generateVideoQuiz,
    generateVideoFlashcards,
    getVideoTranscript,
    generatePodcastScript,
    generatePodcastAudio,
    generateSimulation,
    detectObjectsInImage,
    detectBoundingBoxes,
    findSpecificObjects,
    findObjectsByCategory,
    analyzeSceneSpatially,
    classifyObjectsDetailed,
    answerSceneQuestion,
    countObjects,
    ImmersiveContent,
    QuizQuestion,
    MindMapNode,
    RankedYouTubeVideo,
    VideoSummary,
    VideoChatMessage,
    Flashcard,
    SimulationBlueprint,
    DetectedObject,
    BoundingBox,
    ReactFlowData
} from '../services/immersiveLearningService';
import { sendStudiumChatMessage } from '../services/geminiService';
import { generateStreamingContent } from '../services/geminiStreaming';
import { fetchGroundingSources } from '../services/geminiService';
import ReactFlowMindMap from './ReactFlowMindMap';
import { LessonGeneratorActivity } from './LessonGeneratorActivity';

interface ImmersiveLearningProps {
    onClose: () => void;
    apiKey?: string;
}

type LearningMode = 'source' | 'immersive-text' | 'slides-narration' | 'audio-lesson' | 'mindmap' | 'simulation' | 'robotics' | 'viewer3d' | 'image-activity' | 'code-lab' | 'assignment' | 'latex-assignment';

type CodeLabLanguage = 'python' | 'javascript' | 'java' | 'cpp';

interface CodeLabFile {
    id: string;
    name: string;
    language: CodeLabLanguage;
    content: string;
}

interface LearningModeCard {
    id: LearningMode;
    icon: React.ReactNode;
    label: string;
    activeColor: string;
    activeBg: string;
}

// Custom icons matching Google's exact design
const SourceIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="4" y="3" width="16" height="18" rx="2" fill="#5f6368" />
        <text x="12" y="14" fontSize="6" fill="white" textAnchor="middle" fontWeight="bold">PDF</text>
    </svg>
);

const ImmersiveTextIcon = ({ active }: { active?: boolean }) => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="3" y="5" width="18" height="14" rx="2" fill={active ? "#ea4335" : "#9aa0a6"} />
        <rect x="6" y="8" width="12" height="1.5" rx="0.75" fill="white" />
        <rect x="6" y="11" width="8" height="1.5" rx="0.75" fill="white" />
        <circle cx="17" cy="15" r="3.5" fill={active ? "#fbbc04" : "#bdc1c6"} stroke="white" strokeWidth="1" />
        <text x="17" y="17" fontSize="5" fill="white" textAnchor="middle" fontWeight="bold">?</text>
    </svg>
);

const SlidesIcon = ({ active }: { active?: boolean }) => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="4" y="6" width="16" height="12" rx="2" fill={active ? "#9334e9" : "#9aa0a6"} />
        <polygon points="10,10 10,14 14,12" fill="white" />
    </svg>
);

const AudioIcon = ({ active }: { active?: boolean }) => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="5" y="8" width="2.5" height="8" rx="1" fill={active ? "#34a853" : "#9aa0a6"} />
        <rect x="9" y="5" width="2.5" height="14" rx="1" fill={active ? "#34a853" : "#9aa0a6"} />
        <rect x="13" y="9" width="2.5" height="6" rx="1" fill={active ? "#34a853" : "#9aa0a6"} />
        <rect x="17" y="7" width="2.5" height="10" rx="1" fill={active ? "#34a853" : "#9aa0a6"} />
    </svg>
);

const MindmapIcon = ({ active }: { active?: boolean }) => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="3" fill={active ? "#4285f4" : "#9aa0a6"} />
        <circle cx="5" cy="7" r="2" fill={active ? "#4285f4" : "#9aa0a6"} fillOpacity="0.8" />
        <circle cx="19" cy="7" r="2" fill={active ? "#4285f4" : "#9aa0a6"} fillOpacity="0.8" />
        <circle cx="5" cy="17" r="2" fill={active ? "#4285f4" : "#9aa0a6"} fillOpacity="0.8" />
        <circle cx="19" cy="17" r="2" fill={active ? "#4285f4" : "#9aa0a6"} fillOpacity="0.8" />
        <line x1="9" y1="10" x2="7" y2="8" stroke={active ? "#4285f4" : "#9aa0a6"} strokeWidth="1.5" />
        <line x1="15" y1="10" x2="17" y2="8" stroke={active ? "#4285f4" : "#9aa0a6"} strokeWidth="1.5" />
        <line x1="9" y1="14" x2="7" y2="16" stroke={active ? "#4285f4" : "#9aa0a6"} strokeWidth="1.5" />
        <line x1="15" y1="14" x2="17" y2="16" stroke={active ? "#4285f4" : "#9aa0a6"} strokeWidth="1.5" />
    </svg>
);

const SimulationIcon = ({ active }: { active?: boolean }) => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* 3D Cube */}
        <path d="M12 2L4 6V18L12 22L20 18V6L12 2Z" fill={active ? "#ff6d01" : "#9aa0a6"} fillOpacity="0.3" />
        <path d="M12 2L20 6L12 10L4 6L12 2Z" fill={active ? "#ff6d01" : "#9aa0a6"} />
        <path d="M12 10V22" stroke={active ? "#ff6d01" : "#9aa0a6"} strokeWidth="1.5" />
        <path d="M4 6V18L12 22" stroke={active ? "#ff6d01" : "#9aa0a6"} strokeWidth="1.5" />
        <path d="M20 6V18L12 22" stroke={active ? "#ff6d01" : "#9aa0a6"} strokeWidth="1.5" />
        {/* Play indicator */}
        <circle cx="17" cy="17" r="4" fill={active ? "#34a853" : "#bdc1c6"} />
        <polygon points="16,15 16,19 19,17" fill="white" />
    </svg>
);

const RoboticsIcon = ({ active }: { active?: boolean }) => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Camera/Eye */}
        <circle cx="12" cy="10" r="6" fill={active ? "#00bcd4" : "#9aa0a6"} fillOpacity="0.2" stroke={active ? "#00bcd4" : "#9aa0a6"} strokeWidth="1.5" />
        <circle cx="12" cy="10" r="3" fill={active ? "#00bcd4" : "#9aa0a6"} />
        <circle cx="12" cy="10" r="1.2" fill="white" />
        {/* Detection rays */}
        <line x1="4" y1="6" x2="6" y2="8" stroke={active ? "#00bcd4" : "#9aa0a6"} strokeWidth="1.5" strokeLinecap="round" />
        <line x1="20" y1="6" x2="18" y2="8" stroke={active ? "#00bcd4" : "#9aa0a6"} strokeWidth="1.5" strokeLinecap="round" />
        {/* Bounding box indicator */}
        <rect x="3" y="17" width="7" height="5" rx="1" fill={active ? "#ff5722" : "#bdc1c6"} fillOpacity="0.8" />
        <rect x="14" y="17" width="7" height="5" rx="1" fill={active ? "#4caf50" : "#bdc1c6"} fillOpacity="0.8" />
    </svg>
);

const Viewer3DIcon = ({ active }: { active?: boolean }) => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* 3D Cube with perspective */}
        <path d="M12 2L3 7V17L12 22L21 17V7L12 2Z" fill={active ? "#7c3aed" : "#9aa0a6"} fillOpacity="0.2" stroke={active ? "#7c3aed" : "#9aa0a6"} strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M12 12L3 7M12 12L21 7M12 12V22" stroke={active ? "#7c3aed" : "#9aa0a6"} strokeWidth="1.5" strokeLinejoin="round" />
        {/* Hand gesture indicator */}
        <circle cx="18" cy="18" r="4" fill={active ? "#ec4899" : "#bdc1c6"} fillOpacity="0.9" />
        <path d="M16.5 18.5L17.5 17L18.5 18L19.5 16.5" stroke="white" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

const ImageActivityIcon = ({ active }: { active?: boolean }) => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Image frame */}
        <rect x="2" y="3" width="20" height="18" rx="2" fill={active ? "#f97316" : "#9aa0a6"} fillOpacity="0.2" stroke={active ? "#f97316" : "#9aa0a6"} strokeWidth="1.5" />
        {/* Interactive label indicators */}
        <circle cx="8" cy="10" r="1.5" fill={active ? "#06b6d4" : "#bdc1c6"} />
        <circle cx="16" cy="14" r="1.5" fill={active ? "#06b6d4" : "#bdc1c6"} />
        <rect x="5" y="15" width="3" height="2" rx="0.5" fill={active ? "#10b981" : "#bdc1c6"} />
        <rect x="14" y="8" width="3" height="2" rx="0.5" fill={active ? "#10b981" : "#bdc1c6"} />
        {/* Question mark in corner */}
        <circle cx="19" cy="6" r="2" fill={active ? "#f59e0b" : "#bdc1c6"} />
        <text x="19" y="7" fontSize="2" fill="white" textAnchor="middle" fontWeight="bold">?</text>
    </svg>
);

const CodeLabIcon = ({ active }: { active?: boolean }) => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Code editor window */}
        <rect x="2" y="3" width="20" height="18" rx="2" fill={active ? "#10b981" : "#9aa0a6"} fillOpacity="0.2" stroke={active ? "#10b981" : "#9aa0a6"} strokeWidth="1.5" />
        {/* Window controls */}
        <circle cx="5" cy="6" r="1" fill={active ? "#ef4444" : "#bdc1c6"} />
        <circle cx="8" cy="6" r="1" fill={active ? "#f59e0b" : "#bdc1c6"} />
        <circle cx="11" cy="6" r="1" fill={active ? "#22c55e" : "#bdc1c6"} />
        {/* Code lines */}
        <path d="M6 11L9 13L6 15" stroke={active ? "#10b981" : "#9aa0a6"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <line x1="11" y1="15" x2="18" y2="15" stroke={active ? "#60a5fa" : "#bdc1c6"} strokeWidth="1.5" strokeLinecap="round" />
        {/* Python snake indicator */}
        <circle cx="19" cy="6" r="2" fill={active ? "#3b82f6" : "#bdc1c6"} />
        <text x="19" y="7" fontSize="3" fill="white" textAnchor="middle" fontWeight="bold">🐍</text>
    </svg>
);

const AssignmentIcon = ({ active }: { active?: boolean }) => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="4" y="3" width="16" height="18" rx="2" fill={active ? "#8ab4f8" : "#9aa0a6"} fillOpacity="0.2" stroke={active ? "#8ab4f8" : "#9aa0a6"} strokeWidth="1.5" />
        <path d="M8 12L11 15L16 9" stroke={active ? "#1a73e8" : "white"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <line x1="8" y1="7" x2="16" y2="7" stroke={active ? "#1a73e8" : "white"} strokeWidth="1.5" strokeLinecap="round" />
        <line x1="8" y1="17" x2="12" y2="17" stroke={active ? "#1a73e8" : "white"} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
);

const ImmersiveLearning: React.FC<ImmersiveLearningProps> = ({ onClose, apiKey }) => {
    // Initialize Gemini Live
    const geminiLiveState = useGeminiLive(apiKey || '');

    // Dock characters for MessageDock
    const dockCharacters: Character[] = [
        { emoji: "✨", name: "Sparkle", online: false, backgroundColor: "bg-amber-200", gradientColors: "#fde68a, #fffbeb" },
        { emoji: "🧙‍♂️", name: "Wizard", online: true, backgroundColor: "bg-emerald-200 dark:bg-emerald-300", gradientColors: "#a7f3d0, #ecfdf5" },
        { emoji: "🦄", name: "Unicorn", online: true, backgroundColor: "bg-violet-200 dark:bg-violet-300", gradientColors: "#c4b5fd, #f5f3ff" },
        { emoji: "🐵", name: "Monkey", online: true, backgroundColor: "bg-amber-200 dark:bg-amber-300", gradientColors: "#fde68a, #fffbeb" },
        { emoji: "🤖", name: "Robot", online: false, backgroundColor: "bg-rose-200 dark:bg-rose-300", gradientColors: "#fecaca, #fef2f2" },
    ];

    // Handler for expanding learning canvas images
    const handleCanvasImageExpand = useCallback((image: LearningCanvasImage) => {
        if (!image || image.status !== 'complete' || !image.url) {
            return;
        }
        console.log('Canvas image expanded:', image);
    }, []);

    // ========== WORKSPACE MANAGEMENT TYPES (moved outside for hoisting) ==========
    // Note: Actual workspace state and functions are defined after all other state declarations

    const WORKSPACES_STORAGE_KEY = 'immersive_learning_workspaces';
    const ACTIVE_WORKSPACE_KEY = 'immersive_learning_active_workspace';

    const [savedWorkspaces, setSavedWorkspaces] = useState<Array<{
        id: string;
        name: string;
        description: string;
        createdAt: number;
        updatedAt: number;
        thumbnailEmoji: string;
        documentFileName: string;
        documentText: string;
        immersiveContent: ImmersiveContent | null;
        sectionImages: { [key: string]: string };
        widgetImages: { [key: string]: { before: string; after: string } };
        quiz: QuizQuestion[];
        audioScript: string | null;
        reactFlowData: ReactFlowData | null;
        relevantVideos: RankedYouTubeVideo[];
        pdfUrl: string | null;
        activeSectionId: string | null;
    }>>([]);
    const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
    const [isLoadingWorkspaces, setIsLoadingWorkspaces] = useState(false);
    const [showWorkspaceManager, setShowWorkspaceManager] = useState(false);
    const [isCreatingWorkspace, setIsCreatingWorkspace] = useState(false);
    const [workspaceSearchQuery, setWorkspaceSearchQuery] = useState('');

    const [activeMode, setActiveMode] = useState<LearningMode>('source'); // Start with workspace manager
    const [isLoading, setIsLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('');
    const [processingStage, setProcessingStage] = useState<'idle' | 'uploading' | 'extracting' | 'analyzing' | 'generating'>('idle');
    const [uploadedFileName, setUploadedFileName] = useState<string>('');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const quizRef = useRef<HTMLDivElement>(null);
    const [openFloatingQuiz, setOpenFloatingQuiz] = useState<number | null>(null);
    const [floatingQuizAnswer, setFloatingQuizAnswer] = useState<string | null>(null);
    const [floatingQuizData, setFloatingQuizData] = useState<QuizQuestion | null>(null);
    const [isLoadingFloatingQuiz, setIsLoadingFloatingQuiz] = useState(false);
    const [currentSectionIndex, setCurrentSectionIndex] = useState(0);

    // Terminal Progress State
    const [terminalSubSteps, setTerminalSubSteps] = useState<string[]>([]);

    // PDF Citation Sidebar State
    const [pdfUrl, setPdfUrl] = useState<string | null>(null);
    const [showPdfSidebar, setShowPdfSidebar] = useState(false);

    // Grounding Citation State (like Tutor)
    const [activeCitation, setActiveCitation] = useState<{ url: string; title: string; snippet?: string; pageNumber?: number; sectionId?: string } | null>(null);
    const [groundingSources, setGroundingSources] = useState<Array<{ url: string; title: string; snippet?: string }>>([]);
    const [activeSource, setActiveSource] = useState<{ url: string; title: string; snippet?: string } | null>(null);
    const [isLoadingGrounding, setIsLoadingGrounding] = useState(false);
    const [copied, setCopied] = useState(false);
    const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Helper function to match sources to paragraphs based on content similarity
    const getSourcesForParagraph = useCallback((paragraph: string, allSources: Array<{ url: string; title: string; snippet?: string }>, paragraphIndex: number, totalParagraphs: number): number[] => {
        if (!allSources.length) return [];

        const paragraphLower = paragraph.toLowerCase();
        const matchedIndices: number[] = [];

        // Check each source for relevance to this paragraph
        allSources.forEach((source, idx) => {
            // Check if source snippet or title relates to paragraph content
            const snippetLower = (source.snippet || '').toLowerCase();
            const titleLower = (source.title || '').toLowerCase();

            // Extract key terms from paragraph (words longer than 4 chars)
            const paragraphTerms = paragraphLower.match(/\b[a-z]{5,}\b/g) || [];

            // Check for term matches in snippet or title
            let matchScore = 0;
            paragraphTerms.forEach(term => {
                if (snippetLower.includes(term) || titleLower.includes(term)) {
                    matchScore++;
                }
            });

            // If decent match score, include this source for this paragraph
            if (matchScore >= 2) {
                matchedIndices.push(idx);
            }
        });

        // If no specific matches found, distribute sources evenly across paragraphs
        if (matchedIndices.length === 0 && allSources.length > 0) {
            // Distribute sources across paragraphs
            const sourcesPerParagraph = Math.ceil(allSources.length / totalParagraphs);
            const startIdx = paragraphIndex * sourcesPerParagraph;
            const endIdx = Math.min(startIdx + sourcesPerParagraph, allSources.length);

            for (let i = startIdx; i < endIdx; i++) {
                matchedIndices.push(i);
            }
        }

        return matchedIndices;
    }, []);

    // AI Content State
    const [immersiveContent, setImmersiveContent] = useState<ImmersiveContent | null>(null);
    const [sectionImages, setSectionImages] = useState<{ [key: string]: string }>({});
    const [loadingImages, setLoadingImages] = useState<{ [key: string]: boolean }>({}); // Track which images are loading
    const [widgetImages, setWidgetImages] = useState<{ [key: string]: { before?: string, after?: string } }>({});
    const [quiz, setQuiz] = useState<QuizQuestion[]>([]);
    const [audioScript, setAudioScript] = useState<string>('');
    const [mindMap, setMindMap] = useState<MindMapNode | null>(null);
    const [reactFlowData, setReactFlowData] = useState<ReactFlowData | null>(null);
    const [activeSectionId, setActiveSectionId] = useState<string>('');
    const [activeDefinition, setActiveDefinition] = useState<{ term: string, definition: string } | null>(null);
    const [quizAnswers, setQuizAnswers] = useState<{ [key: number]: number }>({}); // questionIndex -> selectedOptionIndex
    const [showQuizFeedback, setShowQuizFeedback] = useState<{ [key: number]: boolean }>({});
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [relevantVideos, setRelevantVideos] = useState<RankedYouTubeVideo[]>([]);
    const [selectedVideoIndex, setSelectedVideoIndex] = useState(0);
    const [isLoadingVideos, setIsLoadingVideos] = useState(false);

    // Enhanced Term Exploration State
    const [enhancedTermInfo, setEnhancedTermInfo] = useState<EnhancedTermInfo | null>(null);
    const [isLoadingEnhancedTerm, setIsLoadingEnhancedTerm] = useState(false);
    const [enhancedTermTab, setEnhancedTermTab] = useState<'definition' | 'deepDive' | 'brainTeaser' | 'quiz' | 'funFact'>('definition');
    const [brainTeaserRevealed, setBrainTeaserRevealed] = useState(false);
    const [enhancedQuizAnswer, setEnhancedQuizAnswer] = useState<number | null>(null);

    // Brainstorm Activity State
    const [brainstormActivity, setBrainstormActivity] = useState<BrainstormActivity | null>(null);
    const [isLoadingBrainstorm, setIsLoadingBrainstorm] = useState(false);
    const [showBrainstormHints, setShowBrainstormHints] = useState<boolean[]>([]);
    const [showBrainstormApproaches, setShowBrainstormApproaches] = useState(false);
    const [showBrainstormInsight, setShowBrainstormInsight] = useState(false);
    const [userBrainstormNotes, setUserBrainstormNotes] = useState('');

    // What-If Activity State
    const [whatIfActivity, setWhatIfActivity] = useState<WhatIfActivity | null>(null);
    const [isLoadingWhatIf, setIsLoadingWhatIf] = useState(false);
    const [revealedWhatIfs, setRevealedWhatIfs] = useState<{ [key: number]: boolean }>({});

    // Thoreo-style tabs for slides-narration
    const [videoContentTab, setVideoContentTab] = useState<'summary' | 'key-concepts' | 'transcript'>('summary');
    const [videoInteractiveTab, setVideoInteractiveTab] = useState<'chat' | 'quiz' | 'flashcards'>('chat');
    const [videoChatInput, setVideoChatInput] = useState('');

    // Video content state
    const [videoSummary, setVideoSummary] = useState<VideoSummary | null>(null);
    const [videoTranscript, setVideoTranscript] = useState<string | null>(null);
    const [isLoadingVideoSummary, setIsLoadingVideoSummary] = useState(false);
    const [isLoadingVideoTranscript, setIsLoadingVideoTranscript] = useState(false);
    const [videoChatMessages, setVideoChatMessages] = useState<VideoChatMessage[]>([]);
    const [isLoadingChatResponse, setIsLoadingChatResponse] = useState(false);
    const [videoQuiz, setVideoQuiz] = useState<QuizQuestion[]>([]);
    const [isLoadingVideoQuiz, setIsLoadingVideoQuiz] = useState(false);
    const [videoFlashcards, setVideoFlashcards] = useState<Flashcard[]>([]);
    const [isLoadingFlashcards, setIsLoadingFlashcards] = useState(false);
    const [currentFlashcardIndex, setCurrentFlashcardIndex] = useState(0);
    const [isFlashcardFlipped, setIsFlashcardFlipped] = useState(false);
    const [videoQuizAnswers, setVideoQuizAnswers] = useState<{ [key: number]: number }>({});
    const [showVideoQuizFeedback, setShowVideoQuizFeedback] = useState<{ [key: number]: boolean }>({});
    const [currentVideoQuizIndex, setCurrentVideoQuizIndex] = useState(0);
    const chatContainerRef = useRef<HTMLDivElement>(null);

    // Streaming state for real-time content generation
    const [isStreaming, setIsStreaming] = useState(false);
    const [streamedContent, setStreamedContent] = useState('');

    // Audio Lesson State
    const [podcastScript, setPodcastScript] = useState<string | null>(null);
    const [podcastAudio, setPodcastAudio] = useState<ArrayBuffer | null>(null);
    const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
    const [isGeneratingScript, setIsGeneratingScript] = useState(false);
    const [isPlayingAudio, setIsPlayingAudio] = useState(false);
    const [audioProgress, setAudioProgress] = useState(0);
    const [audioDuration, setAudioDuration] = useState(0);
    const audioContextRef = useRef<AudioContext | null>(null);
    const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
    const startTimeRef = useRef<number>(0);
    const pauseTimeRef = useRef<number>(0);
    const animationFrameRef = useRef<number>(0);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [audioGenerationError, setAudioGenerationError] = useState(false);

    // Simulation State
    const [simulationBlueprint, setSimulationBlueprint] = useState<SimulationBlueprint | null>(null);
    const [simulationHTML, setSimulationHTML] = useState<string | null>(null);
    const [isGeneratingSimulation, setIsGeneratingSimulation] = useState(false);
    const [simulationProgress, setSimulationProgress] = useState<string>('');
    const [simulationProgressSteps, setSimulationProgressSteps] = useState<{ step: string, status: 'pending' | 'active' | 'done' }[]>([]);
    const [simulationError, setSimulationError] = useState<string | null>(null);
    const [isSimulationFullscreen, setIsSimulationFullscreen] = useState(true);
    const simulationIframeRef = useRef<HTMLIFrameElement>(null);
    const documentTextRef = useRef<string>(''); // Store document text for simulation generation

    // Robotics Vision State
    const [isWebcamActive, setIsWebcamActive] = useState(false);
    const [webcamError, setWebcamError] = useState<string | null>(null);
    const [webcamStream, setWebcamStream] = useState<MediaStream | null>(null);
    const [detectedObjects, setDetectedObjects] = useState<DetectedObject[]>([]);
    const [boundingBoxes, setBoundingBoxes] = useState<BoundingBox[]>([]);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [activeTab, setActiveTab] = useState<'subject' | 'simulator' | 'research' | 'coach' | 'latex' | 'assignment'>('subject');
    const [analysisMode, setAnalysisMode] = useState<'detect' | 'boxes' | 'classify' | 'count' | 'question' | 'hand'>('detect');
    const [roboticsQuery, setRoboticsQuery] = useState('');
    const [sceneDescription, setSceneDescription] = useState<string | null>(null);
    const [countResult, setCountResult] = useState<{ count: number; objects: DetectedObject[] } | null>(null);
    const [classificationResult, setClassificationResult] = useState<{ label: string; attributes: string[]; point: [number, number] }[] | null>(null);
    const [isAutoAnalyzing, setIsAutoAnalyzing] = useState(false);
    const [analysisInterval, setAnalysisInterval] = useState<number>(300); // ms between auto-analyses (fast for real-time)
    const [isRoboticsHandTracking, setIsRoboticsHandTracking] = useState(false);
    const [handLandmarks, setHandLandmarks] = useState<Array<{ x: number, y: number, z: number }> | null>(null);
    const webcamRef = useRef<HTMLVideoElement>(null);
    const webcamCanvasRef = useRef<HTMLCanvasElement>(null);
    const autoAnalysisRef = useRef<NodeJS.Timeout | null>(null);
    const handLandmarkerRef = useRef<any>(null);
    const handTrackingLoopRef = useRef<number | null>(null);

    // 3D Object Viewer State
    const [viewer3dWebcamActive, setViewer3dWebcamActive] = useState(false);
    const [viewer3dWebcamStream, setViewer3dWebcamStream] = useState<MediaStream | null>(null);
    const [viewer3dInteractionMode, setViewer3dInteractionMode] = useState<'drag' | 'rotate' | 'scale' | 'animate'>('rotate');
    const [viewer3dHandLandmarks, setViewer3dHandLandmarks] = useState<Array<Array<{ x: number, y: number, z: number }>>>([]);
    const [viewer3dSmoothedLandmarks, setViewer3dSmoothedLandmarks] = useState<Array<Array<{ x: number, y: number, z: number }>>>([]);
    const [viewer3dModelUrl, setViewer3dModelUrl] = useState<string | null>(null);
    const [viewer3dModelName, setViewer3dModelName] = useState<string>('');
    const [viewer3dRotation, setViewer3dRotation] = useState({ x: 0, y: 0, z: 0 });
    const [viewer3dPosition, setViewer3dPosition] = useState({ x: 0, y: 0, z: 0 });
    const [viewer3dScale, setViewer3dScale] = useState(1);
    const [viewer3dIsPinching, setViewer3dIsPinching] = useState<[boolean, boolean]>([false, false]);
    const [viewer3dPinchPositions, setViewer3dPinchPositions] = useState<[{ x: number, y: number } | null, { x: number, y: number } | null]>([null, null]);
    const [viewer3dModelQuery, setViewer3dModelQuery] = useState('');
    const [viewer3dAnimationIndex, setViewer3dAnimationIndex] = useState(0);
    const [viewer3dIsDraggingFile, setViewer3dIsDraggingFile] = useState(false);
    const [viewer3dVoiceActive, setViewer3dVoiceActive] = useState(false);
    const [viewer3dVoiceTranscript, setViewer3dVoiceTranscript] = useState('');
    const [viewer3dIsGrabbing, setViewer3dIsGrabbing] = useState(false);
    const [viewer3dGrabPulse, setViewer3dGrabPulse] = useState(0);
    const viewer3dVideoRef = useRef<HTMLVideoElement>(null);
    const viewer3dCanvasRef = useRef<HTMLCanvasElement>(null);
    const viewer3dThreeCanvasRef = useRef<HTMLCanvasElement>(null);
    const viewer3dHandLandmarkerRef = useRef<any>(null);
    const viewer3dTrackingLoopRef = useRef<number | null>(null);
    const viewer3dSceneRef = useRef<any>(null);
    const viewer3dRendererRef = useRef<any>(null);
    const viewer3dCameraRef = useRef<any>(null);
    const viewer3dModelRef = useRef<any>(null);
    const viewer3dFileInputRef = useRef<HTMLInputElement>(null);
    const viewer3dSpeechRef = useRef<any>(null);
    const viewer3dPrevLandmarksRef = useRef<Array<Array<{ x: number, y: number, z: number }>>>([]);
    // Refs for gesture tracking (to avoid stale closures in animation loop)
    const viewer3dInteractionModeRef = useRef<'drag' | 'rotate' | 'scale' | 'animate'>('rotate');
    const viewer3dLastPinchPositionRef = useRef<{ x: number, y: number } | null>(null);
    const viewer3dLastPinchDistanceRef = useRef<number | null>(null);
    const viewer3dLastPinchYRef = useRef<number | null>(null);

    // Code Lab IDE state
    const [codeLabFiles, setCodeLabFiles] = useState<CodeLabFile[]>(() => [
        {
            id: 'py',
            name: 'main.py',
            language: 'python',
            content: 'print("Hello from Code Lab")\nfor i in range(3):\n    print(f"Iteration {i}")'
        },
        {
            id: 'js',
            name: 'index.js',
            language: 'javascript',
            content: 'console.log("Hello from Code Lab JS")\nconst nums = [1,2,3];\nconsole.log(nums.map(n => n * 2));'
        },
        {
            id: 'java',
            name: 'App.java',
            language: 'java',
            content: 'public class App {\n    public static void main(String[] args) {\n        System.out.println("Hello from Code Lab Java");\n    }\n}'
        },
        {
            id: 'cpp',
            name: 'main.cpp',
            language: 'cpp',
            content: '#include <iostream>\nint main() {\n    std::cout << "Hello from Code Lab C++" << std::endl;\n    return 0;\n}'
        }
    ]);
    const [codeLabActiveFileId, setCodeLabActiveFileId] = useState<string>('py');
    const [codeLabCode, setCodeLabCode] = useState<string>(() => 'print("Hello from Code Lab")\nfor i in range(3):\n    print(f"Iteration {i}")');
    const [codeLabLanguage, setCodeLabLanguage] = useState<CodeLabLanguage>('python');
    const [codeLabTheme, setCodeLabTheme] = useState<'vscode' | 'dracula'>('vscode');
    const [codeLabOutput, setCodeLabOutput] = useState<string>('');
    const [codeLabIsRunning, setCodeLabIsRunning] = useState(false);
    const [codeLabAiPrompt, setCodeLabAiPrompt] = useState<string>('Improve or extend this code');
    const [codeLabAiResponse, setCodeLabAiResponse] = useState<string>('');
    const [codeLabAiLoading, setCodeLabAiLoading] = useState<boolean>(false);
    const [codeLabAiStreaming, setCodeLabAiStreaming] = useState<boolean>(false);
    const [codeLabAiError, setCodeLabAiError] = useState<string | null>(null);

    useEffect(() => {
        const activeFile = codeLabFiles.find(file => file.id === codeLabActiveFileId);
        if (activeFile) {
            setCodeLabCode(activeFile.content);
            setCodeLabLanguage(activeFile.language);
        }
        // Only run when switching active file to avoid cursor resets on each keystroke
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [codeLabActiveFileId]);

    // Image Activity State
    const [imageActivityPrompt, setImageActivityPrompt] = useState('');
    const [generatedImageActivityUrl, setGeneratedImageActivityUrl] = useState<string | null>(null);
    const [isGeneratingImageActivity, setIsGeneratingImageActivity] = useState(false);

    // LocalStorage key for persisting immersive learning content
    const STORAGE_KEY = 'immersive_learning_content';

    // Track if we need to continue generating missing content after restore
    const [needsContinueGeneration, setNeedsContinueGeneration] = useState(false);

    // ========== WORKSPACE MANAGEMENT FUNCTIONS ==========

    // Generate intelligent workspace name using Gemini
    const generateWorkspaceName = async (content: ImmersiveContent | null, fileName: string): Promise<{ name: string; description: string; emoji: string }> => {
        try {
            const contentSummary = content?.sections?.slice(0, 3).map(s => s.title || s.content.slice(0, 100)).join(', ') || '';
            const prompt = `Based on this educational content about "${content?.title || fileName}", generate a concise workspace name.
Content preview: ${contentSummary.slice(0, 300)}

Respond in JSON format only:
{
  "name": "Short creative name (2-4 words max)",
  "description": "One sentence description of the topic",
  "emoji": "Single relevant emoji"
}`;

            const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + import.meta.env.VITE_GEMINI_API_KEY, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { temperature: 0.7 }
                })
            });

            const data = await response.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                return {
                    name: parsed.name || fileName.replace(/\.[^/.]+$/, ''),
                    description: parsed.description || 'Learning workspace',
                    emoji: parsed.emoji || '📚'
                };
            }
        } catch (e) {
            console.error('Failed to generate workspace name:', e);
        }
        return {
            name: fileName.replace(/\.[^/.]+$/, '') || 'Untitled',
            description: 'Learning workspace',
            emoji: '📚'
        };
    };

    // Save current state as a new workspace
    const saveCurrentAsWorkspace = async () => {
        if (!immersiveContent || !documentTextRef.current) {
            console.log('No content to save as workspace');
            return null;
        }

        setIsCreatingWorkspace(true);
        try {
            const { name, description, emoji } = await generateWorkspaceName(immersiveContent, uploadedFileName);

            const workspace = {
                id: `workspace_${Date.now()}_${Math.random().toString(36).substring(7)}`,
                name,
                description,
                createdAt: Date.now(),
                updatedAt: Date.now(),
                thumbnailEmoji: emoji,
                documentFileName: uploadedFileName,
                documentText: documentTextRef.current,
                immersiveContent,
                sectionImages,
                widgetImages,
                quiz,
                audioScript: audioScript || null,
                reactFlowData,
                relevantVideos,
                pdfUrl,
                activeSectionId: activeSectionId || null
            };

            const existingWorkspaces = JSON.parse(localStorage.getItem(WORKSPACES_STORAGE_KEY) || '[]');
            const updatedWorkspaces = [workspace, ...existingWorkspaces];
            localStorage.setItem(WORKSPACES_STORAGE_KEY, JSON.stringify(updatedWorkspaces));
            localStorage.setItem(ACTIVE_WORKSPACE_KEY, workspace.id);

            setSavedWorkspaces(updatedWorkspaces);
            setActiveWorkspaceId(workspace.id);
            setShowWorkspaceManager(false);

            console.log('💾 Saved new workspace:', workspace.name);
            return workspace;
        } catch (e) {
            console.error('Failed to save workspace:', e);
            return null;
        } finally {
            setIsCreatingWorkspace(false);
        }
    };

    // Save workspace with provided content (for async calls where state might not be updated)
    const saveWorkspaceWithContent = async (content: ImmersiveContent, fileName: string, docText: string) => {
        if (!content) {
            console.log('No content provided to save as workspace');
            return null;
        }

        setIsCreatingWorkspace(true);
        try {
            const { name, description, emoji } = await generateWorkspaceName(content, fileName);

            const workspace = {
                id: `workspace_${Date.now()}_${Math.random().toString(36).substring(7)}`,
                name,
                description,
                createdAt: Date.now(),
                updatedAt: Date.now(),
                thumbnailEmoji: emoji,
                documentFileName: fileName,
                documentText: docText,
                immersiveContent: content,
                sectionImages: {},
                widgetImages: {},
                quiz: [],
                audioScript: null,
                reactFlowData: null,
                relevantVideos: [],
                pdfUrl: null,
                activeSectionId: content.sections?.[0]?.id || null
            };

            const existingWorkspaces = JSON.parse(localStorage.getItem(WORKSPACES_STORAGE_KEY) || '[]');
            const updatedWorkspaces = [workspace, ...existingWorkspaces];
            localStorage.setItem(WORKSPACES_STORAGE_KEY, JSON.stringify(updatedWorkspaces));
            localStorage.setItem(ACTIVE_WORKSPACE_KEY, workspace.id);

            setSavedWorkspaces(updatedWorkspaces);
            setActiveWorkspaceId(workspace.id);

            console.log('💾 Saved new workspace with content:', workspace.name);
            return workspace;
        } catch (e) {
            console.error('Failed to save workspace with content:', e);
            return null;
        } finally {
            setIsCreatingWorkspace(false);
        }
    };

    // Update existing workspace with current state
    const updateWorkspace = (workspaceId: string) => {
        const updatedWorkspaces = savedWorkspaces.map(ws => {
            if (ws.id === workspaceId) {
                return {
                    ...ws,
                    updatedAt: Date.now(),
                    immersiveContent,
                    sectionImages,
                    widgetImages,
                    quiz,
                    audioScript: audioScript || null,
                    reactFlowData,
                    relevantVideos,
                    pdfUrl,
                    activeSectionId: activeSectionId || null
                };
            }
            return ws;
        });
        localStorage.setItem(WORKSPACES_STORAGE_KEY, JSON.stringify(updatedWorkspaces));
        setSavedWorkspaces(updatedWorkspaces);
    };

    // Open an existing workspace
    const openWorkspace = (workspace: typeof savedWorkspaces[0]) => {
        console.log('📂 Opening workspace:', workspace.name);

        // Restore all state from workspace
        documentTextRef.current = workspace.documentText;
        setImmersiveContent(workspace.immersiveContent);
        setSectionImages(workspace.sectionImages || {});
        setWidgetImages(workspace.widgetImages || {});
        setQuiz(workspace.quiz || []);
        setAudioScript(workspace.audioScript || '');
        setReactFlowData(workspace.reactFlowData);
        setRelevantVideos(workspace.relevantVideos || []);
        setPdfUrl(workspace.pdfUrl);
        setUploadedFileName(workspace.documentFileName);
        setActiveSectionId(workspace.activeSectionId || workspace.immersiveContent?.sections?.[0]?.id || '');

        setActiveWorkspaceId(workspace.id);
        localStorage.setItem(ACTIVE_WORKSPACE_KEY, workspace.id);
        setShowWorkspaceManager(false);
        setActiveMode('immersive-text'); // Switch to content view
    };

    // Delete a workspace
    const deleteWorkspace = (workspaceId: string) => {
        const updatedWorkspaces = savedWorkspaces.filter(ws => ws.id !== workspaceId);
        localStorage.setItem(WORKSPACES_STORAGE_KEY, JSON.stringify(updatedWorkspaces));
        setSavedWorkspaces(updatedWorkspaces);

        if (activeWorkspaceId === workspaceId) {
            setActiveWorkspaceId(null);
            localStorage.removeItem(ACTIVE_WORKSPACE_KEY);
        }
    };

    // Create new workspace (reset state and trigger file upload)
    const createNewWorkspace = () => {
        setImmersiveContent(null);
        setSectionImages({});
        setWidgetImages({});
        setQuiz([]);
        setAudioScript('');
        setReactFlowData(null);
        setRelevantVideos([]);
        setPdfUrl(null);
        setUploadedFileName('');
        setActiveSectionId('');
        documentTextRef.current = '';
        setActiveWorkspaceId(null);
        localStorage.removeItem(ACTIVE_WORKSPACE_KEY);
        // Don't hide workspace manager - stay on source page and trigger file upload
        // setShowWorkspaceManager(false);
        // Trigger file upload dialog
        setTimeout(() => {
            fileInputRef.current?.click();
        }, 100);
    };

    // Load workspaces on mount - DISABLED per user request
    /*
    useEffect(() => {
        try {
            const saved = localStorage.getItem(WORKSPACES_STORAGE_KEY);
            if (saved) {
                const workspaces = JSON.parse(saved);
                setSavedWorkspaces(workspaces);
                setIsLoadingWorkspaces(false);
            } else {
                setIsLoadingWorkspaces(false);
            }
        } catch (e) {
            console.error('Failed to load workspaces:', e);
            setIsLoadingWorkspaces(false);
        } finally {
            setIsLoadingWorkspaces(false);
        }
    }, []);
    */

    // Auto-save to active workspace when content changes - DISABLED per user request (no storage)
    /*
    useEffect(() => {
        if (activeWorkspaceId && immersiveContent) {
           // ... logic removed ...
        }
    }, [activeWorkspaceId, immersiveContent, sectionImages, quiz, audioScript, reactFlowData, relevantVideos]);
    */

    // Load saved content from localStorage on mount - DISABLED per user request (always fresh start)
    /*
    useEffect(() => {
        try {
            // ... restore logic removed ...
            console.log('✅ Content restored successfully!');
        } catch (e) {
            console.error('Failed to restore content:', e);
        }
    }, []);
    */


    // Continue generating missing components after restore
    useEffect(() => {
        if (!needsContinueGeneration || !immersiveContent || !documentTextRef.current) {
            return;
        }

        // Reset the flag immediately to prevent multiple runs
        setNeedsContinueGeneration(false);

        const text = documentTextRef.current;
        const missingComponents: string[] = [];

        // Check what's missing and needs to be generated
        const needsImages = Object.keys(sectionImages).length === 0 &&
            immersiveContent.sections.some(s => s.imagePrompt);
        const needsQuiz = quiz.length === 0;
        const needsAudio = !audioScript;
        const needsMindMap = !reactFlowData;
        const needsVideos = relevantVideos.length === 0;

        if (needsImages) missingComponents.push('images');
        if (needsQuiz) missingComponents.push('quiz');
        if (needsAudio) missingComponents.push('audio script');
        if (needsMindMap) missingComponents.push('mind map');
        if (needsVideos) missingComponents.push('videos');

        if (missingComponents.length === 0) {
            console.log('✅ All components already generated, nothing to continue.');
            return;
        }

        console.log(`🔄 Continuing generation of missing components: ${missingComponents.join(', ')}`);

        // Generate missing images
        const generateMissingImages = async () => {
            if (!needsImages) return;

            const MAX_IMAGES_PER_PAGE = 1;
            let imagesGenerated = 0;
            const sectionsWithImages = immersiveContent.sections.filter(s => s.imagePrompt);

            if (sectionsWithImages.length > 0) {
                const loadingState: { [key: string]: boolean } = {};
                loadingState[sectionsWithImages[0].id] = true;
                setLoadingImages(loadingState);
            }

            for (const section of immersiveContent.sections) {
                if (imagesGenerated >= MAX_IMAGES_PER_PAGE) break;
                if (section.imagePrompt && !sectionImages[section.id]) {
                    try {
                        console.log(`🖼️ Generating missing image for section: ${section.id}`);
                        const imageUrl = await generateImmersiveImage(section.imagePrompt);
                        setSectionImages(prev => ({ ...prev, [section.id]: imageUrl }));
                        setLoadingImages(prev => ({ ...prev, [section.id]: false }));
                        imagesGenerated++;
                    } catch (e) {
                        console.error("Failed to generate image for section", section.id, e);
                        setLoadingImages(prev => ({ ...prev, [section.id]: false }));
                    }
                }
            }
        };

        // Generate missing quiz
        const generateMissingQuiz = async () => {
            if (!needsQuiz) return;
            try {
                console.log('📝 Generating missing quiz...');
                const generatedQuiz = await generateImmersiveQuiz(text);
                setQuiz(generatedQuiz);
            } catch (e) {
                console.error('Failed to generate quiz:', e);
            }
        };

        // Generate missing audio script
        const generateMissingAudio = async () => {
            if (!needsAudio) return;
            try {
                console.log('🎙️ Generating missing audio script...');
                const script = await generateAudioScript(text);
                setAudioScript(script);
            } catch (e) {
                console.error('Failed to generate audio script:', e);
            }
        };

        // Generate missing mind map
        const generateMissingMindMap = async () => {
            if (!needsMindMap) return;
            try {
                console.log('🗺️ Generating missing mind map...');
                const data = await generateReactFlowData(text);
                setReactFlowData(data);
            } catch (e) {
                console.error('Failed to generate mind map:', e);
            }
        };

        // Fetch missing videos
        const fetchMissingVideos = async () => {
            if (!needsVideos) return;
            setIsLoadingVideos(true);
            try {
                console.log('🎬 Fetching missing YouTube videos...');
                const videos = await fetchAndRankYouTubeVideos(text);
                setRelevantVideos(videos);
                console.log('Found relevant videos:', videos.length);
            } catch (e) {
                console.warn('Failed to fetch YouTube videos:', e);
            } finally {
                setIsLoadingVideos(false);
            }
        };

        // Run all missing component generation in parallel
        Promise.all([
            generateMissingImages(),
            generateMissingQuiz(),
            generateMissingAudio(),
            generateMissingMindMap(),
            fetchMissingVideos()
        ]).then(() => {
            console.log('✅ All missing components generated!');
        }).catch(e => {
            console.error('Some component generation failed:', e);
        });

    }, [needsContinueGeneration, immersiveContent, sectionImages, quiz, audioScript, reactFlowData, relevantVideos]);

    // Save content to localStorage whenever it changes
    useEffect(() => {
        // Only save if we have actual content
        if (immersiveContent && immersiveContent.sections?.length > 0) {
            try {
                const dataToSave = {
                    immersiveContent,
                    documentText: documentTextRef.current,
                    sectionImages,
                    widgetImages,
                    activeSectionId,
                    uploadedFileName,
                    pdfUrl,
                    // Also save generated content
                    quiz,
                    audioScript,
                    reactFlowData,
                    relevantVideos,
                    savedAt: new Date().toISOString()
                };
                localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
                console.log('💾 Content saved to localStorage');
            } catch (error) {
                console.error('Failed to save content:', error);
                // If storage is full, try to clear old data
                if (error instanceof DOMException && error.name === 'QuotaExceededError') {
                    console.warn('Storage quota exceeded, clearing old data...');
                    localStorage.removeItem(STORAGE_KEY);
                }
            }
        }
    }, [immersiveContent, sectionImages, widgetImages, activeSectionId, uploadedFileName, pdfUrl, quiz, audioScript, reactFlowData, relevantVideos]);

    // Keep refs in sync with state
    useEffect(() => {
        viewer3dInteractionModeRef.current = viewer3dInteractionMode;
    }, [viewer3dInteractionMode]);

    // Audio Lesson Logic
    const handleGeneratePodcast = async () => {
        if (!immersiveContent) return;

        // Skip if already generated or currently generating
        if (podcastScript || isGeneratingScript || isGeneratingAudio) {
            console.log('Podcast already exists or is being generated, skipping...');
            return;
        }

        let script = '';

        // Derive a meaningful topic from the content
        const topic = immersiveContent.title
            || immersiveContent.sections[0]?.title
            || 'Educational Discussion';

        // 1. Generate Script (use separate loading state, not global isLoading)
        setIsGeneratingScript(true);
        try {
            script = await generatePodcastScript(
                topic,
                immersiveContent.sections.map(s => s.content).join('\n\n')
            );
            setPodcastScript(script);
        } catch (error) {
            console.error('Failed to generate podcast script:', error);
            setIsGeneratingScript(false);
            return;
        } finally {
            setIsGeneratingScript(false);
        }

        // 2. Generate Audio
        setIsGeneratingAudio(true);
        setAudioGenerationError(false);
        try {
            const audioData = await generatePodcastAudio(script);
            setPodcastAudio(audioData);

            // Initialize Audio Context
            if (!audioContextRef.current) {
                audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
            }

            // Decode audio data to get duration
            const audioBuffer = await audioContextRef.current.decodeAudioData(audioData.slice(0));
            setAudioDuration(audioBuffer.duration);

        } catch (error) {
            console.error('Failed to generate podcast audio:', error);
            setAudioGenerationError(true);
        } finally {
            setIsGeneratingAudio(false);
        }
    };

    const toggleAudioPlayback = async () => {
        if (!podcastAudio || !audioContextRef.current) return;

        if (isPlayingAudio) {
            // Pause
            if (audioSourceRef.current) {
                audioSourceRef.current.stop();
                audioSourceRef.current = null;
            }
            pauseTimeRef.current = audioContextRef.current.currentTime - startTimeRef.current;
            setIsPlayingAudio(false);
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        } else {
            // Play
            if (audioContextRef.current.state === 'suspended') {
                await audioContextRef.current.resume();
            }

            const source = audioContextRef.current.createBufferSource();
            const analyser = audioContextRef.current.createAnalyser();
            analyser.fftSize = 256;
            analyserRef.current = analyser;

            const audioBuffer = await audioContextRef.current.decodeAudioData(podcastAudio.slice(0));
            source.buffer = audioBuffer;

            // Connect source -> analyser -> destination
            source.connect(analyser);
            analyser.connect(audioContextRef.current.destination);

            const offset = pauseTimeRef.current % audioBuffer.duration;
            source.start(0, offset);
            startTimeRef.current = audioContextRef.current.currentTime - offset;
            audioSourceRef.current = source;

            setIsPlayingAudio(true);

            // Update progress and draw waveform
            const updateProgress = () => {
                if (audioContextRef.current && analyserRef.current && canvasRef.current) {
                    const elapsed = audioContextRef.current.currentTime - startTimeRef.current;
                    setAudioProgress(elapsed);

                    // Draw Waveform
                    const canvas = canvasRef.current;
                    const canvasCtx = canvas.getContext('2d');
                    if (canvasCtx) {
                        const bufferLength = analyserRef.current.frequencyBinCount;
                        const dataArray = new Uint8Array(bufferLength);
                        analyserRef.current.getByteTimeDomainData(dataArray);

                        canvasCtx.fillStyle = '#ffffff'; // Clear with white (or transparent)
                        canvasCtx.fillRect(0, 0, canvas.width, canvas.height);

                        canvasCtx.lineWidth = 2;
                        canvasCtx.strokeStyle = '#1e8e3e'; // Green color
                        canvasCtx.beginPath();

                        const sliceWidth = (canvas.width * 1.0) / bufferLength;
                        let x = 0;

                        for (let i = 0; i < bufferLength; i++) {
                            const v = dataArray[i] / 128.0;
                            const y = (v * canvas.height) / 2;

                            if (i === 0) {
                                canvasCtx.moveTo(x, y);
                            } else {
                                canvasCtx.lineTo(x, y);
                            }

                            x += sliceWidth;
                        }

                        canvasCtx.lineTo(canvas.width, canvas.height / 2);
                        canvasCtx.stroke();
                    }

                    if (elapsed < audioDuration) {
                        animationFrameRef.current = requestAnimationFrame(updateProgress);
                    } else {
                        setIsPlayingAudio(false);
                        setAudioProgress(0);
                        startTimeRef.current = 0;
                        pauseTimeRef.current = 0;
                    }
                }
            };
            animationFrameRef.current = requestAnimationFrame(updateProgress);
        }
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // Simulation Generation Logic
    const handleGenerateSimulation = async () => {
        if (!immersiveContent || !documentTextRef.current) {
            setSimulationError('Please upload a document first');
            return;
        }

        // Skip if already generated or generating
        if (simulationHTML || isGeneratingSimulation) {
            console.log('Simulation already exists or is being generated, skipping...');
            return;
        }

        setIsGeneratingSimulation(true);
        setSimulationError(null);
        setSimulationProgress('Initializing simulation generation...');

        // Initialize progress steps
        setSimulationProgressSteps([
            { step: 'Connecting to Gemini AI', status: 'active' },
            { step: 'Analyzing document content', status: 'pending' },
            { step: 'Designing simulation blueprint', status: 'pending' },
            { step: 'Setting up physics engine', status: 'pending' },
            { step: 'Generating 3D visualization', status: 'pending' },
            { step: 'Adding interactive controls', status: 'pending' },
            { step: 'Finalizing simulation', status: 'pending' }
        ]);

        try {
            const topic = immersiveContent.title || 'Educational Simulation';

            const result = await generateSimulation(
                documentTextRef.current,
                topic,
                (stage) => {
                    setSimulationProgress(stage);
                    // Update progress steps based on stage message
                    setSimulationProgressSteps(prev => {
                        const updated = [...prev];
                        // Mark steps as done based on progress
                        if (stage.toLowerCase().includes('connect') || stage.toLowerCase().includes('initial')) {
                            updated[0] = { ...updated[0], status: 'done' };
                            updated[1] = { ...updated[1], status: 'active' };
                        }
                        if (stage.toLowerCase().includes('analyz') || stage.toLowerCase().includes('document')) {
                            updated[0] = { ...updated[0], status: 'done' };
                            updated[1] = { ...updated[1], status: 'done' };
                            updated[2] = { ...updated[2], status: 'active' };
                        }
                        if (stage.toLowerCase().includes('blueprint') || stage.toLowerCase().includes('design')) {
                            updated[0] = { ...updated[0], status: 'done' };
                            updated[1] = { ...updated[1], status: 'done' };
                            updated[2] = { ...updated[2], status: 'done' };
                            updated[3] = { ...updated[3], status: 'active' };
                        }
                        if (stage.toLowerCase().includes('physics') || stage.toLowerCase().includes('logic')) {
                            updated[0] = { ...updated[0], status: 'done' };
                            updated[1] = { ...updated[1], status: 'done' };
                            updated[2] = { ...updated[2], status: 'done' };
                            updated[3] = { ...updated[3], status: 'done' };
                            updated[4] = { ...updated[4], status: 'active' };
                        }
                        if (stage.toLowerCase().includes('visual') || stage.toLowerCase().includes('html') || stage.toLowerCase().includes('3d')) {
                            updated[0] = { ...updated[0], status: 'done' };
                            updated[1] = { ...updated[1], status: 'done' };
                            updated[2] = { ...updated[2], status: 'done' };
                            updated[3] = { ...updated[3], status: 'done' };
                            updated[4] = { ...updated[4], status: 'done' };
                            updated[5] = { ...updated[5], status: 'active' };
                        }
                        if (stage.toLowerCase().includes('control') || stage.toLowerCase().includes('interact')) {
                            updated[0] = { ...updated[0], status: 'done' };
                            updated[1] = { ...updated[1], status: 'done' };
                            updated[2] = { ...updated[2], status: 'done' };
                            updated[3] = { ...updated[3], status: 'done' };
                            updated[4] = { ...updated[4], status: 'done' };
                            updated[5] = { ...updated[5], status: 'done' };
                            updated[6] = { ...updated[6], status: 'active' };
                        }
                        if (stage.toLowerCase().includes('final') || stage.toLowerCase().includes('complete')) {
                            return updated.map(s => ({ ...s, status: 'done' as const }));
                        }
                        return updated;
                    });
                }
            );

            // Mark all steps as done
            setSimulationProgressSteps(prev => prev.map(s => ({ ...s, status: 'done' as const })));
            setSimulationBlueprint(result.blueprint);
            setSimulationHTML(result.html);
            setSimulationProgress('');
            console.log('✅ Simulation generated successfully');
        } catch (error: any) {
            console.error('Failed to generate simulation:', error);
            setSimulationError(error.message || 'Failed to generate simulation');
            setSimulationProgress('');
            setSimulationProgressSteps([]);
        } finally {
            setIsGeneratingSimulation(false);
        }
    };

    const handleRegenerateSimulation = () => {
        setSimulationBlueprint(null);
        setSimulationHTML(null);
        setSimulationError(null);
        setSimulationProgressSteps([]);
        // Will trigger regeneration when user clicks generate button
    };

    const toggleSimulationFullscreen = () => {
        setIsSimulationFullscreen(!isSimulationFullscreen);
    };

    // ========== ROBOTICS VISION HANDLERS ==========

    const startWebcam = async () => {
        try {
            setWebcamError(null);
            console.log('🎥 Requesting webcam access...');

            // Get camera stream
            const stream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: false
            });

            console.log('🎥 Got stream:', stream);
            console.log('🎥 Video tracks:', stream.getVideoTracks());

            // Store stream in state - this will trigger re-render with video element
            setWebcamStream(stream);
            setIsWebcamActive(true);
            console.log('🎥 Webcam state set to active');

        } catch (error: any) {
            console.error('Failed to start webcam:', error);
            let errorMessage = 'Failed to access webcam: ' + (error.message || error.name || 'Unknown error');
            if (error.name === 'NotAllowedError') {
                errorMessage = 'Camera access denied. Please allow camera permissions and refresh the page.';
            } else if (error.name === 'NotFoundError') {
                errorMessage = 'No camera found on this device.';
            } else if (error.name === 'NotReadableError') {
                errorMessage = 'Camera is in use by another application.';
            } else if (error.name === 'OverconstrainedError') {
                errorMessage = 'Camera constraints not supported.';
            }
            setWebcamError(errorMessage);
        }
    };

    // Effect to assign stream to video element when both are ready
    useEffect(() => {
        if (webcamStream && webcamRef.current && isWebcamActive) {
            console.log('🎥 Assigning stream to video element');
            webcamRef.current.srcObject = webcamStream;
            webcamRef.current.play().then(() => {
                console.log('🎥 Video playing, starting real-time analysis...');
                // Auto-start real-time analysis after webcam starts
                setTimeout(() => {
                    if (!isAutoAnalyzing && isWebcamActive) {
                        setIsAutoAnalyzing(true);
                        // Clear previous results
                        setSceneDescription(null);
                        setCountResult(null);
                        setClassificationResult(null);
                        // Start continuous analysis
                        runRoboticsAnalysis();
                        autoAnalysisRef.current = setInterval(runRoboticsAnalysis, analysisInterval);
                    }
                }, 500); // Small delay to ensure video is fully ready
            }).catch(err => {
                console.log('Play error (autoplay might handle it):', err);
            });
        }
    }, [webcamStream, isWebcamActive]);

    const stopWebcam = () => {
        // Stop all tracks in the stream
        if (webcamStream) {
            webcamStream.getTracks().forEach(track => track.stop());
            setWebcamStream(null);
        }
        if (webcamRef.current?.srcObject) {
            webcamRef.current.srcObject = null;
        }
        setIsWebcamActive(false);
        setIsAutoAnalyzing(false);
        if (autoAnalysisRef.current) {
            clearInterval(autoAnalysisRef.current);
            autoAnalysisRef.current = null;
        }
        // Stop hand tracking if active
        stopRoboticsHandTracking();
        console.log('🎥 Webcam stopped');
    };

    // ========== HAND TRACKING FOR ROBOTICS ==========

    // MediaPipe hand connections for skeleton drawing
    const HAND_CONNECTIONS = [
        [0, 1], [1, 2], [2, 3], [3, 4],           // Thumb
        [0, 5], [5, 6], [6, 7], [7, 8],           // Index finger
        [0, 9], [9, 10], [10, 11], [11, 12],      // Middle finger
        [0, 13], [13, 14], [14, 15], [15, 16],    // Ring finger
        [0, 17], [17, 18], [18, 19], [19, 20],    // Pinky
        [5, 9], [9, 13], [13, 17], [0, 17]        // Palm
    ];

    const initializeHandLandmarker = async () => {
        try {
            const { FilesetResolver, HandLandmarker } = await import('@mediapipe/tasks-vision');

            const vision = await FilesetResolver.forVisionTasks(
                'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm'
            );

            handLandmarkerRef.current = await HandLandmarker.createFromOptions(vision, {
                baseOptions: {
                    modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
                    delegate: 'GPU',
                },
                runningMode: 'VIDEO',
                numHands: 2, // Track both hands
                minHandDetectionConfidence: 0.5,
                minHandPresenceConfidence: 0.5,
                minTrackingConfidence: 0.5,
            });

            console.log('✋ Hand Landmarker initialized for Robotics Vision');
            return true;
        } catch (error) {
            console.error('Failed to initialize Hand Landmarker:', error);
            return false;
        }
    };

    const startRoboticsHandTracking = async () => {
        if (!webcamRef.current) return;

        setIsRoboticsHandTracking(true);

        if (!handLandmarkerRef.current) {
            const initialized = await initializeHandLandmarker();
            if (!initialized) {
                setIsRoboticsHandTracking(false);
                return;
            }
        }

        let lastVideoTime = -1;

        const detectHands = () => {
            if (!webcamRef.current || !handLandmarkerRef.current || !isRoboticsHandTracking) {
                return;
            }

            const video = webcamRef.current;
            const currentTime = video.currentTime;

            if (currentTime !== lastVideoTime && video.readyState >= 2) {
                lastVideoTime = currentTime;

                try {
                    const results = handLandmarkerRef.current.detectForVideo(video, performance.now());

                    if (results.landmarks && results.landmarks.length > 0) {
                        // Store all detected hand landmarks
                        setHandLandmarks(results.landmarks[0]);
                    } else {
                        setHandLandmarks(null);
                    }
                } catch (error) {
                    console.error('Hand detection error:', error);
                }
            }

            handTrackingLoopRef.current = requestAnimationFrame(detectHands);
        };

        detectHands();
    };

    const stopRoboticsHandTracking = () => {
        setIsRoboticsHandTracking(false);
        setHandLandmarks(null);

        if (handTrackingLoopRef.current) {
            cancelAnimationFrame(handTrackingLoopRef.current);
            handTrackingLoopRef.current = null;
        }
    };

    // Start/stop hand tracking when mode changes
    useEffect(() => {
        if (analysisMode === 'hand' && isWebcamActive) {
            startRoboticsHandTracking();
        } else {
            stopRoboticsHandTracking();
        }

        return () => {
            if (handTrackingLoopRef.current) {
                cancelAnimationFrame(handTrackingLoopRef.current);
            }
        };
    }, [analysisMode, isWebcamActive]);

    const captureFrame = (): string | null => {
        if (!webcamRef.current || !webcamCanvasRef.current) return null;

        const video = webcamRef.current;
        const canvas = webcamCanvasRef.current;
        const ctx = canvas.getContext('2d');

        if (!ctx || video.videoWidth === 0) return null;

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0);

        // Return base64 without the data URL prefix
        return canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
    };

    const runRoboticsAnalysis = async () => {
        if (isAnalyzing) return;

        const frameBase64 = captureFrame();
        if (!frameBase64) {
            console.warn('No frame captured');
            return;
        }

        setIsAnalyzing(true);
        // Don't reset results during real-time analysis for smoother updates
        // Only reset on mode change

        try {
            switch (analysisMode) {
                case 'detect':
                    const objects = await detectObjectsInImage(frameBase64);
                    setDetectedObjects(objects);
                    setBoundingBoxes([]);
                    break;

                case 'boxes':
                    const boxes = await detectBoundingBoxes(frameBase64);
                    setBoundingBoxes(boxes);
                    setDetectedObjects([]);
                    break;

                case 'classify':
                    const { classifications } = await classifyObjectsDetailed(frameBase64);
                    setClassificationResult(classifications);
                    setDetectedObjects(classifications.map(c => ({ point: c.point, label: c.label })));
                    setBoundingBoxes([]);
                    break;

                case 'count':
                    if (roboticsQuery.trim()) {
                        const result = await countObjects(frameBase64, roboticsQuery);
                        setCountResult(result);
                        setDetectedObjects(result.objects);
                        setBoundingBoxes([]);
                    }
                    break;

                case 'question':
                    if (roboticsQuery.trim()) {
                        const { answer, relevantObjects } = await answerSceneQuestion(frameBase64, roboticsQuery);
                        setSceneDescription(answer);
                        setDetectedObjects(relevantObjects);
                        setBoundingBoxes([]);
                    }
                    break;
            }
        } catch (error: any) {
            console.error('Analysis failed:', error);
            setSceneDescription(`Error: ${error.message}`);
        } finally {
            setIsAnalyzing(false);
        }
    };

    const toggleAutoAnalysis = () => {
        if (isAutoAnalyzing) {
            if (autoAnalysisRef.current) {
                clearInterval(autoAnalysisRef.current);
                autoAnalysisRef.current = null;
            }
            setIsAutoAnalyzing(false);
        } else {
            setIsAutoAnalyzing(true);
            // Clear previous results for fresh start
            setSceneDescription(null);
            setCountResult(null);
            setClassificationResult(null);
            // Run immediately, then continuously at fast interval
            runRoboticsAnalysis();
            autoAnalysisRef.current = setInterval(runRoboticsAnalysis, analysisInterval);
        }
    };

    // Cleanup webcam on unmount or mode change
    useEffect(() => {
        return () => {
            stopWebcam();
        };
    }, []);

    // Stop auto-analysis when mode changes
    useEffect(() => {
        if (activeMode !== 'robotics' && isAutoAnalyzing) {
            toggleAutoAnalysis();
        }
    }, [activeMode]);

    useEffect(() => {
        return () => {
            if (audioSourceRef.current) {
                audioSourceRef.current.stop();
            }
            if (audioContextRef.current) {
                audioContextRef.current.close();
            }
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, []);


    const [streamedText, setStreamedText] = useState('');
    const [showCursor, setShowCursor] = useState(false);
    const streamingContainerRef = useRef<HTMLDivElement>(null);

    // Hand tracking state
    const containerRef = useRef<HTMLDivElement>(null);
    const {
        isTracking: isHandTrackingActive,
        handPosition,
        error: handTrackingError,
        videoElement: handTrackingVideoElement,
        toggleTracking: toggleHandTracking,
        startTracking,
        stopTracking,
    } = useHandTracking({
        containerRef,
        scrollSensitivity: 150,
        onPinch: (position) => {
            console.log('Pinch detected at:', position.screenX, position.screenY);
        },
        onScroll: (direction) => {
            console.log('Scroll gesture:', direction);
        },
    });

    // 3D Molecule demo state
    const [show3DMoleculeDemo, setShow3DMoleculeDemo] = useState(false);

    // 3D Viewer Hand Tracking Effects
    // Setup video stream for 3D viewer
    useEffect(() => {
        if (viewer3dWebcamStream && viewer3dVideoRef.current) {
            viewer3dVideoRef.current.srcObject = viewer3dWebcamStream;
        }
    }, [viewer3dWebcamStream]);

    // Initialize and run hand tracking for 3D viewer
    useEffect(() => {
        if (!viewer3dWebcamActive || !viewer3dVideoRef.current) return;

        let animationId: number;

        const initHandTracking = async () => {
            try {
                const { FilesetResolver, HandLandmarker } = await import('@mediapipe/tasks-vision');

                const vision = await FilesetResolver.forVisionTasks(
                    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
                );

                viewer3dHandLandmarkerRef.current = await HandLandmarker.createFromOptions(vision, {
                    baseOptions: {
                        modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
                        delegate: 'GPU'
                    },
                    runningMode: 'VIDEO',
                    numHands: 2
                });

                // Start tracking loop
                const trackHands = () => {
                    if (!viewer3dVideoRef.current || !viewer3dHandLandmarkerRef.current) {
                        animationId = requestAnimationFrame(trackHands);
                        return;
                    }

                    if (viewer3dVideoRef.current.readyState >= 2) {
                        const results = viewer3dHandLandmarkerRef.current.detectForVideo(
                            viewer3dVideoRef.current,
                            performance.now()
                        );

                        if (results.landmarks && results.landmarks.length > 0) {
                            const hands = results.landmarks.map((hand: any) =>
                                hand.map((lm: any) => ({ x: lm.x, y: lm.y, z: lm.z }))
                            );
                            setViewer3dHandLandmarks(hands);

                            // Process gestures
                            processViewer3dGestures(hands);
                        } else {
                            setViewer3dHandLandmarks([]);
                            setViewer3dIsPinching([false, false]);
                        }
                    }

                    animationId = requestAnimationFrame(trackHands);
                };

                trackHands();
            } catch (err) {
                console.error('3D Viewer hand tracking error:', err);
            }
        };

        initHandTracking();

        return () => {
            if (animationId) cancelAnimationFrame(animationId);
            if (viewer3dHandLandmarkerRef.current) {
                viewer3dHandLandmarkerRef.current.close();
                viewer3dHandLandmarkerRef.current = null;
            }
        };
    }, [viewer3dWebcamActive]);

    // Smoothing function for hand landmarks
    const smoothLandmarks = (
        newHands: Array<Array<{ x: number, y: number, z: number }>>,
        prevHands: Array<Array<{ x: number, y: number, z: number }>>,
        smoothingFactor: number = 0.4
    ): Array<Array<{ x: number, y: number, z: number }>> => {
        if (prevHands.length === 0) return newHands;

        return newHands.map((hand, handIdx) => {
            const prevHand = prevHands[handIdx];
            if (!prevHand) return hand;

            return hand.map((lm, lmIdx) => {
                const prevLm = prevHand[lmIdx];
                if (!prevLm) return lm;

                return {
                    x: prevLm.x + (lm.x - prevLm.x) * smoothingFactor,
                    y: prevLm.y + (lm.y - prevLm.y) * smoothingFactor,
                    z: prevLm.z + (lm.z - prevLm.z) * smoothingFactor,
                };
            });
        });
    };

    // Mode-specific colors for visual feedback
    const getModeColor = (mode: 'drag' | 'rotate' | 'scale' | 'animate') => {
        switch (mode) {
            case 'drag': return '#00FFFF';      // Cyan
            case 'rotate': return '#FF00FF';    // Magenta
            case 'scale': return '#FFFF00';     // Yellow
            case 'animate': return '#FFA500';   // Orange
        }
    };

    // Gesture processing function for 3D viewer - uses refs for real-time tracking
    const processViewer3dGestures = (hands: Array<Array<{ x: number, y: number, z: number }>>) => {
        const PINCH_THRESHOLD = 0.10; // Increased threshold for easier pinch detection
        const ANIMATION_SCROLL_THRESHOLD = 0.04; // Lower threshold for smoother animation cycling
        const ROTATE_SENSITIVITY = 400; // Sensitivity multiplier for rotation
        const DRAG_SENSITIVITY = 800; // Sensitivity multiplier for dragging
        const SCALE_SENSITIVITY = 4; // Sensitivity multiplier for scaling

        // Apply smoothing to landmarks (higher factor = more responsive, lower = smoother)
        const smoothedHands = smoothLandmarks(hands, viewer3dPrevLandmarksRef.current, 0.5);
        viewer3dPrevLandmarksRef.current = smoothedHands;
        setViewer3dSmoothedLandmarks(smoothedHands);

        // Calculate pinch state for each hand
        const newPinching: [boolean, boolean] = [false, false];
        const newPinchPositions: [{ x: number, y: number } | null, { x: number, y: number } | null] = [null, null];

        smoothedHands.forEach((hand, handIdx) => {
            if (handIdx > 1) return;

            const thumbTip = hand[4];
            const indexTip = hand[8];

            if (thumbTip && indexTip) {
                const distance = Math.sqrt(
                    Math.pow(thumbTip.x - indexTip.x, 2) +
                    Math.pow(thumbTip.y - indexTip.y, 2)
                );

                if (distance < PINCH_THRESHOLD) {
                    newPinching[handIdx] = true;
                    newPinchPositions[handIdx] = {
                        x: (thumbTip.x + indexTip.x) / 2,
                        y: (thumbTip.y + indexTip.y) / 2
                    };
                }
            }
        });

        setViewer3dIsPinching(newPinching);
        setViewer3dPinchPositions(newPinchPositions);

        // Update grabbing state for visual feedback
        const isAnyPinching = newPinching[0] || newPinching[1];
        setViewer3dIsGrabbing(isAnyPinching);

        // Get current interaction mode from ref (avoids stale closure)
        const currentMode = viewer3dInteractionModeRef.current;

        // Apply gestures based on interaction mode
        // Note: X is inverted because webcam is mirrored (scaleX(-1))
        if (currentMode === 'rotate' && newPinching[0] && newPinchPositions[0]) {
            // Single hand rotate - horizontal movement rotates Y-axis
            const lastPos = viewer3dLastPinchPositionRef.current;
            if (lastPos) {
                // Invert deltaX because webcam is mirrored
                const deltaX = -(newPinchPositions[0].x - lastPos.x) * ROTATE_SENSITIVITY;
                const deltaY = (newPinchPositions[0].y - lastPos.y) * ROTATE_SENSITIVITY;
                setViewer3dRotation(prev => ({
                    x: prev.x - deltaY,
                    y: prev.y + deltaX,
                    z: prev.z
                }));
            }
            viewer3dLastPinchPositionRef.current = newPinchPositions[0];
        } else if (currentMode === 'drag' && newPinching[0] && newPinchPositions[0]) {
            // Single hand drag - move object in 2D
            const lastPos = viewer3dLastPinchPositionRef.current;
            if (lastPos) {
                // Invert deltaX because webcam is mirrored
                const deltaX = -(newPinchPositions[0].x - lastPos.x) * DRAG_SENSITIVITY;
                const deltaY = (newPinchPositions[0].y - lastPos.y) * DRAG_SENSITIVITY;
                setViewer3dPosition(prev => ({
                    x: prev.x + deltaX,
                    y: prev.y + deltaY,
                    z: prev.z
                }));
            }
            viewer3dLastPinchPositionRef.current = newPinchPositions[0];
        } else if (currentMode === 'scale' && newPinching[0] && newPinching[1] && newPinchPositions[0] && newPinchPositions[1]) {
            // Two hands scale - pinch with both hands and move closer/farther
            const currentDistance = Math.sqrt(
                Math.pow(newPinchPositions[0].x - newPinchPositions[1].x, 2) +
                Math.pow(newPinchPositions[0].y - newPinchPositions[1].y, 2)
            );

            const lastDist = viewer3dLastPinchDistanceRef.current;
            if (lastDist !== null) {
                const delta = (currentDistance - lastDist) * SCALE_SENSITIVITY;
                setViewer3dScale(prev => Math.max(0.3, Math.min(3, prev + delta)));
            }
            viewer3dLastPinchDistanceRef.current = currentDistance;
        } else if (currentMode === 'animate' && newPinching[0] && newPinchPositions[0]) {
            // Animate mode - vertical pinch movement cycles through animations
            const lastY = viewer3dLastPinchYRef.current;
            if (lastY !== null) {
                const deltaY = newPinchPositions[0].y - lastY;

                // Check if we've moved enough to trigger animation change
                if (Math.abs(deltaY) > ANIMATION_SCROLL_THRESHOLD) {
                    // Cycle animation index (0-5 for demo)
                    setViewer3dAnimationIndex(prev => {
                        const newIndex = deltaY > 0 ? prev + 1 : prev - 1;
                        return Math.max(0, Math.min(5, newIndex));
                    });
                    viewer3dLastPinchYRef.current = newPinchPositions[0].y;
                }
            } else {
                viewer3dLastPinchYRef.current = newPinchPositions[0].y;
            }
        } else {
            // Reset refs when not pinching
            viewer3dLastPinchPositionRef.current = null;
            viewer3dLastPinchDistanceRef.current = null;
            viewer3dLastPinchYRef.current = null;
        }
    };

    // Voice command setup for 3D viewer
    useEffect(() => {
        if (!viewer3dVoiceActive) {
            if (viewer3dSpeechRef.current) {
                viewer3dSpeechRef.current.stop();
                viewer3dSpeechRef.current = null;
            }
            return;
        }

        // Check for Speech Recognition API
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) {
            console.warn('Speech Recognition not supported');
            setViewer3dVoiceActive(false);
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onresult = (event: any) => {
            const last = event.results.length - 1;
            const transcript = event.results[last][0].transcript.toLowerCase().trim();
            setViewer3dVoiceTranscript(transcript);

            // Check for mode commands
            if (transcript.includes('drag')) {
                setViewer3dInteractionMode('drag');
            } else if (transcript.includes('rotate')) {
                setViewer3dInteractionMode('rotate');
            } else if (transcript.includes('scale') || transcript.includes('zoom')) {
                setViewer3dInteractionMode('scale');
            } else if (transcript.includes('animate') || transcript.includes('animation')) {
                setViewer3dInteractionMode('animate');
            } else if (transcript.includes('reset')) {
                setViewer3dRotation({ x: 0, y: 0, z: 0 });
                setViewer3dPosition({ x: 0, y: 0, z: 0 });
                setViewer3dScale(1);
            }
        };

        recognition.onerror = (event: any) => {
            console.error('Speech recognition error:', event.error);
            if (event.error === 'not-allowed') {
                setViewer3dVoiceActive(false);
            }
        };

        recognition.onend = () => {
            // Restart if still active
            if (viewer3dVoiceActive && viewer3dSpeechRef.current) {
                recognition.start();
            }
        };

        recognition.start();
        viewer3dSpeechRef.current = recognition;

        return () => {
            if (viewer3dSpeechRef.current) {
                viewer3dSpeechRef.current.stop();
            }
        };
    }, [viewer3dVoiceActive]);

    // Pulse animation for grabbing feedback
    useEffect(() => {
        if (!viewer3dIsGrabbing) {
            setViewer3dGrabPulse(0);
            return;
        }

        const interval = setInterval(() => {
            setViewer3dGrabPulse(prev => (prev + 1) % 360);
        }, 50);

        return () => clearInterval(interval);
    }, [viewer3dIsGrabbing]);

    // Cleanup 3D viewer webcam when mode changes
    useEffect(() => {
        if (activeMode !== 'viewer3d' && viewer3dWebcamActive) {
            if (viewer3dWebcamStream) {
                viewer3dWebcamStream.getTracks().forEach(t => t.stop());
            }
            setViewer3dWebcamActive(false);
            setViewer3dWebcamStream(null);
            setViewer3dHandLandmarks([]);
        }
    }, [activeMode]);

    // Expanded image state
    const [expandedImage, setExpandedImage] = useState<{ src: string; title: string } | null>(null);

    // Auto-scroll streaming container when new content arrives
    useEffect(() => {
        if (streamingContainerRef.current && streamedText) {
            streamingContainerRef.current.scrollTop = streamingContainerRef.current.scrollHeight;
        }
    }, [streamedText]);

    const learningModes: LearningModeCard[] = [
        { id: 'source', icon: <SourceIcon />, label: 'Source', activeColor: '#e2e8f0', activeBg: 'transparent' },
        { id: 'immersive-text', icon: <ImmersiveTextIcon active={activeMode === 'immersive-text'} />, label: 'Immersive Text', activeColor: '#ea4335', activeBg: '#fce8e6' },
        { id: 'slides-narration', icon: <SlidesIcon active={activeMode === 'slides-narration'} />, label: 'Slides & Narration', activeColor: '#9334e9', activeBg: '#f3e8fd' },
        { id: 'audio-lesson', icon: <AudioIcon active={activeMode === 'audio-lesson'} />, label: 'Audio Lesson', activeColor: '#34a853', activeBg: '#e6f4ea' },
        { id: 'mindmap', icon: <MindmapIcon active={activeMode === 'mindmap'} />, label: 'Mindmap', activeColor: '#4285f4', activeBg: '#e8f0fe' },
        { id: 'simulation', icon: <SimulationIcon active={activeMode === 'simulation'} />, label: 'Simulation', activeColor: '#ff6d01', activeBg: '#fff3e0' },
        { id: 'robotics', icon: <RoboticsIcon active={activeMode === 'robotics'} />, label: 'Robotics Vision', activeColor: '#00bcd4', activeBg: '#e0f7fa' },
        { id: 'viewer3d', icon: <Viewer3DIcon active={activeMode === 'viewer3d'} />, label: '3D Viewer', activeColor: '#7c3aed', activeBg: '#ede9fe' },
        { id: 'image-activity', icon: <ImageActivityIcon active={activeMode === 'image-activity'} />, label: 'Image Activity', activeColor: '#f97316', activeBg: '#ffedd5' },
        { id: 'code-lab', icon: <CodeLabIcon active={activeMode === 'code-lab'} />, label: 'Code Lab', activeColor: '#10b981', activeBg: '#d1fae5' },
        { id: 'assignment', icon: <AssignmentIcon active={activeMode === 'assignment'} />, label: 'Assignment', activeColor: '#1a73e8', activeBg: '#e8f0fe' },
        { id: 'latex-assignment', icon: <Code2 className={`w-5 h-5 ${activeMode === 'latex-assignment' ? 'text-orange-600' : 'text-slate-400'}`} />, label: 'LaTeX', activeColor: '#f97316', activeBg: '#ffedd5' }
    ];



    const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        // Capture file name for use in async callbacks
        const fileName = file.name;

        // Clear previous content when uploading a new file
        console.log('📤 New file upload - clearing previous content...');
        setImmersiveContent(null);
        setSectionImages({});
        setWidgetImages({});
        setActiveSectionId('');
        documentTextRef.current = '';
        // Clear localStorage when uploading new file
        localStorage.removeItem(STORAGE_KEY);

        setIsLoading(true);
        setUploadedFileName(fileName);
        setProcessingStage('uploading');
        setLoadingMessage('Uploading document...');
        setTerminalSubSteps(['Initializing upload...']);

        // Create PDF URL for sidebar viewer if it's a PDF file
        if (file.type === 'application/pdf') {
            const url = URL.createObjectURL(file);
            setPdfUrl(url);
            setTerminalSubSteps(prev => [...prev, 'PDF detected, preparing viewer...']);
        }

        try {
            // Stage 1: Extracting text
            setProcessingStage('extracting');
            setLoadingMessage('Extracting text from document...');
            setTerminalSubSteps(prev => [...prev, 'Loading document parser...']);

            const { extractTextFromDocument } = await import('../utils/documentTextExtractor');
            setTerminalSubSteps(prev => [...prev, 'Parsing document structure...']);

            const { text } = await extractTextFromDocument(file);
            setTerminalSubSteps(prev => [...prev, `Extracted ${text.length.toLocaleString()} characters`]);

            if (!text || text.trim().length === 0) {
                throw new Error('No text content found in document');
            }

            // Store the document text for simulation generation
            documentTextRef.current = text;

            // Stage 2: Analyzing content
            setProcessingStage('analyzing');
            setLoadingMessage('Analyzing document structure...');
            setTerminalSubSteps(prev => [...prev, 'Identifying key concepts...']);

            // Small delay to show the analyzing stage
            await new Promise(resolve => setTimeout(resolve, 500));
            setTerminalSubSteps(prev => [...prev, 'Mapping content hierarchy...']);

            // Stage 3: Start STREAMING content generation - show content as it's generated!
            setProcessingStage('generating');
            setLoadingMessage('Generating immersive content...');
            setTerminalSubSteps(prev => [...prev, 'Connecting to Gemini AI...', 'Starting content stream...']);
            setIsStreaming(true);
            setShowCursor(true);
            setStreamedText('');
            setActiveMode('immersive-text');
            setIsLoading(false); // Hide main loader, show streaming view
            setProcessingStage('idle'); // Reset processing stage
            setTerminalSubSteps([]); // Reset terminal sub-steps

            console.log('🚀 Starting streaming...');

            // Stream content from Gemini using callback pattern
            const analysis = await streamAnalyzeDocumentForImmersive(
                text,
                (currentStreamedText, isComplete) => {
                    // Use flushSync to force immediate DOM update for streaming effect
                    flushSync(() => {
                        setStreamedText(currentStreamedText);
                    });
                    if (isComplete) {
                        flushSync(() => {
                            setShowCursor(false);
                        });
                    }
                }
            );

            console.log('✅ Streaming complete, got analysis:', analysis?.sections?.length, 'sections');

            // Streaming complete - show final parsed content
            setIsStreaming(false);
            setShowCursor(false);
            setImmersiveContent(analysis);

            if (analysis.sections.length > 0) {
                setActiveSectionId(analysis.sections[0].id);
            }

            setLoadingMessage('');

            // 2. Start all background tasks IN PARALLEL (non-blocking)
            // These will update state as they complete

            // Background task: Generate images - LIMITED TO 1 IMAGE PER PAGE to reduce costs
            const generateImagesAsync = async () => {
                // COST OPTIMIZATION: Only generate 1 image for the first section with an imagePrompt
                // This dramatically reduces API costs while still providing visual context
                const MAX_IMAGES_PER_PAGE = 1;
                let imagesGenerated = 0;

                // Find sections with imagePrompts (should only be first section based on new prompt)
                const sectionsWithImages = analysis.sections.filter(s => s.imagePrompt);

                // Mark only the first section as loading
                const loadingState: { [key: string]: boolean } = {};
                if (sectionsWithImages.length > 0 && imagesGenerated < MAX_IMAGES_PER_PAGE) {
                    loadingState[sectionsWithImages[0].id] = true;
                }
                setLoadingImages(loadingState);

                // Generate image ONLY for the first section with an imagePrompt
                for (const section of analysis.sections) {
                    if (imagesGenerated >= MAX_IMAGES_PER_PAGE) {
                        console.log(`🛑 Image limit reached (${MAX_IMAGES_PER_PAGE}). Skipping remaining image generation to save costs.`);
                        break;
                    }

                    if (section.imagePrompt) {
                        try {
                            console.log(`🖼️ Generating image ${imagesGenerated + 1}/${MAX_IMAGES_PER_PAGE} for section: ${section.id}`);
                            const imageUrl = await generateImmersiveImage(section.imagePrompt);
                            // Update state progressively as each image loads
                            setSectionImages(prev => ({ ...prev, [section.id]: imageUrl }));
                            setLoadingImages(prev => ({ ...prev, [section.id]: false }));
                            imagesGenerated++;
                        } catch (e) {
                            console.error("Failed to generate image for section", section.id, e);
                            setLoadingImages(prev => ({ ...prev, [section.id]: false }));
                        }
                    }

                    // DISABLED: comparison widget images to save costs
                    // Interactive activities are preferred over image-based comparisons
                    // If comparison widget has image prompts, skip them
                    if (section.widget?.type === 'comparison' && section.widget.data.beforeImagePrompt && section.widget.data.afterImagePrompt) {
                        console.log(`⏭️ Skipping comparison widget images for section ${section.id} to save costs. Use interactive activities instead.`);
                    }
                }

                console.log(`✅ Image generation complete. Generated ${imagesGenerated} image(s).`);
            };

            // Background task: Generate quiz
            const generateQuizAsync = async () => {
                try {
                    const generatedQuiz = await generateImmersiveQuiz(text);
                    setQuiz(generatedQuiz);
                } catch (e) {
                    console.error('Failed to generate quiz:', e);
                }
            };

            // Background task: Generate audio script
            const generateAudioAsync = async () => {
                try {
                    const script = await generateAudioScript(text);
                    setAudioScript(script);
                } catch (e) {
                    console.error('Failed to generate audio script:', e);
                }
            };

            // Background task: Generate mind map
            const generateMindMapAsync = async () => {
                try {
                    const data = await generateReactFlowData(text);
                    setReactFlowData(data);
                } catch (e) {
                    console.error('Failed to generate mind map:', e);
                }
            };

            // Background task: Fetch YouTube videos
            const fetchVideosAsync = async () => {
                setIsLoadingVideos(true);
                try {
                    const videos = await fetchAndRankYouTubeVideos(text);
                    setRelevantVideos(videos);
                    console.log('Found relevant videos:', videos.length);
                } catch (e) {
                    console.warn('Failed to fetch YouTube videos:', e);
                } finally {
                    setIsLoadingVideos(false);
                }
            };

            // Run ALL background tasks in parallel - don't block the UI!
            Promise.all([
                generateImagesAsync(),
                generateQuizAsync(),
                generateAudioAsync(),
                generateMindMapAsync(),
                fetchVideosAsync()
            ]).then(async () => {
                console.log('✅ All background content generation complete!');
                // Save as new workspace using the analysis content directly
                // This ensures we have the content even if state hasn't updated yet
                await saveWorkspaceWithContent(analysis, fileName, text);
            }).catch(e => {
                console.error('Some background tasks failed:', e);
            });

        } catch (error) {
            console.error('Error processing file:', error);
            alert('Failed to process document. Please try again.');
            setIsLoading(false);
            setLoadingMessage('');
            setProcessingStage('idle');
            setUploadedFileName('');
        } finally {
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    }, []);

    const scrollToQuiz = () => {
        quizRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    // Cache for video content to prevent re-fetching
    const videoContentCacheRef = useRef<Map<string, {
        summary: VideoSummary | null;
        transcript: string | null;
    }>>(new Map());

    // Effect to load video summary and transcript when video changes
    useEffect(() => {
        const loadVideoContent = async () => {
            const video = relevantVideos[selectedVideoIndex];
            if (!video) return;

            // Check if we have cached content for this video
            const cached = videoContentCacheRef.current.get(video.id);
            if (cached) {
                console.log('📦 Using cached video content for:', video.id);
                setVideoSummary(cached.summary);
                setVideoTranscript(cached.transcript);
                return;
            }

            // Reset previous state for new video
            setVideoSummary(null);
            setVideoTranscript(null);
            setVideoChatMessages([]);
            setVideoQuiz([]);
            setVideoFlashcards([]);
            setVideoQuizAnswers({});
            setShowVideoQuizFeedback({});
            setCurrentVideoQuizIndex(0);

            let loadedSummary: VideoSummary | null = null;
            let loadedTranscript: string | null = null;

            // Load summary
            setIsLoadingVideoSummary(true);
            try {
                loadedSummary = await generateVideoSummary(video.id, video.title, video.description);
                setVideoSummary(loadedSummary);
            } catch (e) {
                console.error('Failed to load video summary:', e);
            } finally {
                setIsLoadingVideoSummary(false);
            }

            // Load transcript in background
            setIsLoadingVideoTranscript(true);
            try {
                loadedTranscript = await getVideoTranscript(video.id);
                setVideoTranscript(loadedTranscript);
            } catch (e) {
                console.warn('Failed to load video transcript:', e);
            } finally {
                setIsLoadingVideoTranscript(false);
            }

            // Cache the loaded content
            videoContentCacheRef.current.set(video.id, {
                summary: loadedSummary,
                transcript: loadedTranscript
            });
            console.log('💾 Cached video content for:', video.id);
        };

        if (relevantVideos.length > 0 && activeMode === 'slides-narration') {
            loadVideoContent();
        }
    }, [selectedVideoIndex, relevantVideos, activeMode]);

    // Auto-scroll chat to bottom
    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [videoChatMessages, isLoadingChatResponse]);

    // Handle sending chat message
    const handleSendChatMessage = async () => {
        const video = relevantVideos[selectedVideoIndex];
        if (!video || !videoChatInput.trim() || isLoadingChatResponse) return;

        const userMessage = videoChatInput.trim();
        setVideoChatInput('');

        // Add user message
        const newUserMessage: VideoChatMessage = {
            role: 'user',
            content: userMessage,
            timestamp: new Date()
        };
        setVideoChatMessages(prev => [...prev, newUserMessage]);

        // Get AI response
        setIsLoadingChatResponse(true);
        try {
            const response = await chatAboutVideo(
                video.id,
                video.title,
                video.description,
                userMessage,
                videoChatMessages,
                videoTranscript
            );

            const assistantMessage: VideoChatMessage = {
                role: 'assistant',
                content: response,
                timestamp: new Date()
            };
            setVideoChatMessages(prev => [...prev, assistantMessage]);
        } catch (e) {
            console.error('Failed to get chat response:', e);
            const errorMessage: VideoChatMessage = {
                role: 'assistant',
                content: "I'm sorry, I couldn't process your question. Please try again.",
                timestamp: new Date()
            };
            setVideoChatMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoadingChatResponse(false);
        }
    };

    // Handle loading video quiz
    const handleLoadVideoQuiz = async () => {
        const video = relevantVideos[selectedVideoIndex];
        if (!video || isLoadingVideoQuiz) return;

        setIsLoadingVideoQuiz(true);
        try {
            const quiz = await generateVideoQuiz(video.id, video.title, video.description, videoTranscript);
            setVideoQuiz(quiz);
            setVideoQuizAnswers({});
            setShowVideoQuizFeedback({});
            setCurrentVideoQuizIndex(0);
        } catch (e) {
            console.error('Failed to generate video quiz:', e);
        } finally {
            setIsLoadingVideoQuiz(false);
        }
    };

    // Handle loading flashcards
    const handleLoadFlashcards = async () => {
        const video = relevantVideos[selectedVideoIndex];
        if (!video || isLoadingFlashcards) return;

        setIsLoadingFlashcards(true);
        try {
            const flashcards = await generateVideoFlashcards(video.id, video.title, video.description, videoTranscript);
            setVideoFlashcards(flashcards);
            setCurrentFlashcardIndex(0);
            setIsFlashcardFlipped(false);
        } catch (e) {
            console.error('Failed to generate flashcards:', e);
        } finally {
            setIsLoadingFlashcards(false);
        }
    };

    // Enhanced term click handler - shows rich interactive popup
    const handleTermClick = async (term: string, definition: string) => {
        // Set basic definition first for instant feedback
        setActiveDefinition({ term, definition });
        setEnhancedTermInfo(null);
        setEnhancedTermTab('definition');
        setBrainTeaserRevealed(false);
        setEnhancedQuizAnswer(null);

        // Load enhanced info in background
        setIsLoadingEnhancedTerm(true);
        try {
            const activeSection = immersiveContent?.sections.find(s => s.id === activeSectionId);
            const context = activeSection?.content || documentTextRef.current || '';
            const enhanced = await generateEnhancedTermInfo(term, definition, context);
            setEnhancedTermInfo(enhanced);
        } catch (error) {
            console.error('Failed to load enhanced term info:', error);
        } finally {
            setIsLoadingEnhancedTerm(false);
        }
    };

    // Close enhanced term popup
    const handleCloseTermPopup = () => {
        setActiveDefinition(null);
        setEnhancedTermInfo(null);
        setEnhancedTermTab('definition');
        setBrainTeaserRevealed(false);
        setEnhancedQuizAnswer(null);
    };

    // Generate brainstorm activity for current section
    const handleGenerateBrainstorm = async () => {
        const activeSection = immersiveContent?.sections.find(s => s.id === activeSectionId);
        if (!activeSection) return;

        setIsLoadingBrainstorm(true);
        setBrainstormActivity(null);
        setShowBrainstormHints([]);
        setShowBrainstormApproaches(false);
        setShowBrainstormInsight(false);
        setUserBrainstormNotes('');

        try {
            const activity = await generateBrainstormActivity(activeSection.content, activeSection.title);
            setBrainstormActivity(activity);
            setShowBrainstormHints(new Array(activity.hints.length).fill(false));
        } catch (error) {
            console.error('Failed to generate brainstorm activity:', error);
        } finally {
            setIsLoadingBrainstorm(false);
        }
    };

    // Generate What-If activity for current section
    const handleGenerateWhatIf = async () => {
        const activeSection = immersiveContent?.sections.find(s => s.id === activeSectionId);
        if (!activeSection) return;

        setIsLoadingWhatIf(true);
        setWhatIfActivity(null);
        setRevealedWhatIfs({});

        try {
            const activity = await generateWhatIfActivity(activeSection.content, activeSection.title);
            setWhatIfActivity(activity);
        } catch (error) {
            console.error('Failed to generate what-if activity:', error);
        } finally {
            setIsLoadingWhatIf(false);
        }
    };

    const handleQuizAnswer = (questionIndex: number, optionIndex: number) => {
        setQuizAnswers(prev => ({ ...prev, [questionIndex]: optionIndex }));
        setShowQuizFeedback(prev => ({ ...prev, [questionIndex]: true }));
    };

    const speakAudio = () => {
        if (!audioScript) return;
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(audioScript);
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        window.speechSynthesis.speak(utterance);
    };

    // Handler for opening floating quiz with paragraph-specific question
    const handleOpenFloatingQuiz = async (paragraphText: string, pIdx: number) => {
        setOpenFloatingQuiz(pIdx);
        setFloatingQuizData(null);
        setFloatingQuizAnswer(null);
        setIsLoadingFloatingQuiz(true);

        try {
            const quizData = await generateParagraphQuiz(paragraphText);
            setFloatingQuizData(quizData);
        } catch (error) {
            console.error('Failed to generate paragraph quiz:', error);
            // Fallback question
            setFloatingQuizData({
                question: 'What is the main concept discussed in this paragraph?',
                options: ['The primary topic mentioned', 'A secondary detail', 'An unrelated concept', 'None of the above'],
                correctAnswerIndex: 0,
                explanation: 'Review the paragraph to understand the main concept.'
            });
        } finally {
            setIsLoadingFloatingQuiz(false);
        }
    };

    // Handler for citation clicks - opens sidebar with grounding source preview (like Tutor)
    const handleCitationClick = useCallback((source: { url: string; title: string; snippet?: string }, sectionIndex?: number) => {
        setActiveCitation({
            url: source.url,
            title: source.title,
            snippet: source.snippet,
            pageNumber: sectionIndex ? sectionIndex + 1 : undefined,
            sectionId: undefined
        });
        setShowPdfSidebar(true);
        setOpenFloatingQuiz(null); // Close quiz if open
    }, []);

    // Copy snippet to clipboard
    const handleCopySnippet = useCallback(() => {
        if (activeCitation?.snippet) {
            navigator.clipboard.writeText(activeCitation.snippet);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    }, [activeCitation]);

    // Get highlighted URL with text fragment
    const getHighlightedUrl = useCallback((url: string, snippet?: string) => {
        if (!snippet) return url;
        const cleanSnippet = snippet.replace(/[^\w\s,.-]/g, '').trim().substring(0, 100);
        if (cleanSnippet.length < 5) return url;
        return `${url}#:~:text=${encodeURIComponent(cleanSnippet)}`;
    }, []);

    // Fetch grounding sources for a topic (Google Search grounding)
    const handleFetchGroundingSources = useCallback(async (topic: string) => {
        setIsLoadingGrounding(true);
        try {
            const result = await fetchGroundingSources(
                `Provide accurate information with citations about: ${topic}. Include scientific or educational sources.`
            );
            setGroundingSources(result.sources);
        } catch (error) {
            console.error('Failed to fetch grounding sources:', error);
            setGroundingSources([]);
        } finally {
            setIsLoadingGrounding(false);
        }
    }, []);

    // Auto-fetch grounding sources when section changes
    useEffect(() => {
        const section = immersiveContent?.sections.find(s => s.id === activeSectionId);
        if (section?.title && activeMode === 'immersive-text') {
            handleFetchGroundingSources(section.title);
        }
    }, [activeSectionId, activeMode, immersiveContent, handleFetchGroundingSources]);

    // Floating Quiz Component (Google-style) - Now uses paragraph-specific quiz
    const FloatingQuizPanel = ({ paragraphIndex, onClose }: { paragraphIndex: number; onClose: () => void }) => {
        const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);

        // Use the dynamically generated quiz for this paragraph
        const q = floatingQuizData;

        if (isLoadingFloatingQuiz) {
            return (
                <div className="fixed top-24 right-6 w-[340px] bg-white rounded-2xl shadow-xl z-50 animate-slide-in-right border border-[#e8eaed] overflow-hidden">
                    <div className="p-6 flex flex-col items-center justify-center min-h-[200px]">
                        <Loader2 className="w-8 h-8 text-[#ff9064] animate-spin mb-3" />
                        <p className="text-[14px] text-[#5f6368] text-center">Generating a question for this paragraph...</p>
                    </div>
                </div>
            );
        }

        if (!q) return null;

        return (
            <div className="fixed top-24 right-6 w-[340px] bg-white rounded-2xl shadow-xl z-50 animate-slide-in-right border border-[#e8eaed] overflow-hidden">
                {/* Header */}
                <div className="flex items-start gap-3 p-4 pb-3">
                    <div className="w-7 h-7 rounded-full bg-[#ff9064] flex items-center justify-center flex-shrink-0">
                        <span className="text-white font-bold text-sm">?</span>
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-[14px] font-medium text-[#1f1f1f] leading-snug">
                            {q.question}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-[#f1f3f4] transition-colors flex-shrink-0"
                    >
                        <X className="w-4 h-4 text-[#5f6368]" />
                    </button>
                </div>

                {/* Options */}
                <div className="px-4 pb-4 space-y-1.5">
                    {q.options.map((option, idx) => {
                        const isSelected = selectedAnswer === option;
                        const isCorrect = idx === q.correctAnswerIndex;
                        const showResult = selectedAnswer !== null;

                        let bgColor = 'bg-[#f1f3f4] hover:bg-[#e8eaed]';
                        let textColor = 'text-[#444746]';

                        if (showResult && isCorrect) {
                            bgColor = 'bg-[#ceead6]';
                            textColor = 'text-[#137333]';
                        } else if (showResult && isSelected && !isCorrect) {
                            bgColor = 'bg-[#fad2cf]';
                            textColor = 'text-[#c5221f]';
                        }

                        return (
                            <button
                                key={idx}
                                onClick={() => setSelectedAnswer(option)}
                                disabled={selectedAnswer !== null}
                                className={`w-full text-left px-3 py-2 rounded-xl ${bgColor} ${textColor} transition-all duration-150 text-[13px]`}
                            >
                                <span className="font-medium mr-1.5">{String.fromCharCode(65 + idx)}.</span>
                                {option}
                            </button>
                        );
                    })}
                </div>

                {/* Feedback */}
                {
                    selectedAnswer !== null && q && (
                        <div className={`px-4 pb-4 pt-0`}>
                            <p className={`text-[13px] ${q.correctAnswerIndex === q.options.indexOf(selectedAnswer) ? 'text-[#137333]' : 'text-[#c5221f]'}`}>
                                {q.correctAnswerIndex === q.options.indexOf(selectedAnswer)
                                    ? "That's right!"
                                    : "Not quite."}
                            </p>
                            {q.explanation && (
                                <p className="text-[12px] text-[#5f6368] mt-1.5 leading-relaxed">
                                    {q.explanation}
                                </p>
                            )}
                        </div>
                    )
                }
            </div >
        );
    };

    // Widget Components
    const ScratchReveal = ({ title, content }: { title?: string, content?: string }) => {
        const [revealed, setRevealed] = useState(false);
        return (
            <div className="my-8 p-1 rounded-2xl bg-gradient-to-r from-purple-400 to-pink-400 cursor-pointer transition-transform hover:scale-[1.01]" onClick={() => setRevealed(true)}>
                <div className={`bg-white rounded-xl p-6 relative overflow-hidden min-h-[120px] flex items-center justify-center text-center transition-all duration-500 ${revealed ? 'bg-opacity-100' : 'bg-opacity-90'}`}>
                    {!revealed ? (
                        <div className="absolute inset-0 bg-gray-100 flex flex-col items-center justify-center z-10">
                            <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center mb-2">
                                <HelpCircle className="w-6 h-6 text-gray-400" />
                            </div>
                            <p className="font-bold text-gray-500">Click to Reveal: {title}</p>
                        </div>
                    ) : (
                        <div className="animate-fade-in">
                            <h4 className="font-bold text-purple-600 mb-2">{title}</h4>
                            <p className="text-gray-800">{content}</p>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const ComparisonSlider = ({ data, images }: { data: any, images?: { before?: string, after?: string } }) => {
        const [sliderVal, setSliderVal] = useState(50);
        return (
            <div className="my-8 rounded-2xl overflow-hidden border border-gray-200 shadow-sm bg-gray-50">
                <div className="relative h-[300px] w-full group">
                    {images?.after && <img src={images.after} className="absolute inset-0 w-full h-full object-cover" alt="After" />}
                    {images?.before && (
                        <div className="absolute inset-0 w-full h-full overflow-hidden" style={{ width: `${sliderVal}%` }}>
                            <img src={images.before} className="absolute inset-0 w-full h-full object-cover max-w-none" style={{ width: '100%' }} alt="Before" />
                        </div>
                    )}
                    <input
                        type="range"
                        min="0"
                        max="100"
                        value={sliderVal}
                        onChange={(e) => setSliderVal(Number(e.target.value))}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize z-20"
                    />
                    <div className="absolute top-0 bottom-0 w-1 bg-white shadow-lg pointer-events-none z-10" style={{ left: `${sliderVal}%` }}>
                        <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 bg-white rounded-full shadow-md flex items-center justify-center">
                            <RefreshCw className="w-4 h-4 text-gray-600" />
                        </div>
                    </div>
                    <div className="absolute bottom-4 left-4 bg-black/50 text-white px-3 py-1 rounded-full text-xs backdrop-blur-sm">{data.beforeLabel}</div>
                    <div className="absolute bottom-4 right-4 bg-black/50 text-white px-3 py-1 rounded-full text-xs backdrop-blur-sm">{data.afterLabel}</div>
                </div>
            </div>
        );
    };

    const InlineQuiz = ({ data }: { data: any }) => {
        const [selected, setSelected] = useState<number | null>(null);
        return (
            <div className="my-8 bg-[#e8f0fe] rounded-2xl p-6 border border-blue-100">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                        <HelpCircle className="w-5 h-5 text-blue-600" />
                    </div>
                    <h4 className="font-bold text-[#1f1f1f]">{data.question}</h4>
                </div>
                <div className="space-y-2">
                    {data.options?.map((opt: string, idx: number) => (
                        <button
                            key={idx}
                            onClick={() => setSelected(idx)}
                            className={`w-full text-left p-3 rounded-lg border transition-all font-medium ${selected === idx
                                ? idx === data.correctIndex
                                    ? 'bg-[#ceead6] border-[#34a853] text-[#137333]'
                                    : 'bg-[#fad2cf] border-[#ea4335] text-[#c5221f]'
                                : 'bg-white border-[#dadce0] text-[#1f1f1f] hover:bg-[#f8f9fa] hover:border-[#bdc1c6]'
                                }`}
                        >
                            {opt}
                        </button>
                    ))}
                </div>
                {selected !== null && (
                    <div className="mt-4 text-[14px] text-[#444746] animate-fade-in">
                        <strong className={selected === data.correctIndex ? 'text-[#137333]' : 'text-[#c5221f]'}>
                            {selected === data.correctIndex ? 'Correct!' : 'Not quite.'}
                        </strong>{' '}
                        {data.explanation}
                    </div>
                )}
            </div>
        );
    };

    // ===== NEW INTERACTIVE WIDGET COMPONENTS =====

    // Fill in the Blank Activity
    const FillBlankActivity = ({ data }: { data: any }) => {
        const [answers, setAnswers] = useState<string[]>(Array(data.answers?.length || 0).fill(''));
        const [submitted, setSubmitted] = useState(false);

        const parts = (data.sentence || '').split('{{BLANK}}');

        const handleSubmit = () => setSubmitted(true);
        const handleReset = () => {
            setAnswers(Array(data.answers?.length || 0).fill(''));
            setSubmitted(false);
        };

        const isCorrect = (idx: number) => answers[idx]?.toLowerCase().trim() === data.answers?.[idx]?.toLowerCase().trim();
        const allCorrect = data.answers?.every((_: string, idx: number) => isCorrect(idx));

        return (
            <div className="my-8 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl p-6 border border-indigo-100">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center">
                        <span className="text-indigo-600 font-bold">✎</span>
                    </div>
                    <h4 className="font-bold text-[#1f1f1f]">{data.title || 'Fill in the Blanks'}</h4>
                </div>
                <div className="text-lg leading-relaxed text-[#1f1f1f] flex flex-wrap items-center gap-1">
                    {parts.map((part: string, idx: number) => (
                        <React.Fragment key={idx}>
                            <span>{part}</span>
                            {idx < parts.length - 1 && (
                                <input
                                    type="text"
                                    value={answers[idx] || ''}
                                    onChange={(e) => {
                                        const newAnswers = [...answers];
                                        newAnswers[idx] = e.target.value;
                                        setAnswers(newAnswers);
                                    }}
                                    disabled={submitted}
                                    className={`inline-block w-32 px-3 py-1 mx-1 rounded-lg border-2 font-medium text-center transition-all ${submitted
                                        ? isCorrect(idx)
                                            ? 'bg-green-100 border-green-400 text-green-700'
                                            : 'bg-red-100 border-red-400 text-red-700'
                                        : 'bg-white border-indigo-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 text-gray-800 placeholder-gray-400'
                                        }`}
                                    placeholder="..."
                                />
                            )}
                        </React.Fragment>
                    ))}
                </div>
                <div className="mt-4 flex gap-3">
                    {!submitted ? (
                        <button onClick={handleSubmit} className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg font-medium transition-all">
                            Check Answers
                        </button>
                    ) : (
                        <>
                            <button onClick={handleReset} className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-medium transition-all">
                                Try Again
                            </button>
                            <span className={`px-4 py-2 rounded-lg font-medium ${allCorrect ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                                {allCorrect ? '🎉 Perfect!' : `${data.answers?.filter((_: string, i: number) => isCorrect(i)).length}/${data.answers?.length} correct`}
                            </span>
                        </>
                    )}
                </div>
                {submitted && !allCorrect && (
                    <div className="mt-3 text-sm text-gray-600">
                        Correct answers: {data.answers?.join(', ')}
                    </div>
                )}
            </div>
        );
    };

    // Matching Activity
    const MatchingActivity = ({ data }: { data: any }) => {
        const [matches, setMatches] = useState<{ [key: number]: number | null }>({});
        const [submitted, setSubmitted] = useState(false);
        const [selectedLeft, setSelectedLeft] = useState<number | null>(null);

        const handleLeftClick = (idx: number) => {
            if (submitted) return;
            setSelectedLeft(idx);
        };

        const handleRightClick = (idx: number) => {
            if (submitted || selectedLeft === null) return;
            setMatches(prev => ({ ...prev, [selectedLeft]: idx }));
            setSelectedLeft(null);
        };

        const handleSubmit = () => setSubmitted(true);
        const handleReset = () => {
            setMatches({});
            setSubmitted(false);
            setSelectedLeft(null);
        };

        const isCorrect = (leftIdx: number) => matches[leftIdx] === data.correctPairs?.[leftIdx];
        const score = Object.keys(matches).filter(k => isCorrect(Number(k))).length;

        return (
            <div className="my-8 bg-gradient-to-br from-teal-50 to-cyan-50 rounded-2xl p-6 border border-teal-100">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 bg-teal-100 rounded-full flex items-center justify-center">
                        <span className="text-teal-600 font-bold">↔</span>
                    </div>
                    <h4 className="font-bold text-[#1f1f1f]">{data.title || 'Match the Items'}</h4>
                </div>
                <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                        {data.leftItems?.map((item: string, idx: number) => (
                            <button
                                key={idx}
                                onClick={() => handleLeftClick(idx)}
                                className={`w-full text-left p-3 rounded-lg border-2 transition-all font-medium ${submitted
                                    ? isCorrect(idx)
                                        ? 'bg-green-100 border-green-400 text-green-700'
                                        : matches[idx] !== undefined
                                            ? 'bg-red-100 border-red-400 text-red-700'
                                            : 'bg-gray-100 border-gray-300 text-gray-700'
                                    : selectedLeft === idx
                                        ? 'bg-teal-100 border-teal-500 ring-2 ring-teal-200 text-teal-800'
                                        : matches[idx] !== undefined
                                            ? 'bg-teal-50 border-teal-300 text-teal-700'
                                            : 'bg-white border-gray-200 hover:border-teal-400 text-gray-800'
                                    }`}
                            >
                                {item}
                                {matches[idx] !== undefined && (
                                    <span className="ml-2 text-teal-500">→ {String.fromCharCode(65 + matches[idx]!)}</span>
                                )}
                            </button>
                        ))}
                    </div>
                    <div className="space-y-2">
                        {data.rightItems?.map((item: string, idx: number) => (
                            <button
                                key={idx}
                                onClick={() => handleRightClick(idx)}
                                disabled={submitted}
                                className={`w-full text-left p-3 rounded-lg border-2 transition-all font-medium ${submitted
                                    ? 'bg-gray-50 border-gray-200 text-gray-700'
                                    : selectedLeft !== null
                                        ? 'bg-white border-gray-200 hover:border-teal-400 hover:bg-teal-50 cursor-pointer text-gray-800'
                                        : 'bg-gray-50 border-gray-200 text-gray-700'
                                    }`}
                            >
                                <span className="text-teal-600 font-bold mr-2">{String.fromCharCode(65 + idx)}.</span>
                                {item}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="mt-4 flex gap-3">
                    {!submitted ? (
                        <button onClick={handleSubmit} disabled={Object.keys(matches).length < (data.leftItems?.length || 0)} className="px-4 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                            Check Matches
                        </button>
                    ) : (
                        <>
                            <button onClick={handleReset} className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-medium transition-all">
                                Try Again
                            </button>
                            <span className={`px-4 py-2 rounded-lg font-medium ${score === data.leftItems?.length ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                                {score === data.leftItems?.length ? '🎉 Perfect!' : `${score}/${data.leftItems?.length} correct`}
                            </span>
                        </>
                    )}
                </div>
            </div>
        );
    };

    // Ordering Activity
    const OrderingActivity = ({ data }: { data: any }) => {
        const [items, setItems] = useState<string[]>(data.items ? [...data.items].sort(() => Math.random() - 0.5) : []);
        const [submitted, setSubmitted] = useState(false);
        const [draggedIdx, setDraggedIdx] = useState<number | null>(null);

        const handleDragStart = (idx: number) => setDraggedIdx(idx);
        const handleDragOver = (e: React.DragEvent, idx: number) => {
            e.preventDefault();
            if (draggedIdx === null || draggedIdx === idx) return;
            const newItems = [...items];
            const [removed] = newItems.splice(draggedIdx, 1);
            newItems.splice(idx, 0, removed);
            setItems(newItems);
            setDraggedIdx(idx);
        };
        const handleDragEnd = () => setDraggedIdx(null);

        const handleSubmit = () => setSubmitted(true);
        const handleReset = () => {
            setItems(data.items ? [...data.items].sort(() => Math.random() - 0.5) : []);
            setSubmitted(false);
        };

        const correctOrder = data.correctOrder?.map((i: number) => data.items?.[i]) || data.items;
        const isCorrect = items.every((item, idx) => item === correctOrder[idx]);

        return (
            <div className="my-8 bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl p-6 border border-amber-100">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center">
                        <span className="text-amber-600 font-bold">↕</span>
                    </div>
                    <h4 className="font-bold text-[#1f1f1f]">{data.title || 'Arrange in Order'}</h4>
                </div>
                {data.orderingContext && <p className="text-gray-600 mb-3">{data.orderingContext}</p>}
                <div className="space-y-2">
                    {items.map((item, idx) => (
                        <div
                            key={`${item}-${idx}`}
                            draggable={!submitted}
                            onDragStart={() => handleDragStart(idx)}
                            onDragOver={(e) => handleDragOver(e, idx)}
                            onDragEnd={handleDragEnd}
                            className={`p-3 rounded-lg border-2 transition-all font-medium cursor-move flex items-center gap-3 ${submitted
                                ? item === correctOrder[idx]
                                    ? 'bg-green-100 border-green-400 text-green-700'
                                    : 'bg-red-100 border-red-400 text-red-700'
                                : draggedIdx === idx
                                    ? 'bg-amber-100 border-amber-500 scale-105 shadow-lg text-amber-800'
                                    : 'bg-white border-gray-200 hover:border-amber-400 text-gray-800'
                                }`}
                        >
                            <span className="w-6 h-6 bg-amber-200 rounded-full flex items-center justify-center text-sm font-bold text-amber-700">
                                {idx + 1}
                            </span>
                            {item}
                        </div>
                    ))}
                </div>
                <div className="mt-4 flex gap-3">
                    {!submitted ? (
                        <button onClick={handleSubmit} className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-medium transition-all">
                            Check Order
                        </button>
                    ) : (
                        <>
                            <button onClick={handleReset} className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-medium transition-all">
                                Try Again
                            </button>
                            <span className={`px-4 py-2 rounded-lg font-medium ${isCorrect ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                {isCorrect ? '🎉 Perfect order!' : 'Not quite right'}
                            </span>
                        </>
                    )}
                </div>
            </div>
        );
    };

    // True/False Activity
    const TrueFalseActivity = ({ data }: { data: any }) => {
        const [answers, setAnswers] = useState<{ [key: number]: boolean | null }>({});
        const [submitted, setSubmitted] = useState(false);

        const handleAnswer = (idx: number, answer: boolean) => {
            if (submitted) return;
            setAnswers(prev => ({ ...prev, [idx]: answer }));
        };

        const handleSubmit = () => setSubmitted(true);
        const handleReset = () => {
            setAnswers({});
            setSubmitted(false);
        };

        const score = data.statements?.filter((s: any, idx: number) => answers[idx] === s.isTrue).length || 0;

        return (
            <div className="my-8 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-6 border border-blue-100">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                        <span className="text-blue-600 font-bold">T/F</span>
                    </div>
                    <h4 className="font-bold text-[#1f1f1f]">{data.title || 'True or False?'}</h4>
                </div>
                <div className="space-y-4">
                    {data.statements?.map((statement: any, idx: number) => (
                        <div key={idx} className={`p-4 rounded-lg border-2 transition-all ${submitted
                            ? answers[idx] === statement.isTrue
                                ? 'bg-green-50 border-green-300'
                                : 'bg-red-50 border-red-300'
                            : 'bg-white border-gray-200'
                            }`}>
                            <p className="font-medium text-[#1f1f1f] mb-3">{statement.text}</p>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => handleAnswer(idx, true)}
                                    className={`px-4 py-2 rounded-lg font-medium transition-all ${answers[idx] === true
                                        ? submitted && statement.isTrue
                                            ? 'bg-green-500 text-white'
                                            : submitted
                                                ? 'bg-red-500 text-white'
                                                : 'bg-blue-500 text-white'
                                        : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                                        }`}
                                >
                                    True
                                </button>
                                <button
                                    onClick={() => handleAnswer(idx, false)}
                                    className={`px-4 py-2 rounded-lg font-medium transition-all ${answers[idx] === false
                                        ? submitted && !statement.isTrue
                                            ? 'bg-green-500 text-white'
                                            : submitted
                                                ? 'bg-red-500 text-white'
                                                : 'bg-blue-500 text-white'
                                        : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                                        }`}
                                >
                                    False
                                </button>
                            </div>
                            {submitted && (
                                <p className={`mt-2 text-sm ${answers[idx] === statement.isTrue ? 'text-green-700' : 'text-red-700'}`}>
                                    {statement.explanation}
                                </p>
                            )}
                        </div>
                    ))}
                </div>
                <div className="mt-4 flex gap-3">
                    {!submitted ? (
                        <button onClick={handleSubmit} disabled={Object.keys(answers).length < (data.statements?.length || 0)} className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                            Check Answers
                        </button>
                    ) : (
                        <>
                            <button onClick={handleReset} className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-medium transition-all">
                                Try Again
                            </button>
                            <span className={`px-4 py-2 rounded-lg font-medium ${score === data.statements?.length ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                                {score === data.statements?.length ? '🎉 All correct!' : `${score}/${data.statements?.length} correct`}
                            </span>
                        </>
                    )}
                </div>
            </div>
        );
    };

    // Labeling Activity
    const LabelingActivity = ({ data }: { data: any }) => {
        const [matches, setMatches] = useState<{ [key: number]: number | null }>({});
        const [submitted, setSubmitted] = useState(false);

        const handleMatch = (labelIdx: number, descIdx: number) => {
            if (submitted) return;
            setMatches(prev => ({ ...prev, [labelIdx]: descIdx }));
        };

        const handleSubmit = () => setSubmitted(true);
        const handleReset = () => {
            setMatches({});
            setSubmitted(false);
        };

        const score = Object.keys(matches).filter(k => Number(k) === matches[Number(k)]).length;

        return (
            <div className="my-8 bg-gradient-to-br from-pink-50 to-rose-50 rounded-2xl p-6 border border-pink-100">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 bg-pink-100 rounded-full flex items-center justify-center">
                        <span className="text-pink-600 font-bold">🏷️</span>
                    </div>
                    <h4 className="font-bold text-[#1f1f1f]">{data.title || 'Label the Parts'}</h4>
                </div>
                <div className="space-y-3">
                    {data.labels?.map((label: string, labelIdx: number) => (
                        <div key={labelIdx} className="flex items-center gap-4">
                            <span className={`px-3 py-2 rounded-lg font-bold min-w-[120px] ${submitted
                                ? matches[labelIdx] === labelIdx
                                    ? 'bg-green-100 text-green-700 border-2 border-green-400'
                                    : 'bg-red-100 text-red-700 border-2 border-red-400'
                                : 'bg-pink-100 text-pink-700 border-2 border-pink-300'
                                }`}>
                                {label}
                            </span>
                            <span className="text-gray-400">→</span>
                            <select
                                value={matches[labelIdx] ?? ''}
                                onChange={(e) => handleMatch(labelIdx, Number(e.target.value))}
                                disabled={submitted}
                                className={`flex-1 p-2 rounded-lg border-2 font-medium text-gray-800 ${submitted
                                    ? matches[labelIdx] === labelIdx
                                        ? 'bg-green-50 border-green-400 text-green-700'
                                        : 'bg-red-50 border-red-400 text-red-700'
                                    : 'bg-white border-gray-200 focus:border-pink-400'
                                    }`}
                            >
                                <option value="">Select description...</option>
                                {data.descriptions?.map((desc: string, descIdx: number) => (
                                    <option key={descIdx} value={descIdx}>{desc}</option>
                                ))}
                            </select>
                        </div>
                    ))}
                </div>
                <div className="mt-4 flex gap-3">
                    {!submitted ? (
                        <button onClick={handleSubmit} disabled={Object.keys(matches).length < (data.labels?.length || 0)} className="px-4 py-2 bg-pink-500 hover:bg-pink-600 text-white rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                            Check Labels
                        </button>
                    ) : (
                        <>
                            <button onClick={handleReset} className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-medium transition-all">
                                Try Again
                            </button>
                            <span className={`px-4 py-2 rounded-lg font-medium ${score === data.labels?.length ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                                {score === data.labels?.length ? '🎉 Perfect!' : `${score}/${data.labels?.length} correct`}
                            </span>
                        </>
                    )}
                </div>
            </div>
        );
    };

    // Reflection Activity
    const ReflectionActivity = ({ data }: { data: any }) => {
        const [response, setResponse] = useState('');
        const [showSample, setShowSample] = useState(false);

        return (
            <div className="my-8 bg-gradient-to-br from-violet-50 to-purple-50 rounded-2xl p-6 border border-violet-100">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 bg-violet-100 rounded-full flex items-center justify-center">
                        <span className="text-violet-600 font-bold">💭</span>
                    </div>
                    <h4 className="font-bold text-[#1f1f1f]">{data.title || 'Reflect & Think'}</h4>
                </div>
                <p className="text-lg text-[#1f1f1f] mb-4">{data.reflectionPrompt}</p>
                <textarea
                    value={response}
                    onChange={(e) => setResponse(e.target.value)}
                    placeholder="Write your thoughts here..."
                    className="w-full p-4 rounded-lg border-2 border-violet-200 focus:border-violet-400 focus:ring-2 focus:ring-violet-200 min-h-[120px] resize-y"
                />
                <div className="mt-4 flex gap-3">
                    <button
                        onClick={() => setShowSample(!showSample)}
                        className="px-4 py-2 bg-violet-500 hover:bg-violet-600 text-white rounded-lg font-medium transition-all"
                    >
                        {showSample ? 'Hide Sample Response' : 'Show Sample Response'}
                    </button>
                </div>
                {showSample && data.sampleResponse && (
                    <div className="mt-4 p-4 bg-white rounded-lg border border-violet-200">
                        <p className="text-sm font-medium text-violet-600 mb-2">Sample Response:</p>
                        <p className="text-gray-700">{data.sampleResponse}</p>
                    </div>
                )}
            </div>
        );
    };

    // Code Playground Activity - Interactive coding exercise
    // Global Pyodide instance for Python execution
    const pyodideRef = useRef<any>(null);
    const [pyodideLoading, setPyodideLoading] = useState(false);
    const [pyodideReady, setPyodideReady] = useState(false);

    // Load Pyodide on first Python code execution
    const loadPyodide = async () => {
        if (pyodideRef.current) return pyodideRef.current;
        if (pyodideLoading) return null;

        setPyodideLoading(true);
        try {
            // Dynamically load Pyodide script
            if (!(window as any).loadPyodide) {
                await new Promise<void>((resolve, reject) => {
                    const script = document.createElement('script');
                    script.src = 'https://cdn.jsdelivr.net/pyodide/v0.24.1/full/pyodide.js';
                    script.onload = () => resolve();
                    script.onerror = () => reject(new Error('Failed to load Pyodide'));
                    document.head.appendChild(script);
                });
            }

            const pyodide = await (window as any).loadPyodide({
                indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.24.1/full/'
            });

            pyodideRef.current = pyodide;
            setPyodideReady(true);
            return pyodide;
        } catch (error) {
            console.error('Failed to load Pyodide:', error);
            return null;
        } finally {
            setPyodideLoading(false);
        }
    };

    // Code Playground Activity - Interactive coding exercise with REAL Python execution
    const CodePlaygroundActivity = ({ data }: { data: any }) => {
        const [code, setCode] = useState(data.code || '');
        const [output, setOutput] = useState('');
        const [showHints, setShowHints] = useState(false);
        const [isRunning, setIsRunning] = useState(false);
        const [showExpected, setShowExpected] = useState(false);
        const [isPyodideLoading, setIsPyodideLoading] = useState(false);

        // Run Python code using Pyodide
        const runPythonCode = async (pythonCode: string) => {
            setIsPyodideLoading(!pyodideReady);
            const pyodide = await loadPyodide();
            setIsPyodideLoading(false);

            if (!pyodide) {
                return 'Error: Failed to load Python runtime. Please try again.';
            }

            try {
                // Redirect stdout to capture print statements
                pyodide.runPython(`
import sys
from io import StringIO
sys.stdout = StringIO()
sys.stderr = StringIO()
                `);

                // Run the user's code
                let result;
                try {
                    result = pyodide.runPython(pythonCode);
                } catch (e: any) {
                    const stderr = pyodide.runPython('sys.stderr.getvalue()');
                    return `Error:\n${e.message}\n${stderr}`;
                }

                // Get captured output
                const stdout = pyodide.runPython('sys.stdout.getvalue()');
                const stderr = pyodide.runPython('sys.stderr.getvalue()');

                // Reset stdout/stderr
                pyodide.runPython(`
sys.stdout = sys.__stdout__
sys.stderr = sys.__stderr__
                `);

                let output = '';
                if (stdout) output += stdout;
                if (stderr) output += `\nStderr:\n${stderr}`;
                if (result !== undefined && result !== null && !stdout) {
                    output += String(result);
                }

                return output.trim() || 'Code executed successfully (no output)';
            } catch (error: any) {
                return `Error: ${error.message}`;
            }
        };

        const handleRunCode = async () => {
            setIsRunning(true);
            setOutput('');

            try {
                if (data.language === 'python' || !data.language) {
                    // Use Pyodide for Python
                    const result = await runPythonCode(code);
                    setOutput(result);
                } else if (data.language === 'javascript' || data.language === 'typescript') {
                    // For JavaScript/TypeScript, use eval
                    try {
                        const logs: string[] = [];
                        const originalLog = console.log;
                        console.log = (...args) => logs.push(args.map(String).join(' '));

                        // eslint-disable-next-line no-new-func
                        const result = new Function(code)();

                        console.log = originalLog;
                        let output = logs.join('\n');
                        if (result !== undefined) {
                            output += (output ? '\n' : '') + String(result);
                        }
                        setOutput(output || 'Code executed successfully (no output)');
                    } catch (err: any) {
                        setOutput(`Error: ${err.message}`);
                    }
                } else {
                    setOutput(`[${data.language}] Code execution not supported for this language.\nCheck your code logic and compare with the expected output.`);
                }
            } catch (err: any) {
                setOutput(`Error: ${err.message}`);
            } finally {
                setIsRunning(false);
            }
        };

        const handleReset = () => {
            setCode(data.code || '');
            setOutput('');
            setShowExpected(false);
        };

        return (
            <div className="my-8 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl p-6 border border-emerald-200 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                        <span className="text-2xl">🐍</span>
                    </div>
                    <div>
                        <h4 className="font-bold text-[#1f1f1f] text-lg">{data.title || 'Python Playground'}</h4>
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-emerald-600 font-medium uppercase tracking-wide">{data.language || 'python'}</span>
                            {pyodideReady && <span className="text-xs text-green-500">● Python Ready</span>}
                        </div>
                    </div>
                </div>

                {/* Challenge description */}
                {data.challenge && (
                    <div className="mb-4 p-4 bg-white/60 rounded-xl border border-emerald-100">
                        <p className="text-[15px] text-gray-700 flex items-start gap-2">
                            <Target className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                            <span><strong>Challenge:</strong> {data.challenge}</span>
                        </p>
                    </div>
                )}

                {/* Code editor */}
                <div className="mb-4 rounded-xl overflow-hidden border border-gray-300 shadow-sm">
                    <div className="bg-gray-800 text-gray-300 px-4 py-2 text-xs flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="font-medium">{data.language || 'python'}</span>
                            {isPyodideLoading && <span className="text-yellow-400 animate-pulse">Loading Python...</span>}
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => navigator.clipboard.writeText(code)}
                                className="hover:text-white transition-colors flex items-center gap-1"
                            >
                                <Copy className="w-3.5 h-3.5" />
                                <span>Copy</span>
                            </button>
                        </div>
                    </div>
                    <textarea
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                        className="w-full bg-gray-900 text-gray-100 p-4 font-mono text-sm leading-relaxed min-h-[200px] resize-y focus:outline-none"
                        spellCheck={false}
                        placeholder="# Write your Python code here..."
                    />
                </div>

                {/* Action buttons */}
                <div className="flex flex-wrap gap-3 mb-4">
                    <button
                        onClick={handleRunCode}
                        disabled={isRunning}
                        className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-300 text-white rounded-lg font-medium transition-all flex items-center gap-2"
                    >
                        {isRunning ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                {isPyodideLoading ? 'Loading Python...' : 'Running...'}
                            </>
                        ) : (
                            <>
                                <Play className="w-4 h-4" />
                                Run Code
                            </>
                        )}
                    </button>
                    <button
                        onClick={handleReset}
                        className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-medium transition-all flex items-center gap-2"
                    >
                        <RefreshCw className="w-4 h-4" />
                        Reset
                    </button>
                    {data.hints && data.hints.length > 0 && (
                        <button
                            onClick={() => setShowHints(!showHints)}
                            className="px-4 py-2 bg-amber-100 hover:bg-amber-200 text-amber-700 rounded-lg font-medium transition-all flex items-center gap-2"
                        >
                            <Lightbulb className="w-4 h-4" />
                            {showHints ? 'Hide Hints' : 'Show Hints'}
                        </button>
                    )}
                    {data.expectedOutput && (
                        <button
                            onClick={() => setShowExpected(!showExpected)}
                            className="px-4 py-2 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg font-medium transition-all flex items-center gap-2"
                        >
                            <Eye className="w-4 h-4" />
                            {showExpected ? 'Hide Expected' : 'Show Expected'}
                        </button>
                    )}
                </div>

                {/* Hints section */}
                {showHints && data.hints && (
                    <div className="mb-4 p-4 bg-amber-50 rounded-xl border border-amber-200">
                        <p className="text-sm font-medium text-amber-700 mb-2 flex items-center gap-2">
                            <Lightbulb className="w-4 h-4" />
                            Hints:
                        </p>
                        <ul className="space-y-1">
                            {data.hints.map((hint: string, idx: number) => (
                                <li key={idx} className="text-sm text-amber-800 flex items-start gap-2">
                                    <span className="text-amber-500 font-bold">{idx + 1}.</span>
                                    {hint}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* Output section */}
                {output && (
                    <div className="mb-4 rounded-xl overflow-hidden border border-gray-300">
                        <div className="bg-gray-700 text-gray-300 px-4 py-2 text-xs font-medium flex items-center gap-2">
                            <span>Output</span>
                            {output.startsWith('Error') && <span className="text-red-400">⚠️</span>}
                        </div>
                        <pre className={`bg-gray-800 p-4 font-mono text-sm overflow-x-auto whitespace-pre-wrap ${output.startsWith('Error') ? 'text-red-400' : 'text-green-400'
                            }`}>
                            {output}
                        </pre>
                    </div>
                )}

                {/* Expected output */}
                {showExpected && data.expectedOutput && (
                    <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
                        <p className="text-sm font-medium text-blue-700 mb-2 flex items-center gap-2">
                            <Target className="w-4 h-4" />
                            Expected Output:
                        </p>
                        <pre className="text-sm text-blue-800 font-mono bg-white p-3 rounded-lg">
                            {data.expectedOutput}
                        </pre>
                    </div>
                )}
            </div>
        );
    };

    // Python Interactive REPL Component
    const PythonREPL = () => {
        const [history, setHistory] = useState<{ input: string; output: string; isError: boolean }[]>([]);
        const [currentInput, setCurrentInput] = useState('');
        const [isLoading, setIsLoading] = useState(false);
        const [isInitializing, setIsInitializing] = useState(true);
        const inputRef = useRef<HTMLInputElement>(null);
        const outputRef = useRef<HTMLDivElement>(null);

        useEffect(() => {
            // Initialize Pyodide when REPL mounts
            const init = async () => {
                await loadPyodide();
                setIsInitializing(false);
            };
            init();
        }, []);

        useEffect(() => {
            // Scroll to bottom when new output is added
            if (outputRef.current) {
                outputRef.current.scrollTop = outputRef.current.scrollHeight;
            }
        }, [history]);

        const executeCommand = async () => {
            if (!currentInput.trim() || isLoading) return;

            const pyodide = pyodideRef.current;
            if (!pyodide) {
                setHistory(prev => [...prev, {
                    input: currentInput,
                    output: 'Error: Python runtime not ready. Please wait...',
                    isError: true
                }]);
                return;
            }

            setIsLoading(true);
            const command = currentInput;
            setCurrentInput('');

            try {
                // Redirect stdout
                pyodide.runPython(`
import sys
from io import StringIO
_stdout_capture = StringIO()
_stderr_capture = StringIO()
sys.stdout = _stdout_capture
sys.stderr = _stderr_capture
                `);

                let result;
                let hasError = false;
                let output = '';

                try {
                    result = pyodide.runPython(command);
                    const stdout = pyodide.runPython('_stdout_capture.getvalue()');
                    const stderr = pyodide.runPython('_stderr_capture.getvalue()');

                    if (stdout) output += stdout;
                    if (stderr) {
                        output += stderr;
                        hasError = true;
                    }
                    if (result !== undefined && result !== null && !stdout) {
                        output += String(result);
                    }
                } catch (e: any) {
                    output = e.message;
                    hasError = true;
                }

                // Reset stdout/stderr
                pyodide.runPython(`
sys.stdout = sys.__stdout__
sys.stderr = sys.__stderr__
                `);

                setHistory(prev => [...prev, {
                    input: command,
                    output: output.trim() || '',
                    isError: hasError
                }]);
            } catch (error: any) {
                setHistory(prev => [...prev, {
                    input: command,
                    output: error.message,
                    isError: true
                }]);
            } finally {
                setIsLoading(false);
                inputRef.current?.focus();
            }
        };

        const handleKeyDown = (e: React.KeyboardEvent) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                executeCommand();
            }
        };

        return (
            <div className="my-8 rounded-2xl overflow-hidden border border-gray-700 shadow-lg">
                {/* Terminal header */}
                <div className="bg-gray-800 px-4 py-2 flex items-center gap-2">
                    <div className="flex gap-1.5">
                        <div className="w-3 h-3 rounded-full bg-red-500"></div>
                        <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                        <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    </div>
                    <span className="text-gray-400 text-sm font-mono ml-2">Python 3.11 (Pyodide)</span>
                    {pyodideReady && <span className="text-green-400 text-xs ml-auto">● Connected</span>}
                </div>

                {/* Terminal output */}
                <div
                    ref={outputRef}
                    className="bg-gray-900 p-4 font-mono text-sm max-h-[400px] overflow-y-auto"
                    onClick={() => inputRef.current?.focus()}
                >
                    {/* Welcome message */}
                    <div className="text-gray-400 mb-2">
                        Python 3.11.3 (Pyodide) on WebAssembly/Emscripten<br />
                        Type Python commands below. Press Enter to execute.
                    </div>

                    {isInitializing && (
                        <div className="text-yellow-400 flex items-center gap-2 mb-2">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Loading Python runtime...
                        </div>
                    )}

                    {/* Command history */}
                    {history.map((entry, idx) => (
                        <div key={idx} className="mb-2">
                            <div className="text-green-400">
                                <span className="text-gray-500">{'>>> '}</span>
                                {entry.input}
                            </div>
                            {entry.output && (
                                <div className={entry.isError ? 'text-red-400' : 'text-gray-100'}>
                                    {entry.output}
                                </div>
                            )}
                        </div>
                    ))}

                    {/* Current input line */}
                    <div className="flex items-center">
                        <span className="text-gray-500">{'>>> '}</span>
                        <input
                            ref={inputRef}
                            type="text"
                            value={currentInput}
                            onChange={(e) => setCurrentInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            disabled={isLoading || isInitializing}
                            className="flex-1 bg-transparent text-green-400 outline-none font-mono"
                            placeholder={isInitializing ? 'Loading...' : 'Enter Python command...'}
                            autoFocus
                        />
                        {isLoading && <Loader2 className="w-4 h-4 text-yellow-400 animate-spin ml-2" />}
                    </div>
                </div>
            </div>
        );
    };

    // Code Explanation Activity - Step-by-step code walkthrough
    const CodeExplanationActivity = ({ data }: { data: any }) => {
        const [activeLineIndex, setActiveLineIndex] = useState<number | null>(null);
        const [showAll, setShowAll] = useState(false);

        const codeLines = data.codeLines || [];

        return (
            <div className="my-8 bg-gradient-to-br from-sky-50 to-indigo-50 rounded-2xl p-6 border border-sky-200 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-sky-100 rounded-xl flex items-center justify-center">
                        <span className="text-2xl">📖</span>
                    </div>
                    <div>
                        <h4 className="font-bold text-[#1f1f1f] text-lg">{data.title || 'Code Walkthrough'}</h4>
                        <span className="text-xs text-sky-600 font-medium uppercase tracking-wide">{data.codeLanguage || 'code'}</span>
                    </div>
                </div>

                {/* Overall explanation */}
                {data.overallExplanation && (
                    <div className="mb-4 p-4 bg-white/60 rounded-xl border border-sky-100">
                        <p className="text-[15px] text-gray-700 flex items-start gap-2">
                            <Info className="w-5 h-5 text-sky-500 flex-shrink-0 mt-0.5" />
                            <span>{data.overallExplanation}</span>
                        </p>
                    </div>
                )}

                {/* Toggle button */}
                <div className="mb-4">
                    <button
                        onClick={() => setShowAll(!showAll)}
                        className="px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-lg font-medium transition-all text-sm"
                    >
                        {showAll ? 'Interactive Mode' : 'Show All Explanations'}
                    </button>
                </div>

                {/* Code with explanations */}
                <div className="rounded-xl overflow-hidden border border-gray-300 shadow-sm">
                    <div className="bg-gray-800 text-gray-300 px-4 py-2 text-xs flex items-center justify-between">
                        <span className="font-medium">{data.codeLanguage || 'code'}</span>
                        <span className="text-gray-500">Click a line to see explanation</span>
                    </div>
                    <div className="bg-gray-900">
                        {codeLines.map((lineData: { line: string; explanation: string }, idx: number) => (
                            <div key={idx} className="group">
                                <div
                                    onClick={() => setActiveLineIndex(activeLineIndex === idx ? null : idx)}
                                    className={`flex items-stretch cursor-pointer transition-all ${activeLineIndex === idx
                                        ? 'bg-sky-900/40'
                                        : 'hover:bg-gray-800/50'
                                        }`}
                                >
                                    {/* Line number */}
                                    <div className="w-12 flex-shrink-0 bg-gray-800/50 text-gray-500 text-right pr-3 py-1 select-none font-mono text-sm border-r border-gray-700">
                                        {idx + 1}
                                    </div>
                                    {/* Code */}
                                    <pre className="flex-1 px-4 py-1 font-mono text-sm text-gray-100 overflow-x-auto">
                                        <code>{lineData.line}</code>
                                    </pre>
                                    {/* Indicator */}
                                    <div className={`w-8 flex items-center justify-center ${activeLineIndex === idx ? 'text-sky-400' : 'text-gray-600 group-hover:text-gray-400'
                                        }`}>
                                        <ChevronRight className={`w-4 h-4 transition-transform ${activeLineIndex === idx ? 'rotate-90' : ''}`} />
                                    </div>
                                </div>
                                {/* Explanation (shown when clicked or showAll) */}
                                {(activeLineIndex === idx || showAll) && lineData.explanation && (
                                    <div className="bg-sky-900/20 px-4 py-3 pl-16 border-l-4 border-sky-500">
                                        <p className="text-sm text-sky-200 flex items-start gap-2">
                                            <Zap className="w-4 h-4 text-sky-400 flex-shrink-0 mt-0.5" />
                                            {lineData.explanation}
                                        </p>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Summary at bottom */}
                {!showAll && activeLineIndex === null && (
                    <p className="mt-4 text-sm text-gray-500 text-center">
                        💡 Click on any line of code to see its explanation
                    </p>
                )}
            </div>
        );
    };

    // ===== END NEW INTERACTIVE WIDGET COMPONENTS =====

    // Image Activity Handler
    const handleGenerateImageActivity = async () => {
        if (!imageActivityPrompt.trim()) return;

        setIsGeneratingImageActivity(true);
        try {
            const imageUrl = await generateImmersiveImage(imageActivityPrompt);
            setGeneratedImageActivityUrl(imageUrl);
        } catch (error) {
            console.error('Failed to generate image:', error);
            // Optional: Add error handling UI state
        } finally {
            setIsGeneratingImageActivity(false);
        }
    };

    const getLanguageExtension = (language: CodeLabLanguage) => {
        switch (language) {
            case 'javascript':
                return javascript();
            case 'java':
                return java();
            case 'cpp':
                return cpp();
            case 'python':
            default:
                return python();
        }
    };

    const codeLabExtensions = useMemo(() => [
        getLanguageExtension(codeLabLanguage),
        closeBrackets(),
        autocompletion()
    ], [codeLabLanguage]);

    const codeLabBasicSetup = useMemo(() => ({
        lineNumbers: true,
        highlightActiveLine: true,
        highlightActiveLineGutter: true,
        history: true,
        foldGutter: true,
        bracketMatching: true,
        tabSize: 4
    }), []);

    const extractCodeBlock = (text: string) => {
        const match = text.match(/```[\w+-]*\n([\s\S]*?)```/);
        return match ? match[1].trim() : text.trim();
    };

    const sanitizeCode = (text: string) => {
        let cleaned = text || '';
        cleaned = cleaned.replace(/```[\w+-]*\s*/g, '');
        cleaned = cleaned.replace(/```/g, '');
        cleaned = cleaned.replace(/^\s*(python|javascript|java|cpp)\s*/i, '');
        return cleaned.trimStart();
    };

    const handleAskCodeLabAi = async () => {
        if (!codeLabAiPrompt.trim()) return;
        setCodeLabAiLoading(true);
        setCodeLabAiStreaming(true);
        setCodeLabAiError(null);
        setCodeLabAiResponse('');

        const prompt = `You are a coding assistant using Gemini 2.5 Pro. Language: ${codeLabLanguage}.
Current file: ${codeLabFiles.find(f => f.id === codeLabActiveFileId)?.name || 'main'}.
Current code:\n${codeLabCode}\n\nUser request: ${codeLabAiPrompt}\n\nRespond with ONLY executable ${codeLabLanguage} code. Do NOT include markdown, fences, comments, or explanations—just the final code that can run as-is.`;

        let buffer = '';
        try {
            await generateStreamingContent(
                prompt,
                (chunk) => {
                    buffer += chunk;
                    setCodeLabAiResponse(buffer);
                    const extracted = extractCodeBlock(buffer);
                    const candidate = extracted || buffer;
                    const nextCode = sanitizeCode(candidate);
                    if (!nextCode) return;
                    setCodeLabCode(nextCode);
                    setCodeLabFiles(prev => prev.map(file => file.id === codeLabActiveFileId ? { ...file, content: nextCode } : file));
                },
                () => {
                    setCodeLabAiStreaming(false);
                    setCodeLabAiLoading(false);
                },
                (err) => {
                    setCodeLabAiError(err?.message || 'AI request failed');
                    setCodeLabAiStreaming(false);
                    setCodeLabAiLoading(false);
                }
            );
        } catch (err: any) {
            setCodeLabAiError(err?.message || 'AI request failed');
            setCodeLabAiStreaming(false);
            setCodeLabAiLoading(false);
        }
    };

    const handleInsertAiCode = () => {
        // Streaming writes directly into the editor; keep this as a no-op for legacy UI button.
        if (!codeLabAiResponse) return;
        const extracted = extractCodeBlock(codeLabAiResponse);
        const nextCode = sanitizeCode(extracted || codeLabAiResponse);
        setCodeLabCode(nextCode);
        setCodeLabFiles(prev => prev.map(file => file.id === codeLabActiveFileId ? { ...file, content: nextCode } : file));
    };

    const CodeLabView = () => {
        const activeFile = codeLabFiles.find(file => file.id === codeLabActiveFileId) || codeLabFiles[0];

        const handleFileSelect = (fileId: string) => {
            setCodeLabActiveFileId(fileId);
        };

        const handleCodeChange = (value: string) => {
            setCodeLabCode(value);
            setCodeLabFiles(prev => prev.map(file => file.id === (activeFile?.id || '') ? { ...file, content: value } : file));
        };

        const runCode = async () => {
            if (!activeFile) return;
            setCodeLabIsRunning(true);
            setCodeLabOutput('');

            try {
                if (codeLabLanguage === 'python') {
                    const pyodide = await loadPyodide();
                    if (!pyodide) {
                        setCodeLabOutput('Error: Failed to load Python runtime.');
                        return;
                    }

                    pyodide.runPython(`
import sys
from io import StringIO
sys.stdout = StringIO()
sys.stderr = StringIO()
                    `);

                    try {
                        pyodide.runPython(codeLabCode);
                    } catch (e: any) {
                        const stderr = pyodide.runPython('sys.stderr.getvalue()');
                        setCodeLabOutput(`Error:\n${e.message}\n${stderr}`);
                        return;
                    }

                    const stdout = pyodide.runPython('sys.stdout.getvalue()');
                    const stderr = pyodide.runPython('sys.stderr.getvalue()');
                    const combined = [stdout, stderr].filter(Boolean).join('\n');
                    setCodeLabOutput(combined.trim() || 'No output.');
                    return;
                }

                if (codeLabLanguage === 'javascript') {
                    const logs: string[] = [];
                    const originalLog = console.log;
                    console.log = (...args) => {
                        logs.push(args.map(String).join(' '));
                    };

                    try {
                        const result = eval(codeLabCode);
                        if (typeof result !== 'undefined') {
                            logs.push(`Result: ${typeof result === 'object' ? JSON.stringify(result, null, 2) : String(result)}`);
                        }
                    } catch (e: any) {
                        logs.push(`Error: ${e?.message || e}`);
                    } finally {
                        console.log = originalLog;
                    }

                    setCodeLabOutput(logs.join('\n') || 'No output.');
                    return;
                }

                setCodeLabOutput('Execution is available for Python and JavaScript right now.');
            } finally {
                setCodeLabIsRunning(false);
            }
        };

        const clearOutput = () => setCodeLabOutput('');

        if (!activeFile) {
            return (
                <div className="p-6 text-center text-[#444746]">
                    <p>No files are loaded in Code Lab.</p>
                </div>
            );
        }

        return (
            <div className="h-full flex flex-col">
                <div className="flex items-center gap-3 border-b border-[#e8eaed] bg-white px-4 py-3">
                    <div className="flex items-center gap-2">
                        {codeLabFiles.map(file => {
                            const isActive = file.id === activeFile.id;
                            return (
                                <button
                                    key={file.id}
                                    onClick={() => handleFileSelect(file.id)}
                                    className={`px-3 py-1.5 rounded-full text-sm transition-colors ${isActive ? 'bg-[#ecfdf3] text-[#065f46] border border-[#bbf7d0]' : 'bg-[#f1f3f4] text-[#444746] border border-transparent hover:bg-[#e4e7ea]'}`}
                                >
                                    {file.name}
                                </button>
                            );
                        })}
                    </div>

                    <div className="flex items-center gap-2 ml-auto">
                        <select
                            value={codeLabTheme}
                            onChange={(e) => setCodeLabTheme(e.target.value as 'vscode' | 'dracula')}
                            className="text-sm border border-[#dadce0] rounded-lg px-2 py-1 bg-white text-[#1f1f1f]"
                        >
                            <option value="vscode">VS Code</option>
                            <option value="dracula">Dracula</option>
                        </select>
                        <span className="text-xs text-[#5f6368] px-2 py-1 bg-[#f1f3f4] rounded-lg border border-[#dadce0]">
                            {activeFile.language === 'java' || activeFile.language === 'cpp' ? 'Run coming soon for Java/C++' : 'Python + JS runnable'}
                        </span>
                    </div>
                </div>

                <div className="flex flex-col lg:flex-row gap-4 p-4 h-full overflow-hidden">
                    <div className="flex-1 min-h-[340px] h-full">
                        <div className="flex items-center justify-between mb-2 gap-3 flex-wrap">
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-[#5f6368]">Language</span>
                                <select
                                    value={codeLabLanguage}
                                    onChange={(e) => {
                                        const nextLang = e.target.value as CodeLabLanguage;
                                        setCodeLabLanguage(nextLang);
                                        setCodeLabFiles(prev => prev.map(file => file.id === activeFile.id ? { ...file, language: nextLang } : file));
                                    }}
                                    className="text-sm border border-[#dadce0] rounded-lg px-2 py-1 bg-white text-[#1f1f1f]"
                                >
                                    <option value="python">Python</option>
                                    <option value="javascript">JavaScript</option>
                                    <option value="java">Java</option>
                                    <option value="cpp">C++</option>
                                </select>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={clearOutput}
                                    className="px-3 py-1.5 text-sm border border-[#dadce0] rounded-lg text-[#5f6368] hover:bg-[#f1f3f4]"
                                >
                                    Clear Output
                                </button>
                                <button
                                    onClick={runCode}
                                    disabled={codeLabIsRunning}
                                    className={`px-4 py-1.5 text-sm rounded-lg text-white flex items-center gap-2 ${codeLabIsRunning ? 'bg-[#9aa0a6] cursor-not-allowed' : 'bg-[#10b981] hover:bg-[#0ea271]'}`}
                                >
                                    {codeLabIsRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                                    {codeLabIsRunning ? 'Running' : 'Run'}
                                </button>
                            </div>
                        </div>

                        <div className="flex flex-col gap-2 mb-3">
                            <div className="flex flex-col lg:flex-row gap-2">
                                <input
                                    value={codeLabAiPrompt}
                                    onChange={(e) => setCodeLabAiPrompt(e.target.value)}
                                    placeholder="Ask AI to refactor, explain, or add a feature..."
                                    className="flex-1 text-sm border border-[#dadce0] rounded-lg px-3 py-2 bg-white text-[#1f1f1f] focus:outline-none focus:ring-2 focus:ring-[#10b981]"
                                />
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={handleAskCodeLabAi}
                                        disabled={codeLabAiLoading}
                                        className={`px-4 py-2 text-sm rounded-lg text-white flex items-center gap-2 ${codeLabAiLoading ? 'bg-[#9aa0a6] cursor-not-allowed' : 'bg-[#10b981] hover:bg-[#0ea271]'}`}
                                    >
                                        {codeLabAiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                                        {codeLabAiStreaming ? 'Streaming…' : 'Ask AI'}
                                    </button>
                                    <button
                                        onClick={handleInsertAiCode}
                                        disabled={!codeLabAiResponse}
                                        className={`px-4 py-2 text-sm rounded-lg border ${codeLabAiResponse ? 'border-[#10b981] text-[#065f46] hover:bg-[#ecfdf3]' : 'border-[#dadce0] text-[#9aa0a6] cursor-not-allowed'}`}
                                    >
                                        Insert
                                    </button>
                                </div>
                            </div>
                            {codeLabAiError && (
                                <div className="text-sm text-red-600">{codeLabAiError}</div>
                            )}
                            {codeLabAiResponse && (
                                <div className="border border-[#e8eaed] rounded-lg bg-white p-3 text-sm text-[#1f1f1f] max-h-48 overflow-auto">
                                    <div className="font-medium text-[#5f6368] mb-1">AI Suggestion</div>
                                    <pre className="whitespace-pre-wrap text-xs text-[#111827]">{codeLabAiResponse}</pre>
                                </div>
                            )}
                        </div>

                        <div className="border border-[#e8eaed] rounded-xl overflow-hidden h-[70vh]">
                            <CodeMirror
                                value={codeLabCode}
                                height="100%"
                                editable
                                theme={codeLabTheme === 'vscode' ? vscodeDark : dracula}
                                basicSetup={codeLabBasicSetup}
                                className="h-full"
                                style={{ height: '100%', minHeight: '70vh', backgroundColor: '#0b1220' }}
                                extensions={codeLabExtensions}
                                onChange={handleCodeChange}
                            />
                        </div>
                    </div>

                    <div className="w-full lg:w-80 flex-shrink-0 h-full">
                        <div className="bg-white border border-[#e8eaed] rounded-xl h-full flex flex-col shadow-sm">
                            <div className="px-4 py-3 border-b border-[#e8eaed] flex items-center justify-between">
                                <span className="text-sm font-medium text-[#1f1f1f]">Output</span>
                                <button onClick={clearOutput} className="text-xs text-[#5f6368] hover:text-[#1f1f1f]">Clear</button>
                            </div>
                            <div className="flex-1 px-4 py-3 overflow-auto bg-[#0b1220] text-[#e8eaed] font-mono text-sm rounded-b-xl">
                                {codeLabOutput ? codeLabOutput.split('\n').map((line, idx) => (
                                    <div key={idx} className="whitespace-pre-wrap leading-6">{line || ' '}</div>
                                )) : (
                                    <div className="text-[#9aa0a6]">Run code to see output here.</div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const renderContent = () => {
        if (isLoading) {
            return (
                <div className="flex flex-col items-center justify-center h-full space-y-4">
                    <Loader2 className="w-10 h-10 text-[#ff8b66] animate-spin" />
                    <p className="text-slate-300 text-sm font-medium">{loadingMessage}</p>
                </div>
            );
        }

        // Only show "Start Learning" fallback when NOT streaming
        // During streaming, let case 'immersive-text' handle the streaming UI
        // Robotics, 3D Viewer, and Code Lab work independently without needing uploaded content
        if (!immersiveContent && activeMode !== 'source' && activeMode !== 'robotics' && activeMode !== 'viewer3d' && activeMode !== 'code-lab' && activeMode !== 'assignment' && activeMode !== 'latex-assignment' && !isStreaming) {
            return (
                <div className="flex flex-col items-center justify-center h-full space-y-6 p-8">
                    <div className="text-center space-y-3 max-w-md">
                        <div className="w-16 h-16 bg-[#fff0e0] rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <FileText className="w-8 h-8 text-[#ff8b66]" />
                        </div>
                        <h2 className="text-2xl font-google-sans text-slate-100">Start Learning</h2>
                        <p className="text-slate-400">Upload a document to generate your immersive lesson.</p>
                    </div>
                    <button
                        onClick={() => setActiveMode('source')}
                        className="px-6 py-3 bg-[#ff8b66] hover:bg-[#ff8b66]/90 text-white rounded-full font-medium transition-all shadow-sm hover:shadow-md"
                    >
                        Go to Source Upload
                    </button>
                </div>
            );
        }

        // Filter workspaces based on search query
        const filteredWorkspaces = savedWorkspaces.filter(ws =>
            ws.name.toLowerCase().includes(workspaceSearchQuery.toLowerCase()) ||
            ws.description.toLowerCase().includes(workspaceSearchQuery.toLowerCase()) ||
            ws.documentFileName.toLowerCase().includes(workspaceSearchQuery.toLowerCase())
        );

        switch (activeMode) {
            case 'source':
                // Show processing animation when loading - Terminal Style
                if (isLoading) {
                    const terminalStages = [
                        {
                            name: 'Uploading',
                            status: processingStage === 'uploading' ? 'loading' :
                                ['extracting', 'analyzing', 'generating'].includes(processingStage) ? 'complete' : 'pending' as const
                        },
                        {
                            name: 'Extracting Content',
                            status: processingStage === 'extracting' ? 'loading' :
                                ['analyzing', 'generating'].includes(processingStage) ? 'complete' : 'pending' as const
                        },
                        {
                            name: 'Analyzing Structure',
                            status: processingStage === 'analyzing' ? 'loading' :
                                processingStage === 'generating' ? 'complete' : 'pending' as const
                        },
                        {
                            name: 'Generating Experience',
                            status: processingStage === 'generating' ? 'loading' : 'pending' as const
                        }
                    ];

                    const stageProgress = {
                        'idle': 0,
                        'uploading': 15,
                        'extracting': 40,
                        'analyzing': 65,
                        'generating': 90
                    };

                    return (
                        <div className="flex flex-col items-center justify-center h-full space-y-6 p-8">
                            <div className="w-full max-w-2xl">
                                {/* File name badge */}
                                {uploadedFileName && (
                                    <div className="flex items-center justify-center gap-2 px-4 py-2 bg-[#f8f9fa] rounded-full w-fit mx-auto mb-6">
                                        <FileText className="w-4 h-4 text-[#5f6368]" />
                                        <span className="text-sm text-[#5f6368] truncate max-w-[200px]">{uploadedFileName}</span>
                                    </div>
                                )}

                                {/* Terminal Progress Component */}
                                <ProgressTerminal
                                    stages={terminalStages}
                                    progress={stageProgress[processingStage]}
                                    subSteps={terminalSubSteps}
                                    title="immersive-learning"
                                />

                                {/* Current action message */}
                                <div className="mt-4 text-center">
                                    <p className="text-sm text-[#5f6368]">{loadingMessage}</p>
                                </div>
                            </div>
                        </div>
                    );
                }

                // Immersive Learning Workspace Manager UI - Dark Theme
                return (
                    <div className="flex flex-col h-full bg-[#131314] overflow-hidden">
                        {/* Header */}
                        <div className="px-4 sm:px-6 pt-4 pb-3 border-b border-[#3c4043]">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#8ab4f8] to-[#669df6] flex items-center justify-center">
                                        <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z" />
                                        </svg>
                                    </div>
                                    <div>
                                        <h1 className="text-xl font-medium text-white">Immersive Learning</h1>
                                        <p className="text-xs text-[#9aa0a6]">Your AI-powered learning workspace</p>
                                    </div>
                                </div>
                                <button
                                    onClick={createNewWorkspace}
                                    className="px-5 py-2.5 bg-[#8ab4f8] hover:bg-[#aecbfa] text-[#202124] rounded-full font-medium transition-all flex items-center gap-2 text-sm"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                    </svg>
                                    Create new
                                </button>
                            </div>
                        </div>

                        {/* Main Content Area - Full Width */}
                        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4">
                            {isLoadingWorkspaces ? (
                                <div className="flex items-center justify-center h-64">
                                    <Loader2 className="w-8 h-8 text-[#8ab4f8] animate-spin" />
                                </div>
                            ) : filteredWorkspaces.length === 0 && !workspaceSearchQuery ? (
                                /* Empty State - Immersive Learning */
                                <div className="flex flex-col items-center justify-center h-full">
                                    <div className="max-w-md text-center">
                                        {/* Animated gradient icon */}
                                        <div className="w-24 h-24 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-[#8ab4f8] via-[#c58af9] to-[#f28b82] p-0.5">
                                            <div className="w-full h-full rounded-2xl bg-[#131314] flex items-center justify-center">
                                                <span className="text-5xl">✨</span>
                                            </div>
                                        </div>
                                        <h2 className="text-2xl font-normal text-white mb-3">Welcome to Immersive Learning</h2>
                                        <p className="text-[#9aa0a6] text-sm mb-8 leading-relaxed">
                                            Upload your documents, and Immersive Learning will help you understand them better with AI-powered insights, summaries, and interactive learning.
                                        </p>
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            accept=".txt,.md,.pdf,.docx"
                                            onChange={handleFileUpload}
                                            className="hidden"
                                        />
                                        <button
                                            onClick={() => fileInputRef.current?.click()}
                                            className="px-6 py-3 bg-[#8ab4f8] hover:bg-[#aecbfa] text-[#202124] rounded-full font-medium transition-all flex items-center gap-2 mx-auto text-sm"
                                        >
                                            <Upload className="w-5 h-5" />
                                            <span>Upload your first source</span>
                                        </button>
                                        <p className="text-xs text-[#5f6368] mt-4">Supports PDF, TXT, Markdown, and DOCX</p>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    {/* Section Header */}
                                    <div className="flex items-center justify-between mb-6">
                                        <h2 className="text-base font-medium text-[#e8eaed]">My notebooks</h2>
                                        {/* Search */}
                                        <div className="relative">
                                            <input
                                                type="text"
                                                value={workspaceSearchQuery}
                                                onChange={(e) => setWorkspaceSearchQuery(e.target.value)}
                                                placeholder="Search notebooks..."
                                                className="w-64 px-4 py-2 pl-10 bg-[#202124] border border-[#3c4043] rounded-full text-sm text-white placeholder-[#9aa0a6] focus:outline-none focus:border-[#8ab4f8] transition-all"
                                            />
                                            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9aa0a6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                            </svg>
                                        </div>
                                    </div>

                                    {filteredWorkspaces.length === 0 && workspaceSearchQuery ? (
                                        /* No Search Results */
                                        <div className="flex flex-col items-center justify-center h-64">
                                            <span className="text-4xl mb-4">🔍</span>
                                            <p className="text-[#9aa0a6]">No notebooks found matching "{workspaceSearchQuery}"</p>
                                        </div>
                                    ) : (
                                        /* Notebooks Grid - Full Width */
                                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-4">
                                            {/* Create New Card */}
                                            <button
                                                onClick={() => fileInputRef.current?.click()}
                                                className="group h-[220px] rounded-2xl border-2 border-dashed border-[#3c4043] hover:border-[#8ab4f8] bg-[#202124]/50 hover:bg-[#202124] transition-all flex flex-col items-center justify-center gap-3"
                                            >
                                                <div className="w-14 h-14 rounded-2xl bg-[#3c4043] group-hover:bg-[#8ab4f8] transition-colors flex items-center justify-center">
                                                    <svg className="w-7 h-7 text-[#9aa0a6] group-hover:text-[#202124] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                                    </svg>
                                                </div>
                                                <span className="text-sm font-medium text-[#8ab4f8]">New notebook</span>
                                                <input
                                                    ref={fileInputRef}
                                                    type="file"
                                                    accept=".txt,.md,.pdf,.docx"
                                                    onChange={handleFileUpload}
                                                    className="hidden"
                                                />
                                            </button>

                                            {/* Notebook Cards */}
                                            {filteredWorkspaces.map((workspace, index) => {
                                                // Different gradient colors for each card
                                                const gradients = [
                                                    'from-[#f28b82] to-[#fdd663]', // Red to Yellow
                                                    'from-[#8ab4f8] to-[#c58af9]', // Blue to Purple
                                                    'from-[#81c995] to-[#34a853]', // Green
                                                    'from-[#fdd663] to-[#fbbc04]', // Yellow
                                                    'from-[#c58af9] to-[#f28b82]', // Purple to Red
                                                    'from-[#78d9ec] to-[#8ab4f8]', // Cyan to Blue
                                                ];
                                                const gradient = gradients[index % gradients.length];

                                                return (
                                                    <div
                                                        key={workspace.id}
                                                        className="group relative h-[220px] rounded-2xl bg-[#202124] border border-[#3c4043] hover:border-[#5f6368] hover:shadow-xl hover:shadow-black/20 transition-all cursor-pointer overflow-hidden"
                                                        onClick={() => openWorkspace(workspace)}
                                                    >
                                                        {/* Gradient Header - Takes up ~60% of card */}
                                                        <div className={`h-[130px] bg-gradient-to-br ${gradient} relative`}>
                                                            {/* Decorative Pattern */}
                                                            <div className="absolute inset-0 opacity-20">
                                                                <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                                                                    <circle cx="80" cy="20" r="35" fill="white" opacity="0.3" />
                                                                    <circle cx="20" cy="80" r="25" fill="white" opacity="0.2" />
                                                                </svg>
                                                            </div>
                                                            {/* Large Emoji */}
                                                            <div className="absolute bottom-3 left-4">
                                                                <span className="text-5xl drop-shadow-lg">{workspace.thumbnailEmoji}</span>
                                                            </div>
                                                        </div>

                                                        {/* Content */}
                                                        <div className="p-4">
                                                            <h3 className="font-medium text-white text-sm truncate mb-1">{workspace.name}</h3>
                                                            <p className="text-xs text-[#9aa0a6] line-clamp-1">{workspace.description}</p>

                                                            {/* Footer */}
                                                            <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between">
                                                                <span className="text-xs text-[#5f6368]">
                                                                    {new Date(workspace.updatedAt).toLocaleDateString('en-US', {
                                                                        month: 'short',
                                                                        day: 'numeric'
                                                                    })}
                                                                </span>

                                                                {/* Menu Button */}
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        if (confirm('Delete this notebook?')) {
                                                                            deleteWorkspace(workspace.id);
                                                                        }
                                                                    }}
                                                                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded-full hover:bg-[#3c4043] text-[#9aa0a6] hover:text-white transition-all"
                                                                >
                                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                                    </svg>
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                );

            case 'immersive-text':
                // Show streaming view while content is being generated - Terminal Style
                if (isStreaming) {
                    // Parse streamed text to extract progress info
                    const hasStarted = streamedText.length > 0;
                    const progressPercent = Math.min(95, Math.round(streamedText.length / 50));

                    return (
                        <div className="flex w-full h-full min-h-[calc(100vh-120px)]">
                            <WarpBackground
                                className="flex-1 flex items-center justify-center border-0 p-0 bg-slate-950"
                                perspective={150}
                                beamsPerSide={4}
                                beamSize={4}
                                beamDelayMax={2}
                                beamDuration={4}
                                gridColor="rgba(99, 102, 241, 0.15)"
                            >
                                {/* Terminal Display - Centered */}
                                <div className="relative z-10 w-full max-w-3xl mx-auto px-8">
                                    <Terminal className="w-full max-w-none shadow-2xl backdrop-blur-sm">
                                        {/* Command line with typing */}
                                        <div className="flex items-center gap-2 text-slate-400 mb-3">
                                            <span className="text-green-400">➜</span>
                                            <span className="text-cyan-400">~/learning</span>
                                            <span className="text-slate-500">$</span>
                                            <TypingAnimation className="text-slate-300" duration={25} delay={0}>
                                                gemini analyze --mode immersive
                                            </TypingAnimation>
                                        </div>

                                        {/* Step 1 */}
                                        <AnimatedSpan delay={1200} className="text-slate-300">
                                            <span className="text-green-400">✔</span> Connected to Gemini AI
                                        </AnimatedSpan>

                                        {/* Step 2 */}
                                        <AnimatedSpan delay={1800} className="text-slate-300">
                                            <span className="text-green-400">✔</span> Document parsed successfully
                                        </AnimatedSpan>

                                        {/* Step 3 */}
                                        <AnimatedSpan delay={2400} className="text-slate-300">
                                            <span className="text-green-400">✔</span> Extracting key concepts
                                        </AnimatedSpan>

                                        {/* Step 4 - Shows when content starts streaming */}
                                        <AnimatedSpan delay={3000} className="text-slate-300">
                                            {hasStarted ? (
                                                <><span className="text-green-400">✔</span> Building section structure</>
                                            ) : (
                                                <><span className="text-yellow-400 animate-pulse">●</span> Analyzing document structure...</>
                                            )}
                                        </AnimatedSpan>

                                        {hasStarted && (
                                            <>
                                                {/* Step 5 */}
                                                <AnimatedSpan delay={3600} className="text-slate-300">
                                                    <span className="text-blue-400 animate-pulse">●</span> Generating immersive content...
                                                </AnimatedSpan>

                                                {/* Step 6 */}
                                                <AnimatedSpan delay={4200} className="text-slate-300">
                                                    <span className="text-blue-400 animate-pulse">●</span> Creating interactive widgets
                                                </AnimatedSpan>

                                                {/* Step 7 */}
                                                <AnimatedSpan delay={4800} className="text-slate-300">
                                                    <span className="text-yellow-400 animate-spin inline-block">⟳</span> Preparing visual elements
                                                </AnimatedSpan>

                                                {/* Progress bar */}
                                                <AnimatedSpan delay={5400} className="mt-4 pt-3 border-t border-slate-800">
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-slate-500 text-xs">Progress:</span>
                                                        <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden max-w-[200px]">
                                                            <div
                                                                className="h-full bg-gradient-to-r from-green-500 to-cyan-400 transition-all duration-500"
                                                                style={{ width: `${progressPercent}%` }}
                                                            />
                                                        </div>
                                                        <span className="text-cyan-400 text-xs font-mono">{progressPercent}%</span>
                                                    </div>
                                                </AnimatedSpan>

                                                {/* Character count - live updating */}
                                                <AnimatedSpan delay={5600} className="text-slate-500 text-xs">
                                                    <span className="text-slate-600">ℹ</span> Streaming: {streamedText.length.toLocaleString()} characters received
                                                </AnimatedSpan>
                                            </>
                                        )}

                                        {!hasStarted && (
                                            <AnimatedSpan delay={3600} className="text-blue-400 flex items-center gap-2">
                                                <Loader2 className="w-3 h-3 animate-spin" />
                                                <span>Initializing content stream...</span>
                                            </AnimatedSpan>
                                        )}
                                    </Terminal>
                                </div>
                            </WarpBackground>
                        </div>
                    );
                }

                const activeSection = immersiveContent?.sections.find(s => s.id === activeSectionId) || immersiveContent?.sections[0];
                const activeImage = activeSection ? sectionImages[activeSection.id] : null;
                const activeWidget = activeSection?.widget;
                const widgetImgs = activeSection ? widgetImages[activeSection.id] : undefined;
                const sectionIdx = immersiveContent?.sections.findIndex(s => s.id === activeSectionId) ?? 0;

                // Split content by marker
                const contentParts = activeSection?.content.split('{{INTERACTIVE_WIDGET}}') || [];

                return (
                    <div className="flex w-full min-h-full">
                        {/* Main Content - Single scrollable area */}
                        <div className={`flex-1 py-10 px-12 relative overflow-y-auto transition-all duration-300`}>
                            {/* Section Title Header */}
                            <div className="text-[13px] text-[#5f6368] mb-1 font-medium">
                                {activeSection?.title}
                            </div>

                            {/* Main Heading with Navigation Arrows */}
                            <div className="flex items-start justify-between mb-4">
                                <h2 className="text-[32px] leading-[1.2] font-medium text-[#1f1f1f] max-w-[700px]">
                                    {activeSection?.title}
                                </h2>
                                <div className="flex gap-0.5 flex-shrink-0 ml-4">
                                    <button
                                        onClick={() => {
                                            if (sectionIdx > 0 && immersiveContent) {
                                                setActiveSectionId(immersiveContent.sections[sectionIdx - 1].id);
                                                setCurrentSectionIndex(sectionIdx - 1);
                                            }
                                        }}
                                        disabled={sectionIdx === 0}
                                        className="p-2 hover:bg-[#f1f3f4] rounded-full text-[#5f6368] disabled:opacity-40 transition-colors"
                                    >
                                        <ChevronLeft className="w-5 h-5" />
                                    </button>
                                    <button
                                        onClick={() => {
                                            if (immersiveContent && sectionIdx < immersiveContent.sections.length - 1) {
                                                setActiveSectionId(immersiveContent.sections[sectionIdx + 1].id);
                                                setCurrentSectionIndex(sectionIdx + 1);
                                            }
                                        }}
                                        disabled={!immersiveContent || sectionIdx === immersiveContent.sections.length - 1}
                                        className="p-2 hover:bg-[#f1f3f4] rounded-full text-[#5f6368] disabled:opacity-40 transition-colors"
                                    >
                                        <ChevronRight className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>

                            {/* Grounding Sources Bar - Shows all sources with bubble badges */}
                            {groundingSources.length > 0 && (
                                <div className="flex items-center gap-2 mb-6 flex-wrap">
                                    <div className="flex items-center gap-1.5 text-[12px] text-[#5f6368]">
                                        <Globe className="w-3.5 h-3.5" />
                                        <span>Sources:</span>
                                    </div>
                                    {groundingSources.map((source, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => {
                                                setActiveSource(source);
                                                setShowPdfSidebar(true);
                                            }}
                                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] transition-colors ${activeSource?.url === source.url
                                                ? 'bg-indigo-600 text-white'
                                                : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                                                }`}
                                            title={source.url}
                                        >
                                            <span className={`inline-flex items-center justify-center w-4 h-4 text-[10px] font-bold rounded-full ${activeSource?.url === source.url
                                                ? 'bg-white/30 text-white'
                                                : 'bg-blue-200 text-blue-700'
                                                }`}>
                                                {idx + 1}
                                            </span>
                                            <span className="truncate max-w-[120px]">{source.title || new URL(source.url).hostname}</span>
                                        </button>
                                    ))}
                                    {isLoadingGrounding && (
                                        <div className="flex items-center gap-1.5 text-[12px] text-blue-500">
                                            <Loader2 className="w-3 h-3 animate-spin" />
                                            <span>Finding sources...</span>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Content paragraphs with floating ? buttons */}
                            <div className="space-y-5 mb-8">
                                {contentParts[0]?.split('\n\n').map((paragraph, pIdx) => (
                                    <div key={pIdx} className="relative group">
                                        <div className="pr-14">
                                            <ReactMarkdown
                                                remarkPlugins={[remarkMath]}
                                                rehypePlugins={[rehypeKatex]}
                                                components={{
                                                    p: ({ children }) => (
                                                        <p className="text-[18px] leading-[1.8] text-[#444746]">
                                                            {children}
                                                        </p>
                                                    ),
                                                    strong: ({ children }) => {
                                                        const term = String(children);
                                                        const def = immersiveContent?.keyTerms.find(t => t.term.toLowerCase() === term.toLowerCase());
                                                        return def ? (
                                                            <span
                                                                onClick={() => handleTermClick(def.term, def.definition)}
                                                                className="cursor-pointer"
                                                            >
                                                                <Highlighter
                                                                    action="highlight"
                                                                    color="#FBBF24"
                                                                    animationDuration={1200}
                                                                    iterations={1}
                                                                >
                                                                    <span className="font-semibold text-[#1f1f1f] hover:text-[#1a73e8] transition-colors">
                                                                        {children}
                                                                    </span>
                                                                </Highlighter>
                                                            </span>
                                                        ) : (
                                                            <Highlighter
                                                                action="highlight"
                                                                color="#FBBF24"
                                                                animationDuration={1200}
                                                                iterations={1}
                                                            >
                                                                <strong className="font-semibold text-[#1f1f1f]">{children}</strong>
                                                            </Highlighter>
                                                        );
                                                    },
                                                    em: ({ children }) => (
                                                        <Highlighter
                                                            action="underline"
                                                            color="#3B82F6"
                                                            strokeWidth={2}
                                                            animationDuration={800}
                                                            iterations={1}
                                                        >
                                                            <em className="not-italic text-[#374151]">{children}</em>
                                                        </Highlighter>
                                                    ),
                                                    code: ({ className, children, ...props }) => {
                                                        const match = /language-(\w+)/.exec(className || '');
                                                        const isInline = !match;
                                                        if (isInline) {
                                                            return (
                                                                <code className="bg-gray-100 text-[#e11d48] px-1.5 py-0.5 rounded text-[15px] font-mono" {...props}>
                                                                    {children}
                                                                </code>
                                                            );
                                                        }
                                                        return (
                                                            <div className="my-4 rounded-lg overflow-hidden border border-gray-200 shadow-sm">
                                                                <div className="bg-gray-800 text-gray-300 px-4 py-2 text-xs flex items-center justify-between">
                                                                    <span className="font-medium">{match[1]}</span>
                                                                    <button
                                                                        onClick={() => navigator.clipboard.writeText(String(children))}
                                                                        className="hover:text-white transition-colors flex items-center gap-1"
                                                                    >
                                                                        <Copy className="w-3.5 h-3.5" />
                                                                        <span>Copy</span>
                                                                    </button>
                                                                </div>
                                                                <pre className="bg-gray-900 p-4 overflow-x-auto">
                                                                    <code className={`${className} text-sm font-mono text-gray-100`} {...props}>
                                                                        {children}
                                                                    </code>
                                                                </pre>
                                                            </div>
                                                        );
                                                    },
                                                    pre: ({ children }) => <>{children}</>
                                                }}
                                            >
                                                {paragraph}
                                            </ReactMarkdown>
                                        </div>

                                        {/* Floating Orange ? Button */}
                                        <button
                                            onClick={() => handleOpenFloatingQuiz(paragraph, pIdx)}
                                            className="absolute right-0 top-0 w-9 h-9 bg-[#ff9064] hover:bg-[#ff7d4d] text-white rounded-full flex items-center justify-center shadow-md opacity-0 group-hover:opacity-100 transition-all duration-150 hover:scale-105"
                                            title="Check your understanding"
                                        >
                                            <span className="font-bold text-base">?</span>
                                        </button>
                                    </div>
                                ))}

                                {activeWidget && activeWidget.data && (
                                    <div className="animate-slide-up">
                                        {activeWidget.type === 'reveal' && activeWidget.data.title && <ScratchReveal title={activeWidget.data.title} content={activeWidget.data.content || ''} />}
                                        {activeWidget.type === 'comparison' && <ComparisonSlider data={activeWidget.data} images={widgetImgs} />}
                                        {activeWidget.type === 'quiz' && <InlineQuiz data={activeWidget.data} />}
                                        {activeWidget.type === 'fill-blank' && <FillBlankActivity data={activeWidget.data} />}
                                        {activeWidget.type === 'matching' && <MatchingActivity data={activeWidget.data} />}
                                        {activeWidget.type === 'ordering' && <OrderingActivity data={activeWidget.data} />}
                                        {activeWidget.type === 'true-false' && <TrueFalseActivity data={activeWidget.data} />}
                                        {activeWidget.type === 'labeling' && <LabelingActivity data={activeWidget.data} />}
                                        {activeWidget.type === 'reflection' && <ReflectionActivity data={activeWidget.data} />}
                                        {activeWidget.type === 'code-playground' && <CodePlaygroundActivity data={activeWidget.data} />}
                                        {activeWidget.type === 'code-explanation' && <CodeExplanationActivity data={activeWidget.data} />}
                                    </div>
                                )}

                                {contentParts[1]?.split('\n\n').map((paragraph, pIdx) => (
                                    <div key={`p2-${pIdx}`} className="relative group">
                                        <div className="pr-14">
                                            <ReactMarkdown
                                                remarkPlugins={[remarkMath]}
                                                rehypePlugins={[rehypeKatex]}
                                                components={{
                                                    p: ({ children }) => (
                                                        <p className="text-[18px] leading-[1.8] text-[#444746]">
                                                            {children}
                                                        </p>
                                                    ),
                                                    strong: ({ children }) => {
                                                        const term = String(children);
                                                        const def = immersiveContent?.keyTerms.find(t => t.term.toLowerCase() === term.toLowerCase());
                                                        return def ? (
                                                            <span
                                                                onClick={() => handleTermClick(def.term, def.definition)}
                                                                className="cursor-pointer"
                                                            >
                                                                <Highlighter
                                                                    action="highlight"
                                                                    color="#FBBF24"
                                                                    animationDuration={1200}
                                                                    iterations={1}
                                                                >
                                                                    <span className="font-semibold text-[#1f1f1f] hover:text-[#1a73e8] transition-colors">
                                                                        {children}
                                                                    </span>
                                                                </Highlighter>
                                                            </span>
                                                        ) : (
                                                            <Highlighter
                                                                action="highlight"
                                                                color="#FBBF24"
                                                                animationDuration={1200}
                                                                iterations={1}
                                                            >
                                                                <strong className="font-semibold text-[#1f1f1f]">{children}</strong>
                                                            </Highlighter>
                                                        );
                                                    },
                                                    em: ({ children }) => (
                                                        <Highlighter
                                                            action="underline"
                                                            color="#3B82F6"
                                                            strokeWidth={2}
                                                            animationDuration={800}
                                                            iterations={1}
                                                        >
                                                            <em className="not-italic text-[#374151]">{children}</em>
                                                        </Highlighter>
                                                    ),
                                                    code: ({ className, children, ...props }) => {
                                                        const match = /language-(\w+)/.exec(className || '');
                                                        const isInline = !match;
                                                        if (isInline) {
                                                            return (
                                                                <code className="bg-gray-100 text-[#e11d48] px-1.5 py-0.5 rounded text-[15px] font-mono" {...props}>
                                                                    {children}
                                                                </code>
                                                            );
                                                        }
                                                        return (
                                                            <div className="my-4 rounded-lg overflow-hidden border border-gray-200 shadow-sm">
                                                                <div className="bg-gray-800 text-gray-300 px-4 py-2 text-xs flex items-center justify-between">
                                                                    <span className="font-medium">{match[1]}</span>
                                                                    <button
                                                                        onClick={() => navigator.clipboard.writeText(String(children))}
                                                                        className="hover:text-white transition-colors flex items-center gap-1"
                                                                    >
                                                                        <Copy className="w-3.5 h-3.5" />
                                                                        <span>Copy</span>
                                                                    </button>
                                                                </div>
                                                                <pre className="bg-gray-900 p-4 overflow-x-auto">
                                                                    <code className={`${className} text-sm font-mono text-gray-100`} {...props}>
                                                                        {children}
                                                                    </code>
                                                                </pre>
                                                            </div>
                                                        );
                                                    },
                                                    pre: ({ children }) => <>{children}</>
                                                }}
                                            >
                                                {paragraph}
                                            </ReactMarkdown>
                                        </div>

                                        {/* Floating Orange ? Button */}
                                        <button
                                            onClick={() => handleOpenFloatingQuiz(paragraph, pIdx + 100)}
                                            className="absolute right-0 top-0 w-9 h-9 bg-[#ff9064] hover:bg-[#ff7d4d] text-white rounded-full flex items-center justify-center shadow-md opacity-0 group-hover:opacity-100 transition-all duration-150 hover:scale-105"
                                            title="Check your understanding"
                                        >
                                            <span className="font-bold text-base">?</span>
                                        </button>
                                    </div>
                                ))}

                                {/* Image from original document if exists */}
                                {activeSection?.imagePrompt && activeImage && (
                                    <div className="my-6">
                                        <div className="relative group w-full max-w-[700px] aspect-video rounded-xl overflow-hidden bg-gray-100">
                                            <img
                                                src={activeImage}
                                                alt={activeSection?.title}
                                                className="w-full h-full object-cover"
                                            />
                                            {/* Expand button */}
                                            <button
                                                onClick={() => setExpandedImage({ src: activeImage, title: activeSection?.title || '' })}
                                                className="absolute top-3 right-3 p-2 bg-black/50 hover:bg-black/70 rounded-lg text-white opacity-0 group-hover:opacity-100 transition-all duration-200"
                                                title="Expand image"
                                            >
                                                <Maximize2 className="w-5 h-5" />
                                            </button>
                                        </div>
                                        <p className="text-[13px] text-[#5f6368] mt-2 italic">
                                            Figure: AI-generated illustration for {activeSection?.title}
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Core ideas illustrated by AI - Card */}
                            <div className="bg-[#fff8f0] rounded-2xl p-6 mb-8 border border-[#ffe0c0]">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-8 h-8 bg-[#ff9064] rounded-lg flex items-center justify-center">
                                        <Sparkles className="w-5 h-5 text-white" />
                                    </div>
                                    <h3 className="text-[16px] font-medium text-[#1f1f1f]">Core ideas illustrated by AI</h3>
                                </div>
                                <div className="flex gap-6">
                                    <div className="flex-1">
                                        <p className="text-[15px] leading-[1.7] text-[#444746]">
                                            {immersiveContent?.summary || activeSection?.content.slice(0, 300) + '...'}
                                        </p>
                                    </div>
                                    {activeSection?.imagePrompt && (
                                        <div className="w-[280px] flex-shrink-0">
                                            {activeImage ? (
                                                <img
                                                    src={activeImage}
                                                    alt={activeSection?.title}
                                                    className="w-full h-auto rounded-xl"
                                                />
                                            ) : (
                                                <div className="w-full aspect-square bg-gradient-to-br from-[#fff0e0] to-[#ffe0c0] rounded-xl flex items-center justify-center">
                                                    <div className="text-center">
                                                        <Loader2 className="w-8 h-8 text-[#ff9064] animate-spin mx-auto mb-2" />
                                                        <p className="text-[12px] text-[#5f6368]">Generating...</p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Interactive Learning Activities Section */}
                            <div className="bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 rounded-2xl p-6 mb-8 border border-purple-100">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
                                        <Brain className="w-6 h-6 text-white" />
                                    </div>
                                    <div>
                                        <h3 className="text-[16px] font-bold text-[#1f1f1f]">🧠 Brain Activities</h3>
                                        <p className="text-[13px] text-gray-500">Challenge yourself with interactive learning!</p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    {/* Brainstorm Activity Button */}
                                    <button
                                        onClick={handleGenerateBrainstorm}
                                        disabled={isLoadingBrainstorm}
                                        className="group relative overflow-hidden bg-white hover:bg-gradient-to-br hover:from-orange-400 hover:to-pink-500 rounded-xl p-4 border border-orange-200 hover:border-transparent transition-all duration-300 text-left"
                                    >
                                        <div className="flex items-center gap-3 mb-2">
                                            <div className="w-10 h-10 bg-orange-100 group-hover:bg-white/20 rounded-lg flex items-center justify-center transition-colors">
                                                {isLoadingBrainstorm ? (
                                                    <Loader2 className="w-5 h-5 text-orange-500 group-hover:text-white animate-spin" />
                                                ) : (
                                                    <Lightbulb className="w-5 h-5 text-orange-500 group-hover:text-white" />
                                                )}
                                            </div>
                                            <div>
                                                <h4 className="font-semibold text-gray-800 group-hover:text-white transition-colors">Brainstorm Challenge</h4>
                                                <p className="text-xs text-gray-500 group-hover:text-white/80 transition-colors">Think creatively!</p>
                                            </div>
                                        </div>
                                        <p className="text-sm text-gray-600 group-hover:text-white/90 transition-colors">
                                            Get a real-world scenario and brainstorm solutions using what you've learned.
                                        </p>
                                    </button>

                                    {/* What-If Activity Button */}
                                    <button
                                        onClick={handleGenerateWhatIf}
                                        disabled={isLoadingWhatIf}
                                        className="group relative overflow-hidden bg-white hover:bg-gradient-to-br hover:from-cyan-400 hover:to-blue-500 rounded-xl p-4 border border-cyan-200 hover:border-transparent transition-all duration-300 text-left"
                                    >
                                        <div className="flex items-center gap-3 mb-2">
                                            <div className="w-10 h-10 bg-cyan-100 group-hover:bg-white/20 rounded-lg flex items-center justify-center transition-colors">
                                                {isLoadingWhatIf ? (
                                                    <Loader2 className="w-5 h-5 text-cyan-500 group-hover:text-white animate-spin" />
                                                ) : (
                                                    <span className="text-xl">🤔</span>
                                                )}
                                            </div>
                                            <div>
                                                <h4 className="font-semibold text-gray-800 group-hover:text-white transition-colors">What If...?</h4>
                                                <p className="text-xs text-gray-500 group-hover:text-white/80 transition-colors">Explore possibilities!</p>
                                            </div>
                                        </div>
                                        <p className="text-sm text-gray-600 group-hover:text-white/90 transition-colors">
                                            Explore thought-provoking "what if" scenarios to deepen understanding.
                                        </p>
                                    </button>
                                </div>

                                {/* Tips for learning */}
                                <div className="mt-4 flex items-center gap-2 p-3 bg-white/50 rounded-lg border border-purple-100">
                                    <Sparkles className="w-4 h-4 text-purple-500 flex-shrink-0" />
                                    <p className="text-xs text-purple-700">
                                        <span className="font-semibold">Pro tip:</span> Click on any <span className="font-bold underline decoration-dotted">bold term</span> in the text above for an interactive deep-dive with quizzes, brain teasers, and fun facts!
                                    </p>
                                </div>
                            </div>

                            {/* Quiz Section at Bottom - Google Style */}
                            {quiz.length > 0 && (
                                <div className="bg-white rounded-2xl border border-[#e8eaed] overflow-hidden mb-8">
                                    {/* Quiz Header */}
                                    <div className="flex items-center justify-between px-6 py-4 border-b border-[#e8eaed]">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 bg-[#ff9064] rounded-lg flex items-center justify-center">
                                                <HelpCircle className="w-5 h-5 text-white" />
                                            </div>
                                            <span className="text-[16px] font-medium text-[#1f1f1f]">Take a quiz to check your understanding</span>
                                        </div>
                                        <span className="text-[14px] text-[#5f6368]">
                                            {currentQuestionIndex + 1} / {quiz.length}
                                        </span>
                                    </div>

                                    {/* Progress Bar */}
                                    <div className="h-1 bg-[#f1f3f4]">
                                        <div
                                            className="h-full bg-[#ff9064] transition-all duration-300"
                                            style={{ width: `${((currentQuestionIndex + 1) / quiz.length) * 100}%` }}
                                        />
                                    </div>

                                    {/* Question */}
                                    <div className="p-6">
                                        <p className="text-[16px] text-[#1f1f1f] mb-5">
                                            <span className="font-medium">Question {currentQuestionIndex + 1}:</span> {quiz[currentQuestionIndex]?.question}
                                        </p>

                                        {/* Options */}
                                        <div className="space-y-2">
                                            {quiz[currentQuestionIndex]?.options.map((option, idx) => {
                                                const isSelected = quizAnswers[currentQuestionIndex] === idx;
                                                const showFeedback = showQuizFeedback[currentQuestionIndex];
                                                const isCorrect = idx === quiz[currentQuestionIndex]?.correctAnswerIndex;

                                                let bgColor = 'bg-white hover:bg-[#f8f9fa]';
                                                let borderColor = 'border-[#dadce0]';
                                                let textColor = 'text-[#1f1f1f]';

                                                if (showFeedback && isCorrect) {
                                                    bgColor = 'bg-[#ceead6]';
                                                    borderColor = 'border-[#34a853]';
                                                    textColor = 'text-[#137333]';
                                                } else if (showFeedback && isSelected && !isCorrect) {
                                                    bgColor = 'bg-[#fad2cf]';
                                                    borderColor = 'border-[#ea4335]';
                                                    textColor = 'text-[#c5221f]';
                                                } else if (isSelected) {
                                                    borderColor = 'border-[#1a73e8]';
                                                    bgColor = 'bg-[#e8f0fe]';
                                                }

                                                return (
                                                    <button
                                                        key={idx}
                                                        onClick={() => {
                                                            if (!showQuizFeedback[currentQuestionIndex]) {
                                                                setQuizAnswers(prev => ({ ...prev, [currentQuestionIndex]: idx }));
                                                                setShowQuizFeedback(prev => ({ ...prev, [currentQuestionIndex]: true }));
                                                            }
                                                        }}
                                                        disabled={showQuizFeedback[currentQuestionIndex]}
                                                        className={`w-full text-left px-4 py-3 rounded-xl border-2 ${borderColor} ${bgColor} ${textColor} transition-all duration-150 font-medium text-[15px]`}
                                                    >
                                                        <span className="font-semibold mr-2">{String.fromCharCode(65 + idx)}.</span>
                                                        {option}
                                                    </button>
                                                );
                                            })}
                                        </div>

                                        {/* Feedback */}
                                        {showQuizFeedback[currentQuestionIndex] && (
                                            <div className="mt-4 p-4 bg-[#f8f9fa] rounded-xl">
                                                <p className={`text-[14px] font-medium ${quizAnswers[currentQuestionIndex] === quiz[currentQuestionIndex]?.correctAnswerIndex ? 'text-[#137333]' : 'text-[#c5221f]'}`}>
                                                    {quizAnswers[currentQuestionIndex] === quiz[currentQuestionIndex]?.correctAnswerIndex
                                                        ? '✓ Correct!'
                                                        : '✗ Not quite.'}
                                                </p>
                                                <p className="text-[13px] text-[#5f6368] mt-1">
                                                    {quiz[currentQuestionIndex]?.explanation}
                                                </p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Quiz Footer */}
                                    <div className="flex items-center justify-center gap-4 px-6 py-4 border-t border-[#e8eaed] bg-[#fafafa]">
                                        <button
                                            onClick={() => {
                                                // Finish quiz - could show summary
                                                setCurrentQuestionIndex(0);
                                                setQuizAnswers({});
                                                setShowQuizFeedback({});
                                            }}
                                            className="px-4 py-2 text-[14px] text-[#5f6368] hover:bg-[#f1f3f4] rounded-lg transition-colors"
                                        >
                                            Finish quiz
                                        </button>
                                        <button
                                            onClick={() => {
                                                setQuizAnswers({});
                                                setShowQuizFeedback({});
                                                setCurrentQuestionIndex(0);
                                            }}
                                            className="px-4 py-2 text-[14px] text-[#5f6368] hover:bg-[#f1f3f4] rounded-lg transition-colors"
                                        >
                                            Restart quiz
                                        </button>
                                        {showQuizFeedback[currentQuestionIndex] && currentQuestionIndex < quiz.length - 1 && (
                                            <button
                                                onClick={() => setCurrentQuestionIndex(prev => prev + 1)}
                                                className="px-4 py-2 text-[14px] text-white bg-[#1a73e8] hover:bg-[#1557b0] rounded-lg transition-colors"
                                            >
                                                Next question
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Enhanced Term Definition Popover */}
                            {activeDefinition && (
                                <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-white border border-[#e8eaed] rounded-2xl shadow-2xl w-[500px] max-h-[80vh] overflow-hidden animate-fade-in">
                                    {/* Header with gradient */}
                                    <div className="bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 p-4">
                                        <div className="flex justify-between items-start">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
                                                    <BookOpen className="w-5 h-5 text-white" />
                                                </div>
                                                <div>
                                                    <h4 className="font-bold text-white text-lg">{activeDefinition.term}</h4>
                                                    <p className="text-white/80 text-sm">Click tabs to explore more!</p>
                                                </div>
                                            </div>
                                            <button onClick={handleCloseTermPopup} className="text-white/70 hover:text-white p-1 hover:bg-white/20 rounded-lg transition-all">
                                                <X className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Tab Navigation */}
                                    <div className="flex border-b border-gray-200 bg-gray-50 overflow-x-auto">
                                        {[
                                            { id: 'definition', icon: <Info className="w-4 h-4" />, label: 'Definition' },
                                            { id: 'deepDive', icon: <Zap className="w-4 h-4" />, label: 'Deep Dive' },
                                            { id: 'brainTeaser', icon: <Brain className="w-4 h-4" />, label: 'Brain Teaser' },
                                            { id: 'quiz', icon: <Target className="w-4 h-4" />, label: 'Quick Quiz' },
                                            { id: 'funFact', icon: <Sparkles className="w-4 h-4" />, label: 'Fun Fact' },
                                        ].map((tab) => (
                                            <button
                                                key={tab.id}
                                                onClick={() => setEnhancedTermTab(tab.id as any)}
                                                className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium whitespace-nowrap transition-all border-b-2 ${enhancedTermTab === tab.id
                                                    ? 'border-blue-500 text-blue-600 bg-white'
                                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                                                    }`}
                                            >
                                                {tab.icon}
                                                {tab.label}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Tab Content */}
                                    <div className="p-4 overflow-y-auto max-h-[400px]">
                                        {isLoadingEnhancedTerm && enhancedTermTab !== 'definition' ? (
                                            <div className="flex flex-col items-center justify-center py-8">
                                                <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-3" />
                                                <p className="text-gray-500 text-sm">Loading enhanced content...</p>
                                            </div>
                                        ) : (
                                            <>
                                                {/* Definition Tab */}
                                                {enhancedTermTab === 'definition' && (
                                                    <div className="space-y-4">
                                                        <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                                                            <p className="text-gray-700 leading-relaxed">{enhancedTermInfo?.definition || activeDefinition.definition}</p>
                                                        </div>
                                                        {enhancedTermInfo?.analogy && (
                                                            <div className="bg-amber-50 rounded-xl p-4 border border-amber-100">
                                                                <div className="flex items-center gap-2 mb-2">
                                                                    <Lightbulb className="w-5 h-5 text-amber-500" />
                                                                    <span className="font-semibold text-amber-700">Think of it like...</span>
                                                                </div>
                                                                <p className="text-gray-700">{enhancedTermInfo.analogy}</p>
                                                            </div>
                                                        )}
                                                        {enhancedTermInfo?.memoryTrick && (
                                                            <div className="bg-purple-50 rounded-xl p-4 border border-purple-100">
                                                                <div className="flex items-center gap-2 mb-2">
                                                                    <Brain className="w-5 h-5 text-purple-500" />
                                                                    <span className="font-semibold text-purple-700">Memory Trick</span>
                                                                </div>
                                                                <p className="text-gray-700">{enhancedTermInfo.memoryTrick}</p>
                                                            </div>
                                                        )}
                                                        {enhancedTermInfo?.relatedTerms && enhancedTermInfo.relatedTerms.length > 0 && (
                                                            <div className="flex flex-wrap gap-2">
                                                                <span className="text-sm text-gray-500">Related:</span>
                                                                {enhancedTermInfo.relatedTerms.map((t, i) => (
                                                                    <span key={i} className="px-2 py-1 bg-gray-100 rounded-full text-xs text-gray-600">{t}</span>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                {/* Deep Dive Tab */}
                                                {enhancedTermTab === 'deepDive' && enhancedTermInfo && (
                                                    <div className="space-y-4">
                                                        <div className="prose prose-sm max-w-none">
                                                            <p className="text-gray-700 leading-relaxed whitespace-pre-line">{enhancedTermInfo.deepDive}</p>
                                                        </div>
                                                        {enhancedTermInfo.realWorldExample && (
                                                            <div className="bg-green-50 rounded-xl p-4 border border-green-100">
                                                                <div className="flex items-center gap-2 mb-2">
                                                                    <Globe className="w-5 h-5 text-green-500" />
                                                                    <span className="font-semibold text-green-700">Real World Example</span>
                                                                </div>
                                                                <p className="text-gray-700">{enhancedTermInfo.realWorldExample}</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                {/* Brain Teaser Tab */}
                                                {enhancedTermTab === 'brainTeaser' && enhancedTermInfo && (
                                                    <div className="space-y-4">
                                                        <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl p-5 border border-indigo-100">
                                                            <div className="flex items-center gap-2 mb-3">
                                                                <div className="w-8 h-8 bg-indigo-500 rounded-full flex items-center justify-center">
                                                                    <Brain className="w-4 h-4 text-white" />
                                                                </div>
                                                                <span className="font-bold text-indigo-700">Brain Teaser Challenge</span>
                                                            </div>
                                                            <p className="text-gray-800 text-lg font-medium mb-4">{enhancedTermInfo.brainTeaser.question}</p>

                                                            {!brainTeaserRevealed ? (
                                                                <div className="space-y-3">
                                                                    <button
                                                                        onClick={() => setBrainTeaserRevealed(true)}
                                                                        className="w-full px-4 py-3 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl font-medium transition-all flex items-center justify-center gap-2"
                                                                    >
                                                                        <Eye className="w-4 h-4" />
                                                                        Reveal Answer
                                                                    </button>
                                                                    <div className="bg-white/60 rounded-lg p-3 border border-indigo-200">
                                                                        <p className="text-sm text-indigo-600">
                                                                            <span className="font-medium">💡 Hint:</span> {enhancedTermInfo.brainTeaser.hint}
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <div className="bg-white rounded-xl p-4 border-2 border-green-300 animate-fade-in">
                                                                    <div className="flex items-center gap-2 mb-2">
                                                                        <CheckCircle2 className="w-5 h-5 text-green-500" />
                                                                        <span className="font-semibold text-green-700">Answer</span>
                                                                    </div>
                                                                    <p className="text-gray-700">{enhancedTermInfo.brainTeaser.answer}</p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Quick Quiz Tab */}
                                                {enhancedTermTab === 'quiz' && enhancedTermInfo && (
                                                    <div className="space-y-4">
                                                        <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                                                            <p className="font-medium text-gray-800 mb-4">{enhancedTermInfo.quickQuiz.question}</p>
                                                            <div className="space-y-2">
                                                                {enhancedTermInfo.quickQuiz.options.map((option, idx) => (
                                                                    <button
                                                                        key={idx}
                                                                        onClick={() => setEnhancedQuizAnswer(idx)}
                                                                        disabled={enhancedQuizAnswer !== null}
                                                                        className={`w-full text-left p-3 rounded-lg border-2 transition-all font-medium ${enhancedQuizAnswer !== null
                                                                            ? idx === enhancedTermInfo.quickQuiz.correctIndex
                                                                                ? 'bg-green-100 border-green-400 text-green-700'
                                                                                : enhancedQuizAnswer === idx
                                                                                    ? 'bg-red-100 border-red-400 text-red-700'
                                                                                    : 'bg-gray-50 border-gray-200 text-gray-500'
                                                                            : 'bg-white border-gray-200 hover:border-blue-400 hover:bg-blue-50'
                                                                            }`}
                                                                    >
                                                                        <span className="font-bold mr-2">{String.fromCharCode(65 + idx)}.</span>
                                                                        {option}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                            {enhancedQuizAnswer !== null && (
                                                                <div className={`mt-4 p-3 rounded-lg ${enhancedQuizAnswer === enhancedTermInfo.quickQuiz.correctIndex ? 'bg-green-100' : 'bg-amber-100'}`}>
                                                                    <p className={`font-medium ${enhancedQuizAnswer === enhancedTermInfo.quickQuiz.correctIndex ? 'text-green-700' : 'text-amber-700'}`}>
                                                                        {enhancedQuizAnswer === enhancedTermInfo.quickQuiz.correctIndex ? '🎉 Correct!' : '💡 Not quite...'}
                                                                    </p>
                                                                    <p className="text-gray-600 text-sm mt-1">{enhancedTermInfo.quickQuiz.explanation}</p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Fun Fact Tab */}
                                                {enhancedTermTab === 'funFact' && enhancedTermInfo && (
                                                    <div className="space-y-4">
                                                        <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-5 border border-amber-200">
                                                            <div className="flex items-center gap-2 mb-3">
                                                                <div className="w-10 h-10 bg-amber-400 rounded-full flex items-center justify-center text-xl">
                                                                    🌟
                                                                </div>
                                                                <span className="font-bold text-amber-700">Did You Know?</span>
                                                            </div>
                                                            <p className="text-gray-800 text-lg leading-relaxed">{enhancedTermInfo.funFact}</p>
                                                        </div>
                                                        <div className="text-center">
                                                            <p className="text-gray-400 text-sm">Share this fun fact with your friends! 📚</p>
                                                        </div>
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Brainstorm Activity Panel */}
                            {brainstormActivity && (
                                <div className="fixed bottom-4 right-4 z-50 w-[420px] bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden animate-slide-up">
                                    <div className="bg-gradient-to-r from-orange-400 to-pink-500 p-4">
                                        <div className="flex justify-between items-center">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                                                    <Lightbulb className="w-6 h-6 text-white" />
                                                </div>
                                                <div>
                                                    <h4 className="font-bold text-white">{brainstormActivity.title}</h4>
                                                    <p className="text-white/80 text-sm">Brainstorming Challenge</p>
                                                </div>
                                            </div>
                                            <button onClick={() => setBrainstormActivity(null)} className="text-white/70 hover:text-white">
                                                <X className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="p-4 max-h-[400px] overflow-y-auto space-y-4">
                                        <div className="bg-orange-50 rounded-xl p-4 border border-orange-100">
                                            <p className="text-gray-700 font-medium">📌 Scenario:</p>
                                            <p className="text-gray-600 mt-1">{brainstormActivity.scenario}</p>
                                        </div>
                                        <div className="bg-pink-50 rounded-xl p-4 border border-pink-100">
                                            <p className="text-gray-700 font-medium">🎯 Your Challenge:</p>
                                            <p className="text-gray-800 mt-1 font-semibold">{brainstormActivity.challenge}</p>
                                        </div>

                                        {/* Hints */}
                                        <div className="space-y-2">
                                            <p className="font-medium text-gray-700">💡 Need hints?</p>
                                            {brainstormActivity.hints.map((hint, idx) => (
                                                <button
                                                    key={idx}
                                                    onClick={() => {
                                                        const newHints = [...showBrainstormHints];
                                                        newHints[idx] = true;
                                                        setShowBrainstormHints(newHints);
                                                    }}
                                                    className={`w-full text-left p-3 rounded-lg border transition-all ${showBrainstormHints[idx]
                                                        ? 'bg-amber-50 border-amber-200'
                                                        : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                                                        }`}
                                                >
                                                    {showBrainstormHints[idx] ? (
                                                        <span className="text-amber-700">{hint}</span>
                                                    ) : (
                                                        <span className="text-gray-500 flex items-center gap-2">
                                                            <EyeOff className="w-4 h-4" />
                                                            Click to reveal Hint {idx + 1}
                                                        </span>
                                                    )}
                                                </button>
                                            ))}
                                        </div>

                                        {/* Notes Area */}
                                        <div>
                                            <p className="font-medium text-gray-700 mb-2">📝 Your Ideas:</p>
                                            <textarea
                                                value={userBrainstormNotes}
                                                onChange={(e) => setUserBrainstormNotes(e.target.value)}
                                                placeholder="Write your brainstorm ideas here..."
                                                className="w-full p-3 rounded-xl border border-gray-200 focus:border-orange-400 focus:ring-2 focus:ring-orange-100 min-h-[100px] resize-y"
                                            />
                                        </div>

                                        {/* Reveal Solutions */}
                                        <div className="space-y-2">
                                            <button
                                                onClick={() => setShowBrainstormApproaches(!showBrainstormApproaches)}
                                                className="w-full px-4 py-2 bg-gradient-to-r from-orange-400 to-pink-500 text-white rounded-lg font-medium hover:opacity-90 transition-all"
                                            >
                                                {showBrainstormApproaches ? 'Hide' : 'Show'} Possible Approaches
                                            </button>
                                            {showBrainstormApproaches && (
                                                <div className="bg-gradient-to-br from-orange-50 to-pink-50 rounded-xl p-4 border border-orange-200 space-y-2 animate-fade-in">
                                                    {brainstormActivity.possibleApproaches.map((approach, idx) => (
                                                        <div key={idx} className="flex items-start gap-2">
                                                            <span className="w-6 h-6 bg-orange-400 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">{idx + 1}</span>
                                                            <p className="text-gray-700">{approach}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                            <button
                                                onClick={() => setShowBrainstormInsight(!showBrainstormInsight)}
                                                className="w-full px-4 py-2 bg-purple-500 text-white rounded-lg font-medium hover:bg-purple-600 transition-all"
                                            >
                                                {showBrainstormInsight ? 'Hide' : 'Show'} Expert Insight
                                            </button>
                                            {showBrainstormInsight && (
                                                <div className="bg-purple-50 rounded-xl p-4 border border-purple-200 animate-fade-in">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <Award className="w-5 h-5 text-purple-500" />
                                                        <span className="font-semibold text-purple-700">Expert Insight</span>
                                                    </div>
                                                    <p className="text-gray-700">{brainstormActivity.expertInsight}</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* What-If Activity Panel */}
                            {whatIfActivity && (
                                <div className="fixed bottom-4 left-4 z-50 w-[400px] bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden animate-slide-up">
                                    <div className="bg-gradient-to-r from-cyan-400 to-blue-500 p-4">
                                        <div className="flex justify-between items-center">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-xl">
                                                    🤔
                                                </div>
                                                <div>
                                                    <h4 className="font-bold text-white">{whatIfActivity.title}</h4>
                                                    <p className="text-white/80 text-sm">Explore the Possibilities</p>
                                                </div>
                                            </div>
                                            <button onClick={() => setWhatIfActivity(null)} className="text-white/70 hover:text-white">
                                                <X className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="p-4 max-h-[400px] overflow-y-auto space-y-4">
                                        <div className="bg-cyan-50 rounded-xl p-4 border border-cyan-100">
                                            <p className="text-gray-700">{whatIfActivity.baseScenario}</p>
                                        </div>

                                        {whatIfActivity.whatIfQuestions.map((q, idx) => (
                                            <div key={idx} className="border border-gray-200 rounded-xl overflow-hidden">
                                                <button
                                                    onClick={() => setRevealedWhatIfs(prev => ({ ...prev, [idx]: !prev[idx] }))}
                                                    className="w-full p-4 text-left bg-gradient-to-r from-cyan-50 to-blue-50 hover:from-cyan-100 hover:to-blue-100 transition-all"
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <span className="font-medium text-blue-700">{q.question}</span>
                                                        <ChevronDown className={`w-5 h-5 text-blue-500 transition-transform ${revealedWhatIfs[idx] ? 'rotate-180' : ''}`} />
                                                    </div>
                                                </button>
                                                {revealedWhatIfs[idx] && (
                                                    <div className="p-4 bg-white border-t border-gray-100 space-y-3 animate-fade-in">
                                                        <div>
                                                            <p className="text-sm font-medium text-gray-500 mb-2">Think about:</p>
                                                            <ul className="space-y-1">
                                                                {q.thinkingPoints.map((point, pIdx) => (
                                                                    <li key={pIdx} className="flex items-start gap-2 text-gray-600">
                                                                        <span className="text-blue-400">•</span>
                                                                        {point}
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        </div>
                                                        <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                                                            <p className="text-sm font-medium text-blue-700 mb-1">💡 Key Insight:</p>
                                                            <p className="text-gray-700 text-sm">{q.insight}</p>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                );


            case 'audio-lesson':
                return (
                    <div className="flex h-full bg-[#fbf7f2]" style={{ fontFamily: '"Google Sans", sans-serif' }}>
                        <div className="flex-1 flex flex-col items-center p-8 overflow-y-auto">
                            <div className="w-full max-w-3xl space-y-6">
                                {/* Header Card */}
                                <div className="bg-white rounded-[24px] p-8 shadow-sm text-center">
                                    <div className="w-16 h-16 mx-auto mb-4 bg-[#e6f4ea] rounded-full flex items-center justify-center">
                                        <Volume2 className="w-8 h-8 text-[#1e8e3e]" />
                                    </div>
                                    <h2 className="text-[24px] font-medium text-[#1f1f1f] mb-2">Audio Lesson Podcast</h2>
                                    <p className="text-[#5f6368] mb-6">
                                        Generate an AI-hosted podcast about this topic. Listen to a conversation between an expert and a host.
                                    </p>

                                    {!podcastScript && !isGeneratingAudio && !isGeneratingScript && (
                                        <button
                                            onClick={handleGeneratePodcast}
                                            disabled={isGeneratingScript}
                                            className="px-6 py-3 bg-[#1e8e3e] hover:bg-[#188038] text-white rounded-full font-medium transition-colors flex items-center gap-2 mx-auto disabled:opacity-50"
                                        >
                                            <Sparkles className="w-5 h-5" />
                                            Generate Podcast
                                        </button>
                                    )}

                                    {/* Script Generation Loading State */}
                                    {isGeneratingScript && (
                                        <div className="flex items-center justify-center gap-2 text-[#1e8e3e]">
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                            <span>Generating podcast script...</span>
                                        </div>
                                    )}
                                </div>

                                {/* Audio Player */}
                                {podcastAudio && (
                                    <div className="bg-white rounded-[24px] p-6 shadow-sm border border-[#e8eaed] sticky top-0 z-10">
                                        <div className="flex items-center gap-4">
                                            <button
                                                onClick={toggleAudioPlayback}
                                                className="w-12 h-12 bg-[#1e8e3e] hover:bg-[#188038] rounded-full flex items-center justify-center text-white transition-colors flex-shrink-0"
                                            >
                                                {isPlayingAudio ? (
                                                    <div className="w-4 h-4 bg-white rounded-[2px]" />
                                                ) : (
                                                    <Play className="w-6 h-6 ml-1" />
                                                )}
                                            </button>
                                            <div className="flex-1">
                                                {/* Waveform Canvas */}
                                                <div className="h-12 mb-2 bg-[#f8f9fa] rounded-lg overflow-hidden relative">
                                                    <canvas
                                                        ref={canvasRef}
                                                        width={600}
                                                        height={48}
                                                        className="w-full h-full"
                                                    />
                                                </div>

                                                <div className="h-1.5 bg-[#e8eaed] rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-[#1e8e3e] transition-all duration-100"
                                                        style={{ width: `${(audioProgress / audioDuration) * 100}%` }}
                                                    />
                                                </div>
                                                <div className="flex justify-between mt-1.5 text-[12px] text-[#5f6368] font-medium">
                                                    <span>{formatTime(audioProgress)}</span>
                                                    <span>{formatTime(audioDuration)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Loading State for Audio */}
                                {isGeneratingAudio && (
                                    <div className="bg-white rounded-[24px] p-8 shadow-sm text-center">
                                        <Loader2 className="w-8 h-8 animate-spin text-[#1e8e3e] mx-auto mb-3" />
                                        <p className="text-[#1f1f1f] font-medium">Generating audio...</p>
                                        <p className="text-[13px] text-[#5f6368]">This may take a minute</p>
                                    </div>
                                )}

                                {/* Error State for Audio */}
                                {audioGenerationError && (
                                    <div className="bg-red-50 rounded-[24px] p-8 shadow-sm text-center border border-red-100">
                                        <div className="w-12 h-12 mx-auto mb-3 bg-red-100 rounded-full flex items-center justify-center">
                                            <Volume2 className="w-6 h-6 text-red-600" />
                                        </div>
                                        <p className="text-red-800 font-medium mb-1">Failed to generate audio</p>
                                        <p className="text-[13px] text-red-600 mb-4">Something went wrong while creating the podcast audio.</p>
                                        <button
                                            onClick={handleGeneratePodcast}
                                            disabled={isGeneratingScript || isGeneratingAudio}
                                            className="px-5 py-2 bg-white border border-red-200 hover:bg-red-50 text-red-700 rounded-full font-medium transition-colors text-sm disabled:opacity-50"
                                        >
                                            Try Again
                                        </button>
                                    </div>
                                )}

                                {/* Script Display */}
                                {podcastScript && (
                                    <div className="bg-white rounded-[24px] p-8 shadow-sm space-y-6">
                                        <h3 className="text-[18px] font-medium text-[#1f1f1f] border-b border-[#e8eaed] pb-4">Transcript</h3>
                                        <div className="space-y-4">
                                            {podcastScript.split('\n').map((line, idx) => {
                                                const isHost = line.startsWith('Host:');
                                                const isExpert = line.startsWith('Expert:');

                                                if (!isHost && !isExpert) return null;

                                                const text = line.replace(/^(Host|Expert):/, '').trim();

                                                return (
                                                    <div key={idx} className={`flex gap-4 ${isHost ? 'flex-row' : 'flex-row-reverse'}`}>
                                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${isHost ? 'bg-[#e6f4ea] text-[#1e8e3e]' : 'bg-[#e8f0fe] text-[#1967d2]'}`}>
                                                            {isHost ? 'H' : 'E'}
                                                        </div>
                                                        <div className={`flex-1 p-4 rounded-2xl ${isHost ? 'bg-[#f8f9fa] rounded-tl-none' : 'bg-[#f8f9fa] rounded-tr-none'}`}>
                                                            <p className="text-[12px] font-medium text-[#5f6368] mb-1">{isHost ? 'Host' : 'Expert'}</p>
                                                            <p className="text-[15px] text-[#1f1f1f] leading-relaxed">{text}</p>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                );







            case 'slides-narration':
                const selectedVideo = relevantVideos[selectedVideoIndex];

                // Suggested questions based on video content
                const suggestedQuestions = selectedVideo ? [
                    `What are the main concepts discussed in "${selectedVideo.title.slice(0, 40)}..."?`,
                    `How does this video explain the topic differently?`,
                    `What are the key takeaways from this video?`,
                    `Can you summarize the most important points?`
                ] : [];

                return (
                    <div className="flex h-full bg-[#f5f5f5]" style={{ fontFamily: '"Google Sans", sans-serif' }}>
                        {/* Left Sidebar - Video Playlist */}
                        {(relevantVideos.length > 0 || isLoadingVideos) && (
                            <div className="w-[200px] bg-white border-r border-[#e0e0e0] overflow-y-auto flex-shrink-0">
                                <div className="p-3">
                                    <h3 className="text-[13px] font-medium text-[#1f1f1f] mb-2 px-1">Playlist</h3>
                                    <div className="space-y-1">
                                        {isLoadingVideos ? (
                                            [...Array(5)].map((_, i) => (
                                                <div key={i} className="flex gap-2 p-2 rounded-lg">
                                                    <div className="w-[72px] h-[40px] bg-gray-200 rounded animate-pulse flex-shrink-0" />
                                                    <div className="flex-1 space-y-1.5 py-1">
                                                        <div className="h-3 bg-gray-200 rounded w-full animate-pulse" />
                                                        <div className="h-2 bg-gray-200 rounded w-2/3 animate-pulse" />
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            relevantVideos.map((video, idx) => (
                                                <button
                                                    key={video.id}
                                                    onClick={() => setSelectedVideoIndex(idx)}
                                                    className={`w-full flex gap-2 p-2 rounded-lg transition-all text-left ${selectedVideoIndex === idx
                                                        ? 'bg-[#e8f0fe] border border-[#1a73e8]'
                                                        : 'hover:bg-[#f5f5f5] border border-transparent'
                                                        }`}
                                                >
                                                    {/* Thumbnail */}
                                                    <div className="w-[72px] h-[40px] flex-shrink-0 rounded overflow-hidden bg-gray-200 relative">
                                                        <img
                                                            src={video.thumbnailUrl}
                                                            alt={video.title}
                                                            className="w-full h-full object-cover"
                                                        />
                                                        <div className="absolute bottom-0.5 right-0.5 px-1 bg-black/80 rounded text-[8px] text-white font-medium">
                                                            #{idx + 1}
                                                        </div>
                                                    </div>

                                                    {/* Info */}
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-[11px] font-medium text-[#1f1f1f] line-clamp-2 leading-tight">
                                                            {video.title}
                                                        </p>
                                                        <p className="text-[10px] text-[#5f6368] mt-0.5 truncate">{video.channelTitle}</p>
                                                    </div>
                                                </button>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Main Content Area */}
                        <div className="flex-1 flex flex-col overflow-hidden">
                            {isLoadingVideos ? (
                                <div className="flex-1 flex overflow-hidden p-4 gap-4">
                                    {/* Video + Summary Panel Skeleton */}
                                    <div className="flex-1 flex flex-col bg-white rounded-xl overflow-hidden shadow-sm border border-[#e0e0e0]">
                                        <div className="aspect-video bg-gray-100 animate-pulse flex items-center justify-center">
                                            <div className="w-12 h-12 rounded-full bg-gray-200" />
                                        </div>
                                        <div className="p-5 space-y-6">
                                            <div className="space-y-3">
                                                <div className="h-6 bg-gray-100 rounded w-3/4 animate-pulse" />
                                                <div className="h-4 bg-gray-100 rounded w-1/2 animate-pulse" />
                                            </div>
                                            <div className="space-y-2">
                                                <div className="h-4 bg-gray-100 rounded w-full animate-pulse" />
                                                <div className="h-4 bg-gray-100 rounded w-full animate-pulse" />
                                                <div className="h-4 bg-gray-100 rounded w-5/6 animate-pulse" />
                                            </div>
                                            <div className="space-y-2 pt-2">
                                                <div className="h-4 bg-gray-100 rounded w-full animate-pulse" />
                                                <div className="h-4 bg-gray-100 rounded w-4/5 animate-pulse" />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Right Interactive Panel Skeleton */}
                                    <div className="w-[340px] bg-white rounded-xl shadow-sm flex flex-col overflow-hidden flex-shrink-0 border border-[#e0e0e0]">
                                        <div className="flex border-b border-[#e0e0e0]">
                                            {[1, 2, 3].map((i) => (
                                                <div key={i} className="flex-1 py-3 px-4">
                                                    <div className="h-4 bg-gray-100 rounded animate-pulse" />
                                                </div>
                                            ))}
                                        </div>
                                        <div className="p-4 space-y-4">
                                            <div className="h-24 bg-gray-100 rounded-xl animate-pulse" />
                                            <div className="h-24 bg-gray-100 rounded-xl animate-pulse" />
                                            <div className="h-24 bg-gray-100 rounded-xl animate-pulse" />
                                        </div>
                                    </div>
                                </div>
                            ) : relevantVideos.length === 0 ? (
                                <div className="flex-1 flex items-center justify-center bg-white m-4 rounded-xl">
                                    <div className="text-center">
                                        <div className="w-20 h-20 mx-auto mb-4 bg-[#f5f5f5] rounded-full flex items-center justify-center">
                                            <Play className="w-10 h-10 text-[#9aa0a6]" />
                                        </div>
                                        <p className="text-[16px] text-[#5f6368] mb-2">No videos loaded yet</p>
                                        <p className="text-[13px] text-[#9aa0a6]">Upload a document to find relevant YouTube videos</p>
                                    </div>
                                </div>
                            ) : selectedVideo && (
                                <div className="flex-1 flex overflow-hidden p-4 gap-4">
                                    {/* Video + Summary Panel */}
                                    <div className="flex-1 flex flex-col bg-white rounded-xl overflow-hidden shadow-sm">
                                        {/* YouTube Player */}
                                        <div className="aspect-video bg-black flex-shrink-0">
                                            <iframe
                                                src={`https://www.youtube.com/embed/${selectedVideo.id}?rel=0`}
                                                title={selectedVideo.title}
                                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                                allowFullScreen
                                                className="w-full h-full"
                                            />
                                        </div>

                                        {/* Thoreo-style Tabs */}
                                        <div className="flex items-center justify-between px-4 py-2 border-b border-[#e0e0e0]">
                                            <div className="flex bg-[#f5f5f5] rounded-full p-0.5">
                                                {(['summary', 'key-concepts', 'transcript'] as const).map((tab) => (
                                                    <button
                                                        key={tab}
                                                        onClick={() => setVideoContentTab(tab)}
                                                        className={`px-4 py-1.5 text-[13px] font-medium rounded-full transition-all ${videoContentTab === tab
                                                            ? 'bg-white text-[#1f1f1f] shadow-sm'
                                                            : 'text-[#5f6368] hover:text-[#1f1f1f]'
                                                            }`}
                                                    >
                                                        {tab === 'summary' ? 'Summary' : tab === 'key-concepts' ? 'Key Concepts' : 'Transcript'}
                                                    </button>
                                                ))}
                                            </div>
                                            <button className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] text-[#5f6368] hover:bg-[#f5f5f5] rounded-full transition-colors">
                                                Share
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13" />
                                                </svg>
                                            </button>
                                        </div>

                                        {/* Tab Content */}
                                        <div className="flex-1 overflow-y-auto p-5">
                                            {videoContentTab === 'summary' && (
                                                <article className="prose prose-sm max-w-none">
                                                    <h1 className="text-[22px] font-medium text-[#d93025] mb-4 leading-tight">
                                                        {selectedVideo.title}
                                                    </h1>

                                                    {isLoadingVideoSummary ? (
                                                        <div className="flex items-center justify-center py-8">
                                                            <Loader2 className="w-6 h-6 text-[#9334e9] animate-spin mr-2" />
                                                            <span className="text-[14px] text-[#5f6368]">Generating AI summary...</span>
                                                        </div>
                                                    ) : videoSummary ? (
                                                        <div className="space-y-4">
                                                            <section>
                                                                <h2 className="text-[16px] font-medium text-[#1f1f1f] mb-2">Overview</h2>
                                                                <p className="text-[14px] text-[#444746] leading-relaxed whitespace-pre-wrap">
                                                                    {videoSummary.overview}
                                                                </p>
                                                            </section>

                                                            <section>
                                                                <h3 className="text-[14px] font-medium text-[#1f1f1f] mb-2">Key Points</h3>
                                                                <ul className="space-y-1.5">
                                                                    {videoSummary.keyPoints.map((point, idx) => (
                                                                        <li key={idx} className="text-[14px] text-[#444746] flex items-start gap-2">
                                                                            <span className="text-[#9334e9] mt-0.5">•</span>
                                                                            {point}
                                                                        </li>
                                                                    ))}
                                                                </ul>
                                                            </section>

                                                            <section>
                                                                <h3 className="text-[14px] font-medium text-[#1f1f1f] mb-2">Why This Video</h3>
                                                                <p className="text-[14px] text-[#444746] leading-relaxed">
                                                                    {selectedVideo.relevanceReason || 'This video was selected for its relevance to your document content.'}
                                                                </p>
                                                                <div className="flex items-center gap-4 mt-2 text-[13px] text-[#5f6368]">
                                                                    <span><strong className="text-[#1f1f1f]">Relevance:</strong> {selectedVideo.relevanceScore}%</span>
                                                                    {selectedVideo.subscriberCount && (
                                                                        <span><strong className="text-[#1f1f1f]">Channel:</strong> {selectedVideo.subscriberCount >= 1000000
                                                                            ? `${(selectedVideo.subscriberCount / 1000000).toFixed(1)}M`
                                                                            : `${Math.floor(selectedVideo.subscriberCount / 1000)}K`} subs</span>
                                                                    )}
                                                                </div>
                                                            </section>
                                                        </div>
                                                    ) : (
                                                        <div className="space-y-4">
                                                            <section>
                                                                <h2 className="text-[16px] font-medium text-[#1f1f1f] mb-2">Overview</h2>
                                                                <p className="text-[14px] text-[#444746] leading-relaxed">
                                                                    {selectedVideo.transcriptSummary || selectedVideo.relevanceReason || 'AI-generated summary will appear here after analysis.'}
                                                                </p>
                                                            </section>
                                                        </div>
                                                    )}
                                                </article>
                                            )}

                                            {videoContentTab === 'key-concepts' && (
                                                <div className="space-y-4">
                                                    <h2 className="text-[16px] font-medium text-[#1f1f1f]">Key Concepts</h2>
                                                    {isLoadingVideoSummary ? (
                                                        <div className="flex items-center justify-center py-8">
                                                            <Loader2 className="w-6 h-6 text-[#9334e9] animate-spin mr-2" />
                                                            <span className="text-[14px] text-[#5f6368]">Extracting key concepts...</span>
                                                        </div>
                                                    ) : videoSummary?.keyConcepts && videoSummary.keyConcepts.length > 0 ? (
                                                        <div className="grid gap-3">
                                                            {videoSummary.keyConcepts.map((concept, idx) => (
                                                                <div key={idx} className="p-3 bg-[#f8f9fa] rounded-lg border border-[#e0e0e0]">
                                                                    <h4 className="text-[14px] font-medium text-[#1f1f1f] mb-1">{concept.title}</h4>
                                                                    <p className="text-[13px] text-[#5f6368]">{concept.description}</p>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <p className="text-[13px] text-[#5f6368] italic">
                                                            Key concepts will be extracted when the summary is generated.
                                                        </p>
                                                    )}
                                                </div>
                                            )}

                                            {videoContentTab === 'transcript' && (
                                                <div className="space-y-3">
                                                    <div className="flex items-center justify-between">
                                                        <h2 className="text-[16px] font-medium text-[#1f1f1f]">Transcript</h2>
                                                        {isLoadingVideoTranscript && (
                                                            <div className="flex items-center text-[12px] text-[#5f6368]">
                                                                <Loader2 className="w-4 h-4 animate-spin mr-1" />
                                                                Loading...
                                                            </div>
                                                        )}
                                                    </div>
                                                    {videoTranscript ? (
                                                        <div className="text-[14px] text-[#444746] leading-relaxed whitespace-pre-wrap bg-[#f8f9fa] p-4 rounded-lg max-h-[400px] overflow-y-auto">
                                                            {videoTranscript}
                                                        </div>
                                                    ) : isLoadingVideoTranscript ? (
                                                        <div className="flex items-center justify-center py-8">
                                                            <Loader2 className="w-6 h-6 text-[#9334e9] animate-spin mr-2" />
                                                            <span className="text-[14px] text-[#5f6368]">Fetching transcript...</span>
                                                        </div>
                                                    ) : (
                                                        <div className="text-center py-8 bg-[#f8f9fa] rounded-lg">
                                                            <p className="text-[14px] text-[#5f6368]">
                                                                Transcript not available for this video.
                                                            </p>
                                                            <p className="text-[12px] text-[#9aa0a6] mt-1">
                                                                The video may not have captions enabled.
                                                            </p>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Right Interactive Panel - Thoreo Style */}
                                    <div className="w-[340px] bg-white rounded-xl shadow-sm flex flex-col overflow-hidden flex-shrink-0">
                                        {/* Interactive Tabs */}
                                        <div className="flex border-b border-[#e0e0e0]">
                                            {(['chat', 'quiz', 'flashcards'] as const).map((tab) => (
                                                <button
                                                    key={tab}
                                                    onClick={() => {
                                                        setVideoInteractiveTab(tab);
                                                        // Auto-load quiz or flashcards when tab is clicked
                                                        if (tab === 'quiz' && videoQuiz.length === 0 && !isLoadingVideoQuiz) {
                                                            handleLoadVideoQuiz();
                                                        }
                                                        if (tab === 'flashcards' && videoFlashcards.length === 0 && !isLoadingFlashcards) {
                                                            handleLoadFlashcards();
                                                        }
                                                    }}
                                                    className={`flex-1 py-3 text-[13px] font-medium transition-all border-b-2 ${videoInteractiveTab === tab
                                                        ? 'text-[#1f1f1f] border-[#1a73e8] bg-white'
                                                        : 'text-[#5f6368] border-transparent hover:text-[#1f1f1f] bg-[#f8f9fa]'
                                                        }`}
                                                >
                                                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                                                </button>
                                            ))}
                                        </div>

                                        {/* Interactive Content */}
                                        <div className="flex-1 overflow-y-auto p-4" ref={chatContainerRef}>
                                            {videoInteractiveTab === 'chat' && (
                                                <div className="space-y-3">
                                                    {/* Chat Messages */}
                                                    {videoChatMessages.length > 0 ? (
                                                        <div className="space-y-3 mb-4">
                                                            {videoChatMessages.map((msg, idx) => (
                                                                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                                                    <div className={`max-w-[85%] p-3 rounded-2xl text-[13px] leading-relaxed ${msg.role === 'user'
                                                                        ? 'bg-[#1a73e8] text-white rounded-br-sm'
                                                                        : 'bg-[#f1f3f4] text-[#1f1f1f] rounded-bl-sm'
                                                                        }`}>
                                                                        {msg.role === 'user' ? (
                                                                            msg.content
                                                                        ) : (
                                                                            <ReactMarkdown
                                                                                remarkPlugins={[remarkMath]}
                                                                                rehypePlugins={[rehypeKatex]}
                                                                                components={{
                                                                                    p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                                                                                    ul: ({ children }) => <ul className="list-disc pl-4 mb-2">{children}</ul>,
                                                                                    ol: ({ children }) => <ol className="list-decimal pl-4 mb-2">{children}</ol>,
                                                                                    li: ({ children }) => <li className="mb-1">{children}</li>,
                                                                                    code: ({ children }) => <code className="bg-black/10 px-1 rounded font-mono text-[11px]">{children}</code>,
                                                                                    pre: ({ children }) => <pre className="bg-black/10 p-2 rounded mb-2 overflow-x-auto font-mono text-[11px]">{children}</pre>,
                                                                                    strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                                                                                }}
                                                                            >
                                                                                {msg.content}
                                                                            </ReactMarkdown>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                            {isLoadingChatResponse && (
                                                                <div className="flex justify-start">
                                                                    <div className="bg-[#f1f3f4] text-[#5f6368] p-3 rounded-2xl rounded-bl-sm flex items-center gap-2">
                                                                        <Loader2 className="w-4 h-4 animate-spin" />
                                                                        <span className="text-[13px]">Thinking...</span>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        /* Suggested Questions - Only show when no messages */
                                                        <div className="grid grid-cols-2 gap-2">
                                                            {suggestedQuestions.map((question, idx) => (
                                                                <button
                                                                    key={idx}
                                                                    onClick={() => setVideoChatInput(question)}
                                                                    className="p-3 text-left text-[12px] text-[#1f1f1f] bg-[#fff9e6] hover:bg-[#fff3cc] border border-[#ffe082] rounded-lg transition-colors leading-snug"
                                                                >
                                                                    {question}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {videoInteractiveTab === 'quiz' && (
                                                <div className="space-y-4">
                                                    {isLoadingVideoQuiz ? (
                                                        <div className="flex flex-col items-center justify-center py-8">
                                                            <Loader2 className="w-8 h-8 text-[#1a73e8] animate-spin mb-3" />
                                                            <span className="text-[14px] text-[#5f6368]">Generating quiz from video...</span>
                                                        </div>
                                                    ) : videoQuiz.length > 0 ? (
                                                        <>
                                                            {/* Progress */}
                                                            <div className="flex items-center justify-between text-[12px] text-[#5f6368] mb-2">
                                                                <span>Question {currentVideoQuizIndex + 1} of {videoQuiz.length}</span>
                                                                <button
                                                                    onClick={() => {
                                                                        setVideoQuiz([]);
                                                                        handleLoadVideoQuiz();
                                                                    }}
                                                                    className="text-[#1a73e8] hover:underline flex items-center gap-1"
                                                                >
                                                                    <RefreshCw className="w-3 h-3" />
                                                                    New Quiz
                                                                </button>
                                                            </div>

                                                            <div className="p-4 bg-[#f8f9fa] rounded-lg">
                                                                <p className="text-[14px] font-medium text-[#1f1f1f] mb-3">
                                                                    {videoQuiz[currentVideoQuizIndex]?.question}
                                                                </p>
                                                                <div className="space-y-2">
                                                                    {videoQuiz[currentVideoQuizIndex]?.options.map((opt, idx) => {
                                                                        const isSelected = videoQuizAnswers[currentVideoQuizIndex] === idx;
                                                                        const showFeedback = showVideoQuizFeedback[currentVideoQuizIndex];
                                                                        const isCorrect = idx === videoQuiz[currentVideoQuizIndex]?.correctAnswerIndex;

                                                                        let bgColor = 'bg-white hover:bg-[#f5f5f5]';
                                                                        let borderColor = 'border-[#e0e0e0] hover:border-[#1a73e8]';
                                                                        let textColor = 'text-[#1f1f1f]';

                                                                        if (showFeedback && isCorrect) {
                                                                            bgColor = 'bg-[#ceead6]';
                                                                            borderColor = 'border-[#34a853]';
                                                                            textColor = 'text-[#137333]';
                                                                        } else if (showFeedback && isSelected && !isCorrect) {
                                                                            bgColor = 'bg-[#fad2cf]';
                                                                            borderColor = 'border-[#ea4335]';
                                                                            textColor = 'text-[#c5221f]';
                                                                        } else if (isSelected) {
                                                                            borderColor = 'border-[#1a73e8]';
                                                                            bgColor = 'bg-[#e8f0fe]';
                                                                        }

                                                                        return (
                                                                            <button
                                                                                key={idx}
                                                                                onClick={() => {
                                                                                    if (!showVideoQuizFeedback[currentVideoQuizIndex]) {
                                                                                        setVideoQuizAnswers(prev => ({ ...prev, [currentVideoQuizIndex]: idx }));
                                                                                        setShowVideoQuizFeedback(prev => ({ ...prev, [currentVideoQuizIndex]: true }));
                                                                                    }
                                                                                }}
                                                                                disabled={showVideoQuizFeedback[currentVideoQuizIndex]}
                                                                                className={`w-full p-2.5 text-left text-[13px] ${bgColor} border ${borderColor} ${textColor} rounded-lg transition-all font-medium`}
                                                                            >
                                                                                <span className="font-semibold mr-1">{String.fromCharCode(65 + idx)}.</span>
                                                                                {opt}
                                                                            </button>
                                                                        );
                                                                    })}
                                                                </div>

                                                                {/* Feedback */}
                                                                {showVideoQuizFeedback[currentVideoQuizIndex] && (
                                                                    <div className="mt-3 p-3 bg-white rounded-lg border border-[#e0e0e0]">
                                                                        <p className={`text-[13px] font-medium ${videoQuizAnswers[currentVideoQuizIndex] === videoQuiz[currentVideoQuizIndex]?.correctAnswerIndex ? 'text-[#137333]' : 'text-[#c5221f]'}`}>
                                                                            {videoQuizAnswers[currentVideoQuizIndex] === videoQuiz[currentVideoQuizIndex]?.correctAnswerIndex
                                                                                ? '✓ Correct!'
                                                                                : '✗ Not quite.'}
                                                                        </p>
                                                                        <p className="text-[12px] text-[#5f6368] mt-1">
                                                                            {videoQuiz[currentVideoQuizIndex]?.explanation}
                                                                        </p>
                                                                    </div>
                                                                )}
                                                            </div>

                                                            {/* Navigation */}
                                                            {showVideoQuizFeedback[currentVideoQuizIndex] && currentVideoQuizIndex < videoQuiz.length - 1 && (
                                                                <button
                                                                    onClick={() => setCurrentVideoQuizIndex(prev => prev + 1)}
                                                                    className="w-full py-2 bg-[#1a73e8] text-white text-[13px] font-medium rounded-lg hover:bg-[#1557b0] transition-colors"
                                                                >
                                                                    Next Question
                                                                </button>
                                                            )}
                                                        </>
                                                    ) : (
                                                        <div className="text-center py-8">
                                                            <p className="text-[14px] text-[#5f6368] mb-3">Generate a quiz based on this video</p>
                                                            <button
                                                                onClick={handleLoadVideoQuiz}
                                                                className="px-4 py-2 bg-[#1a73e8] text-white text-[13px] font-medium rounded-lg hover:bg-[#1557b0] transition-colors"
                                                            >
                                                                Generate Quiz
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {videoInteractiveTab === 'flashcards' && (
                                                <div className="space-y-3">
                                                    {isLoadingFlashcards ? (
                                                        <div className="flex flex-col items-center justify-center py-8">
                                                            <Loader2 className="w-8 h-8 text-[#1a73e8] animate-spin mb-3" />
                                                            <span className="text-[14px] text-[#5f6368]">Creating flashcards...</span>
                                                        </div>
                                                    ) : videoFlashcards.length > 0 ? (
                                                        <>
                                                            {/* Progress */}
                                                            <div className="flex items-center justify-between text-[12px] text-[#5f6368] mb-2">
                                                                <span>Card {currentFlashcardIndex + 1} of {videoFlashcards.length}</span>
                                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${videoFlashcards[currentFlashcardIndex]?.difficulty === 'easy' ? 'bg-[#e6f4ea] text-[#137333]' :
                                                                    videoFlashcards[currentFlashcardIndex]?.difficulty === 'medium' ? 'bg-[#fff8e1] text-[#f9a825]' :
                                                                        'bg-[#fce8e6] text-[#c5221f]'
                                                                    }`}>
                                                                    {videoFlashcards[currentFlashcardIndex]?.difficulty}
                                                                </span>
                                                            </div>

                                                            {/* Flashcard */}
                                                            <div
                                                                onClick={() => setIsFlashcardFlipped(!isFlashcardFlipped)}
                                                                className={`aspect-[3/2] rounded-xl p-5 flex items-center justify-center cursor-pointer hover:shadow-lg transition-all ${isFlashcardFlipped
                                                                    ? 'bg-[#e8f0fe] border-2 border-[#1a73e8]'
                                                                    : 'bg-gradient-to-br from-[#4285f4] to-[#1a73e8]'
                                                                    }`}
                                                            >
                                                                <p className={`text-center text-[15px] font-medium ${isFlashcardFlipped ? 'text-[#1f1f1f]' : 'text-white'}`}>
                                                                    {isFlashcardFlipped
                                                                        ? videoFlashcards[currentFlashcardIndex]?.back
                                                                        : videoFlashcards[currentFlashcardIndex]?.front
                                                                    }
                                                                </p>
                                                            </div>

                                                            <p className="text-[11px] text-[#9aa0a6] text-center">
                                                                {isFlashcardFlipped ? 'Click to see question' : 'Click to reveal answer'}
                                                            </p>

                                                            {/* Navigation */}
                                                            <div className="flex justify-center gap-2 pt-2">
                                                                <button
                                                                    onClick={() => {
                                                                        if (currentFlashcardIndex > 0) {
                                                                            setCurrentFlashcardIndex(prev => prev - 1);
                                                                            setIsFlashcardFlipped(false);
                                                                        }
                                                                    }}
                                                                    disabled={currentFlashcardIndex === 0}
                                                                    className="px-4 py-1.5 text-[12px] font-medium border border-[#e0e0e0] rounded-full hover:bg-[#f5f5f5] disabled:opacity-40 transition-colors"
                                                                >
                                                                    Previous
                                                                </button>
                                                                <button
                                                                    onClick={() => {
                                                                        if (currentFlashcardIndex < videoFlashcards.length - 1) {
                                                                            setCurrentFlashcardIndex(prev => prev + 1);
                                                                            setIsFlashcardFlipped(false);
                                                                        }
                                                                    }}
                                                                    disabled={currentFlashcardIndex === videoFlashcards.length - 1}
                                                                    className="px-4 py-1.5 text-[12px] font-medium bg-[#1a73e8] text-white rounded-full hover:bg-[#1557b0] disabled:opacity-40 transition-colors"
                                                                >
                                                                    Next
                                                                </button>
                                                            </div>
                                                        </>
                                                    ) : (
                                                        <div className="text-center py-8">
                                                            <p className="text-[14px] text-[#5f6368] mb-3">Create flashcards from this video</p>
                                                            <button
                                                                onClick={handleLoadFlashcards}
                                                                className="px-4 py-2 bg-[#1a73e8] text-white text-[13px] font-medium rounded-lg hover:bg-[#1557b0] transition-colors"
                                                            >
                                                                Generate Flashcards
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        {/* Chat Input - Only show for chat tab */}
                                        {videoInteractiveTab === 'chat' && (
                                            <div className="p-3 border-t border-[#e0e0e0]">
                                                <div className="flex items-center gap-2 bg-[#f5f5f5] rounded-full px-4 py-2">
                                                    <input
                                                        type="text"
                                                        value={videoChatInput}
                                                        onChange={(e) => setVideoChatInput(e.target.value)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                                e.preventDefault();
                                                                handleSendChatMessage();
                                                            }
                                                        }}
                                                        placeholder="Ask about this video..."
                                                        disabled={isLoadingChatResponse}
                                                        className="flex-1 bg-transparent text-[13px] text-[#1f1f1f] placeholder-[#9aa0a6] outline-none"
                                                    />
                                                    <button
                                                        onClick={handleSendChatMessage}
                                                        disabled={!videoChatInput.trim() || isLoadingChatResponse}
                                                        className="p-1.5 hover:bg-[#e0e0e0] rounded-full transition-colors disabled:opacity-40"
                                                    >
                                                        <Send className="w-4 h-4 text-[#5f6368]" />
                                                    </button>
                                                </div>
                                                <p className="text-[11px] text-[#9aa0a6] text-center mt-2">
                                                    {videoTranscript ? 'AI has access to video transcript for better answers' : 'Using video metadata for context'}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                );

            case 'mindmap':
                return (
                    <div className="flex flex-col h-full bg-white">
                        {/* Mind Map Container */}
                        <div
                            className="flex-1 relative bg-[#f8f9fa] overflow-hidden"
                            style={{ minHeight: '400px' }}
                        >
                            {reactFlowData ? (
                                <ReactFlowMindMap data={reactFlowData} />
                            ) : (
                                <div className="flex items-center justify-center h-full">
                                    <div className="text-center">
                                        <div className="w-16 h-16 mx-auto mb-4 bg-[#e8f0fe] rounded-full flex items-center justify-center">
                                            <MindmapIcon active />
                                        </div>
                                        <p className="text-[15px] text-[#5f6368]">
                                            {processingStage === 'idle' ? 'Upload a document to generate a mind map' : 'Generating mind map...'}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                );

            case 'simulation':
                return (
                    <div className={`flex flex-col bg-white ${isSimulationFullscreen ? 'fixed inset-0 z-[100]' : 'h-full p-6'}`} style={{ height: isSimulationFullscreen ? '100vh' : '100%' }}>
                        {/* Simulation Header */}
                        {!isSimulationFullscreen && (
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-[#fff3e0] rounded-full flex items-center justify-center">
                                        <SimulationIcon active />
                                    </div>
                                    <div>
                                        <h2 className="text-[18px] font-medium text-[#1f1f1f]">Interactive 3D Simulation</h2>
                                        <p className="text-[13px] text-[#5f6368]">
                                            {simulationBlueprint ? simulationBlueprint.meta.topic : 'AI-generated educational simulation based on your document'}
                                        </p>
                                    </div>
                                </div>
                                {simulationHTML && (
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={handleRegenerateSimulation}
                                            className="px-3 py-1.5 text-[13px] text-[#5f6368] hover:bg-[#f1f3f4] rounded-lg transition-colors flex items-center gap-1.5"
                                        >
                                            <RefreshCw className="w-4 h-4" />
                                            Regenerate
                                        </button>
                                        <button
                                            onClick={toggleSimulationFullscreen}
                                            className="px-3 py-1.5 text-[13px] text-white bg-[#ff6d01] hover:bg-[#e56200] rounded-lg transition-colors flex items-center gap-1.5"
                                        >
                                            <Maximize2 className="w-4 h-4" />
                                            Fullscreen
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Fullscreen Header */}
                        {isSimulationFullscreen && (
                            <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
                                {simulationHTML && (
                                    <button
                                        onClick={handleRegenerateSimulation}
                                        className="px-3 py-1.5 text-[13px] text-white bg-black/50 hover:bg-black/70 rounded-lg transition-colors flex items-center gap-1.5 backdrop-blur-sm"
                                    >
                                        <RefreshCw className="w-4 h-4" />
                                        Regenerate
                                    </button>
                                )}
                                <button
                                    onClick={toggleSimulationFullscreen}
                                    className="px-3 py-1.5 text-[13px] text-white bg-[#ff6d01] hover:bg-[#e56200] rounded-lg transition-colors flex items-center gap-1.5 backdrop-blur-sm"
                                >
                                    <Minimize2 className="w-4 h-4" />
                                    Exit Fullscreen
                                </button>
                            </div>
                        )}

                        {/* Simulation Content */}
                        <div className={`flex-1 ${isSimulationFullscreen ? 'h-full' : 'rounded-xl border border-[#e8eaed] overflow-hidden'}`} style={{ height: isSimulationFullscreen ? 'calc(100vh - 60px)' : undefined }}>
                            {/* Initial State - No Simulation */}
                            {!simulationHTML && !isGeneratingSimulation && !simulationError && (
                                <div className="flex items-center justify-center h-full bg-gradient-to-br from-[#fff3e0] to-[#ffe0b2]">
                                    <div className="text-center max-w-md px-6">
                                        <div className="w-20 h-20 mx-auto mb-6 bg-white rounded-2xl shadow-lg flex items-center justify-center">
                                            <SimulationIcon active />
                                        </div>
                                        <h3 className="text-[22px] font-medium text-[#1f1f1f] mb-3">Generate Interactive Simulation</h3>
                                        <p className="text-[15px] text-[#5f6368] mb-6">
                                            Create an AI-powered 3D simulation to visualize and interact with concepts from your document.
                                        </p>

                                        {immersiveContent ? (
                                            <button
                                                onClick={handleGenerateSimulation}
                                                className="px-6 py-3 bg-[#ff6d01] hover:bg-[#e56200] text-white rounded-full font-medium transition-colors flex items-center gap-2 mx-auto shadow-lg hover:shadow-xl"
                                            >
                                                <Sparkles className="w-5 h-5" />
                                                Generate Simulation
                                            </button>
                                        ) : (
                                            <p className="text-[14px] text-[#ff6d01] font-medium">
                                                Please upload a document first to generate a simulation
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Loading State - Terminal Style with WarpBackground */}
                            {isGeneratingSimulation && (
                                <WarpBackground
                                    className="flex-1 flex items-center justify-center h-full border-0 p-0 bg-slate-950"
                                    perspective={150}
                                    beamsPerSide={4}
                                    beamSize={4}
                                    beamDelayMax={2}
                                    beamDuration={4}
                                    gridColor="rgba(255, 109, 1, 0.15)"
                                >
                                    {/* Terminal Display - Centered */}
                                    <div className="relative z-10 w-full max-w-3xl mx-auto px-8">
                                        <Terminal className="w-full max-w-none shadow-2xl backdrop-blur-sm">
                                            {/* Command line with typing */}
                                            <div className="flex items-center gap-2 text-slate-400 mb-3">
                                                <span className="text-orange-400">➜</span>
                                                <span className="text-amber-400">~/simulation</span>
                                                <span className="text-slate-500">$</span>
                                                <TypingAnimation className="text-slate-300" duration={25} delay={0}>
                                                    gemini generate --mode 3d-simulation
                                                </TypingAnimation>
                                            </div>

                                            {/* Dynamic Progress Steps */}
                                            {simulationProgressSteps.map((step, idx) => (
                                                <AnimatedSpan key={idx} delay={800 + (idx * 600)} className="text-slate-300">
                                                    {step.status === 'done' && (
                                                        <><span className="text-green-400">✔</span> {step.step}</>
                                                    )}
                                                    {step.status === 'active' && (
                                                        <><span className="text-orange-400 animate-pulse">●</span> {step.step}...</>
                                                    )}
                                                    {step.status === 'pending' && (
                                                        <><span className="text-slate-600">○</span> <span className="text-slate-500">{step.step}</span></>
                                                    )}
                                                </AnimatedSpan>
                                            ))}

                                            {/* Current Status */}
                                            {simulationProgress && (
                                                <AnimatedSpan delay={5000} className="text-amber-400 flex items-center gap-2 mt-2">
                                                    <Loader2 className="w-3 h-3 animate-spin" />
                                                    <span>{simulationProgress}</span>
                                                </AnimatedSpan>
                                            )}

                                            {/* Progress bar */}
                                            <AnimatedSpan delay={5200} className="mt-4 pt-3 border-t border-slate-800">
                                                <div className="flex items-center gap-3">
                                                    <span className="text-slate-500 text-xs">Progress:</span>
                                                    <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden max-w-[200px]">
                                                        <div
                                                            className="h-full bg-gradient-to-r from-orange-500 to-amber-400 transition-all duration-500"
                                                            style={{ width: `${Math.round((simulationProgressSteps.filter(s => s.status === 'done').length / simulationProgressSteps.length) * 100)}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-amber-400 text-xs font-mono">
                                                        {Math.round((simulationProgressSteps.filter(s => s.status === 'done').length / simulationProgressSteps.length) * 100)}%
                                                    </span>
                                                </div>
                                            </AnimatedSpan>
                                        </Terminal>
                                    </div>
                                </WarpBackground>
                            )}

                            {/* Error State */}
                            {simulationError && !isGeneratingSimulation && (
                                <div className="flex items-center justify-center h-full bg-red-50">
                                    <div className="text-center max-w-md px-6">
                                        <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
                                            <X className="w-8 h-8 text-red-500" />
                                        </div>
                                        <h3 className="text-[18px] font-medium text-red-800 mb-2">Generation Failed</h3>
                                        <p className="text-[14px] text-red-600 mb-4">{simulationError}</p>
                                        <button
                                            onClick={handleGenerateSimulation}
                                            className="px-5 py-2 bg-white border border-red-200 hover:bg-red-50 text-red-700 rounded-full font-medium transition-colors"
                                        >
                                            Try Again
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Simulation Iframe */}
                            {simulationHTML && !isGeneratingSimulation && (
                                <iframe
                                    ref={simulationIframeRef}
                                    srcDoc={simulationHTML}
                                    className="w-full border-0"
                                    title="Interactive Simulation"
                                    sandbox="allow-scripts allow-same-origin allow-forms"
                                    style={{ height: isSimulationFullscreen ? '100%' : '500px', minHeight: isSimulationFullscreen ? 'calc(100vh - 60px)' : '500px' }}
                                />
                            )}
                        </div>

                        {/* Blueprint Info Panel (shown when not fullscreen) */}
                        {simulationBlueprint && simulationHTML && !isSimulationFullscreen && (
                            <div className="mt-4 p-4 bg-[#f8f9fa] rounded-xl border border-[#e8eaed]">
                                <div className="grid grid-cols-3 gap-4">
                                    <div>
                                        <h4 className="text-[12px] font-medium text-[#5f6368] uppercase tracking-wide mb-1">Library</h4>
                                        <p className="text-[14px] text-[#1f1f1f]">{simulationBlueprint.simulation_logic.preferred_library}</p>
                                    </div>
                                    <div>
                                        <h4 className="text-[12px] font-medium text-[#5f6368] uppercase tracking-wide mb-1">Level</h4>
                                        <p className="text-[14px] text-[#1f1f1f]">{simulationBlueprint.meta.academic_level}</p>
                                    </div>
                                    <div>
                                        <h4 className="text-[12px] font-medium text-[#5f6368] uppercase tracking-wide mb-1">Complexity</h4>
                                        <div className="flex items-center gap-1">
                                            {[...Array(10)].map((_, i) => (
                                                <div
                                                    key={i}
                                                    className={`w-2 h-2 rounded-full ${i < simulationBlueprint.meta.complexity_rating ? 'bg-[#ff6d01]' : 'bg-[#e8eaed]'}`}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                {simulationBlueprint.educational_content.key_points.length > 0 && (
                                    <div className="mt-4 pt-4 border-t border-[#e8eaed]">
                                        <h4 className="text-[12px] font-medium text-[#5f6368] uppercase tracking-wide mb-2">Key Learning Points</h4>
                                        <div className="flex flex-wrap gap-2">
                                            {simulationBlueprint.educational_content.key_points.slice(0, 4).map((point, idx) => (
                                                <span key={idx} className="px-3 py-1 bg-white rounded-full text-[13px] text-[#1f1f1f] border border-[#e8eaed]">
                                                    {point.length > 50 ? point.substring(0, 50) + '...' : point}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                );

            case 'robotics':
                return (
                    <div className="flex flex-col h-full bg-white p-6">
                        {/* Header */}
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-[#e0f7fa] rounded-full flex items-center justify-center">
                                    <RoboticsIcon active />
                                </div>
                                <div>
                                    <h2 className="text-[18px] font-medium text-[#1f1f1f]">Robotics Vision</h2>
                                    <p className="text-[13px] text-[#5f6368]">Real-time object detection & spatial understanding with Gemini</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {isWebcamActive && (
                                    <>
                                        <button
                                            onClick={toggleAutoAnalysis}
                                            className={`px-3 py-1.5 text-[13px] rounded-lg transition-colors flex items-center gap-1.5 ${isAutoAnalyzing
                                                ? 'bg-[#00bcd4] text-white'
                                                : 'text-[#5f6368] hover:bg-[#f1f3f4]'
                                                }`}
                                        >
                                            {isAutoAnalyzing ? (
                                                <>
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                    Auto-Analyzing
                                                </>
                                            ) : (
                                                <>
                                                    <Play className="w-4 h-4" />
                                                    Auto Analyze
                                                </>
                                            )}
                                        </button>
                                        <button
                                            onClick={runRoboticsAnalysis}
                                            disabled={isAnalyzing}
                                            className="px-3 py-1.5 text-[13px] text-white bg-[#00bcd4] hover:bg-[#00acc1] disabled:opacity-50 rounded-lg transition-colors flex items-center gap-1.5"
                                        >
                                            {isAnalyzing ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                            ) : (
                                                <Sparkles className="w-4 h-4" />
                                            )}
                                            Analyze Frame
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Main Content */}
                        <div className="flex-1 min-h-0 flex gap-4">
                            {/* Webcam View */}
                            <div className="flex-1 min-h-0 relative rounded-xl border border-[#e8eaed] overflow-hidden bg-black">
                                {!isWebcamActive ? (
                                    <div className="flex items-center justify-center h-full bg-gradient-to-br from-[#e0f7fa] to-[#b2ebf2]">
                                        <div className="text-center max-w-md px-6">
                                            <div className="w-20 h-20 mx-auto mb-6 bg-white rounded-2xl shadow-lg flex items-center justify-center">
                                                <RoboticsIcon active />
                                            </div>
                                            <h3 className="text-[22px] font-medium text-[#1f1f1f] mb-3">Start Robotics Vision</h3>
                                            <p className="text-[15px] text-[#5f6368] mb-6">
                                                Use your webcam to detect objects, understand scenes, and explore spatial reasoning with Gemini Robotics-ER.
                                            </p>
                                            {webcamError ? (
                                                <p className="text-[14px] text-red-500 mb-4">{webcamError}</p>
                                            ) : null}
                                            <button
                                                onClick={startWebcam}
                                                className="px-6 py-3 bg-[#00bcd4] hover:bg-[#00acc1] text-white rounded-full font-medium transition-colors flex items-center gap-2 mx-auto shadow-lg hover:shadow-xl"
                                            >
                                                <Play className="w-5 h-5" />
                                                Start Webcam
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <video
                                            ref={webcamRef}
                                            className="w-full h-full object-cover"
                                            autoPlay
                                            playsInline
                                            muted
                                        />
                                        {/* Canvas for capturing frames (hidden) */}
                                        <canvas ref={webcamCanvasRef} className="hidden" />

                                        {/* Object Detection Overlay */}
                                        <svg className="absolute inset-0 w-full h-full pointer-events-none">
                                            {/* Draw points for detected objects */}
                                            {detectedObjects.map((obj, idx) => {
                                                const x = (obj.point[1] / 1000) * 100; // Convert to percentage
                                                const y = (obj.point[0] / 1000) * 100;
                                                return (
                                                    <g key={idx}>
                                                        <circle
                                                            cx={`${x}%`}
                                                            cy={`${y}%`}
                                                            r="8"
                                                            fill="#00bcd4"
                                                            stroke="white"
                                                            strokeWidth="2"
                                                            className="animate-pulse"
                                                        />
                                                        <text
                                                            x={`${x}%`}
                                                            y={`${Math.max(y - 2, 5)}%`}
                                                            textAnchor="middle"
                                                            fill="white"
                                                            fontSize="12"
                                                            fontWeight="500"
                                                            style={{ textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}
                                                        >
                                                            {obj.label}
                                                        </text>
                                                    </g>
                                                );
                                            })}

                                            {/* Draw bounding boxes */}
                                            {boundingBoxes.map((box, idx) => {
                                                const [ymin, xmin, ymax, xmax] = box.box_2d;
                                                const x = (xmin / 1000) * 100;
                                                const y = (ymin / 1000) * 100;
                                                const width = ((xmax - xmin) / 1000) * 100;
                                                const height = ((ymax - ymin) / 1000) * 100;
                                                const colors = ['#ff5722', '#4caf50', '#2196f3', '#ff9800', '#9c27b0', '#00bcd4'];
                                                const color = colors[idx % colors.length];
                                                return (
                                                    <g key={idx}>
                                                        <rect
                                                            x={`${x}%`}
                                                            y={`${y}%`}
                                                            width={`${width}%`}
                                                            height={`${height}%`}
                                                            fill="none"
                                                            stroke={color}
                                                            strokeWidth="2"
                                                        />
                                                        <rect
                                                            x={`${x}%`}
                                                            y={`${Math.max(y - 4, 0)}%`}
                                                            width={`${Math.min(box.label.length * 8, width)}px`}
                                                            height="18"
                                                            fill={color}
                                                            rx="2"
                                                        />
                                                        <text
                                                            x={`${x + 0.5}%`}
                                                            y={`${Math.max(y - 0.5, 3)}%`}
                                                            fill="white"
                                                            fontSize="11"
                                                            fontWeight="500"
                                                        >
                                                            {box.label}
                                                        </text>
                                                    </g>
                                                );
                                            })}

                                            {/* Hand Skeleton Overlay */}
                                            {analysisMode === 'hand' && handLandmarks && (
                                                <>
                                                    {/* Draw connections (bones) */}
                                                    {HAND_CONNECTIONS.map(([start, end], idx) => {
                                                        const startPoint = handLandmarks[start];
                                                        const endPoint = handLandmarks[end];
                                                        if (!startPoint || !endPoint) return null;

                                                        // Mirror x coordinate for natural view
                                                        const x1 = (1 - startPoint.x) * 100;
                                                        const y1 = startPoint.y * 100;
                                                        const x2 = (1 - endPoint.x) * 100;
                                                        const y2 = endPoint.y * 100;

                                                        return (
                                                            <line
                                                                key={`connection-${idx}`}
                                                                x1={`${x1}%`}
                                                                y1={`${y1}%`}
                                                                x2={`${x2}%`}
                                                                y2={`${y2}%`}
                                                                stroke="#00ff88"
                                                                strokeWidth="3"
                                                                strokeLinecap="round"
                                                                style={{ filter: 'drop-shadow(0 0 4px #00ff88)' }}
                                                            />
                                                        );
                                                    })}

                                                    {/* Draw landmarks (joints) */}
                                                    {handLandmarks.map((landmark, idx) => {
                                                        // Mirror x coordinate for natural view
                                                        const x = (1 - landmark.x) * 100;
                                                        const y = landmark.y * 100;

                                                        // Different colors for fingertips
                                                        const fingertips = [4, 8, 12, 16, 20];
                                                        const isFingertip = fingertips.includes(idx);
                                                        const isWrist = idx === 0;

                                                        return (
                                                            <circle
                                                                key={`landmark-${idx}`}
                                                                cx={`${x}%`}
                                                                cy={`${y}%`}
                                                                r={isFingertip ? 8 : isWrist ? 10 : 5}
                                                                fill={isFingertip ? '#ff4081' : isWrist ? '#00bcd4' : '#00ff88'}
                                                                stroke="white"
                                                                strokeWidth="2"
                                                                style={{
                                                                    filter: isFingertip
                                                                        ? 'drop-shadow(0 0 6px #ff4081)'
                                                                        : 'drop-shadow(0 0 4px #00ff88)'
                                                                }}
                                                            />
                                                        );
                                                    })}

                                                    {/* Fingertip labels */}
                                                    {[
                                                        { idx: 4, label: 'Thumb' },
                                                        { idx: 8, label: 'Index' },
                                                        { idx: 12, label: 'Middle' },
                                                        { idx: 16, label: 'Ring' },
                                                        { idx: 20, label: 'Pinky' },
                                                    ].map(({ idx, label }) => {
                                                        const landmark = handLandmarks[idx];
                                                        if (!landmark) return null;
                                                        const x = (1 - landmark.x) * 100;
                                                        const y = landmark.y * 100;

                                                        return (
                                                            <text
                                                                key={`label-${idx}`}
                                                                x={`${x}%`}
                                                                y={`${Math.max(y - 3, 3)}%`}
                                                                textAnchor="middle"
                                                                fill="white"
                                                                fontSize="10"
                                                                fontWeight="500"
                                                                style={{ textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}
                                                            >
                                                                {label}
                                                            </text>
                                                        );
                                                    })}
                                                </>
                                            )}
                                        </svg>

                                        {/* Hand Tracking Status Indicator */}
                                        {analysisMode === 'hand' && (
                                            <div className={`absolute top-4 left-4 px-3 py-1.5 rounded-full text-[13px] flex items-center gap-2 ${handLandmarks ? 'bg-green-500/90 text-white' : 'bg-yellow-500/90 text-white'
                                                }`}>
                                                <Hand className="w-4 h-4" />
                                                {handLandmarks ? 'Hand Detected' : 'Looking for hands...'}
                                            </div>
                                        )}

                                        {/* Analyzing indicator */}
                                        {isAnalyzing && analysisMode !== 'hand' && (
                                            <div className="absolute top-4 left-4 px-3 py-1.5 bg-black/70 text-white rounded-full text-[13px] flex items-center gap-2">
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                Analyzing...
                                            </div>
                                        )}

                                        {/* Stop button */}
                                        <button
                                            onClick={stopWebcam}
                                            className="absolute top-4 right-4 px-3 py-1.5 bg-red-500/90 hover:bg-red-600 text-white rounded-lg text-[13px] flex items-center gap-1.5"
                                        >
                                            <X className="w-4 h-4" />
                                            Stop
                                        </button>
                                    </>
                                )}
                            </div>

                            {/* Control Panel */}
                            <div className="w-[320px] min-h-0 flex flex-col gap-4">
                                {/* Analysis Mode Selector */}
                                <div className="bg-[#f8f9fa] rounded-xl p-4 border border-[#e8eaed]">
                                    <h3 className="text-[14px] font-medium text-[#1f1f1f] mb-3">Analysis Mode</h3>
                                    <div className="flex flex-wrap gap-2">
                                        {[
                                            { id: 'detect', label: 'Detect Objects', icon: '🔍' },
                                            { id: 'boxes', label: 'Bounding Boxes', icon: '📦' },
                                            { id: 'classify', label: 'Classify', icon: '🏷️' },
                                            { id: 'count', label: 'Count', icon: '#️⃣' },
                                            { id: 'question', label: 'Ask Question', icon: '❓' },
                                            { id: 'hand', label: 'Hand Tracking', icon: '✋' },
                                        ].map((mode) => (
                                            <button
                                                key={mode.id}
                                                onClick={() => setAnalysisMode(mode.id as any)}
                                                className={`px-3 py-2 rounded-lg text-[13px] transition-colors flex items-center gap-1.5 ${analysisMode === mode.id
                                                    ? 'bg-[#00bcd4] text-white'
                                                    : 'bg-white text-[#5f6368] hover:bg-[#e8eaed]'
                                                    }`}
                                            >
                                                <span>{mode.icon}</span>
                                                {mode.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Query Input (for count/question modes) */}
                                {(analysisMode === 'count' || analysisMode === 'question') && (
                                    <div className="bg-[#f8f9fa] rounded-xl p-4 border border-[#e8eaed]">
                                        <h3 className="text-[14px] font-medium text-[#1f1f1f] mb-2">
                                            {analysisMode === 'count' ? 'What to count?' : 'Your question'}
                                        </h3>
                                        <input
                                            type="text"
                                            value={roboticsQuery}
                                            onChange={(e) => setRoboticsQuery(e.target.value)}
                                            placeholder={analysisMode === 'count' ? 'e.g., people, cups, books...' : 'e.g., What should I move to make space?'}
                                            className="w-full px-3 py-2 border border-[#e8eaed] rounded-lg text-[14px] focus:outline-none focus:ring-2 focus:ring-[#00bcd4] focus:border-transparent"
                                        />
                                    </div>
                                )}

                                {/* Auto-Analysis Settings */}
                                <div className="bg-[#f8f9fa] rounded-xl p-4 border border-[#e8eaed]">
                                    <h3 className="text-[14px] font-medium text-[#1f1f1f] mb-2">
                                        Real-time Speed
                                        <span className="ml-2 text-[12px] text-[#00bcd4] font-normal">
                                            {analysisInterval <= 300 ? '⚡ Fast' : analysisInterval <= 1000 ? '🔄 Normal' : '🐢 Slow'}
                                        </span>
                                    </h3>
                                    <div className="flex items-center gap-3">
                                        <span className="text-[11px] text-[#5f6368]">Fast</span>
                                        <input
                                            type="range"
                                            min="100"
                                            max="3000"
                                            step="100"
                                            value={analysisInterval}
                                            onChange={(e) => {
                                                const newInterval = Number(e.target.value);
                                                setAnalysisInterval(newInterval);
                                                // Update running interval if auto-analyzing
                                                if (isAutoAnalyzing && autoAnalysisRef.current) {
                                                    clearInterval(autoAnalysisRef.current);
                                                    autoAnalysisRef.current = setInterval(runRoboticsAnalysis, newInterval);
                                                }
                                            }}
                                            className="flex-1 accent-[#00bcd4]"
                                        />
                                        <span className="text-[11px] text-[#5f6368]">Slow</span>
                                        <span className="text-[13px] text-[#5f6368] w-14 text-right">{analysisInterval}ms</span>
                                    </div>
                                </div>

                                {/* Results Panel */}
                                <div className="flex-1 bg-[#f8f9fa] rounded-xl p-4 border border-[#e8eaed] overflow-y-auto">
                                    <h3 className="text-[14px] font-medium text-[#1f1f1f] mb-3">Results</h3>

                                    {/* Count Result */}
                                    {countResult && (
                                        <div className="mb-4 p-3 bg-white rounded-lg border border-[#e8eaed]">
                                            <div className="text-[32px] font-bold text-[#00bcd4]">{countResult.count}</div>
                                            <div className="text-[13px] text-[#5f6368]">{roboticsQuery} found</div>
                                        </div>
                                    )}

                                    {/* Scene Description */}
                                    {sceneDescription && (
                                        <div className="mb-4 p-3 bg-white rounded-lg border border-[#e8eaed]">
                                            <p className="text-[14px] text-[#1f1f1f] leading-relaxed">{sceneDescription}</p>
                                        </div>
                                    )}

                                    {/* Classification Results */}
                                    {classificationResult && classificationResult.length > 0 && (
                                        <div className="space-y-2">
                                            {classificationResult.map((item, idx) => (
                                                <div key={idx} className="p-3 bg-white rounded-lg border border-[#e8eaed]">
                                                    <div className="font-medium text-[14px] text-[#1f1f1f]">{item.label}</div>
                                                    <div className="flex flex-wrap gap-1 mt-1">
                                                        {item.attributes.map((attr, i) => (
                                                            <span key={i} className="px-2 py-0.5 bg-[#e0f7fa] text-[#00838f] text-[11px] rounded-full">
                                                                {attr}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Detected Objects List */}
                                    {!classificationResult && detectedObjects.length > 0 && (
                                        <div className="space-y-1">
                                            {detectedObjects.map((obj, idx) => (
                                                <div key={idx} className="flex items-center justify-between p-2 bg-white rounded-lg border border-[#e8eaed]">
                                                    <span className="text-[14px] text-[#1f1f1f]">{obj.label}</span>
                                                    <span className="text-[12px] text-[#5f6368]">
                                                        ({Math.round(obj.point[1] / 10)}%, {Math.round(obj.point[0] / 10)}%)
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Bounding Boxes List */}
                                    {boundingBoxes.length > 0 && (
                                        <div className="space-y-1">
                                            {boundingBoxes.map((box, idx) => (
                                                <div key={idx} className="flex items-center gap-2 p-2 bg-white rounded-lg border border-[#e8eaed]">
                                                    <div
                                                        className="w-3 h-3 rounded"
                                                        style={{ backgroundColor: ['#ff5722', '#4caf50', '#2196f3', '#ff9800', '#9c27b0', '#00bcd4'][idx % 6] }}
                                                    />
                                                    <span className="text-[14px] text-[#1f1f1f]">{box.label}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Hand Tracking Info */}
                                    {analysisMode === 'hand' && (
                                        <div className="space-y-3">
                                            <div className="p-3 bg-gradient-to-r from-pink-50 to-cyan-50 rounded-lg border border-[#e8eaed]">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <Hand className="w-5 h-5 text-[#00bcd4]" />
                                                    <span className="font-medium text-[14px] text-[#1f1f1f]">Hand Skeleton Tracking</span>
                                                </div>
                                                <div className={`text-[13px] ${handLandmarks ? 'text-green-600' : 'text-yellow-600'}`}>
                                                    {handLandmarks ? '✓ Hand detected with 21 landmarks' : '⏳ Waiting for hand...'}
                                                </div>
                                            </div>

                                            {handLandmarks && (
                                                <>
                                                    <div className="p-3 bg-white rounded-lg border border-[#e8eaed]">
                                                        <div className="text-[13px] font-medium text-[#1f1f1f] mb-2">Landmark Legend</div>
                                                        <div className="space-y-1.5 text-[12px]">
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-3 h-3 rounded-full bg-[#00bcd4]"></div>
                                                                <span className="text-[#5f6368]">Wrist (base)</span>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-3 h-3 rounded-full bg-[#ff4081]"></div>
                                                                <span className="text-[#5f6368]">Fingertips</span>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-3 h-3 rounded-full bg-[#00ff88]"></div>
                                                                <span className="text-[#5f6368]">Joints</span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="p-3 bg-white rounded-lg border border-[#e8eaed]">
                                                        <div className="text-[13px] font-medium text-[#1f1f1f] mb-2">Fingertip Positions</div>
                                                        <div className="space-y-1 text-[12px]">
                                                            {[
                                                                { idx: 4, name: 'Thumb' },
                                                                { idx: 8, name: 'Index' },
                                                                { idx: 12, name: 'Middle' },
                                                                { idx: 16, name: 'Ring' },
                                                                { idx: 20, name: 'Pinky' },
                                                            ].map(({ idx, name }) => {
                                                                const landmark = handLandmarks[idx];
                                                                if (!landmark) return null;
                                                                return (
                                                                    <div key={idx} className="flex justify-between">
                                                                        <span className="text-[#5f6368]">{name}</span>
                                                                        <span className="text-[#1f1f1f] font-mono">
                                                                            x:{Math.round((1 - landmark.x) * 100)}% y:{Math.round(landmark.y * 100)}%
                                                                        </span>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    )}

                                    {/* Empty State */}
                                    {!countResult && !sceneDescription && !classificationResult && detectedObjects.length === 0 && boundingBoxes.length === 0 && analysisMode !== 'hand' && (
                                        <p className="text-[14px] text-[#9aa0a6] text-center py-4">
                                            {isWebcamActive ? 'Click "Analyze Frame" to detect objects' : 'Start webcam to begin'}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                );

            case 'image-activity':
                return (
                    <div className="flex flex-col h-full bg-white p-8 overflow-y-auto">
                        <div className="max-w-4xl mx-auto w-full space-y-8">
                            {/* Header */}
                            <div className="text-center space-y-4">
                                <div className="w-16 h-16 bg-orange-100 rounded-2xl flex items-center justify-center mx-auto">
                                    <ImageActivityIcon active={true} />
                                </div>
                                <h2 className="text-3xl font-google-sans text-[#1f1f1f]">AI Image Studio</h2>
                                <p className="text-[#444746] text-lg max-w-2xl mx-auto">
                                    Describe any concept, scene, or diagram, and AI will generate a high-quality educational illustration for you.
                                </p>
                            </div>

                            {/* Input Section */}
                            <div className="bg-[#f8f9fa] p-6 rounded-2xl border border-[#e8eaed] shadow-sm">
                                <div className="flex flex-col gap-4">
                                    <label htmlFor="image-prompt" className="text-sm font-medium text-[#1f1f1f] ml-1">
                                        What would you like to visualize?
                                    </label>
                                    <div className="flex gap-3">
                                        <input
                                            id="image-prompt"
                                            type="text"
                                            value={imageActivityPrompt}
                                            onChange={(e) => setImageActivityPrompt(e.target.value)}
                                            placeholder="e.g., A cross-section of a plant cell showing chloroplasts..."
                                            className="flex-1 px-4 py-3 rounded-xl border border-[#dadce0] focus:border-[#ff8b66] focus:ring-2 focus:ring-[#ff8b66]/20 outline-none transition-all text-[#1f1f1f]"
                                            onKeyDown={(e) => e.key === 'Enter' && handleGenerateImageActivity()}
                                        />
                                        <button
                                            onClick={handleGenerateImageActivity}
                                            disabled={!imageActivityPrompt.trim() || isGeneratingImageActivity}
                                            className="px-6 py-3 bg-[#ff8b66] hover:bg-[#ff7d4d] disabled:bg-[#ffdccf] disabled:cursor-not-allowed text-white rounded-xl font-medium transition-all shadow-sm flex items-center gap-2 min-w-[160px] justify-center"
                                        >
                                            {isGeneratingImageActivity ? (
                                                <>
                                                    <Loader2 className="w-5 h-5 animate-spin" />
                                                    <span>Creating...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Sparkles className="w-5 h-5" />
                                                    <span>Generate</span>
                                                </>
                                            )}
                                        </button>
                                    </div>
                                    <p className="text-xs text-[#5f6368] ml-1">
                                        Tip: Be specific about details, colors, and style for the best results.
                                    </p>
                                </div>
                            </div>

                            {/* Result Display */}
                            {generatedImageActivityUrl && (
                                <div className="animate-fade-in space-y-4">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-lg font-medium text-[#1f1f1f]">Generated Result</h3>
                                        <button
                                            onClick={() => {
                                                const link = document.createElement('a');
                                                link.href = generatedImageActivityUrl;
                                                link.download = `ai-generated-${Date.now()}.png`;
                                                link.click();
                                            }}
                                            className="text-[#1a73e8] hover:bg-[#e8f0fe] px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                                        >
                                            Download Image
                                        </button>
                                    </div>
                                    <div className="aspect-video w-full bg-gray-100 rounded-2xl overflow-hidden border border-[#e8eaed] shadow-md group relative">
                                        <img
                                            src={generatedImageActivityUrl}
                                            alt="AI Generated"
                                            className="w-full h-full object-contain"
                                        />
                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors pointer-events-none" />
                                    </div>
                                </div>
                            )}

                            {/* Empty State / Placeholder */}
                            {!generatedImageActivityUrl && !isGeneratingImageActivity && (
                                <div className="border-2 border-dashed border-[#e8eaed] rounded-2xl p-12 flex flex-col items-center justify-center text-center text-[#9aa0a6]">
                                    <div className="w-16 h-16 bg-[#f1f3f4] rounded-full flex items-center justify-center mb-4">
                                        <ImageIcon className="w-8 h-8 text-[#bdc1c6]" />
                                    </div>
                                    <p>Your generated image will appear here</p>
                                </div>
                            )}

                            {/* Loading State Placeholder */}
                            {isGeneratingImageActivity && !generatedImageActivityUrl && (
                                <div className="aspect-video w-full bg-[#f8f9fa] rounded-2xl border border-[#e8eaed] flex flex-col items-center justify-center animate-pulse">
                                    <Loader2 className="w-12 h-12 text-[#ff8b66] animate-spin mb-4" />
                                    <p className="text-[#5f6368] font-medium">AI is crafting your image...</p>
                                    <p className="text-xs text-[#9aa0a6] mt-2">This usually takes 5-10 seconds</p>
                                </div>
                            )}
                        </div>
                    </div>
                );

            case 'viewer3d':
                return (
                    <div className="flex flex-col h-full bg-white p-6">
                        {/* Header */}
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-[#ede9fe] rounded-full flex items-center justify-center">
                                    <Viewer3DIcon active />
                                </div>
                                <div>
                                    <h2 className="text-[18px] font-medium text-[#1f1f1f]">3D Object Viewer</h2>
                                    <p className="text-[13px] text-[#5f6368]">Hand gesture controls for 3D models</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {/* Voice Command Toggle */}
                                <button
                                    onClick={() => setViewer3dVoiceActive(!viewer3dVoiceActive)}
                                    className={`p-2 rounded-lg transition-colors flex items-center gap-1.5 ${viewer3dVoiceActive
                                        ? 'bg-red-500 text-white'
                                        : 'bg-[#f1f3f4] text-[#5f6368] hover:bg-[#e8eaed]'
                                        }`}
                                    title={viewer3dVoiceActive ? 'Stop Voice Commands' : 'Start Voice Commands'}
                                >
                                    <Mic className="w-4 h-4" />
                                    {viewer3dVoiceActive && <span className="text-[11px]">Listening...</span>}
                                </button>
                                {/* Interaction Mode Selector */}
                                <div className="flex bg-[#f1f3f4] rounded-lg p-1">
                                    {(['drag', 'rotate', 'scale', 'animate'] as const).map(mode => (
                                        <button
                                            key={mode}
                                            onClick={() => setViewer3dInteractionMode(mode)}
                                            className={`px-3 py-1.5 text-[12px] font-medium rounded-md transition-colors ${viewer3dInteractionMode === mode
                                                ? 'text-white'
                                                : 'text-[#5f6368] hover:bg-[#e8eaed]'
                                                }`}
                                            style={{
                                                backgroundColor: viewer3dInteractionMode === mode ? getModeColor(mode) : undefined
                                            }}
                                        >
                                            {mode.charAt(0).toUpperCase() + mode.slice(1)}
                                        </button>
                                    ))}
                                </div>
                                <button
                                    onClick={() => {
                                        setViewer3dRotation({ x: 0, y: 0, z: 0 });
                                        setViewer3dPosition({ x: 0, y: 0, z: 0 });
                                        setViewer3dScale(1);
                                    }}
                                    className="px-3 py-1.5 text-[13px] text-[#5f6368] hover:bg-[#f1f3f4] rounded-lg transition-colors flex items-center gap-1.5"
                                >
                                    <RefreshCw className="w-4 h-4" />
                                    Reset
                                </button>
                            </div>
                        </div>

                        {/* Voice Command Transcript */}
                        {viewer3dVoiceActive && viewer3dVoiceTranscript && (
                            <div className="mb-2 px-3 py-1.5 bg-[#ede9fe] rounded-lg text-[13px] text-[#7c3aed] flex items-center gap-2">
                                <Mic className="w-4 h-4" />
                                <span>"{viewer3dVoiceTranscript}"</span>
                            </div>
                        )}

                        {/* Main Content - Split View */}
                        <div className="flex-1 min-h-0 flex gap-4">
                            {/* Left: 3D Viewer */}
                            <div
                                className={`flex-[2] min-h-0 relative rounded-xl border-2 overflow-hidden bg-gradient-to-br from-gray-900 to-gray-800 transition-colors ${viewer3dIsDraggingFile ? 'border-[#7c3aed] border-dashed' : 'border-[#e8eaed]'
                                    }`}
                                onDragOver={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setViewer3dIsDraggingFile(true);
                                }}
                                onDragLeave={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setViewer3dIsDraggingFile(false);
                                }}
                                onDrop={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setViewer3dIsDraggingFile(false);

                                    const files = e.dataTransfer.files;
                                    if (files.length > 0) {
                                        const file = files[0];
                                        const ext = file.name.split('.').pop()?.toLowerCase();
                                        if (ext === 'glb' || ext === 'gltf') {
                                            const url = URL.createObjectURL(file);
                                            setViewer3dModelUrl(url);
                                            setViewer3dModelName(file.name);
                                        } else {
                                            alert('Please drop a GLB or GLTF file');
                                        }
                                    }
                                }}
                            >
                                {/* Drag overlay */}
                                {viewer3dIsDraggingFile && (
                                    <div className="absolute inset-0 bg-[#7c3aed]/20 flex items-center justify-center z-50 pointer-events-none">
                                        <div className="text-center">
                                            <Upload className="w-16 h-16 text-[#7c3aed] mx-auto mb-4" />
                                            <p className="text-white text-lg font-medium">Drop GLB/GLTF file here</p>
                                        </div>
                                    </div>
                                )}

                                {!viewer3dModelUrl ? (
                                    <div className="flex items-center justify-center h-full">
                                        <div className="text-center max-w-md px-6">
                                            <div className="w-20 h-20 mx-auto mb-6 bg-white/10 rounded-2xl flex items-center justify-center">
                                                <Box className="w-10 h-10 text-[#7c3aed]" />
                                            </div>
                                            <h3 className="text-[22px] font-medium text-white mb-3">Load a 3D Model</h3>
                                            <p className="text-[15px] text-gray-400 mb-6">
                                                Drag & drop a GLB/GLTF file, upload from your computer, or try a demo shape to interact with using hand gestures.
                                            </p>
                                            <div className="flex flex-col gap-3">
                                                <input
                                                    ref={viewer3dFileInputRef}
                                                    type="file"
                                                    accept=".glb,.gltf"
                                                    className="hidden"
                                                    onChange={(e) => {
                                                        const file = e.target.files?.[0];
                                                        if (file) {
                                                            const url = URL.createObjectURL(file);
                                                            setViewer3dModelUrl(url);
                                                            setViewer3dModelName(file.name);
                                                        }
                                                    }}
                                                />
                                                <button
                                                    onClick={() => viewer3dFileInputRef.current?.click()}
                                                    className="px-6 py-3 bg-[#7c3aed] hover:bg-[#6d28d9] text-white rounded-full font-medium transition-colors flex items-center gap-2 mx-auto shadow-lg hover:shadow-xl"
                                                >
                                                    <Upload className="w-5 h-5" />
                                                    Upload 3D Model (GLB/GLTF)
                                                </button>
                                                {/* Quick Load Demo Shapes */}
                                                <div className="flex flex-wrap gap-2 justify-center mt-2">
                                                    {[
                                                        { name: 'Demo Cube', shape: 'cube' },
                                                        { name: 'Demo Sphere', shape: 'sphere' },
                                                        { name: 'Demo Torus', shape: 'torus' },
                                                        { name: 'Demo Pyramid', shape: 'pyramid' },
                                                    ].map(shape => (
                                                        <button
                                                            key={shape.shape}
                                                            onClick={() => {
                                                                // Use built-in demo shape (handled by viewer)
                                                                setViewer3dModelUrl(`demo:${shape.shape}`);
                                                                setViewer3dModelName(shape.name);
                                                            }}
                                                            className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-[12px] rounded-full transition-colors"
                                                        >
                                                            {shape.name}
                                                        </button>
                                                    ))}
                                                </div>
                                                <p className="text-[12px] text-gray-500 mt-2">
                                                    Or drag and drop a .glb or .gltf file anywhere on this viewer
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="relative w-full h-full">
                                        {/* 3D Scene Container */}
                                        <div
                                            className="w-full h-full flex items-center justify-center"
                                            style={{ perspective: '1000px' }}
                                        >
                                            {/* CSS3D 3D Object with grabbing pulse effect */}
                                            <div
                                                style={{
                                                    width: '200px',
                                                    height: '200px',
                                                    transformStyle: 'preserve-3d',
                                                    transform: `
                                                        translateX(${viewer3dPosition.x}px)
                                                        translateY(${viewer3dPosition.y}px)
                                                        scale(${viewer3dScale * (viewer3dIsGrabbing ? (1 + Math.sin(viewer3dGrabPulse * Math.PI / 180) * 0.03) : 1)})
                                                        rotateX(${viewer3dRotation.x}deg)
                                                        rotateY(${viewer3dRotation.y}deg)
                                                        rotateZ(${viewer3dRotation.z}deg)
                                                    `,
                                                    transition: viewer3dIsGrabbing ? 'none' : 'transform 0.05s ease-out',
                                                    filter: viewer3dIsGrabbing ? `drop-shadow(0 0 20px ${getModeColor(viewer3dInteractionMode)})` : 'none',
                                                }}
                                            >
                                                {/* Render different shapes based on model URL */}
                                                {viewer3dModelUrl?.startsWith('demo:sphere') ? (
                                                    // Sphere (using gradient circle)
                                                    <div
                                                        style={{
                                                            width: '200px',
                                                            height: '200px',
                                                            borderRadius: '50%',
                                                            background: 'radial-gradient(circle at 30% 30%, #a78bfa, #7c3aed 50%, #4c1d95 100%)',
                                                            boxShadow: 'inset -20px -20px 40px rgba(0,0,0,0.3), 10px 10px 30px rgba(0,0,0,0.5)',
                                                        }}
                                                    />
                                                ) : viewer3dModelUrl?.startsWith('demo:torus') ? (
                                                    // Torus (simplified ring)
                                                    <div
                                                        style={{
                                                            width: '200px',
                                                            height: '200px',
                                                            borderRadius: '50%',
                                                            border: '40px solid #ec4899',
                                                            boxShadow: 'inset 0 0 30px rgba(0,0,0,0.5), 10px 10px 30px rgba(0,0,0,0.3)',
                                                            background: 'transparent',
                                                        }}
                                                    />
                                                ) : viewer3dModelUrl?.startsWith('demo:pyramid') ? (
                                                    // Pyramid (using CSS triangles)
                                                    <div style={{ transformStyle: 'preserve-3d', width: '200px', height: '200px', position: 'relative' }}>
                                                        {/* Base */}
                                                        <div style={{
                                                            position: 'absolute',
                                                            width: '140px',
                                                            height: '140px',
                                                            background: 'rgba(59, 130, 246, 0.8)',
                                                            transform: 'translateX(30px) translateY(100px) rotateX(90deg)',
                                                        }} />
                                                        {/* Front face */}
                                                        <div style={{
                                                            position: 'absolute',
                                                            width: 0,
                                                            height: 0,
                                                            borderLeft: '70px solid transparent',
                                                            borderRight: '70px solid transparent',
                                                            borderBottom: '120px solid rgba(124, 58, 237, 0.8)',
                                                            transform: 'translateX(30px) translateY(-10px)',
                                                        }} />
                                                        {/* Back face */}
                                                        <div style={{
                                                            position: 'absolute',
                                                            width: 0,
                                                            height: 0,
                                                            borderLeft: '70px solid transparent',
                                                            borderRight: '70px solid transparent',
                                                            borderBottom: '120px solid rgba(124, 58, 237, 0.6)',
                                                            transform: 'translateX(30px) translateY(-10px) rotateY(180deg) translateZ(140px)',
                                                        }} />
                                                    </div>
                                                ) : (
                                                    // Default Cube
                                                    <>
                                                        {/* Cube Faces for Demo */}
                                                        {[
                                                            { transform: 'translateZ(100px)', bg: `rgba(${viewer3dInteractionMode === 'drag' ? '0,255,255' : viewer3dInteractionMode === 'rotate' ? '255,0,255' : viewer3dInteractionMode === 'scale' ? '255,255,0' : '255,165,0'}, 0.8)`, label: 'Front' },
                                                            { transform: 'translateZ(-100px) rotateY(180deg)', bg: 'rgba(124, 58, 237, 0.6)', label: 'Back' },
                                                            { transform: 'translateX(100px) rotateY(90deg)', bg: 'rgba(236, 72, 153, 0.8)', label: 'Right' },
                                                            { transform: 'translateX(-100px) rotateY(-90deg)', bg: 'rgba(236, 72, 153, 0.6)', label: 'Left' },
                                                            { transform: 'translateY(-100px) rotateX(90deg)', bg: 'rgba(59, 130, 246, 0.8)', label: 'Top' },
                                                            { transform: 'translateY(100px) rotateX(-90deg)', bg: 'rgba(59, 130, 246, 0.6)', label: 'Bottom' },
                                                        ].map((face, idx) => (
                                                            <div
                                                                key={idx}
                                                                className="absolute flex items-center justify-center text-white font-bold text-lg border-2 border-white/30"
                                                                style={{
                                                                    width: '200px',
                                                                    height: '200px',
                                                                    transform: face.transform,
                                                                    background: face.bg,
                                                                    backfaceVisibility: 'visible',
                                                                }}
                                                            >
                                                                {face.label}
                                                            </div>
                                                        ))}
                                                    </>
                                                )}
                                            </div>
                                        </div>

                                        {/* Mode indicator */}
                                        <div
                                            className="absolute top-4 right-16 px-3 py-1.5 rounded-full text-white text-[12px] font-medium flex items-center gap-2"
                                            style={{ backgroundColor: getModeColor(viewer3dInteractionMode) }}
                                        >
                                            {viewer3dInteractionMode === 'drag' && <Move className="w-4 h-4" />}
                                            {viewer3dInteractionMode === 'rotate' && <RefreshCw className="w-4 h-4" />}
                                            {viewer3dInteractionMode === 'scale' && <Maximize2 className="w-4 h-4" />}
                                            {viewer3dInteractionMode === 'animate' && <Film className="w-4 h-4" />}
                                            {viewer3dInteractionMode.charAt(0).toUpperCase() + viewer3dInteractionMode.slice(1)} Mode
                                        </div>

                                        {/* Animation Index (for animate mode) */}
                                        {viewer3dInteractionMode === 'animate' && (
                                            <div className="absolute top-14 right-16 px-3 py-1.5 bg-black/50 rounded-full text-white text-[12px]">
                                                Animation: {viewer3dAnimationIndex + 1}/6
                                            </div>
                                        )}

                                        {/* Model Name Badge */}
                                        <div className="absolute top-4 left-4 px-3 py-1.5 bg-black/50 rounded-full text-white text-[13px] flex items-center gap-2">
                                            <Atom className="w-4 h-4 text-[#7c3aed]" />
                                            {viewer3dModelName}
                                        </div>

                                        {/* Close Model Button */}
                                        <button
                                            onClick={() => {
                                                setViewer3dModelUrl(null);
                                                setViewer3dModelName('');
                                                setViewer3dRotation({ x: 0, y: 0, z: 0 });
                                                setViewer3dPosition({ x: 0, y: 0, z: 0 });
                                                setViewer3dScale(1);
                                                setViewer3dAnimationIndex(0);
                                            }}
                                            className="absolute top-4 right-4 p-2 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>

                                        {/* Transform Info */}
                                        <div className="absolute bottom-4 left-4 px-3 py-2 bg-black/50 rounded-lg text-white text-[11px] font-mono">
                                            <div>Rotation: X:{Math.round(viewer3dRotation.x)}° Y:{Math.round(viewer3dRotation.y)}° Z:{Math.round(viewer3dRotation.z)}°</div>
                                            <div>Position: X:{Math.round(viewer3dPosition.x)} Y:{Math.round(viewer3dPosition.y)}</div>
                                            <div>Scale: {viewer3dScale.toFixed(2)}x</div>
                                            {viewer3dIsGrabbing && <div className="text-[#00ff88]">● Grabbing</div>}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Right: Hand Tracking Panel */}
                            <div className="w-[350px] min-h-0 flex flex-col gap-4">
                                {/* Webcam View */}
                                <div className="relative rounded-xl border border-[#e8eaed] overflow-hidden bg-black" style={{ height: '250px' }}>
                                    {!viewer3dWebcamActive ? (
                                        <div className="flex items-center justify-center h-full bg-gradient-to-br from-[#ede9fe] to-[#ddd6fe]">
                                            <div className="text-center px-4">
                                                <Hand className="w-10 h-10 mx-auto mb-3 text-[#7c3aed]" />
                                                <p className="text-[14px] text-[#5f6368] mb-3">Enable hand tracking for gesture controls</p>
                                                <button
                                                    onClick={async () => {
                                                        try {
                                                            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                                                            setViewer3dWebcamStream(stream);
                                                            setViewer3dWebcamActive(true);
                                                        } catch (err) {
                                                            console.error('Webcam error:', err);
                                                        }
                                                    }}
                                                    className="px-4 py-2 bg-[#7c3aed] hover:bg-[#6d28d9] text-white rounded-full text-[13px] font-medium transition-colors flex items-center gap-2 mx-auto"
                                                >
                                                    <Play className="w-4 h-4" />
                                                    Start Hand Tracking
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <video
                                                ref={viewer3dVideoRef}
                                                className="w-full h-full object-cover"
                                                autoPlay
                                                playsInline
                                                muted
                                                style={{ transform: 'scaleX(-1)' }}
                                            />
                                            {/* Hand Overlay */}
                                            <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ transform: 'scaleX(-1)' }}>
                                                {viewer3dHandLandmarks.map((hand, handIdx) => (
                                                    <g key={handIdx}>
                                                        {/* Draw connections */}
                                                        {HAND_CONNECTIONS.map(([start, end], idx) => {
                                                            const startPoint = hand[start];
                                                            const endPoint = hand[end];
                                                            if (!startPoint || !endPoint) return null;
                                                            return (
                                                                <line
                                                                    key={`conn-${handIdx}-${idx}`}
                                                                    x1={`${startPoint.x * 100}%`}
                                                                    y1={`${startPoint.y * 100}%`}
                                                                    x2={`${endPoint.x * 100}%`}
                                                                    y2={`${endPoint.y * 100}%`}
                                                                    stroke={handIdx === 0 ? '#00ff88' : '#ff8800'}
                                                                    strokeWidth="2"
                                                                    strokeLinecap="round"
                                                                />
                                                            );
                                                        })}
                                                        {/* Draw landmarks */}
                                                        {hand.map((lm, idx) => (
                                                            <circle
                                                                key={`lm-${handIdx}-${idx}`}
                                                                cx={`${lm.x * 100}%`}
                                                                cy={`${lm.y * 100}%`}
                                                                r={idx === 4 || idx === 8 ? 6 : 4}
                                                                fill={idx === 4 || idx === 8 ? '#ff4081' : (handIdx === 0 ? '#00ff88' : '#ff8800')}
                                                            />
                                                        ))}
                                                        {/* Pinch indicator */}
                                                        {viewer3dIsPinching[handIdx] && hand[4] && hand[8] && (
                                                            <circle
                                                                cx={`${((hand[4].x + hand[8].x) / 2) * 100}%`}
                                                                cy={`${((hand[4].y + hand[8].y) / 2) * 100}%`}
                                                                r="15"
                                                                fill="none"
                                                                stroke="#ffff00"
                                                                strokeWidth="3"
                                                                className="animate-pulse"
                                                            />
                                                        )}
                                                    </g>
                                                ))}
                                            </svg>
                                            {/* Stop Button */}
                                            <button
                                                onClick={() => {
                                                    if (viewer3dWebcamStream) {
                                                        viewer3dWebcamStream.getTracks().forEach(t => t.stop());
                                                    }
                                                    setViewer3dWebcamActive(false);
                                                    setViewer3dWebcamStream(null);
                                                    setViewer3dHandLandmarks([]);
                                                }}
                                                className="absolute top-2 right-2 p-1.5 bg-red-500 hover:bg-red-600 rounded-full text-white transition-colors"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </>
                                    )}
                                </div>

                                {/* Gesture Guide */}
                                <div className="p-4 bg-[#f8f9fa] rounded-xl border border-[#e8eaed]">
                                    <h3 className="text-[14px] font-medium text-[#1f1f1f] mb-3">Gesture Controls</h3>
                                    <div className="space-y-2">
                                        <div
                                            className={`p-2 rounded-lg border-2 transition-colors cursor-pointer ${viewer3dInteractionMode === 'drag' ? 'border-[#00FFFF] bg-[#00FFFF]/10' : 'border-[#e8eaed] bg-white hover:bg-gray-50'}`}
                                            onClick={() => setViewer3dInteractionMode('drag')}
                                        >
                                            <div className="flex items-center gap-2">
                                                <div className="w-5 h-5 bg-[#00FFFF] rounded-full flex items-center justify-center">
                                                    <Move className="w-3 h-3 text-black" />
                                                </div>
                                                <span className="text-[12px] font-medium text-[#1f1f1f]">Drag</span>
                                                <span className="text-[10px] text-[#9aa0a6] ml-auto">Pinch + move</span>
                                            </div>
                                        </div>
                                        <div
                                            className={`p-2 rounded-lg border-2 transition-colors cursor-pointer ${viewer3dInteractionMode === 'rotate' ? 'border-[#FF00FF] bg-[#FF00FF]/10' : 'border-[#e8eaed] bg-white hover:bg-gray-50'}`}
                                            onClick={() => setViewer3dInteractionMode('rotate')}
                                        >
                                            <div className="flex items-center gap-2">
                                                <div className="w-5 h-5 bg-[#FF00FF] rounded-full flex items-center justify-center">
                                                    <RefreshCw className="w-3 h-3 text-white" />
                                                </div>
                                                <span className="text-[12px] font-medium text-[#1f1f1f]">Rotate</span>
                                                <span className="text-[10px] text-[#9aa0a6] ml-auto">Pinch + slide L/R</span>
                                            </div>
                                        </div>
                                        <div
                                            className={`p-2 rounded-lg border-2 transition-colors cursor-pointer ${viewer3dInteractionMode === 'scale' ? 'border-[#FFFF00] bg-[#FFFF00]/10' : 'border-[#e8eaed] bg-white hover:bg-gray-50'}`}
                                            onClick={() => setViewer3dInteractionMode('scale')}
                                        >
                                            <div className="flex items-center gap-2">
                                                <div className="w-5 h-5 bg-[#FFFF00] rounded-full flex items-center justify-center">
                                                    <Maximize2 className="w-3 h-3 text-black" />
                                                </div>
                                                <span className="text-[12px] font-medium text-[#1f1f1f]">Scale</span>
                                                <span className="text-[10px] text-[#9aa0a6] ml-auto">2 hands pinch</span>
                                            </div>
                                        </div>
                                        <div
                                            className={`p-2 rounded-lg border-2 transition-colors cursor-pointer ${viewer3dInteractionMode === 'animate' ? 'border-[#FFA500] bg-[#FFA500]/10' : 'border-[#e8eaed] bg-white hover:bg-gray-50'}`}
                                            onClick={() => setViewer3dInteractionMode('animate')}
                                        >
                                            <div className="flex items-center gap-2">
                                                <div className="w-5 h-5 bg-[#FFA500] rounded-full flex items-center justify-center">
                                                    <Film className="w-3 h-3 text-white" />
                                                </div>
                                                <span className="text-[12px] font-medium text-[#1f1f1f]">Animate</span>
                                                <span className="text-[10px] text-[#9aa0a6] ml-auto">Pinch + U/D</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Voice Commands Info */}
                                    <div className="mt-3 pt-3 border-t border-[#e8eaed]">
                                        <div className="flex items-center gap-2 text-[11px] text-[#5f6368]">
                                            <Mic className="w-3 h-3" />
                                            <span>Say "drag", "rotate", "scale", "animate", or "reset"</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Status */}
                                <div className="p-4 bg-white rounded-xl border border-[#e8eaed]">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-[13px] text-[#5f6368]">Hand Tracking</span>
                                        <span className={`text-[12px] font-medium ${viewer3dWebcamActive ? 'text-green-500' : 'text-[#9aa0a6]'}`}>
                                            {viewer3dWebcamActive ? 'Active' : 'Inactive'}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-[13px] text-[#5f6368]">Hands Detected</span>
                                        <span className="text-[12px] font-medium text-[#1f1f1f]">{viewer3dHandLandmarks.length}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-[13px] text-[#5f6368]">Pinching</span>
                                        <div className="flex gap-2">
                                            <span className={`px-2 py-0.5 rounded text-[11px] ${viewer3dIsPinching[0] ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>L</span>
                                            <span className={`px-2 py-0.5 rounded text-[11px] ${viewer3dIsPinching[1] ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>R</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                );

            case 'code-lab':
                return <CodeLabView />;

            case 'assignment':
                return <InteractiveAssignmentWorkspace />;

            case 'latex-assignment':
                return <LaTeXAssignmentPrep />;

            default:
                return null;
        }
    };

    return (
        <div ref={containerRef} className="fixed inset-0 z-50 bg-[#0b0d12] text-slate-100 flex flex-col" style={{ fontFamily: '"Google Sans", Roboto, Arial, sans-serif' }}>
            {/* Laser Cursor for Hand Tracking */}
            <LaserCursor
                handPosition={handPosition}
                isActive={isHandTrackingActive}
                videoElement={handTrackingVideoElement}
                color="#ff3333"
                size={20}
                magnetRadius={80}
                magnetStrength={0.6}
            />

            {/* 3D Molecule Gesture Demo Modal */}
            {show3DMoleculeDemo && isHandTrackingActive && (
                <div className="fixed inset-0 z-[9000] bg-black/50 flex items-center justify-center p-8">
                    <div className="w-full max-w-4xl">
                        <HandControlled3DMolecule
                            handPosition={handPosition}
                            isHandTrackingActive={isHandTrackingActive}
                            moleculeName="Methanol (Demo)"
                            moleculeCid="887"
                            onClose={() => setShow3DMoleculeDemo(false)}
                        />
                    </div>
                </div>
            )}

            {/* Floating Quiz Panel */}
            {openFloatingQuiz !== null && (
                <FloatingQuizPanel
                    paragraphIndex={openFloatingQuiz}
                    onClose={() => setOpenFloatingQuiz(null)}
                />
            )}

            {/* Top Header Bar */}
            <header className="bg-[#0f1117] h-[50px] px-5 flex items-center justify-between border-b border-[#1f2430]">
                {/* Left: Logo & Workspaces */}
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <span className="text-[22px] font-medium text-slate-100" style={{ fontFamily: '"Google Sans", sans-serif' }}>
                            Learn Your Way
                        </span>
                        <span className="text-[10px] text-slate-400 border border-slate-700 rounded px-1.5 py-0.5 uppercase tracking-wide font-medium">
                            Experiment
                        </span>
                    </div>
                    {/* My Workspaces Button */}
                    {immersiveContent && (
                        <button
                            onClick={() => {
                                setActiveMode('source');
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] text-slate-300 hover:bg-slate-800/60 rounded-lg transition-colors"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                            </svg>
                            My Workspaces
                        </button>
                    )}
                </div>

                {/* Center: Interest pill */}
                <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-1.5 bg-slate-800/70 rounded-full">
                    <span className="text-[14px] text-slate-300">Interest</span>
                    <span className="text-[14px]">🧪</span>
                    <span className="text-[14px] font-medium text-slate-100">Chemistry</span>
                </div>

                {/* Right: Icons */}
                <div className="flex items-center gap-1">
                    {/* 3D Molecule Demo Button - Only show when hand tracking is active */}
                    {isHandTrackingActive && (
                        <button
                            onClick={() => setShow3DMoleculeDemo(!show3DMoleculeDemo)}
                            className={`p-2 rounded-full transition-colors relative ${show3DMoleculeDemo
                                ? 'bg-purple-900/40 hover:bg-purple-900/60'
                                : 'hover:bg-slate-800/60'
                                }`}
                            title="3D Molecule Gesture Demo"
                        >
                            <Atom className={`w-5 h-5 ${show3DMoleculeDemo ? 'text-purple-300' : 'text-slate-300'}`} />
                        </button>
                    )}
                    {/* Hand Tracking Toggle Button */}
                    <button
                        onClick={toggleHandTracking}
                        className={`p-2 rounded-full transition-colors relative ${isHandTrackingActive
                            ? 'bg-red-900/40 hover:bg-red-900/60'
                            : 'hover:bg-slate-800/60'
                            }`}
                        title={isHandTrackingActive ? 'Disable Hand Tracking' : 'Enable Hand Tracking'}
                    >
                        <Hand className={`w-5 h-5 ${isHandTrackingActive ? 'text-red-400' : 'text-slate-300'}`} />
                        {isHandTrackingActive && (
                            <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                        )}
                    </button>
                    <button className="p-2 hover:bg-slate-800/60 rounded-full transition-colors">
                        <Mail className="w-5 h-5 text-slate-300" />
                    </button>
                    <button className="p-2 hover:bg-slate-800/60 rounded-full transition-colors">
                        <Info className="w-5 h-5 text-slate-300" />
                    </button>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-800/60 rounded-full transition-colors ml-1"
                    >
                        <X className="w-5 h-5 text-slate-300" />
                    </button>
                </div>
            </header>

            {/* Navigation Tabs */}
            <nav className="bg-[#0f1117] px-8 py-4 flex items-center justify-center gap-2 border-b border-[#1f2430]">
                {learningModes.map((mode) => {
                    const isActive = activeMode === mode.id;
                    return (
                        <button
                            key={mode.id}
                            onClick={() => setActiveMode(mode.id)}
                            className={`
                                flex flex-col items-center gap-1.5 px-5 py-2.5 rounded-[24px] transition-all duration-200
                                 ${isActive
                                     ? 'border-2'
                                     : 'border-2 border-transparent hover:bg-slate-800/60'
                                 }
                             `}
                             style={{
                                 backgroundColor: isActive ? mode.activeBg : 'transparent',
                                 borderColor: isActive ? '#fea481' : 'transparent'
                             }}
                         >
                            <div className="w-6 h-6 flex items-center justify-center">
                                {mode.icon}
                            </div>
                             <span
                                 className={`text-[13px] font-medium whitespace-nowrap`}
                                style={{ color: isActive ? mode.activeColor : '#e2e8f0' }}
                             >
                                 {mode.label}
                             </span>
                        </button>
                    );
                })}
            </nav>

            {/* Main Content Area - 3 Column Layout */}
            <div className="flex flex-1 overflow-hidden">
                {/* Left Sidebar - Table of Contents - Exact Google Style with LEFT BORDER */}
                {activeMode === 'immersive-text' && immersiveContent && (
                    <div className="w-[220px] bg-[#0f1117] border-r border-[#1f2430] py-6 overflow-y-auto flex-shrink-0">
                        <div className="space-y-0.5">
                            {immersiveContent.sections.map((section, idx) => {
                                const isActive = activeSectionId === section.id;
                                return (
                                    <div key={section.id}>
                                        <button
                                            onClick={() => {
                                                setActiveSectionId(section.id);
                                                setCurrentSectionIndex(idx);
                                            }}
                                            className={`
                                                w-full flex items-center gap-3 pl-6 pr-4 py-3 text-left transition-all duration-150
                                                 ${isActive
                                                     ? 'bg-[#1a1e27]'
                                                     : 'hover:bg-[#151924]'
                                                 }
                                             `}
                                         >
                                            {/* Checkbox indicator */}
                                            <div className={`
                                                 w-4 h-4 rounded-[4px] flex items-center justify-center flex-shrink-0 border transition-colors
                                                 ${isActive
                                                     ? 'border-slate-400 bg-transparent'
                                                     : 'border-slate-600 hover:border-slate-400'
                                                 }
                                             `}>
                                                 {/* Hidden checkmark for now, just the box style to match reference */}
                                             </div>
                                            <span className={`text-[14px] leading-snug ${isActive ? 'text-slate-100 font-medium' : 'text-slate-400'}`}>
                                                {section.title}
                                            </span>
                                        </button>

                                        {/* "Take quiz" dropdown under active section */}
                                        {isActive && (
                                            <div className="ml-[52px] mt-1 mb-2">
                                                 <button
                                                     onClick={scrollToQuiz}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-400 rounded-full text-[13px] font-medium text-slate-100 hover:bg-[#151924] transition-colors"
                                                 >
                                                     <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                                                        <rect x="3" y="4" width="10" height="8" rx="1" stroke="#e2e8f0" strokeWidth="1.5" />
                                                        <path d="M5 7h6M5 9h4" stroke="#e2e8f0" strokeWidth="1.2" strokeLinecap="round" />
                                                     </svg>
                                                     Take quiz
                                                     <ChevronDown className="w-3 h-3 ml-0.5" />
                                                 </button>
                                             </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {/* Background Loading Status */}
                        {(Object.values(loadingImages).some(v => v) || quiz.length === 0 || !mindMap) && (
                            <div className="px-6 py-4 border-t border-[#1f2430] mt-auto">
                                <div className="space-y-2">
                                    {Object.values(loadingImages).some(v => v) && (
                                        <div className="flex items-center gap-2 text-[12px] text-slate-400">
                                            <Loader2 className="w-3 h-3 animate-spin text-[#ff8b66]" />
                                            <span>Generating images...</span>
                                        </div>
                                    )}
                                    {quiz.length === 0 && (
                                        <div className="flex items-center gap-2 text-[12px] text-slate-400">
                                            <Loader2 className="w-3 h-3 animate-spin text-[#4285f4]" />
                                            <span>Creating quiz...</span>
                                        </div>
                                    )}
                                    {!mindMap && (
                                        <div className="flex items-center gap-2 text-[12px] text-slate-400">
                                            <Loader2 className="w-3 h-3 animate-spin text-[#34a853]" />
                                            <span>Building mind map...</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Main Content Card */}
                <div className={`flex-1 ${activeMode === 'source'
                    ? 'bg-[#131314] overflow-hidden p-0'
                    : activeMode === 'mindmap'
                        ? 'bg-[#0b0d12] overflow-hidden p-0'
                        : activeMode === 'viewer3d' || activeMode === 'robotics'
                            ? 'bg-[#0b0d12] overflow-hidden p-4'
                            : 'bg-[#0b0d12] overflow-y-auto p-4'
                    }`}>
                    <div className={`${activeMode === 'source'
                        ? 'h-full'
                        : activeMode === 'mindmap'
                            ? 'h-full rounded-none shadow-none bg-[#0f1117]'
                            : activeMode === 'viewer3d' || activeMode === 'robotics'
                                ? 'h-full rounded-[24px] shadow-sm bg-[#0f1117]'
                                : 'min-h-full rounded-[24px] shadow-sm bg-[#0f1117]'
                        } overflow-hidden`}>
                        {renderContent()}
                    </div>
                </div>

                {/* Right Sidebar - PDF Viewer OR Grounding Source OR Quiz Panel */}
                {activeMode === 'immersive-text' && (activeSource ? (
                    /* Grounding Source Sidebar - Like Tutor Style */
                    <div className="w-[420px] bg-[#0f1117] border-l border-[#1f2430] overflow-hidden flex-shrink-0 flex flex-col" ref={quizRef}>
                        {/* Header */}
                        <div className="p-4 border-b border-[#1f2430] flex items-center justify-between bg-gradient-to-r from-slate-900 to-slate-800">
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                                    <Globe className="w-4 h-4 text-white" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <span className="text-[14px] font-medium text-slate-100 block truncate">{activeSource.title || 'Source'}</span>
                                    <span className="text-[11px] text-slate-400 truncate block">{new URL(activeSource.url).hostname}</span>
                                </div>
                            </div>
                            <button
                                onClick={() => {
                                    setActiveSource(null);
                                    setShowPdfSidebar(false);
                                }}
                                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-800/60 transition-colors"
                            >
                                <X className="w-5 h-5 text-slate-300" />
                            </button>
                        </div>

                        {/* Snippet Preview */}
                        {activeSource.snippet && (
                            <div className="p-4 border-b border-[#1f2430] bg-slate-900/60">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-[12px] font-medium text-slate-400 uppercase tracking-wide">Relevant excerpt</span>
                                    <button
                                        onClick={() => navigator.clipboard.writeText(activeSource.snippet || '')}
                                        className="p-1.5 hover:bg-slate-800 rounded-md transition-colors"
                                        title="Copy snippet"
                                    >
                                        <Copy className="w-3.5 h-3.5 text-slate-300" />
                                    </button>
                                </div>
                                <p className="text-[13px] text-slate-100 leading-relaxed bg-[#0b0d12] p-3 rounded-lg border border-[#1f2430] italic">
                                    "{activeSource.snippet}"
                                </p>
                            </div>
                        )}

                        {/* Source Preview iframe */}
                        <div className="flex-1 overflow-hidden bg-[#0b0d12]">
                            <iframe
                                src={activeSource.url}
                                className="w-full h-full border-0"
                                title="Source Preview"
                                sandbox="allow-scripts allow-same-origin"
                            />
                        </div>

                        {/* Footer with external link */}
                        <div className="p-3 border-t border-[#1f2430] bg-[#0f1117]">
                            <div className="flex items-center justify-between">
                                <button
                                    onClick={() => {
                                        setActiveSource(null);
                                        setShowPdfSidebar(false);
                                    }}
                                    className="px-4 py-2 text-[13px] font-medium text-slate-300 hover:bg-slate-800/60 rounded-lg transition-colors"
                                >
                                    Close
                                </button>
                                <a
                                    href={activeSource.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-4 py-2 text-[13px] font-medium text-blue-400 hover:bg-blue-900/30 rounded-lg transition-colors flex items-center gap-1.5"
                                >
                                    Open in new tab
                                    <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                            </div>
                        </div>
                    </div>
                ) : showPdfSidebar && pdfUrl ? (
                    /* PDF Citation Sidebar */
                    <div className="w-[420px] bg-[#0f1117] border-l border-[#1f2430] overflow-hidden flex-shrink-0 flex flex-col" ref={quizRef}>
                        {/* Header */}
                        <div className="p-4 border-b border-[#1f2430] flex items-center justify-between bg-gradient-to-r from-slate-900 to-slate-800">
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                                    <FileText className="w-4 h-4 text-white" />
                                </div>
                                <div>
                                    <span className="text-[14px] font-medium text-slate-100 block">Source Document</span>
                                    <span className="text-[11px] text-slate-400">
                                        {uploadedFileName} {activeCitation && `• Section ${activeCitation.pageNumber}`}
                                    </span>
                                </div>
                            </div>
                            <button
                                onClick={() => {
                                    setShowPdfSidebar(false);
                                    setActiveCitation(null);
                                }}
                                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-800/60 transition-colors"
                            >
                                <X className="w-5 h-5 text-slate-300" />
                            </button>
                        </div>

                        {/* PDF Viewer */}
                        <div className="flex-1 overflow-hidden bg-[#0b0d12]">
                            <iframe
                                src={`${pdfUrl}#page=${activeCitation?.pageNumber || 1}`}
                                className="w-full h-full border-0"
                                title="PDF Viewer"
                            />
                        </div>

                        {/* Footer with navigation */}
                        <div className="p-3 border-t border-[#1f2430] bg-[#0f1117]">
                            <div className="flex items-center justify-between">
                                <button
                                    onClick={() => setShowPdfSidebar(false)}
                                    className="px-4 py-2 text-[13px] font-medium text-blue-400 hover:bg-blue-900/30 rounded-lg transition-colors"
                                >
                                    Back to Quiz
                                </button>
                                <a
                                    href={pdfUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-4 py-2 text-[13px] font-medium text-slate-300 hover:bg-slate-800/60 rounded-lg transition-colors flex items-center gap-1.5"
                                >
                                    Open in new tab
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                    </svg>
                                </a>
                            </div>
                        </div>
                    </div>
                ) : null)}
            </div>

            {/* Message Dock - Fixed at bottom */}
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
                theme="dark"
                isLiveActive={geminiLiveState.connectionState === ConnectionState.CONNECTED}
                isListening={geminiLiveState.isListening}
                isSpeaking={geminiLiveState.isSpeaking}
                onDisconnect={() => geminiLiveState.disconnect()}
                onSparkleClick={() => {
                    if (geminiLiveState.connectionState === ConnectionState.CONNECTED) {
                        geminiLiveState.disconnect();
                    } else {
                        geminiLiveState.connect();
                    }
                }}
            />

            {/* Gemini Live Overlay - For Learning Canvas */}
            <GeminiLiveOverlay
                geminiLiveState={geminiLiveState}
                onExpandImage={handleCanvasImageExpand}
            />
        </div>
    );
};

export default ImmersiveLearning;
