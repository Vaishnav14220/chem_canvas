import React, { useState, useRef, useEffect } from 'react';
import { FileUp, Loader2, Sparkles, Download, Check, RefreshCw, BookOpen, ChevronRight, X } from 'lucide-react';
import { streamTextContent } from '../services/geminiService';

export const InteractiveAssignmentWorkspace: React.FC = () => {
    const [fileData, setFileData] = useState<{ mimeType: string, data: string } | null>(null);
    const [fileContent, setFileContent] = useState<string | null>(null); // Legacy text content
    const [fileName, setFileName] = useState<string | null>(null);
    const [topic, setTopic] = useState<string>('');
    const [extractFormulaSheet, setExtractFormulaSheet] = useState<boolean>(false);
    const [questionAndAnswer, setQuestionAndAnswer] = useState<boolean>(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedHtml, setGeneratedHtml] = useState<string | null>(null);
    const [previewHtml, setPreviewHtml] = useState<string>('');
    const [loadingStep, setLoadingStep] = useState<string>('Ready');
    const [thoughtLog, setThoughtLog] = useState<string[]>([]);
    const [isStreamingThoughts, setIsStreamingThoughts] = useState(false);
    const [showCursor, setShowCursor] = useState(true);
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const terminalRef = useRef<HTMLDivElement>(null);
    // Remove any external polyfill.io scripts the model might inject so previews don't fail on blocked domains
    const stripPolyfillScripts = (html: string) =>
        html.replace(
            /<script[^>]+src=[\"']https?:\/\/(?:cdn\.)?polyfill\.io\/[^\"']+[\"'][^>]*>\s*<\/script>/gi,
            ''
        );

    // Animated cursor effect
    useEffect(() => {
        if (!isStreamingThoughts) {
            setShowCursor(false);
            return;
        }
        const interval = setInterval(() => {
            setShowCursor((prev) => !prev);
        }, 500);
        return () => clearInterval(interval);
    }, [isStreamingThoughts]);

    // Auto-scroll terminal
    React.useEffect(() => {
        if (terminalRef.current) {
            terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
        }
    }, [thoughtLog]);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setFileName(file.name);
        setLoadingStep('Reading file...');

        // Check if it's an image or PDF
        if (file.type.startsWith('image/') || file.type === 'application/pdf') {
            const reader = new FileReader();
            reader.onload = (e) => {
                const base64String = e.target?.result as string;
                // Remove data URL prefix
                const base64Data = base64String.split(',')[1];
                setFileData({
                    mimeType: file.type,
                    data: base64Data
                });
                setFileContent(null); // Clear legacy text content
                setLoadingStep('Ready to generate (File attached)');
            };
            reader.readAsDataURL(file);
        } else {
            // Fallback for text files
            const reader = new FileReader();
            reader.onload = (e) => {
                const text = e.target?.result as string;
                setFileContent(text);
                setFileData(null);
                setLoadingStep('Ready to generate');
            };
            reader.readAsText(file);
        }
    };

    const handleGenerate = async () => {
        if (!fileContent && !fileData && !topic) return;

        setIsGenerating(true);
        setLoadingStep('Initializing Gemini 3 Pro...');
        setGeneratedHtml(null);
        setPreviewHtml('');
        setThoughtLog([]);
        setIsStreamingThoughts(true);

        try {
            const prompt = `
        Content to process:
        ${fileContent ? `Uploaded File Content:\n${fileContent.slice(0, 20000)}...` : ''}
        ${fileData ? '[Attached File Processing Active]' : ''}
        
        Topic/Context: ${topic || 'General Science/Math'}

        Create a single, self-contained HTML file to explain [${topic || fileName || 'the provided concept'}]. 
        
        CRITICAL INSTRUCTION:
        If an uploaded file (PDF/Image) is provided, you MUST solve EVERY SINGLE QUESTION or concept presented in it. 
        Do not skip any questions. Be exhaustive.
        
        STRICT OUTPUT FORMAT:
        The HTML must follow this exact structure sequentially:
        
        1. **The Question/Problem**: State the core problem(s) or concept(s) clearly at the top. If multiple questions, list them all.
        2. **The Answer/Explanation**: Provide a detailed, step-by-step solution or explanation for EACH question found.
        3. **Visual Diagrams (SVG)**: Include static or semi-static SVG diagrams to illustrate the concept next.
        4. **Interactive Simulation (Canvas)**: AFTER the answer and diagrams, you MUST provide a fully animated, high-frame-rate Canvas simulation.
           - REQUIREMENT: Use 'requestAnimationFrame' to create a smooth animation loop.
           - REQUIREMENT: The canvas must NOT be static. It should animate parameters over time (e.g., a wave moving, a projectile flying, a graph drawing live).
           - Include interactive controls (sliders, run/pause buttons).
           - The simulation should visually demonstrate the physics/math concepts in motion.
        
        Tech Stack & Styling:
        - Use Tailwind CSS for a clean, modern, responsive design via CDN.
        - Use MathJax for professional LaTeX rendering of all formulas via CDN.
        - Ensure all JavaScript is contained within the single HTML file.
        
        IMPORTANT: Return ONLY the raw HTML code starting with <!DOCTYPE html> and ending with </html>.
      `;

            let accumulatedHtml = '';
            const sanitizePartialHtml = (html: string) =>
                stripPolyfillScripts(html.replace(/^\s*```html\s*/i, '').replace(/```$/, ''));

            await streamTextContent(
                prompt,
                (chunk) => {
                    accumulatedHtml += chunk;
                },
                {
                    model: 'gemini-3-pro-preview',
                    thinking: 'high',
                    inlineData: fileData || undefined,
                    onThought: (thought) => {
                        setThoughtLog(prev => [...prev, thought]);
                        setLoadingStep('Thinking...');
                        setIsStreamingThoughts(true);
                    }
                }
            );

            // Clean up response if it contains markdown code blocks
            const cleanHtml = sanitizePartialHtml(accumulatedHtml).trim();

            setThoughtLog(prev => [...prev, '✅ Generation complete']);

            // Short delay to show completion before switching to preview
            await new Promise(resolve => setTimeout(resolve, 1500));
            setGeneratedHtml(cleanHtml);
            setPreviewHtml(cleanHtml);
            setLoadingStep('Complete!');
        } catch (error) {
            console.error('Generation failed:', error);
            setLoadingStep('Error encountered. Please try again.');
            setThoughtLog(prev => [...prev, `❌ Error: ${error}`]);
        } finally {
            setIsGenerating(false);
            setIsStreamingThoughts(false);
        }
    };

    const handleDownload = () => {
        if (!generatedHtml) return;
        const blob = new Blob([generatedHtml], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `interactive-${(topic || fileName || 'assignment').replace(/\s+/g, '-').toLowerCase()}.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const previewDoc = previewHtml || generatedHtml || '';
    const canGenerate = Boolean(fileContent || fileData || topic);
    const disableGenerate = isGenerating || !canGenerate;

    return (
        <div className="flex flex-1 w-full h-screen min-h-screen max-h-screen bg-[#eef2f7] overflow-hidden text-slate-900">
            {/* Left Sidebar - Input & Thinking Stream */}
            {sidebarOpen && (
                <div className="w-96 flex-shrink-0 border-r border-white/10 flex flex-col overflow-hidden z-20 shadow-[0_20px_60px_rgba(0,0,0,0.35)] h-screen" style={{ backgroundColor: '#1F1F1F' }}>
                    {/* Main Content Area */}
                    <div className="flex-1 overflow-y-auto flex flex-col p-6 gap-6">
                        {/* File Upload */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">1. Upload Source Material</label>
                            <div
                                onClick={() => fileInputRef.current?.click()}
                                className="border border-white/10 bg-white/5 hover:bg-white/10 p-5 flex flex-col items-center justify-center cursor-pointer transition-all group"
                            >
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    className="hidden"
                                    accept=".txt,.md,.pdf,.html"
                                    onChange={handleFileUpload}
                                />
                                {fileName ? (
                                    <div className="flex flex-col items-center text-slate-100">
                                        <Check className="w-7 h-7 mb-2" />
                                        <span className="text-xs font-medium text-center break-all">{fileName}</span>
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
                                value={topic}
                                onChange={(e) => setTopic(e.target.value)}
                                className="w-full px-4 py-2 bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:ring-2 focus:ring-[#3b5b8a] focus:border-transparent outline-none transition-all"
                            />
                        </div>

                        {/* Options */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">Options</label>
                            <div className="flex flex-col gap-2">
                                <button
                                    type="button"
                                    onClick={() => setExtractFormulaSheet(!extractFormulaSheet)}
                                    className={`w-full px-4 py-2.5 text-sm font-medium transition-all ${
                                        extractFormulaSheet
                                            ? 'bg-[#3b5b8a] text-white border border-[#4a6ba8] shadow-md'
                                            : 'bg-white/5 text-slate-300 border border-white/10 hover:bg-white/10 hover:text-white'
                                    }`}
                                >
                                    Extract Formula Sheet
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setQuestionAndAnswer(!questionAndAnswer)}
                                    className={`w-full px-4 py-2.5 text-sm font-medium transition-all ${
                                        questionAndAnswer
                                            ? 'bg-[#3b5b8a] text-white border border-[#4a6ba8] shadow-md'
                                            : 'bg-white/5 text-slate-300 border border-white/10 hover:bg-white/10 hover:text-white'
                                    }`}
                                >
                                    Question and Answer
                                </button>
                            </div>
                        </div>

                        {/* Generate Button */}
                        <button
                            onClick={handleGenerate}
                            disabled={disableGenerate}
                            className={`
            w-full py-3 flex items-center justify-center gap-2 font-semibold text-sm uppercase tracking-wide transition-all
            ${disableGenerate
                                ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                                : 'bg-[#2c4066] text-white hover:bg-[#34507c] active:scale-95'}
          `}
                        >
                            {isGenerating ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span className="text-xs">{loadingStep}</span>
                                </>
                            ) : (
                                <>
                                    <Sparkles className="w-4 h-4" />
                                    <span>Generate</span>
                                </>
                            )}
                        </button>

                        <div className="h-px bg-slate-700"></div>
                    </div>

                    {/* Collapse Button */}
                    <div className="border-t border-slate-700 p-3">
                        <button
                            onClick={() => setSidebarOpen(false)}
                            className="w-full px-3 py-2 text-xs text-slate-400 hover:text-slate-300 hover:bg-slate-800 transition-colors flex items-center justify-center gap-2"
                        >
                            <ChevronRight className="w-4 h-4" />
                            <span>Collapse Panel</span>
                        </button>
                    </div>
                </div>
            )}

            {/* Right Side - Full Width HTML Preview */}
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

                {/* HTML Preview - FULL HEIGHT */}
                <div className="flex-1 w-full h-full min-h-0 overflow-auto">
                    {previewDoc ? (
                        <iframe
                            srcDoc={previewDoc}
                            className="w-full h-full min-h-screen border-0 block"
                            title="Interactive Preview"
                            sandbox="allow-scripts allow-same-origin"
                        />
                    ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-[#f6f8fc] text-slate-500 px-8 overflow-auto">
                            {isGenerating ? (
                                <div className="flex flex-col items-center gap-6 text-center max-w-md">
                                    <div className="relative w-16 h-16">
                                        <div className="absolute inset-0 bg-slate-300 opacity-40 blur-xl"></div>
                                        <Loader2 className="w-16 h-16 animate-spin text-[#2c4066] relative" />
                                    </div>
                                    <div>
                                        <p className="text-lg font-bold text-slate-700 mb-2">Generating Interactive Content</p>
                                        <p className="text-sm text-slate-500 mb-4">Watch the thinking stream on the left for live reasoning process</p>
                                        <div className="flex items-center justify-center gap-2 text-xs text-[#2c4066]">
                                            <span className="inline-block w-2 h-2 bg-[#2c4066] animate-pulse"></span>
                                            <span>Gemini 3 Pro is thinking...</span>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center gap-6 text-center max-w-xl">
                                    <div className="w-24 h-24 bg-[#e4e9f2] flex items-center justify-center">
                                        <BookOpen className="w-12 h-12 text-[#2c4066]" />
                                    </div>
                                    <div>
                                        <h3 className="text-2xl font-bold text-slate-700 mb-2">Ready to Explore</h3>
                                        <p className="text-slate-500 mb-6">
                                            Upload a file or enter a topic, then generate an interactive learning experience powered by Gemini 3 Pro with live reasoning.
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
                            )}
                        </div>
                    )}
                </div>

                {/* Toolbar - Bottom when content is ready */}
                {generatedHtml && (
                    <div className="h-16 border-t border-slate-200 bg-white flex items-center justify-between px-6 flex-shrink-0">
                        <div className="flex items-center gap-3">
                            <span className="w-2.5 h-2.5 bg-green-500 animate-pulse"></span>
                            <span className="text-sm font-medium text-slate-600">Preview Active</span>
                            <span className="text-xs text-slate-400">• Self-contained HTML file</span>
                        </div>
                        <div className="flex items-center gap-4">
                            <button
                                onClick={handleGenerate}
                                className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                                title="Regenerate"
                            >
                                <RefreshCw className="w-5 h-5" />
                            </button>
                            <div className="h-6 w-px bg-slate-200"></div>
                            <button
                                onClick={handleDownload}
                                className="flex items-center gap-2 px-4 py-2 bg-[#2c4066] text-white hover:bg-[#34507c] transition-all font-medium text-sm"
                            >
                                <Download className="w-4 h-4" />
                                Download HTML
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
