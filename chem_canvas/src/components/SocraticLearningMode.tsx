/**
 * Socratic Learning Mode Component
 * 
 * Implements guided discovery through questioning with a hint ladder (L0-L4).
 * Full-page split-panel layout matching Feynman Mode style:
 * - Left panel: Socratic Dialogue chat with confidence slider
 * - Right panel: Concept Network & Misconception Mapper
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    MessageCircle,
    Send,
    Lightbulb,
    AlertTriangle,
    CheckCircle2,
    XCircle,
    RefreshCcw,
    ArrowLeft,
    Sparkles,
    Menu,
    PenTool,
    Mic,
    MicOff,
    RotateCcw,
    User,
    Palette,
    Check,
    X,
    Edit3,
    Loader2,
    HelpCircle,
    Target,
    Pencil,
    Volume2,
    GraduationCap,
    BrainCircuit
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Node, Edge } from 'reactflow';
import {
    TutorResponse,
    TutorChatMessage,
    TutorSessionState,
    HintLevel,
    HINT_LEVEL_LABELS,
    HINT_LEVEL_DESCRIPTIONS,
    Flashcard,
    QuizQuestion
} from '../types/tutorTypes';
import {
    generateSocraticResponse,
    startSocraticSession,
    createSessionState,
    updateSessionState,
    checkAutoModeSwitch,
    analyzeDrawingForSocratic,
    generateInteractiveContent,
    extractDiagramsFromPdf,
    DiagramExtractionResult,
    recommendActivityPlanFromPdf,
    ActivityPlanStep
} from '../services/socraticFeynmanTutorService';
import { generateGeminiImage } from '../services/geminiService';
import { ExcalidrawCanvas, ExcalidrawCanvasRef } from './ExcalidrawCanvas/ExcalidrawCanvas';
import { useGeminiLive } from './GeminiLive/hooks/useGeminiLive';
import { getSharedGeminiApiKey } from '../firebase/apiKeys';
import { ConceptNetworkGraph, ConceptNodeData, generateConceptNetwork } from './ConceptNetworkGraph';
import { FlashcardDeck } from './ChemistryFlashcardDeck';
import { QuizPanel } from './QuizPanel';
import { FillBlankActivity } from './FillBlankActivity';
import { MatchingActivity } from './MatchingActivity';

interface SocraticLearningModeProps {
    topic: string;
    onBack: () => void;
    onSwitchToFeynman?: (topic: string) => void;
    remainingTopics?: string[];
    onTopicChange?: (newTopic: string) => void;
    documentData?: { mimeType: string; data: string }; // Base64 PDF data for diagram extraction
}

type GuidedTaskType = 'quiz' | 'fill_blank' | 'matching' | 'flashcards' | 'challenge';

interface GuidedTask {
    id: string;
    type: GuidedTaskType;
    label: string;
    diagram?: DiagramExtractionResult['diagrams'][number];
}

interface GuidedTaskResult {
    taskId: string;
    label: string;
    success: boolean;
}

interface GuidedReport {
    misconceptions: string[];
    correctPoints: string[];
    successRate: number;
    totalTasks: number;
}

const CANVAS_ACTIVITY_COPY = {
    misconceptions: 'Fix each misconception by rewriting the correct idea in your own words.',
    strengths: 'Extend each strong point with a concrete example or application.'
};

export const SocraticLearningMode: React.FC<SocraticLearningModeProps> = ({
    topic,
    onBack,
    onSwitchToFeynman,
    remainingTopics = [],
    onTopicChange,
    documentData
}) => {
    // State
    const [messages, setMessages] = useState<TutorChatMessage[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [sessionState, setSessionState] = useState<TutorSessionState>(() =>
        createSessionState(topic, 'socratic')
    );
    const [streamingContent, setStreamingContent] = useState('');
    const [lastEvaluation, setLastEvaluation] = useState<TutorResponse['evaluation'] | null>(null);
    const [showEvaluation, setShowEvaluation] = useState(false);
    const [modeSwitchSuggestion, setModeSwitchSuggestion] = useState<string | null>(null);
    const [isCanvasOpen, setIsCanvasOpen] = useState(false);
    const [voiceChatApiKey, setVoiceChatApiKey] = useState<string>('');

    // Topic editing state
    const [currentTopic, setCurrentTopic] = useState(topic);
    const [isEditingTopic, setIsEditingTopic] = useState(false);
    const [editTopicValue, setEditTopicValue] = useState(topic);

    // New state for the redesigned UI
    const [confidence, setConfidence] = useState(50);
    const [conceptNodes, setConceptNodes] = useState<Node<ConceptNodeData>[]>([]);
    const [conceptEdges, setConceptEdges] = useState<Edge[]>([]);

    // Interactive Mode State
    const [activeTab, setActiveTab] = useState<'graph' | 'flashcards' | 'quiz'>('graph');
    const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
    const [quiz, setQuiz] = useState<QuizQuestion | null>(null);
    const [isGeneratingContent, setIsGeneratingContent] = useState(false);

    // Diagram extraction state for PDF documents
    const [diagramAnalysis, setDiagramAnalysis] = useState<DiagramExtractionResult | null>(null);
    const [isExtractingDiagrams, setIsExtractingDiagrams] = useState(false);
    const [isGeneratingDiagram, setIsGeneratingDiagram] = useState(false);

    // Guided activity flow state
    const [isGuidedFlowActive, setIsGuidedFlowActive] = useState(false);
    const [guidedTasks, setGuidedTasks] = useState<GuidedTask[]>([]);
    const [guidedTaskIndex, setGuidedTaskIndex] = useState<number>(-1);
    const [guidedResults, setGuidedResults] = useState<GuidedTaskResult[]>([]);
    const [guidedReport, setGuidedReport] = useState<GuidedReport | null>(null);
    const [showGuidedReport, setShowGuidedReport] = useState(false);
    const [isGuidedFlowGenerating, setIsGuidedFlowGenerating] = useState(false);

    // Refs
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const excalidrawRef = useRef<ExcalidrawCanvasRef>(null);
    const messagesRef = useRef<TutorChatMessage[]>([]);
    const guidedTasksRef = useRef<GuidedTask[]>([]);
    const guidedResultsRef = useRef<GuidedTaskResult[]>([]);
    const lastGuidedImageIndexRef = useRef<number>(-999);
    const lastAnalyzedDocumentKeyRef = useRef<string | null>(null);
    const flashcardAutoAdvanceRef = useRef<Set<string>>(new Set());

    useEffect(() => {
        messagesRef.current = messages;
    }, [messages]);

    useEffect(() => {
        guidedTasksRef.current = guidedTasks;
    }, [guidedTasks]);

    useEffect(() => {
        guidedResultsRef.current = guidedResults;
    }, [guidedResults]);

    const normalizeGuidedLabel = useCallback((text: string) => {
        const trimmed = text.trim();
        if (trimmed.length <= 80) return trimmed;
        const sentenceEnd = trimmed.indexOf('.');
        if (sentenceEnd > 20 && sentenceEnd < 80) {
            return trimmed.slice(0, sentenceEnd + 1);
        }
        return `${trimmed.slice(0, 77)}...`;
    }, []);

    const buildDiagramExplainer = useCallback((task: GuidedTask) => {
        const description = task.diagram?.description?.trim() || '';
        const snippet = description.length > 160 ? `${description.slice(0, 157)}...` : description;
        const focus = task.label ? `Concept focus: ${task.label}.` : 'Concept focus:';
        return [focus, snippet].filter(Boolean).join(' ');
    }, []);

    const buildRemediationElements = useCallback((report: GuidedReport): DiagramElement[] => {
        const elements: DiagramElement[] = [];
        const startX = 80;
        const cardWidth = 640;
        const headerHeight = 70;
        const responseHeight = 110;
        const gap = 28;
        let y = 60;

        elements.push({
            type: 'text',
            x: startX,
            y,
            text: `Remediation Activity: ${currentTopic}`
        });
        y += 50;

        const focusItems = report.misconceptions.length > 0
            ? report.misconceptions.slice(0, 3).map(text => ({ label: 'Misconception', text }))
            : report.correctPoints.slice(0, 3).map(text => ({ label: 'Strong point', text }));

        if (focusItems.length === 0) {
            focusItems.push({ label: 'Key idea', text: currentTopic });
        }

        focusItems.forEach((item) => {
            elements.push({
                type: 'rectangle',
                x: startX,
                y,
                width: cardWidth,
                height: headerHeight,
                backgroundColor: '#F8FAFC',
                strokeColor: '#94A3B8'
            });
            elements.push({
                type: 'text',
                x: startX + 16,
                y: y + 20,
                text: `${item.label}: ${item.text}`
            });
            y += headerHeight + 12;

            elements.push({
                type: 'rectangle',
                x: startX,
                y,
                width: cardWidth,
                height: responseHeight,
                backgroundColor: '#FFFFFF',
                strokeColor: '#CBD5F5'
            });
            elements.push({
                type: 'text',
                x: startX + 16,
                y: y + 20,
                text: 'Your correction / application'
            });
            y += responseHeight + gap;
        });

        return elements;
    }, [currentTopic]);

    const launchRemediationCanvas = useCallback((report: GuidedReport) => {
        setIsCanvasOpen(true);

        const scheduleDraw = (attempt: number) => {
            if (!excalidrawRef.current) {
                if (attempt < 6) {
                    window.setTimeout(() => scheduleDraw(attempt + 1), 200);
                }
                return;
            }

            excalidrawRef.current.clearCanvas();
            excalidrawRef.current.setActiveTool('text');
            excalidrawRef.current.setStrokeColor('#0f172a');

            const elements = buildRemediationElements(report);
            void excalidrawRef.current.drawDiagram(elements);

            const helperText = report.misconceptions.length > 0
                ? CANVAS_ACTIVITY_COPY.misconceptions
                : CANVAS_ACTIVITY_COPY.strengths;
            void excalidrawRef.current.addHandwrittenText(helperText);
        };

        window.setTimeout(() => scheduleDraw(0), 200);
    }, [buildRemediationElements]);

    const shouldIncludeGuidedImage = useCallback((index: number) => {
        const minGap = 2;
        const lastIndex = lastGuidedImageIndexRef.current;
        const stepsSince = index - lastIndex;
        const hasNoImagesYet = lastIndex < 0;

        if (stepsSince < minGap) {
            return false;
        }

        const baseChance = hasNoImagesYet ? 0.6 : 0.4;
        const bonusChance = Math.min(0.2, Math.max(0, stepsSince - minGap) * 0.1);
        const chance = baseChance + bonusChance;
        return Math.random() < chance;
    }, []);

    const buildGuidedTasks = useCallback((
        diagrams: DiagramExtractionResult['diagrams'],
        planSteps?: ActivityPlanStep[] | null
    ) => {
        const runId = Date.now();
        const fallbackSequence: ActivityPlanStep[] = [
            { type: 'quiz', focus: currentTopic, useDiagram: true },
            { type: 'fill_blank', focus: currentTopic, useDiagram: true },
            { type: 'matching', focus: currentTopic, useDiagram: false },
            { type: 'flashcards', focus: currentTopic, useDiagram: false },
            { type: 'challenge', focus: currentTopic, useDiagram: true }
        ];
        const sequence = planSteps && planSteps.length === 5 ? planSteps : fallbackSequence;
        let diagramCursor = 0;

        return sequence.map((step, index) => {
            const diagram = step.useDiagram && diagrams.length > 0
                ? diagrams[diagramCursor++ % diagrams.length]
                : undefined;
            const labelSource = step.focus || diagram?.description || currentTopic;
            return {
                id: `guided-${runId}-${index}`,
                type: step.type as GuidedTaskType,
                label: normalizeGuidedLabel(labelSource),
                diagram
            };
        });
    }, [currentTopic, normalizeGuidedLabel]);

    const getGuidedIntro = useCallback((task: GuidedTask, index: number, hasImage: boolean) => {
        const stepLabel = `Activity ${index + 1} of 5`;
        const leadIn = hasImage ? 'Using the diagram above, ' : '';
        switch (task.type) {
            case 'quiz':
                return `${stepLabel}: ${leadIn}answer this quick check.`;
            case 'fill_blank':
                return `${stepLabel}: ${leadIn}fill in the blank with the key idea.`;
            case 'matching':
                return `${stepLabel}: ${leadIn}match the terms to their meanings.`;
            case 'flashcards':
                return `${stepLabel}: Rapid flashcards to lock in key terms.`;
            case 'challenge':
                return `${stepLabel}: Challenge round. Try a tougher question to finish strong.`;
            default:
                return `${stepLabel}: Activity time.`;
        }
    }, []);

    const buildFallbackActivity = useCallback((task: GuidedTask) => {
        const fallbackId = `${task.id}-fallback`;
        const label = task.label || currentTopic;
        const shortLabel = label.split(' ')[0] || label;

        switch (task.type) {
            case 'flashcards':
                return {
                    flashcards: [
                        { id: `${fallbackId}-1`, front: label, back: 'Explain the key idea in your own words.' },
                        { id: `${fallbackId}-2`, front: `${shortLabel} detail`, back: 'State one important detail shown in the diagram.' },
                        { id: `${fallbackId}-3`, front: 'Why it matters', back: `Why is ${shortLabel} important in this concept?` },
                        { id: `${fallbackId}-4`, front: 'Common confusion', back: `What is often confused about ${shortLabel}?` },
                        { id: `${fallbackId}-5`, front: 'Apply it', back: `Give one real-world application of ${shortLabel}.` }
                    ]
                };
            case 'fill_blank':
                return {
                    fill_blank: {
                        id: fallbackId,
                        sentence: 'The diagram highlights _____ as the key idea.',
                        blanks: [shortLabel],
                        hint: `Look for the main concept: ${shortLabel}.`
                    }
                };
            case 'matching':
                return {
                    matching: {
                        id: fallbackId,
                        title: 'Match the ideas',
                        pairs: [
                            { id: `${fallbackId}-1`, left: 'Main concept', right: label },
                            { id: `${fallbackId}-2`, left: 'Supporting idea', right: 'Explains how the parts connect' },
                            { id: `${fallbackId}-3`, left: 'Outcome', right: 'Result shown in the diagram' },
                            { id: `${fallbackId}-4`, left: 'Input', right: 'Starting condition or signal' }
                        ]
                    }
                };
            case 'challenge':
            case 'quiz':
            default:
                return {
                    quiz: {
                        id: fallbackId,
                        question: `Which statement best captures the main idea of "${label}"?`,
                        options: [
                            label,
                            'It is unrelated to the diagram context.',
                            'It is the opposite of the concept shown.',
                            'It is a minor detail only.'
                        ],
                        correctIndex: 0,
                        explanation: `The diagram focuses on ${label}.`
                    }
                };
        }
    }, [currentTopic]);

    const presentGuidedTask = useCallback(async (task: GuidedTask, index: number) => {
        setIsGuidedFlowGenerating(true);
        setGuidedTaskIndex(index);

        const lastMessageHasImage = messagesRef.current.slice(-1).some(message => message.image);
        const shouldRenderImage = task.diagram
            ? index === 0 || (!lastMessageHasImage && shouldIncludeGuidedImage(index))
            : false;

        if (task.diagram && shouldRenderImage) {
            lastGuidedImageIndexRef.current = index;
            const prompt = `Create a clean, academic diagram on a light background based on this description: ${task.diagram.description}.
Include simple labels, minimal text, and crisp lines. Avoid stylized art.`;

            try {
                const imageResult = await generateGeminiImage(prompt, { aspectRatio: '16:9' });
                const imageUrl = `data:${imageResult.mimeType};base64,${imageResult.imageBase64}`;

                const imageMessage: TutorChatMessage = {
                    role: 'assistant',
                    content: `Diagram: ${task.diagram.type.toUpperCase()}`,
                    timestamp: new Date(),
                    image: {
                        src: imageUrl,
                        alt: task.diagram.description,
                        caption: task.diagram.description
                    }
                };
                setMessages(prev => [...prev, imageMessage]);

                const explainerMessage: TutorChatMessage = {
                    role: 'assistant',
                    content: buildDiagramExplainer(task),
                    timestamp: new Date()
                };
                setMessages(prev => [...prev, explainerMessage]);
            } catch (error) {
                console.error('[Socratic] Failed to generate diagram image:', error);
                const fallbackMessage: TutorChatMessage = {
                    role: 'assistant',
                    content: `Diagram: ${task.diagram.description}`,
                    timestamp: new Date()
                };
                setMessages(prev => [...prev, fallbackMessage]);
            }
        }

        try {
            const recentContext = messagesRef.current.slice(-6).map(m => m.content).join('\n');
            const contextParts = [
                `Topic: ${currentTopic}`,
                task.diagram ? `Diagram description: ${task.diagram.description}` : '',
                task.type === 'challenge' ? 'Make this activity more challenging.' : '',
                recentContext
            ].filter(Boolean).join('\n');

            const activityType = task.type === 'challenge' ? 'quiz' : task.type;
            const interactiveContent = await generateInteractiveContent(
                task.label,
                contextParts,
                activityType
            );
            const hasActivity = Boolean(
                interactiveContent.quiz ||
                interactiveContent.flashcards ||
                interactiveContent.fill_blank ||
                interactiveContent.matching
            );

            const activityMessage: TutorChatMessage = {
                role: 'assistant',
                content: getGuidedIntro(task, index, shouldRenderImage),
                timestamp: new Date(),
                interactive_content: hasActivity ? interactiveContent : buildFallbackActivity(task),
                guided_task_id: task.id
            };
            setMessages(prev => [...prev, activityMessage]);
        } catch (error) {
            console.error('[Socratic] Failed to generate guided activity:', error);
            const errorMessage: TutorChatMessage = {
                role: 'assistant',
                content: getGuidedIntro(task, index, shouldRenderImage),
                timestamp: new Date(),
                interactive_content: buildFallbackActivity(task),
                guided_task_id: task.id
            };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsGuidedFlowGenerating(false);
        }
    }, [buildDiagramExplainer, buildFallbackActivity, currentTopic, getGuidedIntro, shouldIncludeGuidedImage]);

    const finalizeGuidedFlow = useCallback((results: GuidedTaskResult[]) => {
        const totalTasks = results.length;
        const correctPoints = results.filter(r => r.success).map(r => r.label);
        const misconceptions = results.filter(r => !r.success).map(r => r.label);
        const successRate = totalTasks > 0
            ? Math.round((correctPoints.length / totalTasks) * 100)
            : 0;

        const report: GuidedReport = {
            misconceptions: [...new Set(misconceptions)],
            correctPoints: [...new Set(correctPoints)],
            successRate,
            totalTasks
        };

        setGuidedReport(report);
        setShowGuidedReport(true);
        setIsGuidedFlowActive(false);

        const evaluation: TutorResponse['evaluation'] = {
            scores: {
                understanding: successRate,
                accuracy: successRate,
                completeness: successRate
            },
            detected_misconceptions: report.misconceptions,
            missing_key_ideas: [],
            correct_points: report.correctPoints
        };
        setLastEvaluation(evaluation);

        const activityMessage: TutorChatMessage = {
            role: 'assistant',
            content: 'I opened a quick canvas activity to address the key gaps. Fill in the correction boxes to reinforce the ideas.',
            timestamp: new Date()
        };
        setMessages(prev => [...prev, activityMessage]);
        launchRemediationCanvas(report);

        const summaryMessage: TutorChatMessage = {
            role: 'assistant',
            content: remainingTopics.length > 0
                ? 'Report ready. Want to move on to the next topic?'
                : 'Report ready. Let me know if you want to review anything.',
            timestamp: new Date()
        };
        setMessages(prev => [...prev, summaryMessage]);
    }, [launchRemediationCanvas, remainingTopics]);

    const startGuidedFlow = useCallback(async (
        diagrams: DiagramExtractionResult['diagrams'],
        planSteps?: ActivityPlanStep[] | null
    ) => {
        const tasks = buildGuidedTasks(diagrams, planSteps);
        if (tasks.length === 0) return;

        setGuidedTasks(tasks);
        setGuidedResults([]);
        setGuidedReport(null);
        setShowGuidedReport(false);
        setIsGuidedFlowActive(true);
        lastGuidedImageIndexRef.current = -999;
        flashcardAutoAdvanceRef.current.clear();

        await presentGuidedTask(tasks[0], 0);
    }, [buildGuidedTasks, presentGuidedTask]);

    const handleGuidedTaskComplete = useCallback(async (taskId: string, success: boolean) => {
        const tasks = guidedTasksRef.current;
        const currentIndex = tasks.findIndex(task => task.id === taskId);
        if (currentIndex === -1 || guidedTaskIndex !== currentIndex) return;

        const task = tasks[currentIndex];
        const updatedResults = [
            ...guidedResultsRef.current,
            { taskId, label: task.label, success }
        ];

        guidedResultsRef.current = updatedResults;
        setGuidedResults(updatedResults);

        const feedbackMessage: TutorChatMessage = {
            role: 'assistant',
            content: success
                ? 'Nice work. Let us keep going.'
                : 'Good effort. Let us reinforce that with the next activity.',
            timestamp: new Date()
        };
        setMessages(prev => [...prev, feedbackMessage]);

        const nextIndex = currentIndex + 1;
        if (nextIndex < tasks.length) {
            await presentGuidedTask(tasks[nextIndex], nextIndex);
            return;
        }

        finalizeGuidedFlow(updatedResults);
    }, [finalizeGuidedFlow, guidedTaskIndex, presentGuidedTask]);

    const handleProceedToNextTopic = useCallback(() => {
        if (!onTopicChange || remainingTopics.length === 0) {
            setShowGuidedReport(false);
            return;
        }

        const [nextTopic] = remainingTopics;
        setShowGuidedReport(false);
        setGuidedReport(null);
        setGuidedTasks([]);
        setGuidedTaskIndex(-1);
        setGuidedResults([]);
        setIsGuidedFlowActive(false);
        setCurrentTopic(nextTopic);
        setEditTopicValue(nextTopic);
        lastGuidedImageIndexRef.current = -999;
        flashcardAutoAdvanceRef.current.clear();
        onTopicChange(nextTopic);
    }, [onTopicChange, remainingTopics]);

    // Extract diagrams from PDF on component mount
    useEffect(() => {
        if (!documentData?.data) return;

        const extractDiagrams = async () => {
            const dataSampleStart = documentData.data.slice(0, 48);
            const dataSampleEnd = documentData.data.slice(-48);
            const analysisKey = `${documentData.mimeType}:${documentData.data.length}:${dataSampleStart}:${dataSampleEnd}`;
            if (lastAnalyzedDocumentKeyRef.current === analysisKey) {
                return;
            }
            lastAnalyzedDocumentKeyRef.current = analysisKey;

            setIsExtractingDiagrams(true);
            try {
                const result = await extractDiagramsFromPdf(
                    documentData.data,
                    documentData.mimeType,
                    (stage) => console.log('[Socratic] Diagram extraction:', stage)
                );
                setDiagramAnalysis(result);

                const plan = await recommendActivityPlanFromPdf({
                    topic: currentTopic,
                    documentSummary: result.documentSummary,
                    hasTechnicalContent: result.hasTechnicalContent,
                    diagrams: result.diagrams,
                    suggestedQuestions: result.suggestedQuestions
                });

                await startGuidedFlow(result.diagrams, plan.steps);
            } catch (error) {
                console.error('[Socratic] Failed to extract diagrams:', error);
            } finally {
                setIsExtractingDiagrams(false);
            }
        };

        extractDiagrams();
    }, [documentData]);

    // Initialize Gemini Live for two-way voice chat
    const geminiLive = useGeminiLive(voiceChatApiKey, 'en', {
        systemInstructionOverride: `You are a Socratic tutor helping a student learn about ${topic}. 
Use the Socratic method - ask probing questions, guide student thinking, don't give direct answers.
Keep responses conversational and brief since this is a real-time voice conversation.
Encourage the student to think through problems step by step.`
    });

    // Compute understanding level based on evaluation
    const understandingLevel = useMemo(() => {
        if (!lastEvaluation) return 'Unknown' as const;
        const avgScore = (lastEvaluation.scores.accuracy + lastEvaluation.scores.completeness + lastEvaluation.scores.understanding) / 3;
        if (avgScore >= 70) return 'Good' as const;
        if (avgScore >= 40) return 'Fair' as const;
        return 'Poor' as const;
    }, [lastEvaluation]);

    const hasMisconceptions = useMemo(() => {
        return lastEvaluation?.detected_misconceptions && lastEvaluation.detected_misconceptions.length > 0;
    }, [lastEvaluation]);

    const guidedTaskLookup = useMemo(() => {
        return new Map(guidedTasks.map(task => [task.id, task]));
    }, [guidedTasks]);

    const activeGuidedTaskId = guidedTasks[guidedTaskIndex]?.id || null;

    const handleFlashcardAutoAdvance = useCallback((taskId: string) => {
        if (!taskId || taskId !== activeGuidedTaskId) return;
        if (flashcardAutoAdvanceRef.current.has(taskId)) return;
        if (guidedResultsRef.current.some(result => result.taskId === taskId)) return;

        flashcardAutoAdvanceRef.current.add(taskId);
        window.setTimeout(() => {
            handleGuidedTaskComplete(taskId, true);
        }, 500);
    }, [activeGuidedTaskId, handleGuidedTaskComplete]);

    // Generate default concepts based on topic keywords
    const getDefaultConcepts = useCallback((topicStr: string) => {
        const lowerTopic = topicStr.toLowerCase();

        if (lowerTopic.includes('photosynthesis')) {
            return ['Sun (Energy)', 'Water', 'CO2', 'Chlorophyll', 'O2', 'Sugar'];
        } else if (lowerTopic.includes('chemistry') || lowerTopic.includes('chemical')) {
            return ['Atoms', 'Molecules', 'Reactions', 'Bonds', 'Elements'];
        } else if (lowerTopic.includes('physics')) {
            return ['Force', 'Energy', 'Motion', 'Mass', 'Velocity'];
        } else if (lowerTopic.includes('biology') || lowerTopic.includes('cell')) {
            return ['Cells', 'DNA', 'Proteins', 'Nucleus', 'Membrane'];
        } else if (lowerTopic.includes('math') || lowerTopic.includes('algebra')) {
            return ['Variables', 'Equations', 'Functions', 'Numbers', 'Operations'];
        } else {
            // Generic concepts for any topic
            return ['Definition', 'Key Concepts', 'Examples', 'Applications'];
        }
    }, []);

    // Initialize concept network on mount
    useEffect(() => {
        const defaultConcepts = getDefaultConcepts(topic);
        const { nodes, edges } = generateConceptNetwork(
            topic,
            defaultConcepts,
            [],
            topic
        );
        console.log('[Socratic] Initializing network with', nodes.length, 'nodes for topic:', topic);
        setConceptNodes(nodes);
        setConceptEdges(edges);
    }, [topic, getDefaultConcepts]);

    // Update concept network when evaluation changes
    useEffect(() => {
        if (!lastEvaluation) return;

        const correctConcepts = lastEvaluation.correct_points || [];
        const misconceptions = lastEvaluation.detected_misconceptions || [];

        // Only update if we have new information
        if (correctConcepts.length > 0 || misconceptions.length > 0) {
            // Accumulate concepts
            const existingConcepts = conceptNodes
                .filter(n => n.data.type === 'concept')
                .map(n => n.data.label);

            const allConcepts = [...new Set([...existingConcepts, ...correctConcepts])];

            // Accumulate misconceptions
            const existingMisconceptions = conceptNodes
                .filter(n => n.data.type === 'misconception')
                .map(n => n.data.label);

            const allMisconceptions = [...new Set([...existingMisconceptions, ...misconceptions])];

            const { nodes, edges } = generateConceptNetwork(
                topic,
                allConcepts,
                allMisconceptions,
                topic
            );
            console.log('[Socratic] Updating network with', nodes.length, 'nodes,', allMisconceptions.length, 'misconceptions');
            setConceptNodes(nodes);
            setConceptEdges(edges);
        }
    }, [lastEvaluation, topic]);

    // Fetch API key for voice chat
    useEffect(() => {
        getSharedGeminiApiKey().then(key => {
            setVoiceChatApiKey(key || '');
        });
    }, []);

    // Toggle voice chat connection
    const handleVoiceChatToggle = useCallback(() => {
        if (geminiLive.connectionState === 'CONNECTED') {
            geminiLive.disconnect();
        } else {
            geminiLive.connect();
        }
    }, [geminiLive]);

    // Auto-scroll to bottom
    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, []);

    useEffect(() => {
        scrollToBottom();
    }, [messages, streamingContent, scrollToBottom]);

    // Start session on mount
    useEffect(() => {
        const initSession = async () => {
            setIsLoading(true);
            try {
                const response = await startSocraticSession(topic);

                const assistantMessage: TutorChatMessage = {
                    role: 'assistant',
                    content: response.assistant_message_md,
                    timestamp: new Date(),
                    tutor_response: response
                };

                setMessages([assistantMessage]);
                setStreamingContent('');
                setSessionState(prev => updateSessionState(prev, response));
            } catch (error) {
                console.error('Failed to start Socratic session:', error);
            } finally {
                setIsLoading(false);
            }
        };

        initSession();
    }, [topic]);

    // Handle sending a message
    const handleSendMessage = async () => {
        if (!inputValue.trim() || isLoading) return;

        const userMessage: TutorChatMessage = {
            role: 'user',
            content: inputValue.trim(),
            timestamp: new Date()
        };

        setMessages(prev => [...prev, userMessage]);
        setInputValue('');
        setIsLoading(true);
        setStreamingContent('');
        setShowEvaluation(false);

        try {
            const response = await generateSocraticResponse(
                userMessage.content,
                topic,
                messages,
                sessionState.hint_level,
                sessionState.attempt_count
            );

            // Check for activity request
            let interactiveContent = undefined;
            if (response.activity_request) {
                try {
                    const context = messages.slice(-10).map(m => m.content).join('\n');
                    interactiveContent = await generateInteractiveContent(
                        response.activity_request.topic,
                        context,
                        response.activity_request.type
                    );

                    // Also update the sidebar state for convenience
                    if (interactiveContent.flashcards) {
                        setFlashcards(interactiveContent.flashcards);
                        setActiveTab('flashcards');
                    } else if (interactiveContent.quiz) {
                        setQuiz(interactiveContent.quiz);
                        setActiveTab('quiz');
                    }
                } catch (err) {
                    console.error('Failed to generate requested activity:', err);
                }
            }

            const assistantMessage: TutorChatMessage = {
                role: 'assistant',
                content: response.assistant_message_md,
                timestamp: new Date(),
                tutor_response: response,
                interactive_content: interactiveContent
            };

            setMessages(prev => [...prev, assistantMessage]);
            setStreamingContent('');
            setLastEvaluation(response.evaluation);
            setSessionState(prev => updateSessionState(prev, response));

            // Check for auto mode switch
            const switchCheck = checkAutoModeSwitch(
                response.evaluation,
                'socratic',
                sessionState.attempt_count
            );

            if (switchCheck.shouldSwitch && switchCheck.trigger) {
                if (switchCheck.suggestedMode === 'feynman') {
                    setModeSwitchSuggestion('Based on your responses, you might benefit from the Feynman Technique to consolidate your understanding.');
                }
            }
        } catch (error) {
            console.error('Failed to get response:', error);
            const errorMessage: TutorChatMessage = {
                role: 'assistant',
                content: 'I encountered an error. Please try again.',
                timestamp: new Date()
            };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
            setStreamingContent('');
        }
    };

    // Handle key press
    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    // Clear session
    const handleClearSession = useCallback(() => {
        setMessages([]);
        setStreamingContent('');
        setLastEvaluation(null);
        setSessionState(createSessionState(currentTopic, 'socratic'));
        setGuidedTasks([]);
        setGuidedTaskIndex(-1);
        setGuidedResults([]);
        setGuidedReport(null);
        setShowGuidedReport(false);
        setIsGuidedFlowActive(false);
        lastGuidedImageIndexRef.current = -999;
        lastAnalyzedDocumentKeyRef.current = null;
        flashcardAutoAdvanceRef.current.clear();

        // Reset to initial network state
        const defaultConcepts = getDefaultConcepts(currentTopic);
        const { nodes, edges } = generateConceptNetwork(
            currentTopic,
            defaultConcepts,
            [],
            currentTopic
        );
        setConceptNodes(nodes);
        setConceptEdges(edges);

        setConfidence(50);
    }, [currentTopic, getDefaultConcepts]);

    // Topic editing handlers
    const handleSaveTopic = useCallback(() => {
        if (editTopicValue.trim()) {
            setCurrentTopic(editTopicValue.trim());
            setIsEditingTopic(false);
            handleClearSession();
        }
    }, [editTopicValue, handleClearSession]);

    const handleCancelEdit = useCallback(() => {
        setEditTopicValue(currentTopic);
        setIsEditingTopic(false);
    }, [currentTopic]);

    // Handle canvas drawing submission
    const handleSubmitDrawing = async () => {
        if (!excalidrawRef.current) return;

        const elements = excalidrawRef.current.getElements();
        if (elements.length === 0) {
            return;
        }

        setIsLoading(true);
        setIsCanvasOpen(false);

        try {
            // Export canvas as PNG image
            const imageBase64 = await excalidrawRef.current.exportToImage();

            if (!imageBase64) {
                throw new Error('Failed to export drawing as image');
            }

            // Add a message showing the drawing was submitted
            const shapeCount = elements.filter((el: any) => el.type !== 'text').length;
            const drawingMessage: TutorChatMessage = {
                role: 'user',
                content: `[Submitted a visual answer - drawing with ${shapeCount} shapes/diagrams]`,
                timestamp: new Date()
            };
            setMessages(prev => [...prev, drawingMessage]);

            // Get the last question from the chat
            const lastAssistantMessage = [...messages].reverse().find(m => m.role === 'assistant');
            const currentQuestion = lastAssistantMessage?.content || topic;

            // Analyze the drawing using vision API
            const response = await analyzeDrawingForSocratic(
                topic,
                currentQuestion,
                sessionState.hint_level,
                imageBase64 // Pass the actual image
            );

            const assistantMessage: TutorChatMessage = {
                role: 'assistant',
                content: response.assistant_message_md,
                timestamp: new Date(),
                tutor_response: response
            };

            setMessages(prev => [...prev, assistantMessage]);
            setLastEvaluation(response.evaluation);
            setSessionState(prev => updateSessionState(prev, response));
        } catch (error) {
            console.error('Failed to analyze drawing:', error);
            const errorMessage: TutorChatMessage = {
                role: 'assistant',
                content: 'I had trouble analyzing your drawing. Please try again or type your answer.',
                timestamp: new Date()
            };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    // Handle AI diagram generation in the dialogue panel
    const handleShowOnCanvas = async () => {
        const lastAssistantMessage = [...messages].reverse().find(m => m.role === 'assistant');
        const context = lastAssistantMessage?.content || `Explain ${topic}`;

        setIsGeneratingDiagram(true);

        try {
            const prompt = `Create a clean, academic diagram on a light background that helps explain: ${topic}.
Context: ${context}. Use simple labels, minimal text, crisp lines, and avoid stylized art.`;
            const imageResult = await generateGeminiImage(prompt, { aspectRatio: '16:9' });
            const imageUrl = `data:${imageResult.mimeType};base64,${imageResult.imageBase64}`;

            const imageMessage: TutorChatMessage = {
                role: 'assistant',
                content: `Generated diagram for ${topic}.`,
                timestamp: new Date(),
                image: {
                    src: imageUrl,
                    alt: `Diagram for ${topic}`,
                    caption: `Generated diagram for ${topic}`
                }
            };
            setMessages(prev => [...prev, imageMessage]);
        } catch (error) {
            console.error('Failed to generate diagram image:', error);
            const errorMessage: TutorChatMessage = {
                role: 'assistant',
                content: 'I could not generate a diagram image right now. Please try again.',
                timestamp: new Date()
            };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsGeneratingDiagram(false);
        }
    };

    // --- Interactive Content Handlers ---

    const handleGenerateFlashcards = async () => {
        setIsGeneratingContent(true);
        try {
            const context = messages.slice(-10).map(m => m.content).join('\n');
            const result = await generateInteractiveContent(topic, context, 'flashcards');
            if (result.flashcards) {
                setFlashcards(result.flashcards);
            }
        } catch (error) {
            console.error('Failed to generate flashcards:', error);
        } finally {
            setIsGeneratingContent(false);
        }
    };

    const handleGenerateQuiz = async () => {
        setIsGeneratingContent(true);
        try {
            const context = messages.slice(-10).map(m => m.content).join('\n');
            const result = await generateInteractiveContent(topic, context, 'quiz');
            if (result.quiz) {
                setQuiz(result.quiz);
            }
        } catch (error) {
            console.error('Failed to generate quiz:', error);
        } finally {
            setIsGeneratingContent(false);
        }
    };

    const handleQuizComplete = async (success: boolean, quizQuestion?: string, guidedTaskId?: string) => {
        const questionTopic = quizQuestion || quiz?.question || 'Unknown Topic';

        // Update the concept graph based on quiz result
        const existingConcepts = conceptNodes
            .filter(n => n.data.type === 'concept')
            .map(n => n.data.label);
        const existingMisconceptions = conceptNodes
            .filter(n => n.data.type === 'misconception')
            .map(n => n.data.label);

        let allConcepts = [...existingConcepts];
        let allMisconceptions = [...existingMisconceptions];

        if (success) {
            // Add to correct concepts (green node)
            if (!allConcepts.includes(questionTopic)) {
                allConcepts.push(questionTopic);
            }
        } else {
            // Add to misconceptions (red node)
            if (!allMisconceptions.includes(questionTopic)) {
                allMisconceptions.push(questionTopic);
            }
        }

        // Regenerate the graph with updated data
        const { nodes, edges } = generateConceptNetwork(
            currentTopic,
            allConcepts,
            allMisconceptions,
            currentTopic
        );
        setConceptNodes(nodes);
        setConceptEdges(edges);

        if (guidedTaskId && isGuidedFlowActive) {
            await handleGuidedTaskComplete(guidedTaskId, success);
            return;
        }

        // Send feedback to tutor
        const feedbackMsg: TutorChatMessage = {
            role: 'user',
            content: success
                ? `[System] I just took a quiz on "${questionTopic}" and got it CORRECT!`
                : `[System] I just took a quiz on "${questionTopic}" and got it WRONG. Can you explain this concept?`,
            timestamp: new Date()
        };
        setMessages(prev => [...prev, feedbackMsg]);
    };

    // Hint level steps for progress indicator
    const hintLevels: HintLevel[] = [0, 1, 2, 3, 4];

    return (
        <div className="fixed inset-0 z-50 flex flex-col bg-white overflow-hidden">
            {/* Header Bar - Clean minimal design matching Feynman */}
            <header className="flex-shrink-0 flex items-center justify-between px-4 py-2 border-b border-gray-200 bg-white">
                <div className="flex items-center gap-4">
                    <button
                        onClick={onBack}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <Menu className="w-5 h-5 text-gray-600" />
                    </button>
                    {isEditingTopic ? (
                        <div className="flex items-center gap-2">
                            <input
                                type="text"
                                value={editTopicValue}
                                onChange={(e) => setEditTopicValue(e.target.value)}
                                className="px-2 py-1 text-sm border border-emerald-300 rounded focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                placeholder="Enter new topic..."
                                autoFocus
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSaveTopic();
                                    if (e.key === 'Escape') handleCancelEdit();
                                }}
                            />
                            <button onClick={handleSaveTopic} className="p-1 hover:bg-green-100 rounded text-green-600">
                                <Check className="w-4 h-4" />
                            </button>
                            <button onClick={handleCancelEdit} className="p-1 hover:bg-red-100 rounded text-red-600">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2">
                            <span className="text-base font-medium text-gray-800">
                                Socratic Mode: <span className="text-emerald-700 font-bold">{currentTopic}</span>
                            </span>
                            <button
                                onClick={() => {
                                    setEditTopicValue(currentTopic);
                                    setIsEditingTopic(true);
                                }}
                                className="p-1 text-gray-400 hover:text-emerald-600 transition-colors"
                                title="Change Topic"
                            >
                                <Edit3 className="w-4 h-4" />
                            </button>
                        </div>
                    )}
                </div>

                {/* Hint Level Progress Bar - Center */}
                <div className="flex-1 max-w-xs mx-4">
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 mr-1">Hint:</span>
                        {hintLevels.map((level, i) => (
                            <React.Fragment key={level}>
                                <div
                                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all ${level < sessionState.hint_level
                                        ? 'bg-emerald-500 text-white'
                                        : level === sessionState.hint_level
                                            ? 'bg-emerald-500 text-white ring-2 ring-emerald-300 ring-offset-1'
                                            : 'bg-gray-200 text-gray-400'
                                        }`}
                                    title={`L${level}: ${HINT_LEVEL_LABELS[level]}`}
                                >
                                    {level}
                                </div>
                                {i < 4 && (
                                    <div className={`flex-1 h-1 rounded ${level < sessionState.hint_level ? 'bg-emerald-400' : 'bg-gray-200'
                                        }`} />
                                )}
                            </React.Fragment>
                        ))}
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {/* Canvas toggle */}
                    <button
                        onClick={() => setIsCanvasOpen(!isCanvasOpen)}
                        className={`p-2 rounded-lg transition-colors flex items-center gap-1 text-sm ${isCanvasOpen
                            ? 'bg-pink-100 text-pink-700'
                            : 'hover:bg-gray-100 text-gray-600'
                            }`}
                        title="Draw"
                    >
                        <PenTool className="w-4 h-4" />
                    </button>

                    {/* Voice Chat */}
                    <button
                        onClick={handleVoiceChatToggle}
                        disabled={!voiceChatApiKey}
                        className={`p-2 rounded-lg transition-colors ${geminiLive.connectionState === 'CONNECTED'
                            ? 'bg-green-100 text-green-700'
                            : 'hover:bg-gray-100 text-gray-600'
                            } disabled:opacity-50`}
                        title="Voice Chat"
                    >
                        {geminiLive.connectionState === 'CONNECTED' ? (
                            geminiLive.isListening ? <Mic className="w-4 h-4 animate-pulse text-red-500" /> : <MicOff className="w-4 h-4" />
                        ) : (
                            <Mic className="w-4 h-4" />
                        )}
                    </button>

                    {/* Reset */}
                    <button
                        onClick={handleClearSession}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-600"
                        title="Reset session"
                    >
                        <RotateCcw className="w-4 h-4" />
                    </button>

                    {/* User avatar */}
                    <button className="w-9 h-9 rounded-full bg-emerald-600 flex items-center justify-center overflow-hidden">
                        <User className="w-5 h-5 text-white" />
                    </button>
                </div>
            </header>

            {/* Next Topics Strip - Shows remaining topics for continuous study */}
            {remainingTopics.length > 0 && (
                <div className="flex-shrink-0 px-4 py-2 bg-gradient-to-r from-emerald-50 to-teal-50 border-b border-emerald-100 flex items-center gap-2 overflow-x-auto">
                    <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wider whitespace-nowrap">Next Topics:</span>
                    <div className="flex gap-2">
                        {remainingTopics.slice(0, 5).map((topic, idx) => (
                            <button
                                key={idx}
                                onClick={() => onTopicChange?.(topic)}
                                className="px-3 py-1 text-sm bg-white text-emerald-700 rounded-full border border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300 transition-all whitespace-nowrap shadow-sm"
                            >
                                {topic}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Main Split Layout - Full Page */}
            <div className="flex flex-1 overflow-hidden">
                {/* Left Panel - Socratic Dialogue (~50%) */}
                <div className="flex-1 flex flex-col min-w-0 border-r border-gray-200">
                    {/* Panel Header */}
                    <div className="flex-shrink-0 px-6 py-4 border-b border-gray-100">
                        <h2 className="text-xl font-bold text-gray-900">Socratic Dialogue</h2>
                    </div>

                    {/* Chat Container */}
                    <div className="flex-1 flex flex-col bg-gray-50 m-4 rounded-xl border border-gray-200 overflow-hidden">
                        {/* Chat Header */}
                        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white">
                            <button onClick={onBack} className="p-1.5 hover:bg-gray-100 rounded">
                                <ArrowLeft className="w-4 h-4 text-gray-500" />
                            </button>
                            <div className="flex items-center gap-2">
                                <span className="px-3 py-1 bg-emerald-100 text-emerald-700 text-xs font-medium rounded-full flex items-center gap-1">
                                    <Sparkles className="w-3 h-3" />
                                    Socratic Mode
                                </span>
                            </div>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={handleShowOnCanvas}
                                    disabled={isLoading || isGeneratingDiagram}
                                    className="p-1.5 hover:bg-gray-100 rounded"
                                    title="Generate diagram"
                                >
                                    {isGeneratingDiagram ? (
                                        <Loader2 className="w-4 h-4 text-gray-500 animate-spin" />
                                    ) : (
                                        <Palette className="w-4 h-4 text-gray-500" />
                                    )}
                                </button>
                                <div className="w-7 h-7 rounded-full bg-emerald-600 flex items-center justify-center">
                                    <User className="w-4 h-4 text-white" />
                                </div>
                            </div>
                        </div>

                        {/* Messages Area */}
                        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                            {messages.map((message, index) => {
                                const guidedTask = message.guided_task_id
                                    ? guidedTaskLookup.get(message.guided_task_id)
                                    : undefined;
                                const showFlashcardCompletion = Boolean(
                                    guidedTask?.type === 'flashcards' && message.guided_task_id === activeGuidedTaskId
                                );
                                return (
                                    <div
                                        key={index}
                                        className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                    >
                                        <div className={`flex items-start gap-2 max-w-[85%] ${message.role === 'user' ? 'flex-row-reverse' : ''}`}>
                                            {message.role === 'assistant' && (
                                                <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                                                    <MessageCircle className="w-4 h-4 text-gray-500" />
                                                </div>
                                            )}
                                            <div
                                                className={`px-4 py-2.5 rounded-2xl text-sm ${message.role === 'user'
                                                    ? 'bg-emerald-100 text-emerald-900 rounded-br-md'
                                                    : 'bg-white text-gray-800 rounded-bl-md shadow-sm border border-gray-100'
                                                    }`}
                                            >
                                                {message.role === 'assistant' ? (
                                                    <div className="prose prose-sm max-w-none">
                                                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                            {message.content}
                                                        </ReactMarkdown>

                                                        {message.image && (
                                                            <div className="mt-3 overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
                                                                <img
                                                                    src={message.image.src}
                                                                    alt={message.image.alt || 'Generated diagram'}
                                                                    className="h-auto w-full"
                                                                />
                                                                {message.image.caption && (
                                                                    <div className="px-4 py-2 text-xs text-gray-500">
                                                                        {message.image.caption}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}

                                                        {/* Embedded Interactive Content */}
                                                        {message.interactive_content && (
                                                            <div className="mt-4 not-prose">
                                                                {message.interactive_content.flashcards && message.interactive_content.flashcards.length > 0 && (
                                                                    <div className="bg-white rounded-xl border border-indigo-100 shadow-sm overflow-hidden p-2">
                                                                        <div className="text-xs font-bold text-indigo-500 uppercase tracking-wider px-4 py-2">
                                                                            Flashcards
                                                                        </div>
                                                                    <div className="h-[350px]">
                                                                        <FlashcardDeck
                                                                            cards={message.interactive_content.flashcards}
                                                                            onFlipStateChange={(isFlipped) => {
                                                                                if (isFlipped && message.guided_task_id) {
                                                                                    handleFlashcardAutoAdvance(message.guided_task_id);
                                                                                }
                                                                            }}
                                                                        />
                                                                    </div>
                                                                        {showFlashcardCompletion && (
                                                                            <div className="flex items-center justify-end gap-2 px-4 pb-3 pt-2">
                                                                                <button
                                                                                    onClick={() => handleGuidedTaskComplete(message.guided_task_id as string, false)}
                                                                                    className="px-3 py-1.5 text-xs font-semibold rounded-full border border-rose-200 text-rose-600 hover:bg-rose-50"
                                                                                >
                                                                                    Needs review
                                                                                </button>
                                                                                <button
                                                                                    onClick={() => handleGuidedTaskComplete(message.guided_task_id as string, true)}
                                                                                    className="px-3 py-1.5 text-xs font-semibold rounded-full bg-emerald-500 text-white hover:bg-emerald-600"
                                                                                >
                                                                                    Mark complete
                                                                                </button>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                )}

                                                                {message.interactive_content.quiz && (
                                                                    <div className="max-w-md mx-auto">
                                                                        <QuizPanel
                                                                            quiz={message.interactive_content.quiz}
                                                                            onComplete={(success) => handleQuizComplete(
                                                                                success,
                                                                                message.interactive_content?.quiz?.question,
                                                                                message.guided_task_id
                                                                            )}
                                                                            onGenerateNew={() => {
                                                                                setInputValue("Give me another quiz question.");
                                                                                handleSendMessage();
                                                                            }}
                                                                        />
                                                                    </div>
                                                                )}

                                                                {message.interactive_content.fill_blank && (
                                                                    <FillBlankActivity
                                                                        activity={message.interactive_content.fill_blank}
                                                                        onComplete={(success) => handleQuizComplete(
                                                                            success,
                                                                            message.interactive_content?.fill_blank?.sentence,
                                                                            message.guided_task_id
                                                                        )}
                                                                    />
                                                                )}

                                                                {message.interactive_content.matching && (
                                                                    <MatchingActivity
                                                                        activity={message.interactive_content.matching}
                                                                        onComplete={(success) => handleQuizComplete(
                                                                            success,
                                                                            message.interactive_content?.matching?.title,
                                                                            message.guided_task_id
                                                                        )}
                                                                    />
                                                                )}

                                                                {message.interactive_content.visualization && (
                                                                    <div className="bg-gradient-to-br from-teal-50 to-cyan-50 rounded-xl border border-teal-200 p-6">
                                                                        <div className="flex items-center gap-2 mb-3">
                                                                            <div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center">
                                                                                <Target className="w-4 h-4 text-teal-600" />
                                                                            </div>
                                                                            <span className="text-xs font-bold text-teal-600 uppercase tracking-wider">
                                                                                Concept Visualization
                                                                            </span>
                                                                        </div>
                                                                        <h4 className="font-semibold text-teal-800 mb-2">{message.interactive_content.visualization.topic}</h4>
                                                                        <p className="text-sm text-teal-700">{message.interactive_content.visualization.description}</p>
                                                                        {message.interactive_content.visualization.imageUrl && (
                                                                            <img
                                                                                src={message.interactive_content.visualization.imageUrl}
                                                                                alt={message.interactive_content.visualization.topic}
                                                                                className="w-full h-auto rounded-lg shadow-sm border border-teal-100 mt-3 bg-white"
                                                                            />
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}

                                                    </div>
                                                ) : (
                                                    <p className="whitespace-pre-wrap">{message.content}</p>
                                                )}
                                            </div>
                                            {message.role === 'user' && (
                                                <div className="w-7 h-7 rounded-full bg-emerald-600 flex items-center justify-center flex-shrink-0">
                                                    <User className="w-4 h-4 text-white" />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}

                            {/* Streaming content */}
                            {streamingContent && (
                                <div className="flex justify-start">
                                    <div className="flex items-start gap-2 max-w-[85%]">
                                        <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                                            <MessageCircle className="w-4 h-4 text-gray-500" />
                                        </div>
                                        <div className="px-4 py-2.5 rounded-2xl rounded-bl-md bg-white text-gray-800 shadow-sm border border-gray-100 text-sm">
                                            <div className="prose prose-sm max-w-none">
                                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                    {streamingContent}
                                                </ReactMarkdown>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Loading indicator */}
                            {isLoading && !streamingContent && (
                                <div className="flex justify-start">
                                    <div className="flex items-start gap-2">
                                        <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center">
                                            <MessageCircle className="w-4 h-4 text-gray-500" />
                                        </div>
                                        <div className="px-4 py-2.5 bg-white rounded-2xl rounded-bl-md shadow-sm flex items-center gap-2 text-sm text-gray-600">
                                            <Loader2 className="w-4 h-4 text-emerald-500 animate-spin" />
                                            Thinking...
                                        </div>
                                    </div>
                                </div>
                            )}

                            {isGuidedFlowGenerating && !streamingContent && !isLoading && (
                                <div className="flex justify-start">
                                    <div className="flex items-start gap-2">
                                        <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center">
                                            <MessageCircle className="w-4 h-4 text-gray-500" />
                                        </div>
                                        <div className="px-4 py-2.5 bg-white rounded-2xl rounded-bl-md shadow-sm flex items-center gap-2 text-sm text-gray-600">
                                            <Loader2 className="w-4 h-4 text-emerald-500 animate-spin" />
                                            Preparing the next activity...
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div ref={messagesEndRef} />
                        </div>

                        {/* Confidence Slider */}
                        <div className="px-4 py-3 border-t border-gray-200 bg-white">
                            <div className="flex items-center justify-center gap-4">
                                <span className="text-sm font-medium text-gray-600">Confidence</span>
                                <div className="flex items-center gap-3 flex-1 max-w-xs">
                                    <span className="text-xs text-gray-400 w-4">0</span>
                                    <input
                                        type="range"
                                        min="0"
                                        max="100"
                                        value={confidence}
                                        onChange={(e) => setConfidence(Number(e.target.value))}
                                        className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                                    />
                                    <span className="text-xs text-gray-400 w-6">100</span>
                                </div>
                            </div>
                        </div>

                        {/* Input Area */}
                        <div className="px-4 py-3 border-t border-gray-200 bg-white">
                            <div className="flex items-center gap-2">
                                <input
                                    type="text"
                                    value={inputValue}
                                    onChange={(e) => setInputValue(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder="Type your message here..."
                                    className="flex-1 px-4 py-2.5 rounded-full border border-gray-200 bg-gray-50 text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                                    disabled={isLoading}
                                />
                                <button
                                    onClick={handleSendMessage}
                                    disabled={!inputValue.trim() || isLoading}
                                    className="p-2.5 bg-emerald-500 text-white rounded-full hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    <Send className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Panel - Concept Network & Misconception Mapper */}
                <div className="flex-1 flex flex-col min-w-0 bg-gray-50 border-l border-gray-200">
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white">
                        <div className="flex items-center gap-2">
                            <BrainCircuit className="w-5 h-5 text-emerald-600" />
                            <h2 className="text-lg font-semibold text-gray-800">Concept Network & Misconception Mapper</h2>
                        </div>
                    </div>

                    {guidedReport && (
                        <div className="mx-4 mt-4 rounded-xl border border-emerald-100 bg-white p-4 shadow-sm">
                            <div className="flex items-center justify-between">
                                <div className="text-sm font-semibold text-emerald-700">Misconception Report</div>
                                <div className="text-xs text-gray-400">{guidedReport.successRate}% mastery</div>
                            </div>
                            <div className="mt-2 text-xs text-gray-500">
                                Tasks completed: {guidedReport.totalTasks}
                            </div>
                            <div className="mt-3 text-xs font-semibold text-gray-600">Correct points</div>
                            {guidedReport.correctPoints.length > 0 ? (
                                <ul className="mt-2 text-xs text-emerald-600 space-y-1">
                                    {guidedReport.correctPoints.slice(0, 4).map((point, idx) => (
                                        <li key={`${point}-${idx}`} className="line-clamp-2">{point}</li>
                                    ))}
                                </ul>
                            ) : (
                                <div className="mt-2 text-xs text-gray-400">No confirmed points yet.</div>
                            )}
                            <div className="mt-3 text-xs font-semibold text-gray-600">Misconceptions</div>
                            {guidedReport.misconceptions.length > 0 ? (
                                <ul className="mt-2 text-xs text-rose-600 space-y-1">
                                    {guidedReport.misconceptions.slice(0, 4).map((item, idx) => (
                                        <li key={`${item}-${idx}`} className="line-clamp-2">{item}</li>
                                    ))}
                                </ul>
                            ) : (
                                <div className="mt-2 text-xs text-emerald-600">No misconceptions flagged.</div>
                            )}
                        </div>
                    )}

                    {/* Graph Area */}
                    <div className="flex-1 overflow-hidden p-4">
                        <ConceptNetworkGraph
                            nodes={conceptNodes}
                            edges={conceptEdges}
                            understandingLevel={understandingLevel}
                            hasMisconceptions={hasMisconceptions || false}
                        />
                    </div>
                </div>
            </div>

            {/* Mode Switch Suggestion */}
            <AnimatePresence>
                {modeSwitchSuggestion && onSwitchToFeynman && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 20 }}
                        className="fixed bottom-4 left-1/2 -translate-x-1/2 p-4 bg-purple-50 rounded-xl border border-purple-200 shadow-lg max-w-md z-50"
                    >
                        <p className="text-sm text-purple-700 mb-3">
                            {modeSwitchSuggestion}
                        </p>
                        <div className="flex gap-2">
                            <button
                                onClick={() => onSwitchToFeynman(topic)}
                                className="px-4 py-2 text-sm bg-purple-500 text-white rounded-lg hover:bg-purple-600"
                            >
                                Try Feynman Mode
                            </button>
                            <button
                                onClick={() => setModeSwitchSuggestion(null)}
                                className="px-4 py-2 text-sm bg-gray-200 text-gray-600 rounded-lg hover:bg-gray-300"
                            >
                                Stay in Socratic
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {showGuidedReport && guidedReport && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
                    >
                        <motion.div
                            initial={{ scale: 0.96, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.96, opacity: 0 }}
                            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"
                        >
                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-semibold text-gray-800">Misconception Report</h3>
                                <button
                                    onClick={() => setShowGuidedReport(false)}
                                    className="p-2 rounded-full hover:bg-gray-100"
                                >
                                    <X className="w-4 h-4 text-gray-500" />
                                </button>
                            </div>
                            <p className="mt-2 text-sm text-gray-500">
                                You completed {guidedReport.totalTasks} activities with {guidedReport.successRate}% mastery.
                            </p>

                            <div className="mt-4">
                                <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Correct Points</div>
                                {guidedReport.correctPoints.length > 0 ? (
                                    <ul className="mt-2 text-sm text-emerald-600 space-y-1">
                                        {guidedReport.correctPoints.map((point, idx) => (
                                            <li key={`${point}-${idx}`} className="line-clamp-2">{point}</li>
                                        ))}
                                    </ul>
                                ) : (
                                    <div className="mt-2 text-sm text-gray-400">No confirmed points yet.</div>
                                )}
                            </div>

                            <div className="mt-4">
                                <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Misconceptions</div>
                                {guidedReport.misconceptions.length > 0 ? (
                                    <ul className="mt-2 text-sm text-rose-600 space-y-1">
                                        {guidedReport.misconceptions.map((item, idx) => (
                                            <li key={`${item}-${idx}`} className="line-clamp-2">{item}</li>
                                        ))}
                                    </ul>
                                ) : (
                                    <div className="mt-2 text-sm text-emerald-600">No misconceptions flagged.</div>
                                )}
                            </div>

                            <div className="mt-6 flex items-center justify-end gap-2">
                                <button
                                    onClick={() => setShowGuidedReport(false)}
                                    className="px-4 py-2 text-sm rounded-full border border-gray-200 text-gray-600 hover:bg-gray-50"
                                >
                                    Stay here
                                </button>
                                {remainingTopics.length > 0 && onTopicChange && (
                                    <button
                                        onClick={handleProceedToNextTopic}
                                        className="px-4 py-2 text-sm rounded-full bg-emerald-500 text-white hover:bg-emerald-600"
                                    >
                                        Next topic
                                    </button>
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Excalidraw Canvas for visual answers */}
            <ExcalidrawCanvas
                ref={excalidrawRef}
                isOpen={isCanvasOpen}
                onClose={() => setIsCanvasOpen(false)}
                title="Draw Your Answer"
            />

            {/* Canvas submit button when canvas is open */}
            {isCanvasOpen && (
                <div className="fixed bottom-20 right-8 z-50">
                    <button
                        onClick={handleSubmitDrawing}
                        disabled={isLoading}
                        className="px-4 py-2 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 disabled:opacity-50 shadow-lg flex items-center gap-2"
                    >
                        <Pencil className="w-4 h-4" />
                        Submit Drawing
                    </button>
                </div>
            )}
        </div>
    );
};

export default SocraticLearningMode;
