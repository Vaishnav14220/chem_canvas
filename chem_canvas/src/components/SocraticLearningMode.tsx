/**
 * Socratic Learning Mode Component
 * 
 * Implements guided discovery through questioning with a hint ladder (L0-L4).
 * Based on the localhost:3000/docs specification.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
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
    Loader2,
    HelpCircle,
    Sparkles,
    Target,
    PenTool,
    Pencil,
    Palette,
    Mic,
    MicOff,
    Volume2
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
    TutorResponse,
    TutorChatMessage,
    TutorSessionState,
    HintLevel,
    HINT_LEVEL_LABELS,
    HINT_LEVEL_DESCRIPTIONS
} from '../types/tutorTypes';
import {
    generateSocraticResponse,
    startSocraticSession,
    createSessionState,
    updateSessionState,
    checkAutoModeSwitch,
    analyzeDrawingForSocratic,
    generateVisualExplanation,
    generateDiagramElements
} from '../services/socraticFeynmanTutorService';
import { ExcalidrawCanvas, ExcalidrawCanvasRef, DiagramElement } from './ExcalidrawCanvas/ExcalidrawCanvas';
import { useGeminiLive } from './GeminiLive/hooks/useGeminiLive';
import { getSharedGeminiApiKey } from '../firebase/apiKeys';

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

            const assistantMessage: TutorChatMessage = {
                role: 'assistant',
                content: response.assistant_message_md,
                timestamp: new Date(),
                tutor_response: response
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
    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

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

    // Render hint level indicator
    const renderHintLevelIndicator = () => {
        const levels: HintLevel[] = [0, 1, 2, 3, 4];

        return (
            <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                <HelpCircle className="w-4 h-4 text-blue-500" />
                <span className="text-xs text-slate-600 dark:text-slate-400 mr-2">Hint Level:</span>
                <div className="flex gap-1">
                    {levels.map((level) => (
                        <motion.div
                            key={level}
                            className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium transition-colors ${level <= sessionState.hint_level
                                ? 'bg-blue-500 text-white'
                                : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                                }`}
                            initial={false}
                            animate={{
                                scale: level === sessionState.hint_level ? 1.1 : 1,
                            }}
                            title={`L${level}: ${HINT_LEVEL_LABELS[level]} - ${HINT_LEVEL_DESCRIPTIONS[level]}`}
                        >
                            {level}
                        </motion.div>
                    ))}
                </div>
                <span className="text-xs text-slate-500 dark:text-slate-400 ml-2">
                    {HINT_LEVEL_LABELS[sessionState.hint_level]}
                </span>
            </div>
        );
    };

    // Render evaluation panel
    const renderEvaluationPanel = () => {
        if (!lastEvaluation || !showEvaluation) return null;

        const { scores, detected_misconceptions, missing_key_ideas, correct_points } = lastEvaluation;

        return (
            <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mx-4 mb-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700"
            >
                <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
                        <Target className="w-4 h-4" />
                        Your Progress
                    </h4>
                    <button
                        onClick={() => setShowEvaluation(false)}
                        className="text-slate-400 hover:text-slate-600"
                    >
                        <XCircle className="w-4 h-4" />
                    </button>
                </div>

                {/* Scores */}
                <div className="grid grid-cols-3 gap-3 mb-4">
                    {Object.entries(scores).map(([key, value]) => (
                        <div key={key} className="text-center">
                            <div className="text-lg font-bold text-slate-700 dark:text-slate-200">{value}%</div>
                            <div className="text-xs text-slate-500 capitalize">{key}</div>
                        </div>
                    ))}
                </div>

                {/* Correct Points */}
                {correct_points && correct_points.length > 0 && (
                    <div className="mb-3">
                        <div className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 mb-1">
                            <CheckCircle2 className="w-3 h-3" />
                            <span className="font-medium">What you got right:</span>
                        </div>
                        <ul className="text-xs text-slate-600 dark:text-slate-400 pl-4 space-y-1">
                            {correct_points.map((point, i) => (
                                <li key={i}>• {point}</li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* Misconceptions */}
                {detected_misconceptions.length > 0 && (
                    <div className="mb-3">
                        <div className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 mb-1">
                            <AlertTriangle className="w-3 h-3" />
                            <span className="font-medium">Areas to review:</span>
                        </div>
                        <ul className="text-xs text-slate-600 dark:text-slate-400 pl-4 space-y-1">
                            {detected_misconceptions.map((m, i) => (
                                <li key={i}>• {m}</li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* Missing Ideas */}
                {missing_key_ideas.length > 0 && (
                    <div>
                        <div className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 mb-1">
                            <Lightbulb className="w-3 h-3" />
                            <span className="font-medium">Concepts to explore:</span>
                        </div>
                        <ul className="text-xs text-slate-600 dark:text-slate-400 pl-4 space-y-1">
                            {missing_key_ideas.map((idea, i) => (
                                <li key={i}>• {idea}</li>
                            ))}
                        </ul>
                    </div>
                )}
            </motion.div>
        );
    };

    return (
        <div className="flex flex-col h-full bg-white dark:bg-slate-900">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-800 dark:to-slate-800">
                <div className="flex items-center gap-3">
                    <button
                        onClick={onBack}
                        className="p-2 hover:bg-white/50 dark:hover:bg-slate-700/50 rounded-lg transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                    </button>
                    <div>
                        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                            <Sparkles className="w-5 h-5 text-blue-500" />
                            Socratic Learning
                        </h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            Topic: {topic}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {/* Canvas toggle */}
                    <button
                        onClick={() => setIsCanvasOpen(!isCanvasOpen)}
                        className={`px-3 py-1.5 text-sm rounded-lg transition-colors flex items-center gap-1 ${isCanvasOpen
                            ? 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300'
                            : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 hover:bg-slate-200'
                            }`}
                    >
                        <PenTool className="w-4 h-4" />
                        Draw
                    </button>

                    {/* Show on Canvas - AI draws explanation */}
                    <button
                        onClick={handleShowOnCanvas}
                        disabled={isLoading}
                        className="px-3 py-1.5 text-sm rounded-lg transition-colors flex items-center gap-1 bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30 text-purple-700 dark:text-purple-300 hover:from-purple-200 hover:to-pink-200 dark:hover:from-purple-900/50 dark:hover:to-pink-900/50 disabled:opacity-50"
                    >
                        <Palette className="w-4 h-4" />
                        {isLoading ? 'Drawing...' : 'Show on Canvas'}
                    </button>

                    {/* Voice Chat - Two-way audio with Gemini Live */}
                    <button
                        onClick={handleVoiceChatToggle}
                        disabled={!voiceChatApiKey}
                        className={`px-3 py-1.5 text-sm rounded-lg transition-colors flex items-center gap-1 ${geminiLive.connectionState === 'CONNECTED'
                            ? 'bg-gradient-to-r from-green-100 to-emerald-100 dark:from-green-900/30 dark:to-emerald-900/30 text-green-700 dark:text-green-300 ring-2 ring-green-400 ring-opacity-50'
                            : 'bg-gradient-to-r from-cyan-100 to-blue-100 dark:from-cyan-900/30 dark:to-blue-900/30 text-cyan-700 dark:text-cyan-300'
                            } disabled:opacity-50`}
                    >
                        {geminiLive.connectionState === 'CONNECTED' ? (
                            <>
                                {geminiLive.isListening ? (
                                    <Mic className="w-4 h-4 animate-pulse text-red-500" />
                                ) : geminiLive.isSpeaking ? (
                                    <Volume2 className="w-4 h-4 animate-pulse" />
                                ) : (
                                    <MicOff className="w-4 h-4" />
                                )}
                                {geminiLive.isListening ? 'Listening...' : geminiLive.isSpeaking ? 'Speaking...' : 'End Voice Chat'}
                            </>
                        ) : geminiLive.connectionState === 'CONNECTING' ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Connecting...
                            </>
                        ) : (
                            <>
                                <Mic className="w-4 h-4" />
                                Voice Chat
                            </>
                        )}
                    </button>

                    {/* Evaluation toggle */}
                    {lastEvaluation && (
                        <button
                            onClick={() => setShowEvaluation(!showEvaluation)}
                            className={`px-3 py-1.5 text-sm rounded-lg transition-colors flex items-center gap-1 ${showEvaluation
                                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 hover:bg-slate-200'
                                }`}
                        >
                            <Target className="w-4 h-4" />
                            Progress
                        </button>
                    )}
                </div>
            </div>

            {/* Hint Level Indicator */}
            <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-800">
                {renderHintLevelIndicator()}
            </div>

            {/* Evaluation Panel */}
            <AnimatePresence>
                {renderEvaluationPanel()}
            </AnimatePresence>

            {/* Mode Switch Suggestion */}
            <AnimatePresence>
                {modeSwitchSuggestion && onSwitchToFeynman && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="mx-4 mb-2 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800"
                    >
                        <p className="text-sm text-purple-700 dark:text-purple-300 mb-2">
                            {modeSwitchSuggestion}
                        </p>
                        <div className="flex gap-2">
                            <button
                                onClick={() => onSwitchToFeynman(topic)}
                                className="px-3 py-1 text-sm bg-purple-500 text-white rounded-lg hover:bg-purple-600"
                            >
                                Try Feynman Mode
                            </button>
                            <button
                                onClick={() => setModeSwitchSuggestion(null)}
                                className="px-3 py-1 text-sm bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-300"
                            >
                                Stay in Socratic
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                {messages.map((message, index) => (
                    <motion.div
                        key={index}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                        <div
                            className={`max-w-[80%] p-4 rounded-2xl ${message.role === 'user'
                                ? 'bg-blue-500 text-white rounded-br-md'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-bl-md'
                                }`}
                        >
                            {message.role === 'assistant' ? (
                                <div className="prose prose-sm dark:prose-invert max-w-none">
                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                        {message.content}
                                    </ReactMarkdown>
                                </div>
                            ) : (
                                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                            )}
                        </div>
                    </motion.div>
                ))}

                {/* Streaming content */}
                {streamingContent && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex justify-start"
                    >
                        <div className="max-w-[80%] p-4 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-bl-md">
                            <div className="prose prose-sm dark:prose-invert max-w-none">
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
                        <div className="px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-2xl rounded-bl-md">
                            <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="border-t border-slate-200 dark:border-slate-700 p-4 bg-slate-50 dark:bg-slate-800/50">
                <div className="flex items-end gap-2">
                    <textarea
                        ref={inputRef}
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Type your answer or question..."
                        className="flex-1 p-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                        rows={2}
                        disabled={isLoading}
                    />
                    <button
                        onClick={handleSendMessage}
                        disabled={!inputValue.trim() || isLoading}
                        className="p-3 bg-blue-500 text-white rounded-xl hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        <Send className="w-5 h-5" />
                    </button>
                </div>

                {/* Attempt counter */}
                <div className="mt-2 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-4">
                    <span>Attempts on current question: {sessionState.attempt_count}</span>
                    {sessionState.accumulated_misconceptions.length > 0 && (
                        <span className="text-amber-600 dark:text-amber-400">
                            {sessionState.accumulated_misconceptions.length} misconception(s) addressed
                        </span>
                    )}
                </div>
            </div>

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
                        className="px-4 py-2 bg-blue-500 text-white rounded-xl hover:bg-blue-600 disabled:opacity-50 shadow-lg flex items-center gap-2"
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

