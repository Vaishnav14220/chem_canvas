import React, { useState, useRef, useEffect } from 'react';
import { AspectRatio, ImageSize, InteractiveLabel } from '../../types/studium';
import { generateEducationalImage, analyzeImageForLearning } from '../../services/geminiService';
import { Spinner } from './Spinner';
import { Sparkles, Info, Maximize2, RefreshCw, Edit3, CheckCircle, XCircle, HelpCircle, MousePointer2 } from 'lucide-react';

const ASPECT_RATIOS = Object.values(AspectRatio);
const IMAGE_SIZES = Object.values(ImageSize);

type QuizType = 'find' | 'write';

export const InteractiveCanvas: React.FC = () => {
    const [topic, setTopic] = useState('');
    const [aspectRatio, setAspectRatio] = useState<AspectRatio>(AspectRatio.SQUARE);
    const [imageSize, setImageSize] = useState<ImageSize>(ImageSize.K1);
    const [loading, setLoading] = useState(false);
    const [analyzing, setAnalyzing] = useState(false);
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [labels, setLabels] = useState<InteractiveLabel[]>([]);
    const [selectedLabel, setSelectedLabel] = useState<InteractiveLabel | null>(null);

    // Quiz States
    const [quizMode, setQuizMode] = useState(false);
    const [quizType, setQuizType] = useState<QuizType>('find');
    const [quizCorrect, setQuizCorrect] = useState<string[]>([]); // For 'find' mode
    const [quizWrong, setQuizWrong] = useState<string | null>(null); // For 'find' mode
    const [revealedLabels, setRevealedLabels] = useState<string[]>([]); // For 'write' mode
    const [userGuess, setUserGuess] = useState('');
    const [guessError, setGuessError] = useState(false);

    const sidebarRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
    const guessInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (selectedLabel && sidebarRefs.current[selectedLabel.term]) {
            sidebarRefs.current[selectedLabel.term]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        // Focus input when entering write mode for a label
        if (quizMode && quizType === 'write' && selectedLabel && guessInputRef.current) {
            guessInputRef.current.focus();
        }
    }, [selectedLabel, quizMode, quizType]);

    const handleGenerate = async () => {
        if (!topic) return;
        setLoading(true);
        setLabels([]);
        setSelectedLabel(null);
        setImageUrl(null);
        resetQuiz();
        try {
            const url = await generateEducationalImage(topic, aspectRatio, imageSize);
            setImageUrl(url);

            // Auto-analyze after generation
            setAnalyzing(true);
            const extractedLabels = await analyzeImageForLearning(url);
            setLabels(extractedLabels);
        } catch (err) {
            alert("Failed to generate or analyze content. Please try again.");
        } finally {
            setLoading(false);
            setAnalyzing(false);
        }
    };

    const resetQuiz = () => {
        setQuizMode(false);
        setQuizCorrect([]);
        setQuizWrong(null);
        setRevealedLabels([]);
        setUserGuess('');
        setGuessError(false);
    };

    const toggleQuizMode = () => {
        if (quizMode) {
            resetQuiz();
        } else {
            setQuizMode(true);
            setQuizType('find'); // Default to find
        }
    };

    const handleLabelClick = (label: InteractiveLabel) => {
        if (quizMode) {
            if (quizType === 'find') {
                if (selectedLabel && selectedLabel.term === label.term) {
                    setQuizCorrect(prev => [...prev, label.term]);
                    setQuizWrong(null);
                    setSelectedLabel(null);
                } else {
                    setQuizWrong(label.term);
                }
            } else if (quizType === 'write') {
                if (!revealedLabels.includes(label.term)) {
                    setSelectedLabel(label);
                    setUserGuess('');
                    setGuessError(false);
                }
            }
        } else {
            setSelectedLabel(label);
        }
    };

    const submitGuess = () => {
        if (!selectedLabel) return;

        // Normalize strings for comparison (remove punctuation, extra spaces, case insensitive)
        const normalize = (s: string) => s.toLowerCase().replace(/[^\w\s]/g, '').trim();

        if (normalize(userGuess) === normalize(selectedLabel.term)) {
            setRevealedLabels(prev => [...prev, selectedLabel.term]);
            setSelectedLabel(null);
            setUserGuess('');
            setGuessError(false);
        } else {
            setGuessError(true);
        }
    };

    return (
        <div className="flex flex-col h-full space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-indigo-600" />
                    Lesson Generator
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div className="col-span-1 md:col-span-2">
                        <label className="block text-sm font-medium text-slate-700 mb-1">Topic</label>
                        <input
                            type="text"
                            value={topic}
                            onChange={(e) => setTopic(e.target.value)}
                            placeholder="e.g. Parts of a Plant Cell, The Solar System, Human Heart"
                            className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition text-slate-900"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Aspect Ratio</label>
                        <select
                            value={aspectRatio}
                            onChange={(e) => setAspectRatio(e.target.value as AspectRatio)}
                            className="w-full px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-900"
                        >
                            {ASPECT_RATIOS.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Resolution</label>
                        <select
                            value={imageSize}
                            onChange={(e) => setImageSize(e.target.value as ImageSize)}
                            className="w-full px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-900"
                        >
                            {IMAGE_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                </div>

                <button
                    onClick={handleGenerate}
                    disabled={loading || !topic}
                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-semibold rounded-lg transition flex items-center justify-center gap-2 shadow-md"
                >
                    {loading ? (
                        <>
                            <Spinner size="sm" color="text-white" />
                            {analyzing ? 'Analyzing Diagrams...' : 'Generating Visuals...'}
                        </>
                    ) : (
                        <>Generate Lesson</>
                    )}
                </button>
            </div>

            {(imageUrl || loading) && (
                <div className="flex flex-col lg:flex-row gap-6 animate-in fade-in duration-500">
                    {/* Image Canvas */}
                    <div className="flex-1 bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-center min-h-[400px] relative overflow-hidden group select-none">
                        {imageUrl ? (
                            <div className="relative">
                                <img
                                    src={imageUrl}
                                    alt="Generated educational content"
                                    className="max-h-[600px] w-full object-contain rounded-lg shadow-inner"
                                />
                                {/* Interactive Overlays */}
                                {labels.map((label, idx) => {
                                    if (!label.coordinates) return null;
                                    const { ymin, xmin, ymax, xmax } = label.coordinates;
                                    const isSelected = selectedLabel === label;

                                    // State checks
                                    const isFound = quizType === 'find' && quizCorrect.includes(label.term);
                                    const isRevealed = quizType === 'write' && revealedLabels.includes(label.term);
                                    const isWrong = quizType === 'find' && quizWrong === label.term;

                                    // Styling Logic
                                    let borderClass = 'border-white/30 border-dashed'; // Default explore mode
                                    let bgClass = 'hover:bg-indigo-400/10 hover:border-indigo-400';
                                    let content = null;

                                    if (quizMode) {
                                        if (quizType === 'find') {
                                            if (isFound) {
                                                borderClass = 'border-green-500 border-solid';
                                                bgClass = 'bg-green-500/20';
                                            } else if (isWrong) {
                                                borderClass = 'border-red-500 border-solid';
                                                bgClass = 'bg-red-500/20';
                                            } else {
                                                borderClass = 'border-white/50 border-dashed';
                                                bgClass = 'hover:bg-indigo-400/10';
                                            }
                                        } else if (quizType === 'write') {
                                            if (isRevealed) {
                                                borderClass = 'border-green-500 border-solid';
                                                bgClass = 'bg-green-500/10';
                                            } else {
                                                // Masked
                                                borderClass = 'border-slate-300 border-solid';
                                                bgClass = isSelected ? 'bg-indigo-500/40' : 'bg-slate-200/90 backdrop-blur-[2px]';
                                                content = (
                                                    <div className="absolute inset-0 flex items-center justify-center">
                                                        {isSelected ? (
                                                            <Edit3 className="w-4 h-4 text-white animate-pulse" />
                                                        ) : (
                                                            <span className="text-xs font-bold text-slate-400">?</span>
                                                        )}
                                                    </div>
                                                );
                                            }
                                        }
                                    } else {
                                        // Explore Mode
                                        if (isSelected) {
                                            borderClass = 'border-indigo-500 border-solid';
                                            bgClass = 'bg-indigo-500/20';
                                        }
                                    }

                                    return (
                                        <div
                                            key={idx}
                                            onClick={() => handleLabelClick(label)}
                                            className={`absolute cursor-pointer border-2 transition-all duration-300 rounded-sm ${borderClass} ${bgClass}`}
                                            style={{
                                                top: `${ymin / 10}%`,
                                                left: `${xmin / 10}%`,
                                                width: `${(xmax - xmin) / 10}%`,
                                                height: `${(ymax - ymin) / 10}%`,
                                            }}
                                        >
                                            {content}
                                            {/* Tooltip for Explore Mode */}
                                            {!quizMode && !isSelected && (
                                                <div className="opacity-0 hover:opacity-100 absolute -top-8 left-1/2 -translate-x-1/2 bg-black/75 text-white text-xs px-2 py-1 rounded whitespace-nowrap pointer-events-none transition-opacity z-10">
                                                    Click to learn
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center text-slate-400">
                                <Spinner size="lg" color="text-indigo-400" />
                                <p className="mt-4 text-sm font-medium">AI is drawing...</p>
                            </div>
                        )}
                        {imageUrl && (
                            <div className="absolute top-4 right-4 flex gap-2 z-10">
                                <button
                                    onClick={toggleQuizMode}
                                    className={`p-2 rounded-full backdrop-blur-md transition shadow-sm border border-white/20 ${quizMode ? 'bg-indigo-600 text-white' : 'bg-white/90 text-slate-700 hover:bg-white'
                                        }`}
                                    title={quizMode ? "Exit Quiz Mode" : "Start Quiz Mode"}
                                >
                                    <RefreshCw size={20} />
                                </button>
                                <button
                                    onClick={() => window.open(imageUrl, '_blank')}
                                    className="p-2 bg-white/90 text-slate-700 rounded-full hover:bg-white backdrop-blur-md shadow-sm border border-white/20"
                                    title="View Full Image"
                                >
                                    <Maximize2 size={20} />
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Interactive Panel */}
                    <div className="lg:w-96 flex flex-col space-y-4">
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 h-full flex flex-col">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                    <div className="flex items-center gap-2">
                                        {quizMode ? <HelpCircle className="w-5 h-5 text-indigo-500" /> : <Info className="w-5 h-5 text-indigo-500" />}
                                        {quizMode ? 'Quiz Mode' : 'Interactive Concepts'}
                                    </div>
                                </h3>
                                {!quizMode && labels.length > 0 && (
                                    <button
                                        onClick={toggleQuizMode}
                                        className="text-xs font-medium bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-full hover:bg-indigo-100 transition flex items-center gap-1"
                                    >
                                        <RefreshCw size={12} /> Start Quiz
                                    </button>
                                )}
                                {quizMode && (
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md">
                                            {quizType === 'find'
                                                ? `${quizCorrect.length}/${labels.length}`
                                                : `${revealedLabels.length}/${labels.length}`
                                            }
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* Quiz Type Selector */}
                            {quizMode && (
                                <div className="flex p-1 bg-slate-100 rounded-lg mb-4">
                                    <button
                                        onClick={() => { setQuizType('find'); setSelectedLabel(null); }}
                                        className={`flex-1 py-1.5 text-sm font-medium rounded-md transition ${quizType === 'find' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                                            }`}
                                    >
                                        Find the Label
                                    </button>
                                    <button
                                        onClick={() => { setQuizType('write'); setSelectedLabel(null); }}
                                        className={`flex-1 py-1.5 text-sm font-medium rounded-md transition ${quizType === 'write' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                                            }`}
                                    >
                                        Fill in Blanks
                                    </button>
                                </div>
                            )}

                            {analyzing ? (
                                <div className="flex-1 flex flex-col items-center justify-center text-slate-500 space-y-3">
                                    <Spinner size="md" color="text-indigo-500" />
                                    <p className="text-sm">Reading text labels...</p>
                                </div>
                            ) : labels.length > 0 ? (
                                <div className="flex-1 overflow-y-auto space-y-3 pr-2 max-h-[500px]">
                                    {quizMode ? (
                                        <div className="space-y-4">
                                            {/* Quiz Instructions / Active State */}
                                            {quizType === 'find' ? (
                                                <>
                                                    {selectedLabel ? (
                                                        <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100 text-center animate-in fade-in slide-in-from-bottom-4">
                                                            <p className="text-sm text-slate-600 mb-2">Find this label in the image:</p>
                                                            <h4 className="text-xl font-bold text-indigo-700 mb-1">{selectedLabel.term}</h4>
                                                            <p className="text-xs text-slate-500 italic">{selectedLabel.definition}</p>
                                                        </div>
                                                    ) : (
                                                        <div className="text-center text-slate-500 py-6 border-2 border-dashed border-slate-200 rounded-xl">
                                                            <MousePointer2 className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                                                            <p>Select a term below to start finding it!</p>
                                                        </div>
                                                    )}

                                                    <div className="grid grid-cols-1 gap-2">
                                                        {labels.filter(l => !quizCorrect.includes(l.term)).map((label, idx) => (
                                                            <button
                                                                key={idx}
                                                                onClick={() => setSelectedLabel(label)}
                                                                className={`p-3 rounded-lg border text-left transition ${selectedLabel === label
                                                                    ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500'
                                                                    : 'border-slate-200 hover:bg-slate-50'
                                                                    }`}
                                                            >
                                                                <span className="font-medium text-slate-700">{label.term}</span>
                                                            </button>
                                                        ))}
                                                    </div>
                                                </>
                                            ) : (
                                                // Write Mode
                                                <>
                                                    {selectedLabel ? (
                                                        <div className="p-4 bg-white rounded-xl border-2 border-indigo-100 shadow-sm animate-in fade-in slide-in-from-bottom-4">
                                                            <p className="text-sm text-slate-600 mb-3">What is the highlighted part?</p>
                                                            <div className="flex gap-2">
                                                                <input
                                                                    ref={guessInputRef}
                                                                    type="text"
                                                                    value={userGuess}
                                                                    onChange={(e) => setUserGuess(e.target.value)}
                                                                    onKeyDown={(e) => e.key === 'Enter' && submitGuess()}
                                                                    placeholder="Type the label name..."
                                                                    className={`flex-1 px-3 py-2 border rounded-lg outline-none transition ${guessError ? 'border-red-300 bg-red-50' : 'border-slate-300 focus:border-indigo-500'
                                                                        } text-slate-900`}
                                                                />
                                                                <button
                                                                    onClick={submitGuess}
                                                                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium"
                                                                >
                                                                    Check
                                                                </button>
                                                            </div>
                                                            {guessError && (
                                                                <p className="text-xs text-red-500 mt-2 flex items-center gap-1">
                                                                    <XCircle className="w-3 h-3" /> Incorrect, try again!
                                                                </p>
                                                            )}
                                                            <div className="mt-4 pt-4 border-t border-slate-100">
                                                                <p className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-1">Hint</p>
                                                                <p className="text-sm text-slate-600 italic">{selectedLabel.definition}</p>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="text-center text-slate-500 py-8 border-2 border-dashed border-slate-200 rounded-xl">
                                                            <Edit3 className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                                                            <p>Click a <span className="font-bold text-slate-700">?</span> box on the image to guess it!</p>
                                                        </div>
                                                    )}
                                                </>
                                            )}

                                            {/* Success State for Write Mode */}
                                            {quizType === 'write' && revealedLabels.length > 0 && (
                                                <div className="mt-6 pt-4 border-t border-slate-100">
                                                    <h5 className="text-sm font-semibold text-green-600 mb-2 flex items-center gap-1">
                                                        <CheckCircle className="w-4 h-4" /> Solved ({revealedLabels.length})
                                                    </h5>
                                                    <div className="flex flex-wrap gap-2">
                                                        {revealedLabels.map((term, i) => (
                                                            <span key={i} className="text-xs bg-green-50 text-green-700 px-2 py-1 rounded-md border border-green-100">
                                                                {term}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        // Explore Mode List
                                        labels.map((label, idx) => (
                                            <div
                                                key={idx}
                                                ref={el => sidebarRefs.current[label.term] = el}
                                                onClick={() => setSelectedLabel(label)}
                                                className={`p-3 rounded-xl border cursor-pointer transition-all ${selectedLabel === label
                                                    ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-100'
                                                    : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50'
                                                    }`}
                                            >
                                                <h4 className="font-semibold text-slate-800">{label.term}</h4>
                                                {selectedLabel === label && (
                                                    <div className="mt-2 text-sm text-slate-600 animate-in slide-in-from-top-2 duration-200">
                                                        <p className="mb-2">{label.definition}</p>
                                                        <p className="text-xs text-indigo-600 font-medium bg-indigo-100 inline-block px-2 py-1 rounded-md">
                                                            Did you know? {label.funFact}
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        ))
                                    )}
                                </div>
                            ) : (
                                <div className="flex-1 flex flex-col items-center justify-center text-slate-400 text-center p-4">
                                    <p>No labels detected yet.</p>
                                    {imageUrl && (
                                        <button
                                            onClick={async () => {
                                                setAnalyzing(true);
                                                const data = await analyzeImageForLearning(imageUrl);
                                                setLabels(data);
                                                setAnalyzing(false);
                                            }}
                                            className="mt-4 text-indigo-600 text-sm font-medium flex items-center gap-1 hover:underline"
                                        >
                                            <RefreshCw size={14} /> Retry Analysis
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div >
            )}
        </div >
    );
};
