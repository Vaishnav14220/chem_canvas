import React, { useState } from 'react';
import { AspectRatio, ImageSize, InteractiveLabel } from '../../types/studium';
import { generateEducationalImage, analyzeImageForLearning } from '../../services/geminiService';
import { Spinner } from './Spinner';
import { Sparkles, Info, Maximize2, RefreshCw } from 'lucide-react';

const ASPECT_RATIOS = Object.values(AspectRatio);
const IMAGE_SIZES = Object.values(ImageSize);

export const InteractiveCanvas: React.FC = () => {
    const [topic, setTopic] = useState('');
    const [aspectRatio, setAspectRatio] = useState<AspectRatio>(AspectRatio.SQUARE);
    const [imageSize, setImageSize] = useState<ImageSize>(ImageSize.K1);
    const [loading, setLoading] = useState(false);
    const [analyzing, setAnalyzing] = useState(false);
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [labels, setLabels] = useState<InteractiveLabel[]>([]);
    const [selectedLabel, setSelectedLabel] = useState<InteractiveLabel | null>(null);

    const handleGenerate = async () => {
        if (!topic) return;
        setLoading(true);
        setLabels([]);
        setSelectedLabel(null);
        setImageUrl(null);
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
                            className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Aspect Ratio</label>
                        <select
                            value={aspectRatio}
                            onChange={(e) => setAspectRatio(e.target.value as AspectRatio)}
                            className="w-full px-4 py-2 rounded-lg border border-slate-300 bg-white"
                        >
                            {ASPECT_RATIOS.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Resolution</label>
                        <select
                            value={imageSize}
                            onChange={(e) => setImageSize(e.target.value as ImageSize)}
                            className="w-full px-4 py-2 rounded-lg border border-slate-300 bg-white"
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
                    <div className="flex-1 bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-center min-h-[400px] relative overflow-hidden group">
                        {imageUrl ? (
                            <img
                                src={imageUrl}
                                alt="Generated educational content"
                                className="max-h-[600px] w-full object-contain rounded-lg shadow-inner"
                            />
                        ) : (
                            <div className="flex flex-col items-center text-slate-400">
                                <Spinner size="lg" color="text-indigo-400" />
                                <p className="mt-4 text-sm font-medium">AI is drawing...</p>
                            </div>
                        )}
                        {imageUrl && (
                            <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition">
                                <button
                                    onClick={() => window.open(imageUrl, '_blank')}
                                    className="p-2 bg-black/50 text-white rounded-full hover:bg-black/70 backdrop-blur-sm"
                                >
                                    <Maximize2 size={20} />
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Interactive Panel */}
                    <div className="lg:w-96 flex flex-col space-y-4">
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 h-full flex flex-col">
                            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                                <Info className="w-5 h-5 text-indigo-500" />
                                Interactive Concepts
                            </h3>

                            {analyzing ? (
                                <div className="flex-1 flex flex-col items-center justify-center text-slate-500 space-y-3">
                                    <Spinner size="md" color="text-indigo-500" />
                                    <p className="text-sm">Reading text labels...</p>
                                </div>
                            ) : labels.length > 0 ? (
                                <div className="flex-1 overflow-y-auto space-y-3 pr-2 max-h-[500px]">
                                    {labels.map((label, idx) => (
                                        <div
                                            key={idx}
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
                                    ))}
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
                </div>
            )}
        </div>
    );
};
