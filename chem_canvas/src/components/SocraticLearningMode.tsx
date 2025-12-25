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
    generateVisualExplanation,
    generateDiagramElements,
    generateInteractiveContent
} from '../services/socraticFeynmanTutorService';
import { ExcalidrawCanvas, ExcalidrawCanvasRef, DiagramElement } from './ExcalidrawCanvas/ExcalidrawCanvas';
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
}

export const SocraticLearningMode: React.FC<SocraticLearningModeProps> = ({
    topic,
    onBack,
    onSwitchToFeynman
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

    // Refs
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const excalidrawRef = useRef<ExcalidrawCanvasRef>(null);

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
                const response = await startSocraticSession(topic, (chunk) => {
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
                sessionState.attempt_count,
                (chunk) => {
                    setStreamingContent(prev => prev + chunk);
                }
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

    // Handle AI drawing explanation on canvas
    const handleShowOnCanvas = async () => {
        if (!excalidrawRef.current) return;

        // Get the last assistant message as context
        const lastAssistantMessage = [...messages].reverse().find(m => m.role === 'assistant');
        const context = lastAssistantMessage?.content || `Explain ${topic}`;

        setIsLoading(true);
        setIsCanvasOpen(true);

        // Clear canvas for fresh explanation
        excalidrawRef.current.clearCanvas();

        try {
            // Generate and draw diagram elements
            const diagramData = await generateDiagramElements(topic, context);

            // Draw the actual shapes first (they have specific positions)
            if (diagramData.elements.length > 0) {
                await excalidrawRef.current.drawDiagram(diagramData.elements as DiagramElement[]);
            }

            // Start a new text section below diagrams
            excalidrawRef.current.startNewSection();

            // Generate the complete explanation (no streaming to avoid overlap)
            const explanation = await generateVisualExplanation(topic, context);

            // Write the complete explanation as one block
            await excalidrawRef.current.addHandwrittenText(
                `═══ ${topic.toUpperCase()} ═══\n\n` +
                diagramData.text + '\n\n' +
                explanation
            );

        } catch (error) {
            console.error('Failed to generate visual explanation:', error);
        } finally {
            setIsLoading(false);
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

    const handleQuizComplete = async (success: boolean, quizQuestion?: string) => {
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
                                    disabled={isLoading}
                                    className="p-1.5 hover:bg-gray-100 rounded"
                                    title="Show on Canvas"
                                >
                                    <Palette className="w-4 h-4 text-gray-500" />
                                </button>
                                <div className="w-7 h-7 rounded-full bg-emerald-600 flex items-center justify-center">
                                    <User className="w-4 h-4 text-white" />
                                </div>
                            </div>
                        </div>

                        {/* Messages Area */}
                        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                            {messages.map((message, index) => (
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

                                                    {/* Embedded Interactive Content */}
                                                    {message.interactive_content && (
                                                        <div className="mt-4 not-prose">
                                                            {message.interactive_content.flashcards && message.interactive_content.flashcards.length > 0 && (
                                                                <div className="bg-white rounded-xl border border-indigo-100 shadow-sm overflow-hidden p-2">
                                                                    <div className="text-xs font-bold text-indigo-500 uppercase tracking-wider px-4 py-2">
                                                                        Flashcards
                                                                    </div>
                                                                    <div className="h-[350px]">
                                                                        <FlashcardDeck cards={message.interactive_content.flashcards} />
                                                                    </div>
                                                                </div>
                                                            )}

                                                            {message.interactive_content.quiz && (
                                                                <div className="max-w-md mx-auto">
                                                                    <QuizPanel
                                                                        quiz={message.interactive_content.quiz}
                                                                        onComplete={(success) => handleQuizComplete(success, message.interactive_content?.quiz?.question)}
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
                                                                    onComplete={(success) => handleQuizComplete(success, message.interactive_content?.fill_blank?.sentence)}
                                                                />
                                                            )}

                                                            {message.interactive_content.matching && (
                                                                <MatchingActivity
                                                                    activity={message.interactive_content.matching}
                                                                    onComplete={(success) => handleQuizComplete(success, message.interactive_content?.matching?.title)}
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
                            ))}

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
                                        <div className="px-4 py-2.5 bg-white rounded-2xl rounded-bl-md shadow-sm">
                                            <Loader2 className="w-4 h-4 text-emerald-500 animate-spin" />
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
