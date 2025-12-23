import React, { useState } from 'react';
import { Upload, Scan, FileText } from 'lucide-react';
import { analyzeUploadedImage } from '../../services/geminiService';
import { Spinner } from './Spinner';

export const ImageAnalyzer: React.FC = () => {
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [analysis, setAnalysis] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [prompt, setPrompt] = useState('');

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const selected = e.target.files[0];
            setFile(selected);
            setPreview(URL.createObjectURL(selected));
            setAnalysis('');
        }
    };

    const handleAnalyze = async () => {
        if (!file) return;
        setLoading(true);
        try {
            const result = await analyzeUploadedImage(file, prompt);
            setAnalysis(result);
        } catch (error) {
            setAnalysis("Error analyzing the image. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col">
                <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                    <Scan className="text-indigo-600" />
                    Upload & Analyze
                </h2>

                <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50 hover:bg-slate-100 transition p-8 relative">
                    {preview ? (
                        <img
                            src={preview}
                            alt="Preview"
                            className="max-h-[300px] object-contain rounded-lg shadow-sm mb-4"
                        />
                    ) : (
                        <div className="text-center text-slate-400 mb-4">
                            <Upload className="mx-auto h-12 w-12 mb-3 opacity-50" />
                            <p className="font-medium">Click to upload an image</p>
                            <p className="text-xs mt-1">PNG, JPG up to 5MB</p>
                        </div>
                    )}
                    <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileChange}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                </div>

                <div className="mt-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Custom Prompt (Optional)</label>
                        <input
                            type="text"
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder="e.g. Solve this math problem, Explain this diagram..."
                            className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900"
                        />
                    </div>
                    <button
                        onClick={handleAnalyze}
                        disabled={!file || loading}
                        className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-semibold rounded-lg transition shadow-md flex justify-center items-center gap-2"
                    >
                        {loading ? <Spinner size="sm" color="text-white" /> : <><Scan size={18} /> Analyze Image</>}
                    </button>
                </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col">
                <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <FileText className="text-indigo-600" />
                    Analysis Results
                </h3>
                <div className="flex-1 bg-slate-50 rounded-xl p-4 overflow-y-auto border border-slate-200">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-4">
                            <Spinner size="lg" color="text-indigo-400" />
                            <p>Gemini is studying the image...</p>
                        </div>
                    ) : analysis ? (
                        <div className="prose prose-slate max-w-none">
                            <p className="whitespace-pre-wrap text-slate-700 leading-relaxed">{analysis}</p>
                        </div>
                    ) : (
                        <div className="flex items-center justify-center h-full text-slate-400 text-sm">
                            Results will appear here
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
