/**
 * ClassroomSimulation Component
 * 
 * A Feynman learning sub-mode that simulates a classroom presentation:
 * - Left: Whiteboard/canvas for presenting diagrams
 * - Right: AI "students" ask questions with speech bubbles
 * - Students can SEE the canvas and ask contextual questions in real-time
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Pencil,
    Eraser,
    Type,
    Play,
    MessageCircle,
    User,
    Loader2,
    ChevronLeft,
    RefreshCw,
    Eye
} from 'lucide-react';
import { ExcalidrawCanvas, ExcalidrawCanvasRef } from './ExcalidrawCanvas/ExcalidrawCanvas';
import { loadFeatureSession, saveFeatureSession } from '../utils/featureSessionStorage';

// AI Student avatars - different personas with learning styles
const AI_STUDENTS = [
    { id: 'student1', name: 'Alex', color: 'bg-blue-200', emoji: '👨‍🎓', style: 'curious beginner' },
    { id: 'student2', name: 'Maya', color: 'bg-purple-200', emoji: '👩‍🎓', style: 'detail-oriented' },
    { id: 'student3', name: 'Jordan', color: 'bg-amber-200', emoji: '🧑‍🎓', style: 'big-picture thinker' },
    { id: 'student4', name: 'Sam', color: 'bg-green-200', emoji: '👨‍💻', style: 'application-focused' },
];

interface StudentQuestion {
    id: string;
    studentId: string;
    question: string;
    answered: boolean;
    timestamp: Date;
}

interface ClassroomSimulationProps {
    topic: string;
    onBack: () => void;
    apiKey: string;
}

type PersistedQuestion = Omit<StudentQuestion, 'timestamp'> & { timestamp: string };

type ClassroomSessionSnapshot = {
    version: 1;
    topic: string;
    questions: PersistedQuestion[];
    selectedQuestionId: string | null;
    isPresentationStarted: boolean;
    activeTool: 'pen' | 'eraser' | 'text';
    userResponse: string;
};

const serializeQuestions = (items: StudentQuestion[]): PersistedQuestion[] =>
    items.map((question) => ({
        ...question,
        timestamp: question.timestamp.toISOString(),
    }));

const deserializeQuestions = (items: PersistedQuestion[]): StudentQuestion[] =>
    items.map((question) => ({
        ...question,
        timestamp: new Date(question.timestamp),
    }));

export const ClassroomSimulation: React.FC<ClassroomSimulationProps> = ({
    topic,
    onBack,
    apiKey,
}) => {
    const excalidrawRef = useRef<ExcalidrawCanvasRef>(null);
    const [isPresentationStarted, setIsPresentationStarted] = useState(false);
    const [isGeneratingQuestions, setIsGeneratingQuestions] = useState(false);
    const [questions, setQuestions] = useState<StudentQuestion[]>([]);
    const [selectedQuestion, setSelectedQuestion] = useState<StudentQuestion | null>(null);
    const [isResponding, setIsResponding] = useState(false);
    const [activeTool, setActiveTool] = useState<'pen' | 'eraser' | 'text'>('pen');
    const [canvasWatching, setCanvasWatching] = useState(false);
    const [lastAnalyzedTime, setLastAnalyzedTime] = useState<number>(0);
    const watchIntervalRef = useRef<NodeJS.Timeout | null>(null);

    // New: Active question tracking and thinking state
    const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);
    const [isStudentThinking, setIsStudentThinking] = useState(false);
    const [thinkingStudentId, setThinkingStudentId] = useState<string | null>(null);
    const [userResponse, setUserResponse] = useState('');

    useEffect(() => {
        const stored = loadFeatureSession<ClassroomSessionSnapshot>('classroom-simulation');
        if (!stored) return;
        const restoredQuestions = stored.questions ? deserializeQuestions(stored.questions) : [];
        setIsPresentationStarted(Boolean(stored.isPresentationStarted));
        setQuestions(restoredQuestions);
        setSelectedQuestion(
            restoredQuestions.find((question) => question.id === stored.selectedQuestionId) || null
        );
        setActiveTool(stored.activeTool || 'pen');
        setUserResponse(stored.userResponse || '');
    }, []);

    useEffect(() => {
        const saveTimeout = setTimeout(() => {
            const snapshot: ClassroomSessionSnapshot = {
                version: 1,
                topic,
                questions: serializeQuestions(questions),
                selectedQuestionId: selectedQuestion?.id || null,
                isPresentationStarted,
                activeTool,
                userResponse,
            };
            saveFeatureSession('classroom-simulation', snapshot);
        }, 800);

        return () => clearTimeout(saveTimeout);
    }, [topic, questions, selectedQuestion, isPresentationStarted, activeTool, userResponse]);

    // Capture canvas as base64 image
    const captureCanvas = useCallback(async (): Promise<string | null> => {
        if (!excalidrawRef.current) return null;

        try {
            // Use Excalidraw's export functionality
            const dataUrl = await excalidrawRef.current.exportToImage?.();
            return dataUrl || null;
        } catch (error) {
            console.error('Failed to capture canvas:', error);
            return null;
        }
    }, []);

    // Generate AI student questions based on the canvas content
    const generateStudentQuestions = useCallback(async (isRealTime: boolean = false) => {
        if (!apiKey) {
            console.warn('No API key provided for question generation');
            return;
        }

        // Pick a random student to ask
        const studentIndex = Math.floor(Math.random() * AI_STUDENTS.length);
        const student = AI_STUDENTS[studentIndex];

        // Show thinking animation
        setIsStudentThinking(true);
        setThinkingStudentId(student.id);
        setIsGeneratingQuestions(true);

        try {
            // Capture current canvas state
            const canvasImage = await captureCanvas();

            // Build the prompt
            const systemPrompt = `You are a ${student.style} student named ${student.name} in a classroom. 
Your teacher is explaining "${topic}" using a whiteboard/diagram.
Based on what you see on the whiteboard, ask ONE short, natural question (max 15 words) that:
- Shows genuine curiosity or confusion
- References specific elements you can see in the diagram
- Sounds like a real student asking in class
- Helps deepen understanding

If the whiteboard is empty or unclear, ask a question to encourage the teacher to draw or explain.
Reply with ONLY the question, nothing else.`;

            let questionText: string;

            if (canvasImage && typeof window !== 'undefined' && canvasImage.includes(',')) {
                // Use Gemini API with vision
                const { GoogleGenerativeAI } = await import('@google/generative-ai');
                const genAI = new GoogleGenerativeAI(apiKey);
                const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

                // Extract base64 data from data URL
                const base64Data = canvasImage.split(',')[1];

                // Validate base64 data exists and has reasonable length
                if (base64Data && base64Data.length > 100) {
                    try {
                        // Detect mime type
                        const mimeMatch = canvasImage.match(/data:([^;]+);/);
                        const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';

                        const result = await model.generateContent([
                            systemPrompt,
                            {
                                inlineData: {
                                    mimeType: mimeType,
                                    data: base64Data
                                }
                            }
                        ]);

                        questionText = result.response.text().trim();
                    } catch (visionErr) {
                        console.warn('Vision API failed, using text fallback:', visionErr);
                        const textResult = await model.generateContent(
                            `${systemPrompt}\n\nNote: Ask a general question about ${topic} to help the teacher explain.`
                        );
                        questionText = textResult.response.text().trim();
                    }
                } else {
                    // Invalid base64, use text fallback
                    const result = await model.generateContent(
                        `${systemPrompt}\n\nNote: Ask a general question about ${topic} to get started.`
                    );
                    questionText = result.response.text().trim();
                }
            } else {
                // Fallback without image
                const { GoogleGenerativeAI } = await import('@google/generative-ai');
                const genAI = new GoogleGenerativeAI(apiKey);
                const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

                const result = await model.generateContent(
                    `${systemPrompt}\n\nNote: The whiteboard appears to be empty or not visible yet. Ask something to get the teacher started.`
                );
                questionText = result.response.text().trim();
            }

            // Create new question
            const newQuestion: StudentQuestion = {
                id: `q-${Date.now()}`,
                studentId: student.id,
                question: questionText,
                answered: false,
                timestamp: new Date()
            };

            // Add to questions (max 5 recent questions)
            setQuestions(prev => {
                const updated = [newQuestion, ...prev];
                return updated.slice(0, 5);
            });

            // Set as active question
            setActiveQuestionId(newQuestion.id);

            setLastAnalyzedTime(Date.now());
        } catch (error) {
            console.error('Failed to generate question:', error);

            // Fallback question
            const fallbackQuestions = [
                `Can you show me how ${topic} works?`,
                `What does this part of your diagram mean?`,
                `I'm confused about the arrows - what do they represent?`,
                `How does this connect to real life?`
            ];
            const randomQ = fallbackQuestions[Math.floor(Math.random() * fallbackQuestions.length)];
            const fallbackId = `q-${Date.now()}`;

            setQuestions(prev => [{
                id: fallbackId,
                studentId: AI_STUDENTS[Math.floor(Math.random() * AI_STUDENTS.length)].id,
                question: randomQ,
                answered: false,
                timestamp: new Date()
            }, ...prev].slice(0, 5));

            setActiveQuestionId(fallbackId);
        } finally {
            setIsGeneratingQuestions(false);
            setIsStudentThinking(false);
            setThinkingStudentId(null);
        }
    }, [apiKey, topic, captureCanvas]);

    // Start watching canvas and generating questions periodically
    const startCanvasWatching = useCallback(() => {
        if (watchIntervalRef.current) {
            clearInterval(watchIntervalRef.current);
        }

        setCanvasWatching(true);

        // Generate initial question
        generateStudentQuestions();

        // Watch for canvas changes every 6 seconds for live feel
        watchIntervalRef.current = setInterval(() => {
            if (Date.now() - lastAnalyzedTime > 4000) { // At least 4s between questions
                generateStudentQuestions(true);
            }
        }, 6000);
    }, [generateStudentQuestions, lastAnalyzedTime]);

    // Stop watching
    const stopCanvasWatching = useCallback(() => {
        if (watchIntervalRef.current) {
            clearInterval(watchIntervalRef.current);
            watchIntervalRef.current = null;
        }
        setCanvasWatching(false);
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (watchIntervalRef.current) {
                clearInterval(watchIntervalRef.current);
            }
        };
    }, []);

    // Start the presentation mode
    const handleStartPresentation = () => {
        setIsPresentationStarted(true);
        startCanvasWatching();
    };

    // Handle responding to a question
    const handleRespondToQuestion = (question: StudentQuestion) => {
        setSelectedQuestion(question);
        setIsResponding(true);
    };

    // Submit response to question
    const handleSubmitResponse = () => {
        if (selectedQuestion) {
            setQuestions(prev =>
                prev.map(q => q.id === selectedQuestion.id ? { ...q, answered: true } : q)
            );
            setSelectedQuestion(null);
            setIsResponding(false);
        }
    };

    // Trigger a new question manually
    const handleAskNewQuestion = () => {
        generateStudentQuestions();
    };

    // Get student data by ID
    const getStudent = (studentId: string) =>
        AI_STUDENTS.find(s => s.id === studentId) || AI_STUDENTS[0];

    return (
        <div className="flex flex-col h-screen bg-gray-100">
            {/* Header */}
            <header className="flex-shrink-0 flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => { stopCanvasWatching(); onBack(); }}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <ChevronLeft className="w-5 h-5 text-gray-600" />
                    </button>
                    <span className="text-lg font-semibold text-gray-800">Classroom Simulation</span>
                    {canvasWatching && (
                        <span className="flex items-center gap-1 text-xs text-green-600 bg-green-100 px-2 py-1 rounded-full">
                            <Eye className="w-3 h-3" />
                            Students watching
                        </span>
                    )}
                </div>
                <button className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                    <User className="w-5 h-5 text-gray-500" />
                </button>
            </header>

            {/* Main Content - Split Layout */}
            <div className="flex-1 flex overflow-hidden p-4 gap-4">
                {/* Left: Simulated Classroom Presentation */}
                <div className="flex-1 flex flex-col bg-white rounded-2xl shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100">
                        <h2 className="text-xl font-bold text-gray-800">Your Whiteboard</h2>
                        <p className="text-sm text-gray-500">Draw your explanation - AI students are watching!</p>
                    </div>

                    {/* Canvas Area with Drawing Tools */}
                    <div className="flex-1 relative m-4 border border-gray-200 rounded-xl overflow-hidden bg-white">
                        {/* Mini Toolbar */}
                        <div className="absolute top-3 left-3 z-10 flex items-center gap-1 bg-white rounded-lg shadow-sm border border-gray-200 p-1">
                            <button
                                onClick={() => setActiveTool('pen')}
                                className={`p-2 rounded-md transition-colors ${activeTool === 'pen' ? 'bg-gray-100' : 'hover:bg-gray-50'}`}
                            >
                                <Pencil className="w-4 h-4 text-gray-600" />
                            </button>
                            <button
                                onClick={() => setActiveTool('eraser')}
                                className={`p-2 rounded-md transition-colors ${activeTool === 'eraser' ? 'bg-gray-100' : 'hover:bg-gray-50'}`}
                            >
                                <Eraser className="w-4 h-4 text-gray-600" />
                            </button>
                            <button
                                onClick={() => setActiveTool('text')}
                                className={`p-2 rounded-md transition-colors ${activeTool === 'text' ? 'bg-gray-100' : 'hover:bg-gray-50'}`}
                            >
                                <Type className="w-4 h-4 text-gray-600" />
                            </button>
                        </div>

                        {/* Excalidraw Canvas */}
                        <ExcalidrawCanvas
                            ref={excalidrawRef}
                            isOpen={true}
                            onClose={() => { }}
                            embedded={true}
                            className="w-full h-full"
                            persistenceKey="classroom-simulation-canvas"
                        />

                        {/* Presenter Avatar */}
                        <div className="absolute bottom-4 right-4 w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center shadow-lg">
                            <span className="text-xl">👨‍🏫</span>
                        </div>
                    </div>

                    {/* Start Presentation Button */}
                    <div className="px-6 pb-4 flex justify-center">
                        <button
                            onClick={handleStartPresentation}
                            disabled={isPresentationStarted}
                            className={`px-8 py-3 rounded-lg font-medium transition-all flex items-center gap-2 ${isPresentationStarted
                                ? 'bg-gray-200 text-gray-500 cursor-default'
                                : 'bg-teal-600 text-white hover:bg-teal-700 shadow-md'
                                }`}
                        >
                            {isPresentationStarted ? (
                                <>
                                    <Eye className="w-4 h-4" />
                                    Presentation Live
                                </>
                            ) : (
                                <>
                                    <Play className="w-4 h-4" />
                                    Start Presentation
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Right: AI Student Questions & Feedback */}
                <div className="flex-1 flex flex-col bg-white rounded-2xl shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                        <div>
                            <h2 className="text-xl font-bold text-gray-800">AI Student Questions</h2>
                            <p className="text-sm text-gray-500">Questions based on your whiteboard</p>
                        </div>
                        {isPresentationStarted && (
                            <button
                                onClick={handleAskNewQuestion}
                                disabled={isGeneratingQuestions}
                                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                                title="Get new question"
                            >
                                <RefreshCw className={`w-5 h-5 text-gray-500 ${isGeneratingQuestions ? 'animate-spin' : ''}`} />
                            </button>
                        )}
                    </div>

                    {/* Questions Area */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                        {!isPresentationStarted ? (
                            <div className="flex flex-col items-center justify-center h-full text-gray-400">
                                <MessageCircle className="w-12 h-12 mb-3 opacity-50" />
                                <p className="text-center">Start your presentation to receive<br />questions from AI students</p>
                            </div>
                        ) : isGeneratingQuestions && questions.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full">
                                <Loader2 className="w-8 h-8 text-teal-500 animate-spin mb-3" />
                                <p className="text-gray-500">Students are watching your whiteboard...</p>
                            </div>
                        ) : (
                            <AnimatePresence>
                                {/* Thinking Bubble - Shows when student is preparing question */}
                                {isStudentThinking && thinkingStudentId && (
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.9 }}
                                        className="flex items-start gap-3 mb-4"
                                    >
                                        <div className={`w-12 h-12 rounded-full ${getStudent(thinkingStudentId).color} flex items-center justify-center flex-shrink-0 shadow-sm animate-pulse`}>
                                            <span className="text-xl">{getStudent(thinkingStudentId).emoji}</span>
                                        </div>
                                        <div className="bg-gray-100 border-2 border-gray-200 rounded-2xl rounded-tl-sm px-4 py-3">
                                            <p className="text-xs text-gray-400 mb-1">{getStudent(thinkingStudentId).name} is thinking...</p>
                                            <div className="flex gap-1">
                                                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                                                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                                                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}

                                {questions.map((q, index) => {
                                    const student = getStudent(q.studentId);
                                    const isEven = index % 2 === 0;
                                    const isActive = q.id === activeQuestionId && !q.answered;

                                    return (
                                        <motion.div
                                            key={q.id}
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: index * 0.1 }}
                                            className={`flex items-start gap-3 ${isEven ? '' : 'flex-row-reverse'} ${isActive ? 'relative' : ''}`}
                                        >
                                            {/* Active indicator */}
                                            {isActive && (
                                                <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-1 h-8 bg-teal-500 rounded-full"></div>
                                            )}

                                            {/* Student Avatar */}
                                            <div className={`w-12 h-12 rounded-full ${student.color} flex items-center justify-center flex-shrink-0 shadow-sm ${isActive ? 'ring-2 ring-teal-500 ring-offset-2' : ''}`}>
                                                <span className="text-xl">{student.emoji}</span>
                                            </div>

                                            {/* Speech Bubble */}
                                            <div className={`relative max-w-[250px] ${q.answered ? 'opacity-50' : ''}`}>
                                                <div className={`
                                                    bg-white border-2 rounded-2xl p-4 shadow-sm
                                                    ${isActive ? 'border-teal-400 bg-teal-50' : 'border-gray-200'}
                                                    ${isEven ? 'rounded-tl-sm' : 'rounded-tr-sm'}
                                                `}>
                                                    <p className="text-xs text-gray-400 mb-1">{student.name}</p>
                                                    <p className="text-sm text-gray-700">{q.question}</p>
                                                    {isActive && (
                                                        <span className="inline-block mt-2 text-xs text-teal-600 font-medium">
                                                            ⬆ Current Question
                                                        </span>
                                                    )}
                                                </div>
                                                {q.answered && (
                                                    <span className="absolute -bottom-2 right-2 text-xs text-green-600 font-medium">
                                                        ✓ Answered
                                                    </span>
                                                )}
                                            </div>
                                        </motion.div>
                                    );
                                })}

                                {isGeneratingQuestions && questions.length > 0 && (
                                    <div className="flex justify-center py-2">
                                        <Loader2 className="w-5 h-5 text-teal-500 animate-spin" />
                                    </div>
                                )}
                            </AnimatePresence>
                        )}
                    </div>

                    {/* Respond to Questions Button */}
                    <div className="px-6 pb-4 flex justify-center">
                        <button
                            onClick={() => {
                                const unanswered = questions.find(q => !q.answered);
                                if (unanswered) handleRespondToQuestion(unanswered);
                            }}
                            disabled={!isPresentationStarted || questions.every(q => q.answered) || questions.length === 0}
                            className={`px-8 py-3 rounded-lg font-medium transition-all flex items-center gap-2 ${!isPresentationStarted || questions.every(q => q.answered)
                                ? 'bg-gray-200 text-gray-500 cursor-default'
                                : 'bg-teal-600 text-white hover:bg-teal-700 shadow-md'
                                }`}
                        >
                            <MessageCircle className="w-4 h-4" />
                            {questions.every(q => q.answered) && questions.length > 0
                                ? 'All Questions Answered!'
                                : 'Respond to Questions'
                            }
                        </button>
                    </div>
                </div>
            </div>

            {/* Response Modal */}
            <AnimatePresence>
                {isResponding && selectedQuestion && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
                    >
                        <motion.div
                            initial={{ scale: 0.9 }}
                            animate={{ scale: 1 }}
                            exit={{ scale: 0.9 }}
                            className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6"
                        >
                            <div className="flex items-center gap-3 mb-4">
                                <div className={`w-10 h-10 rounded-full ${getStudent(selectedQuestion.studentId).color} flex items-center justify-center`}>
                                    <span className="text-lg">{getStudent(selectedQuestion.studentId).emoji}</span>
                                </div>
                                <div>
                                    <p className="font-medium text-gray-800">{getStudent(selectedQuestion.studentId).name} asks:</p>
                                    <p className="text-gray-600">{selectedQuestion.question}</p>
                                </div>
                            </div>

                            <textarea
                                placeholder="Type your explanation here..."
                                className="w-full h-32 p-4 border border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-teal-500"
                            />

                            <div className="flex gap-3 mt-4">
                                <button
                                    onClick={() => { setIsResponding(false); setSelectedQuestion(null); }}
                                    className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSubmitResponse}
                                    className="flex-1 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
                                >
                                    Submit Answer
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default ClassroomSimulation;
