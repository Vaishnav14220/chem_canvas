import React, { useState, useRef, useCallback, useEffect } from 'react';
import { X, Upload, FileText, Loader2, Volume2, BookOpen, Play, Brain, ChevronLeft, ChevronRight, HelpCircle, CheckCircle2, Info, RefreshCw, Box } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import 'katex/dist/katex.min.css';
import { analyzeDocumentForImmersive, generateImmersiveQuiz, generateAudioScript, generateMindMapData, generateImmersiveImage, ImmersiveContent, QuizQuestion, MindMapNode } from '../services/immersiveLearningService';

interface ImmersiveLearningProps {
    onClose: () => void;
    apiKey?: string;
}

type LearningMode = 'source' | 'immersive-text' | 'simulation' | '3d-lab' | 'slides-narration' | 'audio-lesson' | 'mindmap';

interface LearningModeCard {
    id: LearningMode;
    icon: React.ReactNode;
    label: string;
}

const ImmersiveLearning: React.FC<ImmersiveLearningProps> = ({ onClose, apiKey }) => {
    const [activeMode, setActiveMode] = useState<LearningMode>('immersive-text');
    const [isLoading, setIsLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const quizRef = useRef<HTMLDivElement>(null);

    // AI Content State
    const [immersiveContent, setImmersiveContent] = useState<ImmersiveContent | null>(null);
    const [sectionImages, setSectionImages] = useState<{ [key: string]: string }>({});
    const [widgetImages, setWidgetImages] = useState<{ [key: string]: { before?: string, after?: string } }>({});
    const [quiz, setQuiz] = useState<QuizQuestion[]>([]);
    const [audioScript, setAudioScript] = useState<string>('');
    const [mindMap, setMindMap] = useState<MindMapNode | null>(null);
    const [activeSectionId, setActiveSectionId] = useState<string>('');
    const [activeDefinition, setActiveDefinition] = useState<{ term: string, definition: string } | null>(null);
    const [quizAnswers, setQuizAnswers] = useState<{ [key: number]: number }>({}); // questionIndex -> selectedOptionIndex
    const [showQuizFeedback, setShowQuizFeedback] = useState<{ [key: number]: boolean }>({});

    const learningModes: LearningModeCard[] = [
        { id: 'source', icon: <FileText className="w-5 h-5" />, label: 'Source' },
        { id: 'immersive-text', icon: <BookOpen className="w-5 h-5" />, label: 'Immersive Text' },
        { id: 'simulation', icon: <RefreshCw className="w-5 h-5" />, label: 'Simulation' },
        { id: '3d-lab', icon: <Box className="w-5 h-5" />, label: '3D Lab' },
        { id: 'slides-narration', icon: <Play className="w-5 h-5" />, label: 'Slides & Narration' },
        { id: 'audio-lesson', icon: <Volume2 className="w-5 h-5" />, label: 'Audio Lesson' },
        { id: 'mindmap', icon: <Brain className="w-5 h-5" />, label: 'Mindmap' }
    ];

    const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsLoading(true);
        setLoadingMessage('Processing document...');

        try {
            const { extractTextFromDocument } = await import('../utils/documentTextExtractor');
            const { text } = await extractTextFromDocument(file);

            if (!text || text.trim().length === 0) {
                throw new Error('No text content found in document');
            }

            // 1. Analyze Content
            setLoadingMessage('Analyzing content with Gemini...');
            const analysis = await analyzeDocumentForImmersive(text);
            setImmersiveContent(analysis);
            if (analysis.sections.length > 0) {
                setActiveSectionId(analysis.sections[0].id);

                // Generate images for sections
                setLoadingMessage('Generating immersive images...');
                const images: { [key: string]: string } = {};
                const wImages: { [key: string]: { before?: string, after?: string } } = {};

                for (const section of analysis.sections) {
                    if (section.imagePrompt) {
                        try {
                            images[section.id] = await generateImmersiveImage(section.imagePrompt);
                        } catch (e) {
                            console.error("Failed to generate image for section", section.id, e);
                        }
                    }

                    // Generate widget images if comparison
                    if (section.widget?.type === 'comparison' && section.widget.data.beforeImagePrompt && section.widget.data.afterImagePrompt) {
                        try {
                            wImages[section.id] = {
                                before: await generateImmersiveImage(section.widget.data.beforeImagePrompt),
                                after: await generateImmersiveImage(section.widget.data.afterImagePrompt)
                            };
                        } catch (e) {
                            console.error("Failed to generate widget images", section.id, e);
                        }
                    }
                }
                setSectionImages(images);
                setWidgetImages(wImages);
            }

            // 2. Generate Quiz
            setLoadingMessage('Generating quiz...');
            const generatedQuiz = await generateImmersiveQuiz(text);
            setQuiz(generatedQuiz);

            // 3. Generate Audio Script
            setLoadingMessage('Creating audio lesson...');
            const script = await generateAudioScript(text);
            setAudioScript(script);

            // 4. Generate Mind Map
            setLoadingMessage('Building mind map...');
            const map = await generateMindMapData(text);
            setMindMap(map);

            setActiveMode('immersive-text');

        } catch (error) {
            console.error('Error processing file:', error);
            alert('Failed to process document. Please try again.');
        } finally {
            setIsLoading(false);
            setLoadingMessage('');
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    }, []);

    const scrollToQuiz = () => {
        quizRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const handleTermClick = (term: string, definition: string) => {
        setActiveDefinition({ term, definition });
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
                            className={`w-full text-left p-3 rounded-lg border transition-all ${selected === idx
                                    ? idx === data.correctIndex
                                        ? 'bg-green-100 border-green-300 text-green-800'
                                        : 'bg-red-100 border-red-300 text-red-800'
                                    : 'bg-white border-gray-200 hover:bg-gray-50'
                                }`}
                        >
                            {opt}
                        </button>
                    ))}
                </div>
                {selected !== null && (
                    <div className="mt-4 text-sm text-gray-700 animate-fade-in">
                        <strong>{selected === data.correctIndex ? 'Correct!' : 'Not quite.'}</strong> {data.explanation}
                    </div>
                )}
            </div>
        );
    };

    const renderContent = () => {
        if (isLoading) {
            return (
                <div className="flex flex-col items-center justify-center h-full space-y-4">
                    <Loader2 className="w-10 h-10 text-[#ff8b66] animate-spin" />
                    <p className="text-[#444746] text-sm font-medium">{loadingMessage}</p>
                </div>
            );
        }

        if (!immersiveContent && activeMode !== 'source') {
            return (
                <div className="flex flex-col items-center justify-center h-full space-y-6 p-8">
                    <div className="text-center space-y-3 max-w-md">
                        <div className="w-16 h-16 bg-[#fff0e0] rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <FileText className="w-8 h-8 text-[#ff8b66]" />
                        </div>
                        <h2 className="text-2xl font-google-sans text-[#1f1f1f]">Start Learning</h2>
                        <p className="text-[#444746]">Upload a document to generate your immersive lesson.</p>
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

        switch (activeMode) {
            case 'source':
                return (
                    <div className="flex flex-col items-center justify-center h-full space-y-6 p-8">
                        <div className="text-center space-y-3 max-w-md">
                            <div className="w-16 h-16 bg-[#fff0e0] rounded-2xl flex items-center justify-center mx-auto mb-4">
                                <FileText className="w-8 h-8 text-[#ff8b66]" />
                            </div>
                            <h2 className="text-2xl font-google-sans text-[#1f1f1f]">Upload Material</h2>
                            <p className="text-[#444746]">Upload your documents to generate an immersive learning experience.</p>
                        </div>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".txt,.md,.pdf,.docx"
                            onChange={handleFileUpload}
                            className="hidden"
                        />
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="px-6 py-3 bg-[#ff8b66] hover:bg-[#ff8b66]/90 text-white rounded-full font-medium transition-all shadow-sm hover:shadow-md flex items-center gap-2"
                        >
                            <Upload className="w-5 h-5" />
                            <span>Select File</span>
                        </button>
                    </div>
                );

            case 'immersive-text':
                const activeSection = immersiveContent?.sections.find(s => s.id === activeSectionId) || immersiveContent?.sections[0];
                const activeImage = activeSection ? sectionImages[activeSection.id] : null;
                const activeWidget = activeSection?.widget;
                const widgetImgs = activeSection ? widgetImages[activeSection.id] : undefined;

                // Split content by marker
                const contentParts = activeSection?.content.split('{{INTERACTIVE_WIDGET}}') || [];

                return (
                    <div className="max-w-4xl mx-auto py-12 px-16 relative font-roboto">
                        {activeDefinition && (
                            <div className="sticky top-4 z-10 bg-[#e8f0fe] border border-blue-200 rounded-xl p-4 mb-6 shadow-sm animate-fade-in">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h4 className="font-bold text-[#1967d2] mb-1 font-google-sans">{activeDefinition.term}</h4>
                                        <p className="text-sm text-[#1f1f1f]">{activeDefinition.definition}</p>
                                    </div>
                                    <button onClick={() => setActiveDefinition(null)} className="text-gray-400 hover:text-gray-600">
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        )}

                        <div className="flex items-center justify-between mb-8">
                            <h1 className="text-[2.5rem] leading-tight font-google-sans text-[#1f1f1f]">{activeSection?.title}</h1>
                            <div className="flex gap-2">
                                <button className="p-2 hover:bg-gray-100 rounded-full text-gray-400 transition-colors">
                                    <ChevronLeft className="w-6 h-6" />
                                </button>
                                <button className="p-2 hover:bg-gray-100 rounded-full text-gray-400 transition-colors">
                                    <ChevronRight className="w-6 h-6" />
                                </button>
                            </div>
                        </div>

                        {activeImage && (
                            <div className="mb-10 rounded-2xl overflow-hidden shadow-sm border border-gray-100">
                                <img src={activeImage} alt={activeSection?.title} className="w-full h-auto object-cover max-h-[400px]" />
                            </div>
                        )}

                        <div className="prose prose-lg max-w-none prose-headings:font-google-sans prose-headings:text-[#1f1f1f] prose-p:text-[#1f1f1f] prose-p:text-[1.125rem] prose-p:leading-[1.8] prose-p:font-roboto">
                            <ReactMarkdown
                                components={{
                                    h1: ({ children }) => <h2 className="text-2xl font-bold mb-6 text-[#1f1f1f] font-google-sans">{children}</h2>,
                                    p: ({ children }) => (
                                        <div className="relative group">
                                            <p className="text-[1.125rem] leading-[1.8] text-[#1f1f1f] mb-6 font-roboto tracking-normal">
                                                {children}
                                            </p>
                                            {/* Logic to show context icon if this paragraph has a note */}
                                            <button
                                                className="absolute -right-12 top-0 p-1 bg-[#ff8b66] text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-md hover:scale-110"
                                                title="Click for context"
                                            >
                                                <HelpCircle className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ),
                                    strong: ({ children }) => {
                                        const term = String(children);
                                        const def = immersiveContent?.keyTerms.find(t => t.term.toLowerCase() === term.toLowerCase());
                                        return def ? (
                                            <span
                                                onClick={() => handleTermClick(def.term, def.definition)}
                                                className="font-medium text-[#1f1f1f] border-b-2 border-dotted border-[#0b57d0] cursor-pointer hover:bg-blue-50 transition-colors"
                                            >
                                                {children}
                                            </span>
                                        ) : (
                                            <strong className="font-bold text-[#1f1f1f]">{children}</strong>
                                        );
                                    }
                                }}
                            >
                                {contentParts[0] || ''}
                            </ReactMarkdown>

                            {activeWidget && (
                                <div className="animate-slide-up">
                                    {activeWidget.type === 'reveal' && <ScratchReveal title={activeWidget.data.title} content={activeWidget.data.content} />}
                                    {activeWidget.type === 'comparison' && <ComparisonSlider data={activeWidget.data} images={widgetImgs} />}
                                    {activeWidget.type === 'quiz' && <InlineQuiz data={activeWidget.data} />}
                                </div>
                            )}

                            {contentParts[1] && (
                                <ReactMarkdown
                                    components={{
                                        h1: ({ children }) => <h2 className="text-2xl font-bold mb-6 text-[#1f1f1f] font-google-sans">{children}</h2>,
                                        p: ({ children }) => (
                                            <div className="relative group">
                                                <p className="text-[1.125rem] leading-[1.8] text-[#1f1f1f] mb-6 font-roboto tracking-normal">
                                                    {children}
                                                </p>
                                                <button
                                                    className="absolute -right-12 top-0 p-1 bg-[#ff8b66] text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-md hover:scale-110"
                                                    title="Click for context"
                                                >
                                                    <HelpCircle className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ),
                                        strong: ({ children }) => {
                                            const term = String(children);
                                            const def = immersiveContent?.keyTerms.find(t => t.term.toLowerCase() === term.toLowerCase());
                                            return def ? (
                                                <span
                                                    onClick={() => handleTermClick(def.term, def.definition)}
                                                    className="font-medium text-[#1f1f1f] border-b-2 border-dotted border-[#0b57d0] cursor-pointer hover:bg-blue-50 transition-colors"
                                                >
                                                    {children}
                                                </span>
                                            ) : (
                                                <strong className="font-bold text-[#1f1f1f]">{children}</strong>
                                            );
                                        }
                                    }}
                                >
                                    {contentParts[1]}
                                </ReactMarkdown>
                            )}
                        </div>

                        {/* Quiz Section */}
                        <div ref={quizRef} className="mt-16 pt-8 border-t border-gray-200">
                            <h3 className="text-xl font-bold text-[#1f1f1f] mb-6 font-google-sans">Check your understanding</h3>
                            <div className="space-y-6">
                                {quiz.map((q, qIdx) => (
                                    <div key={qIdx} className="bg-[#f8f9fa] rounded-2xl p-6 border border-gray-200">
                                        <p className="font-medium text-[#1f1f1f] mb-4 font-google-sans">{q.question}</p>
                                        <div className="space-y-3">
                                            {q.options.map((option, oIdx) => {
                                                const isSelected = quizAnswers[qIdx] === oIdx;
                                                const showFeedback = showQuizFeedback[qIdx];
                                                const isCorrect = oIdx === q.correctAnswerIndex;

                                                let borderClass = 'border-transparent hover:border-gray-200';
                                                let bgClass = 'hover:bg-white';

                                                if (showFeedback) {
                                                    if (isCorrect) {
                                                        borderClass = 'border-green-500 bg-green-50';
                                                        bgClass = 'bg-green-50';
                                                    } else if (isSelected) {
                                                        borderClass = 'border-red-500 bg-red-50';
                                                        bgClass = 'bg-red-50';
                                                    }
                                                } else if (isSelected) {
                                                    borderClass = 'border-[#0b57d0] bg-blue-50';
                                                    bgClass = 'bg-blue-50';
                                                }

                                                return (
                                                    <label key={oIdx} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${borderClass} ${bgClass}`}>
                                                        <input
                                                            type="radio"
                                                            name={`quiz-${qIdx}`}
                                                            className="w-4 h-4 text-[#0b57d0]"
                                                            checked={isSelected}
                                                            onChange={() => handleQuizAnswer(qIdx, oIdx)}
                                                            disabled={showFeedback}
                                                        />
                                                        <span className="text-[#444746] flex-1 font-roboto">{option}</span>
                                                        {showFeedback && isCorrect && <CheckCircle2 className="w-5 h-5 text-green-600" />}
                                                        {showFeedback && isSelected && !isCorrect && <X className="w-5 h-5 text-red-600" />}
                                                    </label>
                                                );
                                            })}
                                        </div>
                                        {showQuizFeedback[qIdx] && (
                                            <div className={`mt-4 p-3 rounded-lg text-sm ${quizAnswers[qIdx] === q.correctAnswerIndex ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                                <p className="font-bold mb-1">{quizAnswers[qIdx] === q.correctAnswerIndex ? 'Correct!' : 'Incorrect'}</p>
                                                <p>{q.explanation}</p>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                );

            case 'simulation':
                return (
                    <div className="flex flex-col items-center justify-center h-full bg-[#f0f4f8] p-8">
                        <div className="bg-white p-8 rounded-3xl shadow-lg max-w-2xl text-center">
                            <RefreshCw className="w-16 h-16 text-blue-500 mx-auto mb-4" />
                            <h2 className="text-2xl font-bold mb-2">Interactive Simulation</h2>
                            <p className="text-gray-600 mb-6">Explore the variables and see how they affect the system.</p>
                            <div className="h-64 bg-gray-100 rounded-xl flex items-center justify-center border-2 border-dashed border-gray-300">
                                <span className="text-gray-400">Simulation Canvas Placeholder</span>
                            </div>
                        </div>
                    </div>
                );

            case '3d-lab':
                return (
                    <div className="flex flex-col items-center justify-center h-full bg-[#1a1a1a] text-white p-8">
                        <div className="w-full max-w-4xl h-[500px] bg-black rounded-2xl border border-gray-800 relative flex items-center justify-center">
                            <Box className="w-24 h-24 text-blue-400 opacity-50" />
                            <div className="absolute bottom-4 left-4 right-4 flex justify-between items-center bg-gray-900/80 p-4 rounded-xl backdrop-blur-md">
                                <span>3D Model Viewer</span>
                                <div className="flex gap-2">
                                    <button className="px-3 py-1 bg-blue-600 rounded-lg text-sm">Rotate</button>
                                    <button className="px-3 py-1 bg-gray-700 rounded-lg text-sm">Explode</button>
                                </div>
                            </div>
                        </div>
                    </div>
                );

            case 'slides-narration':
                return (
                    <div className="flex flex-col items-center justify-center h-full bg-[#1a1a1a] text-white p-8">
                        <div className="w-full max-w-4xl aspect-video bg-black rounded-xl flex items-center justify-center relative group cursor-pointer">
                            <Play className="w-20 h-20 text-white opacity-80 group-hover:opacity-100 transition-opacity" />
                            <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent flex justify-between items-end">
                                <div>
                                    <h3 className="text-lg font-medium">Generated Slides</h3>
                                    <p className="text-sm text-gray-300">Slide 1 of 5</p>
                                </div>
                                <div className="flex gap-2">
                                    <button className="p-2 hover:bg-white/20 rounded-full"><ChevronLeft className="w-5 h-5" /></button>
                                    <button className="p-2 hover:bg-white/20 rounded-full"><ChevronRight className="w-5 h-5" /></button>
                                </div>
                            </div>
                        </div>
                    </div>
                );

            case 'audio-lesson':
                return (
                    <div className="flex flex-col items-center justify-center h-full bg-[#fbf7f2] p-8">
                        <div className="w-full max-w-md bg-white rounded-3xl shadow-lg p-8 flex flex-col items-center gap-6">
                            <div className="w-48 h-48 bg-[#e8f0fe] rounded-full flex items-center justify-center">
                                <Volume2 className="w-24 h-24 text-[#0b57d0]" />
                            </div>
                            <div className="text-center">
                                <h2 className="text-2xl font-bold text-[#1f1f1f]">Audio Lesson</h2>
                                <p className="text-[#444746]">AI-generated narration of your document</p>
                            </div>
                            <button
                                onClick={speakAudio}
                                className="w-16 h-16 bg-[#0b57d0] hover:bg-[#0b57d0]/90 rounded-full flex items-center justify-center text-white shadow-lg transition-transform hover:scale-105"
                            >
                                <Play className="w-8 h-8 ml-1" />
                            </button>
                            <div className="w-full bg-gray-200 h-1.5 rounded-full overflow-hidden">
                                <div className="w-1/3 h-full bg-[#0b57d0]" />
                            </div>
                        </div>
                    </div>
                );

            case 'mindmap':
                return (
                    <div className="flex flex-col items-center justify-center h-full bg-[#f8f9fa] p-8">
                        <div className="relative w-full h-full max-w-5xl bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex items-center justify-center">
                            <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px]" />
                            <div className="relative z-10 flex flex-col items-center gap-8">
                                <div className="px-6 py-3 bg-[#e8f0fe] border-2 border-[#0b57d0] rounded-xl text-[#0b57d0] font-bold shadow-sm">
                                    {mindMap?.label || 'Main Topic'}
                                </div>
                                <div className="flex gap-12 flex-wrap justify-center">
                                    {mindMap?.children?.map((child, idx) => (
                                        <div key={idx} className="px-5 py-2 bg-white border border-gray-300 rounded-lg shadow-sm text-[#1f1f1f]">
                                            {child.label}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                );

            default:
                return null;
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-[#fbf7f2] flex flex-col font-sans text-[#1f1f1f]">
            {/* Top Navigation Bar */}
            <div className="bg-white h-[72px] px-6 flex items-center justify-between shadow-sm z-20 border-b border-gray-100">
                <button
                    onClick={onClose}
                    className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors flex items-center gap-2"
                    title="Back to Canvas"
                >
                    <ChevronLeft className="w-6 h-6" />
                    <span className="font-medium text-sm hidden sm:block">Back</span>
                </button>

                <div className="flex items-center gap-8 mx-auto">
                    {learningModes.map((mode) => (
                        <button
                            key={mode.id}
                            onClick={() => setActiveMode(mode.id)}
                            className={`
                                flex flex-col items-center gap-1 px-6 py-2 rounded-full transition-all duration-200
                                ${activeMode === mode.id
                                    ? 'bg-white border-2 border-[#ff8b66] text-[#ff8b66]'
                                    : 'text-[#444746] hover:bg-gray-50 border-2 border-transparent'
                                }
                            `}
                        >
                            <div className={`${activeMode === mode.id ? 'text-[#ff8b66]' : 'text-[#c4c7c5]'}`}>
                                {mode.icon}
                            </div>
                            <span className={`text-xs font-medium ${activeMode === mode.id ? 'text-[#ff8b66]' : 'text-[#444746]'}`}>
                                {mode.label}
                            </span>
                        </button>
                    ))}
                </div>

                <button
                    onClick={onClose}
                    className="absolute right-6 top-1/2 -translate-y-1/2 p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors"
                >
                    <X className="w-6 h-6" />
                </button>
            </div>

            <div className="flex flex-1 overflow-hidden p-6 gap-6">
                {/* Left Sidebar - Table of Contents */}
                {activeMode === 'immersive-text' && immersiveContent && (
                    <div className="w-[300px] flex flex-col gap-2 pt-4 animate-slide-in-left">
                        {immersiveContent.sections.map((section) => (
                            <div key={section.id} className="group">
                                <button
                                    onClick={() => setActiveSectionId(section.id)}
                                    className={`
                                        w-full flex items-start gap-3 p-4 rounded-xl text-left transition-all duration-200
                                        ${activeSectionId === section.id
                                            ? 'bg-[#f0e9df]'
                                            : 'hover:bg-[#f5f0e8]'
                                        }
                                    `}
                                >
                                    <div className={`
                                        mt-1 w-5 h-5 rounded border flex items-center justify-center flex-shrink-0
                                        ${activeSectionId === section.id ? 'bg-[#ff8b66] border-[#ff8b66]' : 'border-gray-400'}
                                    `}>
                                        {activeSectionId === section.id && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                                    </div>
                                    <span className={`text-sm font-medium leading-tight ${activeSectionId === section.id ? 'text-[#1f1f1f]' : 'text-[#444746]'}`}>
                                        {section.title}
                                    </span>
                                </button>

                                {/* Quiz Button for Active Section */}
                                {activeSectionId === section.id && (
                                    <div className="pl-12 pr-4 pb-2 animate-slide-down">
                                        <button
                                            onClick={scrollToQuiz}
                                            className="w-full py-2 px-4 bg-white border border-[#1f1f1f] rounded-full text-xs font-medium hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
                                        >
                                            <HelpCircle className="w-3 h-3" />
                                            Take quiz to complete
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* Main Content Card */}
                <div className={`flex-1 bg-white rounded-[32px] shadow-sm overflow-y-auto relative ${activeMode !== 'immersive-text' ? 'w-full' : ''}`}>
                    {renderContent()}
                </div>
            </div>
        </div>
    );
};

export default ImmersiveLearning;
