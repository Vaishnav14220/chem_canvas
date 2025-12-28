/**
 * Feynman Learning Mode Component - Redesigned UI
 * 
 * Implements the Feynman Technique: learner teaches the concept, AI identifies gaps.
 * Split-screen layout: Canvas on left (~70%), Chat on right (~30%)
 * Matches reference design exactly
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Menu,
    User,
    Send,
    Pencil,
    Eraser,
    MessageSquare,
    Mic,
    MicOff,
    Circle,
    MoreHorizontal,
    Loader2,
    Volume2,
    Share2,
    RotateCcw,
    Edit3,
    Upload,
    FileText,
    Check,
    X,
    ChevronDown,
    ChevronUp,
    Brain,
    GitBranch,
    ImagePlus,
    Target
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
    TutorChatMessage,
    TutorSessionState,
    GapMapAnalysis
} from '../types/tutorTypes';
import {
    generateFeynmanResponse,
    startFeynmanSession as startFeynmanTutorSession,
    createSessionState,
    updateSessionState,
    generateMermaidDiagram
} from '../services/socraticFeynmanTutorService';
import { ExcalidrawCanvas, ExcalidrawCanvasRef } from './ExcalidrawCanvas/ExcalidrawCanvas';
import { TaskPanel, TaskItem } from './TaskPanel';
import { FeynmanProgress, FeynmanStage } from './FeynmanProgress';
import { LearningScoreCard, MisconceptionItem, ConceptItem, InsightItem } from './LearningScoreCard';
import { ClassroomSimulation } from './ClassroomSimulation';
import { useGeminiLive } from './GeminiLive/hooks/useGeminiLive';
import { getSharedGeminiApiKey } from '../firebase/apiKeys';
import { extractTextFromDocument } from '../utils/documentTextExtractor';
import { addFileToSourceLibrary } from '../utils/sourceLibrary';

interface FeynmanLearningModeProps {
    topic: string;
    onBack: () => void;
    onSwitchToSocratic?: (topic: string) => void;
    remainingTopics?: string[];
    onTopicChange?: (newTopic: string) => void;
    documentData?: { mimeType: string; data: string };
}

// Color palette matching reference
const COLORS = [
    { name: 'red', hex: '#ef4444' },
    { name: 'green', hex: '#22c55e' },
    { name: 'blue', hex: '#3b82f6' },
    { name: 'purple', hex: '#a855f7' }
];

export const FeynmanLearningMode: React.FC<FeynmanLearningModeProps> = ({
    topic,
    onBack,
    remainingTopics = [],
    onTopicChange,
    documentData
}) => {
    // Sub-mode: 'tutor' = original mode, 'classroom' = simulated classroom
    const [feynmanSubMode, setFeynmanSubMode] = useState<'tutor' | 'classroom'>('tutor');

    // State
    const [messages, setMessages] = useState<TutorChatMessage[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [sessionState, setSessionState] = useState<TutorSessionState>(() =>
        createSessionState(topic, 'feynman')
    );
    const [streamingContent, setStreamingContent] = useState('');
    const [gapMaps, setGapMaps] = useState<GapMapAnalysis[]>([]);
    const [isTeachBackMode, setIsTeachBackMode] = useState(false);
    const [teachBackAttempts, setTeachBackAttempts] = useState(0);

    // Current task panel state - uses dynamic topic
    const [currentTasks, setCurrentTasks] = useState<TaskItem[]>([
        { id: '1', text: `Teach me about "${topic}" as if I were 12 years old. What is it and why does it matter?`, type: 'question' }
    ]);

    // Feynman progress state
    const [currentStage, setCurrentStage] = useState<FeynmanStage>('introduction');
    const [completedStages, setCompletedStages] = useState<FeynmanStage[]>([]);
    const [gapsIdentified, setGapsIdentified] = useState(0);
    const [gapsResolved, setGapsResolved] = useState(0);

    // Learning score tracking
    const [masteryScore, setMasteryScore] = useState(0);
    const [conceptsCleared, setConceptsCleared] = useState(0);
    const [insightsGained, setInsightsGained] = useState(0);
    const totalConcepts = 5; // Estimated concepts per topic

    // Detailed tracking lists for expandable view
    const [misconceptionsList, setMisconceptionsList] = useState<MisconceptionItem[]>([]);
    const [conceptsList, setConceptsList] = useState<ConceptItem[]>([
        { id: 'c1', name: 'Core Definitions', cleared: false },
        { id: 'c2', name: 'Key Principles', cleared: false },
        { id: 'c3', name: 'Practical Applications', cleared: false },
        { id: 'c4', name: 'Common Examples', cleared: false },
        { id: 'c5', name: 'Advanced Connections', cleared: false },
    ]);
    const [insightsList, setInsightsList] = useState<InsightItem[]>([]);

    // Drawing state
    const [activeTool, setActiveTool] = useState<'pen' | 'eraser' | 'text'>('pen');
    const [activeColor, setActiveColor] = useState('blue');
    const [isRecording, setIsRecording] = useState(false);

    // Topic editing state
    const [currentTopic, setCurrentTopic] = useState(topic);
    const [isEditingTopic, setIsEditingTopic] = useState(false);
    const [editTopicValue, setEditTopicValue] = useState(topic);
    const [uploadedDocument, setUploadedDocument] = useState<{ name: string; content: string } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Thinking/Reasoning state
    const [thinkingContent, setThinkingContent] = useState('');
    const [isThinkingExpanded, setIsThinkingExpanded] = useState(true);
    const [isThinking, setIsThinking] = useState(false);

    // Voice chat state
    const [voiceChatApiKey, setVoiceChatApiKey] = useState<string>('');

    // Refs
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const excalidrawRef = useRef<ExcalidrawCanvasRef>(null);

    // Initialize Gemini Live for voice chat
    const geminiLive = useGeminiLive(voiceChatApiKey, 'en', {
        systemInstructionOverride: `You are a Feynman Tutor helping a student explain ${topic}. 
Use the Feynman technique - ask the student to explain concepts simply.
Identify gaps in their understanding and provide gentle feedback.
Keep responses conversational and brief for voice interaction.`
    });

    // Fetch API key for voice chat
    useEffect(() => {
        getSharedGeminiApiKey().then(key => {
            setVoiceChatApiKey(key || '');
        });
    }, []);

    // Toggle voice chat
    const handleVoiceChatToggle = useCallback(() => {
        if (geminiLive.connectionState === 'CONNECTED') {
            geminiLive.disconnect();
        } else {
            geminiLive.connect();
        }
    }, [geminiLive]);

    // Handle tool change - update both local state and canvas
    const handleToolChange = useCallback((tool: 'pen' | 'eraser' | 'text') => {
        setActiveTool(tool);
        if (excalidrawRef.current) {
            const toolMap = {
                'pen': 'freedraw' as const,
                'eraser': 'eraser' as const,
                'text': 'text' as const
            };
            excalidrawRef.current.setActiveTool(toolMap[tool]);
        }
    }, []);

    // Handle color change - update both local state and canvas
    const handleColorChange = useCallback((colorName: string) => {
        setActiveColor(colorName);
        const color = COLORS.find(c => c.name === colorName);
        if (color && excalidrawRef.current) {
            excalidrawRef.current.setStrokeColor(color.hex);
        }
    }, []);

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
                const response = await startFeynmanTutorSession(topic, (chunk) => {
                    setStreamingContent(prev => prev + chunk);
                });

                const assistantMessage: TutorChatMessage = {
                    role: 'assistant',
                    content: response.assistant_message_md,
                    timestamp: new Date(),
                    tutor_response: response
                };

                setMessages([assistantMessage]);
                setStreamingContent('');
                setSessionState(prev => updateSessionState(prev, response));
                setIsTeachBackMode(true);
            } catch (error) {
                console.error('Failed to start Feynman session:', error);
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
        setThinkingContent('');
        setIsThinking(true);
        setIsThinkingExpanded(true);

        if (isTeachBackMode) {
            setTeachBackAttempts(prev => prev + 1);
        }

        try {
            const response = await generateFeynmanResponse(
                userMessage.content,
                currentTopic,
                messages,
                isTeachBackMode,
                (chunk) => {
                    setIsThinking(false);
                    setIsThinkingExpanded(false);
                    setStreamingContent(prev => prev + chunk);
                },
                (thought) => {
                    setThinkingContent(prev => prev + thought);
                }
            );

            const assistantMessage: TutorChatMessage = {
                role: 'assistant',
                content: response.assistant_message_md,
                timestamp: new Date(),
                tutor_response: response,
                gap_map: response.gap_map
            };

            setMessages(prev => [...prev, assistantMessage]);
            setStreamingContent('');
            setSessionState(prev => updateSessionState(prev, response));

            if (response.gap_map) {
                setGapMaps(prev => [...prev, response.gap_map!]);
            }

            // Extract questions/tasks from AI response to update TaskPanel
            const extractedTasks: TaskItem[] = [];
            const content = response.assistant_message_md;

            // Look for questions (sentences ending with ?)
            const questionMatches = content.match(/[^.!?]*\?/g) || [];
            questionMatches.slice(0, 3).forEach((q, i) => {
                const trimmedQ = q.trim();
                if (trimmedQ.length > 10 && trimmedQ.length < 200) {
                    extractedTasks.push({
                        id: `q-${Date.now()}-${i}`,
                        text: trimmedQ,
                        type: 'question',
                    });
                }
            });

            // Look for action items (try to, explain, tell me, etc.)
            const actionPatterns = [
                /try to ([^.!?]+)/gi,
                /explain ([^.!?]+)/gi,
                /tell me ([^.!?]+)/gi,
                /describe ([^.!?]+)/gi,
            ];
            actionPatterns.forEach(pattern => {
                const matches = content.match(pattern);
                if (matches && matches.length > 0) {
                    extractedTasks.push({
                        id: `a-${Date.now()}-${Math.random()}`,
                        text: matches[0].trim(),
                        type: 'action',
                    });
                }
            });

            // Update tasks if we found any, otherwise keep a default
            if (extractedTasks.length > 0) {
                setCurrentTasks(extractedTasks.slice(0, 3)); // Max 3 tasks
            }

            // Update Feynman progress stages based on interaction
            // Move to teach-back stage after first interaction
            if (currentStage === 'introduction' && teachBackAttempts > 0) {
                setCompletedStages(prev => [...prev, 'introduction']);
                setCurrentStage('teach-back');
            }

            // Move to gap-analysis when gaps are identified
            if (response.gap_map && response.gap_map.priority_gaps && response.gap_map.priority_gaps.length > 0) {
                setGapsIdentified(prev => prev + response.gap_map!.priority_gaps.length);
                if (currentStage === 'teach-back') {
                    setCompletedStages(prev => [...prev, 'teach-back']);
                    setCurrentStage('gap-analysis');
                }
            }

            // Move to mastery when understanding is demonstrated (no new gaps)
            const isGoodResponse = content.toLowerCase().includes('excellent') ||
                content.toLowerCase().includes('great job') ||
                content.toLowerCase().includes('well done') ||
                content.toLowerCase().includes('exactly right') ||
                content.toLowerCase().includes('correct') ||
                content.toLowerCase().includes('perfect');

            if (isGoodResponse) {
                // Increment mastery score
                setMasteryScore(prev => Math.min(prev + 15, 100));
                setConceptsCleared(prev => Math.min(prev + 1, totalConcepts));
                setInsightsGained(prev => prev + 1);

                // Mark next uncompleted concept as cleared
                setConceptsList(prev => {
                    const firstUnclearedIndex = prev.findIndex(c => !c.cleared);
                    if (firstUnclearedIndex !== -1) {
                        const updated = [...prev];
                        updated[firstUnclearedIndex] = { ...updated[firstUnclearedIndex], cleared: true, timestamp: new Date() };
                        return updated;
                    }
                    return prev;
                });

                // Add insight to list
                const insightText = content.match(/[^.!?]*(?:understand|grasp|correct|excellent)[^.!?]*/i)?.[0]?.trim();
                if (insightText && insightText.length > 10) {
                    setInsightsList(prev => [...prev, {
                        id: `insight-${Date.now()}`,
                        text: insightText.substring(0, 100),
                        timestamp: new Date()
                    }]);
                }

                if (currentStage === 'gap-analysis') {
                    setGapsResolved(prev => prev + 1);

                    // Mark a misconception as resolved
                    setMisconceptionsList(prev => {
                        const firstUnresolved = prev.findIndex(m => !m.resolved);
                        if (firstUnresolved !== -1) {
                            const updated = [...prev];
                            updated[firstUnresolved] = { ...updated[firstUnresolved], resolved: true };
                            return updated;
                        }
                        return prev;
                    });

                    // Check if most gaps resolved
                    if (gapsResolved >= gapsIdentified - 1) {
                        setCompletedStages(prev => [...prev, 'gap-analysis']);
                        setCurrentStage('mastery');
                        setMasteryScore(100); // Full mastery achieved
                    }
                }
            } else {
                // Still learning - small progress
                setMasteryScore(prev => Math.min(prev + 5, 85)); // Cap at 85 until good response
            }

            // Extract and track misconceptions from gap_map
            if (response.gap_map?.priority_gaps) {
                response.gap_map.priority_gaps.forEach((gap: string) => {
                    const exists = misconceptionsList.some(m => m.text.toLowerCase() === gap.toLowerCase());
                    if (!exists && gap.length > 5) {
                        setMisconceptionsList(prev => [...prev, {
                            id: `gap-${Date.now()}-${Math.random()}`,
                            text: gap,
                            resolved: false,
                            timestamp: new Date()
                        }]);
                    }
                });
            }

            // Auto-generate diagram if AI suggests it
            const tutorPolicy = response.tutor_policy as any;
            if (tutorPolicy?.should_draw_diagram && excalidrawRef.current) {
                console.log('[Feynman] AI suggested drawing diagram');
                const diagramTopic = tutorPolicy.diagram_topic || currentTopic;
                const recentContext = messages.slice(-2).map(m => `${m.role}: ${m.content}`).join('\n');
                try {
                    const mermaidSyntax = await generateMermaidDiagram(diagramTopic, recentContext);
                    await excalidrawRef.current.drawMermaid(mermaidSyntax);
                } catch (diagErr) {
                    console.error('[Feynman] Auto-diagram failed:', diagErr);
                }
            }
        } catch (error) {
            console.error('Failed to generate response:', error);
        } finally {
            setIsLoading(false);
        }
    };

    // Handle key press
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    // Handle canvas drawing submission
    const handleSubmitDrawing = async () => {
        if (!excalidrawRef.current || isLoading) return;

        setIsLoading(true);
        try {
            const imageData = await excalidrawRef.current.exportToImage();
            if (!imageData) {
                console.error('Failed to export drawing');
                return;
            }

            const userMessage: TutorChatMessage = {
                role: 'user',
                content: '[Submitted a visual explanation]',
                timestamp: new Date()
            };
            setMessages(prev => [...prev, userMessage]);

            const drawingContext = `The learner has submitted a visual explanation/diagram for the topic "${topic}". Please evaluate their visual representation and provide feedback.`;

            const response = await generateFeynmanResponse(
                drawingContext,
                topic,
                messages,
                isTeachBackMode,
                (chunk: string) => setStreamingContent(prev => prev + chunk)
            );

            const assistantMessage: TutorChatMessage = {
                role: 'assistant',
                content: response.assistant_message_md,
                timestamp: new Date(),
                tutor_response: response
            };

            setMessages(prev => [...prev, assistantMessage]);
            setStreamingContent('');
        } catch (error) {
            console.error('Failed to analyze drawing:', error);
        } finally {
            setIsLoading(false);
        }
    };

    // Topic editing handlers
    const handleSaveTopic = useCallback(() => {
        if (editTopicValue.trim()) {
            setCurrentTopic(editTopicValue.trim());
            setIsEditingTopic(false);
            // Optionally restart session with new topic
            handleClearSession();
        }
    }, [editTopicValue]);

    const handleCancelEdit = useCallback(() => {
        setEditTopicValue(currentTopic);
        setIsEditingTopic(false);
    }, [currentTopic]);

    // Document upload handler
    const handleDocumentUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        let content = '';
        try {
            const extracted = await extractTextFromDocument(file);
            content = extracted.text || '';
        } catch (error) {
            console.warn('[FeynmanLearningMode] Failed to extract document text, falling back to raw text.', error);
            content = await file.text();
        }

        setUploadedDocument({ name: file.name, content });
        addFileToSourceLibrary(file, { content }).catch((error) => {
            console.warn('[FeynmanLearningMode] Failed to add source to library:', error);
        });

        // Add context message about the uploaded document
        const contextMessage: TutorChatMessage = {
            role: 'user',
            content: `I've uploaded a document "${file.name}" to help with my explanation. Here's the content:\n\n${content.substring(0, 2000)}${content.length > 2000 ? '...(truncated)' : ''}`,
            timestamp: new Date()
        };
        setMessages(prev => [...prev, contextMessage]);

        // Get AI response about the document
        setIsLoading(true);
        try {
            const response = await generateFeynmanResponse(
                `The learner uploaded a document titled "${file.name}". Please acknowledge it and ask them to explain what they understand from it.`,
                currentTopic,
                messages,
                isTeachBackMode,
                (chunk: string) => setStreamingContent(prev => prev + chunk)
            );
            const assistantMessage: TutorChatMessage = {
                role: 'assistant',
                content: response.assistant_message_md,
                timestamp: new Date(),
                tutor_response: response
            };
            setMessages(prev => [...prev, assistantMessage]);
            setStreamingContent('');
        } catch (error) {
            console.error('Failed to process document:', error);
        } finally {
            setIsLoading(false);
        }
    }, [currentTopic, messages, isTeachBackMode]);

    // Clear session and canvas
    const handleClearSession = useCallback(() => {
        setMessages([]);
        setStreamingContent('');
        setGapMaps([]);
        setTeachBackAttempts(0);
        setUploadedDocument(null);
        setThinkingContent('');
        if (excalidrawRef.current) {
            excalidrawRef.current.clearCanvas();
        }
    }, []);

    // Generate and show Mermaid diagram on canvas
    const handleShowDiagram = useCallback(async () => {
        if (!excalidrawRef.current) return;

        setIsLoading(true);
        try {
            // Get recent conversation context
            const recentContext = messages.slice(-3).map(m => `${m.role}: ${m.content}`).join('\n');

            // Generate Mermaid diagram
            const mermaidSyntax = await generateMermaidDiagram(currentTopic, recentContext);
            console.log('[Feynman] Generated Mermaid:', mermaidSyntax);

            // Draw on canvas
            await excalidrawRef.current.drawMermaid(mermaidSyntax);

            // Add system message about the diagram
            const diagramMessage: TutorChatMessage = {
                role: 'assistant',
                content: `I've generated a visual diagram on the canvas to help explain **${currentTopic}**. Take a look and try to explain what each part represents!`,
                timestamp: new Date()
            };
            setMessages(prev => [...prev, diagramMessage]);
        } catch (error) {
            console.error('Failed to generate diagram:', error);
        } finally {
            setIsLoading(false);
        }
    }, [currentTopic, messages]);

    // Generate AI image and insert onto canvas
    const [isGeneratingImage, setIsGeneratingImage] = useState(false);
    const handleGenerateImage = useCallback(async () => {
        if (!excalidrawRef.current) return;

        setIsGeneratingImage(true);
        try {
            // Build prompt based on topic and conversation context
            const recentContext = messages.slice(-2).map(m => m.content).join(' ').substring(0, 200);
            const prompt = `Create a simple, clean educational diagram for: ${currentTopic}. 
Style: Simple line drawing on plain white background. NO frames, NO boards, NO decorative borders. 
Just the diagram itself with clear labels. Technical illustration style.
Context: ${recentContext}`;

            console.log('[Feynman] Generating image with prompt:', prompt);
            const success = await excalidrawRef.current.generateAndInsertImage(prompt, { model: 'nano-banana-pro' });

            if (success) {
                const imgMessage: TutorChatMessage = {
                    role: 'assistant',
                    content: `I've generated an AI image on the canvas to help visualize **${currentTopic}**. What do you notice about it?`,
                    timestamp: new Date()
                };
                setMessages(prev => [...prev, imgMessage]);
            }
        } catch (error) {
            console.error('Failed to generate image:', error);
        } finally {
            setIsGeneratingImage(false);
        }
    }, [currentTopic, messages]);

    // If classroom mode is selected, render ClassroomSimulation
    if (feynmanSubMode === 'classroom') {
        return (
            <ClassroomSimulation
                topic={currentTopic}
                onBack={() => setFeynmanSubMode('tutor')}
                apiKey={voiceChatApiKey}
            />
        );
    }

    return (
        <div className="flex flex-col h-screen w-full bg-white overflow-hidden">
            {/* Header Bar - Clean minimal design */}
            <header className="flex-shrink-0 flex items-center justify-between px-4 py-2 border-b border-gray-200 bg-white">
                <div className="flex items-center gap-4">
                    <button
                        onClick={onBack}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <Menu className="w-5 h-5 text-gray-600" />
                    </button>
                    <span className="text-base font-medium text-gray-800">
                        Feynman Mode
                    </span>

                    {/* Mode Toggle */}
                    <div className="flex bg-gray-100 rounded-lg p-0.5 ml-2">
                        <button
                            onClick={() => setFeynmanSubMode('tutor')}
                            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${feynmanSubMode === 'tutor'
                                ? 'bg-white text-gray-800 shadow-sm'
                                : 'text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            Tutor
                        </button>
                        <button
                            onClick={() => setFeynmanSubMode('classroom')}
                            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${feynmanSubMode === 'classroom'
                                ? 'bg-white text-gray-800 shadow-sm'
                                : 'text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            Classroom
                        </button>
                    </div>
                </div>

                {/* Progress Bar - Center */}
                <div className="flex-1 max-w-md mx-4">
                    <div className="flex items-center gap-2">
                        {['introduction', 'teach-back', 'gap-analysis', 'mastery'].map((stage, i) => (
                            <React.Fragment key={stage}>
                                <div
                                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${completedStages.includes(stage as FeynmanStage)
                                        ? 'bg-green-500 text-white'
                                        : currentStage === stage
                                            ? 'bg-blue-500 text-white'
                                            : 'bg-gray-200 text-gray-400'
                                        }`}
                                    title={stage.replace('-', ' ')}
                                >
                                    {i + 1}
                                </div>
                                {i < 3 && (
                                    <div className={`flex-1 h-1 rounded ${completedStages.includes(stage as FeynmanStage) ? 'bg-green-400' : 'bg-gray-200'
                                        }`} />
                                )}
                            </React.Fragment>
                        ))}
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleClearSession}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-1 text-gray-600 text-sm"
                        title="Clear session and canvas"
                    >
                        <RotateCcw className="w-4 h-4" />
                        <span className="hidden sm:inline">Reset</span>
                    </button>
                    <button className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden">
                        <User className="w-5 h-5 text-gray-500" />
                    </button>
                </div>
            </header>

            {/* Main Split Layout */}
            <div className="flex flex-1 overflow-hidden">

                {/* Left: Canvas Area (~70%) */}
                <div className="flex-[7] flex flex-col min-w-0 overflow-hidden">
                    {/* Topic Title - Editable */}
                    <div className="flex-shrink-0 px-6 pt-4 pb-2">
                        {isEditingTopic ? (
                            <div className="flex items-center gap-2">
                                <span className="text-2xl font-bold text-gray-900">Explain "</span>
                                <input
                                    type="text"
                                    value={editTopicValue}
                                    onChange={(e) => setEditTopicValue(e.target.value)}
                                    className="text-2xl font-bold text-blue-600 border-b-2 border-blue-500 bg-transparent outline-none px-1"
                                    autoFocus
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleSaveTopic();
                                        if (e.key === 'Escape') handleCancelEdit();
                                    }}
                                />
                                <span className="text-2xl font-bold text-gray-900">" simply</span>
                                <button onClick={handleSaveTopic} className="p-1 hover:bg-green-100 rounded text-green-600">
                                    <Check className="w-5 h-5" />
                                </button>
                                <button onClick={handleCancelEdit} className="p-1 hover:bg-red-100 rounded text-red-600">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-3">
                                <h1 className="text-2xl font-bold text-gray-900">
                                    Explain "<span className="text-blue-600" style={{ textDecoration: 'underline', textDecorationColor: '#3b82f6', textUnderlineOffset: '4px' }}>{currentTopic}</span>" simply
                                </h1>
                                <button
                                    onClick={() => setIsEditingTopic(true)}
                                    className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                                    title="Change topic"
                                >
                                    <Edit3 className="w-4 h-4 text-gray-500" />
                                </button>
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-1"
                                    title="Upload study material"
                                >
                                    <Upload className="w-4 h-4 text-gray-500" />
                                </button>
                                {uploadedDocument && (
                                    <span className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs">
                                        <FileText className="w-3 h-3" />
                                        {uploadedDocument.name}
                                    </span>
                                )}
                            </div>
                        )}
                        {/* Hidden file input */}
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".pdf,.txt,.md,.doc,.docx"
                            onChange={handleDocumentUpload}
                            className="hidden"
                        />
                    </div>

                    {/* Canvas Area - Clean white background */}
                    <div className="flex-1 relative bg-white mx-4 min-h-0 overflow-hidden">
                        {/* Task Overlay - Positioned on canvas */}
                        {currentTasks.length > 0 && currentTasks[0] && !currentTasks[0].completed && (
                            <div className="absolute top-4 left-4 z-10 max-w-md">
                                <div className="bg-white rounded-xl border-2 border-blue-200 shadow-lg p-4">
                                    <div className="flex items-start gap-3">
                                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center flex-shrink-0">
                                            <Target className="w-4 h-4 text-white" />
                                        </div>
                                        <div className="flex-1">
                                            <div className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-1">
                                                Your Task
                                            </div>
                                            <p className="text-sm text-gray-800 leading-relaxed">
                                                {currentTasks[0].text}
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => setCurrentTasks(prev =>
                                                prev.map(t => t.id === currentTasks[0].id ? { ...t, completed: true } : t)
                                            )}
                                            className="px-3 py-1.5 bg-green-500 text-white text-xs font-medium rounded-full hover:bg-green-600 transition-colors flex-shrink-0"
                                        >
                                            Done
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        <ExcalidrawCanvas
                            ref={excalidrawRef}
                            isOpen={true}
                            onClose={() => { }}
                            embedded={true}
                            className="w-full h-full"
                        />
                    </div>

                    {/* Drawing Toolbar - Bottom of canvas, matching reference */}
                    <div className="flex-shrink-0 flex items-center justify-center gap-6 py-3 px-4 bg-white border-t border-gray-100">
                        {/* Drawing Tools - Dark pill */}
                        <div className="flex items-center gap-1 bg-gray-800 rounded-full px-3 py-2">
                            <button
                                onClick={() => handleToolChange('pen')}
                                className={`p-2 rounded-full transition-colors ${activeTool === 'pen' ? 'bg-gray-600' : 'hover:bg-gray-700'
                                    }`}
                            >
                                <Pencil className="w-5 h-5 text-white" />
                            </button>
                            <button
                                onClick={() => handleToolChange('eraser')}
                                className={`p-2 rounded-full transition-colors ${activeTool === 'eraser' ? 'bg-gray-600' : 'hover:bg-gray-700'
                                    }`}
                            >
                                <Eraser className="w-5 h-5 text-white" />
                            </button>
                            <button
                                onClick={() => handleToolChange('text')}
                                className={`p-2 rounded-full transition-colors ${activeTool === 'text' ? 'bg-gray-600' : 'hover:bg-gray-700'
                                    }`}
                            >
                                <MessageSquare className="w-5 h-5 text-white" />
                            </button>
                        </div>

                        {/* Color Palette */}
                        <div className="flex items-center gap-2">
                            {COLORS.map(color => (
                                <button
                                    key={color.name}
                                    onClick={() => handleColorChange(color.name)}
                                    className={`w-8 h-8 rounded-full transition-all ${activeColor === color.name
                                        ? 'ring-2 ring-offset-2 ring-gray-400 scale-110'
                                        : 'hover:scale-105'
                                        }`}
                                    style={{ backgroundColor: color.hex }}
                                />
                            ))}
                        </div>

                        {/* Record Button - Red pill style */}
                        <button
                            onClick={() => setIsRecording(!isRecording)}
                            className={`flex items-center gap-2 px-5 py-2.5 rounded-full transition-colors ${isRecording
                                ? 'bg-red-600 text-white'
                                : 'bg-red-500 text-white hover:bg-red-600'
                                }`}
                        >
                            <Circle className={`w-3 h-3 ${isRecording ? 'fill-white animate-pulse' : 'fill-white'}`} />
                            <span className="text-sm font-medium">
                                {isRecording ? 'Stop' : 'Record Explanation'}
                            </span>
                        </button>

                        {/* Share to Chat Button */}
                        <button
                            onClick={handleSubmitDrawing}
                            disabled={isLoading}
                            className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 transition-colors"
                        >
                            <Share2 className="w-4 h-4" />
                            <span className="text-sm font-medium">
                                {isLoading ? 'Sharing...' : 'Share to Chat'}
                            </span>
                        </button>

                        {/* Show Diagram Button */}
                        <button
                            onClick={handleShowDiagram}
                            disabled={isLoading}
                            className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-purple-500 text-white hover:bg-purple-600 disabled:opacity-50 transition-colors"
                        >
                            <GitBranch className="w-4 h-4" />
                            <span className="text-sm font-medium">
                                {isLoading ? 'Generating...' : 'Show Diagram'}
                            </span>
                        </button>

                        {/* Generate Image Button */}
                        <button
                            onClick={handleGenerateImage}
                            disabled={isGeneratingImage}
                            className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-pink-500 to-orange-500 text-white hover:from-pink-600 hover:to-orange-600 disabled:opacity-50 transition-all"
                        >
                            <ImagePlus className="w-4 h-4" />
                            <span className="text-sm font-medium">
                                {isGeneratingImage ? 'Creating...' : 'Generate Image'}
                            </span>
                        </button>
                    </div>
                </div>

                {/* Right: Chat Panel (~30%) */}
                <div className="flex-[3] flex flex-col bg-gray-50 border-l border-gray-200 min-w-[300px] max-w-[400px] relative">
                    {/* Tutor Header */}
                    <div className="flex items-center justify-between p-4 bg-white border-b border-gray-200">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
                                <span className="text-white text-sm font-bold">FT</span>
                            </div>
                            <span className="font-semibold text-gray-800">Feynman Tutor</span>
                        </div>
                        <button className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                            <MoreHorizontal className="w-5 h-5 text-gray-400" />
                        </button>
                    </div>

                    {/* Learning Score Card */}
                    <div className="p-3 border-b border-gray-200 bg-gray-50">
                        <LearningScoreCard
                            masteryScore={masteryScore}
                            conceptsCleared={conceptsCleared}
                            totalConcepts={totalConcepts}
                            misconceptionsFound={gapsIdentified}
                            misconceptionsResolved={gapsResolved}
                            insightsGained={insightsGained}
                            misconceptionsList={misconceptionsList}
                            conceptsList={conceptsList}
                            insightsList={insightsList}
                            isLoading={isLoading}
                        />
                    </div>

                    {/* Messages Area */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {/* Collapsible Reasoning/Thinking Component */}
                        {(thinkingContent || isThinking) && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-xl overflow-hidden"
                            >
                                <button
                                    onClick={() => setIsThinkingExpanded(!isThinkingExpanded)}
                                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-purple-100/50 transition-colors"
                                >
                                    <div className="flex items-center gap-2">
                                        <Brain className={`w-4 h-4 text-purple-600 ${isThinking ? 'animate-pulse' : ''}`} />
                                        <span className="text-sm font-medium text-purple-700">
                                            {isThinking ? 'Thinking...' : 'Thought process'}
                                        </span>
                                        {isThinking && (
                                            <span className="flex gap-1">
                                                <span className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                                <span className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                                <span className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                            </span>
                                        )}
                                    </div>
                                    {isThinkingExpanded ? (
                                        <ChevronUp className="w-4 h-4 text-purple-500" />
                                    ) : (
                                        <ChevronDown className="w-4 h-4 text-purple-500" />
                                    )}
                                </button>
                                <AnimatePresence>
                                    {isThinkingExpanded && thinkingContent && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            className="px-4 pb-3"
                                        >
                                            <pre className="text-xs text-purple-800 whitespace-pre-wrap font-mono bg-white/60 rounded-lg p-3 max-h-40 overflow-y-auto">
                                                {thinkingContent}
                                            </pre>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </motion.div>
                        )}

                        {messages.map((message, index) => (
                            <motion.div
                                key={index}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                                {message.role === 'assistant' ? (
                                    <div className="max-w-[90%] space-y-2">
                                        <div className="bg-white p-4 rounded-2xl rounded-tl-sm shadow-sm text-gray-800">
                                            <div className="prose prose-sm max-w-none">
                                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                    {message.content}
                                                </ReactMarkdown>
                                            </div>
                                        </div>
                                        {/* Feedback chip - teal/green style like reference */}
                                        {message.content.toLowerCase().includes('good') && (
                                            <span className="inline-block px-3 py-1 bg-teal-500 text-white text-sm rounded-full">
                                                Good analogy!
                                            </span>
                                        )}
                                    </div>
                                ) : (
                                    <div className="max-w-[85%] bg-blue-500 text-white p-3 px-4 rounded-2xl rounded-tr-sm shadow-sm">
                                        <p className="text-sm">{message.content}</p>
                                    </div>
                                )}
                            </motion.div>
                        ))}

                        {/* Streaming content */}
                        {streamingContent && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="flex justify-start"
                            >
                                <div className="max-w-[90%] bg-white p-4 rounded-2xl rounded-tl-sm shadow-sm">
                                    <div className="prose prose-sm max-w-none text-gray-800">
                                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                            {streamingContent}
                                        </ReactMarkdown>
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {/* Loading indicator */}
                        {isLoading && !streamingContent && (
                            <div className="flex justify-start">
                                <div className="px-4 py-3 bg-white rounded-2xl rounded-tl-sm shadow-sm">
                                    <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                                </div>
                            </div>
                        )}

                        <div ref={messagesEndRef} />
                    </div>

                    {/* Slim Task Indicator - Above input */}
                    {currentTasks.length > 0 && currentTasks[0] && !currentTasks[0].completed && (
                        <div className="px-4 py-2 bg-gradient-to-r from-blue-50 to-purple-50 border-t border-blue-100">
                            <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
                                    <Target className="w-3 h-3 text-white" />
                                </div>
                                <span className="text-sm text-gray-700 truncate flex-1">
                                    <span className="font-medium text-blue-600">Task:</span> {currentTasks[0].text.substring(0, 80)}{currentTasks[0].text.length > 80 ? '...' : ''}
                                </span>
                                <button
                                    onClick={() => setCurrentTasks(prev => prev.map(t => t.id === currentTasks[0].id ? { ...t, completed: true } : t))}
                                    className="text-xs px-2 py-1 bg-green-500 text-white rounded-full hover:bg-green-600 transition-colors"
                                >
                                    Done
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Input Area */}
                    <div className="p-4 bg-white border-t border-gray-200">
                        <div className="flex items-center gap-2">
                            <input
                                ref={inputRef}
                                type="text"
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Type your explanation..."
                                className="flex-1 px-4 py-3 rounded-full border border-gray-200 bg-gray-50 text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                disabled={isLoading}
                            />
                            <button
                                onClick={handleSendMessage}
                                disabled={!inputValue.trim() || isLoading}
                                className="p-3 bg-blue-500 text-white rounded-full hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                <Send className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* Large Floating Mic Button - Prominent blue circle */}
                    <button
                        onClick={handleVoiceChatToggle}
                        disabled={!voiceChatApiKey}
                        className={`absolute bottom-28 right-6 w-16 h-16 rounded-full shadow-xl transition-all flex items-center justify-center ${geminiLive.connectionState === 'CONNECTED'
                            ? 'bg-green-500 hover:bg-green-600'
                            : geminiLive.connectionState === 'CONNECTING'
                                ? 'bg-yellow-500'
                                : 'bg-blue-500 hover:bg-blue-600'
                            } disabled:opacity-50`}
                    >
                        {geminiLive.connectionState === 'CONNECTED' ? (
                            geminiLive.isListening ? (
                                <Mic className="w-7 h-7 text-white animate-pulse" />
                            ) : geminiLive.isSpeaking ? (
                                <Volume2 className="w-7 h-7 text-white animate-pulse" />
                            ) : (
                                <MicOff className="w-7 h-7 text-white" />
                            )
                        ) : geminiLive.connectionState === 'CONNECTING' ? (
                            <Loader2 className="w-7 h-7 text-white animate-spin" />
                        ) : (
                            <Mic className="w-7 h-7 text-white" />
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default FeynmanLearningMode;
