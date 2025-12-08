import React, { useState, useRef } from 'react';
import { FileUp, Loader2, Sparkles, Download, Check, RefreshCw, BookOpen, ChevronRight } from 'lucide-react';
import { streamTextContent } from '../services/geminiService';

export const InteractiveAssignmentWorkspace: React.FC = () => {
    const [fileData, setFileData] = useState<{ mimeType: string, data: string } | null>(null);
    const [fileContent, setFileContent] = useState<string | null>(null); // Legacy text content
    const [fileName, setFileName] = useState<string | null>(null);
    const [topic, setTopic] = useState<string>('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedHtml, setGeneratedHtml] = useState<string | null>(null);
    const [previewHtml, setPreviewHtml] = useState<string>('');
    const [loadingStep, setLoadingStep] = useState<string>('Ready');
    const [thoughtLog, setThoughtLog] = useState<string[]>([]);
    const [isStreamingThoughts, setIsStreamingThoughts] = useState(false);
    const terminalRef = useRef<HTMLDivElement>(null);
    // Remove any external polyfill.io scripts the model might inject so previews don't fail on blocked domains
    const stripPolyfillScripts = (html: string) =>
        html.replace(
            /<script[^>]+src=[\"']https?:\/\/(?:cdn\.)?polyfill\.io\/[^\"']+[\"'][^>]*>\s*<\/script>/gi,
            ''
        );

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
        <div className="flex flex-1 h-full min-h-0 bg-slate-50 overflow-hidden">
            {/* Sidebar / Configuration Panel */}
            <div className="w-96 flex-shrink-0 bg-white border-r border-slate-200 p-6 flex flex-col gap-6 overflow-y-auto z-10 shadow-sm">
                <div className="flex items-center gap-3 text-indigo-600 mb-2">
                    <Sparkles className="w-6 h-6" />
                    <h2 className="text-xl font-bold text-slate-800">Interactive Tutor</h2>
                </div>

                <p className="text-slate-600 text-sm">
                    Upload your assignment or notes, and Gemini will create an interactive HTML simulation for you.
                </p>

                {/* File Upload */}
                <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">1. Upload Source Material (Optional)</label>
                    <div
                        onClick={() => fileInputRef.current?.click()}
                        className="border-2 border-dashed border-slate-300 rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50 transition-colors group"
                    >
                        <input
                            type="file"
                            ref={fileInputRef}
                            className="hidden"
                            accept=".txt,.md,.pdf,.html" // Note: PDF parsing needs a separate service, assuming text for now or raw pass
                            onChange={handleFileUpload}
                        />
                        {fileName ? (
                            <div className="flex flex-col items-center text-indigo-600">
                                <Check className="w-8 h-8 mb-2" />
                                <span className="text-sm font-medium text-center break-all">{fileName}</span>
                                <span className="text-xs text-indigo-400 mt-1">Click to replace</span>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center text-slate-400 group-hover:text-indigo-500">
                                <FileUp className="w-8 h-8 mb-2" />
                                <span className="text-sm font-medium">Upload Assignment / Notes</span>
                                <span className="text-xs mt-1">Text files supported</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Topic Input */}
                <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">2. Topic / Concept Name</label>
                    <input
                        type="text"
                        placeholder="e.g. Projectile Motion, Calculus Limits..."
                        value={topic}
                        onChange={(e) => setTopic(e.target.value)}
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    />
                </div>

                {/* Generate Button */}
                <button
                    onClick={handleGenerate}
                    disabled={disableGenerate}
                    className={`
            w-full py-3 rounded-xl flex items-center justify-center gap-2 font-semibold text-white shadow-lg transition-all
            ${disableGenerate
                            ? 'bg-slate-400 cursor-not-allowed'
                            : 'bg-gradient-to-r from-indigo-500 to-purple-600 hover:shadow-indigo-500/25 active:scale-95'}
          `}
                >
                    {isGenerating ? (
                        <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            <span>{loadingStep}</span>
                        </>
                    ) : (
                        <>
                            <Sparkles className="w-5 h-5" />
                            <span>Generate Interaction</span>
                        </>
                    )}
                </button>

                <div className="mt-auto flex flex-col gap-3">
                    <div className="rounded-2xl border border-slate-200 bg-slate-900 text-slate-100 shadow-inner">
                        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
                            <div className="flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                                <span className="text-xs font-semibold tracking-wide uppercase text-emerald-100">Gemini 3 Pro Thinking</span>
                            </div>
                            <span className="text-[11px] font-mono text-slate-400">
                                {isGenerating ? 'Streaming' : 'Idle'}
                            </span>
                        </div>
                        <div
                            ref={terminalRef}
                            className="p-4 h-44 overflow-y-auto space-y-3 text-[13px] leading-relaxed font-mono custom-scrollbar"
                        >
                            {thoughtLog.length === 0 ? (
                                <div className="text-slate-500 italic flex items-center gap-3">
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span>{isGenerating ? 'Initializing reasoning context...' : 'No thoughts yet.'}</span>
                                </div>
                            ) : (
                                thoughtLog.map((log, idx) => (
                                    <div key={idx} className="flex gap-3 text-emerald-100/90">
                                        <ChevronRight className="w-4 h-4 flex-shrink-0 mt-1 text-emerald-300/70" />
                                        <span className="whitespace-pre-wrap">
                                            {log}
                                            {idx === thoughtLog.length - 1 && isStreamingThoughts && (
                                                <span className="inline-block w-2 h-4 bg-emerald-400 ml-1 align-middle animate-pulse rounded-sm" />
                                            )}
                                        </span>
                                    </div>
                                ))
                            )}
                            {isGenerating && thoughtLog.length > 0 && (
                                <div className="flex items-center gap-2 text-emerald-300/80">
                                    <span className="inline-block w-2 h-4 bg-emerald-400 animate-pulse rounded-sm"></span>
                                    <span className="text-xs">Live cursor streaming</span>
                                </div>
                            )}
                            {isGenerating && thoughtLog.length === 0 && (
                                <div className="flex items-center gap-2 text-emerald-300/80">
                                    <span className="inline-block w-2 h-4 bg-emerald-400 animate-pulse rounded-sm"></span>
                                    <span className="text-xs">Spinning up context...</span>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 text-sm text-blue-800">
                        <strong>Tip:</strong> Be specific with the topic name for better simulations. The generated file is self-contained and runs offline.
                    </div>
                </div>
            </div>

            {/* Preview Area */}
            <div className="flex-1 bg-slate-100 h-full overflow-hidden flex flex-col relative text-left">
                <div className="flex-1 bg-white shadow-sm border-l border-slate-200 overflow-hidden relative flex flex-col min-h-0">
                    {previewDoc ? (
                        <iframe
                            srcDoc={previewDoc}
                            className="w-full h-full border-0 block flex-1"
                            title="Interactive Preview"
                            sandbox="allow-scripts allow-same-origin"
                        />
                    ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50 text-slate-400 px-6">
                            {isGenerating ? (
                                <div className="flex flex-col items-center gap-4 text-center">
                                    <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                                    <div>
                                        <p className="text-slate-500 font-medium">Gemini 3 Pro is generating your HTML</p>
                                        <p className="text-sm text-slate-400">Thinking stream stays on the left. Preview appears here after generation completes.</p>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div className="w-32 h-32 bg-slate-100 rounded-full flex items-center justify-center mb-6">
                                        <BookOpen className="w-12 h-12 text-slate-300" />
                                    </div>
                                    <h3 className="text-xl font-semibold text-slate-500 mb-2">Ready to Learn</h3>
                                    <p className="max-w-md text-center text-slate-400">
                                        Your generated interactive assignment will appear here.
                                    </p>
                                </>
                            )}
                        </div>
                    )}
                </div>

                {/* Toolbar */}
                {generatedHtml && (
                    <div className="h-16 mt-4 bg-white rounded-xl shadow-sm border border-slate-200 flex items-center justify-between px-6 flex-shrink-0 mx-4 mb-4">
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                            <span className="text-sm font-medium text-slate-600">Preview Active</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={handleGenerate}
                                className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                title="Regenerate"
                            >
                                <RefreshCw className="w-5 h-5" />
                            </button>
                            <div className="h-6 w-px bg-slate-200"></div>
                            <button
                                onClick={handleDownload}
                                className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors font-medium text-sm"
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
