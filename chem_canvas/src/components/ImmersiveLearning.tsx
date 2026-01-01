import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { flushSync } from 'react-dom';
import { X, Upload, FileUp, FileText, Loader2, Volume2, BookOpen, Play, Brain, ChevronLeft, ChevronRight, HelpCircle, CheckCircle2, Info, RefreshCw, Box, Mail, Sparkles, ChevronDown, Send, MessageCircle, Hand, Atom, Maximize2, Minimize2, Mic, Film, Move, Globe, ExternalLink, Copy, Image as ImageIcon, Lightbulb, Zap, Target, Award, Eye, EyeOff, Code2, Terminal as TerminalIcon, Save, RotateCcw, Download, Check, GitBranch } from 'lucide-react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import CodeMirror from '@uiw/react-codemirror';
import ReactFlow, {
    useNodesState,
    useEdgesState,
    Controls,
    Background,
    Node,
    Edge,
    Position,
    MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { autocompletion, closeBrackets } from '@codemirror/autocomplete';
import { python } from '@codemirror/lang-python';
import SrlCoachWorkspace from './SrlCoachWorkspace';
import { InteractiveAssignmentWorkspace } from './InteractiveAssignmentWorkspace';
import { LaTeXAssignmentPrep } from './LaTeXAssignmentPrep';
import { AssignmentDashboard } from './AssignmentDashboard';
import { FormulaExtractionWorkspace } from './FormulaExtractionWorkspace';
import { LabManualExplorer } from './LabManualExplorer';
import ChatTutorWorkspace from './ChatTutorWorkspace';
import ChartJsDataPlotter from './ChartJsDataPlotter';
import FlashcardsQuizletWorkspace from './FlashcardsQuizletWorkspace';
import { HyperbookNotebook } from '@/hyperbook/components/HyperbookNotebook';
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
import { getCurrentUserId } from '../services/database/userService';
import { useSourceStore } from '../store/sourceStore';
import { extractTextFromPdf } from '../utils/pdfTextExtractor';
import { getPreferredGeminiLanguage } from '../utils/geminiPreferences';
import {
    putImmersiveLearningFile,
    getImmersiveLearningFile,
    deleteImmersiveLearningFile,
} from '../utils/immersiveLearningFileStore';
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
    extractDocumentContextForImage,
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
    ReactFlowData,
    BrainstormActivity,
    WhatIfActivity,
    EnhancedTermInfo
} from '../services/immersiveLearningService';
import { extractJsonBlock, fetchGroundingSources, generateTextContent, sendStudiumChatMessage } from '../services/geminiService';
import { generateStreamingContent } from '../services/geminiStreaming';
import { streamScienceTeacherChat, ScienceTeacherMessage, LearningMode as TeacherLearningMode, getLearningModeName, getLearningModeDescription } from '../services/scienceTeacherService';
import { selectLearningTheory, getLearningTheoryDisplayInfo, getFeynmanLiveConfig, LearningTheoryToTResponse, LearningTheoryType, FeynmanLiveConfig } from '../services/learningTheoriesService';
import ReactFlowMindMap from './ReactFlowMindMap';
import {
    generateNotebookSummary,
    generateNotebookMindmap,
    generateNotebookAudioScript,
    generateNotebookAudio,
    chatAboutNotebook,
    NotebookSummary,
    NotebookChatMessage,
    NotebookContent,
    createEmptyNotebookContent
} from '../services/notebookService';
import DrawIOWorkspace, { STORAGE_DIAGRAM_XML_KEY } from './DrawIOWorkspace';
import { LessonGeneratorActivity } from './LessonGeneratorActivity';
import { Reasoning } from './ai-elements/reasoning';
import {
    generateImmersivePlanTree,
    generateImmersiveContentWithToT,
    buildImmersiveTree,
    ImmersiveToTResponse,
    ImmersivePlanNode,
    ImmersivePlanNodeWithChildren
} from '../services/immersiveToTService';
import { SocraticLearningMode } from './SocraticLearningMode';
import { FeynmanLearningMode } from './FeynmanLearningMode';
import ReplicubeLab from './ReplicubeLab';

import { Badge } from './ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { AspectRatio, InteractiveLabel, EnhancedLabelInfo } from '../types/studium';
import { analyzeImageForLearning, generateEnhancedLabelInfo } from '../services/geminiService';

interface ImmersiveLearningProps {
    onClose: () => void;
    apiKey?: string;
    initialMode?: LearningMode;
}

type LearningMode = 'source' | 'immersive-text' | 'audio-video' | 'mindmap' | 'simulation' | 'robotics' | 'visual-activity' | 'code-lab' | 'replicube-lab' | 'assignment' | 'latex-assignment' | 'notebook' | 'learning-theories' | 'socratic' | 'feynman-enhanced' | 'pdf-study';

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
        <rect x="3" y="5" width="18" height="14" rx="2" fill={active ? "#ffffff" : "#9aa0a6"} fillOpacity={active ? "0.2" : "0.1"} stroke={active ? "#ffffff" : "#9aa0a6"} strokeWidth="1.5" />
        <rect x="6" y="8" width="12" height="1.5" rx="0.75" fill={active ? "#ffffff" : "#9aa0a6"} />
        <rect x="6" y="11" width="8" height="1.5" rx="0.75" fill={active ? "#ffffff" : "#9aa0a6"} />
        <circle cx="17" cy="15" r="3.5" fill={active ? "#ffffff" : "#9aa0a6"} fillOpacity={active ? "0.3" : "0.2"} stroke={active ? "#ffffff" : "#9aa0a6"} strokeWidth="1" />
        <text x="17" y="17" fontSize="5" fill={active ? "#ffffff" : "#9aa0a6"} textAnchor="middle" fontWeight="bold">?</text>
    </svg>
);

const SlidesIcon = ({ active }: { active?: boolean }) => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="4" y="6" width="16" height="12" rx="2" fill={active ? "#ffffff" : "#9aa0a6"} fillOpacity={active ? "0.2" : "0.1"} stroke={active ? "#ffffff" : "#9aa0a6"} strokeWidth="1.5" />
        <polygon points="10,10 10,14 14,12" fill={active ? "#ffffff" : "#9aa0a6"} />
    </svg>
);

const AudioIcon = ({ active }: { active?: boolean }) => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="5" y="8" width="2.5" height="8" rx="1" fill={active ? "#ffffff" : "#9aa0a6"} />
        <rect x="9" y="5" width="2.5" height="14" rx="1" fill={active ? "#ffffff" : "#9aa0a6"} />
        <rect x="13" y="9" width="2.5" height="6" rx="1" fill={active ? "#ffffff" : "#9aa0a6"} />
        <rect x="17" y="7" width="2.5" height="10" rx="1" fill={active ? "#ffffff" : "#9aa0a6"} />
    </svg>
);

const MindmapIcon = ({ active }: { active?: boolean }) => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="3" fill={active ? "#ffffff" : "#9aa0a6"} />
        <circle cx="5" cy="7" r="2" fill={active ? "#ffffff" : "#9aa0a6"} fillOpacity={active ? "0.8" : "0.6"} />
        <circle cx="19" cy="7" r="2" fill={active ? "#ffffff" : "#9aa0a6"} fillOpacity={active ? "0.8" : "0.6"} />
        <circle cx="5" cy="17" r="2" fill={active ? "#ffffff" : "#9aa0a6"} fillOpacity={active ? "0.8" : "0.6"} />
        <circle cx="19" cy="17" r="2" fill={active ? "#ffffff" : "#9aa0a6"} fillOpacity={active ? "0.8" : "0.6"} />
        <line x1="9" y1="10" x2="7" y2="8" stroke={active ? "#ffffff" : "#9aa0a6"} strokeWidth="1.5" />
        <line x1="15" y1="10" x2="17" y2="8" stroke={active ? "#ffffff" : "#9aa0a6"} strokeWidth="1.5" />
        <line x1="9" y1="14" x2="7" y2="16" stroke={active ? "#ffffff" : "#9aa0a6"} strokeWidth="1.5" />
        <line x1="15" y1="14" x2="17" y2="16" stroke={active ? "#ffffff" : "#9aa0a6"} strokeWidth="1.5" />
    </svg>
);

const SimulationIcon = ({ active }: { active?: boolean }) => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* 3D Cube */}
        <path d="M12 2L4 6V18L12 22L20 18V6L12 2Z" fill={active ? "#ffffff" : "#9aa0a6"} fillOpacity={active ? "0.3" : "0.1"} />
        <path d="M12 2L20 6L12 10L4 6L12 2Z" fill={active ? "#ffffff" : "#9aa0a6"} />
        <path d="M12 10V22" stroke={active ? "#ffffff" : "#9aa0a6"} strokeWidth="1.5" />
        <path d="M4 6V18L12 22" stroke={active ? "#ffffff" : "#9aa0a6"} strokeWidth="1.5" />
        <path d="M20 6V18L12 22" stroke={active ? "#ffffff" : "#9aa0a6"} strokeWidth="1.5" />
        {/* Play indicator */}
        <circle cx="17" cy="17" r="4" fill={active ? "#ffffff" : "#9aa0a6"} fillOpacity={active ? "0.6" : "0.4"} />
        <polygon points="16,15 16,19 19,17" fill={active ? "#ffffff" : "#9aa0a6"} />
    </svg>
);

const RoboticsIcon = ({ active }: { active?: boolean }) => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Camera/Eye */}
        <circle cx="12" cy="10" r="6" fill={active ? "#ffffff" : "#9aa0a6"} fillOpacity={active ? "0.2" : "0.1"} stroke={active ? "#ffffff" : "#9aa0a6"} strokeWidth="1.5" />
        <circle cx="12" cy="10" r="3" fill={active ? "#ffffff" : "#9aa0a6"} />
        <circle cx="12" cy="10" r="1.2" fill={active ? "#ffffff" : "#9aa0a6"} fillOpacity={active ? "1" : "0.5"} />
        {/* Detection rays */}
        <line x1="4" y1="6" x2="6" y2="8" stroke={active ? "#ffffff" : "#9aa0a6"} strokeWidth="1.5" strokeLinecap="round" />
        <line x1="20" y1="6" x2="18" y2="8" stroke={active ? "#ffffff" : "#9aa0a6"} strokeWidth="1.5" strokeLinecap="round" />
        {/* Bounding box indicator */}
        <rect x="3" y="17" width="7" height="5" rx="1" fill={active ? "#ffffff" : "#9aa0a6"} fillOpacity={active ? "0.8" : "0.4"} />
        <rect x="14" y="17" width="7" height="5" rx="1" fill={active ? "#ffffff" : "#9aa0a6"} fillOpacity={active ? "0.8" : "0.4"} />
    </svg>
);

const Viewer3DIcon = ({ active }: { active?: boolean }) => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* 3D Cube with perspective */}
        <path d="M12 2L3 7V17L12 22L21 17V7L12 2Z" fill={active ? "#ffffff" : "#9aa0a6"} fillOpacity={active ? "0.2" : "0.1"} stroke={active ? "#ffffff" : "#9aa0a6"} strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M12 12L3 7M12 12L21 7M12 12V22" stroke={active ? "#ffffff" : "#9aa0a6"} strokeWidth="1.5" strokeLinejoin="round" />
        {/* Hand gesture indicator */}
        <circle cx="18" cy="18" r="4" fill={active ? "#ffffff" : "#9aa0a6"} fillOpacity={active ? "0.9" : "0.5"} />
        <path d="M16.5 18.5L17.5 17L18.5 18L19.5 16.5" stroke={active ? "#ffffff" : "#9aa0a6"} strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

const ImageActivityIcon = ({ active }: { active?: boolean }) => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Image frame */}
        <rect x="2" y="3" width="20" height="18" rx="2" fill={active ? "#ffffff" : "#9aa0a6"} fillOpacity={active ? "0.2" : "0.1"} stroke={active ? "#ffffff" : "#9aa0a6"} strokeWidth="1.5" />
        {/* Interactive label indicators */}
        <circle cx="8" cy="10" r="1.5" fill={active ? "#ffffff" : "#9aa0a6"} />
        <circle cx="16" cy="14" r="1.5" fill={active ? "#ffffff" : "#9aa0a6"} />
        <rect x="5" y="15" width="3" height="2" rx="0.5" fill={active ? "#ffffff" : "#9aa0a6"} />
        <rect x="14" y="8" width="3" height="2" rx="0.5" fill={active ? "#ffffff" : "#9aa0a6"} />
        {/* Question mark in corner */}
        <circle cx="19" cy="6" r="2" fill={active ? "#ffffff" : "#9aa0a6"} fillOpacity={active ? "0.6" : "0.4"} />
        <text x="19" y="7" fontSize="2" fill={active ? "#ffffff" : "#9aa0a6"} textAnchor="middle" fontWeight="bold">?</text>
    </svg>
);

const CodeLabIcon = ({ active }: { active?: boolean }) => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Code editor window */}
        <rect x="2" y="3" width="20" height="18" rx="2" fill={active ? "#ffffff" : "#9aa0a6"} fillOpacity={active ? "0.2" : "0.1"} stroke={active ? "#ffffff" : "#9aa0a6"} strokeWidth="1.5" />
        {/* Window controls */}
        <circle cx="5" cy="6" r="1" fill={active ? "#ffffff" : "#9aa0a6"} fillOpacity={active ? "0.8" : "0.5"} />
        <circle cx="8" cy="6" r="1" fill={active ? "#ffffff" : "#9aa0a6"} fillOpacity={active ? "0.8" : "0.5"} />
        <circle cx="11" cy="6" r="1" fill={active ? "#ffffff" : "#9aa0a6"} fillOpacity={active ? "0.8" : "0.5"} />
        {/* Code lines */}
        <path d="M6 11L9 13L6 15" stroke={active ? "#ffffff" : "#9aa0a6"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <line x1="11" y1="15" x2="18" y2="15" stroke={active ? "#ffffff" : "#9aa0a6"} strokeWidth="1.5" strokeLinecap="round" />
        {/* Python snake indicator */}
        <circle cx="19" cy="6" r="2" fill={active ? "#ffffff" : "#9aa0a6"} fillOpacity={active ? "0.6" : "0.4"} />
        <text x="19" y="7" fontSize="3" fill={active ? "#ffffff" : "#9aa0a6"} textAnchor="middle" fontWeight="bold">🐍</text>
    </svg>
);

const VoxelLabIcon = ({ active }: { active?: boolean }) => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <polygon
            points="12 4 18 7 12 10 6 7"
            fill={active ? "#ffffff" : "#9aa0a6"}
            fillOpacity={active ? "0.25" : "0.12"}
            stroke={active ? "#ffffff" : "#9aa0a6"}
            strokeWidth="1.2"
            strokeLinejoin="round"
        />
        <polygon
            points="6 7 12 10 12 18 6 15"
            fill={active ? "#ffffff" : "#9aa0a6"}
            fillOpacity={active ? "0.18" : "0.08"}
            stroke={active ? "#ffffff" : "#9aa0a6"}
            strokeWidth="1.2"
            strokeLinejoin="round"
        />
        <polygon
            points="18 7 12 10 12 18 18 15"
            fill={active ? "#ffffff" : "#9aa0a6"}
            fillOpacity={active ? "0.3" : "0.15"}
            stroke={active ? "#ffffff" : "#9aa0a6"}
            strokeWidth="1.2"
            strokeLinejoin="round"
        />
    </svg>
);

const AssignmentIcon = ({ active }: { active?: boolean }) => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="4" y="3" width="16" height="18" rx="2" fill={active ? "#ffffff" : "#9aa0a6"} fillOpacity={active ? "0.2" : "0.1"} stroke={active ? "#ffffff" : "#9aa0a6"} strokeWidth="1.5" />
        <path d="M8 12L11 15L16 9" stroke={active ? "#ffffff" : "#9aa0a6"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <line x1="8" y1="7" x2="16" y2="7" stroke={active ? "#ffffff" : "#9aa0a6"} strokeWidth="1.5" strokeLinecap="round" />
        <line x1="8" y1="17" x2="12" y2="17" stroke={active ? "#ffffff" : "#9aa0a6"} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
);

const LaTeXIcon = ({ active }: { active?: boolean }) => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Document background */}
        <rect x="4" y="3" width="16" height="18" rx="2" fill={active ? "#ffffff" : "#9aa0a6"} fillOpacity={active ? "0.2" : "0.1"} stroke={active ? "#ffffff" : "#9aa0a6"} strokeWidth="1.5" />
        {/* LaTeX symbol - stylized L */}
        <path d="M8 7L8 17M8 7L12 7M8 11L11 11" stroke={active ? "#ffffff" : "#9aa0a6"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {/* X symbol */}
        <path d="M14 9L18 13M18 9L14 13" stroke={active ? "#ffffff" : "#9aa0a6"} strokeWidth="2" strokeLinecap="round" />
        {/* Code brackets */}
        <path d="M10 15L8 17L10 19M14 15L16 17L14 19" stroke={active ? "#ffffff" : "#9aa0a6"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

// Notebook Icon - HyperBookLM-inspired research notebook
const NotebookIcon = ({ active }: { active?: boolean }) => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Notebook outline */}
        <rect x="4" y="2" width="16" height="20" rx="2" fill={active ? "#ffffff" : "#9aa0a6"} fillOpacity={active ? "0.2" : "0.1"} stroke={active ? "#ffffff" : "#9aa0a6"} strokeWidth="1.5" />
        {/* Binding */}
        <line x1="8" y1="2" x2="8" y2="22" stroke={active ? "#ffffff" : "#9aa0a6"} strokeWidth="1.5" />
        {/* Lines */}
        <line x1="11" y1="7" x2="17" y2="7" stroke={active ? "#ffffff" : "#9aa0a6"} strokeWidth="1.5" strokeLinecap="round" />
        <line x1="11" y1="11" x2="17" y2="11" stroke={active ? "#ffffff" : "#9aa0a6"} strokeWidth="1.5" strokeLinecap="round" />
        <line x1="11" y1="15" x2="15" y2="15" stroke={active ? "#ffffff" : "#9aa0a6"} strokeWidth="1.5" strokeLinecap="round" />
        {/* AI sparkle */}
        <circle cx="18" cy="18" r="4" fill={active ? "#ffffff" : "#9aa0a6"} fillOpacity={active ? "0.8" : "0.4"} />
        <path d="M18 16V20M16 18H20" stroke={active ? "#000000" : "#9aa0a6"} strokeWidth="1" strokeLinecap="round" />
    </svg>
);

const ScienceTeacherIcon = ({ active }: { active?: boolean }) => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="8" r="4" fill={active ? "#ffffff" : "#9aa0a6"} fillOpacity={active ? "0.3" : "0.1"} stroke={active ? "#ffffff" : "#9aa0a6"} strokeWidth="1.5" />
        <path d="M4 20C4 15.5817 7.58172 12 12 12C16.4183 12 20 15.5817 20 20" stroke={active ? "#ffffff" : "#9aa0a6"} strokeWidth="1.5" strokeLinecap="round" />
        <path d="M9 16L12 19L15 16" stroke={active ? "#ffffff" : "#9aa0a6"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="17" cy="6" r="3" fill="#ffcc00" fillOpacity="0.6" />
        <path d="M17 5V7M16 6H18" stroke="white" strokeWidth="1" strokeLinecap="round" />
    </svg>
);

const LearningTheoriesIcon = ({ active }: { active?: boolean }) => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Brain with light bulb - representing intelligent learning selection */}
        <circle cx="12" cy="10" r="7" fill={active ? "#ffffff" : "#9aa0a6"} fillOpacity={active ? "0.2" : "0.1"} stroke={active ? "#ffffff" : "#9aa0a6"} strokeWidth="1.5" />
        <path d="M9 10C9 8.5 10 7 12 7C14 7 15 8.5 15 10C15 11 14.5 12 14 12.5V14H10V12.5C9.5 12 9 11 9 10Z" fill={active ? "#ffffff" : "#9aa0a6"} />
        <rect x="10" y="15" width="4" height="2" rx="0.5" fill={active ? "#ffffff" : "#9aa0a6"} />
        {/* Decision tree branches */}
        <line x1="4" y1="18" x2="8" y2="15" stroke={active ? "#ffffff" : "#9aa0a6"} strokeWidth="1.5" strokeLinecap="round" />
        <line x1="20" y1="18" x2="16" y2="15" stroke={active ? "#ffffff" : "#9aa0a6"} strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="4" cy="19" r="2" fill={active ? "#ffffff" : "#9aa0a6"} fillOpacity={active ? "0.8" : "0.4"} />
        <circle cx="20" cy="19" r="2" fill={active ? "#ffffff" : "#9aa0a6"} fillOpacity={active ? "0.8" : "0.4"} />
    </svg>
);

const allLearningModes: LearningModeCard[] = [
    { id: 'source', icon: <SourceIcon />, label: 'My Library', activeColor: '#5f6368', activeBg: 'rgba(95, 99, 104, 0.1)' },
    { id: 'immersive-text', icon: <ImmersiveTextIcon />, label: 'Immersive Text', activeColor: '#8ab4f8', activeBg: 'rgba(138, 180, 248, 0.1)' },
    { id: 'robotics', icon: <RoboticsIcon />, label: 'Robotics Vision', activeColor: '#ff8bcb', activeBg: 'rgba(255, 139, 203, 0.1)' },
    { id: 'code-lab', icon: <CodeLabIcon />, label: 'Code Lab', activeColor: '#10b981', activeBg: 'rgba(16, 185, 129, 0.1)' },
    { id: 'replicube-lab', icon: <VoxelLabIcon />, label: 'Voxel Lab', activeColor: '#06b6d4', activeBg: 'rgba(6, 182, 212, 0.12)' },
    { id: 'assignment', icon: <AssignmentIcon />, label: 'Study Tools', activeColor: '#f59e0b', activeBg: 'rgba(245, 158, 11, 0.1)' },
    { id: 'notebook', icon: <NotebookIcon />, label: 'Notebook', activeColor: '#3b82f6', activeBg: 'rgba(59, 130, 246, 0.1)' },
];

// Immersive Tree Node Component
const ImmersiveTreeNode: React.FC<{
    node: ImmersivePlanNodeWithChildren;
    depth: number;
    selectedId: string | null;
    onSelect: (node: ImmersivePlanNode) => void;
}> = ({ node, depth, selectedId, onSelect }) => {
    const [expanded, setExpanded] = useState(true);
    const hasChildren = node.children && node.children.length > 0;
    const isSelected = node.id === selectedId;
    const isRejected = node.status === 'rejected';

    const getStatusColor = () => {
        if (isSelected) return 'bg-emerald-500/20 border-emerald-500';
        if (isRejected) return 'bg-red-500/10 border-red-500/30 opacity-60';
        if (node.status === 'candidate') return 'bg-blue-500/10 border-blue-500/30';
        return 'bg-slate-700/50 border-slate-600';
    };

    return (
        <div className={`ml-${depth > 0 ? 4 : 0}`} style={{ marginLeft: depth > 0 ? depth * 16 : 0 }}>
            <div
                className={`p-3 rounded-lg border ${getStatusColor()} cursor-pointer transition-all hover:border-white/30 mb-2`}
                onClick={() => !isRejected && onSelect(node)}
            >
                <div className="flex items-start gap-2">
                    {hasChildren && (
                        <button
                            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
                            className="mt-0.5 text-slate-400 hover:text-white"
                        >
                            {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </button>
                    )}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            <GitBranch className="w-3.5 h-3.5 text-slate-400" />
                            <span className="text-sm font-medium text-white truncate">{node.approach}</span>
                            <div className="flex items-center gap-1 ml-auto flex-shrink-0">
                                {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400" />}
                                <span className={`text-xs px-1.5 py-0.5 rounded ${node.score >= 7 ? 'bg-emerald-500/20 text-emerald-300' :
                                    node.score >= 4 ? 'bg-amber-500/20 text-amber-300' :
                                        'bg-red-500/20 text-red-300'
                                    }`}>
                                    {node.score}/10
                                </span>
                            </div>
                        </div>
                        <p className="text-xs text-slate-400 line-clamp-2">{node.description}</p>
                    </div>
                </div>
            </div>
            {hasChildren && expanded && (
                <div className="border-l border-slate-600/50 ml-2 pl-2">
                    {node.children.map(child => (
                        <ImmersiveTreeNode
                            key={child.id}
                            node={child}
                            depth={depth + 1}
                            selectedId={selectedId}
                            onSelect={onSelect}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

// ToT Graph Visualization Component - Layered Flowchart Style (matching reference image)
const ToTGraphVisualization: React.FC<{
    tree: ImmersivePlanNode[];
    rootId?: string;
    selectedId: string | null;
    onSelect: (node: ImmersivePlanNode) => void;
}> = ({ tree, rootId, selectedId, onSelect }) => {
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);

    // Pastel color palette like reference image
    const APPROACH_COLORS = [
        { bg: '#fff3e0', border: '#ff9800', text: '#e65100' }, // Orange
        { bg: '#e3f2fd', border: '#2196f3', text: '#1565c0' }, // Blue
        { bg: '#fce4ec', border: '#e91e63', text: '#ad1457' }, // Pink
        { bg: '#f3e5f5', border: '#9c27b0', text: '#6a1b9a' }, // Purple
        { bg: '#e0f7fa', border: '#00bcd4', text: '#00695c' }, // Cyan
    ];

    // Convert ToT tree data to ReactFlow nodes and edges
    useEffect(() => {
        if (!tree || tree.length === 0) return;

        const approachNodes = tree.filter(n => n.id !== rootId && n.status !== 'rejected');
        const flowNodes: Node[] = [];
        const flowEdges: Edge[] = [];

        // Calculate layout dimensions
        const colWidth = 200;
        const colSpacing = 20;
        const headerWidth = Math.max(700, approachNodes.length * (colWidth + colSpacing));
        const startX = 40;

        // Layer 0: Header row (Green bar like reference)
        flowNodes.push({
            id: 'header',
            type: 'default',
            data: {
                label: (
                    <div style={{ textAlign: 'center', color: '#2e7d32' }}>
                        <div style={{ fontSize: '11px', fontWeight: 600, marginBottom: '4px' }}>
                            🎯 AI THINKING APPROACHES
                        </div>
                        <div style={{ fontSize: '14px', fontWeight: 700 }}>
                            Tree of Thoughts Planning
                        </div>
                    </div>
                )
            },
            position: { x: startX, y: 15 },
            style: {
                background: '#e8f5e9',
                border: '2px solid #4caf50',
                borderRadius: '10px',
                padding: '12px 24px',
                width: headerWidth,
                boxShadow: '0 3px 10px rgba(76,175,80,0.15)',
            },
            sourcePosition: Position.Bottom,
        });

        // Layer 1: Approach columns (colored boxes like reference)
        const approachY = 100;

        approachNodes.forEach((node, idx) => {
            const isSelected = node.id === selectedId;
            const colorScheme = APPROACH_COLORS[idx % APPROACH_COLORS.length];
            const scoreColor = node.score >= 8 ? '#4caf50' : node.score >= 6 ? '#ff9800' : '#f44336';

            flowNodes.push({
                id: node.id,
                type: 'default',
                data: {
                    label: (
                        <div style={{ textAlign: 'center' }}>
                            <div style={{
                                fontWeight: 700,
                                fontSize: '13px',
                                color: colorScheme.text,
                                marginBottom: '8px'
                            }}>
                                {node.approach}
                            </div>
                            <div style={{
                                display: 'inline-block',
                                background: scoreColor,
                                color: 'white',
                                padding: '3px 10px',
                                borderRadius: '12px',
                                fontSize: '10px',
                                fontWeight: 600,
                            }}>
                                Score: {node.score}/10
                            </div>
                        </div>
                    ),
                    nodeData: node
                },
                position: { x: startX + idx * (colWidth + colSpacing), y: approachY },
                style: {
                    background: isSelected ? '#c8e6c9' : colorScheme.bg,
                    border: isSelected ? '3px solid #4caf50' : `2px solid ${colorScheme.border}`,
                    borderRadius: '10px',
                    padding: '14px 12px',
                    width: colWidth,
                    cursor: 'pointer',
                    boxShadow: isSelected
                        ? '0 0 15px rgba(76, 175, 80, 0.4)'
                        : '0 3px 10px rgba(0,0,0,0.08)',
                    transition: 'all 0.3s ease',
                },
                targetPosition: Position.Top,
                sourcePosition: Position.Bottom,
            });

            // Edge from header to approach
            flowEdges.push({
                id: `header-${node.id}`,
                source: 'header',
                target: node.id,
                type: 'smoothstep',
                animated: isSelected,
                style: {
                    stroke: colorScheme.border,
                    strokeWidth: isSelected ? 3 : 2,
                },
                markerEnd: {
                    type: MarkerType.ArrowClosed,
                    color: colorScheme.border,
                    width: 14,
                    height: 14,
                },
            });

            // Layer 2: Section boxes under each approach (yellow boxes like reference)
            const sections = node.sections || [];
            sections.slice(0, 3).forEach((section, sIdx) => {
                const sectionNodeId = `${node.id}-sec-${sIdx}`;
                const sectionY = 200 + sIdx * 50;

                flowNodes.push({
                    id: sectionNodeId,
                    type: 'default',
                    data: {
                        label: (
                            <div style={{ textAlign: 'center', fontSize: '10px', color: '#f57f17', fontWeight: 600 }}>
                                {section.title || `Section ${sIdx + 1}`}
                            </div>
                        )
                    },
                    position: { x: startX + idx * (colWidth + colSpacing), y: sectionY },
                    style: {
                        background: '#fffde7',
                        border: '1px solid #ffc107',
                        borderRadius: '8px',
                        padding: '8px 6px',
                        width: colWidth,
                        boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
                    },
                    targetPosition: Position.Top,
                    sourcePosition: Position.Bottom,
                });

                // Edge from approach/previous section to this section
                const prevId = sIdx === 0 ? node.id : `${node.id}-sec-${sIdx - 1}`;
                flowEdges.push({
                    id: `${prevId}-${sectionNodeId}`,
                    source: prevId,
                    target: sectionNodeId,
                    type: 'smoothstep',
                    style: {
                        stroke: '#ffc107',
                        strokeWidth: 1.5,
                        strokeDasharray: '4 4',
                    },
                    markerEnd: {
                        type: MarkerType.ArrowClosed,
                        color: '#ffc107',
                        width: 10,
                        height: 10,
                    },
                });
            });
        });

        setNodes(flowNodes);
        setEdges(flowEdges);
    }, [tree, rootId, selectedId, setNodes, setEdges]);

    const handleNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
        if (node.id !== 'header' && !node.id.includes('-sec-') && node.data.nodeData) {
            onSelect(node.data.nodeData);
        }
    }, [onSelect]);

    return (
        <div style={{
            width: '100%',
            height: '480px',
            background: 'linear-gradient(180deg, #fafafa 0%, #f0f0f0 100%)',
            borderRadius: '14px',
            border: '1px solid #e0e0e0',
            boxShadow: '0 4px 20px rgba(0,0,0,0.08)'
        }}>
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onNodeClick={handleNodeClick}
                fitView
                fitViewOptions={{ padding: 0.1 }}
                nodesDraggable={false}
                nodesConnectable={false}
                elementsSelectable={true}
                proOptions={{ hideAttribution: true }}
            >
                <Background color="#e0e0e0" gap={25} size={1} />
                <Controls
                    showInteractive={false}
                    style={{
                        background: 'white',
                        border: '1px solid #e0e0e0',
                        borderRadius: '8px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                    }}
                />
            </ReactFlow>
        </div>
    );
};

interface CodeLabViewProps {
    codeLabFiles: CodeLabFile[];
    setCodeLabFiles: React.Dispatch<React.SetStateAction<CodeLabFile[]>>;
    codeLabActiveFileId: string;
    setCodeLabActiveFileId: React.Dispatch<React.SetStateAction<string>>;
    codeLabCode: string;
    setCodeLabCode: React.Dispatch<React.SetStateAction<string>>;
    codeLabLanguage: CodeLabLanguage;
    setCodeLabLanguage: React.Dispatch<React.SetStateAction<CodeLabLanguage>>;
    codeLabTheme: 'vscode' | 'dracula';
    setCodeLabTheme: React.Dispatch<React.SetStateAction<'vscode' | 'dracula'>>;
    codeLabOutput: string;
    setCodeLabOutput: React.Dispatch<React.SetStateAction<string>>;
    codeLabIsRunning: boolean;
    setCodeLabIsRunning: React.Dispatch<React.SetStateAction<boolean>>;
    codeLabAiPrompt: string;
    setCodeLabAiPrompt: React.Dispatch<React.SetStateAction<string>>;
    codeLabAiResponse: string;
    setCodeLabAiResponse: React.Dispatch<React.SetStateAction<string>>;
    codeLabAiLoading: boolean;
    codeLabAiStreaming: boolean;
    codeLabAiReasoning: string;
    codeLabAiError: string | null;
    handleAskCodeLabAi: () => void;
    handleInsertAiCode: () => void;
    loadPyodide: () => Promise<any>;
    codeLabExtensions: any[];
    codeLabBasicSetup: Record<string, unknown>;
}

const buildCodeLabPreviewHtml = (code: string) => {
    const escapedCode = code.replace(/<\/script>/gi, '<\\/script>');
    const userCode = JSON.stringify(escapedCode);
    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, height=device-height, initial-scale=1.0" />
  <style>
    :root { color-scheme: dark; }
    html, body { margin: 0; height: 100%; background: #0b0f14; color: #e2e8f0; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; }
    #root { position: relative; width: 100%; height: 100%; overflow: hidden; }
    canvas { width: 100%; height: 100%; display: block; background: #0b0f14; }
    #overlay { position: absolute; inset: 12px 12px auto 12px; padding: 8px 10px; border-radius: 8px; background: rgba(15, 23, 42, 0.85); color: #fca5a5; font-size: 12px; display: none; white-space: pre-wrap; }
  </style>
</head>
<body>
  <div id="root">
    <canvas id="canvas"></canvas>
    <div id="overlay"></div>
  </div>
  <script>
    (() => {
      const root = document.getElementById('root');
      const canvas = document.getElementById('canvas');
      const overlay = document.getElementById('overlay');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        overlay.textContent = 'Canvas 2D context unavailable.';
        overlay.style.display = 'block';
        return;
      }

      let origin = { x: 0, y: 0 };
      const resetOrigin = () => {
        origin = { x: canvas.width * 0.5, y: canvas.height * 0.6 };
      };

      const resize = () => {
        canvas.width = root.clientWidth || 1;
        canvas.height = root.clientHeight || 1;
        resetOrigin();
        ctx.fillStyle = '#0b0f14';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      };

      window.addEventListener('resize', resize);
      resize();

      const api = {
        canvas,
        ctx,
        setOrigin: (x, y) => {
          origin = { x, y };
        },
        clear: (color = '#0b0f14') => {
          ctx.fillStyle = color;
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        },
        line: (x1, y1, x2, y2, color = '#94a3b8', width = 1) => {
          ctx.strokeStyle = color;
          ctx.lineWidth = width;
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
        },
        rect: (x, y, w, h, color = '#38bdf8') => {
          ctx.fillStyle = color;
          ctx.fillRect(x, y, w, h);
        },
        circle: (x, y, r, color = '#f472b6') => {
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fill();
        },
        text: (value, x, y, color = '#e2e8f0', size = 12, font = 'ui-monospace, monospace') => {
          ctx.fillStyle = color;
          ctx.font = String(size) + 'px ' + font;
          ctx.fillText(String(value), x, y);
        },
        voxel: (x, y, z = 0, size = 18, colors = {}) => {
          const palette = typeof colors === 'string'
            ? { top: colors, left: colors, right: colors }
            : (colors || {});
          const topColor = palette.top || '#6ee7b7';
          const leftColor = palette.left || '#34d399';
          const rightColor = palette.right || '#10b981';
          const sx = size;
          const sy = size * 0.5;
          const px = origin.x + (x - y) * sx;
          const py = origin.y + (x + y) * sy - z * sx;
          const top = [
            { x: px, y: py - sx },
            { x: px + sx, y: py - sx + sy },
            { x: px, y: py + sy },
            { x: px - sx, y: py - sx + sy },
          ];
          const left = [
            { x: px - sx, y: py - sx + sy },
            { x: px, y: py + sy },
            { x: px, y: py + sy + sx },
            { x: px - sx, y: py - sx + sy + sx },
          ];
          const right = [
            { x: px + sx, y: py - sx + sy },
            { x: px, y: py + sy },
            { x: px, y: py + sy + sx },
            { x: px + sx, y: py - sx + sy + sx },
          ];
          ctx.fillStyle = topColor;
          ctx.beginPath();
          ctx.moveTo(top[0].x, top[0].y);
          ctx.lineTo(top[1].x, top[1].y);
          ctx.lineTo(top[2].x, top[2].y);
          ctx.lineTo(top[3].x, top[3].y);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = leftColor;
          ctx.beginPath();
          ctx.moveTo(left[0].x, left[0].y);
          ctx.lineTo(left[1].x, left[1].y);
          ctx.lineTo(left[2].x, left[2].y);
          ctx.lineTo(left[3].x, left[3].y);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = rightColor;
          ctx.beginPath();
          ctx.moveTo(right[0].x, right[0].y);
          ctx.lineTo(right[1].x, right[1].y);
          ctx.lineTo(right[2].x, right[2].y);
          ctx.lineTo(right[3].x, right[3].y);
          ctx.closePath();
          ctx.fill();
        },
      };

      const userCode = ${userCode};
      try {
        const fn = new Function('api', userCode);
        fn(api);
      } catch (err) {
        overlay.textContent = err && err.message ? err.message : String(err);
        overlay.style.display = 'block';
      }
    })();
  </script>
</body>
</html>`;
};

const createCodeLabConsoleApi = () => {
    const noop = () => { };
    const ctx = new Proxy({}, { get: () => noop }) as any;
    return {
        canvas: { width: 0, height: 0 },
        ctx,
        setOrigin: noop,
        clear: noop,
        line: noop,
        rect: noop,
        circle: noop,
        text: noop,
        voxel: noop,
    };
};

const CodeLabView: React.FC<CodeLabViewProps> = ({
    codeLabFiles,
    setCodeLabFiles,
    codeLabActiveFileId,
    setCodeLabActiveFileId,
    codeLabCode,
    setCodeLabCode,
    codeLabLanguage,
    setCodeLabLanguage,
    codeLabTheme,
    setCodeLabTheme,
    codeLabOutput,
    setCodeLabOutput,
    codeLabIsRunning,
    setCodeLabIsRunning,
    codeLabAiPrompt,
    setCodeLabAiPrompt,
    codeLabAiResponse,
    setCodeLabAiResponse,
    codeLabAiLoading,
    codeLabAiStreaming,
    codeLabAiReasoning,
    codeLabAiError,
    handleAskCodeLabAi,
    handleInsertAiCode,
    loadPyodide,
    codeLabExtensions,
    codeLabBasicSetup,
}) => {
    const activeFile = codeLabFiles.find(file => file.id === codeLabActiveFileId) || codeLabFiles[0];
    const aiInputRef = useRef<HTMLInputElement>(null);
    const codeMirrorRef = useRef<any>(null);
    const isInputFocusedRef = useRef(false);
    const [liveOutputHtml, setLiveOutputHtml] = useState('');
    const liveOutputTimerRef = useRef<number | null>(null);
    const showLiveOutput = codeLabLanguage === 'javascript';
    const jsFile = codeLabFiles.find(file => file.language === 'javascript');

    // Monitor input focus state and prevent CodeMirror from stealing focus
    useEffect(() => {
        const input = aiInputRef.current;
        if (!input) return;

        const handleFocus = () => {
            isInputFocusedRef.current = true;
        };

        const handleBlur = () => {
            // Small delay to check if focus moved to CodeMirror
            setTimeout(() => {
                const activeElement = document.activeElement;
                const cmEditor = activeElement?.closest('.cm-editor');
                if (cmEditor && isInputFocusedRef.current) {
                    // Focus was stolen by CodeMirror, return it to input
                    input.focus();
                } else {
                    isInputFocusedRef.current = false;
                }
            }, 10);
        };

        // Global listener to prevent CodeMirror focus stealing
        const handleGlobalFocus = (e: FocusEvent) => {
            if (isInputFocusedRef.current && input === document.activeElement) {
                const target = e.target as HTMLElement;
                if (target?.closest('.cm-editor') || target?.classList.contains('cm-content')) {
                    e.preventDefault();
                    e.stopPropagation();
                    requestAnimationFrame(() => {
                        input.focus();
                    });
                }
            }
        };

        input.addEventListener('focus', handleFocus);
        input.addEventListener('blur', handleBlur);
        document.addEventListener('focusin', handleGlobalFocus, true);

        return () => {
            input.removeEventListener('focus', handleFocus);
            input.removeEventListener('blur', handleBlur);
            document.removeEventListener('focusin', handleGlobalFocus, true);
        };
    }, []);

    useEffect(() => {
        if (!showLiveOutput) {
            setLiveOutputHtml('');
            return;
        }

        if (liveOutputTimerRef.current) {
            window.clearTimeout(liveOutputTimerRef.current);
        }

        liveOutputTimerRef.current = window.setTimeout(() => {
            setLiveOutputHtml(buildCodeLabPreviewHtml(codeLabCode));
        }, 350);

        return () => {
            if (liveOutputTimerRef.current) {
                window.clearTimeout(liveOutputTimerRef.current);
            }
        };
    }, [codeLabCode, showLiveOutput]);

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
                    const api = createCodeLabConsoleApi();
                    const runner = new Function('api', codeLabCode);
                    const result = runner(api);
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
        <div className="flex flex-1 w-full h-screen bg-[#eef2f7] text-slate-900 overflow-hidden">
            <div className="relative flex-1 w-full h-full flex flex-col overflow-hidden">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.12),_transparent_45%),radial-gradient(circle_at_bottom,_rgba(59,130,246,0.08),_transparent_40%)]" />
                <div className="relative flex-1 w-full h-full flex flex-col overflow-hidden">
                    {/* Header Bar */}
                    <div className="flex-shrink-0 border-b border-slate-200/70 bg-white/80 backdrop-blur-sm px-6 py-3">
                        <div className="flex flex-wrap items-center gap-3">
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/15 text-emerald-700">
                                    <Code2 className="h-5 w-5" />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-slate-900">Code Lab</p>
                                    <p className="text-xs text-slate-500">Edit, run, and iterate quickly</p>
                                </div>
                            </div>
                            <div className="ml-auto flex flex-wrap items-center gap-2">
                                <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600 shadow-sm">
                                    <TerminalIcon className="h-3.5 w-3.5 text-emerald-500" />
                                    {activeFile.language === 'java' || activeFile.language === 'cpp' ? 'Run coming soon for Java/C++' : 'Python + JS runnable'}
                                </span>
                                <select
                                    value={codeLabTheme}
                                    onChange={(e) => setCodeLabTheme(e.target.value as 'vscode' | 'dracula')}
                                    className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/30"
                                >
                                    <option value="vscode">VS Code</option>
                                    <option value="dracula">Dracula</option>
                                </select>
                            </div>
                        </div>

                        {/* File Tabs */}
                        <div className="flex flex-wrap items-center gap-2 mt-3">
                            {codeLabFiles.map(file => {
                                const isActive = file.id === activeFile.id;
                                return (
                                    <button
                                        key={file.id}
                                        onClick={() => handleFileSelect(file.id)}
                                        className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${isActive
                                            ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 shadow-sm'
                                            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                                            }`}
                                    >
                                        {file.name}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Main Content Area - Full Height */}
                    <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-4 p-4 overflow-hidden">
                        {/* Code Editor - Left Side */}
                        <div className="flex flex-col min-h-0 overflow-hidden">
                            <div className="flex flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                                <div className="flex items-center justify-between border-b border-slate-800/60 bg-[#111319] px-4 py-3 text-slate-200">
                                    <div className="flex items-center gap-3">
                                        <div className="flex gap-1.5">
                                            <div className="h-3 w-3 rounded-full bg-[#fa5e5b] opacity-80" />
                                            <div className="h-3 w-3 rounded-full bg-[#fbbc05] opacity-80" />
                                            <div className="h-3 w-3 rounded-full bg-[#27c93f] opacity-80" />
                                        </div>
                                        <div className="flex items-center gap-2 text-xs text-slate-300">
                                            <span className="font-semibold text-slate-100">{activeFile.name}</span>
                                            <span className="text-slate-500">/</span>
                                            <div className="relative">
                                                <select
                                                    value={codeLabLanguage}
                                                    onChange={(e) => {
                                                        const nextLang = e.target.value as CodeLabLanguage;
                                                        setCodeLabLanguage(nextLang);
                                                        setCodeLabFiles(prev => prev.map(file => file.id === activeFile.id ? { ...file, language: nextLang } : file));
                                                    }}
                                                    className="appearance-none bg-transparent pr-5 text-xs font-medium uppercase tracking-wider text-slate-300 outline-none"
                                                >
                                                    <option value="python" className="bg-[#111319]">Python</option>
                                                    <option value="javascript" className="bg-[#111319]">JavaScript</option>
                                                    <option value="java" className="bg-[#111319]">Java</option>
                                                    <option value="cpp" className="bg-[#111319]">C++</option>
                                                </select>
                                                <ChevronDown className="absolute right-0 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-500" />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={clearOutput}
                                            className="rounded-md px-2 py-1 text-xs text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
                                            title="Clear Output"
                                        >
                                            <RotateCcw className="h-3.5 w-3.5" />
                                        </button>
                                        <div className="h-4 w-px bg-slate-800" />
                                        <button
                                            onClick={runCode}
                                            disabled={codeLabIsRunning}
                                            className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${codeLabIsRunning
                                                ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                                                : 'border border-emerald-500/20 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'
                                                }`}
                                        >
                                            {codeLabIsRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5 fill-current" />}
                                            {codeLabIsRunning ? 'Running...' : 'Run Code'}
                                        </button>
                                    </div>
                                </div>

                                <div
                                    className="flex-1 overflow-hidden bg-[#0b0f14] relative"
                                    onMouseDown={(e) => {
                                        if (isInputFocusedRef.current && aiInputRef.current) {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            requestAnimationFrame(() => {
                                                aiInputRef.current?.focus();
                                            });
                                        }
                                    }}
                                    onClick={(e) => {
                                        if (isInputFocusedRef.current && aiInputRef.current) {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            aiInputRef.current?.focus();
                                        }
                                    }}
                                >
                                    <CodeMirror
                                        ref={codeMirrorRef}
                                        value={codeLabCode}
                                        height="100%"
                                        editable
                                        theme={codeLabTheme === 'vscode' ? vscodeDark : dracula}
                                        basicSetup={{
                                            ...codeLabBasicSetup,
                                            // autofocus not present in BasicSetupOptions type, handled manually via ref
                                        }}
                                        className="h-full text-sm"
                                        extensions={codeLabExtensions}
                                        onChange={handleCodeChange}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Right Sidebar - AI Assistant & Output */}
                        <div className="flex flex-col gap-4 min-h-0 overflow-hidden">
                            {/* AI Assistant Panel */}
                            <div className="flex flex-col flex-1 min-h-0 rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                                <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 flex-shrink-0">
                                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                                        <Sparkles className="h-4 w-4 text-emerald-500" />
                                        AI Assistant
                                    </div>
                                    {codeLabAiResponse && (
                                        <button
                                            onClick={() => setCodeLabAiResponse('')}
                                            className="text-xs text-slate-500 hover:text-slate-900"
                                        >
                                            Clear
                                        </button>
                                    )}
                                </div>
                                <div className="space-y-3 p-4 overflow-y-auto flex-1 min-h-0">
                                    <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 focus-within:border-emerald-400 focus-within:ring-2 focus-within:ring-emerald-400/30">
                                        <Sparkles className="h-3.5 w-3.5 text-slate-400" />
                                        <input
                                            ref={aiInputRef}
                                            value={codeLabAiPrompt}
                                            onChange={(e) => setCodeLabAiPrompt(e.target.value)}
                                            placeholder="Ask AI to edit code..."
                                            className="flex-1 bg-transparent text-xs text-slate-700 placeholder:text-slate-400 outline-none"
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    handleAskCodeLabAi();
                                                }
                                                e.stopPropagation();
                                            }}
                                            onFocus={(e) => {
                                                e.stopPropagation();
                                            }}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                            }}
                                            autoFocus={false}
                                        />
                                        <button
                                            onClick={handleAskCodeLabAi}
                                            disabled={codeLabAiLoading || !codeLabAiPrompt.trim()}
                                            className="rounded-md px-2 py-1 text-[10px] font-semibold text-slate-600 hover:bg-slate-200/60 hover:text-slate-900 transition-colors disabled:opacity-50"
                                        >
                                            {codeLabAiLoading ? 'Thinking...' : 'Ask'}
                                        </button>
                                        {codeLabAiResponse && (
                                            <button
                                                onClick={handleInsertAiCode}
                                                className="rounded-md px-2 py-1 text-[10px] font-semibold text-emerald-600 hover:bg-emerald-500/10 transition-colors"
                                            >
                                                Apply
                                            </button>
                                        )}
                                    </div>

                                    <div className="text-xs text-slate-600">
                                        <Reasoning isStreaming={codeLabAiStreaming}>{codeLabAiReasoning}</Reasoning>
                                    </div>

                                    {codeLabAiResponse && !codeLabAiReasoning && (
                                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                                            <div className="mb-2 flex items-center justify-between">
                                                <span className="text-[10px] font-semibold uppercase text-slate-500">Suggested Change</span>
                                            </div>
                                            <pre className="text-xs text-slate-600 font-mono whitespace-pre-wrap border-l-2 border-slate-200 pl-2">{codeLabAiResponse}</pre>
                                        </div>
                                    )}
                                    {codeLabAiError && (
                                        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
                                            {codeLabAiError}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Output Panel */}
                            <div className="flex flex-1 min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                                <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 flex-shrink-0">
                                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                                        <TerminalIcon className="h-4 w-4 text-emerald-500" />
                                        Output
                                    </div>
                                    <button onClick={clearOutput} className="text-xs text-slate-500 hover:text-slate-900">Clear</button>
                                </div>
                                <div className="flex-1 min-h-0 overflow-hidden bg-[#0b0f14] text-slate-200">
                                    <div className="flex h-full flex-col">
                                        <div className="flex-[3] min-h-[180px] border-b border-slate-800/80">
                                            <div className="flex items-center justify-between px-4 py-2 text-[10px] uppercase tracking-wider text-slate-400">
                                                <span>Live Output</span>
                                                <span
                                                    className={`rounded-full border px-2 py-0.5 text-[9px] ${showLiveOutput
                                                        ? 'border-emerald-500/40 text-emerald-300'
                                                        : 'border-slate-700 text-slate-500'
                                                        }`}
                                                >
                                                    {showLiveOutput ? 'Live JS' : 'JS only'}
                                                </span>
                                            </div>
                                            <div className="relative h-full w-full bg-[#0b0f14]">
                                                {showLiveOutput ? (
                                                    liveOutputHtml ? (
                                                        <iframe
                                                            title="Code Lab Live Output"
                                                            className="h-full w-full border-0"
                                                            sandbox="allow-scripts"
                                                            srcDoc={liveOutputHtml}
                                                        />
                                                    ) : (
                                                        <div className="flex h-full items-center justify-center text-xs text-slate-500">
                                                            Preparing preview...
                                                        </div>
                                                    )
                                                ) : (
                                                    <div className="flex h-full flex-col items-center justify-center gap-2 text-xs text-slate-500">
                                                        <span>Switch to JavaScript to render graphics.</span>
                                                        {jsFile && (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleFileSelect(jsFile.id)}
                                                                className="rounded-full border border-slate-700 px-3 py-1 text-[10px] font-semibold text-slate-200 hover:bg-slate-800"
                                                            >
                                                                Open JS Game Demo
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
                                                {showLiveOutput && (
                                                    <div className="pointer-events-none absolute bottom-2 right-3 text-[10px] text-slate-500">
                                                        api.clear, api.voxel, api.line
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex-[2] min-h-0 flex flex-col">
                                            <div className="flex items-center justify-between px-4 py-2 text-[10px] uppercase tracking-wider text-slate-400 border-b border-slate-800/80">
                                                <span>Console</span>
                                                {showLiveOutput && (
                                                    <span className="text-[10px] text-slate-500">Run to capture logs</span>
                                                )}
                                            </div>
                                            <div className="flex-1 min-h-0 overflow-auto px-4 py-3 font-mono text-xs text-slate-200">
                                                {codeLabOutput ? codeLabOutput.split('\n').map((line, idx) => (
                                                    <div key={idx} className="whitespace-pre-wrap leading-6">{line || ' '}</div>
                                                )) : (
                                                    <div className="text-slate-400">Run code to see console output here.</div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const ImmersiveLearning: React.FC<ImmersiveLearningProps> = ({ onClose, apiKey, initialMode }) => {
    const { addSource } = useSourceStore();

    // Initialize Gemini Live
    const preferredGeminiLanguage = getPreferredGeminiLanguage();
    const geminiLiveState = useGeminiLive(apiKey || '', preferredGeminiLanguage);

    // Dock characters for MessageDock
    const dockCharacters: Character[] = [
        { emoji: "✨", name: "Sparkle", online: false, backgroundColor: "bg-amber-200", gradientColors: "#fde68a, #fffbeb" },
        { emoji: "🧙‍♂️", name: "Wizard", online: true, backgroundColor: "bg-emerald-200 dark:bg-emerald-300", gradientColors: "#a7f3d0, #ecfdf5" },
        { emoji: "👨‍🔬", name: "Teacher", online: true, backgroundColor: "bg-amber-100 dark:bg-amber-200", gradientColors: "#fbbf24, #fef3c7" },
        { emoji: "🦄", name: "Unicorn", online: true, backgroundColor: "bg-violet-200 dark:bg-violet-300", gradientColors: "#c4b5fd, #f5f3ff" },
        { emoji: "🤖", name: "Robot", online: false, backgroundColor: "bg-rose-200 dark:bg-rose-300", gradientColors: "#fecaca, #fef2f2" },
    ];

    // Handler for expanding learning canvas images
    const handleCanvasImageExpand = useCallback((image: LearningCanvasImage) => {
        if (!image || image.status !== 'complete' || !image.url) {
            return;
        }
        console.log('Canvas image expanded:', image);
    }, []);

    // ========== WORKSPACE MANAGEMENT (LOCAL / ON-DEVICE) ==========
    // Persisted per-user on this device (no Firebase).

    const getLocalUserKey = useCallback(() => getCurrentUserId() || 'anonymous', []);

    const getLocalStorageKeys = useCallback(() => {
        const u = getLocalUserKey();
        return {
            WORKSPACES: `immersive_learning_workspaces:${u}`,
            SPACES: `immersive_learning_user_spaces:${u}`,
            ACTIVE: `immersive_learning_active_workspace:${u}`,
        };
    }, [getLocalUserKey]);

    interface LocalImmersiveWorkspace {
        id: string;
        name: string;
        description: string;
        createdAt: number;
        updatedAt: number;
        thumbnailEmoji: string;
        documentFileName: string;
        documentMimeType: string | null;
        documentFileId: string | null; // IndexedDB file id
        documentSize?: number;
        documentIsFallback?: boolean;
        documentText: string;
        immersiveContent: ImmersiveContent | null;
        sectionImages: { [key: string]: string };
        widgetImages: { [key: string]: { before: string; after: string } };
        quiz: QuizQuestion[];
        audioScript: string | null;
        reactFlowData: ReactFlowData | null;
        relevantVideos: RankedYouTubeVideo[];
        pdfUrl: string | null; // runtime blob URL (not persisted)
        activeSectionId: string | null;
        // Mode-specific content storage
        mindMapData: MindMapNode | null;
        simulationData: {
            blueprint: SimulationBlueprint | null;
            html: string | null;
        } | null;
        codeLabData: {
            files: CodeLabFile[];
            activeFileId: string;
            language: CodeLabLanguage;
            theme: 'vscode' | 'dracula';
        } | null;
        imageActivityData: {
            prompt: string;
            generatedImageUrl: string | null;
        } | null;
        roboticsData: {
            detectedObjects: DetectedObject[];
            boundingBoxes: BoundingBox[];
            sceneDescription: string | null;
            analysisMode: 'detect' | 'boxes' | 'classify' | 'count' | 'question' | 'hand';
        } | null;
        viewer3dData: {
            modelUrl: string | null;
            modelName: string;
            rotation: { x: number; y: number; z: number };
            position: { x: number; y: number; z: number };
            scale: number;
            interactionMode: 'drag' | 'rotate' | 'scale' | 'animate';
        } | null;
        brainstormActivities: { [sectionId: string]: BrainstormActivity };
        scienceTeacherData: {
            messages: ScienceTeacherMessage[];
        } | null;
    }

    interface LocalUserSpace {
        id: string;
        mode: LearningMode;
        name: string;
        description: string;
        emoji: string;
        workspaceId: string | null;
        lastUsed: number;
        usageCount: number;
        thumbnailUrl?: string;
    }

    const [savedWorkspaces, setSavedWorkspaces] = useState<LocalImmersiveWorkspace[]>([]);
    const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
    const [isLoadingWorkspaces, setIsLoadingWorkspaces] = useState(false);
    const [showWorkspaceManager, setShowWorkspaceManager] = useState(false);
    const [isCreatingWorkspace, setIsCreatingWorkspace] = useState(false);
    const [workspaceSearchQuery, setWorkspaceSearchQuery] = useState('');
    const [dashboardTab, setDashboardTab] = useState<'notebooks' | 'spaces'>('notebooks');
    const [spaceSearchQuery, setSpaceSearchQuery] = useState('');

    const [userSpaces, setUserSpaces] = useState<LocalUserSpace[]>([]);

    const [activeMode, setActiveMode] = useState<LearningMode>(initialMode ?? 'source'); // Start with workspace manager
    const [assignmentTab, setAssignmentTab] = useState<'exam-prep' | 'latex-prep'>('exam-prep');
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

    // Uploaded document metadata (persisted in workspace)
    const [documentFileId, setDocumentFileId] = useState<string | null>(null);
    const [documentMimeType, setDocumentMimeType] = useState<string | null>(null);
    const [documentIsFallback, setDocumentIsFallback] = useState(false);

    useEffect(() => {
        if (!initialMode) {
            return;
        }
        setActiveMode(initialMode);
    }, [initialMode]);

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
            const snippetLower = (source.snippet || '').toLowerCase();
            const titleLower = (source.title || '').toLowerCase();

            const paragraphTerms = paragraphLower.match(/\b[a-z]{5,}\b/g) || [];

            let matchScore = 0;
            paragraphTerms.forEach(term => {
                if (snippetLower.includes(term) || titleLower.includes(term)) {
                    matchScore++;
                }
            });

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
    const [widgetImages, setWidgetImages] = useState<{ [key: string]: { before: string, after: string } }>({});
    const [quiz, setQuiz] = useState<QuizQuestion[]>([]);
    const [audioScript, setAudioScript] = useState<string>('');
    const [mindMap, setMindMap] = useState<MindMapNode | null>(null);
    const [reactFlowData, setReactFlowData] = useState<ReactFlowData | null>(null);
    const [showDrawIOWorkspace, setShowDrawIOWorkspace] = useState(false);

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
    const [brainstormActivities, setBrainstormActivities] = useState<{ [sectionId: string]: BrainstormActivity }>({});

    // Science Teacher State
    const [scienceTeacherMessages, setScienceTeacherMessages] = useState<ScienceTeacherMessage[]>([]);
    const [isLoadingBrainstorm, setIsLoadingBrainstorm] = useState(false);
    const [showBrainstormHints, setShowBrainstormHints] = useState<boolean[]>([]);
    const [showBrainstormApproaches, setShowBrainstormApproaches] = useState(false);
    const [showBrainstormInsight, setShowBrainstormInsight] = useState(false);
    const [userBrainstormNotes, setUserBrainstormNotes] = useState('');

    // What-If Activity State
    const [whatIfActivity, setWhatIfActivity] = useState<WhatIfActivity | null>(null);
    const [isLoadingWhatIf, setIsLoadingWhatIf] = useState(false);
    const [revealedWhatIfs, setRevealedWhatIfs] = useState<{ [key: number]: boolean }>({});

    // Audio Video mode tabs
    const [audioVideoModeTab, setAudioVideoModeTab] = useState<'video' | 'audio'>('video');
    const [assignmentAudioVideoTab, setAssignmentAudioVideoTab] = useState<'video' | 'audio' | null>(null);
    const [assignmentMindmapActive, setAssignmentMindmapActive] = useState(false);
    const [assignmentVisualActivityActive, setAssignmentVisualActivityActive] = useState(false);
    const [assignmentSimulationActive, setAssignmentSimulationActive] = useState(false);
    // Thoreo-style tabs for slides-narration
    const [videoContentTab, setVideoContentTab] = useState<'summary' | 'key-concepts' | 'clips' | 'transcript'>('summary');
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

    const parseTimestampToSeconds = (value: string): number | null => {
        if (!value) return null;
        const cleaned = value.trim().replace(/^[^\d]+/, '');
        const parts = cleaned.split(':').map((part) => Number(part));
        if (parts.length === 0 || parts.some(Number.isNaN)) return null;
        if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
        if (parts.length === 2) return parts[0] * 60 + parts[1];
        return parts[0];
    };

    const formatTimestamp = (totalSeconds: number): string => {
        const safeSeconds = Math.max(0, Math.floor(totalSeconds));
        const hours = Math.floor(safeSeconds / 3600);
        const minutes = Math.floor((safeSeconds % 3600) / 60);
        const seconds = safeSeconds % 60;
        if (hours > 0) {
            return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        }
        return `${minutes}:${String(seconds).padStart(2, '0')}`;
    };

    const videoClipChapters = useMemo(() => {
        const timestamps = videoSummary?.timestamps || [];
        if (timestamps.length === 0) return [];

        const entries = timestamps
            .map((item) => {
                const startSeconds = parseTimestampToSeconds(item.time);
                if (startSeconds === null) return null;
                return {
                    title: item.topic?.trim() || 'Segment',
                    startLabel: item.time,
                    startSeconds
                };
            })
            .filter((entry): entry is { title: string; startLabel: string; startSeconds: number } => Boolean(entry))
            .sort((a, b) => a.startSeconds - b.startSeconds);

        if (entries.length === 0) return [];

        const conceptTitles = (videoSummary?.keyConcepts || []).map((concept) => concept.title).filter(Boolean);

        const getKeywords = (topic: string) => {
            const keywords: string[] = [];
            const lowerTopic = topic.toLowerCase();
            conceptTitles.forEach((title) => {
                if (title.toLowerCase().includes(lowerTopic) || lowerTopic.includes(title.toLowerCase())) {
                    if (!keywords.some((existing) => existing.toLowerCase() === title.toLowerCase())) {
                        keywords.push(title);
                    }
                }
            });

            topic
                .split(/[^a-zA-Z0-9]+/)
                .filter((word) => word.length > 3)
                .forEach((word) => {
                    if (!keywords.some((existing) => existing.toLowerCase() === word.toLowerCase())) {
                        keywords.push(word);
                    }
                });

            return keywords.slice(0, 6);
        };

        return entries.map((entry, idx) => {
            const nextEntry = entries[idx + 1];
            const minDuration = 20;
            const defaultDuration = 50;
            const endSeconds = nextEntry
                ? Math.max(entry.startSeconds + minDuration, nextEntry.startSeconds - 1)
                : entry.startSeconds + defaultDuration;

            return {
                title: entry.title,
                startLabel: entry.startLabel,
                endLabel: formatTimestamp(endSeconds),
                startSeconds: entry.startSeconds,
                endSeconds,
                keywords: getKeywords(entry.title)
            };
        });
    }, [videoSummary]);

    // Streaming state for real-time content generation
    const [isStreaming, setIsStreaming] = useState(false);
    const [streamedContent, setStreamedContent] = useState('');

    // ToT Planning State
    const [useToTGeneration, setUseToTGeneration] = useState(false);
    const [immersiveToTPlan, setImmersiveToTPlan] = useState<ImmersiveToTResponse | null>(null);
    const [isPlanningImmersive, setIsPlanningImmersive] = useState(false);
    const [showToTTree, setShowToTTree] = useState(false);
    const [currentPlanNode, setCurrentPlanNode] = useState<ImmersivePlanNode | null>(null);


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

    // Notebook State (HyperBookLM-inspired)
    const [notebookContent, setNotebookContent] = useState<NotebookContent | null>(null);
    const [notebookActiveTab, setNotebookActiveTab] = useState<'summary' | 'mindmap' | 'audio' | 'chat'>('summary');
    const [isGeneratingNotebookSummary, setIsGeneratingNotebookSummary] = useState(false);
    const [isGeneratingNotebookMindmap, setIsGeneratingNotebookMindmap] = useState(false);
    const [isGeneratingNotebookAudio, setIsGeneratingNotebookAudio] = useState(false);
    const [notebookChatInput, setNotebookChatInput] = useState('');
    const [isNotebookChatLoading, setIsNotebookChatLoading] = useState(false);
    const [notebookAudioPlaying, setNotebookAudioPlaying] = useState(false);
    const notebookAudioRef = useRef<HTMLAudioElement | null>(null);

    // Bring-your-own-notes support (for audio, mindmap, simulation)
    const [standaloneNotes, setStandaloneNotes] = useState('');
    const [standaloneNotesName, setStandaloneNotesName] = useState('');
    const [standaloneTopic, setStandaloneTopic] = useState('');
    const [isGeneratingStandaloneMindMap, setIsGeneratingStandaloneMindMap] = useState(false);
    const notesFileInputRef = useRef<HTMLInputElement>(null);

    // Simulation State
    const [simulationBlueprint, setSimulationBlueprint] = useState<SimulationBlueprint | null>(null);
    const [simulationHTML, setSimulationHTML] = useState<string | null>(null);
    const [isGeneratingSimulation, setIsGeneratingSimulation] = useState(false);
    const [simulationProgress, setSimulationProgress] = useState<string>('');
    const [simulationProgressSteps, setSimulationProgressSteps] = useState<{ step: string, status: 'pending' | 'active' | 'done' }[]>([]);
    const [simulationError, setSimulationError] = useState<string | null>(null);
    const [isSimulationFullscreen, setIsSimulationFullscreen] = useState(false);
    const simulationIframeRef = useRef<HTMLIFrameElement>(null);
    const documentTextRef = useRef<string>(''); // Store document text for simulation generation

    // Learning Theories Mode State
    const [learningTheoriesResult, setLearningTheoriesResult] = useState<LearningTheoryToTResponse | null>(null);
    const [isAnalyzingLearningTheory, setIsAnalyzingLearningTheory] = useState(false);
    const [selectedLearningTheory, setSelectedLearningTheory] = useState<LearningTheoryType | null>(null);
    const [feynmanLiveConfig, setFeynmanLiveConfig] = useState<FeynmanLiveConfig | null>(null);
    const [learningTheoryError, setLearningTheoryError] = useState<string | null>(null);
    const [learningTheoryTopicInput, setLearningTheoryTopicInput] = useState('');
    const [learningTheoryContent, setLearningTheoryContent] = useState<string>('');
    const [isGeneratingTheoryContent, setIsGeneratingTheoryContent] = useState(false);
    const [learningTheoryPhase, setLearningTheoryPhase] = useState<'input' | 'analysis' | 'learning'>('input');

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
    const [viewer3dModelLoading, setViewer3dModelLoading] = useState(false);
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
            content: 'console.log("Replicube demo: reference vs output")\nconst { canvas, clear, rect, text, voxel, line, setOrigin } = api;\nif (!canvas || !canvas.width) {\n  console.log("Open Live Output to see graphics.");\n} else {\n  const colors = {\n    background: "#0b0f14",\n    header: "#0f172a",\n    panel: "#111827",\n    panelBorder: "#1f2937",\n    panelHeader: "#0f172a",\n    label: "#93c5fd",\n  };\n  const grid = 7;\n  const size = 16;\n  const half = (grid - 1) / 2;\n\n  const project = (x, y, z, ox, oy) => ({\n    x: ox + (x - y) * size,\n    y: oy + (x + y) * size * 0.5 - z * size,\n  });\n\n  const panel = (x, y, w, h, title) => {\n    rect(x, y, w, h, colors.panelBorder);\n    rect(x + 1, y + 1, w - 2, h - 2, colors.panel);\n    rect(x + 1, y + 1, w - 2, 22, colors.panelHeader);\n    text(title, x + 12, y + 16, colors.label, 11);\n  };\n\n  const drawAxes = (ox, oy) => {\n    const origin = project(0, 0, 0, ox, oy);\n    const xAxis = project(3, 0, 0, ox, oy);\n    const yAxis = project(0, 3, 0, ox, oy);\n    const zAxis = project(0, 0, 3, ox, oy);\n    line(origin.x, origin.y, xAxis.x, xAxis.y, "#ef4444", 2);\n    line(origin.x, origin.y, yAxis.x, yAxis.y, "#22c55e", 2);\n    line(origin.x, origin.y, zAxis.x, zAxis.y, "#38bdf8", 2);\n    text("X", xAxis.x + 4, xAxis.y, "#ef4444", 10);\n    text("Y", yAxis.x - 10, yAxis.y + 2, "#22c55e", 10);\n    text("Z", zAxis.x + 4, zAxis.y - 4, "#38bdf8", 10);\n  };\n\n  const drawRoom = (ox, oy, tint) => {\n    setOrigin(ox, oy);\n    for (let x = 0; x < grid; x++) {\n      for (let y = 0; y < grid; y++) {\n        voxel(x - half, y - half, 0, size, tint.floor);\n      }\n    }\n    for (let z = 1; z < 5; z++) {\n      for (let x = 0; x < grid; x++) {\n        voxel(x - half, -half, z, size, tint.wall);\n      }\n      for (let y = 0; y < grid; y++) {\n        voxel(-half, y - half, z, size, tint.wall);\n      }\n    }\n  };\n\n  const drawReference = (ox, oy) => {\n    setOrigin(ox, oy);\n    for (let x = 1; x <= 4; x++) {\n      for (let y = 1; y <= 4; y++) {\n        let z = 1;\n        if (x <= 3 && y <= 3) z = 2;\n        if (x <= 2 && y <= 2) z = 3;\n        voxel(x - half, y - half, z, size, { top: "#fbcfe8", left: "#f472b6", right: "#ec4899" });\n      }\n    }\n    for (let y = 2; y <= 4; y++) {\n      voxel(4 - half, y - half, 1, size, { top: "#a5b4fc", left: "#818cf8", right: "#6366f1" });\n    }\n  };\n\n  const drawOutput = (ox, oy, t) => {\n    setOrigin(ox, oy);\n    for (let x = 1; x <= 5; x++) {\n      for (let y = 1; y <= 5; y++) {\n        const wave = Math.sin(t + x * 0.7 + y * 0.5);\n        const z = 1 + Math.round((wave + 1) * 1.2);\n        voxel(x - half, y - half, z, size, { top: "#a7f3d0", left: "#34d399", right: "#059669" });\n      }\n    }\n  };\n\n  let last = 0;\n  let t = 0;\n  const loop = (timestamp) => {\n    const dt = timestamp - last || 16;\n    last = timestamp;\n    t += dt * 0.001;\n    clear(colors.background);\n    rect(0, 0, canvas.width, 40, colors.header);\n    text("Replicube", 16, 24, "#e2e8f0", 16);\n    text("Voxel Lab", 120, 24, "#94a3b8", 11);\n\n    const pad = 14;\n    const gap = 12;\n    const panelW = canvas.width - pad * 2;\n    const panelH = (canvas.height - 40 - pad * 2 - gap) / 2;\n    const topY = 40 + pad;\n    const bottomY = topY + panelH + gap;\n\n    panel(pad, topY, panelW, panelH, "Reference Object");\n    panel(pad, bottomY, panelW, panelH, "Output");\n\n    const refOriginX = pad + panelW * 0.6;\n    const refOriginY = topY + panelH * 0.75;\n    const outOriginX = pad + panelW * 0.6;\n    const outOriginY = bottomY + panelH * 0.75;\n\n    drawRoom(refOriginX, refOriginY, {\n      floor: { top: "#1f2937", left: "#111827", right: "#0f172a" },\n      wall: { top: "#64748b", left: "#475569", right: "#334155" },\n    });\n    drawReference(refOriginX, refOriginY);\n    drawAxes(refOriginX, refOriginY);\n\n    drawRoom(outOriginX, outOriginY, {\n      floor: { top: "#1f2937", left: "#111827", right: "#0f172a" },\n      wall: { top: "#64748b", left: "#475569", right: "#334155" },\n    });\n    drawOutput(outOriginX, outOriginY, t);\n    drawAxes(outOriginX, outOriginY);\n\n    const match = Math.round(88 + Math.abs(Math.sin(t * 0.8)) * 8);\n    text("Match: " + match + "%", pad + panelW - 120, bottomY + 18, "#e2e8f0", 11);\n\n    requestAnimationFrame(loop);\n  };\n\n  requestAnimationFrame(loop);\n}'
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
    const [codeLabAiReasoning, setCodeLabAiReasoning] = useState<string>('');
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
    const [imageActivityError, setImageActivityError] = useState<string | null>(null);
    const [visualActivityTab, setVisualActivityTab] = useState<'image' | '3d'>('image');
    const [useDocumentContext, setUseDocumentContext] = useState(true); // Default to true - use document if available
    const [isExtractingContext, setIsExtractingContext] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(true);

    // Image Activity Mode (Generate vs Upload)
    const [imageActivityMode, setImageActivityMode] = useState<'generate' | 'upload'>('generate');
    const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
    const [isUploadingImage, setIsUploadingImage] = useState(false);

    // Interactive Image Activity States
    const [imageActivityLabels, setImageActivityLabels] = useState<InteractiveLabel[]>([]);
    const [selectedImageLabel, setSelectedImageLabel] = useState<InteractiveLabel | null>(null);
    const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);
    const [imageQuizMode, setImageQuizMode] = useState(false);
    const [imageQuizType, setImageQuizType] = useState<'find' | 'write'>('find');
    const [imageQuizCorrect, setImageQuizCorrect] = useState<string[]>([]);
    const [imageQuizWrong, setImageQuizWrong] = useState<string | null>(null);
    const [imageRevealedLabels, setImageRevealedLabels] = useState<string[]>([]);
    const [imageUserGuess, setImageUserGuess] = useState('');
    const [imageGuessError, setImageGuessError] = useState(false);
    const [imageContainerRef, setImageContainerRef] = useState<HTMLDivElement | null>(null);
    const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
    const [enhancedLabelInfo, setEnhancedLabelInfo] = useState<EnhancedLabelInfo | null>(null);
    const [isLoadingEnhancedInfo, setIsLoadingEnhancedInfo] = useState(false);

    // LocalStorage key for persisting immersive learning content
    // Removed - now using Firebase

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

            const responseText = await generateTextContent(prompt, {
                model: 'gemini-3-flash-preview',
                maxOutputTokens: 512,
            });

            const json = extractJsonBlock(responseText);
            const parsed = JSON.parse(json);

            return {
                name: parsed?.name || fileName.replace(/\.[^/.]+$/, ''),
                description: parsed?.description || 'Learning workspace',
                emoji: parsed?.emoji || '📚'
            };

        } catch (e) {
            console.error('Failed to generate workspace name:', e);
        }
        return {
            name: fileName.replace(/\.[^/.]+$/, '') || 'Untitled',
            description: 'Learning workspace',
            emoji: '📚'
        };
    };

    // Save current state as a new workspace (local)
    const saveCurrentAsWorkspace = async () => {
        if (!immersiveContent || !documentTextRef.current) {
            console.log('No content to save as workspace');
            return null;
        }

        setIsCreatingWorkspace(true);
        try {
            const { name, description, emoji } = await generateWorkspaceName(immersiveContent, uploadedFileName);

            const workspace: LocalImmersiveWorkspace = {
                id: `workspace_${Date.now()}_${Math.random().toString(36).substring(7)}`,
                name,
                description,
                thumbnailEmoji: emoji,
                documentFileName: uploadedFileName,
                documentMimeType,
                documentFileId,
                documentIsFallback,
                documentText: documentTextRef.current,
                immersiveContent,
                sectionImages,
                widgetImages,
                quiz,
                audioScript: audioScript || null,
                reactFlowData,
                relevantVideos,
                pdfUrl,
                activeSectionId: activeSectionId || null,
                createdAt: Date.now(),
                updatedAt: Date.now(),
                // Save current mode-specific content
                mindMapData: mindMap || null,
                simulationData: simulationBlueprint || simulationHTML ? {
                    blueprint: simulationBlueprint,
                    html: simulationHTML,
                } : null,
                codeLabData: codeLabFiles.length > 0 ? {
                    files: codeLabFiles,
                    activeFileId: codeLabActiveFileId,
                    language: codeLabLanguage,
                    theme: codeLabTheme,
                } : null,
                imageActivityData: imageActivityPrompt || generatedImageActivityUrl ? {
                    prompt: imageActivityPrompt,
                    generatedImageUrl: generatedImageActivityUrl,
                } : null,
                roboticsData: detectedObjects.length > 0 || boundingBoxes.length > 0 || sceneDescription ? {
                    detectedObjects,
                    boundingBoxes,
                    sceneDescription,
                    analysisMode,
                } : null,
                viewer3dData: viewer3dModelUrl ? {
                    modelUrl: viewer3dModelUrl,
                    modelName: viewer3dModelName,
                    rotation: viewer3dRotation,
                    position: viewer3dPosition,
                    scale: viewer3dScale,
                    interactionMode: viewer3dInteractionMode,
                } : null,
                brainstormActivities: brainstormActivities || {},
                scienceTeacherData: scienceTeacherMessages.length > 1 ? {
                    messages: scienceTeacherMessages,
                } : null,
            };

            const keys = getLocalStorageKeys();
            const updated = [workspace, ...savedWorkspaces];
            localStorage.setItem(keys.WORKSPACES, JSON.stringify(updated));
            localStorage.setItem(keys.ACTIVE, workspace.id);

            setSavedWorkspaces(updated);
            setActiveWorkspaceId(workspace.id);
            setShowWorkspaceManager(false);

            console.log('💾 Saved new workspace locally:', workspace.name);
            return workspace;
        } catch (e) {
            console.error('Failed to save workspace:', e);
            return null;
        } finally {
            setIsCreatingWorkspace(false);
        }
    };

    // Save workspace with provided content (local)
    const saveWorkspaceWithContent = async (content: ImmersiveContent, fileName: string, docText: string) => {
        if (!content) {
            console.log('No content provided to save as workspace');
            return null;
        }

        setIsCreatingWorkspace(true);
        try {
            const { name, description, emoji } = await generateWorkspaceName(content, fileName);

            const workspace: LocalImmersiveWorkspace = {
                id: `workspace_${Date.now()}_${Math.random().toString(36).substring(7)}`,
                name,
                description,
                thumbnailEmoji: emoji,
                documentFileName: fileName,
                documentMimeType,
                documentFileId,
                documentIsFallback,
                documentText: docText,
                immersiveContent: content,
                sectionImages: {},
                widgetImages: {},
                quiz: [],
                audioScript: null,
                reactFlowData: null,
                relevantVideos: [],
                pdfUrl,
                activeSectionId: content.sections?.[0]?.id || null,
                createdAt: Date.now(),
                updatedAt: Date.now(),
                // Initialize mode-specific content fields
                mindMapData: null,
                simulationData: null,
                codeLabData: null,
                imageActivityData: null,
                roboticsData: null,
                viewer3dData: null,
                brainstormActivities: {},
                scienceTeacherData: null,
            };

            const keys = getLocalStorageKeys();
            const updated = [workspace, ...savedWorkspaces];
            localStorage.setItem(keys.WORKSPACES, JSON.stringify(updated));
            localStorage.setItem(keys.ACTIVE, workspace.id);

            setSavedWorkspaces(updated);
            setActiveWorkspaceId(workspace.id);
            console.log('💾 Saved new workspace with content locally:', workspace.name);
            return workspace;
        } catch (e) {
            console.error('Failed to save workspace with content:', e);
            return null;
        } finally {
            setIsCreatingWorkspace(false);
        }
    };

    // Update existing workspace with current state (local)
    const updateWorkspace = async (workspaceId: string) => {
        try {
            const keys = getLocalStorageKeys();
            const updatedWorkspaces = savedWorkspaces.map(ws => {
                if (ws.id !== workspaceId) return ws;
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
                    activeSectionId: activeSectionId || null,
                    documentMimeType,
                    documentFileId,
                    documentIsFallback,
                    // Save mode-specific content
                    mindMapData: mindMap || null,
                    simulationData: simulationBlueprint || simulationHTML ? {
                        blueprint: simulationBlueprint,
                        html: simulationHTML,
                    } : null,
                    codeLabData: codeLabFiles.length > 0 ? {
                        files: codeLabFiles,
                        activeFileId: codeLabActiveFileId,
                        language: codeLabLanguage,
                        theme: codeLabTheme,
                    } : null,
                    imageActivityData: imageActivityPrompt || generatedImageActivityUrl ? {
                        prompt: imageActivityPrompt,
                        generatedImageUrl: generatedImageActivityUrl,
                    } : null,
                    roboticsData: detectedObjects.length > 0 || boundingBoxes.length > 0 || sceneDescription ? {
                        detectedObjects,
                        boundingBoxes,
                        sceneDescription,
                        analysisMode,
                    } : null,
                    viewer3dData: viewer3dModelUrl ? {
                        modelUrl: viewer3dModelUrl,
                        modelName: viewer3dModelName,
                        rotation: viewer3dRotation,
                        position: viewer3dPosition,
                        scale: viewer3dScale,
                        interactionMode: viewer3dInteractionMode,
                    } : null,
                    brainstormActivities: brainstormActivities || {},
                    scienceTeacherData: scienceTeacherMessages.length > 1 ? {
                        messages: scienceTeacherMessages,
                    } : null,
                };
            });
            localStorage.setItem(keys.WORKSPACES, JSON.stringify(updatedWorkspaces));
            setSavedWorkspaces(updatedWorkspaces);
            console.log('💾 Updated workspace locally:', workspaceId);
        } catch (error) {
            console.error('Failed to update workspace:', error);
        }
    };

    // Open an existing workspace
    const openWorkspace = async (workspace: LocalImmersiveWorkspace) => {
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
        setDocumentMimeType(workspace.documentMimeType || null);
        setDocumentFileId(workspace.documentFileId || null);
        setDocumentIsFallback(Boolean(workspace.documentIsFallback));

        // Restore mode-specific content
        if (workspace.mindMapData) {
            setMindMap(workspace.mindMapData);
        }
        if (workspace.simulationData) {
            setSimulationBlueprint(workspace.simulationData.blueprint);
            setSimulationHTML(workspace.simulationData.html);
        }

        if (workspace.codeLabData) {
            setCodeLabFiles(workspace.codeLabData.files);
            setCodeLabActiveFileId(workspace.codeLabData.activeFileId);
            setCodeLabLanguage(workspace.codeLabData.language);
            setCodeLabTheme(workspace.codeLabData.theme);
            const activeFile = workspace.codeLabData.files.find(f => f.id === workspace.codeLabData?.activeFileId);
            if (activeFile) {
                setCodeLabCode(activeFile.content);
            }
        }

        if (workspace.roboticsData) {
            setDetectedObjects(workspace.roboticsData.detectedObjects);
            setBoundingBoxes(workspace.roboticsData.boundingBoxes);
            setSceneDescription(workspace.roboticsData.sceneDescription);
            setAnalysisMode(workspace.roboticsData.analysisMode);
        }
        if (workspace.viewer3dData) {
            setViewer3dModelUrl(workspace.viewer3dData.modelUrl);
            setViewer3dModelName(workspace.viewer3dData.modelName);
            setViewer3dRotation(workspace.viewer3dData.rotation);
            setViewer3dPosition(workspace.viewer3dData.position);
            setViewer3dScale(workspace.viewer3dData.scale);
            setViewer3dInteractionMode(workspace.viewer3dData.interactionMode);
        }
        if (workspace.brainstormActivities) {
            setBrainstormActivities(workspace.brainstormActivities);
        }
        if (workspace.scienceTeacherData) {
            setScienceTeacherMessages(workspace.scienceTeacherData.messages);
        }

        // Restore PDF URL from IndexedDB if possible
        if (workspace.documentFileId && (workspace.documentMimeType === 'application/pdf' || workspace.documentFileName?.toLowerCase().endsWith('.pdf'))) {
            try {
                const uid = getCurrentUserId() || 'anonymous';
                const record = await getImmersiveLearningFile({ userId: uid, fileId: workspace.documentFileId });
                if (record?.blob) {
                    const url = URL.createObjectURL(record.blob);
                    setPdfUrl(url);
                } else {
                    setPdfUrl(null);
                }
            } catch (e) {
                console.error('Failed to load workspace file from IndexedDB:', e);
                setPdfUrl(null);
            }
        } else {
            setPdfUrl(null);
        }
        setUploadedFileName(workspace.documentFileName);
        const activeId = workspace.activeSectionId || workspace.immersiveContent?.sections?.[0]?.id || '';
        setActiveSectionId(activeId);

        setActiveWorkspaceId(workspace.id);
        try {
            const keys = getLocalStorageKeys();
            localStorage.setItem(keys.ACTIVE, workspace.id);
        } catch { }
        setShowWorkspaceManager(false);
        setActiveMode('immersive-text'); // Switch to content view
    };

    // Delete a workspace (local + IndexedDB blob)
    const deleteWorkspace = async (workspaceId: string) => {
        try {
            const keys = getLocalStorageKeys();
            const ws = savedWorkspaces.find(w => w.id === workspaceId);

            if (ws?.documentFileId) {
                const uid = getCurrentUserId() || 'anonymous';
                await deleteImmersiveLearningFile({ userId: uid, fileId: ws.documentFileId });
            }

            const updatedWorkspaces = savedWorkspaces.filter(w => w.id !== workspaceId);
            localStorage.setItem(keys.WORKSPACES, JSON.stringify(updatedWorkspaces));
            setSavedWorkspaces(updatedWorkspaces);

            const updatedSpaces = userSpaces.filter(s => s.workspaceId !== workspaceId);
            localStorage.setItem(keys.SPACES, JSON.stringify(updatedSpaces));
            setUserSpaces(updatedSpaces);

            if (activeWorkspaceId === workspaceId) {
                setActiveWorkspaceId(null);
                localStorage.removeItem(keys.ACTIVE);
            }
            console.log('🗑️ Deleted workspace locally:', workspaceId);
        } catch (error) {
            console.error('Failed to delete workspace:', error);
        }
    };

    // ========== USER SPACES TRACKING SYSTEM ==========
    // Track when users use different modes/spaces (similar to Hugging Face Spaces)

    // Space metadata mapping
    const getSpaceMetadata = (mode: LearningMode): { name: string; description: string; emoji: string } => {
        const metadata: Record<LearningMode, { name: string; description: string; emoji: string }> = {
            'source': { name: 'Source', description: 'Document sources and notebooks', emoji: '📚' },
            'immersive-text': { name: 'Immersive Text', description: 'Interactive text learning with AI insights', emoji: '📖' },
            'audio-video': { name: 'Audio Video', description: 'Video lessons with audio narration and interactive features', emoji: '🎬' },
            'mindmap': { name: 'Mind Map', description: 'Visual mind mapping and concept connections', emoji: '🧠' },
            'simulation': { name: 'Simulation', description: 'Interactive simulations and experiments', emoji: '🔬' },
            'robotics': { name: 'Robotics Vision', description: 'Robotics and computer vision tools', emoji: '🤖' },
            'visual-activity': { name: 'Visual Activity', description: '3D visualization and image generation activities', emoji: '🎨' },
            'code-lab': { name: 'Code Lab', description: 'Interactive coding environment', emoji: '💻' },
            'replicube-lab': { name: 'Voxel Lab', description: 'Lua-powered voxel programming puzzles', emoji: '[vox]' },
            'assignment': { name: 'Study Tools', description: 'Practice tools and study workflows', emoji: '📝' },
            'latex-assignment': { name: 'LaTeX', description: 'LaTeX document preparation and editing', emoji: '📄' },
            'notebook': { name: 'Notebook', description: 'Research notebook and AI-powered learning workspace', emoji: '📓' },
            'learning-theories': { name: 'Learning Theories', description: 'AI-powered optimal learning approach selection', emoji: '🎓' },
            'socratic': { name: 'Socratic Tutor', description: 'Learn through Socratic dialogue', emoji: '🤔' },
            'feynman-enhanced': { name: 'Feynman Method', description: 'Learn by teaching', emoji: '👨‍🏫' }
        };
        return metadata[mode] || { name: 'Unknown', description: 'Unknown space type', emoji: '❓' };
    };

    // Track space usage when user switches modes (local)
    const trackSpaceUsage = useCallback((mode: LearningMode, workspaceId: string | null = null) => {
        if (mode === 'source') return; // Don't track source mode
        try {
            const keys = getLocalStorageKeys();
            const metadata = getSpaceMetadata(mode);
            const existingSpaces = JSON.parse(localStorage.getItem(keys.SPACES) || '[]') as LocalUserSpace[];

            const idx = existingSpaces.findIndex(s => s.mode === mode);
            if (idx >= 0) {
                existingSpaces[idx] = {
                    ...existingSpaces[idx],
                    lastUsed: Date.now(),
                    usageCount: (existingSpaces[idx].usageCount || 0) + 1,
                    workspaceId: workspaceId || existingSpaces[idx].workspaceId,
                };
            } else {
                existingSpaces.push({
                    id: `space_${mode}_${Date.now()}`,
                    mode,
                    name: metadata.name,
                    description: metadata.description,
                    emoji: metadata.emoji,
                    workspaceId,
                    lastUsed: Date.now(),
                    usageCount: 1,
                });
            }

            existingSpaces.sort((a, b) => b.lastUsed - a.lastUsed);
            localStorage.setItem(keys.SPACES, JSON.stringify(existingSpaces));
            setUserSpaces(existingSpaces);
        } catch (e) {
            console.error('Failed to track space usage:', e);
        }
    }, [getLocalStorageKeys]);

    // Load user spaces from localStorage
    useEffect(() => {
        try {
            const keys = getLocalStorageKeys();
            const saved = localStorage.getItem(keys.SPACES);
            if (saved) {
                const spaces = JSON.parse(saved) as LocalUserSpace[];
                spaces.sort((a, b) => b.lastUsed - a.lastUsed);
                setUserSpaces(spaces);
            }
        } catch (e) {
            console.error('Failed to load user spaces:', e);
        }
    }, [getLocalStorageKeys]);

    // Track space usage when mode changes
    useEffect(() => {
        if (activeMode && activeMode !== 'source') {
            try {
                trackSpaceUsage(activeMode, activeWorkspaceId);
            } catch (error) {
                console.error('Error tracking space usage:', error);
            }
        }
    }, [activeMode, activeWorkspaceId, trackSpaceUsage]);

    const openSpace = async (space: LocalUserSpace) => {
        setUserSpaces((prev) => prev); // Dummy usage if setShowUserSpaces intended, or remove if causing error. 
        // Based on error "Did you mean 'setUserSpaces'?", but logic seems to hide spaces ui.
        // Assuming setShowUserSpaces IS defined but not found in scope or typoed.
        // Looking at file, setShowWorkspaceManager is used nearby line 2026.
        // Maybe it meant setShowWorkspaceManager(false)?
        // Or maybe setSidebarOpen(false)?
        // Let's assume it was meant to be setShowWorkspaceManager per line 2026.
        setShowWorkspaceManager(false);
        const targetMode = space.mode === 'latex-assignment' ? 'assignment' : space.mode;
        if (space.mode === 'latex-assignment') {
            setAssignmentTab('latex-prep');
        }

        // If space has a linked workspace, open it locally (this will restore all content)
        if (space.workspaceId) {
            const localWorkspace = savedWorkspaces.find(ws => ws.id === space.workspaceId);
            if (localWorkspace) {
                await openWorkspace(localWorkspace);
                // After opening workspace, switch to the space's mode to show the correct view
                setActiveMode(targetMode);
            } else {
                // Workspace not found, just switch to mode
                setActiveMode(targetMode);
            }
        } else {
            // No workspace linked, just switch to mode
            setActiveMode(targetMode);
        }

        // Update last used
        trackSpaceUsage(targetMode, space.workspaceId);
    };

    // Delete a space
    const deleteSpace = async (spaceId: string) => {
        try {
            const updatedSpaces = userSpaces.filter(space => space.id !== spaceId);
            const keys = getLocalStorageKeys();
            localStorage.setItem(keys.SPACES, JSON.stringify(updatedSpaces));
            setUserSpaces(updatedSpaces);
            console.log('🗑️ Deleted user space locally:', spaceId);
        } catch (error) {
            console.error('Failed to delete user space:', error);
        }
    };

    // Filter spaces by search query
    const filteredSpaces = userSpaces.filter(space =>
        space.name.toLowerCase().includes(spaceSearchQuery.toLowerCase()) ||
        space.description.toLowerCase().includes(spaceSearchQuery.toLowerCase()) ||
        space.mode.toLowerCase().includes(spaceSearchQuery.toLowerCase())
    );

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
        setDocumentFileId(null);
        setDocumentMimeType(null);
        setDocumentIsFallback(false);
        setUploadedFileName('');
        setActiveSectionId('');
        documentTextRef.current = '';
        setActiveWorkspaceId(null);
        try {
            const keys = getLocalStorageKeys();
            localStorage.removeItem(keys.ACTIVE);
        } catch { }
        // Don't hide workspace manager - stay on source page and trigger file upload
        // setShowWorkspaceManager(false);
        // Trigger file upload dialog
        setTimeout(() => {
            fileInputRef.current?.click();
        }, 100);
    };

    // Load workspaces from localStorage on mount
    useEffect(() => {
        setIsLoadingWorkspaces(true);
        try {
            const keys = getLocalStorageKeys();
            const saved = localStorage.getItem(keys.WORKSPACES);
            if (saved) {
                const workspaces = JSON.parse(saved) as LocalImmersiveWorkspace[];
                workspaces.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
                setSavedWorkspaces(workspaces);
            }
            const active = localStorage.getItem(keys.ACTIVE);
            if (active) setActiveWorkspaceId(active);
        } catch (e) {
            console.error('Failed to load workspaces:', e);
        } finally {
            setIsLoadingWorkspaces(false);
        }
    }, [getLocalStorageKeys]);

    // Auto-save to active workspace when content changes (local, debounced)
    // Saves all mode-specific content so users can resume where they left off
    useEffect(() => {
        if (!activeWorkspaceId) return;
        // Don't require immersiveContent - some modes (code-lab, assignment, etc.) don't need it

        const t = setTimeout(() => {
            updateWorkspace(activeWorkspaceId);
        }, 1500);

        return () => clearTimeout(t);
    }, [
        activeWorkspaceId,
        immersiveContent,
        sectionImages,
        widgetImages,
        quiz,
        audioScript,
        reactFlowData,
        relevantVideos,
        pdfUrl,
        activeSectionId,
        documentMimeType,
        documentFileId,
        documentIsFallback,
        // Mode-specific content dependencies
        mindMap,
        simulationBlueprint,
        simulationHTML,
        codeLabFiles,
        codeLabActiveFileId,
        codeLabLanguage,
        codeLabTheme,
        imageActivityPrompt,
        generatedImageActivityUrl,
        detectedObjects,
        boundingBoxes,
        sceneDescription,
        analysisMode,
        viewer3dModelUrl,
        viewer3dModelName,
        viewer3dRotation,
        viewer3dPosition,
        viewer3dScale,
        viewer3dInteractionMode,
        brainstormActivities,
    ]);

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

        // Generate missing images for ALL sections using Imagen API (PARALLEL)
        const generateMissingImages = async () => {
            if (!needsImages) return;

            // Find all sections with imagePrompts that don't have images yet
            const sectionsNeedingImages = immersiveContent.sections.filter(
                s => s.imagePrompt && !sectionImages[s.id]
            );

            if (sectionsNeedingImages.length === 0) {
                console.log('✅ All images already generated.');
                return;
            }

            console.log(`🖼️ Generating missing academic images for ${sectionsNeedingImages.length} section(s) using Imagen API...`);

            // Mark all sections as loading
            const loadingState: { [key: string]: boolean } = {};
            sectionsNeedingImages.forEach(section => {
                loadingState[section.id] = true;
            });
            setLoadingImages(loadingState);

            // Generate ALL missing images in parallel
            const imagePromises = sectionsNeedingImages.map(async (section, index) => {
                try {
                    console.log(`🖼️ [${index + 1}/${sectionsNeedingImages.length}] Generating missing image for "${section.title}"`);
                    console.log(`   Using Imagen API with prompt: ${section.imagePrompt?.substring(0, 100)}...`);

                    const imageUrl = await generateImmersiveImage(section.imagePrompt!);
                    setSectionImages(prev => ({ ...prev, [section.id]: imageUrl }));
                    setLoadingImages(prev => ({ ...prev, [section.id]: false }));

                    console.log(`✅ Successfully generated image for "${section.title}"`);
                    return { sectionId: section.id, success: true };
                } catch (e) {
                    console.error(`❌ Failed to generate image for "${section.title}" (${section.id}):`, e);
                    setLoadingImages(prev => ({ ...prev, [section.id]: false }));
                    return { sectionId: section.id, success: false };
                }
            });

            // Wait for all images to complete (in parallel)
            const results = await Promise.allSettled(imagePromises);
            const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
            console.log(`✅ Missing image generation complete. Generated ${successful}/${sectionsNeedingImages.length} image(s) using Imagen API.`);
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

    // Auto-load brainstorm activity when active section changes (if pre-generated)
    useEffect(() => {
        if (activeSectionId && brainstormActivities[activeSectionId] && !brainstormActivity) {
            // Only auto-load if no activity is currently shown
            const activity = brainstormActivities[activeSectionId];
            setBrainstormActivity(activity);
            setShowBrainstormHints(new Array(activity.hints.length).fill(false));
            setShowBrainstormApproaches(false);
            setShowBrainstormInsight(false);
        } else if (activeSectionId && brainstormActivities[activeSectionId] && brainstormActivity) {
            // Switch to the new section's activity
            const activity = brainstormActivities[activeSectionId];
            setBrainstormActivity(activity);
            setShowBrainstormHints(new Array(activity.hints.length).fill(false));
            setShowBrainstormApproaches(false);
            setShowBrainstormInsight(false);
        }
    }, [activeSectionId, brainstormActivities]);

    // (ImmersiveLearning persistence is local on-device; see local auto-save effect near workspace loader)

    // Keep refs in sync with state
    useEffect(() => {
        viewer3dInteractionModeRef.current = viewer3dInteractionMode;
    }, [viewer3dInteractionMode]);

    // Load and render GLB/GLTF files using Three.js
    useEffect(() => {
        const canvas = viewer3dThreeCanvasRef.current;
        if (!canvas || !viewer3dModelUrl || viewer3dModelUrl.startsWith('demo:')) {
            // Clean up if no model or demo shape
            setViewer3dModelLoading(false);
            if (viewer3dSceneRef.current) {
                // Dispose of existing scene
                const scene = viewer3dSceneRef.current;
                scene.traverse((object: any) => {
                    if (object.geometry) object.geometry.dispose();
                    if (object.material) {
                        if (Array.isArray(object.material)) {
                            object.material.forEach((mat: any) => mat.dispose());
                        } else {
                            object.material.dispose();
                        }
                    }
                });
                viewer3dSceneRef.current = null;
            }
            if (viewer3dRendererRef.current) {
                viewer3dRendererRef.current.dispose();
                viewer3dRendererRef.current = null;
            }
            viewer3dModelRef.current = null;
            return;
        }

        // Wait for canvas to be properly sized
        const initThree = () => {
            if (!canvas || canvas.clientWidth === 0 || canvas.clientHeight === 0) {
                setTimeout(initThree, 100);
                return;
            }

            // Initialize Three.js scene
            const scene = new THREE.Scene();
            scene.background = new THREE.Color(0xeeeeee);
            viewer3dSceneRef.current = scene;

            const camera = new THREE.PerspectiveCamera(75, canvas.clientWidth / canvas.clientHeight, 0.1, 1000);
            camera.position.set(0, 0, 5);
            viewer3dCameraRef.current = camera;

            const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
            renderer.setSize(canvas.clientWidth, canvas.clientHeight);
            renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
            viewer3dRendererRef.current = renderer;

            // Add lights
            const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
            scene.add(ambientLight);
            const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
            directionalLight.position.set(5, 5, 5);
            scene.add(directionalLight);

            // Load GLB/GLTF model
            const loader = new GLTFLoader();
            let animationFrameId: number;

            setViewer3dModelLoading(true);

            loader.load(
                viewer3dModelUrl,
                (gltf) => {
                    setViewer3dModelLoading(false);
                    // Remove old model if exists
                    if (viewer3dModelRef.current) {
                        scene.remove(viewer3dModelRef.current);
                    }

                    const model = gltf.scene;
                    viewer3dModelRef.current = model;

                    // Center and scale model
                    const box = new THREE.Box3().setFromObject(model);
                    const center = box.getCenter(new THREE.Vector3());
                    const size = box.getSize(new THREE.Vector3());
                    const maxDim = Math.max(size.x, size.y, size.z);
                    const scale = 2 / maxDim; // Scale to fit in 2 unit space
                    model.scale.multiplyScalar(scale);
                    model.position.sub(center.multiplyScalar(scale));

                    scene.add(model);

                    // Animation loop
                    const animate = () => {
                        animationFrameId = requestAnimationFrame(animate);

                        // Apply transforms
                        if (model) {
                            model.rotation.x = THREE.MathUtils.degToRad(viewer3dRotation.x);
                            model.rotation.y = THREE.MathUtils.degToRad(viewer3dRotation.y);
                            model.rotation.z = THREE.MathUtils.degToRad(viewer3dRotation.z);
                            model.position.x = viewer3dPosition.x * 0.01;
                            model.position.y = -viewer3dPosition.y * 0.01;
                            model.scale.setScalar(viewer3dScale);
                        }

                        renderer.render(scene, camera);
                    };
                    animate();
                },
                (progress) => {
                    // Loading progress
                    console.log('Loading progress:', (progress.loaded / progress.total) * 100 + '%');
                },
                (error) => {
                    console.error('Error loading GLB/GLTF:', error);
                    setViewer3dModelLoading(false);
                    alert('Failed to load 3D model. Please check the file format and try again.');
                }
            );

            // Handle window resize
            const handleResize = () => {
                if (canvas && camera && renderer) {
                    camera.aspect = canvas.clientWidth / canvas.clientHeight;
                    camera.updateProjectionMatrix();
                    renderer.setSize(canvas.clientWidth, canvas.clientHeight);
                }
            };
            window.addEventListener('resize', handleResize);

            // Cleanup
            return () => {
                window.removeEventListener('resize', handleResize);
                if (animationFrameId) {
                    cancelAnimationFrame(animationFrameId);
                }
                if (viewer3dRendererRef.current) {
                    viewer3dRendererRef.current.dispose();
                }
                if (viewer3dSceneRef.current) {
                    const scene = viewer3dSceneRef.current;
                    scene.traverse((object: any) => {
                        if (object.geometry) object.geometry.dispose();
                        if (object.material) {
                            if (Array.isArray(object.material)) {
                                object.material.forEach((mat: any) => mat.dispose());
                            } else {
                                object.material.dispose();
                            }
                        }
                    });
                }
            };
        };

        const cleanup = initThree();
        return cleanup;
    }, [viewer3dModelUrl, viewer3dRotation, viewer3dPosition, viewer3dScale]);

    // Keep document text reference in sync when using standalone notes
    useEffect(() => {
        if (!immersiveContent) {
            documentTextRef.current = standaloneNotes;
        }
    }, [immersiveContent, standaloneNotes]);

    // Standalone notes upload (text/markdown preferred)
    const handleStandaloneNotesUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const text = typeof e.target?.result === 'string' ? e.target.result : '';
            setStandaloneNotes(text);
            setStandaloneNotesName(file.name);
            if (!standaloneTopic) {
                setStandaloneTopic(file.name.replace(/\.[^/.]+$/, ''));
            }
            if (!immersiveContent) {
                documentTextRef.current = text;
            }
        };

        reader.readAsText(file);
    };

    // Video Lessons Logic
    const handleFetchVideos = async () => {
        const sourceText = immersiveContent
            ? immersiveContent.sections.map(s => s.content).join('\n\n')
            : standaloneNotes;

        if (!sourceText.trim()) {
            return;
        }

        // Skip if already loading
        if (isLoadingVideos) {
            console.log('Videos are already being fetched, skipping...');
            return;
        }

        setIsLoadingVideos(true);
        try {
            console.log('🎬 Fetching relevant YouTube videos...');
            const videos = await fetchAndRankYouTubeVideos(sourceText);
            setRelevantVideos(videos);
            if (videos.length > 0) {
                setSelectedVideoIndex(0);
            }
            console.log('Found relevant videos:', videos.length);
        } catch (error) {
            console.error('Failed to fetch YouTube videos:', error);
        } finally {
            setIsLoadingVideos(false);
        }
    };

    // Audio Lesson Logic
    const handleGeneratePodcast = async () => {
        const sourceText = immersiveContent
            ? immersiveContent.sections.map(s => s.content).join('\n\n')
            : standaloneNotes;

        if (!sourceText.trim()) {
            setAudioGenerationError(true);
            return;
        }

        // Skip if already generated or currently generating
        if (podcastScript || isGeneratingScript || isGeneratingAudio) {
            console.log('Podcast already exists or is being generated, skipping...');
            return;
        }

        let script = '';

        // Derive a meaningful topic from the content or notes
        const topic = immersiveContent?.title
            || immersiveContent?.sections[0]?.title
            || standaloneTopic
            || standaloneNotesName
            || 'Educational Discussion';

        // 1. Generate Script (use separate loading state, not global isLoading)
        setIsGeneratingScript(true);
        setAudioGenerationError(false);
        try {
            script = await generatePodcastScript(
                topic,
                sourceText
            );
            setPodcastScript(script);
        } catch (error) {
            console.error('Failed to generate podcast script:', error);
            setIsGeneratingScript(false);
            setAudioGenerationError(true);
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
        const sourceText = documentTextRef.current || standaloneNotes;

        if (!sourceText || !sourceText.trim()) {
            setSimulationError('Add notes or upload a document first');
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
            const topic = immersiveContent?.title || standaloneTopic || standaloneNotesName || 'Educational Simulation';
            documentTextRef.current = sourceText;

            const result = await generateSimulation(
                sourceText,
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
                },
                assignmentSimulationActive ? { visualStyle: 'voxel' } : undefined
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

    const handleGenerateStandaloneMindMap = async () => {
        const text = documentTextRef.current || standaloneNotes;
        if (!text.trim()) {
            return;
        }

        setIsGeneratingStandaloneMindMap(true);
        try {
            const data = await generateReactFlowData(text);
            setReactFlowData(data);
        } catch (error) {
            console.error('Failed to generate mind map from notes:', error);
        } finally {
            setIsGeneratingStandaloneMindMap(false);
        }
    };

    const handleOpenDrawIOWorkspace = () => {
        // Helper function to escape XML special characters
        const escapeXML = (str: string): string => {
            return str
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&apos;');
        };

        try {
            // If we have a mind map, pre-load it into the Draw.io workspace via localStorage.
            if (reactFlowData && reactFlowData.nodes.length > 0) {
                const nodesXML = reactFlowData.nodes.map((node, index) => {
                    const x = Math.max(0, node.position?.x || (index * 200));
                    const y = Math.max(0, node.position?.y || (index * 100));
                    const label = escapeXML(node.data.label || 'Node');
                    const nodeId = escapeXML(node.id);
                    return `        <mxCell id="${nodeId}" value="${label}" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;" vertex="1" parent="1">
          <mxGeometry x="${x}" y="${y}" width="160" height="60" as="geometry" />
        </mxCell>`;
                }).join('\n');

                const edgesXML = reactFlowData.edges.map((edge, index) => {
                    const sourceId = escapeXML(edge.source);
                    const targetId = escapeXML(edge.target);
                    return `        <mxCell id="edge-${index}" value="" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;" edge="1" parent="1" source="${sourceId}" target="${targetId}">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>`;
                }).join('\n');

                const drawIOXML = `<?xml version="1.0" encoding="UTF-8"?>
<mxfile host="app.diagrams.net">
  <diagram name="MindMap" id="mindmap">
    <mxGraphModel dx="1422" dy="794" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1169" pageHeight="827" math="0" shadow="0">
      <root>
        <mxCell id="0" />
        <mxCell id="1" parent="0" />
${nodesXML}
${edgesXML}
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>`;

                localStorage.setItem(STORAGE_DIAGRAM_XML_KEY, drawIOXML);
            }
        } catch (error) {
            console.error('Failed to prepare draw.io diagram for workspace:', error);
        } finally {
            setShowDrawIOWorkspace(true);
        }
    };



    const renderStandaloneNotesPanel = (variant: 'light' | 'dark' = 'light') => {
        const isDark = variant === 'dark';

        return (
            <div className="rounded-xl p-6 bg-[#171717] border border-white/10 text-slate-100 shadow-lg relative overflow-hidden">
                {/* Subtle gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] via-transparent to-white/[0.02] pointer-events-none" />

                <div className="relative z-10 space-y-6">
                    {/* Header Section */}
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex-1 space-y-1.5">
                            <h3 className="text-sm font-semibold text-slate-100 leading-tight">Use your own notes</h3>
                            <p className="text-xs text-slate-400 leading-relaxed max-w-2xl">
                                Upload notes or paste text to generate audio lessons, mind maps, or simulations without a source document.
                            </p>
                        </div>
                        <label className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-lg cursor-pointer bg-white/10 text-slate-100 border border-white/20 hover:bg-white/15 transition-colors whitespace-nowrap flex-shrink-0">
                            <Upload className="w-4 h-4 flex-shrink-0" />
                            <span>{standaloneNotesName ? 'Replace notes' : 'Upload notes'}</span>
                            <input
                                ref={notesFileInputRef}
                                type="file"
                                accept=".txt,.md,.markdown,.doc,.docx,.pdf"
                                className="hidden"
                                onChange={handleStandaloneNotesUpload}
                            />
                        </label>
                    </div>

                    {/* Divider */}
                    <div className="h-px bg-white/10" />

                    {/* Form Fields */}
                    <div className="flex flex-col gap-6">
                        {/* Topic Input */}
                        <div className="flex flex-col gap-2.5">
                            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-0.5">
                                Topic or label
                            </label>
                            <input
                                value={standaloneTopic}
                                onChange={(event) => setStandaloneTopic(event.target.value)}
                                placeholder="e.g., SN1 vs SN2 mechanisms"
                                className="w-full h-10 px-4 py-2 text-sm bg-white/5 border border-white/10 text-white placeholder:text-slate-500 focus:ring-2 focus:ring-[#3b5b8a] focus:border-transparent outline-none transition-all rounded-lg"
                            />
                            <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                                {standaloneNotesName ? `Loaded: ${standaloneNotesName}` : 'Optional, used for titles and prompts.'}
                            </p>
                        </div>

                        {/* Notes Textarea */}
                        <div className="flex flex-col gap-2.5">
                            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-0.5">
                                Notes
                            </label>
                            <textarea
                                value={standaloneNotes}
                                onChange={(event) => setStandaloneNotes(event.target.value)}
                                rows={4}
                                placeholder="Paste notes, key steps, or a lesson outline..."
                                className="w-full min-h-[100px] px-4 py-3 text-sm resize-none bg-white/5 border border-white/10 text-white placeholder:text-slate-500 focus:ring-2 focus:ring-[#3b5b8a] focus:border-transparent outline-none transition-all rounded-lg"
                            />
                            <div className="flex items-center justify-between text-[11px] text-slate-400 mt-0.5">
                                <span className="leading-relaxed">
                                    {standaloneNotes ? `${standaloneNotes.length} characters` : 'Plain text/markdown recommended.'}
                                </span>
                                {standaloneNotes && (
                                    <button
                                        type="button"
                                        className="text-slate-300 hover:text-slate-100 underline transition-colors ml-4"
                                        onClick={() => {
                                            setStandaloneNotes('');
                                            setStandaloneNotesName('');
                                        }}
                                    >
                                        Clear
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
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
        if (activeMode !== 'audio-video' && assignmentAudioVideoTab) {
            setAssignmentAudioVideoTab(null);
        }
    }, [activeMode, assignmentAudioVideoTab]);

    useEffect(() => {
        if (activeMode !== 'mindmap' && assignmentMindmapActive) {
            setAssignmentMindmapActive(false);
        }
    }, [activeMode, assignmentMindmapActive]);

    useEffect(() => {
        if (activeMode !== 'visual-activity' && assignmentVisualActivityActive) {
            setAssignmentVisualActivityActive(false);
        }
    }, [activeMode, assignmentVisualActivityActive]);

    useEffect(() => {
        if (activeMode !== 'simulation' && assignmentSimulationActive) {
            setAssignmentSimulationActive(false);
        }
    }, [activeMode, assignmentSimulationActive]);

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
            case 'drag': return '#3b82f6';      // Blue - more readable than cyan
            case 'rotate': return '#8b5cf6';    // Purple - more readable than magenta
            case 'scale': return '#eab308';    // Gold/Yellow - more readable than bright yellow
            case 'animate': return '#f97316';   // Orange - more muted and readable
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
        if (activeMode !== 'visual-activity' && viewer3dWebcamActive) {
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
        { id: 'audio-video', icon: <SlidesIcon active={activeMode === 'audio-video'} />, label: 'Audio Video', activeColor: '#9334e9', activeBg: '#f3e8fd' },
        { id: 'mindmap', icon: <MindmapIcon active={activeMode === 'mindmap'} />, label: 'Mindmap', activeColor: '#4285f4', activeBg: '#e8f0fe' },
        { id: 'simulation', icon: <SimulationIcon active={activeMode === 'simulation'} />, label: 'Simulation', activeColor: '#ff6d01', activeBg: '#fff3e0' },
        { id: 'robotics', icon: <RoboticsIcon active={activeMode === 'robotics'} />, label: 'Robotics Vision', activeColor: '#00bcd4', activeBg: '#e0f7fa' },
        { id: 'visual-activity', icon: <Viewer3DIcon active={activeMode === 'visual-activity'} />, label: 'Visual Activity', activeColor: '#7c3aed', activeBg: '#ede9fe' },
        { id: 'code-lab', icon: <CodeLabIcon active={activeMode === 'code-lab'} />, label: 'Code Lab', activeColor: '#10b981', activeBg: '#d1fae5' },
        { id: 'replicube-lab', icon: <VoxelLabIcon active={activeMode === 'replicube-lab'} />, label: 'Voxel Lab', activeColor: '#06b6d4', activeBg: '#cffafe' },
        { id: 'assignment', icon: <AssignmentIcon active={activeMode === 'assignment'} />, label: 'Study Tools', activeColor: '#1a73e8', activeBg: '#e8f0fe' },
        { id: 'notebook', icon: <NotebookIcon active={activeMode === 'notebook'} />, label: 'Notebook', activeColor: '#8b5cf6', activeBg: '#ede9fe' }
    ];




    const handleStartToTGeneration = useCallback(async (node: ImmersivePlanNode) => {
        if (!node || !documentTextRef.current) return;

        setShowToTTree(false);
        setImmersiveContent(null);
        setProcessingStage('generating');
        setLoadingMessage('Generating content based on selected plan...');
        setIsStreaming(true);
        setShowCursor(true);
        setStreamedText('');
        setActiveMode('immersive-text');

        try {
            console.log('Starting ToT Generation with node:', node.id);
            // Clear terminal steps
            setTerminalSubSteps(['Initializing ToT Generation...']);

            const analysis = await generateImmersiveContentWithToT(
                documentTextRef.current,
                node,
                (msg) => setTerminalSubSteps(prev => [...prev, msg]),
                (chunk) => {
                    flushSync(() => {
                        setStreamedText(prev => prev + chunk);
                    });
                }
            );

            setIsStreaming(false);
            setShowCursor(false);
            setImmersiveContent(analysis);
            if (analysis.sections.length > 0) setActiveSectionId(analysis.sections[0].id);

            // Start background tasks
            const text = documentTextRef.current;

            // Background task: Generate academic images for ALL sections using Imagen API (PARALLEL)
            const generateImagesAsync = async () => {
                const sectionsWithImages = analysis.sections.filter(s => s.imagePrompt);
                if (sectionsWithImages.length === 0) return;

                const loadingState: { [key: string]: boolean } = {};
                sectionsWithImages.forEach(section => {
                    loadingState[section.id] = true;
                });
                setLoadingImages(loadingState);

                const imagePromises = sectionsWithImages.map(async (section, index) => {
                    try {
                        const imageUrl = await generateImmersiveImage(section.imagePrompt!);
                        setSectionImages(prev => ({ ...prev, [section.id]: imageUrl }));
                        setLoadingImages(prev => ({ ...prev, [section.id]: false }));
                        return { sectionId: section.id, success: true };
                    } catch (e) {
                        console.error(`❌ Failed to generate image for "${section.title}":`, e);
                        setLoadingImages(prev => ({ ...prev, [section.id]: false }));
                        return { sectionId: section.id, success: false };
                    }
                });

                await Promise.allSettled(imagePromises);
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

            const generateAudioAsync = async () => { try { const script = await generateAudioScript(text); setAudioScript(script); } catch (e) { console.error('Audio script failed', e); } };
            const generateMindMapAsync = async () => { try { const data = await generateReactFlowData(text); setReactFlowData(data); } catch (e) { console.error('Mindmap failed', e); } };
            const fetchVideosAsync = async () => { try { setIsLoadingVideos(true); const videos = await fetchAndRankYouTubeVideos(text); setRelevantVideos(videos); } catch (e) { console.warn(e); } finally { setIsLoadingVideos(false); } };

            Promise.allSettled([
                generateImagesAsync(),
                generateQuizAsync(),
                generateAudioAsync(),
                generateMindMapAsync(),
                fetchVideosAsync()
            ]).then(() => {
                console.log('ToT Background tasks complete');
            });

        } catch (e) {
            console.error('ToT Generation failed', e);
            setProcessingStage('idle');
            setIsStreaming(false);
            alert('ToT Generation failed: ' + (e instanceof Error ? e.message : String(e)));
        }
    }, []);

    const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) {
            console.warn('No file selected');
            return;
        }

        // Validate file
        if (file.size === 0) {
            alert('The selected file is empty. Please choose a different file.');
            return;
        }

        if (file.size > 100 * 1024 * 1024) { // 100MB limit
            alert('File is too large. Please choose a file smaller than 100MB.');
            return;
        }

        // Capture file name for use in async callbacks
        const fileName = file.name;

        // Clear previous content when uploading a new file
        console.log('📤 New file upload - clearing previous content...');
        setImmersiveContent(null);
        setSectionImages({});
        setWidgetImages({});
        setActiveSectionId('');
        setPdfUrl(null);
        setDocumentFileId(null);
        setDocumentMimeType(null);
        setDocumentIsFallback(false);
        documentTextRef.current = '';

        setIsLoading(true);
        setUploadedFileName(fileName);
        setProcessingStage('uploading');
        setLoadingMessage('Uploading document...');
        setTerminalSubSteps(['Initializing upload...']);

        // Create a workspace immediately (local) so user sees it in their workspace list
        let workspaceId: string | null = null;
        try {
            const baseName = fileName.replace(/\.[^/.]+$/, '') || 'Untitled';
            const workspace: LocalImmersiveWorkspace = {
                id: `workspace_${Date.now()}_${Math.random().toString(36).substring(7)}`,
                name: baseName,
                description: 'Learning workspace',
                thumbnailEmoji: '📚',
                createdAt: Date.now(),
                updatedAt: Date.now(),
                documentFileName: fileName,
                documentMimeType: file.type || null,
                documentFileId: null,
                documentIsFallback: false,
                documentText: '',
                immersiveContent: null,
                sectionImages: {},
                widgetImages: {},
                quiz: [],
                audioScript: null,
                reactFlowData: null,
                relevantVideos: [],
                pdfUrl: null,
                activeSectionId: null,
                mindMapData: null,
                simulationData: null,
                codeLabData: null,
                imageActivityData: null,
                roboticsData: null,
                viewer3dData: null,
                brainstormActivities: {},
                scienceTeacherData: null,
            };

            workspaceId = workspace.id;
            const keys = getLocalStorageKeys();
            const updated = [workspace, ...savedWorkspaces];
            localStorage.setItem(keys.WORKSPACES, JSON.stringify(updated));
            localStorage.setItem(keys.ACTIVE, workspaceId);

            setActiveWorkspaceId(workspaceId);
            setSavedWorkspaces(updated);
        } catch (e) {
            console.error('Failed to create workspace before upload:', e);
        }

        // Save file locally (IndexedDB) so it persists on this device
        let isFallbackUpload = false;
        try {
            setTerminalSubSteps(prev => [...prev, 'Saving file on device...']);
            const uid = getCurrentUserId() || 'anonymous';
            const fileId = `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
            await putImmersiveLearningFile({ userId: uid, fileId, file });

            setDocumentFileId(fileId);
            setDocumentMimeType(file.type || null);
            setDocumentIsFallback(false);

            // Create PDF URL for sidebar viewer (runtime)
            if (file.type === 'application/pdf') {
                const url = URL.createObjectURL(file);
                setPdfUrl(url);
                setTerminalSubSteps(prev => [...prev, 'PDF detected, preparing viewer...']);
            }

            // Persist file linkage into the workspace record
            if (workspaceId) {
                const keys = getLocalStorageKeys();
                setSavedWorkspaces(prev => {
                    const updatedWorkspaces = (prev || []).map(ws => {
                        if (ws.id !== workspaceId) return ws;
                        return {
                            ...ws,
                            updatedAt: Date.now(),
                            documentFileId: fileId,
                            documentMimeType: file.type || null,
                            documentIsFallback: false,
                        };
                    });
                    try {
                        localStorage.setItem(keys.WORKSPACES, JSON.stringify(updatedWorkspaces));
                    } catch { }
                    return updatedWorkspaces;
                });
            }
        } catch (uploadError: any) {
            console.error('Failed to save file locally (IndexedDB):', uploadError);
            isFallbackUpload = true;
            setDocumentIsFallback(true);
            setDocumentFileId(null);
            setDocumentMimeType(file.type || null);
            setTerminalSubSteps(prev => [...prev, '⚠️ Could not persist file on device (IndexedDB blocked)']);

            // At least allow viewing for this session
            if (file.type === 'application/pdf') {
                const url = URL.createObjectURL(file);
                setPdfUrl(url);
            }
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

            // === ToT BRANCH ===
            if (useToTGeneration) {
                setLoadingMessage('Generating Tree of Thoughts Plan (Deep Reasoning)...');
                setTerminalSubSteps(prev => [...prev, 'Exploring pedagogical approaches...', 'Building decision tree...']);
                setIsPlanningImmersive(true);

                const text = documentTextRef.current;
                const plan = await generateImmersivePlanTree(text);

                setImmersiveToTPlan(plan);
                setShowToTTree(true);
                setIsPlanningImmersive(false);
                setIsLoading(false);
                setProcessingStage('idle');

                return;
            }


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
            let analysis;
            try {
                analysis = await streamAnalyzeDocumentForImmersive(
                    text,
                    (currentStreamedText, isComplete) => {
                        try {
                            // Use flushSync to force immediate DOM update for streaming effect
                            flushSync(() => {
                                setStreamedText(currentStreamedText);
                            });
                            if (isComplete) {
                                flushSync(() => {
                                    setShowCursor(false);
                                });
                            }
                        } catch (flushError) {
                            console.error('Error in flushSync during streaming:', flushError);
                            // Fallback to regular state update if flushSync fails
                            setStreamedText(currentStreamedText);
                            if (isComplete) {
                                setShowCursor(false);
                            }
                        }
                    }
                );
            } catch (streamError) {
                console.error('Error during streaming:', streamError);
                throw new Error(`Failed to stream document analysis: ${streamError instanceof Error ? streamError.message : String(streamError)}`);
            }

            if (!analysis || !analysis.sections || analysis.sections.length === 0) {
                throw new Error('No content sections generated from document analysis');
            }

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

            // Background task: Generate academic images for ALL sections using Imagen API (PARALLEL)
            const generateImagesAsync = async () => {
                // Generate images for ALL sections with imagePrompts in parallel
                const sectionsWithImages = analysis.sections.filter(s => s.imagePrompt);

                if (sectionsWithImages.length === 0) {
                    console.log('⚠️ No sections with imagePrompts found. Skipping image generation.');
                    return;
                }

                console.log(`🖼️ Generating academic images for ${sectionsWithImages.length} section(s) using Imagen API...`);

                // Mark all sections as loading
                const loadingState: { [key: string]: boolean } = {};
                sectionsWithImages.forEach(section => {
                    loadingState[section.id] = true;
                });
                setLoadingImages(loadingState);

                // Generate ALL images in parallel using Promise.allSettled for better error handling
                const imagePromises = sectionsWithImages.map(async (section, index) => {
                    try {
                        console.log(`🖼️ [${index + 1}/${sectionsWithImages.length}] Generating academic image for "${section.title}"`);
                        console.log(`   Using Imagen API with prompt: ${section.imagePrompt?.substring(0, 100)}...`);

                        // Use generateImmersiveImage which now uses Imagen API first
                        const imageUrl = await generateImmersiveImage(section.imagePrompt!);

                        // Update state progressively as each image loads
                        setSectionImages(prev => ({ ...prev, [section.id]: imageUrl }));
                        setLoadingImages(prev => ({ ...prev, [section.id]: false }));

                        console.log(`✅ Successfully generated image for "${section.title}"`);
                        return { sectionId: section.id, success: true };
                    } catch (e) {
                        console.error(`❌ Failed to generate image for "${section.title}" (${section.id}):`, e);
                        setLoadingImages(prev => ({ ...prev, [section.id]: false }));
                        return { sectionId: section.id, success: false };
                    }
                });

                // Wait for all images to complete (in parallel)
                const results = await Promise.allSettled(imagePromises);
                const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
                console.log(`✅ Academic image generation complete. Generated ${successful}/${sectionsWithImages.length} image(s) using Imagen API.`);
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

            // Background task: Generate brainstorm activities for ALL sections (PARALLEL)
            const generateBrainstormActivitiesAsync = async () => {
                try {
                    console.log(`🧠 Generating brainstorm activities for ${analysis.sections.length} section(s) in parallel...`);

                    // Generate brainstorm activities for all sections in parallel
                    const brainstormPromises = analysis.sections.map(async (section, index) => {
                        try {
                            console.log(`🧠 [${index + 1}/${analysis.sections.length}] Generating brainstorm activity for "${section.title}"`);
                            const activity = await generateBrainstormActivity(section.content, section.title);

                            // Store brainstorm activity by section ID
                            setBrainstormActivities(prev => ({
                                ...prev,
                                [section.id]: activity
                            }));

                            // Set the first section's activity as the active one
                            if (index === 0) {
                                setBrainstormActivity(activity);
                                setShowBrainstormHints(new Array(activity.hints.length).fill(false));
                            }

                            console.log(`✅ Successfully generated brainstorm activity for "${section.title}"`);
                            return { sectionId: section.id, activity, success: true };
                        } catch (e) {
                            console.error(`❌ Failed to generate brainstorm activity for "${section.title}":`, e);
                            return { sectionId: section.id, success: false };
                        }
                    });

                    const results = await Promise.allSettled(brainstormPromises);
                    const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
                    console.log(`✅ Brainstorm activity generation complete. Generated ${successful}/${analysis.sections.length} activity/activities.`);
                } catch (e) {
                    console.error('Failed to generate brainstorm activities:', e);
                }
            };

            // Run ALL background tasks in PARALLEL using Promise.allSettled for better error handling
            // This ensures all tasks run simultaneously and don't block each other
            Promise.allSettled([
                generateImagesAsync(),           // Generate images for ALL sections in parallel
                generateQuizAsync(),             // Generate quiz
                generateAudioAsync(),            // Generate audio script
                generateMindMapAsync(),          // Generate mind map
                fetchVideosAsync(),              // Fetch YouTube videos
                generateBrainstormActivitiesAsync() // Generate brainstorm activities for all sections
            ]).then(async (results) => {
                const successful = results.filter(r => r.status === 'fulfilled').length;
                const failed = results.filter(r => r.status === 'rejected').length;
                console.log(`✅ Background content generation complete! ${successful} succeeded, ${failed} failed.`);

                if (workspaceId) {
                    // Persist the generated content into the local workspace created at upload time
                    try {
                        const keys = getLocalStorageKeys();
                        setSavedWorkspaces(prev => {
                            const updated = prev.map(ws => {
                                if (ws.id !== workspaceId) return ws;
                                return {
                                    ...ws,
                                    updatedAt: Date.now(),
                                    documentText: text,
                                    immersiveContent: analysis,
                                    activeSectionId: analysis.sections?.[0]?.id || null,
                                    documentMimeType: file.type || null,
                                    documentSize: file.size,
                                    documentIsFallback: isFallbackUpload,
                                    // don't persist blob URLs across sessions
                                    pdfUrl: null,
                                };
                            });
                            try {
                                localStorage.setItem(keys.WORKSPACES, JSON.stringify(updated));
                            } catch { }
                            return updated;
                        });
                    } catch (e) {
                        console.error('Failed to save generated content to workspace:', e);
                    }

                    // Upgrade placeholder workspace metadata using Gemini (best-effort)
                    try {
                        const { name, description, emoji } = await generateWorkspaceName(analysis, fileName);
                        const keys = getLocalStorageKeys();
                        setSavedWorkspaces(prev => {
                            const updated = prev.map(ws => ws.id === workspaceId ? {
                                ...ws,
                                name,
                                description,
                                thumbnailEmoji: emoji,
                                updatedAt: Date.now(),
                            } : ws);
                            try {
                                localStorage.setItem(keys.WORKSPACES, JSON.stringify(updated));
                            } catch { }
                            return updated;
                        });
                    } catch (e) {
                        console.warn('Failed to generate/update workspace metadata:', e);
                    }
                } else {
                    // Fallback: if workspace creation failed, create it after generation (legacy path)
                    await saveWorkspaceWithContent(analysis, fileName, text);
                }
            }).catch(e => {
                console.error('Unexpected error in background tasks:', e);
                const errorMessage = e instanceof Error ? e.message : String(e);
                console.error('Background task error details:', {
                    message: errorMessage,
                    stack: e instanceof Error ? e.stack : undefined
                });
            });

        } catch (error) {
            console.error('Error processing file:', error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            const errorStack = error instanceof Error ? error.stack : undefined;
            console.error('Error details:', {
                message: errorMessage,
                stack: errorStack,
                fileName: fileName,
                fileType: file?.type,
                fileSize: file?.size
            });
            alert(`Failed to process document: ${errorMessage || 'Unknown error'}. Please try again.`);
            setIsLoading(false);
            setIsStreaming(false);
            setShowCursor(false);
            setLoadingMessage('');
            setProcessingStage('idle');
            setUploadedFileName('');
            setTerminalSubSteps([]);
        } finally {
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    }, [useToTGeneration, getLocalStorageKeys, handleStartToTGeneration]);

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

        if (relevantVideos.length > 0 && activeMode === 'audio-video') {
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
        if (!video || isLoadingVideoQuiz) {
            return;
        }

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

    // Generate brainstorm activity for current section (or use pre-generated one)
    const handleGenerateBrainstorm = async () => {
        const activeSection = immersiveContent?.sections.find(s => s.id === activeSectionId);
        if (!activeSection) return;

        // Check if we already have a brainstorm activity for this section
        if (brainstormActivities[activeSection.id]) {
            console.log(`✅ Using pre-generated brainstorm activity for "${activeSection.title}"`);
            setBrainstormActivity(brainstormActivities[activeSection.id]);
            setShowBrainstormHints(new Array(brainstormActivities[activeSection.id].hints.length).fill(false));
            setShowBrainstormApproaches(false);
            setShowBrainstormInsight(false);
            return;
        }

        // Otherwise generate on-demand
        setIsLoadingBrainstorm(true);
        setBrainstormActivity(null);
        setShowBrainstormHints([]);
        setShowBrainstormApproaches(false);
        setShowBrainstormInsight(false);
        setUserBrainstormNotes('');

        try {
            const activity = await generateBrainstormActivity(activeSection.content, activeSection.title);
            setBrainstormActivity(activity);
            setBrainstormActivities(prev => ({
                ...prev,
                [activeSection.id]: activity
            }));
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
        setImageActivityError(null);
        setGeneratedImageActivityUrl(null);
        setIsExtractingContext(false);
        setImageActivityLabels([]);
        setSelectedImageLabel(null);
        setIsAnalyzingImage(false);

        try {
            let documentContext: string | undefined = undefined;

            // Extract document context if enabled and document is available
            if (useDocumentContext && documentTextRef.current && documentTextRef.current.trim()) {
                setIsExtractingContext(true);
                try {
                    documentContext = await extractDocumentContextForImage(
                        imageActivityPrompt,
                        documentTextRef.current
                    );
                    console.log('📄 Extracted document context for image generation');
                } catch (contextError) {
                    console.warn('Failed to extract document context, proceeding without it:', contextError);
                    // Continue without context if extraction fails
                } finally {
                    setIsExtractingContext(false);
                }
            }

            const imageUrl = await generateImmersiveImage(
                imageActivityPrompt,
                AspectRatio.LANDSCAPE_16_9,
                documentContext
            );
            setGeneratedImageActivityUrl(imageUrl);
            setImageActivityError(null);

            // Analyze image for labels after generation
            setIsAnalyzingImage(true);
            try {
                const extractedLabels = await analyzeImageForLearning(imageUrl);
                setImageActivityLabels(extractedLabels);
                console.log('✅ Extracted labels from image:', extractedLabels.length);
            } catch (analyzeError) {
                console.warn('Failed to analyze image for labels:', analyzeError);
                // Continue without labels if analysis fails
            } finally {
                setIsAnalyzingImage(false);
            }
        } catch (error) {
            console.error('Failed to generate image:', error);
            const errorMessage = error instanceof Error ? error.message : 'Failed to generate image. Please try again.';
            setImageActivityError(errorMessage);
            setGeneratedImageActivityUrl(null);
        } finally {
            setIsGeneratingImageActivity(false);
            setIsExtractingContext(false);
        }
    };

    // Reset image quiz
    const resetImageQuiz = () => {
        setImageQuizMode(false);
        setImageQuizCorrect([]);
        setImageQuizWrong(null);
        setImageRevealedLabels([]);
        setImageUserGuess('');
        setImageGuessError(false);
        setSelectedImageLabel(null);
    };

    // Handle image upload
    const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            setImageActivityError('Please upload an image file (PNG, JPG, JPEG, etc.)');
            return;
        }

        // Validate file size (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
            setImageActivityError('Image size must be less than 10MB');
            return;
        }

        setIsUploadingImage(true);
        setImageActivityError(null);
        setImageActivityLabels([]);
        setSelectedImageLabel(null);
        resetImageQuiz();

        try {
            // Convert file to base64 data URL
            const reader = new FileReader();
            reader.onload = async (e) => {
                const dataUrl = e.target?.result as string;
                setUploadedImageUrl(dataUrl);
                setGeneratedImageActivityUrl(null); // Clear generated image if any

                // Analyze the uploaded image for labels
                setIsAnalyzingImage(true);
                try {
                    // Extract base64 data (remove data URL prefix if present)
                    // analyzeImageForLearning expects just the base64 string without data URL prefix
                    const base64Data = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
                    const extractedLabels = await analyzeImageForLearning(base64Data);
                    setImageActivityLabels(extractedLabels);
                    console.log('✅ Extracted labels from uploaded image:', extractedLabels.length);
                    if (extractedLabels.length === 0) {
                        setImageActivityError('Image uploaded successfully, but no labels were detected. Try uploading a diagram with visible text labels.');
                    }
                } catch (analyzeError) {
                    console.warn('Failed to analyze uploaded image for labels:', analyzeError);
                    setImageActivityError('Image uploaded successfully, but label analysis failed. You can still view the image.');
                } finally {
                    setIsAnalyzingImage(false);
                    setIsUploadingImage(false);
                }
            };
            reader.onerror = () => {
                setImageActivityError('Failed to read image file');
                setIsUploadingImage(false);
            };
            reader.readAsDataURL(file);
        } catch (error) {
            console.error('Image upload error:', error);
            setImageActivityError('Failed to upload image. Please try again.');
            setIsUploadingImage(false);
        }
    };

    // Get current displayed image (either generated or uploaded)
    const getCurrentImageUrl = () => {
        return imageActivityMode === 'upload' ? uploadedImageUrl : generatedImageActivityUrl;
    };

    // Handle label click
    const handleImageLabelClick = async (label: InteractiveLabel) => {
        if (imageQuizMode) {
            if (imageQuizType === 'find') {
                if (selectedImageLabel && selectedImageLabel.term === label.term) {
                    setImageQuizCorrect(prev => [...prev, label.term]);
                    setImageQuizWrong(null);
                    setSelectedImageLabel(null);
                } else {
                    setImageQuizWrong(label.term);
                }
            } else if (imageQuizType === 'write') {
                if (!imageRevealedLabels.includes(label.term)) {
                    setSelectedImageLabel(label);
                    setImageUserGuess('');
                    setImageGuessError(false);
                }
            }
        } else {
            setSelectedImageLabel(label);
            setEnhancedLabelInfo(null);

            // Load enhanced information in background
            setIsLoadingEnhancedInfo(true);
            try {
                const imageUrl = getCurrentImageUrl();
                const enhanced = await generateEnhancedLabelInfo(label, imageActivityPrompt, imageActivityLabels);
                setEnhancedLabelInfo(enhanced);
            } catch (error) {
                console.error('Failed to load enhanced label info:', error);
            } finally {
                setIsLoadingEnhancedInfo(false);
            }
        }
    };

    // Submit guess for quiz
    const submitImageGuess = () => {
        if (!selectedImageLabel) return;

        const normalize = (s: string) => s.toLowerCase().replace(/[^\w\s]/g, '').trim();

        if (normalize(imageUserGuess) === normalize(selectedImageLabel.term)) {
            setImageRevealedLabels(prev => [...prev, selectedImageLabel.term]);
            setSelectedImageLabel(null);
            setImageUserGuess('');
            setImageGuessError(false);
        } else {
            setImageGuessError(true);
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
        // More robust regex: allows optional spaces after lang, handles \r\n, and matches content non-greedily
        const match = text.match(/```[\w.+\-]*[ \t]*\r?\n([\s\S]*?)```/);
        if (match) {
            console.log('✅ extracted code block length:', match[1].length);
            return match[1].trim();
        }
        // If we have an opening backtick but no closing one yet (streaming), or regex failed
        console.log('⚠️ No complete code block match yet. Buffer length:', text.length);
        return text.trim();
    };

    const sanitizeCode = (text: string) => {
        let cleaned = text || '';
        cleaned = cleaned.replace(/```[\w.+\-]*[ \t]*\r?\n/g, ''); // Remove opening fences more reliably
        cleaned = cleaned.replace(/```\s*$/g, ''); // Remove closing fence at end
        cleaned = cleaned.replace(/```/g, ''); // Remove any other backticks
        cleaned = cleaned.replace(/^\s*(python|javascript|java|cpp)\s*/i, '');
        return cleaned.trimStart();
    };

    const handleAskCodeLabAi = async () => {
        if (!codeLabAiPrompt.trim()) return;
        setCodeLabAiLoading(true);
        setCodeLabAiStreaming(true);
        setCodeLabAiError(null);
        setCodeLabAiResponse('');
        setCodeLabAiReasoning('');

        const prompt = `You are a coding assistant using Gemini 2.5 Pro. Language: ${codeLabLanguage}.
Current file: ${codeLabFiles.find(f => f.id === codeLabActiveFileId)?.name || 'main'}.
Current code:
${codeLabCode}

User request: ${codeLabAiPrompt}

Provide the executable ${codeLabLanguage} code in a standard markdown code block.`;

        let buffer = '';
        try {
            await generateStreamingContent(
                prompt,
                (chunk) => {
                    buffer += chunk;
                    setCodeLabAiResponse(buffer);

                    // For the live code editor update, we only want the code block
                    const extracted = extractCodeBlock(buffer);
                    if (extracted) {
                        const nextCode = sanitizeCode(extracted);
                        console.log('📝 Updating editor. extracted len:', extracted.length, 'sanitized len:', nextCode.length);
                        if (nextCode) {
                            setCodeLabCode(nextCode);
                            setCodeLabFiles(prev => prev.map(file => file.id === codeLabActiveFileId ? { ...file, content: nextCode } : file));
                        }
                    }
                },
                () => {
                    console.log('🏁 Stream finished in ImmersiveLearning.');
                    setCodeLabAiStreaming(false);
                    setCodeLabAiLoading(false);
                },
                (err) => {
                    setCodeLabAiError(err?.message || 'AI request failed');
                    setCodeLabAiStreaming(false);
                    setCodeLabAiLoading(false);
                },
                (thoughtChunk) => {
                    setCodeLabAiReasoning(prev => prev + thoughtChunk);
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

    // State for assignment dashboard feature selection
    const [showAssignmentDashboard, setShowAssignmentDashboard] = useState(true);
    const [selectedAssignmentFeature, setSelectedAssignmentFeature] = useState<string | null>(null);

    // Assignment file upload state - persists file data between dashboard and workspace
    const [assignmentFileData, setAssignmentFileData] = useState<{ mimeType: string; data: string } | null>(null);
    const [assignmentFileContent, setAssignmentFileContent] = useState<string | null>(null);
    const [assignmentFileName, setAssignmentFileName] = useState<string | null>(null);
    const [assignmentTopic, setAssignmentTopic] = useState<string>('');
    const [assignmentUseToT, setAssignmentUseToT] = useState(false);

    const base64ToFile = (base64: string, mimeType: string, name: string): File => {
        const byteChars = atob(base64);
        const byteNumbers = new Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i += 1) {
            byteNumbers[i] = byteChars.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        return new File([byteArray], name, { type: mimeType });
    };

    // Handle file upload from assignment dashboard
    const handleAssignmentFileUpload = async (file: File) => {
        setAssignmentFileName(file.name);

        // Check if it's an image or PDF
        if (file.type.startsWith('image/') || file.type === 'application/pdf') {
            const reader = new FileReader();
            reader.onload = async (e) => {
                const base64String = e.target?.result as string;
                // Remove data URL prefix
                const base64Data = base64String.split(',')[1];
                setAssignmentFileData({
                    mimeType: file.type,
                    data: base64Data
                });
                setAssignmentFileContent(null); // Clear text content

                // Add to Global Source Store
                await addSource({
                    name: file.name,
                    type: file.type === 'application/pdf' ? 'pdf' : 'image',
                    data: base64Data,
                    mimeType: file.type,
                    size: file.size,
                    lastModified: file.lastModified
                });
            };
            reader.readAsDataURL(file);
        } else {
            // Fallback for text files
            const reader = new FileReader();
            reader.onload = async (e) => {
                const text = e.target?.result as string;
                setAssignmentFileContent(text);
                setAssignmentFileData(null);

                // Add to Global Source Store
                await addSource({
                    name: file.name,
                    type: file.name.endsWith('.md') ? 'markdown' : file.type === 'text/html' ? 'html' : 'text',
                    content: text,
                    mimeType: file.type,
                    size: file.size,
                    lastModified: file.lastModified
                });
            };
            reader.readAsText(file);
        }
    };

    const handleSelectAssignmentFeature = (featureId: string) => {
        const openAudioVideoFromAssignment = (tab: 'audio' | 'video') => {
            setSelectedAssignmentFeature(null);
            setActiveMode('audio-video');
            setAudioVideoModeTab(tab);
            setAssignmentAudioVideoTab(tab);
            setAssignmentMindmapActive(false);
            setAssignmentVisualActivityActive(false);
            setAssignmentSimulationActive(false);
            setShowAssignmentDashboard(false);

            const nextTopic =
                assignmentTopic ||
                (assignmentFileName ? assignmentFileName.replace(/\.[^/.]+$/, '') : '');
            if (nextTopic) {
                setStandaloneTopic(nextTopic);
            }

            if (assignmentFileContent?.trim()) {
                setStandaloneNotes(assignmentFileContent);
                setStandaloneNotesName(assignmentFileName || 'Study tools notes');
                return;
            }

            if (assignmentFileData?.mimeType === 'application/pdf') {
                const sourceName = assignmentFileName || 'assignment.pdf';
                const file = base64ToFile(assignmentFileData.data, assignmentFileData.mimeType, sourceName);
                void extractTextFromPdf(file, 6, true)
                    .then((text) => {
                        if (text && text.trim()) {
                            setStandaloneNotes(text);
                            setStandaloneNotesName(sourceName);
                        }
                    })
                    .catch(() => undefined);
            }
        };

        if (featureId === 'audio-module') {
            openAudioVideoFromAssignment('audio');
            return;
        }
        if (featureId === 'video-module') {
            openAudioVideoFromAssignment('video');
            return;
        }
        if (featureId === 'mindmap') {
            setSelectedAssignmentFeature(null);
            setActiveMode('mindmap');
            setAssignmentMindmapActive(true);
            setAssignmentVisualActivityActive(false);
            setAssignmentSimulationActive(false);
            setShowAssignmentDashboard(false);

            const nextTopic =
                assignmentTopic ||
                (assignmentFileName ? assignmentFileName.replace(/\.[^/.]+$/, '') : '');
            if (nextTopic) {
                setStandaloneTopic(nextTopic);
            }

            if (assignmentFileContent?.trim()) {
                setStandaloneNotes(assignmentFileContent);
                setStandaloneNotesName(assignmentFileName || 'Study tools notes');
                return;
            }

            if (assignmentFileData?.mimeType === 'application/pdf') {
                const sourceName = assignmentFileName || 'assignment.pdf';
                const file = base64ToFile(assignmentFileData.data, assignmentFileData.mimeType, sourceName);
                void extractTextFromPdf(file, 6, true)
                    .then((text) => {
                        if (text && text.trim()) {
                            setStandaloneNotes(text);
                            setStandaloneNotesName(sourceName);
                        }
                    })
                    .catch(() => undefined);
            }
            return;
        }
        if (featureId === 'visual-activity') {
            setSelectedAssignmentFeature(null);
            setActiveMode('visual-activity');
            setVisualActivityTab('image');
            setAssignmentVisualActivityActive(true);
            setAssignmentMindmapActive(false);
            setAssignmentSimulationActive(false);
            setShowAssignmentDashboard(false);

            const nextTopic =
                assignmentTopic ||
                (assignmentFileName ? assignmentFileName.replace(/\.[^/.]+$/, '') : '');
            if (nextTopic) {
                setStandaloneTopic(nextTopic);
            }

            if (assignmentFileContent?.trim()) {
                setStandaloneNotes(assignmentFileContent);
                setStandaloneNotesName(assignmentFileName || 'Study tools notes');
                return;
            }

            if (assignmentFileData?.mimeType === 'application/pdf') {
                const sourceName = assignmentFileName || 'assignment.pdf';
                const file = base64ToFile(assignmentFileData.data, assignmentFileData.mimeType, sourceName);
                void extractTextFromPdf(file, 6, true)
                    .then((text) => {
                        if (text && text.trim()) {
                            setStandaloneNotes(text);
                            setStandaloneNotesName(sourceName);
                        }
                    })
                    .catch(() => undefined);
            }
            return;
        }
        if (featureId === '3d-explorer') {
            setSelectedAssignmentFeature(null);
            setActiveMode('visual-activity');
            setVisualActivityTab('3d');
            setAssignmentVisualActivityActive(true);
            setAssignmentMindmapActive(false);
            setAssignmentSimulationActive(false);
            setShowAssignmentDashboard(false);
            return;
        }
        if (featureId === 'simulation') {
            setSelectedAssignmentFeature(null);
            setActiveMode('simulation');
            setAssignmentMindmapActive(false);
            setAssignmentVisualActivityActive(false);
            setAssignmentSimulationActive(true);
            setShowAssignmentDashboard(false);

            const nextTopic =
                assignmentTopic ||
                (assignmentFileName ? assignmentFileName.replace(/\.[^/.]+$/, '') : '');
            if (nextTopic) {
                setStandaloneTopic(nextTopic);
            }
            if (assignmentFileName) {
                setStandaloneNotesName(assignmentFileName);
            }

            if (assignmentFileContent?.trim()) {
                setStandaloneNotes(assignmentFileContent);
                setStandaloneNotesName(assignmentFileName || 'Study tools notes');
                return;
            }

            if (assignmentFileData?.mimeType === 'application/pdf') {
                const sourceName = assignmentFileName || 'assignment.pdf';
                const file = base64ToFile(assignmentFileData.data, assignmentFileData.mimeType, sourceName);
                void extractTextFromPdf(file, 6, true)
                    .then((text) => {
                        if (text && text.trim()) {
                            setStandaloneNotes(text);
                            setStandaloneNotesName(sourceName);
                        }
                    })
                    .catch(() => undefined);
            }
            return;
        }
        if (featureId === 'data-plotter') {
            setSelectedAssignmentFeature(featureId);
            setAssignmentMindmapActive(false);
            setAssignmentVisualActivityActive(false);
            setAssignmentSimulationActive(false);
            setAssignmentTab('exam-prep');
            setShowAssignmentDashboard(false);
            return;
        }
        if (featureId === 'tile-tutor') {
            setSelectedAssignmentFeature(featureId);
            setAssignmentMindmapActive(false);
            setAssignmentVisualActivityActive(false);
            setAssignmentSimulationActive(false);
            setShowAssignmentDashboard(false);

            if (!assignmentFileContent && assignmentFileData?.mimeType === 'application/pdf') {
                const sourceName = assignmentFileName || 'assignment.pdf';
                const file = base64ToFile(assignmentFileData.data, assignmentFileData.mimeType, sourceName);
                void extractTextFromPdf(file, 6, true)
                    .then((text) => {
                        if (text && text.trim()) {
                            setAssignmentFileContent(text);
                        }
                    })
                    .catch(() => undefined);
            }
            return;
        }

        setSelectedAssignmentFeature(featureId);
        setShowAssignmentDashboard(false);
        setAssignmentMindmapActive(false);
        setAssignmentVisualActivityActive(false);
        setAssignmentSimulationActive(false);
        if (featureId === 'extract-formulas' || featureId === 'qa-generator' || featureId === 'tree-of-thoughts' || featureId === 'smart-summary' || featureId === 'flashcards' || featureId === 'timeline-generator' || featureId === 'check-my-work') {
            setAssignmentTab('exam-prep');
        }
    };

    const renderAssignmentWorkspace = () => {
        const hasAssignmentFile = Boolean(assignmentFileName || assignmentFileContent || assignmentFileData);
        if (assignmentTab === 'latex-prep') {
            return <LaTeXAssignmentPrep />;
        }

        // Check for specific feature selection FIRST
        if (selectedAssignmentFeature === 'extract-formulas') {
            if (!assignmentUseToT && !hasAssignmentFile) {
                return (
                    <FormulaExtractionWorkspace
                        onBack={() => {
                            setSelectedAssignmentFeature(null);
                            setShowAssignmentDashboard(true);
                        }}
                        fileName={assignmentFileName || undefined}
                        fileData={assignmentFileData}
                        fileContent={assignmentFileContent}
                    />
                );
            }
        }

        // Lab Manual Explorer feature
        if (selectedAssignmentFeature === 'lab-manual-explorer') {
            // Convert file data to File object if available
            let uploadedFile: File | undefined;
            if (assignmentFileData?.data && assignmentFileData?.mimeType) {
                uploadedFile = base64ToFile(
                    assignmentFileData.data,
                    assignmentFileData.mimeType,
                    assignmentFileName || 'document.pdf'
                );
            }
            return (
                <LabManualExplorer
                    onClose={() => {
                        setSelectedAssignmentFeature(null);
                        setShowAssignmentDashboard(true);
                    }}
                    uploadedFile={uploadedFile}
                    topic={assignmentTopic}
                />
            );
        }

        if (selectedAssignmentFeature === 'flashcards') {
            return (
                <FlashcardsQuizletWorkspace
                    fileData={assignmentFileData}
                    fileContent={assignmentFileContent}
                    fileName={assignmentFileName}
                    topic={assignmentTopic}
                    onBack={() => {
                        setSelectedAssignmentFeature(null);
                        setShowAssignmentDashboard(true);
                    }}
                />
            );
        }

        if (selectedAssignmentFeature === 'data-plotter') {
            const fallbackTitle = assignmentTopic ||
                (assignmentFileName ? assignmentFileName.replace(/\.[^/.]+$/, '') : undefined);

            return (
                <ChartJsDataPlotter
                    initialTitle={fallbackTitle}
                    onBack={() => {
                        setSelectedAssignmentFeature(null);
                        setShowAssignmentDashboard(true);
                    }}
                />
            );
        }

        if (selectedAssignmentFeature === 'tile-tutor') {
            const fallbackTopic = assignmentTopic ||
                (assignmentFileName ? assignmentFileName.replace(/\.[^/.]+$/, '') : undefined);

            return (
                <div className="flex h-full w-full min-h-0 flex-col">
                    <ChatTutorWorkspace
                        onBack={() => {
                            setSelectedAssignmentFeature(null);
                            setShowAssignmentDashboard(true);
                        }}
                        initialTopic={fallbackTopic}
                        initialNotes={assignmentFileContent}
                    />
                </div>
            );
        }

        // Show dashboard when no feature is selected
        if (showAssignmentDashboard) {
            return (
                <div className="flex h-full w-full flex-col bg-[#f6f8fc] pt-[50px]">
                    <AssignmentDashboard
                        onSelectFeature={handleSelectAssignmentFeature}
                        assignmentTab={assignmentTab}
                        onTabChange={(tab) => {
                            setAssignmentTab(tab);
                            if (tab === 'latex-prep') {
                                setShowAssignmentDashboard(false);
                            }
                        }}
                        onFileUpload={handleAssignmentFileUpload}
                        uploadedFileName={assignmentFileName || undefined}
                        topic={assignmentTopic}
                        onTopicChange={setAssignmentTopic}
                        useTreeOfThoughts={assignmentUseToT}
                        onToggleTreeOfThoughts={setAssignmentUseToT}
                    />
                </div>
            );
        }

        return (
            <InteractiveAssignmentWorkspace
                initialFileData={assignmentFileData}
                initialFileContent={assignmentFileContent}
                initialFileName={assignmentFileName}
                initialTopic={assignmentTopic}
                initialUseToT={assignmentUseToT}
                selectedFeature={selectedAssignmentFeature}
                autoGenerate={Boolean(selectedAssignmentFeature && selectedAssignmentFeature !== 'check-my-work')}
                onBack={() => {
                    setSelectedAssignmentFeature(null);
                    setShowAssignmentDashboard(true);
                }}
            />
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
        // Robotics, 3D Viewer, Code Lab, Science Teacher, Learning Theories, and Image Activity work independently without needing uploaded content
        if (!immersiveContent && activeMode !== 'source' && activeMode !== 'notebook' && activeMode !== 'robotics' && activeMode !== 'visual-activity' && activeMode !== 'code-lab' && activeMode !== 'replicube-lab' && activeMode !== 'assignment' && activeMode !== 'latex-assignment' && activeMode !== 'audio-video' && activeMode !== 'mindmap' && activeMode !== 'simulation' && activeMode !== 'learning-theories' && activeMode !== 'socratic' && activeMode !== 'feynman-enhanced' && !isStreaming) {
            return (
                <div className="flex flex-1 w-full h-screen min-h-screen max-h-screen bg-[#eef2f7] overflow-hidden text-slate-900">
                    {/* Left Sidebar - Input & Controls */}
                    {sidebarOpen && (
                        <div className="w-96 flex-shrink-0 border-r border-white/10 flex flex-col overflow-hidden z-20 shadow-[0_20px_60px_rgba(0,0,0,0.35)] h-screen rounded-none" style={{ backgroundColor: '#1F1F1F' }}>
                            {/* Main Content Area */}
                            <div className="flex-1 overflow-y-auto flex flex-col p-6 gap-6 rounded-none">
                                {/* File Upload */}
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">1. Upload Source Material</label>
                                    <div
                                        onClick={() => notesFileInputRef.current?.click()}
                                        className="border border-white/10 bg-white/5 hover:bg-white/10 p-5 flex flex-col items-center justify-center cursor-pointer transition-all group rounded-none"
                                    >
                                        <input
                                            ref={notesFileInputRef}
                                            type="file"
                                            accept=".txt,.md,.pdf,.html"
                                            className="hidden"
                                            onChange={handleStandaloneNotesUpload}
                                        />
                                        {standaloneNotesName ? (
                                            <div className="flex flex-col items-center text-slate-100">
                                                <Check className="w-7 h-7 mb-2" />
                                                <span className="text-xs font-medium text-center break-all">{standaloneNotesName}</span>
                                                <span className="text-[11px] text-slate-400 mt-1">Click to replace</span>
                                            </div>
                                        ) : (
                                            <div className="flex flex-col items-center text-slate-400 group-hover:text-white transition-colors">
                                                <FileUp className="w-6 h-6 mb-2" />
                                                <span className="text-xs font-medium">Upload / Paste Notes</span>
                                                <span className="text-[11px] mt-1">PDF, Text, or Markdown</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Topic Input */}
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">2. Topic / Concept</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Projectile Motion..."
                                        value={standaloneTopic}
                                        onChange={(e) => setStandaloneTopic(e.target.value)}
                                        className="w-full px-4 py-2 bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:ring-2 focus:ring-[#3b5b8a] focus:border-transparent outline-none transition-all rounded-none"
                                    />
                                </div>

                                {/* ToT Toggle */}
                                <div className="flex items-center justify-between py-2 px-1">
                                    <div className="flex items-center gap-2" onClick={() => setUseToTGeneration(!useToTGeneration)}>
                                        <div className={`w-8 h-4 rounded-full p-0.5 cursor-pointer transition-colors ${useToTGeneration ? 'bg-emerald-500' : 'bg-slate-600'}`}>
                                            <div className={`w-3 h-3 bg-white rounded-full shadow-sm transition-transform ${useToTGeneration ? 'translate-x-4' : 'translate-x-0'}`} />
                                        </div>
                                        <label className="text-xs font-bold text-slate-300 uppercase tracking-wider cursor-pointer select-none">Deep Planning (ToT)</label>
                                    </div>
                                    <div className="group relative">
                                        <Info className="w-3.5 h-3.5 text-slate-500 hover:text-slate-300 cursor-help" />
                                        <div className="absolute bottom-full right-0 mb-2 w-48 p-2 bg-slate-800 text-white text-[10px] rounded shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                                            Generates a Tree of Thoughts to plan the best pedagogical approach before writing content. This uses advanced reasoning but takes longer.
                                        </div>
                                    </div>
                                </div>


                                {/* Generate Button */}
                                <button
                                    onClick={async () => {
                                        // Casting to string to avoid TS "no overlap" error if types are strictly defined enums that shouldn't overlap but do in logic
                                        if ((activeMode as string) !== 'notebook') {
                                            setActiveMode('source');
                                        }

                                        const textToProcess = documentTextRef.current || (standaloneTopic ? `Topic: ${standaloneTopic}\n\nMain Concept: ${standaloneTopic}` : null);

                                        if (textToProcess && useToTGeneration) {
                                            setIsLoading(true);
                                            setProcessingStage('analyzing');
                                            setLoadingMessage('Generating Tree of Thoughts Plan (Deep Reasoning)...');
                                            setTerminalSubSteps(['Initializing ToT...', 'Exploring approach vectors...', 'Constructing pedagogical tree...']);
                                            setIsPlanningImmersive(true);

                                            try {
                                                const plan = await generateImmersivePlanTree(textToProcess);
                                                setImmersiveToTPlan(plan);
                                                setShowToTTree(true);
                                            } catch (e) {
                                                console.error(e);
                                                alert('ToT Planning failed: ' + (e instanceof Error ? e.message : String(e)));
                                            } finally {
                                                setIsLoading(false);
                                                setIsPlanningImmersive(false);
                                                setProcessingStage('idle');
                                            }
                                        }
                                    }}
                                    disabled={!standaloneNotes.trim() && !standaloneTopic.trim() && !uploadedFileName}
                                    className={
                                        (!standaloneNotes.trim() && !standaloneTopic.trim() && !uploadedFileName)
                                            ? 'w-full py-3 flex items-center justify-center gap-2 font-semibold text-sm uppercase tracking-wide transition-all bg-slate-700 text-slate-400 cursor-not-allowed rounded-none'
                                            : 'w-full py-3 flex items-center justify-center gap-2 font-semibold text-sm uppercase tracking-wide transition-all bg-[#2c4066] text-white hover:bg-[#34507c] active:scale-95 rounded-none'
                                    }
                                >
                                    <Sparkles className="w-4 h-4" />
                                    <span>Start Learning</span>
                                </button>

                                <div className="h-px bg-slate-700"></div>
                            </div>

                            {/* Collapse Button */}
                            <div className="border-t border-slate-700 p-3 rounded-none">
                                <button
                                    onClick={() => setSidebarOpen(false)}
                                    className="w-full px-3 py-2 text-xs text-slate-400 hover:text-slate-300 hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 rounded-none"
                                >
                                    <ChevronRight className="w-4 h-4" />
                                    <span>Collapse Panel</span>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Sidebar Toggle Button */}
                    {!sidebarOpen && (
                        <button
                            onClick={() => setSidebarOpen(true)}
                            className="absolute top-4 left-4 p-2 bg-slate-800 text-white hover:bg-slate-700 transition-colors z-10 shadow-lg"
                            title="Open sidebar"
                        >
                            <ChevronRight className="w-5 h-5 transform rotate-180" />
                        </button>
                    )}

                    {/* Main Content Area */}
                    <div className="flex-1 bg-[#f6f8fc] w-full h-screen max-h-screen min-h-0 overflow-hidden flex flex-col relative">
                        <div className="w-full h-full flex flex-col items-center justify-center bg-[#f6f8fc] text-slate-500 px-8 overflow-auto">
                            <div className="flex flex-col items-center gap-6 text-center max-w-xl">
                                <div className="w-24 h-24 bg-[#e4e9f2] flex items-center justify-center rounded-xl">
                                    <FileText className="w-12 h-12 text-[#2c4066]" />
                                </div>
                                <div>
                                    <h3 className="text-2xl font-bold text-slate-700 mb-2">Start Learning</h3>
                                    <p className="text-slate-500 mb-6">
                                        Upload a file or enter a topic, then generate your immersive learning experience powered by AI.
                                    </p>
                                    <div className="flex items-center justify-center gap-4 text-sm text-slate-500">
                                        <div className="flex items-center gap-2">
                                            <FileUp className="w-4 h-4" />
                                            <span>Upload or paste</span>
                                        </div>
                                        <div className="w-1 h-1 bg-slate-300"></div>
                                        <div className="flex items-center gap-2">
                                            <Sparkles className="w-4 h-4" />
                                            <span>Generate</span>
                                        </div>
                                        <div className="w-1 h-1 bg-slate-300"></div>
                                        <div className="flex items-center gap-2">
                                            <BookOpen className="w-4 h-4" />
                                            <span>Learn</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
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
                // Show ToT Tree Selection UI
                if (showToTTree && immersiveToTPlan) {
                    return (
                        <div className="flex flex-col h-full bg-[#131314] overflow-hidden p-6 text-white">
                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <h2 className="text-xl font-bold text-white mb-1">Choose Learning Path</h2>
                                    <p className="text-sm text-slate-400">AI analyzed your document and proposed {immersiveToTPlan.tree?.length || 0} structure options.</p>
                                </div>
                                <div className="flex gap-2">
                                    <button className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm" onClick={() => setShowToTTree(false)}>Cancel</button>
                                </div>
                            </div>
                            <div className="flex-1 overflow-hidden">
                                <ToTGraphVisualization
                                    tree={immersiveToTPlan.tree}
                                    rootId={immersiveToTPlan.rootId}
                                    selectedId={currentPlanNode?.id || null}
                                    onSelect={setCurrentPlanNode}
                                />
                            </div>
                            <div className="mt-6 pt-6 border-t border-slate-700 flex flex-col sm:flex-row justify-end gap-4 items-center">
                                <div className="flex-1 w-full">
                                    {currentPlanNode && (
                                        <div className="p-4 bg-[#1e232e] rounded-lg border border-[#3b5b8a]/30">
                                            <div className="flex items-center gap-2 mb-2">
                                                <Badge className="bg-[#8ab4f8]/20 text-[#8ab4f8] hover:bg-[#8ab4f8]/30 border-0">SELECTED APPROACH</Badge>
                                                <span className="text-sm font-bold text-white">{currentPlanNode.approach}</span>
                                            </div>
                                            <div className="text-sm text-slate-300">{currentPlanNode.description}</div>
                                        </div>
                                    )}
                                </div>
                                <button
                                    onClick={() => currentPlanNode && handleStartToTGeneration(currentPlanNode)}
                                    disabled={!currentPlanNode}
                                    className={`px-8 py-3 rounded-lg font-bold transition-all shadow-lg ${currentPlanNode ? 'bg-[#8ab4f8] hover:bg-[#aecbfa] text-[#202124] hover:shadow-[#8ab4f8]/20 hover:scale-105' : 'bg-slate-800 text-slate-600 cursor-not-allowed'}`}
                                >
                                    Generate Content
                                </button>
                            </div>
                        </div>
                    );
                }

                if (isLoading || isPlanningImmersive) {
                    const terminalStages = [
                        {
                            id: 'stage-uploading', // Add missing ID
                            label: 'Uploading',    // Add missing Label
                            name: 'Uploading',
                            status: processingStage === 'uploading' ? ('running' as const) :
                                ['extracting', 'analyzing', 'generating'].includes(processingStage) ? ('completed' as const) : ('pending' as const)
                        },
                        {
                            id: 'stage-extracting',
                            label: 'Extracting Content',
                            name: 'Extracting Content',
                            status: processingStage === 'extracting' ? ('running' as const) :
                                ['analyzing', 'generating'].includes(processingStage) ? ('completed' as const) : ('pending' as const)
                        },
                        {
                            id: 'stage-analyzing',
                            label: 'Analyzing Structure',
                            name: 'Analyzing Structure',
                            status: processingStage === 'analyzing' ? ('running' as const) :
                                processingStage === 'generating' ? ('completed' as const) : ('pending' as const)
                        },
                        {
                            id: 'stage-generating',
                            label: 'Generating Experience',
                            name: 'Generating Experience',
                            status: processingStage === 'generating' ? ('running' as const) : ('pending' as const)
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
                                    <div>
                                        <h1 className="text-xl font-medium text-white">Immersive Learning</h1>
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
                                    {/* Section Header with Tabs */}
                                    <div className="flex items-center justify-between mb-6">
                                        <div className="flex items-center gap-4">
                                            <h2 className="text-base font-medium text-[#e8eaed]">
                                                {dashboardTab === 'spaces' ? 'My Spaces' : 'My notebooks'}
                                            </h2>
                                            {/* Tabs */}
                                            <div className="flex items-center gap-2 border border-[#3c4043] rounded-lg p-1 bg-[#202124]">
                                                <button
                                                    onClick={() => setDashboardTab('notebooks')}
                                                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${dashboardTab === 'notebooks'
                                                        ? 'bg-[#8ab4f8] text-[#202124]'
                                                        : 'text-[#9aa0a6] hover:text-white'
                                                        }`}
                                                >
                                                    Notebooks
                                                </button>
                                                <button
                                                    onClick={() => setDashboardTab('spaces')}
                                                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${dashboardTab === 'spaces'
                                                        ? 'bg-[#8ab4f8] text-[#202124]'
                                                        : 'text-[#9aa0a6] hover:text-white'
                                                        }`}
                                                >
                                                    Spaces
                                                </button>
                                            </div>
                                        </div>
                                        {/* Search */}
                                        <div className="relative">
                                            <input
                                                type="text"
                                                value={dashboardTab === 'spaces' ? spaceSearchQuery : workspaceSearchQuery}
                                                onChange={(e) => dashboardTab === 'spaces' ? setSpaceSearchQuery(e.target.value) : setWorkspaceSearchQuery(e.target.value)}
                                                placeholder={dashboardTab === 'spaces' ? "Search spaces..." : "Search notebooks..."}
                                                className="w-64 px-4 py-2 pl-10 bg-[#202124] border border-[#3c4043] rounded-full text-sm text-white placeholder-[#9aa0a6] focus:outline-none focus:border-[#8ab4f8] transition-all"
                                            />
                                            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9aa0a6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                            </svg>
                                        </div>
                                    </div>

                                    {/* Show Spaces View */}
                                    {dashboardTab === 'spaces' ? (
                                        filteredSpaces.length === 0 ? (
                                            <div className="flex flex-col items-center justify-center h-64">
                                                <span className="text-4xl mb-4">🚀</span>
                                                <p className="text-[#9aa0a6]">
                                                    {spaceSearchQuery
                                                        ? `No spaces found matching "${spaceSearchQuery}"`
                                                        : 'No spaces yet. Start using different learning modes to see them here!'}
                                                </p>
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-4">
                                                {filteredSpaces.map((space, index) => {
                                                    // Different gradient colors for each card (similar to Hugging Face)
                                                    const gradients = [
                                                        'from-[#f28b82] to-[#fdd663]', // Red to Yellow
                                                        'from-[#8ab4f8] to-[#c58af9]', // Blue to Purple
                                                        'from-[#81c995] to-[#34a853]', // Green
                                                        'from-[#fdd663] to-[#fbbc04]', // Yellow
                                                        'from-[#c58af9] to-[#f28b82]', // Purple to Red
                                                        'from-[#78d9ec] to-[#8ab4f8]', // Cyan to Blue
                                                    ];
                                                    const gradient = gradients[index % gradients.length];
                                                    const modeInfo = learningModes.find(m => m.id === space.mode);

                                                    return (
                                                        <div
                                                            key={space.id}
                                                            className="group relative h-[220px] rounded-2xl bg-[#202124] border border-[#3c4043] hover:border-[#5f6368] hover:shadow-xl hover:shadow-black/20 transition-all cursor-pointer overflow-hidden"
                                                            onClick={() => openSpace(space)}
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
                                                                    <span className="text-5xl drop-shadow-lg">{space.emoji}</span>
                                                                </div>
                                                                {/* Status Badge */}
                                                                <div className="absolute top-2 right-2 flex items-center gap-1">
                                                                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                                                                    <span className="text-xs text-white/90 font-medium">Used</span>
                                                                </div>
                                                            </div>

                                                            {/* Content */}
                                                            <div className="p-4">
                                                                <h3 className="font-medium text-white text-sm truncate mb-1">{space.name}</h3>
                                                                <p className="text-xs text-[#9aa0a6] line-clamp-1 mb-2">{space.description}</p>

                                                                {/* Footer */}
                                                                <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between">
                                                                    <div className="flex flex-col">
                                                                        <span className="text-xs text-[#5f6368]">
                                                                            {new Date(space.lastUsed).toLocaleDateString('en-US', {
                                                                                month: 'short',
                                                                                day: 'numeric'
                                                                            })}
                                                                        </span>
                                                                        <span className="text-[10px] text-[#5f6368]">
                                                                            {space.usageCount} {space.usageCount === 1 ? 'use' : 'uses'}
                                                                        </span>
                                                                    </div>

                                                                    {/* Menu Button */}
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            if (confirm('Delete this space?')) {
                                                                                deleteSpace(space.id);
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
                                        )
                                    ) : (
                                        /* Original Notebooks Grid */
                                        <>
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
                        <div className="flex w-full h-full min-h-[calc(100vh-120px)] bg-white">
                            <WarpBackground
                                className="flex-1 flex items-center justify-center border-0 p-0 bg-white"
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
                                        <div className="flex items-center gap-2 text-gray-600 mb-3">
                                            <span className="text-green-600">➜</span>
                                            <span className="text-blue-600">~/learning</span>
                                            <span className="text-gray-500">$</span>
                                            <TypingAnimation className="text-gray-700" duration={25} delay={0}>
                                                gemini analyze --mode immersive
                                            </TypingAnimation>
                                        </div>

                                        {/* Step 1 */}
                                        <AnimatedSpan delay={1200} className="text-gray-700">
                                            <span className="text-green-600">✔</span> Connected to Gemini AI
                                        </AnimatedSpan>

                                        {/* Step 2 */}
                                        <AnimatedSpan delay={1800} className="text-gray-700">
                                            <span className="text-green-600">✔</span> Document parsed successfully
                                        </AnimatedSpan>

                                        {/* Step 3 */}
                                        <AnimatedSpan delay={2400} className="text-gray-700">
                                            <span className="text-green-600">✔</span> Extracting key concepts
                                        </AnimatedSpan>

                                        {/* Step 4 - Shows when content starts streaming */}
                                        <AnimatedSpan delay={3000} className="text-gray-700">
                                            {hasStarted ? (
                                                <><span className="text-green-600">✔</span> Building section structure</>
                                            ) : (
                                                <><span className="text-yellow-600 animate-pulse">●</span> Analyzing document structure...</>
                                            )}
                                        </AnimatedSpan>

                                        {hasStarted && (
                                            <>
                                                {/* Step 5 */}
                                                <AnimatedSpan delay={3600} className="text-gray-700">
                                                    <span className="text-blue-600 animate-pulse">●</span> Generating immersive content...
                                                </AnimatedSpan>

                                                {/* Step 6 */}
                                                <AnimatedSpan delay={4200} className="text-gray-700">
                                                    <span className="text-blue-600 animate-pulse">●</span> Creating interactive widgets
                                                </AnimatedSpan>

                                                {/* Step 7 */}
                                                <AnimatedSpan delay={4800} className="text-gray-700">
                                                    <span className="text-yellow-600 animate-spin inline-block">⟳</span> Preparing visual elements
                                                </AnimatedSpan>

                                                {/* Progress bar */}
                                                <AnimatedSpan delay={5400} className="mt-4 pt-3 border-t border-gray-300">
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-gray-600 text-xs">Progress:</span>
                                                        <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden max-w-[200px]">
                                                            <div
                                                                className="h-full bg-gradient-to-r from-green-500 to-cyan-400 transition-all duration-500"
                                                                style={{ width: `${progressPercent}%` }}
                                                            />
                                                        </div>
                                                        <span className="text-blue-600 text-xs font-mono">{progressPercent}%</span>
                                                    </div>
                                                </AnimatedSpan>

                                                {/* Character count - live updating */}
                                                <AnimatedSpan delay={5600} className="text-gray-600 text-xs">
                                                    <span className="text-gray-700">ℹ</span> Streaming: {streamedText.length.toLocaleString()} characters received
                                                </AnimatedSpan>
                                            </>
                                        )}

                                        {!hasStarted && (
                                            <AnimatedSpan delay={3600} className="text-blue-600 flex items-center gap-2">
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
                    <>
                        <div className="flex w-full min-h-full bg-white">
                            {/* Main Content - Single scrollable area */}
                            <div className={`flex-1 py-10 px-12 relative overflow-y-auto transition-all duration-300 bg-white`}>
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
                    </>
                );


            case 'audio-video': {
                const selectedVideo = relevantVideos[selectedVideoIndex];
                const activeMediaTab = assignmentAudioVideoTab ?? audioVideoModeTab;
                const showMediaTabs = !assignmentAudioVideoTab;
                const isAssignmentAudioView = assignmentAudioVideoTab === 'audio';
                const isAssignmentVideoView = assignmentAudioVideoTab === 'video';
                const handleAssignmentMediaBack = () => {
                    setSelectedAssignmentFeature(null);
                    setShowAssignmentDashboard(true);
                    setActiveMode('assignment');
                };
                const suggestedQuestions = selectedVideo ? [
                    `What are the main concepts discussed in "${selectedVideo.title.slice(0, 40)}..."?`,
                    `How does this video explain the topic differently?`,
                    `What are the key takeaways from this video?`,
                    `Can you summarize the most important points?`
                ] : [];

                // Combined Audio Video mode with tabs
                return (
                    <div className="flex flex-1 w-full h-screen min-h-screen max-h-screen bg-[#eef2f7] overflow-hidden text-slate-900" style={{ fontFamily: '"Google Sans", sans-serif' }}>
                        {/* Top Tab Bar */}
                        {showMediaTabs && (
                            <div className="absolute top-0 left-0 right-0 z-30 bg-[#1F1F1F] border-b border-slate-700 px-4 py-2">
                                <div className="flex gap-2 max-w-7xl mx-auto">
                                    <button
                                        onClick={() => setAudioVideoModeTab('video')}
                                        className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${audioVideoModeTab === 'video'
                                            ? 'bg-[#9334e9] text-white'
                                            : 'text-slate-300 hover:text-white hover:bg-slate-800'
                                            }`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <Play className="w-4 h-4" />
                                            Video Lessons
                                        </div>
                                    </button>
                                    <button
                                        onClick={() => setAudioVideoModeTab('audio')}
                                        className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${audioVideoModeTab === 'audio'
                                            ? 'bg-[#9334e9] text-white'
                                            : 'text-slate-300 hover:text-white hover:bg-slate-800'
                                            }`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <Volume2 className="w-4 h-4" />
                                            Audio Podcast
                                        </div>
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Video Lessons Tab */}
                        {activeMediaTab === 'video' && (
                            <>
                                {/* Left Sidebar */}
                                <div className="w-96 flex-shrink-0 border-r border-white/10 flex flex-col overflow-hidden z-20 shadow-[0_20px_60px_rgba(0,0,0,0.35)] h-screen pt-12" style={{ backgroundColor: '#171717' }}>
                                    <div className="flex-1 overflow-y-auto flex flex-col p-6 gap-6">
                                        {assignmentAudioVideoTab && (
                                            <button
                                                onClick={handleAssignmentMediaBack}
                                                className="flex items-center gap-2 text-xs font-semibold text-slate-200 hover:text-white transition-colors"
                                            >
                                                <ChevronLeft className="w-4 h-4" />
                                                Back to Study Tools
                                            </button>
                                        )}
                                        <div className="space-y-3">
                                            <p className="text-xs font-bold text-slate-300 uppercase tracking-wider">1. Notes</p>
                                            {renderStandaloneNotesPanel('dark')}
                                        </div>
                                        <div className="space-y-3">
                                            <p className="text-xs font-bold text-slate-300 uppercase tracking-wider">2. Actions</p>
                                            <button
                                                onClick={handleFetchVideos}
                                                disabled={isLoadingVideos || (!standaloneNotes.trim() && !immersiveContent)}
                                                className="w-full px-4 py-2.5 text-sm text-white bg-[#2c4066] hover:bg-[#34507c] transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                {isLoadingVideos ? (
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                ) : (
                                                    <Play className="w-4 h-4" />
                                                )}
                                                {isLoadingVideos ? 'Searching...' : 'Find Videos'}
                                            </button>
                                        </div>
                                        <div className="space-y-2">
                                            <p className="text-xs font-bold text-slate-300 uppercase tracking-wider">Status</p>
                                            <Badge
                                                variant={
                                                    relevantVideos.length > 0
                                                        ? 'success'
                                                        : isLoadingVideos
                                                            ? 'warning'
                                                            : 'outline'
                                                }
                                                className="w-full justify-center py-2 text-xs normal-case tracking-normal bg-white/5 text-slate-200 border-white/10"
                                            >
                                                {relevantVideos.length > 0 ? (
                                                    <>
                                                        <CheckCircle2 className="w-3 h-3" />
                                                        {relevantVideos.length} video{relevantVideos.length !== 1 ? 's' : ''} found.
                                                    </>
                                                ) : isLoadingVideos ? (
                                                    <>
                                                        <Loader2 className="w-3 h-3 animate-spin" />
                                                        Searching YouTube...
                                                    </>
                                                ) : (
                                                    <>
                                                        <Info className="w-3 h-3" />
                                                        Awaiting notes.
                                                    </>
                                                )}
                                            </Badge>
                                        </div>
                                    </div>
                                </div>

                                {/* Main Content Area */}
                                <div className="flex-1 bg-[#eef2f7] flex flex-col pt-12">
                                    {isLoadingVideos ? (
                                        <div className="flex-1 flex items-center justify-center">
                                            <div className="text-center">
                                                <Loader2 className="w-12 h-12 animate-spin text-[#9334e9] mx-auto mb-4" />
                                                <p className="text-lg font-medium text-slate-700 mb-2">Searching for Videos</p>
                                                <p className="text-sm text-slate-500">Finding relevant YouTube videos based on your content...</p>
                                            </div>
                                        </div>
                                    ) : relevantVideos.length === 0 || isAssignmentVideoView ? (
                                        <div className="flex-1 flex flex-col items-center p-8 overflow-y-auto">
                                            <div className="w-full max-w-3xl space-y-6">
                                                {/* Header Card */}
                                                <div className="p-6 space-y-4" style={{ backgroundColor: '#1F1F1F' }}>
                                                    <div className="flex items-center gap-3 mb-4">
                                                        <div className="w-12 h-12 flex items-center justify-center">
                                                            <Play className="w-6 h-6 text-slate-300" />
                                                        </div>
                                                        <div>
                                                            <h2 className="text-lg font-semibold text-slate-200">Video Lessons</h2>
                                                            <p className="text-xs text-slate-400">
                                                                Discover relevant YouTube videos based on your document content. Each video includes AI-generated summaries, transcripts, quizzes, and flashcards.
                                                            </p>
                                                        </div>
                                                    </div>

                                                    {!standaloneNotes.trim() && !immersiveContent && (
                                                        <button
                                                            onClick={() => {
                                                                const notesInput = document.querySelector('textarea[placeholder*="notes"], textarea[placeholder*="Notes"]') as HTMLTextAreaElement;
                                                                if (notesInput) {
                                                                    notesInput.focus();
                                                                }
                                                            }}
                                                            className="w-full py-3 flex items-center justify-center gap-2 font-semibold text-sm uppercase tracking-wide transition-all bg-[#2c4066] text-white hover:bg-[#34507c] active:scale-95"
                                                        >
                                                            <FileUp className="w-4 h-4" />
                                                            <span>Add Notes or Upload Document</span>
                                                        </button>
                                                    )}

                                                    {(standaloneNotes.trim() || immersiveContent) && (
                                                        <button
                                                            onClick={handleFetchVideos}
                                                            disabled={isLoadingVideos}
                                                            className="w-full py-3 flex items-center justify-center gap-2 font-semibold text-sm uppercase tracking-wide transition-all bg-[#2c4066] text-white hover:bg-[#34507c] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-[#2c4066]"
                                                        >
                                                            <Sparkles className="w-4 h-4" />
                                                            <span>Find Videos</span>
                                                        </button>
                                                    )}
                                                </div>

                                                {/* Features List */}
                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                    <div className="p-4 bg-white rounded-xl shadow-sm">
                                                        <div className="w-10 h-10 bg-[#e8f0fe] rounded-lg flex items-center justify-center mb-3 mx-auto">
                                                            <BookOpen className="w-5 h-5 text-[#1a73e8]" />
                                                        </div>
                                                        <h3 className="text-sm font-semibold text-slate-700 mb-1">AI Summaries</h3>
                                                        <p className="text-xs text-slate-500">Get key points and overviews</p>
                                                    </div>
                                                    <div className="p-4 bg-white rounded-xl shadow-sm">
                                                        <div className="w-10 h-10 bg-[#e6f4ea] rounded-lg flex items-center justify-center mb-3 mx-auto">
                                                            <MessageCircle className="w-5 h-5 text-[#1e8e3e]" />
                                                        </div>
                                                        <h3 className="text-sm font-semibold text-slate-700 mb-1">Interactive Quizzes</h3>
                                                        <p className="text-xs text-slate-500">Test your understanding</p>
                                                    </div>
                                                    <div className="p-4 bg-white rounded-xl shadow-sm">
                                                        <div className="w-10 h-10 bg-[#fff8e1] rounded-lg flex items-center justify-center mb-3 mx-auto">
                                                            <Target className="w-5 h-5 text-[#f9a825]" />
                                                        </div>
                                                        <h3 className="text-sm font-semibold text-slate-700 mb-1">Flashcards</h3>
                                                        <p className="text-xs text-slate-500">Review key concepts</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ) : selectedVideo && (
                                        <div className="flex-1 flex overflow-hidden p-4 gap-4">
                                            {/* Video + Summary Panel */}
                                            <div className="flex-1 flex flex-col bg-white rounded-xl overflow-hidden shadow-sm">
                                                <div className="aspect-video bg-black flex-shrink-0">
                                                    <iframe
                                                        src={`https://www.youtube.com/embed/${selectedVideo.id}?rel=0`}
                                                        title={selectedVideo.title}
                                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                                        allowFullScreen
                                                        className="w-full h-full"
                                                    />
                                                </div>
                                                <div className="flex items-center justify-between px-4 py-2 border-b border-[#e0e0e0]">
                                                    <div className="flex bg-[#f5f5f5] rounded-full p-0.5">
                                                        {(['summary', 'key-concepts', 'clips', 'transcript'] as const).map((tab) => (
                                                            <button
                                                                key={tab}
                                                                onClick={() => setVideoContentTab(tab)}
                                                                className={`px-4 py-1.5 text-[13px] font-medium rounded-full transition-all ${videoContentTab === tab
                                                                    ? 'bg-white text-[#1f1f1f] shadow-sm'
                                                                    : 'text-[#5f6368] hover:text-[#1f1f1f]'
                                                                    }`}
                                                            >
                                                                {tab === 'summary' ? 'Summary' : tab === 'key-concepts' ? 'Key Concepts' : tab === 'clips' ? 'Clips' : 'Transcript'}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
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
                                                    {videoContentTab === 'clips' && (
                                                        <div className="space-y-4">
                                                            <div className="flex items-center justify-between">
                                                                <h2 className="text-[16px] font-medium text-[#1f1f1f]">Semantic Clips</h2>
                                                                {videoClipChapters.length > 0 && (
                                                                    <span className="text-[12px] text-[#5f6368]">{videoClipChapters.length} segments</span>
                                                                )}
                                                            </div>
                                                            {isLoadingVideoSummary ? (
                                                                <div className="flex items-center justify-center py-8">
                                                                    <Loader2 className="w-6 h-6 text-[#9334e9] animate-spin mr-2" />
                                                                    <span className="text-[14px] text-[#5f6368]">Preparing semantic clips...</span>
                                                                </div>
                                                            ) : videoClipChapters.length > 0 ? (
                                                                <div className="space-y-4">
                                                                    {videoClipChapters.slice(0, 6).map((clip, idx) => (
                                                                        <div key={`${clip.startSeconds}-${idx}`} className="rounded-lg border border-[#e0e0e0] bg-[#f8f9fa] p-3">
                                                                            <div className="flex items-start justify-between gap-3">
                                                                                <div className="space-y-1">
                                                                                    <p className="text-[12px] text-[#5f6368]">{clip.startLabel} - {clip.endLabel}</p>
                                                                                    <h4 className="text-[14px] font-medium text-[#1f1f1f]">{clip.title}</h4>
                                                                                    {clip.keywords.length > 0 && (
                                                                                        <div className="flex flex-wrap gap-2">
                                                                                            {clip.keywords.map((keyword) => (
                                                                                                <span
                                                                                                    key={keyword}
                                                                                                    className="px-2 py-0.5 text-[11px] rounded-full bg-white border border-[#e0e0e0] text-[#5f6368]"
                                                                                                >
                                                                                                    {keyword}
                                                                                                </span>
                                                                                            ))}
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                                <a
                                                                                    href={`https://www.youtube.com/watch?v=${selectedVideo.id}&t=${clip.startSeconds}s`}
                                                                                    target="_blank"
                                                                                    rel="noreferrer"
                                                                                    className="text-[12px] text-[#1a73e8] hover:underline flex items-center gap-1"
                                                                                >
                                                                                    <ExternalLink className="w-3.5 h-3.5" />
                                                                                    Open
                                                                                </a>
                                                                            </div>
                                                                            <div className="mt-3 aspect-video bg-black rounded-md overflow-hidden">
                                                                                <iframe
                                                                                    src={`https://www.youtube.com/embed/${selectedVideo.id}?start=${clip.startSeconds}&end=${clip.endSeconds}&rel=0&modestbranding=1`}
                                                                                    title={`${selectedVideo.title} clip ${idx + 1}`}
                                                                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                                                                    allowFullScreen
                                                                                    className="w-full h-full"
                                                                                />
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                    {videoClipChapters.length > 6 && (
                                                                        <p className="text-[11px] text-[#5f6368]">
                                                                            Showing the first 6 clips. Explore the transcript for the full timeline.
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <div className="text-center py-8 bg-[#f8f9fa] rounded-lg">
                                                                    <p className="text-[14px] text-[#5f6368]">
                                                                        Generate the summary to see semantic clips with keywords.
                                                                    </p>
                                                                </div>
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
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Right Interactive Panel */}
                                            <div className="w-[340px] bg-white rounded-xl shadow-sm flex flex-col overflow-hidden flex-shrink-0">
                                                <div className="flex border-b border-[#e0e0e0]">
                                                    {(['chat', 'quiz', 'flashcards'] as const).map((tab) => (
                                                        <button
                                                            key={tab}
                                                            onClick={() => {
                                                                setVideoInteractiveTab(tab);
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
                                                <div className="flex-1 overflow-y-auto p-4" ref={chatContainerRef}>
                                                    {videoInteractiveTab === 'chat' && (
                                                        <div className="space-y-3">
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
                                                                    <div className="flex items-center justify-between text-[12px] text-[#5f6368] mb-2">
                                                                        <span>Question {currentVideoQuizIndex + 1} of {videoQuiz.length}</span>
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
                                                                    <div className="flex items-center justify-between text-[12px] text-[#5f6368] mb-2">
                                                                        <span>Card {currentFlashcardIndex + 1} of {videoFlashcards.length}</span>
                                                                    </div>
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
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}

                        {/* Audio Podcast Tab */}
                        {activeMediaTab === 'audio' && (
                            <>
                                {/* Left Sidebar */}
                                <div className="w-96 flex-shrink-0 border-r border-white/10 flex flex-col overflow-hidden z-20 shadow-[0_20px_60px_rgba(0,0,0,0.35)] h-screen pt-12" style={{ backgroundColor: '#171717' }}>
                                    <div className="flex-1 overflow-y-auto flex flex-col p-6 gap-6">
                                        {assignmentAudioVideoTab && (
                                            <button
                                                onClick={handleAssignmentMediaBack}
                                                className="flex items-center gap-2 text-xs font-semibold text-slate-200 hover:text-white transition-colors"
                                            >
                                                <ChevronLeft className="w-4 h-4" />
                                                Back to Study Tools
                                            </button>
                                        )}
                                        <div className="space-y-3">
                                            <p className="text-xs font-bold text-slate-300 uppercase tracking-wider">1. Notes</p>
                                            {renderStandaloneNotesPanel('dark')}
                                        </div>
                                        <div className="space-y-3">
                                            <p className="text-xs font-bold text-slate-300 uppercase tracking-wider">2. Actions</p>
                                            <button
                                                onClick={handleGeneratePodcast}
                                                disabled={isGeneratingScript || isGeneratingAudio || (!standaloneNotes.trim() && !immersiveContent)}
                                                className="w-full px-4 py-2.5 text-sm text-white bg-[#2c4066] hover:bg-[#34507c] transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                {isGeneratingScript || isGeneratingAudio ? (
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                ) : (
                                                    <Sparkles className="w-4 h-4" />
                                                )}
                                                {isGeneratingScript || isGeneratingAudio ? 'Working...' : 'Generate Podcast'}
                                            </button>
                                            {audioGenerationError && (
                                                <p className="text-xs text-rose-300">Add notes and try again.</p>
                                            )}
                                        </div>
                                        <div className="space-y-2">
                                            <p className="text-xs font-bold text-slate-300 uppercase tracking-wider">Status</p>
                                            <Badge
                                                variant={
                                                    podcastAudio
                                                        ? 'success'
                                                        : isGeneratingScript || isGeneratingAudio
                                                            ? 'warning'
                                                            : 'outline'
                                                }
                                                className="w-full justify-center py-2 text-xs normal-case tracking-normal bg-white/5 text-slate-200 border-white/10"
                                            >
                                                {podcastAudio ? (
                                                    <>
                                                        <CheckCircle2 className="w-3 h-3" />
                                                        Audio ready.
                                                    </>
                                                ) : isGeneratingScript ? (
                                                    <>
                                                        <Loader2 className="w-3 h-3 animate-spin" />
                                                        Generating script...
                                                    </>
                                                ) : isGeneratingAudio ? (
                                                    <>
                                                        <Loader2 className="w-3 h-3 animate-spin" />
                                                        Rendering audio...
                                                    </>
                                                ) : (
                                                    <>
                                                        <Info className="w-3 h-3" />
                                                        Awaiting notes.
                                                    </>
                                                )}
                                            </Badge>
                                        </div>
                                    </div>
                                </div>

                                {/* Main Content */}
                                <div className="flex-1 bg-[#eef2f7] flex flex-col pt-12">
                                    <div className="flex-1 flex flex-col items-center p-8 overflow-y-auto">
                                        <div className="w-full max-w-3xl space-y-6">
                                            {/* Header Card */}
                                            <div className="p-6 space-y-4" style={{ backgroundColor: '#1F1F1F' }}>
                                                <div className="flex items-center gap-3 mb-4">
                                                    <div className="w-12 h-12 flex items-center justify-center">
                                                        <Volume2 className="w-6 h-6 text-slate-300" />
                                                    </div>
                                                    <div>
                                                        <h2 className="text-lg font-semibold text-slate-200">Audio Lesson Podcast</h2>
                                                        <p className="text-xs text-slate-400">
                                                            Generate an AI-hosted podcast about this topic. Listen to a conversation between an expert and a host.
                                                        </p>
                                                    </div>
                                                </div>

                                                {!podcastScript && !isGeneratingAudio && !isGeneratingScript && (
                                                    <>
                                                        {!standaloneNotes.trim() && !immersiveContent ? (
                                                            <button
                                                                onClick={() => {
                                                                    const notesInput = document.querySelector('textarea[placeholder*="notes"], textarea[placeholder*="Notes"]') as HTMLTextAreaElement;
                                                                    if (notesInput) {
                                                                        notesInput.focus();
                                                                    }
                                                                }}
                                                                className="w-full py-3 flex items-center justify-center gap-2 font-semibold text-sm uppercase tracking-wide transition-all bg-[#2c4066] text-white hover:bg-[#34507c] active:scale-95"
                                                            >
                                                                <FileUp className="w-4 h-4" />
                                                                <span>Add Notes or Upload Document</span>
                                                            </button>
                                                        ) : (
                                                            <button
                                                                onClick={handleGeneratePodcast}
                                                                disabled={isGeneratingScript || isGeneratingAudio}
                                                                className="w-full py-3 flex items-center justify-center gap-2 font-semibold text-sm uppercase tracking-wide transition-all bg-[#2c4066] text-white hover:bg-[#34507c] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-[#2c4066]"
                                                            >
                                                                <Sparkles className="w-4 h-4" />
                                                                <span>Generate Podcast</span>
                                                            </button>
                                                        )}
                                                    </>
                                                )}

                                                {/* Script Generation Loading State */}
                                                {isGeneratingScript && (
                                                    <div className="flex items-center justify-center gap-2 text-slate-300 py-2">
                                                        <Loader2 className="w-4 h-4 animate-spin" />
                                                        <span className="text-sm">Generating podcast script...</span>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Audio Player */}
                                            {podcastAudio && (
                                                <div className="p-6 border border-white/10 sticky top-0 z-10" style={{ backgroundColor: '#1F1F1F' }}>
                                                    <div className="flex items-center gap-4">
                                                        <button
                                                            onClick={toggleAudioPlayback}
                                                            className="w-12 h-12 bg-[#2c4066] hover:bg-[#34507c] flex items-center justify-center text-white transition-colors flex-shrink-0"
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
                                                <div className="p-6 text-center" style={{ backgroundColor: '#1F1F1F' }}>
                                                    <Loader2 className="w-8 h-8 animate-spin text-slate-300 mx-auto mb-3" />
                                                    <p className="text-slate-200 font-medium">Generating audio...</p>
                                                    <p className="text-[13px] text-slate-400">This may take a minute</p>
                                                </div>
                                            )}

                                            {/* Error State for Audio */}
                                            {audioGenerationError && (
                                                <div className="p-6 text-center border border-red-500/30" style={{ backgroundColor: '#1F1F1F' }}>
                                                    <div className="w-12 h-12 mx-auto mb-3 bg-red-900/30 rounded-full flex items-center justify-center">
                                                        <Volume2 className="w-6 h-6 text-red-400" />
                                                    </div>
                                                    <p className="text-red-300 font-medium mb-1">Failed to generate audio</p>
                                                    <p className="text-[13px] text-red-400 mb-4">Something went wrong while creating the podcast audio.</p>
                                                    <button
                                                        onClick={handleGeneratePodcast}
                                                        disabled={isGeneratingScript || isGeneratingAudio}
                                                        className="px-5 py-2 bg-[#2c4066] border border-red-500/30 hover:bg-[#34507c] text-white rounded-lg font-medium transition-colors text-sm disabled:opacity-50"
                                                    >
                                                        Try Again
                                                    </button>
                                                </div>
                                            )}

                                            {/* Script Display */}
                                            {!isAssignmentAudioView && podcastScript && (
                                                <div className="p-6 space-y-6" style={{ backgroundColor: '#1F1F1F' }}>
                                                    <h3 className="text-[18px] font-medium text-slate-200 border-b border-slate-700 pb-4">Transcript</h3>
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
                            </>
                        )}
                    </div>
                );
            }






            case 'mindmap':
                // Show Draw.io workspace if toggled
                if (showDrawIOWorkspace) {
                    return (
                        <DrawIOWorkspace
                            onBack={() => setShowDrawIOWorkspace(false)}
                        />
                    );
                }

                // Default mindmap view
                return (
                    <div className="flex flex-1 w-full h-full min-h-0 bg-[#eef2f7] overflow-hidden text-slate-900">
                        {/* Left Sidebar - mimic assignment layout */}
                        <div
                            className="w-96 flex-shrink-0 border-r border-white/10 flex flex-col overflow-hidden z-20 shadow-[0_20px_60px_rgba(0,0,0,0.35)] h-full min-h-0"
                            style={{ backgroundColor: '#171717' }}
                        >
                            <div className="flex-1 min-h-0 overflow-y-auto flex flex-col p-6 gap-6">
                                {assignmentMindmapActive && (
                                    <button
                                        onClick={() => {
                                            setSelectedAssignmentFeature(null);
                                            setShowAssignmentDashboard(true);
                                            setActiveMode('assignment');
                                            setAssignmentMindmapActive(false);
                                        }}
                                        className="flex items-center gap-2 text-xs font-semibold text-slate-200 hover:text-white transition-colors"
                                    >
                                        <ChevronLeft className="w-4 h-4" />
                                        Back to Study Tools
                                    </button>
                                )}
                                <div className="space-y-3">
                                    <p className="text-xs font-bold text-slate-300 uppercase tracking-wider">1. Notes</p>
                                    {renderStandaloneNotesPanel('dark')}
                                </div>
                                <div className="space-y-3">
                                    <p className="text-xs font-bold text-slate-300 uppercase tracking-wider">2. Actions</p>
                                    <button
                                        onClick={handleGenerateStandaloneMindMap}
                                        disabled={isGeneratingStandaloneMindMap || (!standaloneNotes.trim() && !documentTextRef.current)}
                                        className="w-full px-4 py-2.5 text-sm text-white bg-[#2c4066] hover:bg-[#34507c] transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {isGeneratingStandaloneMindMap ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <Sparkles className="w-4 h-4" />
                                        )}
                                        {isGeneratingStandaloneMindMap ? 'Building...' : 'Generate Mind Map'}
                                    </button>
                                    <button
                                        onClick={handleOpenDrawIOWorkspace}
                                        className="w-full px-4 py-2.5 text-sm text-white bg-[#8B5CF6] hover:bg-[#7C3AED] transition-colors flex items-center justify-center gap-2"
                                        title="Open Draw.io workspace (loads the current mind map when available)"
                                    >
                                        <ExternalLink className="w-4 h-4" />
                                        Open Draw.io Workspace
                                    </button>
                                    <div className="text-[10px] text-slate-400 mt-2 px-2">
                                        <p className="mb-1 font-semibold text-slate-300">Next AI Draw.io Features:</p>
                                        <ul className="list-disc list-inside space-y-0.5 text-slate-400">
                                            <li>AI-powered diagram creation</li>
                                            <li>Natural language editing</li>
                                            <li>Image-based replication</li>
                                            <li>Cloud architecture support</li>
                                            <li>Animated connectors</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Main Content */}
                        <div className="flex-1 min-h-0 flex flex-col bg-[#eef2f7]">
                            <div className="flex-1 min-h-0 relative bg-[#eef2f7] overflow-hidden">
                                {reactFlowData ? (
                                    <ReactFlowMindMap data={reactFlowData} />
                                ) : (
                                    <div className="flex items-center justify-center h-full">
                                        <div className="text-center space-y-4">
                                            <div className="w-16 h-16 mx-auto mb-4 bg-[#1F1F1F] flex items-center justify-center">
                                                <MindmapIcon active />
                                            </div>
                                            <p className="text-[15px] text-slate-600">
                                                {processingStage === 'idle'
                                                    ? 'Upload a document or drop in your own notes to generate a mind map.'
                                                    : 'Generating mind map...'}
                                            </p>
                                            <div className="flex justify-center">
                                                <button
                                                    onClick={handleGenerateStandaloneMindMap}
                                                    disabled={isGeneratingStandaloneMindMap || (!standaloneNotes.trim() && !documentTextRef.current)}
                                                    className="inline-flex items-center gap-2 rounded-lg bg-[#2c4066] px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:bg-[#34507c] disabled:opacity-50"
                                                >
                                                    {isGeneratingStandaloneMindMap ? (
                                                        <Loader2 className="w-4 h-4 animate-spin" />
                                                    ) : (
                                                        <Sparkles className="w-4 h-4" />
                                                    )}
                                                    {isGeneratingStandaloneMindMap ? 'Building...' : 'Generate Mind Map'}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                );

            case 'simulation':
                return (
                    <div className={`flex flex-1 w-full h-screen min-h-screen max-h-screen bg-[#eef2f7] overflow-hidden text-slate-900 ${isSimulationFullscreen ? 'fixed inset-0 z-[100]' : ''}`} style={{ height: isSimulationFullscreen ? '100vh' : '100%' }}>
                        {/* Left Sidebar - Input & Controls */}
                        {!isSimulationFullscreen && sidebarOpen && (
                            <div className="w-96 flex-shrink-0 border-r border-white/10 flex flex-col overflow-hidden z-20 shadow-[0_20px_60px_rgba(0,0,0,0.35)] h-screen" style={{ backgroundColor: '#1F1F1F' }}>
                                {/* Main Content Area */}
                                <div className="flex-1 overflow-y-auto flex flex-col p-6 gap-6">
                                    {assignmentSimulationActive && (
                                        <button
                                            onClick={() => {
                                                setSelectedAssignmentFeature(null);
                                                setShowAssignmentDashboard(true);
                                                setActiveMode('assignment');
                                                setAssignmentSimulationActive(false);
                                            }}
                                            className="flex items-center gap-2 text-xs font-semibold text-slate-200 hover:text-white transition-colors"
                                        >
                                            <ChevronLeft className="w-4 h-4" />
                                            Back to Study Tools
                                        </button>
                                    )}
                                    {/* File Upload */}
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">1. Upload Source Material</label>
                                        <div
                                            onClick={() => notesFileInputRef.current?.click()}
                                            className="border border-white/10 bg-white/5 hover:bg-white/10 p-5 flex flex-col items-center justify-center cursor-pointer transition-all group rounded-none"
                                        >
                                            <input
                                                ref={notesFileInputRef}
                                                type="file"
                                                accept=".txt,.md,.pdf,.html"
                                                className="hidden"
                                                onChange={handleStandaloneNotesUpload}
                                            />
                                            {standaloneNotesName ? (
                                                <div className="flex flex-col items-center text-slate-100">
                                                    <Check className="w-7 h-7 mb-2" />
                                                    <span className="text-xs font-medium text-center break-all">{standaloneNotesName}</span>
                                                    <span className="text-[11px] text-slate-400 mt-1">Click to replace</span>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-center text-slate-400 group-hover:text-white transition-colors">
                                                    <FileUp className="w-6 h-6 mb-2" />
                                                    <span className="text-xs font-medium">Upload / Paste Notes</span>
                                                    <span className="text-[11px] mt-1">PDF, Text, or Markdown</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Topic Input */}
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">2. Topic / Concept</label>
                                        <input
                                            type="text"
                                            placeholder="e.g. Projectile Motion..."
                                            value={standaloneTopic}
                                            onChange={(e) => setStandaloneTopic(e.target.value)}
                                            className="w-full px-4 py-2 bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:ring-2 focus:ring-[#3b5b8a] focus:border-transparent outline-none transition-all rounded-none"
                                        />
                                    </div>

                                    {/* Generate Button */}
                                    <button
                                        onClick={handleGenerateSimulation}
                                        disabled={isGeneratingSimulation || (!immersiveContent && !standaloneNotes.trim() && !standaloneTopic.trim())}
                                        className={`
                                            w-full py-3 flex items-center justify-center gap-2 font-semibold text-sm uppercase tracking-wide transition-all rounded-none
                                            ${isGeneratingSimulation || (!immersiveContent && !standaloneNotes.trim() && !standaloneTopic.trim())
                                                ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                                                : 'bg-[#2c4066] text-white hover:bg-[#34507c] active:scale-95'}
                                        `}
                                    >
                                        {isGeneratingSimulation ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                <span className="text-xs">Generating...</span>
                                            </>
                                        ) : (
                                            <>
                                                <Sparkles className="w-4 h-4" />
                                                <span>Generate</span>
                                            </>
                                        )}
                                    </button>

                                    {/* Progress Steps - Show during generation */}
                                    {isGeneratingSimulation && simulationProgressSteps.length > 0 && (
                                        <>
                                            <div className="h-px bg-slate-700"></div>
                                            <div className="space-y-3">
                                                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">Progress</label>
                                                <div className="space-y-2">
                                                    {simulationProgressSteps.map((step, idx) => (
                                                        <div key={idx} className="flex items-center gap-2 text-xs text-slate-300">
                                                            {step.status === 'done' && <CheckCircle2 className="w-4 h-4 text-green-400" />}
                                                            {step.status === 'active' && <Loader2 className="w-4 h-4 text-[#2c4066] animate-spin" />}
                                                            {step.status === 'pending' && <div className="w-4 h-4 rounded-full border-2 border-slate-600" />}
                                                            <span className={step.status === 'pending' ? 'text-slate-500' : 'text-slate-300'}>{step.step}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </>
                                    )}

                                    {/* Controls - Show when simulation is ready */}
                                    {simulationHTML && !isGeneratingSimulation && (
                                        <>
                                            <div className="h-px bg-slate-700"></div>
                                            <div className="space-y-3">
                                                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">Controls</label>
                                                <div className="flex flex-col gap-2">
                                                    <button
                                                        onClick={handleRegenerateSimulation}
                                                        className="w-full px-4 py-2.5 text-sm text-slate-300 bg-white/5 border border-white/10 hover:bg-white/10 transition-colors flex items-center justify-center gap-2"
                                                    >
                                                        <RefreshCw className="w-4 h-4" />
                                                        Regenerate
                                                    </button>
                                                    <button
                                                        onClick={toggleSimulationFullscreen}
                                                        className="w-full px-4 py-2.5 text-sm text-white bg-[#2c4066] hover:bg-[#34507c] transition-colors flex items-center justify-center gap-2"
                                                    >
                                                        <Maximize2 className="w-4 h-4" />
                                                        Fullscreen
                                                    </button>
                                                </div>
                                            </div>
                                        </>
                                    )}

                                    <div className="h-px bg-slate-700"></div>
                                </div>

                                {/* Collapse Button */}
                                <div className="border-t border-slate-700 p-3 rounded-none">
                                    <button
                                        onClick={() => setSidebarOpen(false)}
                                        className="w-full px-3 py-2 text-xs text-slate-400 hover:text-slate-300 hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 rounded-none"
                                    >
                                        <ChevronRight className="w-4 h-4" />
                                        <span>Collapse Panel</span>
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Sidebar Toggle Button */}
                        {!isSimulationFullscreen && !sidebarOpen && (
                            <button
                                onClick={() => setSidebarOpen(true)}
                                className="absolute top-4 left-4 p-2 bg-slate-800 text-white hover:bg-slate-700 transition-colors z-10 shadow-lg"
                                title="Open sidebar"
                            >
                                <ChevronRight className="w-5 h-5 transform rotate-180" />
                            </button>
                        )}

                        {/* Fullscreen Header */}
                        {isSimulationFullscreen && (
                            <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
                                {simulationHTML && (
                                    <button
                                        onClick={handleRegenerateSimulation}
                                        className="px-3 py-1.5 text-sm text-white bg-black/50 hover:bg-black/70 transition-colors flex items-center gap-1.5 backdrop-blur-sm"
                                    >
                                        <RefreshCw className="w-4 h-4" />
                                        Regenerate
                                    </button>
                                )}
                                <button
                                    onClick={toggleSimulationFullscreen}
                                    className="px-3 py-1.5 text-sm text-white bg-[#2c4066] hover:bg-[#34507c] transition-colors flex items-center gap-1.5 backdrop-blur-sm"
                                >
                                    <Minimize2 className="w-4 h-4" />
                                    Exit Fullscreen
                                </button>
                            </div>
                        )}

                        {/* Main Content Area */}
                        <div className="flex-1 bg-[#f6f8fc] w-full h-screen max-h-screen min-h-0 overflow-hidden flex flex-col relative">
                            {/* Simulation Content */}
                            <div className={`flex-1 ${isSimulationFullscreen ? 'h-full' : 'overflow-hidden'}`} style={{ height: isSimulationFullscreen ? 'calc(100vh - 60px)' : undefined }}>
                                {/* Initial State - No Simulation */}
                                {!simulationHTML && !isGeneratingSimulation && !simulationError && (
                                    <div className="w-full h-full flex flex-col items-center justify-center bg-[#f6f8fc] text-slate-500 px-8 overflow-auto">
                                        <div className="flex flex-col items-center gap-6 text-center max-w-xl">
                                            <div className="w-24 h-24 bg-[#e4e9f2] flex items-center justify-center rounded-xl">
                                                <SimulationIcon active />
                                            </div>
                                            <div>
                                                <h3 className="text-2xl font-bold text-slate-700 mb-2">Ready to Create</h3>
                                                <p className="text-slate-500 mb-6">
                                                    Upload a file or enter a topic, then generate an interactive 3D simulation powered by AI.
                                                </p>
                                                <div className="flex items-center justify-center gap-4 text-sm text-slate-500">
                                                    <div className="flex items-center gap-2">
                                                        <FileUp className="w-4 h-4" />
                                                        <span>Upload or paste</span>
                                                    </div>
                                                    <div className="w-1 h-1 bg-slate-300"></div>
                                                    <div className="flex items-center gap-2">
                                                        <Sparkles className="w-4 h-4" />
                                                        <span>Generate</span>
                                                    </div>
                                                    <div className="w-1 h-1 bg-slate-300"></div>
                                                    <div className="flex items-center gap-2">
                                                        <SimulationIcon active />
                                                        <span>Explore</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Loading State */}
                                {isGeneratingSimulation && (
                                    <div className="w-full h-full flex flex-col items-center justify-center bg-[#f6f8fc] text-slate-500 px-8 overflow-auto">
                                        <div className="flex flex-col items-center gap-6 text-center max-w-md">
                                            <div className="relative w-16 h-16">
                                                <div className="absolute inset-0 bg-slate-300 opacity-40 blur-xl"></div>
                                                <Loader2 className="w-16 h-16 animate-spin text-[#2c4066] relative" />
                                            </div>
                                            <div>
                                                <p className="text-lg font-bold text-slate-700 mb-2">Generating Interactive Simulation</p>
                                                <p className="text-sm text-slate-500 mb-4">Creating your 3D visualization...</p>
                                                {simulationProgressSteps.length > 0 && (
                                                    <div className="mt-4 space-y-2 text-left">
                                                        {simulationProgressSteps.map((step, idx) => (
                                                            <div key={idx} className="flex items-center gap-2 text-xs text-slate-600">
                                                                {step.status === 'done' && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                                                                {step.status === 'active' && <Loader2 className="w-4 h-4 text-[#2c4066] animate-spin" />}
                                                                {step.status === 'pending' && <div className="w-4 h-4 rounded-full border-2 border-slate-300" />}
                                                                <span>{step.step}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                                <div className="flex items-center justify-center gap-2 text-xs text-[#2c4066] mt-4">
                                                    <span className="inline-block w-2 h-2 bg-[#2c4066] animate-pulse"></span>
                                                    <span>AI is working...</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Error State */}
                                {simulationError && !isGeneratingSimulation && (
                                    <div className="w-full h-full flex flex-col items-center justify-center bg-[#f6f8fc] text-slate-500 px-8 overflow-auto">
                                        <div className="flex flex-col items-center gap-6 text-center max-w-md">
                                            <div className="w-16 h-16 bg-red-100 border border-red-200 rounded-xl flex items-center justify-center">
                                                <X className="w-8 h-8 text-red-600" />
                                            </div>
                                            <div>
                                                <h3 className="text-lg font-bold text-slate-700 mb-2">Generation Failed</h3>
                                                <p className="text-sm text-slate-500 mb-6">{simulationError}</p>
                                                <Button
                                                    onClick={handleGenerateSimulation}
                                                    className="bg-[#2c4066] hover:bg-[#34507c] text-white"
                                                >
                                                    <RefreshCw className="w-4 h-4 mr-2" />
                                                    Try Again
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Simulation Iframe */}
                                {simulationHTML && !isGeneratingSimulation && !simulationError && (
                                    <iframe
                                        ref={simulationIframeRef}
                                        srcDoc={simulationHTML}
                                        className="w-full h-full border-0"
                                        title="Interactive Simulation"
                                        sandbox="allow-scripts allow-same-origin allow-forms"
                                    />
                                )}
                            </div>

                            {/* Blueprint Info Panel (shown when not fullscreen) */}
                            {simulationBlueprint && simulationHTML && !isSimulationFullscreen && (
                                <div className="p-4 bg-[#1F1F1F] border-t border-white/10">
                                    <div className="grid grid-cols-3 gap-4">
                                        <div>
                                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">Library</h4>
                                            <p className="text-sm text-slate-200">{simulationBlueprint.simulation_logic.preferred_library}</p>
                                        </div>
                                        <div>
                                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">Level</h4>
                                            <p className="text-sm text-slate-200">{simulationBlueprint.meta.academic_level}</p>
                                        </div>
                                        <div>
                                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">Complexity</h4>
                                            <div className="flex items-center gap-1">
                                                {[...Array(10)].map((_, i) => (
                                                    <div
                                                        key={i}
                                                        className={`w-2 h-2 ${i < simulationBlueprint.meta.complexity_rating ? 'bg-[#2c4066]' : 'bg-white/10'}`}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                    {simulationBlueprint.educational_content.key_points.length > 0 && (
                                        <div className="mt-4 pt-4 border-t border-white/10">
                                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">Key Learning Points</h4>
                                            <div className="flex flex-wrap gap-2">
                                                {simulationBlueprint.educational_content.key_points.slice(0, 4).map((point, idx) => (
                                                    <span key={idx} className="px-3 py-1 bg-white/5 text-sm text-slate-300 border border-white/10">
                                                        {point.length > 50 ? point.substring(0, 50) + '...' : point}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                );

            case 'robotics':
                return (
                    <div className="flex flex-col h-full" style={{ backgroundColor: '#ffffff' }}>
                        {isWebcamActive && (
                            <div className="flex items-center justify-end gap-2 px-4 pt-4">
                                <button
                                    onClick={toggleAutoAnalysis}
                                    className={`px-3 py-1.5 text-[13px] transition-colors flex items-center gap-1.5 ${isAutoAnalyzing
                                        ? 'bg-[#2c4066] text-white'
                                        : 'text-slate-700 hover:bg-slate-100 border border-slate-300'
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
                                    className="px-3 py-1.5 text-[13px] text-white bg-[#2c4066] hover:bg-[#34507c] disabled:opacity-50 transition-colors flex items-center gap-1.5"
                                >
                                    {isAnalyzing ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <Sparkles className="w-4 h-4" />
                                    )}
                                    Analyze Frame
                                </button>
                            </div>
                        )}

                        {/* Main Content */}
                        <div className="flex-1 min-h-0 flex flex-row-reverse">
                            {/* Webcam View */}
                            <div className="flex-1 min-h-0 relative border border-slate-200 overflow-hidden bg-white">
                                {!isWebcamActive ? (
                                    <div className="flex items-center justify-center h-full" style={{ backgroundColor: '#ffffff' }}>
                                        <div className="text-center max-w-md px-6">
                                            <div className="w-20 h-20 mx-auto mb-6 flex items-center justify-center">
                                                <RoboticsIcon />
                                            </div>
                                            <h3 className="text-[22px] font-medium text-slate-900 mb-3">Start Robotics Vision</h3>
                                            <p className="text-[15px] text-slate-600 mb-6">
                                                Use your webcam to detect objects, understand scenes, and explore spatial reasoning with Gemini Robotics-ER.
                                            </p>
                                            {webcamError ? (
                                                <p className="text-[14px] text-red-400 mb-4">{webcamError}</p>
                                            ) : null}
                                            <button
                                                onClick={startWebcam}
                                                className="px-6 py-3 bg-[#2c4066] hover:bg-[#34507c] text-white font-medium transition-colors flex items-center gap-2 mx-auto"
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
                            <div className="w-96 min-h-0 flex flex-col gap-3 overflow-y-auto flex-shrink-0 border-r border-white/10 bg-[#1F1F1F] p-4">
                                {/* Analysis Mode Selector */}
                                <div className="p-4 border border-white/10 bg-white/5">
                                    <h3 className="text-[14px] font-medium text-slate-200 mb-3">Analysis Mode</h3>
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
                                                className={`px-3 py-2 text-[13px] transition-colors flex items-center gap-1.5 ${analysisMode === mode.id
                                                    ? 'bg-[#2c4066] text-white'
                                                    : 'border border-white/10 text-slate-300 hover:bg-white/10 hover:text-white'
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
                                    <div className="p-4 border border-white/10 bg-white/5">
                                        <h3 className="text-[14px] font-medium text-slate-200 mb-2">
                                            {analysisMode === 'count' ? 'What to count?' : 'Your question'}
                                        </h3>
                                        <input
                                            type="text"
                                            value={roboticsQuery}
                                            onChange={(e) => setRoboticsQuery(e.target.value)}
                                            placeholder={analysisMode === 'count' ? 'e.g., people, cups, books...' : 'e.g., What should I move to make space?'}
                                            className="w-full px-3 py-2 border border-white/10 text-[14px] text-white bg-white/5 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#3b5b8a] focus:border-transparent"
                                        />
                                    </div>
                                )}

                                {/* Auto-Analysis Settings */}
                                <div className="p-4 border border-white/10 bg-white/5">
                                    <h3 className="text-[14px] font-medium text-slate-200 mb-2">
                                        Real-time Speed
                                        <span className="ml-2 text-[12px] text-slate-400 font-normal">
                                            {analysisInterval <= 300 ? '⚡ Fast' : analysisInterval <= 1000 ? '🔄 Normal' : '🐢 Slow'}
                                        </span>
                                    </h3>
                                    <div className="flex items-center gap-3">
                                        <span className="text-[11px] text-slate-400">Fast</span>
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
                                            className="flex-1 accent-[#3b5b8a]"
                                        />
                                        <span className="text-[11px] text-slate-400">Slow</span>
                                        <span className="text-[13px] text-slate-400 w-14 text-right">{analysisInterval}ms</span>
                                    </div>
                                </div>

                                {/* Results Panel */}
                                <div className="flex-1 p-4 border border-white/10 overflow-y-auto bg-white/5">
                                    <h3 className="text-[14px] font-medium text-slate-200 mb-3">Results</h3>

                                    {/* Count Result */}
                                    {countResult && (
                                        <div className="mb-4 p-3 border border-white/10 bg-white/5">
                                            <div className="text-[32px] font-bold text-slate-100">{countResult.count}</div>
                                            <div className="text-[13px] text-slate-300">{roboticsQuery} found</div>
                                        </div>
                                    )}

                                    {/* Scene Description */}
                                    {sceneDescription && (
                                        <div className="mb-4 p-3 border border-white/10 bg-white/5">
                                            <p className="text-[14px] text-slate-200 leading-relaxed">{sceneDescription}</p>
                                        </div>
                                    )}

                                    {/* Classification Results */}
                                    {classificationResult && classificationResult.length > 0 && (
                                        <div className="space-y-2">
                                            {classificationResult.map((item, idx) => (
                                                <div key={idx} className="p-3 border border-white/10 bg-white/5">
                                                    <div className="font-medium text-[14px] text-slate-200">{item.label}</div>
                                                    <div className="flex flex-wrap gap-1 mt-1">
                                                        {item.attributes.map((attr, i) => (
                                                            <span key={i} className="px-2 py-0.5 border border-white/10 text-slate-300 text-[11px] bg-white/5">
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
                                                <div key={idx} className="flex items-center justify-between p-2 border border-white/10 bg-white/5">
                                                    <span className="text-[14px] text-slate-200">{obj.label}</span>
                                                    <span className="text-[12px] text-slate-400">
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
                                                <div key={idx} className="flex items-center gap-2 p-2 bg-white/5 rounded-lg border border-white/10">
                                                    <div
                                                        className="w-3 h-3 rounded"
                                                        style={{ backgroundColor: ['#ff5722', '#4caf50', '#2196f3', '#ff9800', '#9c27b0', '#00bcd4'][idx % 6] }}
                                                    />
                                                    <span className="text-[14px] text-slate-200">{box.label}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Hand Tracking Info */}
                                    {analysisMode === 'hand' && (
                                        <div className="space-y-3">
                                            <div className="p-3 bg-white/5 rounded-lg border border-white/10">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <Hand className="w-5 h-5 text-[#00bcd4]" />
                                                    <span className="font-medium text-[14px] text-slate-200">Hand Skeleton Tracking</span>
                                                </div>
                                                <div className={`text-[13px] ${handLandmarks ? 'text-emerald-400' : 'text-amber-400'}`}>
                                                    {handLandmarks ? '✓ Hand detected with 21 landmarks' : '⏳ Waiting for hand...'}
                                                </div>
                                            </div>

                                            {handLandmarks && (
                                                <>
                                                    <div className="p-3 bg-white/5 rounded-lg border border-white/10">
                                                        <div className="text-[13px] font-medium text-slate-200 mb-2">Landmark Legend</div>
                                                        <div className="space-y-1.5 text-[12px]">
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-3 h-3 rounded-full bg-[#00bcd4]"></div>
                                                                <span className="text-slate-300">Wrist (base)</span>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-3 h-3 rounded-full bg-[#ff4081]"></div>
                                                                <span className="text-slate-300">Fingertips</span>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-3 h-3 rounded-full bg-[#00ff88]"></div>
                                                                <span className="text-slate-300">Joints</span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="p-3 bg-white/5 rounded-lg border border-white/10">
                                                        <div className="text-[13px] font-medium text-slate-200 mb-2">Fingertip Positions</div>
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
                                                                        <span className="text-slate-300">{name}</span>
                                                                        <span className="text-slate-200 font-mono">
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
                                        <p className="text-[14px] text-slate-400 text-center py-4">
                                            {isWebcamActive ? 'Click "Analyze Frame" to detect objects' : 'Start webcam to begin'}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                );

            case 'visual-activity':
                const showVisualActivityTabs = !assignmentVisualActivityActive || visualActivityTab === '3d';
                return (
                    <div className="flex flex-1 w-full h-screen min-h-screen max-h-screen bg-[#eef2f7] overflow-hidden text-slate-900">
                        {/* Tab Selector */}
                        {showVisualActivityTabs && (
                            <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50 flex gap-2 bg-white/90 backdrop-blur-sm rounded-lg p-1 shadow-lg border border-slate-200">
                                <button
                                    onClick={() => setVisualActivityTab('image')}
                                    className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${visualActivityTab === 'image'
                                        ? 'bg-[#2c4066] text-white shadow-sm'
                                        : 'text-slate-600 hover:bg-slate-100'
                                        }`}
                                >
                                    <ImageIcon className="w-4 h-4" />
                                    Image Activity
                                </button>
                                <button
                                    onClick={() => setVisualActivityTab('3d')}
                                    className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${visualActivityTab === '3d'
                                        ? 'bg-[#2c4066] text-white shadow-sm'
                                        : 'text-slate-600 hover:bg-slate-100'
                                        }`}
                                >
                                    <Box className="w-4 h-4" />
                                    3D Explorer
                                </button>
                            </div>
                        )}

                        {visualActivityTab === 'image' ? (
                            /* Image Activity Tab */
                            <div className="flex flex-1 w-full h-screen min-h-screen max-h-screen bg-[#eef2f7] overflow-hidden text-slate-900">
                                {/* Left Sidebar - Input */}
                                {sidebarOpen && (
                                    <div className="w-96 flex-shrink-0 border-r border-white/10 flex flex-col overflow-hidden z-20 shadow-[0_20px_60px_rgba(0,0,0,0.35)] h-screen" style={{ backgroundColor: '#1F1F1F' }}>
                                        {/* Main Content Area */}
                                        <div className="flex-1 overflow-y-auto flex flex-col p-6 gap-6">
                                            {assignmentVisualActivityActive && (
                                                <button
                                                    onClick={() => {
                                                        setSelectedAssignmentFeature(null);
                                                        setShowAssignmentDashboard(true);
                                                        setActiveMode('assignment');
                                                        setAssignmentVisualActivityActive(false);
                                                    }}
                                                    className="flex items-center gap-2 text-xs font-semibold text-slate-200 hover:text-white transition-colors"
                                                >
                                                    <ChevronLeft className="w-4 h-4" />
                                                    Back to Study Tools
                                                </button>
                                            )}
                                            {/* Mode Toggle */}
                                            <div className="space-y-2">
                                                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">Mode</label>
                                                <div className="flex gap-2 bg-slate-800/50 rounded-lg p-1">
                                                    <button
                                                        onClick={() => {
                                                            setImageActivityMode('generate');
                                                            setUploadedImageUrl(null);
                                                            setGeneratedImageActivityUrl(null);
                                                            setImageActivityLabels([]);
                                                            resetImageQuiz();
                                                        }}
                                                        className={`flex-1 px-3 py-2 rounded-md text-xs font-medium transition-all ${imageActivityMode === 'generate'
                                                            ? 'bg-[#2c4066] text-white shadow-sm'
                                                            : 'text-slate-400 hover:text-slate-200'
                                                            }`}
                                                    >
                                                        <Sparkles className="w-3.5 h-3.5 inline mr-1.5" />
                                                        Generate
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            setImageActivityMode('upload');
                                                            setGeneratedImageActivityUrl(null);
                                                            setImageActivityPrompt('');
                                                            setImageActivityLabels([]);
                                                            resetImageQuiz();
                                                        }}
                                                        className={`flex-1 px-3 py-2 rounded-md text-xs font-medium transition-all ${imageActivityMode === 'upload'
                                                            ? 'bg-[#2c4066] text-white shadow-sm'
                                                            : 'text-slate-400 hover:text-slate-200'
                                                            }`}
                                                    >
                                                        <Upload className="w-3.5 h-3.5 inline mr-1.5" />
                                                        Upload
                                                    </button>
                                                </div>
                                            </div>

                                            {imageActivityMode === 'generate' ? (
                                                <>
                                                    {/* Prompt Input */}
                                                    <div className="space-y-2">
                                                        <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">1. Describe Your Image</label>
                                                        <textarea
                                                            id="image-prompt"
                                                            value={imageActivityPrompt}
                                                            onChange={(e) => {
                                                                setImageActivityPrompt(e.target.value);
                                                                // Clear error when user starts typing
                                                                if (imageActivityError) {
                                                                    setImageActivityError(null);
                                                                }
                                                            }}
                                                            placeholder="e.g., A cross-section of a plant cell showing chloroplasts, mitochondria, and nucleus with detailed labels..."
                                                            className="w-full px-4 py-3 bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:ring-2 focus:ring-[#3b5b8a] focus:border-transparent outline-none transition-all min-h-[120px] resize-none"
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                                                                    handleGenerateImageActivity();
                                                                }
                                                            }}
                                                        />
                                                        <p className="text-xs text-slate-400">
                                                            Tip: Be specific about details, colors, and style for the best results. Press Ctrl+Enter to generate.
                                                        </p>
                                                    </div>

                                                    {/* Document Reference Option */}
                                                    {documentTextRef.current && documentTextRef.current.trim() && (
                                                        <div className="space-y-2">
                                                            <label className="flex items-center gap-3 cursor-pointer group">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={useDocumentContext}
                                                                    onChange={(e) => setUseDocumentContext(e.target.checked)}
                                                                    className="w-4 h-4 rounded border-white/20 bg-white/5 text-[#2c4066] focus:ring-2 focus:ring-[#3b5b8a] cursor-pointer"
                                                                />
                                                                <div className="flex-1">
                                                                    <div className="flex items-center gap-2">
                                                                        <FileText className="w-4 h-4 text-slate-300" />
                                                                        <span className="text-sm font-medium text-slate-200">Use Document Context</span>
                                                                    </div>
                                                                    <p className="text-xs text-slate-400 mt-1 ml-6">
                                                                        Enhance image generation with context from your current document
                                                                    </p>
                                                                </div>
                                                            </label>
                                                        </div>
                                                    )}

                                                    {/* Generate Button */}
                                                    <button
                                                        onClick={handleGenerateImageActivity}
                                                        disabled={!imageActivityPrompt.trim() || isGeneratingImageActivity}
                                                        className={`
                                                    w-full py-3 flex items-center justify-center gap-2 font-semibold text-sm uppercase tracking-wide transition-all
                                                    ${!imageActivityPrompt.trim() || isGeneratingImageActivity
                                                                ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                                                                : 'bg-[#2c4066] text-white hover:bg-[#34507c] active:scale-95'}
                                                `}
                                                    >
                                                        {isGeneratingImageActivity ? (
                                                            <>
                                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                                <span className="text-xs">
                                                                    {isExtractingContext ? 'Analyzing document...' : 'Generating image...'}
                                                                </span>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Sparkles className="w-4 h-4" />
                                                                <span>Generate Image</span>
                                                            </>
                                                        )}
                                                    </button>
                                                </>
                                            ) : (
                                                <>
                                                    {/* Upload Section */}
                                                    <div className="space-y-2">
                                                        <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">Upload Your Image</label>
                                                        <div className="border-2 border-dashed border-slate-600 rounded-lg p-6 text-center hover:border-slate-500 transition-colors">
                                                            <input
                                                                type="file"
                                                                accept="image/*"
                                                                onChange={handleImageUpload}
                                                                disabled={isUploadingImage}
                                                                className="hidden"
                                                                id="image-upload-input"
                                                            />
                                                            <label
                                                                htmlFor="image-upload-input"
                                                                className={`cursor-pointer flex flex-col items-center gap-3 ${isUploadingImage ? 'opacity-50 cursor-not-allowed' : ''
                                                                    }`}
                                                            >
                                                                {isUploadingImage ? (
                                                                    <>
                                                                        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
                                                                        <span className="text-sm text-slate-400">Uploading and analyzing...</span>
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <Upload className="w-10 h-10 text-slate-400" />
                                                                        <div>
                                                                            <p className="text-sm font-medium text-slate-200 mb-1">
                                                                                Click to upload or drag and drop
                                                                            </p>
                                                                            <p className="text-xs text-slate-500">
                                                                                PNG, JPG, JPEG up to 10MB
                                                                            </p>
                                                                            <p className="text-xs text-slate-500 mt-1">
                                                                                Hand-drawn diagrams, textbook images, etc.
                                                                            </p>
                                                                        </div>
                                                                    </>
                                                                )}
                                                            </label>
                                                        </div>
                                                        {uploadedImageUrl && (
                                                            <div className="mt-3 p-3 bg-slate-800/50 rounded-lg">
                                                                <p className="text-xs text-slate-400 mb-2">Uploaded Image:</p>
                                                                <div className="relative">
                                                                    <img
                                                                        src={uploadedImageUrl}
                                                                        alt="Uploaded"
                                                                        className="w-full h-auto rounded border border-slate-700 max-h-32 object-contain"
                                                                    />
                                                                    <button
                                                                        onClick={() => {
                                                                            setUploadedImageUrl(null);
                                                                            setImageActivityLabels([]);
                                                                            resetImageQuiz();
                                                                        }}
                                                                        className="absolute top-1 right-1 p-1 bg-slate-900/80 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors"
                                                                        title="Remove image"
                                                                    >
                                                                        <X className="w-3 h-3" />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </>
                                            )}

                                            <div className="h-px bg-slate-700"></div>
                                        </div>

                                        {/* Collapse Button */}
                                        <div className="border-t border-slate-700 p-3 rounded-none">
                                            <button
                                                onClick={() => setSidebarOpen(false)}
                                                className="w-full px-3 py-2 text-xs text-slate-400 hover:text-slate-300 hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 rounded-none"
                                            >
                                                <ChevronRight className="w-4 h-4" />
                                                <span>Collapse Panel</span>
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Right Side - Image Display */}
                                <div className="flex-1 bg-[#f6f8fc] w-full h-screen max-h-screen min-h-0 overflow-hidden flex flex-col relative">
                                    {!sidebarOpen && (
                                        <button
                                            onClick={() => setSidebarOpen(true)}
                                            className="absolute top-4 left-4 p-2 bg-slate-800 text-white hover:bg-slate-700 transition-colors z-10 shadow-lg"
                                            title="Open sidebar"
                                        >
                                            <ChevronRight className="w-5 h-5 transform rotate-180" />
                                        </button>
                                    )}

                                    {/* Image Display Area */}
                                    <div className="flex-1 w-full h-full min-h-0 overflow-auto flex items-center justify-center p-6 lg:p-8">
                                        {getCurrentImageUrl() ? (
                                            <div className="w-full max-w-7xl space-y-6">
                                                {/* Header Section */}
                                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
                                                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                                                        <div>
                                                            <h3 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                                                                <ImageIcon className="w-6 h-6 text-[#2c4066]" />
                                                                Generated Image
                                                            </h3>
                                                            <p className="text-sm text-slate-500 mt-1">Interactive educational diagram</p>
                                                        </div>
                                                        {isAnalyzingImage && (
                                                            <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-full text-sm text-blue-700">
                                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                                <span>Analyzing labels...</span>
                                                            </div>
                                                        )}
                                                        {imageActivityLabels.length > 0 && !imageQuizMode && (
                                                            <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-full text-sm text-emerald-700">
                                                                <CheckCircle2 className="w-4 h-4" />
                                                                <span className="font-medium">{imageActivityLabels.length} interactive labels</span>
                                                            </div>
                                                        )}
                                                        {imageQuizMode && (
                                                            <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-50 border border-purple-200 rounded-full text-sm text-purple-700">
                                                                <Target className="w-4 h-4" />
                                                                <span className="font-medium">Quiz Mode Active</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        {imageActivityLabels.length > 0 && (
                                                            <>
                                                                <div className="flex items-center gap-2 bg-slate-50 rounded-lg p-1 border border-slate-200">
                                                                    <button
                                                                        onClick={() => {
                                                                            if (imageQuizMode) {
                                                                                resetImageQuiz();
                                                                            } else {
                                                                                setImageQuizMode(true);
                                                                                setImageQuizType('find');
                                                                            }
                                                                        }}
                                                                        className={`flex items-center gap-2 px-4 py-2 rounded-md transition-all font-medium text-sm ${imageQuizMode
                                                                            ? 'bg-emerald-600 text-white shadow-sm hover:bg-emerald-700'
                                                                            : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                                                                            }`}
                                                                    >
                                                                        <Target className="w-4 h-4" />
                                                                        {imageQuizMode ? 'Exit Quiz' : 'Start Quiz'}
                                                                    </button>
                                                                    {imageQuizMode && (
                                                                        <div className="flex items-center gap-1 border-l border-slate-300 pl-1">
                                                                            <button
                                                                                onClick={() => setImageQuizType('find')}
                                                                                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${imageQuizType === 'find'
                                                                                    ? 'bg-[#2c4066] text-white shadow-sm'
                                                                                    : 'text-slate-600 hover:bg-slate-100'
                                                                                    }`}
                                                                            >
                                                                                Find
                                                                            </button>
                                                                            <button
                                                                                onClick={() => setImageQuizType('write')}
                                                                                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${imageQuizType === 'write'
                                                                                    ? 'bg-[#2c4066] text-white shadow-sm'
                                                                                    : 'text-slate-600 hover:bg-slate-100'
                                                                                    }`}
                                                                            >
                                                                                Name
                                                                            </button>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </>
                                                        )}
                                                        {imageActivityMode === 'generate' && (
                                                            <button
                                                                onClick={() => {
                                                                    const link = document.createElement('a');
                                                                    link.href = generatedImageActivityUrl || '';
                                                                    link.download = `ai-generated-${Date.now()}.png`;
                                                                    link.click();
                                                                }}
                                                                className="flex items-center gap-2 px-4 py-2 bg-[#2c4066] text-white hover:bg-[#34507c] transition-all font-medium text-sm rounded-lg shadow-sm"
                                                            >
                                                                <Download className="w-4 h-4" />
                                                                Download
                                                            </button>
                                                        )}
                                                        {imageActivityMode === 'upload' && uploadedImageUrl && (
                                                            <button
                                                                onClick={() => {
                                                                    const link = document.createElement('a');
                                                                    link.href = uploadedImageUrl;
                                                                    link.download = `uploaded-image-${Date.now()}.png`;
                                                                    link.click();
                                                                }}
                                                                className="flex items-center gap-2 px-4 py-2 bg-[#2c4066] text-white hover:bg-[#34507c] transition-all font-medium text-sm rounded-lg shadow-sm"
                                                            >
                                                                <Download className="w-4 h-4" />
                                                                Download
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className={`grid grid-cols-1 gap-6 ${selectedImageLabel ? 'lg:grid-cols-3' : 'lg:grid-cols-1'}`}>
                                                    {/* Image with Interactive Overlay */}
                                                    <div className={selectedImageLabel ? 'lg:col-span-2' : 'lg:col-span-1'}>
                                                        <div
                                                            ref={setImageContainerRef}
                                                            className="aspect-video w-full bg-gradient-to-br from-slate-50 to-white border-2 border-slate-200 rounded-xl overflow-hidden shadow-xl group relative"
                                                        >
                                                            <img
                                                                src={getCurrentImageUrl() || ''}
                                                                alt={imageActivityMode === 'upload' ? 'Uploaded Image' : 'AI Generated'}
                                                                className="w-full h-full object-contain"
                                                                onLoad={(e) => {
                                                                    const img = e.currentTarget;
                                                                    setImageDimensions({
                                                                        width: img.offsetWidth,
                                                                        height: img.offsetHeight
                                                                    });
                                                                }}
                                                            />
                                                            {/* Interactive Labels Overlay */}
                                                            {imageActivityLabels.length > 0 && imageDimensions.width > 0 && (
                                                                <svg
                                                                    className="absolute top-0 left-0 w-full h-full pointer-events-none"
                                                                    style={{ width: '100%', height: '100%' }}
                                                                >
                                                                    {imageActivityLabels.map((label, idx) => {
                                                                        const isSelected = selectedImageLabel?.term === label.term;
                                                                        const isCorrect = imageQuizCorrect.includes(label.term);
                                                                        const isWrong = imageQuizWrong === label.term;
                                                                        const isRevealed = imageRevealedLabels.includes(label.term);

                                                                        // Convert normalized coordinates (0-1000) to percentage
                                                                        const x = (label.coordinates.xmin / 1000) * 100;
                                                                        const y = (label.coordinates.ymin / 1000) * 100;
                                                                        const width = ((label.coordinates.xmax - label.coordinates.xmin) / 1000) * 100;
                                                                        const height = ((label.coordinates.ymax - label.coordinates.ymin) / 1000) * 100;

                                                                        let fillColor = 'rgba(59, 130, 246, 0.15)';
                                                                        let strokeColor = '#3b82f6';
                                                                        let textColor = '#1e40af';
                                                                        let strokeWidth = 2;

                                                                        if (isSelected) {
                                                                            fillColor = 'rgba(16, 185, 129, 0.25)';
                                                                            strokeColor = '#10b981';
                                                                            textColor = '#059669';
                                                                            strokeWidth = 3;
                                                                        } else if (isCorrect) {
                                                                            fillColor = 'rgba(34, 197, 94, 0.25)';
                                                                            strokeColor = '#22c55e';
                                                                            textColor = '#16a34a';
                                                                            strokeWidth = 2.5;
                                                                        } else if (isWrong) {
                                                                            fillColor = 'rgba(239, 68, 68, 0.25)';
                                                                            strokeColor = '#ef4444';
                                                                            textColor = '#dc2626';
                                                                            strokeWidth = 2.5;
                                                                        }

                                                                        return (
                                                                            <g key={idx} className="pointer-events-auto">
                                                                                <rect
                                                                                    x={`${x}%`}
                                                                                    y={`${y}%`}
                                                                                    width={`${width}%`}
                                                                                    height={`${height}%`}
                                                                                    fill={fillColor}
                                                                                    stroke={strokeColor}
                                                                                    strokeWidth={strokeWidth}
                                                                                    strokeDasharray={isSelected ? "6,4" : "none"}
                                                                                    rx="2"
                                                                                    className="cursor-pointer hover:opacity-90 transition-all"
                                                                                    onClick={() => handleImageLabelClick(label)}
                                                                                />
                                                                                {(!imageQuizMode || (imageQuizMode && (isRevealed || isCorrect || isSelected))) && (
                                                                                    <g>
                                                                                        <text
                                                                                            x={`${x + width / 2}%`}
                                                                                            y={`${y - 8}%`}
                                                                                            fill="white"
                                                                                            fontSize="11"
                                                                                            fontWeight="700"
                                                                                            textAnchor="middle"
                                                                                            className="pointer-events-none"
                                                                                            style={{
                                                                                                textShadow: '0 2px 4px rgba(0,0,0,0.5), 0 0 8px rgba(0,0,0,0.3)',
                                                                                                pointerEvents: 'none'
                                                                                            }}
                                                                                        >
                                                                                            {label.term}
                                                                                        </text>
                                                                                        <text
                                                                                            x={`${x + width / 2}%`}
                                                                                            y={`${y - 8}%`}
                                                                                            fill={textColor}
                                                                                            fontSize="11"
                                                                                            fontWeight="700"
                                                                                            textAnchor="middle"
                                                                                            className="pointer-events-none"
                                                                                            style={{
                                                                                                pointerEvents: 'none'
                                                                                            }}
                                                                                        >
                                                                                            {label.term}
                                                                                        </text>
                                                                                    </g>
                                                                                )}
                                                                            </g>
                                                                        );
                                                                    })}
                                                                </svg>
                                                            )}
                                                            {/* Clickable areas for labels */}
                                                            {imageActivityLabels.length > 0 && imageDimensions.width > 0 && (
                                                                <div className="absolute inset-0 pointer-events-none">
                                                                    {imageActivityLabels.map((label, idx) => {
                                                                        const x = (label.coordinates.xmin / 1000) * 100;
                                                                        const y = (label.coordinates.ymin / 1000) * 100;
                                                                        const width = ((label.coordinates.xmax - label.coordinates.xmin) / 1000) * 100;
                                                                        const height = ((label.coordinates.ymax - label.coordinates.ymin) / 1000) * 100;

                                                                        return (
                                                                            <div
                                                                                key={idx}
                                                                                className="absolute pointer-events-auto cursor-pointer hover:bg-blue-500/10 transition-colors"
                                                                                style={{
                                                                                    left: `${x}%`,
                                                                                    top: `${y}%`,
                                                                                    width: `${width}%`,
                                                                                    height: `${height}%`,
                                                                                }}
                                                                                onClick={() => handleImageLabelClick(label)}
                                                                            />
                                                                        );
                                                                    })}
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Quiz Instructions */}
                                                        {imageQuizMode && (
                                                            <div className="mt-6 p-5 bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl shadow-sm">
                                                                {imageQuizType === 'find' ? (
                                                                    <div className="space-y-3">
                                                                        <div className="flex items-center gap-2">
                                                                            <Target className="w-5 h-5 text-blue-600" />
                                                                            <p className="text-base font-bold text-blue-900">
                                                                                Find the Label
                                                                            </p>
                                                                        </div>
                                                                        {selectedImageLabel ? (
                                                                            <div className="bg-white rounded-lg p-3 border-2 border-blue-300">
                                                                                <p className="text-sm text-slate-600 mb-1">Click on:</p>
                                                                                <p className="text-lg font-bold text-blue-700">{selectedImageLabel.term}</p>
                                                                            </div>
                                                                        ) : (
                                                                            <p className="text-sm text-blue-700">
                                                                                Select a label from the list below to find it on the image
                                                                            </p>
                                                                        )}
                                                                        {imageQuizCorrect.length > 0 && (
                                                                            <div className="flex items-center gap-2 bg-green-100 rounded-lg px-3 py-2 border border-green-300">
                                                                                <CheckCircle2 className="w-5 h-5 text-green-600" />
                                                                                <p className="text-sm font-semibold text-green-700">
                                                                                    Progress: {imageQuizCorrect.length} / {imageActivityLabels.length} correct
                                                                                </p>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                ) : (
                                                                    <div className="space-y-3">
                                                                        <div className="flex items-center gap-2">
                                                                            <HelpCircle className="w-5 h-5 text-blue-600" />
                                                                            <p className="text-base font-bold text-blue-900">
                                                                                Name the Label
                                                                            </p>
                                                                        </div>
                                                                        {selectedImageLabel ? (
                                                                            <div className="space-y-3">
                                                                                <p className="text-sm text-blue-700 font-medium">
                                                                                    What is this highlighted part called?
                                                                                </p>
                                                                                <div className="flex gap-2">
                                                                                    <input
                                                                                        type="text"
                                                                                        value={imageUserGuess}
                                                                                        onChange={(e) => setImageUserGuess(e.target.value)}
                                                                                        onKeyDown={(e) => {
                                                                                            if (e.key === 'Enter') {
                                                                                                submitImageGuess();
                                                                                            }
                                                                                        }}
                                                                                        placeholder="Type the name here..."
                                                                                        className={`flex-1 px-4 py-2.5 border-2 rounded-lg text-sm font-medium transition-all ${imageGuessError
                                                                                            ? 'border-red-400 focus:ring-red-500 bg-red-50'
                                                                                            : 'border-slate-300 focus:ring-blue-500 focus:border-blue-400'
                                                                                            } focus:outline-none focus:ring-2`}
                                                                                        autoFocus
                                                                                    />
                                                                                    <button
                                                                                        onClick={submitImageGuess}
                                                                                        className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all font-medium text-sm shadow-sm"
                                                                                    >
                                                                                        Submit
                                                                                    </button>
                                                                                </div>
                                                                                {imageGuessError && (
                                                                                    <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 border border-red-200">
                                                                                        <X className="w-4 h-4" />
                                                                                        <span>Incorrect. Try again!</span>
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        ) : (
                                                                            <p className="text-sm text-blue-700">
                                                                                Click on a highlighted area on the image to name it
                                                                            </p>
                                                                        )}
                                                                        {imageRevealedLabels.length > 0 && (
                                                                            <div className="flex items-center gap-2 bg-green-100 rounded-lg px-3 py-2 border border-green-300">
                                                                                <CheckCircle2 className="w-5 h-5 text-green-600" />
                                                                                <p className="text-sm font-semibold text-green-700">
                                                                                    Revealed: {imageRevealedLabels.length} / {imageActivityLabels.length}
                                                                                </p>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Information Panel */}
                                                    {selectedImageLabel && (
                                                        <div className="lg:col-span-1">
                                                            <div className="bg-white border-2 border-slate-200 rounded-xl shadow-xl p-6 space-y-5 sticky top-6 max-h-[calc(100vh-3rem)] overflow-y-auto">
                                                                <div className="flex items-start justify-between pb-4 border-b border-slate-200 sticky top-0 bg-white z-10">
                                                                    <div>
                                                                        <h4 className="text-2xl font-bold text-slate-900 mb-1">
                                                                            {selectedImageLabel.term}
                                                                        </h4>
                                                                        <p className="text-xs text-slate-500 uppercase tracking-wider">Selected Label</p>
                                                                    </div>
                                                                    <button
                                                                        onClick={() => {
                                                                            setSelectedImageLabel(null);
                                                                            setEnhancedLabelInfo(null);
                                                                        }}
                                                                        className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg p-1 transition-all"
                                                                        title="Close panel"
                                                                    >
                                                                        <X className="w-5 h-5" />
                                                                    </button>
                                                                </div>

                                                                {isLoadingEnhancedInfo ? (
                                                                    <div className="flex flex-col items-center justify-center py-8">
                                                                        <Loader2 className="w-8 h-8 animate-spin text-emerald-500 mb-3" />
                                                                        <p className="text-sm text-slate-600">Loading intelligent information...</p>
                                                                    </div>
                                                                ) : (
                                                                    <div className="space-y-5">
                                                                        {/* Definition */}
                                                                        <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
                                                                            <h5 className="text-sm font-bold text-blue-900 mb-3 flex items-center gap-2 uppercase tracking-wide">
                                                                                <Info className="w-4 h-4" />
                                                                                Definition
                                                                            </h5>
                                                                            <p className="text-sm text-slate-700 leading-relaxed">
                                                                                {enhancedLabelInfo?.definition || selectedImageLabel.definition}
                                                                            </p>
                                                                        </div>

                                                                        {/* Visual Description */}
                                                                        {enhancedLabelInfo?.visualDescription && (
                                                                            <div className="bg-purple-50 rounded-lg p-4 border border-purple-100">
                                                                                <h5 className="text-sm font-bold text-purple-900 mb-3 flex items-center gap-2 uppercase tracking-wide">
                                                                                    <Eye className="w-4 h-4" />
                                                                                    Visual Description
                                                                                </h5>
                                                                                <p className="text-sm text-slate-700 leading-relaxed">
                                                                                    {enhancedLabelInfo.visualDescription}
                                                                                </p>
                                                                            </div>
                                                                        )}

                                                                        {/* Equations */}
                                                                        {enhancedLabelInfo?.equations && enhancedLabelInfo.equations.length > 0 && (
                                                                            <div className="bg-green-50 rounded-lg p-4 border border-green-100">
                                                                                <h5 className="text-sm font-bold text-green-900 mb-3 flex items-center gap-2 uppercase tracking-wide">
                                                                                    <Zap className="w-4 h-4" />
                                                                                    Related Equations
                                                                                </h5>
                                                                                <div className="space-y-2">
                                                                                    {enhancedLabelInfo.equations.map((eq, idx) => {
                                                                                        // Format equation for LaTeX rendering
                                                                                        const formattedEq = eq.startsWith('$') ? eq : eq.startsWith('$$') ? eq : `$$${eq}$$`;
                                                                                        return (
                                                                                            <div key={idx} className="bg-white rounded-md p-3 border border-green-200">
                                                                                                <div className="text-sm">
                                                                                                    <ReactMarkdown
                                                                                                        remarkPlugins={[remarkMath]}
                                                                                                        rehypePlugins={[rehypeKatex]}
                                                                                                    >
                                                                                                        {formattedEq}
                                                                                                    </ReactMarkdown>
                                                                                                </div>
                                                                                            </div>
                                                                                        );
                                                                                    })}
                                                                                </div>
                                                                            </div>
                                                                        )}

                                                                        {/* Relationships */}
                                                                        {enhancedLabelInfo?.relationships && enhancedLabelInfo.relationships.length > 0 && (
                                                                            <div className="bg-indigo-50 rounded-lg p-4 border border-indigo-100">
                                                                                <h5 className="text-sm font-bold text-indigo-900 mb-3 flex items-center gap-2 uppercase tracking-wide">
                                                                                    <GitBranch className="w-4 h-4" />
                                                                                    Relationships
                                                                                </h5>
                                                                                <div className="space-y-2">
                                                                                    {enhancedLabelInfo.relationships.map((rel, idx) => (
                                                                                        <div key={idx} className="bg-white rounded-md p-3 border border-indigo-200">
                                                                                            <p className="text-sm font-semibold text-slate-900 mb-1">
                                                                                                {rel.relatedTo}
                                                                                            </p>
                                                                                            <p className="text-xs text-slate-600 leading-relaxed">
                                                                                                {rel.relationship}
                                                                                            </p>
                                                                                        </div>
                                                                                    ))}
                                                                                </div>
                                                                            </div>
                                                                        )}

                                                                        {/* Key Concepts */}
                                                                        {enhancedLabelInfo?.keyConcepts && enhancedLabelInfo.keyConcepts.length > 0 && (
                                                                            <div className="bg-cyan-50 rounded-lg p-4 border border-cyan-100">
                                                                                <h5 className="text-sm font-bold text-cyan-900 mb-3 flex items-center gap-2 uppercase tracking-wide">
                                                                                    <Brain className="w-4 h-4" />
                                                                                    Key Concepts
                                                                                </h5>
                                                                                <div className="flex flex-wrap gap-2">
                                                                                    {enhancedLabelInfo.keyConcepts.map((concept, idx) => (
                                                                                        <span key={idx} className="px-3 py-1 bg-white rounded-full text-xs font-medium text-slate-700 border border-cyan-200">
                                                                                            {concept}
                                                                                        </span>
                                                                                    ))}
                                                                                </div>
                                                                            </div>
                                                                        )}

                                                                        {/* Applications */}
                                                                        {enhancedLabelInfo?.applications && enhancedLabelInfo.applications.length > 0 && (
                                                                            <div className="bg-orange-50 rounded-lg p-4 border border-orange-100">
                                                                                <h5 className="text-sm font-bold text-orange-900 mb-3 flex items-center gap-2 uppercase tracking-wide">
                                                                                    <Globe className="w-4 h-4" />
                                                                                    Applications
                                                                                </h5>
                                                                                <ul className="space-y-2">
                                                                                    {enhancedLabelInfo.applications.map((app, idx) => (
                                                                                        <li key={idx} className="text-sm text-slate-700 leading-relaxed flex items-start gap-2">
                                                                                            <span className="text-orange-500 mt-1">•</span>
                                                                                            <span>{app}</span>
                                                                                        </li>
                                                                                    ))}
                                                                                </ul>
                                                                            </div>
                                                                        )}

                                                                        {/* Fun Fact */}
                                                                        <div className="bg-amber-50 rounded-lg p-4 border border-amber-100">
                                                                            <h5 className="text-sm font-bold text-amber-900 mb-3 flex items-center gap-2 uppercase tracking-wide">
                                                                                <Lightbulb className="w-4 h-4" />
                                                                                Fun Fact
                                                                            </h5>
                                                                            <p className="text-sm text-slate-700 leading-relaxed italic">
                                                                                {enhancedLabelInfo?.funFact || selectedImageLabel.funFact}
                                                                            </p>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Labels List (for Quiz Mode) */}
                                                {imageQuizMode && imageQuizType === 'find' && imageActivityLabels.length > 0 && (
                                                    <div className="bg-white border-2 border-slate-200 rounded-xl shadow-xl p-6">
                                                        <div className="flex items-center justify-between mb-5 pb-4 border-b border-slate-200">
                                                            <h4 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                                                                <Target className="w-5 h-5 text-blue-600" />
                                                                Labels to Find
                                                            </h4>
                                                            <div className="text-sm text-slate-500">
                                                                {imageQuizCorrect.length} / {imageActivityLabels.length} completed
                                                            </div>
                                                        </div>
                                                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                                            {imageActivityLabels.map((label) => {
                                                                const isCorrect = imageQuizCorrect.includes(label.term);
                                                                const isSelected = selectedImageLabel?.term === label.term;

                                                                return (
                                                                    <button
                                                                        key={label.term}
                                                                        onClick={() => {
                                                                            if (!isCorrect) {
                                                                                setSelectedImageLabel(label);
                                                                                setImageQuizWrong(null);
                                                                            }
                                                                        }}
                                                                        disabled={isCorrect}
                                                                        className={`px-4 py-3 rounded-lg text-sm font-medium transition-all ${isCorrect
                                                                            ? 'bg-green-100 text-green-700 cursor-not-allowed border-2 border-green-300 shadow-sm'
                                                                            : isSelected
                                                                                ? 'bg-blue-100 text-blue-700 border-2 border-blue-500 shadow-md transform scale-105'
                                                                                : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border-2 border-slate-200 hover:border-slate-300 hover:shadow-sm'
                                                                            }`}
                                                                    >
                                                                        {isCorrect ? (
                                                                            <span className="flex items-center justify-center gap-2">
                                                                                <CheckCircle2 className="w-5 h-5" />
                                                                                <span className="line-through opacity-75">{label.term}</span>
                                                                            </span>
                                                                        ) : (
                                                                            <span className={isSelected ? 'font-bold' : ''}>{label.term}</span>
                                                                        )}
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ) : isGeneratingImageActivity ? (
                                            <div className="flex flex-col items-center gap-6 text-center max-w-md">
                                                <div className="relative w-16 h-16">
                                                    <div className="absolute inset-0 bg-slate-300 opacity-40 blur-xl"></div>
                                                    <Loader2 className="w-16 h-16 animate-spin text-[#2c4066] relative" />
                                                </div>
                                                <div>
                                                    <p className="text-lg font-bold text-slate-700 mb-2">Generating Image</p>
                                                    <p className="text-sm text-slate-500 mb-4">AI is crafting your image using Gemini 3 Pro Image Preview (Nano Banana Pro)...</p>
                                                    <p className="text-xs text-slate-400">This usually takes 5-10 seconds</p>
                                                </div>
                                            </div>
                                        ) : imageActivityError ? (
                                            <div className="flex flex-col items-center gap-6 text-center max-w-xl">
                                                <div className="w-24 h-24 bg-red-100 flex items-center justify-center rounded-full">
                                                    <X className="w-12 h-12 text-red-600" />
                                                </div>
                                                <div>
                                                    <h3 className="text-2xl font-bold text-slate-700 mb-2">Generation Failed</h3>
                                                    <p className="text-red-600 mb-4">{imageActivityError}</p>
                                                    <button
                                                        onClick={handleGenerateImageActivity}
                                                        className="px-4 py-2 bg-[#2c4066] text-white hover:bg-[#34507c] transition-all font-medium text-sm rounded"
                                                    >
                                                        Try Again
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex flex-col items-center gap-6 text-center max-w-xl">
                                                <div className="w-24 h-24 bg-[#e4e9f2] flex items-center justify-center">
                                                    <ImageIcon className="w-12 h-12 text-[#2c4066]" />
                                                </div>
                                                <div>
                                                    <h3 className="text-2xl font-bold text-slate-700 mb-2">Ready to Generate</h3>
                                                    <p className="text-slate-500 mb-6">
                                                        Describe any concept, scene, or diagram, and AI will generate a high-quality educational illustration for you.
                                                    </p>
                                                    <div className="flex items-center justify-center gap-4 text-sm text-slate-500">
                                                        <div className="flex items-center gap-2">
                                                            <ImageIcon className="w-4 h-4" />
                                                            <span>Describe your image</span>
                                                        </div>
                                                        <div className="w-1 h-1 bg-slate-300"></div>
                                                        <div className="flex items-center gap-2">
                                                            <Sparkles className="w-4 h-4" />
                                                            <span>Generate</span>
                                                        </div>
                                                        <div className="w-1 h-1 bg-slate-300"></div>
                                                        <div className="flex items-center gap-2">
                                                            <Download className="w-4 h-4" />
                                                            <span>Download</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            /* 3D Explorer Tab */
                            <div className="flex flex-col h-full w-full bg-[#eef2f7] overflow-hidden" style={{ height: '100vh', width: '100vw' }}>
                                {/* Header */}
                                <div className="flex items-center justify-between px-3 py-2 bg-white/50 backdrop-blur-sm border-b border-slate-200 flex-shrink-0">
                                    <div className="flex items-center gap-2">
                                        {assignmentVisualActivityActive && (
                                            <button
                                                onClick={() => {
                                                    setSelectedAssignmentFeature(null);
                                                    setShowAssignmentDashboard(true);
                                                    setActiveMode('assignment');
                                                    setAssignmentVisualActivityActive(false);
                                                }}
                                                className="mr-2 flex items-center gap-2 rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"
                                            >
                                                <ChevronLeft className="w-4 h-4" />
                                                Back to Study Tools
                                            </button>
                                        )}
                                        <div className="w-8 h-8 bg-[#1F1F1F] flex items-center justify-center">
                                            <Viewer3DIcon active />
                                        </div>
                                        <div>
                                            <h2 className="text-[16px] font-medium text-slate-800">3D Object Viewer</h2>
                                            <p className="text-[12px] text-slate-600">Hand gesture controls for 3D models</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        {/* Voice Command Toggle */}
                                        <button
                                            onClick={() => setViewer3dVoiceActive(!viewer3dVoiceActive)}
                                            className={`p-1.5 transition-colors flex items-center gap-1 rounded-md ${viewer3dVoiceActive
                                                ? 'bg-[#2c4066] text-white shadow-md'
                                                : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 shadow-sm'
                                                }`}
                                            title={viewer3dVoiceActive ? 'Stop Voice Commands' : 'Start Voice Commands'}
                                        >
                                            <Mic className="w-3.5 h-3.5" />
                                            {viewer3dVoiceActive && <span className="text-[10px] font-medium">Listening...</span>}
                                        </button>
                                        {/* Interaction Mode Selector */}
                                        <div className="flex bg-white border border-slate-300 rounded-md p-0.5 shadow-sm">
                                            {(['drag', 'rotate', 'scale', 'animate'] as const).map(mode => (
                                                <button
                                                    key={mode}
                                                    onClick={() => setViewer3dInteractionMode(mode)}
                                                    className={`px-2 py-1 text-[11px] font-medium transition-colors rounded ${viewer3dInteractionMode === mode
                                                        ? 'bg-[#2c4066] text-white shadow-sm'
                                                        : 'bg-transparent text-slate-700 hover:bg-slate-100'
                                                        }`}
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
                                            className="px-2 py-1 text-[12px] text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 transition-colors flex items-center gap-1 rounded-md shadow-sm font-medium"
                                        >
                                            <RefreshCw className="w-3.5 h-3.5" />
                                            Reset
                                        </button>
                                    </div>
                                </div>

                                {/* Voice Command Transcript */}
                                {viewer3dVoiceActive && viewer3dVoiceTranscript && (
                                    <div className="px-4 py-2 bg-blue-50 border border-blue-200 text-[13px] text-slate-800 flex items-center gap-2 flex-shrink-0 rounded-md mx-3 mt-2 shadow-sm">
                                        <Mic className="w-4 h-4 text-blue-600" />
                                        <span className="font-medium">"{viewer3dVoiceTranscript}"</span>
                                    </div>
                                )}

                                {/* Main Content - Split View */}
                                <div className="flex-1 min-h-0 flex gap-2 overflow-hidden">
                                    {/* Left: 3D Viewer */}
                                    <div
                                        className={`flex-1 min-h-0 min-w-0 relative border-2 overflow-hidden bg-[#eef2f7] transition-colors ${viewer3dIsDraggingFile ? 'border-[#7c3aed] border-dashed' : 'border-slate-300'
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
                                                    <p className="text-slate-800 text-lg font-medium">Drop GLB/GLTF file here</p>
                                                </div>
                                            </div>
                                        )}

                                        {!viewer3dModelUrl ? (
                                            <div className="flex items-center justify-center h-full">
                                                <div className="text-center max-w-md px-6">
                                                    <div className="w-20 h-20 mx-auto mb-6 bg-[#1F1F1F] flex items-center justify-center">
                                                        <Box className="w-10 h-10 text-slate-300" />
                                                    </div>
                                                    <h3 className="text-[22px] font-medium text-slate-800 mb-3">Load a 3D Model</h3>
                                                    <p className="text-[15px] text-slate-600 mb-6">
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
                                                            className="px-6 py-3 bg-[#2c4066] hover:bg-[#34507c] text-white font-medium transition-colors flex items-center gap-2 mx-auto"
                                                        >
                                                            <Upload className="w-5 h-5" />
                                                            Upload 3D Model (GLB/GLTF)
                                                        </button>
                                                        {/* Quick Load Demo Shapes */}
                                                        <div className="space-y-3 mt-4">
                                                            <div>
                                                                <p className="text-[11px] font-semibold text-slate-500 uppercase mb-2">Basic Shapes</p>
                                                                <div className="flex flex-wrap gap-2 justify-center">
                                                                    {[
                                                                        { name: 'Cube', shape: 'cube', icon: '⬜' },
                                                                        { name: 'Sphere', shape: 'sphere', icon: '⚪' },
                                                                        { name: 'Torus', shape: 'torus', icon: '⭕' },
                                                                        { name: 'Pyramid', shape: 'pyramid', icon: '🔺' },
                                                                    ].map(shape => (
                                                                        <button
                                                                            key={shape.shape}
                                                                            onClick={() => {
                                                                                setViewer3dModelUrl(`demo:${shape.shape}`);
                                                                                setViewer3dModelName(shape.name);
                                                                            }}
                                                                            className="px-3 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-[12px] transition-colors rounded-md flex items-center gap-1.5"
                                                                        >
                                                                            <span>{shape.icon}</span>
                                                                            {shape.name}
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                            <div>
                                                                <p className="text-[11px] font-semibold text-slate-500 uppercase mb-2">Atomic Models</p>
                                                                <div className="flex flex-wrap gap-2 justify-center">
                                                                    {[
                                                                        { name: 'Hydrogen Atom', shape: 'atom-hydrogen', icon: '⚛️' },
                                                                        { name: 'Helium Atom', shape: 'atom-helium', icon: '⚛️' },
                                                                        { name: 'Carbon Atom', shape: 'atom-carbon', icon: '⚛️' },
                                                                        { name: 'Water (H₂O)', shape: 'molecule-water', icon: '💧' },
                                                                        { name: 'Methane (CH₄)', shape: 'molecule-methane', icon: '🔥' },
                                                                        { name: 'Benzene Ring', shape: 'molecule-benzene', icon: '⭕' },
                                                                        { name: 'Ammonia (NH₃)', shape: 'molecule-ammonia', icon: '☁️' },
                                                                        { name: 'DNA Helix', shape: 'molecule-dna', icon: '🧬' },
                                                                    ].map(shape => (
                                                                        <button
                                                                            key={shape.shape}
                                                                            onClick={() => {
                                                                                setViewer3dModelUrl(`demo:${shape.shape}`);
                                                                                setViewer3dModelName(shape.name);
                                                                            }}
                                                                            className="px-3 py-2 bg-gradient-to-br from-purple-50 to-blue-50 border border-purple-200 hover:from-purple-100 hover:to-blue-100 text-slate-700 text-[12px] transition-colors rounded-md flex items-center gap-1.5"
                                                                        >
                                                                            <span>{shape.icon}</span>
                                                                            {shape.name}
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                            <div>
                                                                <p className="text-[11px] font-semibold text-slate-500 uppercase mb-2">NIH 3D Models (Load from URL)</p>
                                                                <div className="flex flex-col gap-2">
                                                                    <input
                                                                        type="text"
                                                                        placeholder="Paste GLB/GLTF URL here and press Enter..."
                                                                        className="px-3 py-2 text-[12px] border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#2c4066] focus:border-transparent"
                                                                        onKeyDown={(e) => {
                                                                            if (e.key === 'Enter') {
                                                                                const url = (e.target as HTMLInputElement).value.trim();
                                                                                if (url && (url.endsWith('.glb') || url.endsWith('.gltf') || url.includes('glb') || url.includes('gltf'))) {
                                                                                    setViewer3dModelUrl(url);
                                                                                    setViewer3dModelName(url.split('/').pop() || 'External Model');
                                                                                    (e.target as HTMLInputElement).value = '';
                                                                                } else if (url) {
                                                                                    alert('Please enter a valid GLB or GLTF file URL');
                                                                                }
                                                                            }
                                                                        }}
                                                                    />
                                                                    <div className="text-[10px] text-slate-500 text-center px-2">
                                                                        <p className="mb-1">💡 How to get GLB files from NIH 3D:</p>
                                                                        <ol className="list-decimal list-inside text-left space-y-0.5">
                                                                            <li>Visit <a href="https://3d.nih.gov/discover" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">3d.nih.gov/discover</a></li>
                                                                            <li>Click on any model (especially biomacromolecules or small molecules)</li>
                                                                            <li>Click "Download" → Select "glb" format</li>
                                                                            <li>Copy the download URL and paste it above</li>
                                                                        </ol>
                                                                        <p className="mt-2 text-[9px]">Popular models: Proteins, DNA structures, Small molecules, Viruses</p>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <p className="text-[12px] text-slate-500 mt-2">
                                                            Or drag and drop a .glb or .gltf file anywhere on this viewer
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="relative w-full h-full">
                                                {/* Check if it's a GLB/GLTF file (not a demo shape) */}
                                                {viewer3dModelUrl && !viewer3dModelUrl.startsWith('demo:') ? (
                                                    /* Three.js Canvas for GLB/GLTF files */
                                                    <div className="relative w-full h-full">
                                                        {viewer3dModelLoading && (
                                                            <div className="absolute inset-0 flex items-center justify-center bg-white/50 z-10">
                                                                <div className="flex flex-col items-center gap-3">
                                                                    <Loader2 className="w-8 h-8 text-[#2c4066] animate-spin" />
                                                                    <p className="text-slate-700 text-sm font-medium">Loading 3D model...</p>
                                                                </div>
                                                            </div>
                                                        )}
                                                        <canvas
                                                            ref={viewer3dThreeCanvasRef}
                                                            className="w-full h-full"
                                                            style={{
                                                                cursor: viewer3dIsGrabbing ? 'grabbing' : 'grab',
                                                            }}
                                                        />
                                                    </div>
                                                ) : (
                                                    /* CSS3D Demo Shapes */
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
                                                                // Improved Sphere with better lighting
                                                                <div
                                                                    style={{
                                                                        width: '200px',
                                                                        height: '200px',
                                                                        borderRadius: '50%',
                                                                        background: 'radial-gradient(circle at 25% 25%, #ffffff, #a78bfa 30%, #7c3aed 60%, #4c1d95 100%)',
                                                                        boxShadow: 'inset -30px -30px 60px rgba(0,0,0,0.4), inset 20px 20px 40px rgba(255,255,255,0.2), 0 0 60px rgba(124, 58, 237, 0.4)',
                                                                        border: '2px solid rgba(255,255,255,0.1)',
                                                                    }}
                                                                />
                                                            ) : viewer3dModelUrl?.startsWith('demo:torus') ? (
                                                                // Improved Torus with better 3D effect
                                                                <div style={{ transformStyle: 'preserve-3d', width: '200px', height: '200px', position: 'relative' }}>
                                                                    <div
                                                                        style={{
                                                                            width: '200px',
                                                                            height: '200px',
                                                                            borderRadius: '50%',
                                                                            border: '35px solid',
                                                                            borderImage: 'linear-gradient(135deg, #ec4899, #f472b6, #ec4899) 1',
                                                                            boxShadow: 'inset 0 0 40px rgba(236, 72, 153, 0.6), 0 0 40px rgba(236, 72, 153, 0.4), 10px 10px 30px rgba(0,0,0,0.4)',
                                                                            background: 'radial-gradient(circle at center, rgba(236, 72, 153, 0.3), transparent)',
                                                                            borderColor: '#ec4899',
                                                                        }}
                                                                    />
                                                                </div>
                                                            ) : viewer3dModelUrl?.startsWith('demo:pyramid') ? (
                                                                // Improved Pyramid with better 3D structure
                                                                <div style={{ transformStyle: 'preserve-3d', width: '200px', height: '200px', position: 'relative' }}>
                                                                    {/* Base */}
                                                                    <div style={{
                                                                        position: 'absolute',
                                                                        width: '160px',
                                                                        height: '160px',
                                                                        background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.9), rgba(37, 99, 235, 0.9))',
                                                                        transform: 'translateX(20px) translateY(120px) rotateX(90deg)',
                                                                        boxShadow: '0 0 20px rgba(59, 130, 246, 0.5)',
                                                                        border: '2px solid rgba(255,255,255,0.2)',
                                                                    }} />
                                                                    {/* Front face */}
                                                                    <div style={{
                                                                        position: 'absolute',
                                                                        width: 0,
                                                                        height: 0,
                                                                        borderLeft: '80px solid transparent',
                                                                        borderRight: '80px solid transparent',
                                                                        borderBottom: '140px solid rgba(124, 58, 237, 0.9)',
                                                                        transform: 'translateX(20px) translateY(-20px)',
                                                                        filter: 'drop-shadow(0 10px 20px rgba(0,0,0,0.3))',
                                                                    }} />
                                                                    {/* Left face */}
                                                                    <div style={{
                                                                        position: 'absolute',
                                                                        width: 0,
                                                                        height: 0,
                                                                        borderLeft: '80px solid transparent',
                                                                        borderRight: '80px solid transparent',
                                                                        borderBottom: '140px solid rgba(124, 58, 237, 0.7)',
                                                                        transform: 'translateX(20px) translateY(-20px) rotateY(-45deg) translateZ(80px)',
                                                                    }} />
                                                                    {/* Right face */}
                                                                    <div style={{
                                                                        position: 'absolute',
                                                                        width: 0,
                                                                        height: 0,
                                                                        borderLeft: '80px solid transparent',
                                                                        borderRight: '80px solid transparent',
                                                                        borderBottom: '140px solid rgba(124, 58, 237, 0.7)',
                                                                        transform: 'translateX(20px) translateY(-20px) rotateY(45deg) translateZ(80px)',
                                                                    }} />
                                                                </div>
                                                            ) : viewer3dModelUrl?.startsWith('demo:atom-hydrogen') ? (
                                                                // Hydrogen Atom - 1 electron orbiting
                                                                <div style={{ transformStyle: 'preserve-3d', width: '200px', height: '200px', position: 'relative' }}>
                                                                    {/* Nucleus */}
                                                                    <div style={{
                                                                        position: 'absolute',
                                                                        width: '40px',
                                                                        height: '40px',
                                                                        borderRadius: '50%',
                                                                        background: 'radial-gradient(circle at 30% 30%, #ffffff, #ef4444)',
                                                                        left: '50%',
                                                                        top: '50%',
                                                                        transform: 'translate(-50%, -50%)',
                                                                        boxShadow: '0 0 30px rgba(239, 68, 68, 0.8), inset -5px -5px 10px rgba(0,0,0,0.3)',
                                                                        zIndex: 10,
                                                                    }} />
                                                                    {/* Electron orbit path */}
                                                                    <div style={{
                                                                        position: 'absolute',
                                                                        width: '160px',
                                                                        height: '160px',
                                                                        borderRadius: '50%',
                                                                        border: '2px dashed rgba(59, 130, 246, 0.3)',
                                                                        left: '50%',
                                                                        top: '50%',
                                                                        transform: 'translate(-50%, -50%)',
                                                                    }} />
                                                                    {/* Electron */}
                                                                    <div style={{
                                                                        position: 'absolute',
                                                                        width: '16px',
                                                                        height: '16px',
                                                                        borderRadius: '50%',
                                                                        background: 'radial-gradient(circle at 30% 30%, #ffffff, #3b82f6)',
                                                                        left: '50%',
                                                                        top: '50%',
                                                                        transform: `translate(-50%, -50%) translateX(80px) rotateZ(${viewer3dRotation.y * 2}deg)`,
                                                                        boxShadow: '0 0 15px rgba(59, 130, 246, 0.8)',
                                                                        animation: 'spin 3s linear infinite',
                                                                    }} />
                                                                </div>
                                                            ) : viewer3dModelUrl?.startsWith('demo:atom-helium') ? (
                                                                // Helium Atom - 2 electrons
                                                                <div style={{ transformStyle: 'preserve-3d', width: '200px', height: '200px', position: 'relative' }}>
                                                                    {/* Nucleus */}
                                                                    <div style={{
                                                                        position: 'absolute',
                                                                        width: '50px',
                                                                        height: '50px',
                                                                        borderRadius: '50%',
                                                                        background: 'radial-gradient(circle at 30% 30%, #ffffff, #f59e0b)',
                                                                        left: '50%',
                                                                        top: '50%',
                                                                        transform: 'translate(-50%, -50%)',
                                                                        boxShadow: '0 0 30px rgba(245, 158, 11, 0.8)',
                                                                        zIndex: 10,
                                                                    }} />
                                                                    {/* Electron 1 */}
                                                                    <div style={{
                                                                        position: 'absolute',
                                                                        width: '16px',
                                                                        height: '16px',
                                                                        borderRadius: '50%',
                                                                        background: 'radial-gradient(circle at 30% 30%, #ffffff, #3b82f6)',
                                                                        left: '50%',
                                                                        top: '50%',
                                                                        transform: `translate(-50%, -50%) translateX(70px) rotateZ(${viewer3dRotation.y * 2}deg)`,
                                                                        boxShadow: '0 0 15px rgba(59, 130, 246, 0.8)',
                                                                    }} />
                                                                    {/* Electron 2 */}
                                                                    <div style={{
                                                                        position: 'absolute',
                                                                        width: '16px',
                                                                        height: '16px',
                                                                        borderRadius: '50%',
                                                                        background: 'radial-gradient(circle at 30% 30%, #ffffff, #3b82f6)',
                                                                        left: '50%',
                                                                        top: '50%',
                                                                        transform: `translate(-50%, -50%) translateX(-70px) rotateZ(${viewer3dRotation.y * 2 + 180}deg)`,
                                                                        boxShadow: '0 0 15px rgba(59, 130, 246, 0.8)',
                                                                    }} />
                                                                </div>
                                                            ) : viewer3dModelUrl?.startsWith('demo:atom-carbon') ? (
                                                                // Carbon Atom - 6 electrons in 2 shells
                                                                <div style={{ transformStyle: 'preserve-3d', width: '200px', height: '200px', position: 'relative' }}>
                                                                    {/* Nucleus */}
                                                                    <div style={{
                                                                        position: 'absolute',
                                                                        width: '60px',
                                                                        height: '60px',
                                                                        borderRadius: '50%',
                                                                        background: 'radial-gradient(circle at 30% 30%, #ffffff, #10b981)',
                                                                        left: '50%',
                                                                        top: '50%',
                                                                        transform: 'translate(-50%, -50%)',
                                                                        boxShadow: '0 0 40px rgba(16, 185, 129, 0.8)',
                                                                        zIndex: 10,
                                                                    }} />
                                                                    {/* Inner shell - 2 electrons */}
                                                                    {[0, 180].map((angle, i) => (
                                                                        <div key={i} style={{
                                                                            position: 'absolute',
                                                                            width: '14px',
                                                                            height: '14px',
                                                                            borderRadius: '50%',
                                                                            background: 'radial-gradient(circle at 30% 30%, #ffffff, #3b82f6)',
                                                                            left: '50%',
                                                                            top: '50%',
                                                                            transform: `translate(-50%, -50%) translateX(50px) rotateZ(${viewer3dRotation.y * 2 + angle}deg)`,
                                                                            boxShadow: '0 0 12px rgba(59, 130, 246, 0.8)',
                                                                        }} />
                                                                    ))}
                                                                    {/* Outer shell - 4 electrons */}
                                                                    {[0, 90, 180, 270].map((angle, i) => (
                                                                        <div key={i} style={{
                                                                            position: 'absolute',
                                                                            width: '14px',
                                                                            height: '14px',
                                                                            borderRadius: '50%',
                                                                            background: 'radial-gradient(circle at 30% 30%, #ffffff, #8b5cf6)',
                                                                            left: '50%',
                                                                            top: '50%',
                                                                            transform: `translate(-50%, -50%) translateX(80px) rotateZ(${viewer3dRotation.y * 1.5 + angle}deg)`,
                                                                            boxShadow: '0 0 12px rgba(139, 92, 246, 0.8)',
                                                                        }} />
                                                                    ))}
                                                                </div>
                                                            ) : viewer3dModelUrl?.startsWith('demo:molecule-water') ? (
                                                                // Water Molecule H₂O - bent structure
                                                                <div style={{ transformStyle: 'preserve-3d', width: '200px', height: '200px', position: 'relative' }}>
                                                                    {/* Oxygen atom */}
                                                                    <div style={{
                                                                        position: 'absolute',
                                                                        width: '50px',
                                                                        height: '50px',
                                                                        borderRadius: '50%',
                                                                        background: 'radial-gradient(circle at 30% 30%, #ffffff, #ef4444)',
                                                                        left: '50%',
                                                                        top: '50%',
                                                                        transform: 'translate(-50%, -50%)',
                                                                        boxShadow: '0 0 25px rgba(239, 68, 68, 0.8)',
                                                                        zIndex: 10,
                                                                    }} />
                                                                    {/* Hydrogen 1 */}
                                                                    <div style={{
                                                                        position: 'absolute',
                                                                        width: '30px',
                                                                        height: '30px',
                                                                        borderRadius: '50%',
                                                                        background: 'radial-gradient(circle at 30% 30%, #ffffff, #3b82f6)',
                                                                        left: '50%',
                                                                        top: '50%',
                                                                        transform: 'translate(-50%, -50%) translateX(-60px) translateY(-30px)',
                                                                        boxShadow: '0 0 15px rgba(59, 130, 246, 0.8)',
                                                                    }} />
                                                                    {/* Hydrogen 2 */}
                                                                    <div style={{
                                                                        position: 'absolute',
                                                                        width: '30px',
                                                                        height: '30px',
                                                                        borderRadius: '50%',
                                                                        background: 'radial-gradient(circle at 30% 30%, #ffffff, #3b82f6)',
                                                                        left: '50%',
                                                                        top: '50%',
                                                                        transform: 'translate(-50%, -50%) translateX(60px) translateY(-30px)',
                                                                        boxShadow: '0 0 15px rgba(59, 130, 246, 0.8)',
                                                                    }} />
                                                                    {/* Bonds */}
                                                                    <svg style={{ position: 'absolute', width: '200px', height: '200px', top: 0, left: 0, pointerEvents: 'none' }}>
                                                                        <line x1="100" y1="100" x2="40" y2="70" stroke="rgba(255,255,255,0.6)" strokeWidth="3" />
                                                                        <line x1="100" y1="100" x2="160" y2="70" stroke="rgba(255,255,255,0.6)" strokeWidth="3" />
                                                                    </svg>
                                                                </div>
                                                            ) : viewer3dModelUrl?.startsWith('demo:molecule-methane') ? (
                                                                // Methane CH₄ - tetrahedral
                                                                <div style={{ transformStyle: 'preserve-3d', width: '200px', height: '200px', position: 'relative' }}>
                                                                    {/* Carbon atom */}
                                                                    <div style={{
                                                                        position: 'absolute',
                                                                        width: '50px',
                                                                        height: '50px',
                                                                        borderRadius: '50%',
                                                                        background: 'radial-gradient(circle at 30% 30%, #ffffff, #10b981)',
                                                                        left: '50%',
                                                                        top: '50%',
                                                                        transform: 'translate(-50%, -50%)',
                                                                        boxShadow: '0 0 25px rgba(16, 185, 129, 0.8)',
                                                                        zIndex: 10,
                                                                    }} />
                                                                    {/* 4 Hydrogen atoms in tetrahedral arrangement */}
                                                                    {[
                                                                        { x: 0, y: -70, z: 0 },
                                                                        { x: 60, y: 40, z: -40 },
                                                                        { x: -60, y: 40, z: -40 },
                                                                        { x: 0, y: 40, z: 60 },
                                                                    ].map((pos, i) => (
                                                                        <div key={i} style={{
                                                                            position: 'absolute',
                                                                            width: '30px',
                                                                            height: '30px',
                                                                            borderRadius: '50%',
                                                                            background: 'radial-gradient(circle at 30% 30%, #ffffff, #3b82f6)',
                                                                            left: '50%',
                                                                            top: '50%',
                                                                            transform: `translate(-50%, -50%) translateX(${pos.x}px) translateY(${pos.y}px) translateZ(${pos.z}px)`,
                                                                            boxShadow: '0 0 15px rgba(59, 130, 246, 0.8)',
                                                                        }} />
                                                                    ))}
                                                                </div>
                                                            ) : viewer3dModelUrl?.startsWith('demo:molecule-benzene') ? (
                                                                // Benzene Ring C₆H₆
                                                                <div style={{ transformStyle: 'preserve-3d', width: '200px', height: '200px', position: 'relative' }}>
                                                                    {/* 6 Carbon atoms in ring */}
                                                                    {[0, 60, 120, 180, 240, 300].map((angle, i) => {
                                                                        const rad = angle * Math.PI / 180;
                                                                        const x = Math.cos(rad) * 60;
                                                                        const y = Math.sin(rad) * 60;
                                                                        return (
                                                                            <div key={i} style={{
                                                                                position: 'absolute',
                                                                                width: '35px',
                                                                                height: '35px',
                                                                                borderRadius: '50%',
                                                                                background: 'radial-gradient(circle at 30% 30%, #ffffff, #10b981)',
                                                                                left: '50%',
                                                                                top: '50%',
                                                                                transform: `translate(-50%, -50%) translateX(${x}px) translateY(${y}px)`,
                                                                                boxShadow: '0 0 20px rgba(16, 185, 129, 0.8)',
                                                                            }} />
                                                                        );
                                                                    })}
                                                                    {/* Ring bond visualization */}
                                                                    <svg style={{ position: 'absolute', width: '200px', height: '200px', top: 0, left: 0, pointerEvents: 'none' }}>
                                                                        {[0, 60, 120, 180, 240, 300].map((angle, i) => {
                                                                            const nextAngle = (angle + 60) % 360;
                                                                            const rad1 = angle * Math.PI / 180;
                                                                            const rad2 = nextAngle * Math.PI / 180;
                                                                            const x1 = 100 + Math.cos(rad1) * 60;
                                                                            const y1 = 100 + Math.sin(rad1) * 60;
                                                                            const x2 = 100 + Math.cos(rad2) * 60;
                                                                            const y2 = 100 + Math.sin(rad2) * 60;
                                                                            return (
                                                                                <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(255,255,255,0.5)" strokeWidth="2" />
                                                                            );
                                                                        })}
                                                                    </svg>
                                                                </div>
                                                            ) : viewer3dModelUrl?.startsWith('demo:molecule-ammonia') ? (
                                                                // Ammonia NH₃ - pyramidal
                                                                <div style={{ transformStyle: 'preserve-3d', width: '200px', height: '200px', position: 'relative' }}>
                                                                    {/* Nitrogen atom */}
                                                                    <div style={{
                                                                        position: 'absolute',
                                                                        width: '50px',
                                                                        height: '50px',
                                                                        borderRadius: '50%',
                                                                        background: 'radial-gradient(circle at 30% 30%, #ffffff, #8b5cf6)',
                                                                        left: '50%',
                                                                        top: '50%',
                                                                        transform: 'translate(-50%, -50%) translateY(-20px)',
                                                                        boxShadow: '0 0 25px rgba(139, 92, 246, 0.8)',
                                                                        zIndex: 10,
                                                                    }} />
                                                                    {/* 3 Hydrogen atoms */}
                                                                    {[0, 120, 240].map((angle, i) => {
                                                                        const rad = angle * Math.PI / 180;
                                                                        const x = Math.cos(rad) * 50;
                                                                        const y = Math.sin(rad) * 50 + 30;
                                                                        return (
                                                                            <div key={i} style={{
                                                                                position: 'absolute',
                                                                                width: '30px',
                                                                                height: '30px',
                                                                                borderRadius: '50%',
                                                                                background: 'radial-gradient(circle at 30% 30%, #ffffff, #3b82f6)',
                                                                                left: '50%',
                                                                                top: '50%',
                                                                                transform: `translate(-50%, -50%) translateX(${x}px) translateY(${y}px)`,
                                                                                boxShadow: '0 0 15px rgba(59, 130, 246, 0.8)',
                                                                            }} />
                                                                        );
                                                                    })}
                                                                    {/* Bonds */}
                                                                    <svg style={{ position: 'absolute', width: '200px', height: '200px', top: 0, left: 0, pointerEvents: 'none' }}>
                                                                        {[0, 120, 240].map((angle, i) => {
                                                                            const rad = angle * Math.PI / 180;
                                                                            const x = Math.cos(rad) * 50;
                                                                            const y = Math.sin(rad) * 50 + 30;
                                                                            return (
                                                                                <line key={i} x1="100" y1="80" x2={100 + x} y2={100 + y} stroke="rgba(255,255,255,0.6)" strokeWidth="3" />
                                                                            );
                                                                        })}
                                                                    </svg>
                                                                </div>
                                                            ) : viewer3dModelUrl?.startsWith('demo:molecule-dna') ? (
                                                                // DNA Double Helix (simplified)
                                                                <div style={{ transformStyle: 'preserve-3d', width: '200px', height: '200px', position: 'relative' }}>
                                                                    {/* Helix strands */}
                                                                    {[0, 180].map((phase, strand) => (
                                                                        <div key={strand} style={{
                                                                            position: 'absolute',
                                                                            width: '4px',
                                                                            height: '200px',
                                                                            background: strand === 0 ? 'linear-gradient(to bottom, #3b82f6, #8b5cf6, #3b82f6)' : 'linear-gradient(to bottom, #10b981, #059669, #10b981)',
                                                                            left: strand === 0 ? '40%' : '60%',
                                                                            top: '0%',
                                                                            transform: `rotateZ(${viewer3dRotation.y * 0.5 + phase}deg)`,
                                                                            borderRadius: '2px',
                                                                            boxShadow: '0 0 10px rgba(59, 130, 246, 0.6)',
                                                                        }} />
                                                                    ))}
                                                                    {/* Base pairs */}
                                                                    {[0, 40, 80, 120, 160].map((y, i) => (
                                                                        <div key={i} style={{
                                                                            position: 'absolute',
                                                                            width: '60px',
                                                                            height: '2px',
                                                                            background: 'rgba(255, 255, 255, 0.4)',
                                                                            left: '50%',
                                                                            top: `${y}px`,
                                                                            transform: 'translateX(-50%)',
                                                                            boxShadow: '0 0 5px rgba(255, 255, 255, 0.3)',
                                                                        }} />
                                                                    ))}
                                                                </div>
                                                            ) : (
                                                                // Improved Cube with better colors and lighting
                                                                <>
                                                                    {/* Cube Faces with improved gradients */}
                                                                    {[
                                                                        { transform: 'translateZ(100px)', bg: 'linear-gradient(135deg, rgba(59, 130, 246, 0.95), rgba(37, 99, 235, 0.95))', label: 'Front', border: 'rgba(255,255,255,0.3)' },
                                                                        { transform: 'translateZ(-100px) rotateY(180deg)', bg: 'linear-gradient(135deg, rgba(124, 58, 237, 0.7), rgba(109, 40, 217, 0.7))', label: 'Back', border: 'rgba(255,255,255,0.2)' },
                                                                        { transform: 'translateX(100px) rotateY(90deg)', bg: 'linear-gradient(135deg, rgba(236, 72, 153, 0.9), rgba(219, 39, 119, 0.9))', label: 'Right', border: 'rgba(255,255,255,0.25)' },
                                                                        { transform: 'translateX(-100px) rotateY(-90deg)', bg: 'linear-gradient(135deg, rgba(236, 72, 153, 0.7), rgba(219, 39, 119, 0.7))', label: 'Left', border: 'rgba(255,255,255,0.2)' },
                                                                        { transform: 'translateY(-100px) rotateX(90deg)', bg: 'linear-gradient(135deg, rgba(59, 130, 246, 0.9), rgba(37, 99, 235, 0.9))', label: 'Top', border: 'rgba(255,255,255,0.3)' },
                                                                        { transform: 'translateY(100px) rotateX(-90deg)', bg: 'linear-gradient(135deg, rgba(59, 130, 246, 0.6), rgba(37, 99, 235, 0.6))', label: 'Bottom', border: 'rgba(255,255,255,0.2)' },
                                                                    ].map((face, idx) => (
                                                                        <div
                                                                            key={idx}
                                                                            className="absolute flex items-center justify-center text-white font-bold text-lg"
                                                                            style={{
                                                                                width: '200px',
                                                                                height: '200px',
                                                                                transform: face.transform,
                                                                                background: face.bg,
                                                                                border: `2px solid ${face.border}`,
                                                                                backfaceVisibility: 'visible',
                                                                                boxShadow: idx === 0 ? 'inset 0 0 30px rgba(255,255,255,0.2), 0 0 20px rgba(59, 130, 246, 0.4)' : 'inset 0 0 20px rgba(0,0,0,0.2)',
                                                                            }}
                                                                        >
                                                                            {face.label}
                                                                        </div>
                                                                    ))}
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Mode indicator */}
                                                <div
                                                    className="absolute top-4 right-16 px-3 py-1.5 text-white text-[12px] font-medium flex items-center gap-2 rounded-lg shadow-lg"
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
                                                    <div className="absolute top-14 right-16 px-3 py-1.5 bg-black/50 text-white text-[12px]">
                                                        Animation: {viewer3dAnimationIndex + 1}/6
                                                    </div>
                                                )}

                                                {/* Model Name Badge */}
                                                <div className="absolute top-4 left-4 px-3 py-1.5 bg-black/50 text-white text-[13px] flex items-center gap-2">
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
                                                    className="absolute top-4 right-4 p-2 bg-black/50 hover:bg-black/70 text-white transition-colors"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>

                                                {/* Transform Info */}
                                                <div className="absolute bottom-4 left-4 px-3 py-2 bg-black/50 text-white text-[11px] font-mono">
                                                    <div>Rotation: X:{Math.round(viewer3dRotation.x)}° Y:{Math.round(viewer3dRotation.y)}° Z:{Math.round(viewer3dRotation.z)}°</div>
                                                    <div>Position: X:{Math.round(viewer3dPosition.x)} Y:{Math.round(viewer3dPosition.y)}</div>
                                                    <div>Scale: {viewer3dScale.toFixed(2)}x</div>
                                                    {viewer3dIsGrabbing && <div className="text-[#00ff88]">● Grabbing</div>}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Right: Hand Tracking Panel */}
                                    <div className="w-96 flex-shrink-0 h-full flex flex-col gap-3 bg-[#1F1F1F] p-4 overflow-y-auto">
                                        {/* Webcam View */}
                                        <div className="relative border border-slate-700 overflow-hidden bg-black flex-shrink-0" style={{ height: '300px', minHeight: '300px' }}>
                                            {!viewer3dWebcamActive ? (
                                                <div className="flex items-center justify-center h-full bg-[#1F1F1F]">
                                                    <div className="text-center px-4">
                                                        <div className="w-16 h-16 mx-auto mb-4 bg-white/5 border border-white/10 flex items-center justify-center">
                                                            <Hand className="w-8 h-8 text-slate-300" />
                                                        </div>
                                                        <p className="text-[14px] text-slate-200 mb-4 font-medium">Enable hand tracking for gesture controls</p>
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
                                                            className="px-5 py-2.5 bg-[#2c4066] hover:bg-[#34507c] text-white text-sm font-semibold transition-all flex items-center gap-2 mx-auto shadow-md hover:shadow-lg"
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
                                                        className="absolute top-2 right-2 p-2 bg-red-500 hover:bg-red-600 text-white transition-colors shadow-lg"
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                </>
                                            )}
                                        </div>

                                        {/* Gesture Guide */}
                                        <div className="p-3 bg-black border border-slate-700">
                                            <h3 className="text-xs font-semibold text-slate-200 mb-3 uppercase tracking-wide">Gesture Controls</h3>
                                            <div className="space-y-1.5">
                                                <div
                                                    className={`p-2 border-2 transition-all cursor-pointer ${viewer3dInteractionMode === 'drag'
                                                        ? 'border-cyan-400 bg-cyan-500/10 shadow-md shadow-cyan-500/20'
                                                        : 'border-slate-600 bg-white/5 hover:bg-white/10 hover:border-slate-500'}`}
                                                    onClick={() => setViewer3dInteractionMode('drag')}
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <div className={`w-7 h-7 flex items-center justify-center transition-all ${viewer3dInteractionMode === 'drag' ? 'bg-cyan-400 scale-110' : 'bg-slate-700'}`}>
                                                            <Move className={`w-3.5 h-3.5 ${viewer3dInteractionMode === 'drag' ? 'text-black' : 'text-slate-300'}`} />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <span className={`text-xs font-semibold block ${viewer3dInteractionMode === 'drag' ? 'text-cyan-300' : 'text-slate-200'}`}>Drag</span>
                                                            <span className="text-[10px] text-slate-400">Pinch + move</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div
                                                    className={`p-2 border-2 transition-all cursor-pointer ${viewer3dInteractionMode === 'rotate'
                                                        ? 'border-purple-400 bg-purple-500/10 shadow-md shadow-purple-500/20'
                                                        : 'border-slate-600 bg-white/5 hover:bg-white/10 hover:border-slate-500'}`}
                                                    onClick={() => setViewer3dInteractionMode('rotate')}
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <div className={`w-7 h-7 flex items-center justify-center transition-all ${viewer3dInteractionMode === 'rotate' ? 'bg-purple-400 scale-110' : 'bg-slate-700'}`}>
                                                            <RefreshCw className={`w-3.5 h-3.5 ${viewer3dInteractionMode === 'rotate' ? 'text-white' : 'text-slate-300'}`} />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <span className={`text-xs font-semibold block ${viewer3dInteractionMode === 'rotate' ? 'text-purple-300' : 'text-slate-200'}`}>Rotate</span>
                                                            <span className="text-[10px] text-slate-400">Pinch + slide L/R</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div
                                                    className={`p-2 border-2 transition-all cursor-pointer ${viewer3dInteractionMode === 'scale'
                                                        ? 'border-yellow-400 bg-yellow-500/10 shadow-md shadow-yellow-500/20'
                                                        : 'border-slate-600 bg-white/5 hover:bg-white/10 hover:border-slate-500'}`}
                                                    onClick={() => setViewer3dInteractionMode('scale')}
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <div className={`w-7 h-7 flex items-center justify-center transition-all ${viewer3dInteractionMode === 'scale' ? 'bg-yellow-400 scale-110' : 'bg-slate-700'}`}>
                                                            <Maximize2 className={`w-3.5 h-3.5 ${viewer3dInteractionMode === 'scale' ? 'text-black' : 'text-slate-300'}`} />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <span className={`text-xs font-semibold block ${viewer3dInteractionMode === 'scale' ? 'text-yellow-300' : 'text-slate-200'}`}>Scale</span>
                                                            <span className="text-[10px] text-slate-400">2 hands pinch</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div
                                                    className={`p-2 border-2 transition-all cursor-pointer ${viewer3dInteractionMode === 'animate'
                                                        ? 'border-orange-400 bg-orange-500/10 shadow-md shadow-orange-500/20'
                                                        : 'border-slate-600 bg-white/5 hover:bg-white/10 hover:border-slate-500'}`}
                                                    onClick={() => setViewer3dInteractionMode('animate')}
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <div className={`w-7 h-7 flex items-center justify-center transition-all ${viewer3dInteractionMode === 'animate' ? 'bg-orange-400 scale-110' : 'bg-slate-700'}`}>
                                                            <Film className={`w-3.5 h-3.5 ${viewer3dInteractionMode === 'animate' ? 'text-white' : 'text-slate-300'}`} />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <span className={`text-xs font-semibold block ${viewer3dInteractionMode === 'animate' ? 'text-orange-300' : 'text-slate-200'}`}>Animate</span>
                                                            <span className="text-[10px] text-slate-400">Pinch + U/D</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Voice Commands Info */}
                                            <div className="mt-3 pt-3 border-t border-slate-700">
                                                <div className="flex items-center gap-2 px-2 py-1.5 bg-white/5 border border-white/10">
                                                    <Mic className="w-3.5 h-3.5 text-slate-400" />
                                                    <span className="text-[10px] text-slate-400">Say "drag", "rotate", "scale", "animate", or "reset"</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Status */}
                                        <div className="p-3 bg-black border border-slate-700">
                                            <h3 className="text-xs font-semibold text-slate-200 mb-2 uppercase tracking-wide">Status</h3>
                                            <div className="space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-sm text-slate-300">Hand Tracking</span>
                                                    <div className="flex items-center gap-2">
                                                        <div className={`w-2 h-2 ${viewer3dWebcamActive ? 'bg-green-500' : 'bg-slate-500'} ${viewer3dWebcamActive ? 'animate-pulse' : ''}`}></div>
                                                        <span className={`text-sm font-semibold ${viewer3dWebcamActive ? 'text-green-400' : 'text-slate-400'}`}>
                                                            {viewer3dWebcamActive ? 'Active' : 'Inactive'}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-sm text-slate-300">Hands Detected</span>
                                                    <span className="text-sm font-semibold text-slate-200 bg-white/5 px-2 py-1 border border-white/10">
                                                        {viewer3dHandLandmarks.length}
                                                    </span>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-sm text-slate-300">Pinching</span>
                                                    <div className="flex gap-2">
                                                        <span className={`px-3 py-1 text-xs font-semibold transition-all ${viewer3dIsPinching[0]
                                                            ? 'bg-green-500/20 text-green-400 border border-green-500/50 shadow-md shadow-green-500/20'
                                                            : 'bg-white/5 text-slate-400 border border-slate-600'
                                                            }`}>L</span>
                                                        <span className={`px-3 py-1 text-xs font-semibold transition-all ${viewer3dIsPinching[1]
                                                            ? 'bg-green-500/20 text-green-400 border border-green-500/50 shadow-md shadow-green-500/20'
                                                            : 'bg-white/5 text-slate-400 border border-slate-600'
                                                            }`}>R</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                );

            case 'code-lab':
                return (
                    <CodeLabView
                        codeLabFiles={codeLabFiles}
                        setCodeLabFiles={setCodeLabFiles}
                        codeLabActiveFileId={codeLabActiveFileId}
                        setCodeLabActiveFileId={setCodeLabActiveFileId}
                        codeLabCode={codeLabCode}
                        setCodeLabCode={setCodeLabCode}
                        codeLabLanguage={codeLabLanguage}
                        setCodeLabLanguage={setCodeLabLanguage}
                        codeLabTheme={codeLabTheme}
                        setCodeLabTheme={setCodeLabTheme}
                        codeLabOutput={codeLabOutput}
                        setCodeLabOutput={setCodeLabOutput}
                        codeLabIsRunning={codeLabIsRunning}
                        setCodeLabIsRunning={setCodeLabIsRunning}
                        codeLabAiPrompt={codeLabAiPrompt}
                        setCodeLabAiPrompt={setCodeLabAiPrompt}
                        codeLabAiResponse={codeLabAiResponse}
                        setCodeLabAiResponse={setCodeLabAiResponse}
                        codeLabAiLoading={codeLabAiLoading}
                        codeLabAiStreaming={codeLabAiStreaming}
                        codeLabAiReasoning={codeLabAiReasoning}
                        codeLabAiError={codeLabAiError}
                        handleAskCodeLabAi={handleAskCodeLabAi}
                        handleInsertAiCode={handleInsertAiCode}
                        loadPyodide={loadPyodide}
                        codeLabExtensions={codeLabExtensions}
                        codeLabBasicSetup={codeLabBasicSetup}
                    />
                );

            case 'replicube-lab':
                return <ReplicubeLab />;

            case 'latex-assignment':
            case 'assignment':
                return renderAssignmentWorkspace();

            case 'notebook': {
                const initialText = (documentTextRef.current || standaloneNotes || '').trim();
                const initialTitle =
                    (uploadedFileName && uploadedFileName.trim()) ||
                    (immersiveContent?.title && immersiveContent.title.trim()) ||
                    (standaloneNotesName && standaloneNotesName.trim()) ||
                    'Notebook Draft';

                return (
                    <div className="flex h-full w-full min-h-0">
                        <HyperbookNotebook
                            className="flex-1 min-h-0"
                            initialSource={initialText ? { title: initialTitle, text: initialText } : null}
                        />
                    </div>
                );
            }

            case 'socratic': {
                const topic = standaloneTopic || (immersiveContent?.title) || 'General Topic';
                return (
                    <div className="flex h-full w-full min-h-0 bg-white dark:bg-slate-900">
                        <SocraticLearningMode
                            topic={topic}
                            onBack={() => setActiveMode('source')}
                            onSwitchToFeynman={(t) => {
                                setStandaloneTopic(t);
                                setActiveMode('feynman-enhanced');
                            }}
                        />
                    </div>
                );
            }

            case 'feynman-enhanced': {
                const topic = standaloneTopic || (immersiveContent?.title) || 'General Topic';
                return (
                    <div className="flex h-full w-full min-h-0 bg-white dark:bg-slate-900">
                        <FeynmanLearningMode
                            topic={topic}
                            onBack={() => setActiveMode('source')}
                            onSwitchToSocratic={(t) => {
                                setStandaloneTopic(t);
                                setActiveMode('socratic');
                            }}
                        />
                    </div>
                );
            }

            case 'learning-theories':
                const handleAnalyzeLearningTheory = async () => {
                    // Use topic input first, fall back to uploaded document
                    const textToAnalyze = learningTheoryTopicInput.trim() || documentTextRef.current;
                    if (!textToAnalyze) {
                        setLearningTheoryError('Please enter a topic or paste content to analyze.');
                        return;
                    }

                    setIsAnalyzingLearningTheory(true);
                    setLearningTheoryError(null);

                    try {
                        const result = await selectLearningTheory(textToAnalyze);
                        setLearningTheoriesResult(result);
                        setSelectedLearningTheory(result.selectedTheory);

                        // If Feynman is selected, prepare the Live config
                        if (result.selectedTheory === 'feynman') {
                            const concepts = result.tree
                                .find(n => n.theory === 'feynman')?.implementation?.features || [];
                            const config = getFeynmanLiveConfig(
                                result.contentSummary,
                                concepts,
                                'curious-student'
                            );
                            setFeynmanLiveConfig(config);
                        }
                    } catch (error) {
                        setLearningTheoryError(error instanceof Error ? error.message : 'Failed to analyze');
                    } finally {
                        setIsAnalyzingLearningTheory(false);
                    }
                };

                const theoryColors: Record<LearningTheoryType, string> = {
                    'feynman': 'bg-purple-600',
                    'active-learning': 'bg-blue-600',
                    'visual-learning': 'bg-green-600',
                    'spaced-repetition': 'bg-orange-600',
                    'elaborative': 'bg-red-600',
                    'scaffolded': 'bg-teal-600',
                    'universal-design': 'bg-pink-600'
                };

                return (
                    <div className="flex flex-col w-full bg-[#0f172a]" style={{ height: 'calc(100vh - 50px)', marginTop: '50px' }}>
                        {/* Header */}
                        <div className="px-6 py-4 bg-white dark:bg-[#1e293b] border-b border-slate-200 dark:border-slate-800">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-400">
                                    <LearningTheoriesIcon active />
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Learning Theories</h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        AI selects the optimal learning approach for your content
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-6">
                            <div className="max-w-4xl mx-auto">
                                {/* Analysis Button */}
                                {!learningTheoriesResult && (
                                    <div className="text-center py-12">
                                        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
                                            <span className="text-4xl">🎓</span>
                                        </div>
                                        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-3">
                                            Discover Your Optimal Learning Path
                                        </h2>
                                        <p className="text-slate-500 dark:text-slate-400 mb-6 max-w-md mx-auto">
                                            Enter a topic or paste content, and our AI will recommend the best learning approach.
                                        </p>

                                        {/* Standalone Topic Input */}
                                        <div className="max-w-lg mx-auto mb-6">
                                            <textarea
                                                value={learningTheoryTopicInput}
                                                onChange={(e) => setLearningTheoryTopicInput(e.target.value)}
                                                placeholder="Enter a topic (e.g., 'Quantum Mechanics', 'Photosynthesis') or paste content to analyze..."
                                                className="w-full h-32 p-4 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                                            />
                                            <p className="text-xs text-slate-400 mt-2 text-left">
                                                💡 You can enter a simple topic name or paste detailed content for more accurate analysis
                                            </p>
                                        </div>

                                        {learningTheoryError && (
                                            <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg text-sm max-w-lg mx-auto">
                                                {learningTheoryError}
                                            </div>
                                        )}

                                        <button
                                            onClick={handleAnalyzeLearningTheory}
                                            disabled={isAnalyzingLearningTheory || (!learningTheoryTopicInput.trim() && !documentTextRef.current)}
                                            className="px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-medium rounded-xl hover:from-purple-700 hover:to-indigo-700 transition-all shadow-lg disabled:opacity-50 flex items-center gap-2 mx-auto"
                                        >
                                            {isAnalyzingLearningTheory ? (
                                                <>
                                                    <Loader2 className="w-5 h-5 animate-spin" />
                                                    Analyzing with Tree of Thoughts...
                                                </>
                                            ) : (
                                                <>
                                                    <Sparkles className="w-5 h-5" />
                                                    Find My Optimal Learning Path
                                                </>
                                            )}
                                        </button>
                                    </div>
                                )}

                                {/* Results Display */}
                                {learningTheoriesResult && (
                                    <div className="space-y-6">
                                        {/* Selected Theory Banner */}
                                        <div className={`p-6 rounded-2xl ${theoryColors[learningTheoriesResult.selectedTheory]} text-white`}>
                                            <div className="flex items-center gap-4">
                                                <span className="text-4xl">
                                                    {getLearningTheoryDisplayInfo(learningTheoriesResult.selectedTheory).icon}
                                                </span>
                                                <div className="flex-1">
                                                    <div className="text-xs uppercase tracking-wide opacity-80 mb-1">
                                                        Recommended Approach
                                                    </div>
                                                    <h3 className="text-2xl font-bold">
                                                        {getLearningTheoryDisplayInfo(learningTheoriesResult.selectedTheory).name}
                                                    </h3>
                                                    <p className="text-sm opacity-90 mt-1">
                                                        {learningTheoriesResult.reasoning}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* General Start Learning Button */}
                                            <button
                                                onClick={async () => {
                                                    // Generate content in-place based on selected theory
                                                    const topic = learningTheoryTopicInput.trim() || learningTheoriesResult.contentSummary;
                                                    const theoryInfo = getLearningTheoryDisplayInfo(learningTheoriesResult.selectedTheory);

                                                    setIsGeneratingTheoryContent(true);
                                                    setLearningTheoryPhase('learning');
                                                    setLearningTheoryContent('');

                                                    try {
                                                        // Build a learning-theory-specific prompt
                                                        const theoryPrompts: Record<LearningTheoryType, string> = {
                                                            'feynman': `You are a curious 10-year-old student. The user will teach you about "${topic}". Ask simple questions, show confusion when concepts are complex, and help them realize gaps in their understanding. Start by saying "Can you teach me about this? I don't know anything about it!"`,
                                                            'active-learning': `Create an interactive learning experience about "${topic}". Include hands-on exercises, practice problems, and immediate feedback opportunities. Format as a step-by-step workshop with [EXERCISE] blocks.`,
                                                            'visual-learning': `Create a highly visual explanation of "${topic}". Use ASCII diagrams, flowcharts, and visual metaphors. Describe images that would help understanding. Use plenty of formatting and bullet points.`,
                                                            'spaced-repetition': `Create a spaced repetition study guide for "${topic}". Include:\n1. Key concepts with mnemonics\n2. Flashcard-style Q&A pairs\n3. Review schedule suggestions\n4. Self-test questions`,
                                                            'elaborative': `Create an elaborative interrogation learning session about "${topic}". For each concept, include:\n- WHY is this true?\n- HOW does this work?\n- WHAT IF scenarios\n- Connection questions to prior knowledge`,
                                                            'scaffolded': `Create a scaffolded learning experience for "${topic}".\n\n**Level 1 - Foundation:**\nBasic concepts with simple examples\n\n**Level 2 - Building:**\nIntermediate concepts with guided practice\n\n**Level 3 - Mastery:**\nAdvanced concepts with independent challenges\n\nInclude hints and checkpoints at each level.`,
                                                            'universal-design': `Create an inclusive learning guide for "${topic}" following Universal Design for Learning (UDL) principles. Provide multiple means of representation (visual, text, analogies), multiple means of engagement (relevance, mastery), and multiple means of expression (options for how to demonstrate learning).`
                                                        };

                                                        const prompt = theoryPrompts[learningTheoriesResult.selectedTheory];

                                                        // Stream the content
                                                        await generateStreamingContent(
                                                            prompt,
                                                            (chunk) => {
                                                                setLearningTheoryContent(prev => prev + chunk);
                                                            },
                                                            (fullContent) => {
                                                                setLearningTheoryContent(fullContent);
                                                                setIsGeneratingTheoryContent(false);
                                                            },
                                                            (error) => {
                                                                setLearningTheoryError(error.message);
                                                                setIsGeneratingTheoryContent(false);
                                                            }
                                                        );
                                                    } catch (error) {
                                                        setLearningTheoryError(error instanceof Error ? error.message : 'Failed to generate content');
                                                        setIsGeneratingTheoryContent(false);
                                                    }
                                                }}
                                                disabled={isGeneratingTheoryContent}
                                                className="mt-4 w-full py-3 bg-white/20 hover:bg-white/30 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 border border-white/30 disabled:opacity-50"
                                            >
                                                {isGeneratingTheoryContent ? (
                                                    <>
                                                        <Loader2 className="w-5 h-5 animate-spin" />
                                                        Generating Learning Experience...
                                                    </>
                                                ) : (
                                                    <>
                                                        <Sparkles className="w-5 h-5" />
                                                        Start Learning with {getLearningTheoryDisplayInfo(learningTheoriesResult.selectedTheory).name}
                                                    </>
                                                )}
                                            </button>
                                        </div>

                                        {/* Content Info */}
                                        <div className="grid grid-cols-3 gap-4">
                                            <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                                                <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Content Type</div>
                                                <div className="font-semibold text-slate-800 dark:text-slate-100 capitalize">
                                                    {learningTheoriesResult.contentType}
                                                </div>
                                            </div>
                                            <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                                                <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Complexity</div>
                                                <div className="font-semibold text-slate-800 dark:text-slate-100 capitalize">
                                                    {learningTheoriesResult.complexityLevel}
                                                </div>
                                            </div>
                                            <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                                                <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Approaches Analyzed</div>
                                                <div className="font-semibold text-slate-800 dark:text-slate-100">
                                                    {learningTheoriesResult.tree.length}
                                                </div>
                                            </div>
                                        </div>

                                        {/* ToT Tree Visualization Header */}
                                        <div className="bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-green-900/20 rounded-xl p-4 border border-emerald-200 dark:border-emerald-800">
                                            <div className="flex items-center gap-3 mb-3">
                                                <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center">
                                                    <span className="text-xl">🌳</span>
                                                </div>
                                                <div>
                                                    <h4 className="font-semibold text-emerald-800 dark:text-emerald-200">
                                                        Tree of Thoughts Analysis
                                                    </h4>
                                                    <p className="text-xs text-emerald-600 dark:text-emerald-400">
                                                        AI evaluated {learningTheoriesResult.tree.length} learning approaches
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Tree Diagram */}
                                            <div className="relative">
                                                {/* Root Node */}
                                                <div className="flex justify-center mb-4">
                                                    <div className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium shadow-lg">
                                                        📊 Content Analysis: "{learningTheoriesResult.contentSummary.slice(0, 50)}..."
                                                    </div>
                                                </div>

                                                {/* Connector Lines */}
                                                <div className="flex justify-center mb-2">
                                                    <div className="w-0.5 h-6 bg-emerald-400"></div>
                                                </div>
                                                <div className="flex justify-center mb-4">
                                                    <div className="h-0.5 w-3/4 bg-emerald-400"></div>
                                                </div>

                                                {/* Theory Nodes */}
                                                <div className="grid grid-cols-3 gap-3">
                                                    {learningTheoriesResult.tree
                                                        .sort((a, b) => b.score - a.score)
                                                        .map((node, idx) => {
                                                            const info = getLearningTheoryDisplayInfo(node.theory);
                                                            const isSelected = node.theory === learningTheoriesResult.selectedTheory;
                                                            const scoreColor = node.score >= 8 ? 'bg-green-500' : node.score >= 6 ? 'bg-amber-500' : 'bg-slate-400';

                                                            return (
                                                                <div key={node.id} className="relative">
                                                                    {/* Connector to node */}
                                                                    <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-4 w-0.5 h-4 bg-emerald-400"></div>

                                                                    <div className={`p-4 rounded-xl border-2 transition-all ${isSelected
                                                                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30 shadow-lg shadow-emerald-200 dark:shadow-emerald-900/20'
                                                                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'
                                                                        }`}>
                                                                        {/* Rank Badge */}
                                                                        <div className="absolute -top-2 -right-2">
                                                                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full text-white ${idx === 0 ? 'bg-yellow-500' : idx === 1 ? 'bg-slate-400' : idx === 2 ? 'bg-amber-700' : 'bg-slate-300'
                                                                                }`}>
                                                                                #{idx + 1}
                                                                            </span>
                                                                        </div>

                                                                        {/* Header */}
                                                                        <div className="flex items-center gap-2 mb-3">
                                                                            <span className="text-2xl">{info.icon}</span>
                                                                            <div className="flex-1">
                                                                                <div className="font-semibold text-slate-800 dark:text-slate-100 text-sm">
                                                                                    {info.name}
                                                                                </div>
                                                                                <div className="flex items-center gap-2 mt-1">
                                                                                    <div className={`h-2 flex-1 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden`}>
                                                                                        <div
                                                                                            className={`h-full ${scoreColor} transition-all`}
                                                                                            style={{ width: `${node.score * 10}%` }}
                                                                                        />
                                                                                    </div>
                                                                                    <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                                                                                        {node.score.toFixed(1)}
                                                                                    </span>
                                                                                </div>
                                                                            </div>
                                                                            {isSelected && (
                                                                                <span className="text-xs bg-emerald-600 text-white px-2 py-0.5 rounded-full">
                                                                                    ✓ Best
                                                                                </span>
                                                                            )}
                                                                        </div>

                                                                        {/* Rationale */}
                                                                        <p className="text-xs text-slate-600 dark:text-slate-400 mb-3 line-clamp-2">
                                                                            {node.rationale}
                                                                        </p>

                                                                        {/* Pros/Cons */}
                                                                        <div className="space-y-2">
                                                                            {node.pros && node.pros.length > 0 && (
                                                                                <div className="flex items-start gap-1">
                                                                                    <span className="text-green-500 text-xs">✓</span>
                                                                                    <span className="text-xs text-green-700 dark:text-green-400">
                                                                                        {node.pros[0]}
                                                                                    </span>
                                                                                </div>
                                                                            )}
                                                                            {node.cons && node.cons.length > 0 && (
                                                                                <div className="flex items-start gap-1">
                                                                                    <span className="text-red-500 text-xs">✗</span>
                                                                                    <span className="text-xs text-red-700 dark:text-red-400">
                                                                                        {node.cons[0]}
                                                                                    </span>
                                                                                </div>
                                                                            )}
                                                                        </div>

                                                                        {/* Implementation */}
                                                                        {node.implementation && (
                                                                            <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-700">
                                                                                <span className="text-[10px] uppercase tracking-wide text-slate-400">
                                                                                    Uses: {node.implementation.primaryTool}
                                                                                </span>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Generated Learning Content */}
                                        {(learningTheoryContent || isGeneratingTheoryContent) && (
                                            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                                                <div className="px-4 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white flex items-center gap-3">
                                                    <span className="text-xl">{getLearningTheoryDisplayInfo(learningTheoriesResult.selectedTheory).icon}</span>
                                                    <div>
                                                        <h4 className="font-semibold">
                                                            {getLearningTheoryDisplayInfo(learningTheoriesResult.selectedTheory).name} Experience
                                                        </h4>
                                                        <p className="text-xs opacity-80">
                                                            {isGeneratingTheoryContent ? 'Generating...' : 'Learning content ready'}
                                                        </p>
                                                    </div>
                                                    {isGeneratingTheoryContent && (
                                                        <Loader2 className="w-5 h-5 animate-spin ml-auto" />
                                                    )}
                                                </div>
                                                <div className="p-6 max-h-[60vh] overflow-y-auto">
                                                    <div className="prose prose-slate dark:prose-invert max-w-none">
                                                        {learningTheoryContent.split('\n').map((line, idx) => (
                                                            <p key={idx} className="mb-2 text-sm text-slate-700 dark:text-slate-300">
                                                                {line || '\u00A0'}
                                                            </p>
                                                        ))}
                                                        {isGeneratingTheoryContent && (
                                                            <span className="inline-block w-2 h-4 bg-purple-500 animate-pulse" />
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Reset Button */}
                                        <button
                                            onClick={() => {
                                                setLearningTheoriesResult(null);
                                                setSelectedLearningTheory(null);
                                                setFeynmanLiveConfig(null);
                                            }}
                                            className="text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 flex items-center gap-1"
                                        >
                                            <RefreshCw className="w-4 h-4" />
                                            Analyze Again
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                );

            default:
                return null;
        }
    };

    const handleContextMenu = (e: React.MouseEvent) => {
        // Prevent if clicking on specific interactive elements
        const target = e.target as HTMLElement;
        if (target.closest('button, input, textarea, a, .react-flow__pane')) {
            return;
        }

        e.preventDefault();
        window.dispatchEvent(new CustomEvent('canvas-context-menu', {
            detail: { x: e.clientX, y: e.clientY }
        }));
    };

    return (
        <div onContextMenu={handleContextMenu} ref={containerRef} className="fixed inset-0 z-50 bg-[#0b0d12] text-slate-100 flex flex-col w-screen h-screen overflow-hidden" style={{ fontFamily: '"Google Sans", Roboto, Arial, sans-serif' }}>
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
            <header className="h-[50px] px-5 flex items-center justify-between border-b" style={{ backgroundColor: '#1F1F1F', borderColor: 'rgba(6, 182, 212, 0.2)' }}>
                {/* Left: Logo & Workspaces */}
                <div className="flex items-center gap-4">
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

            {/* Navigation Tabs - Enhanced with Magic UI styling */}
            <nav className="px-8 py-4 flex items-center justify-center gap-2 border-b relative overflow-x-auto" style={{ backgroundColor: '#1F1F1F', borderColor: 'rgba(6, 182, 212, 0.2)' }}>
                <div className="flex items-center gap-2">

                    {allLearningModes.map((mode) => {
                        const isActive = activeMode === mode.id;
                        return (
                            <button
                                key={mode.id}
                                onClick={() => setActiveMode(mode.id)}
                                className={`
                                    group relative flex flex-col items-center gap-1.5 px-5 py-2.5 transition-all duration-300 overflow-hidden rounded-[24px]
                                    ${isActive
                                        ? 'scale-105'
                                        : 'hover:scale-105'
                                    }
                                `}
                                style={{
                                    backgroundColor: isActive ? mode.activeBg : 'rgba(255, 255, 255, 0.05)',
                                }}
                            >
                                {/* Active state glow effect - stronger */}
                                {isActive && (
                                    <>
                                        <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/40 via-purple-500/40 to-cyan-500/40 blur-xl opacity-70" />
                                        <div className="absolute inset-0 border-2 rounded-[24px] border-cyan-400 shadow-xl shadow-cyan-500/40" />
                                        <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent rounded-[24px]" />
                                    </>
                                )}

                                {/* Hover glow effect - more visible */}
                                {!isActive && (
                                    <>
                                        <div className="absolute inset-0 bg-gradient-to-r from-slate-600/0 via-slate-600/40 to-slate-600/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-[24px]" />
                                        <div className="absolute inset-0 border border-slate-600/30 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-[24px]" />
                                    </>
                                )}

                                {/* Content */}
                                <div className="relative z-10 flex flex-col items-center gap-1.5">
                                    <div className={`w-6 h-6 flex items-center justify-center transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`}>
                                        {mode.icon}
                                    </div>
                                    <span
                                        className={`text-[13px] font-semibold whitespace-nowrap transition-colors duration-300 ${isActive
                                            ? 'drop-shadow-lg'
                                            : 'text-slate-400 group-hover:text-slate-200'
                                            }`}
                                        style={isActive ? { color: mode.activeColor } : {}}
                                    >
                                        {mode.label}
                                    </span>
                                </div>

                                {/* Active indicator bar - more prominent */}
                                {isActive && (
                                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-1 bg-gradient-to-r from-cyan-400 via-purple-400 to-cyan-400 rounded-full shadow-lg shadow-cyan-400/50" />
                                )}
                            </button>
                        );
                    })}
                </div>
            </nav>

            {/* Main Content Area - 3 Column Layout */}
            <div className="flex flex-1 min-h-0 overflow-hidden">
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
                                                console.log('Section clicked:', section.id, section.title);
                                                setActiveSectionId(section.id);
                                                setCurrentSectionIndex(idx);
                                                // Scroll to section in main content
                                                const sectionEl = document.getElementById(`section-${section.id}`);
                                                if (sectionEl) {
                                                    sectionEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                                }
                                            }}
                                            className={`
                                                w-full flex items-center gap-3 pl-6 pr-4 py-3 text-left transition-all duration-150 cursor-pointer
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
                    : activeMode === 'mindmap' || activeMode === 'notebook' || activeMode === 'assignment' || activeMode === 'latex-assignment' || activeMode === 'code-lab' || activeMode === 'replicube-lab' || activeMode === 'robotics' || activeMode === 'visual-activity' || activeMode === 'audio-video' || activeMode === 'simulation'
                        ? 'bg-[#eef2f7] overflow-hidden p-0'
                        : 'bg-[#0b0d12] overflow-y-auto p-0'
                    }`}>
                    <div className={`${activeMode === 'source'
                        ? 'h-full'
                        : activeMode === 'mindmap' || activeMode === 'notebook' || activeMode === 'assignment' || activeMode === 'latex-assignment' || activeMode === 'code-lab' || activeMode === 'replicube-lab' || activeMode === 'robotics' || activeMode === 'visual-activity' || activeMode === 'audio-video' || activeMode === 'simulation'
                            ? 'h-full rounded-none shadow-none'
                            : 'min-h-full rounded-none shadow-none bg-[#0f1117]'
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
                className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999]"
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



