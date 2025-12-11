import React, { useState, useRef, useEffect } from 'react';

import {
    FileUp,
    Loader2,
    Sparkles,
    Download,
    Check,
    RefreshCw,
    BookOpen,
    ChevronRight,
    Copy,
    CheckCircle2,
    AlertCircle,
    Play,
    FileText
} from 'lucide-react';
import { extractLatexCode } from '../utils/latexUtils';
import { streamTextContent } from '../services/geminiService';
import { compileLatexWithGemini } from '../services/latexAgentService';
import CodeMirror from '@uiw/react-codemirror';
import { vscodeDark } from '@uiw/codemirror-theme-vscode';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

interface LaTeXAssignmentPrepProps {
}

export const LaTeXAssignmentPrep: React.FC<LaTeXAssignmentPrepProps> = () => {
    const [topic, setTopic] = useState('');
    const [fileContent, setFileContent] = useState('');
    const [fileData, setFileData] = useState<{ content: string; type: string } | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [latexOutput, setLatexOutput] = useState('');
    const [error, setError] = useState('');
    const [showCursor, setShowCursor] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [isStreamingLatex, setIsStreamingLatex] = useState(false);
    const [copied, setCopied] = useState(false);

    // New state for code execution & PDF
    const [pdfUrl, setPdfUrl] = useState<string | null>(null);
    const [isCompiling, setIsCompiling] = useState(false);
    const [activeTab, setActiveTab] = useState<'code' | 'pdf'>('code');

    const fileInputRef = useRef<HTMLInputElement>(null);
    const latexOutputRef = useRef<HTMLDivElement>(null);

    // Animated cursor effect
    useEffect(() => {
        if (!isStreamingLatex) return;
        const interval = setInterval(() => {
            setShowCursor((prev) => !prev);
        }, 500);
        return () => clearInterval(interval);
    }, [isStreamingLatex]);

    // Auto-scroll to bottom when streaming
    useEffect(() => {
        if (latexOutputRef.current) {
            latexOutputRef.current.scrollTop = latexOutputRef.current.scrollHeight;
        }
    }, [latexOutput]);

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setError('');
        const reader = new FileReader();

        reader.onload = async (e) => {
            const content = e.target?.result as string;
            if (file.type === 'application/pdf') {
                try {
                    const base64 = content.split(',')[1] || content;
                    setFileData({ content: base64, type: 'application/pdf' });
                    setFileContent(file.name);
                } catch (err) {
                    setError('Failed to process PDF');
                }
            } else if (file.type.startsWith('image/')) {
                try {
                    const base64 = content.split(',')[1] || content;
                    setFileData({ content: base64, type: file.type });
                    setFileContent(file.name);
                } catch (err) {
                    setError('Failed to process image');
                }
            } else {
                setFileContent(content);
                setFileData(null);
            }
        };

        reader.readAsDataURL(file);
    };

    const handleGenerate = async () => {
        if (!fileContent && !topic) {
            setError('Please upload a file or enter a topic');
            return;
        }

        setIsGenerating(true);
        setError('');
        setLatexOutput('');
        setIsStreamingLatex(true);

        try {
            const prompt_text = `Role: You are an expert University Teaching Assistant and academic tutor. Your goal is to prepare students for upcoming laboratory sessions or exams by synthesizing their specific course materials into a single, comprehensive "Preparation Guide."

Context: I will provide you with two types of documents:
- The Lecture Source: (e.g., Scripts, Slides, Textbook excerpts). This contains the theory, definitions, and formulas.
- The Task Sheet: (e.g., Lab Manual, Worksheet, Assignment, Exam questions). This contains the specific problems, coding tasks, or experiments to perform.

Material provided:
${fileContent ? `Source: ${fileContent}` : 'No file uploaded'}
${topic ? `Topic/Description: ${topic}` : 'User will provide context through file'}

Your Task: Generate a complete, self-contained LaTeX document that helps students prepare for the tasks using the theory from the Lecture Source.

Output Structure (LaTeX) - MUST Include ALL of the following:

PART 1: THEORETICAL FOUNDATIONS & TEST PREP
- Analyze the Task Sheet to identify core topics
- Search the Lecture Source for corresponding definitions, physical principles, equations, algorithms
- Summarize theory clearly, explaining why things work the way they do
- Goal: Provide all answers for pre-lab quizzes or oral exams based on the script

PART 2: WORKSHEET SOLUTIONS & PRACTICAL GUIDE
For Calculation Questions: Provide step-by-step mathematical derivations using LaTeX math mode. Show how formulas from Lecture Source are applied to specific values in Task Sheet.
For Conceptual Questions: Provide reasoned, academic answers citing principles from Lecture Source.
For Coding/Implementation Tasks: Provide complete, commented code solutions inside lstlisting environments with explanations.

PART 3: FURTHER PRACTICE & QUESTIONS (NEW)
- Generate 10-20 conceptual and calculation-based questions similar to the Task Sheet
- Provide detailed solutions for each question
- Organize by difficulty level (Easy, Medium, Hard)
- Include step-by-step workings

PART 4: FORMULA SHEET & GLOSSARY (NEW)
- Compile ALL formulas used in the document with explanations
- Include SI units where applicable
- Provide a glossary of all technical terms used
- Organize formulas by topic/chapter

PART 5: DIAGRAMS, FIGURES & VISUAL AIDS (NEW)
- Extract any diagrams or figures from uploaded PDFs and describe them
- Use TikZ to recreate important diagrams (flowcharts, molecular structures, circuit diagrams, etc.)
- Create visual representations of key concepts using pgfplots for graphs
- Generate high-quality figures that support learning

PART 6: GENERATED IMAGERY & ILLUSTRATIONS (NEW)
- Create conceptual diagrams using TikZ for abstract concepts
- Generate ASCII art or LaTeX-based visualizations where appropriate
- Use pgfplots to create publication-quality graphs and charts
- Ensure all graphics are vector-based and scalable

LaTeX Formatting Rules - CRITICAL:
- Use \documentclass{article}
- Include packages: geometry (A4, reasonable margins), amsmath, amssymb, listings (for code), xcolor, hyperref, enumitem, tikz, pgfplots, graphicx
- Ensure document compiles without errors in standard LaTeX distributions
- Use \section{} and \subsection{} to organize by topic/task number
- For PDFs: Extract text and diagrams, integrate into document
- For images: Include descriptions and TikZ recreations
- Code formatting: Use listings package with syntax highlighting
- Professional formatting: proper spacing, font sizing, colors
- Page breaks: Use strategically between major sections
- Table of contents: Include \tableofcontents after title page

Output Requirements - MANDATORY:
- Generate ONLY complete, compilable LaTeX code
- Start with \\documentclass{article}
- End with \\end{document}
- NO explanations, notes, or markdown formatting outside LaTeX
- Code MUST compile without errors in Overleaf and local LaTeX distributions
- Make it immediately usable for copying into Overleaf
- Include proper PDF generation support

Special Instructions:
- If variables/values are missing: State assumptions clearly
- Tone: Educational, professional, encouraging, precise
- Include headers with course name, date, student name fields
- Add page numbers and section numbering
- Use color coding for different types of information (formulas in blue, code in green, warnings in red)
- Ensure mathematical notation is rigorous and academically sound
- Make diagrams informative and publication-quality`;

            let fullOutput = '';

            await streamTextContent(
                prompt_text,
                (chunk: string) => {
                    fullOutput += chunk;
                    setLatexOutput((prev) => prev + chunk);
                },
                {
                    model: 'gemini-3-pro-preview',
                    thinking: 'high' as const,
                    timeout: 300000, // 5 minutes for long LaTeX generation
                    onThought: () => { }, // Not needed for LaTeX output
                    inlineData: fileData ? {
                        mimeType: fileData.type,
                        data: fileData.content
                    } : undefined
                }
            );

            setIsStreamingLatex(false);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to generate LaTeX');
            setIsStreamingLatex(false);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleDownload = () => {
        if (!latexOutput) return;

        const cleanLatex = extractLatexCode(latexOutput);

        const element = document.createElement('a');
        element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(cleanLatex));
        element.setAttribute('download', 'assignment.tex');
        element.style.display = 'none';
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
    };

    const handleCopy = async () => {
        try {
            const cleanLatex = extractLatexCode(latexOutput);
            await navigator.clipboard.writeText(cleanLatex);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            setError('Failed to copy to clipboard');
        }
    };

    const handleCompile = async () => {
        if (!latexOutput) return;

        setIsCompiling(true);
        setError('');
        setPdfUrl(null);
        setActiveTab('pdf'); // Switch to PDF tab to show loading state

        try {
            const cleanLatex = extractLatexCode(latexOutput);
            const result = await compileLatexWithGemini(cleanLatex, 'main.tex');

            if (result.success && result.pdfUrl) {
                setPdfUrl(result.pdfUrl);
            } else {
                setError(result.log || 'Compilation failed');
                // Create a blob URL for log if needed, or just show error
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Compilation failed');
        } finally {
            setIsCompiling(false);
        }
    };

    return (
        <div className="flex flex-1 w-full h-screen min-h-screen max-h-screen bg-[#0b1220] text-slate-100 overflow-hidden">
            {/* Left Sidebar - Input & Controls */}
            {sidebarOpen && (
                <div className="w-[26rem] flex-shrink-0 bg-[#0e172b] border-r border-white/5 flex flex-col overflow-hidden z-20 shadow-[0_20px_80px_rgba(0,0,0,0.35)] h-screen">
                    <div className="flex-1 overflow-y-auto flex flex-col p-6 gap-6">
                        {/* Hero */}
                        <div className="relative rounded-2xl overflow-hidden bg-[#121c32] border border-white/10 px-4 py-5">
                            <div className="absolute inset-0 opacity-25 blur-3xl bg-[#1e2a45]" />
                            <div className="relative flex items-center gap-3">
                                <div className="w-11 h-11 rounded-xl bg-[#1f3a5f] flex items-center justify-center text-white shadow-lg shadow-black/30">
                                    <Sparkles className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className="text-[11px] uppercase tracking-[0.2em] text-slate-300">Gemini LaTeX Studio</p>
                                    <h2 className="text-xl font-semibold text-white">Assignment Generator</h2>
                                </div>
                            </div>
                            <div className="relative mt-4 flex flex-wrap gap-2 text-[11px]">
                                <span className="px-3 py-1 rounded-full bg-white/10 text-slate-100 border border-white/10">PDF · Image · Text</span>
                                <span className="px-3 py-1 rounded-full bg-white/5 text-slate-200 border border-white/5">Live LaTeX streaming</span>
                                <span className="px-3 py-1 rounded-full bg-white/10 text-slate-100 border border-white/10">Gemini 3 Pro</span>
                            </div>
                        </div>

                        {/* Upload */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Upload material</div>
                                {fileContent && <span className="text-[11px] text-emerald-300">Ready</span>}
                            </div>
                            <div
                                onClick={() => fileInputRef.current?.click()}
                                className="group border border-white/10 rounded-2xl p-4 cursor-pointer bg-white/5 hover:bg-white/10 transition-all shadow-inner shadow-black/30"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-[#1a2438] flex items-center justify-center border border-white/10">
                                        <FileUp className="w-5 h-5 text-slate-200" />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm text-white">Drop PDF, Image, or Text</p>
                                        <p className="text-xs text-slate-400">Structured content yields better LaTeX</p>
                                    </div>
                                    <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-white transition" />
                                </div>
                                {fileContent && (
                                    <div className="mt-3 text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">{fileContent}</div>
                                )}
                            </div>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".pdf,.txt,.md,image/*"
                                onChange={handleFileUpload}
                                className="hidden"
                            />
                        </div>

                        {/* Topic */}
                        <div className="space-y-2">
                            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Describe topic</div>
                            <div className="rounded-2xl border border-white/10 bg-white/5 focus-within:border-[#3b5b8a]/60 transition-all">
                                <textarea
                                    value={topic}
                                    onChange={(e) => setTopic(e.target.value)}
                                    placeholder="e.g., Board exam quadratic equations, AP & GP practice"
                                    className="w-full bg-transparent rounded-2xl p-3 text-sm text-white placeholder-slate-500 focus:outline-none"
                                    rows={4}
                                />
                            </div>
                        </div>

                        {/* Error */}
                        {error && (
                            <div className="flex gap-2 items-start p-3 bg-red-500/10 border border-red-500/30 rounded-xl">
                                <AlertCircle className="w-4 h-4 text-red-300 flex-shrink-0 mt-0.5" />
                                <p className="text-xs text-red-100">{error}</p>
                            </div>
                        )}

                        {/* Primary action */}
                        <button
                            onClick={handleGenerate}
                            disabled={isGenerating || (!fileContent && !topic)}
                            className="w-full bg-[#1f3a5f] hover:bg-[#27466f] disabled:bg-slate-700 disabled:opacity-60 text-white font-semibold py-3 px-4 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-black/30"
                        >
                            {isGenerating ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Generating...
                                </>
                            ) : (
                                <>
                                    <Sparkles className="w-4 h-4" />
                                    Generate LaTeX
                                </>
                            )}
                        </button>

                        {/* Secondary actions */}
                        {latexOutput && (
                            <div className="space-y-2 border-t border-white/5 pt-4">
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        onClick={handleCompile}
                                        disabled={!latexOutput || isCompiling}
                                        className="bg-[#2b4a74] hover:bg-[#335684] text-white font-medium py-2 px-4 rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                                    >
                                        {isCompiling ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                Compiling...
                                            </>
                                        ) : (
                                            <>
                                                <Play className="w-4 h-4" />
                                                Compile PDF
                                            </>
                                        )}
                                    </button>
                                    <button
                                        onClick={handleCopy}
                                        className="bg-white/10 hover:bg-white/15 text-white font-medium py-2 px-4 rounded-xl flex items-center justify-center gap-2 transition-all"
                                    >
                                        {copied ? (
                                            <>
                                                <CheckCircle2 className="w-4 h-4" />
                                                Copied!
                                            </>
                                        ) : (
                                            <>
                                                <Copy className="w-4 h-4" />
                                                Copy LaTeX
                                            </>
                                        )}
                                    </button>
                                    <button
                                        onClick={handleDownload}
                                        className="bg-white/10 hover:bg-white/15 text-white font-medium py-2 px-4 rounded-xl flex items-center justify-center gap-2 transition-all"
                                    >
                                        <Download className="w-4 h-4" />
                                        Download .tex
                                    </button>
                                    <button
                                        onClick={() => {
                                            setLatexOutput('');
                                            setTopic('');
                                            setFileContent('');
                                            setFileData(null);
                                        }}
                                        className="bg-white/5 hover:bg-white/10 text-white font-medium py-2 px-4 rounded-xl flex items-center justify-center gap-2 transition-all"
                                    >
                                        <RefreshCw className="w-4 h-4" />
                                        Reset & New
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    <button
                        onClick={() => setSidebarOpen(false)}
                        className="border-t border-white/5 px-4 py-3 text-slate-400 hover:text-white hover:bg-white/5 transition-all flex items-center justify-center"
                    >
                        <ChevronRight className="w-5 h-5" />
                    </button>
                </div>
            )}

            {/* Right Panel - LaTeX Output Preview */}
            <div className="flex-1 w-full h-screen max-h-screen min-h-0 overflow-hidden flex flex-col relative">
                <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_20%_20%,rgba(59,91,138,0.15),transparent_30%),radial-gradient(circle_at_70%_20%,rgba(30,42,69,0.18),transparent_32%)]" />

                {/* Header Bar */}
                <div className="relative bg-[#0b1226]/80 backdrop-blur border-b border-white/5 px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        {!sidebarOpen && (
                            <button
                                onClick={() => setSidebarOpen(true)}
                                className="text-slate-300 hover:text-white transition-colors"
                            >
                                <ChevronRight className="w-5 h-5 rotate-180" />
                            </button>
                        )}
                        <div>
                            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Canvas</p>
                            <h3 className="text-lg font-semibold text-white">LaTeX Output</h3>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 bg-white/5 rounded-full p-1 border border-white/5">
                        <button
                            onClick={() => setActiveTab('code')}
                            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${activeTab === 'code'
                                ? 'bg-white text-slate-900 shadow'
                                : 'text-slate-200 hover:text-white'
                                }`}
                        >
                            <span className="flex items-center gap-2">
                                <FileText className="w-3 h-3" />
                                Code
                            </span>
                        </button>
                        <button
                            onClick={() => setActiveTab('pdf')}
                            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${activeTab === 'pdf'
                                ? 'bg-white text-slate-900 shadow'
                                : 'text-slate-200 hover:text-white'
                                }`}
                        >
                            <span className="flex items-center gap-2">
                                <Play className="w-3 h-3" />
                                Preview PDF
                            </span>
                        </button>
                    </div>

                    <div className="flex items-center gap-3 text-xs">
                        {isGenerating && (
                            <div className="flex items-center gap-1 text-slate-100 bg-white/10 px-3 py-1.5 rounded-full border border-white/15">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>Generating</span>
                            </div>
                        )}
                        {isCompiling && (
                            <div className="flex items-center gap-1 text-slate-100 bg-white/10 px-3 py-1.5 rounded-full border border-white/15">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>Compiling</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Output Container */}
                <div
                    ref={latexOutputRef}
                    className="relative flex-1 w-full h-full min-h-0 overflow-hidden flex flex-col"
                >
                    {activeTab === 'code' ? (
                        !latexOutput ? (
                            <div className="flex items-center justify-center h-full text-slate-300">
                                <div className="text-center space-y-2 bg-white/5 border border-white/10 rounded-2xl px-10 py-12 backdrop-blur">
                                    <BookOpen className="w-12 h-12 mx-auto mb-2 opacity-60" />
                                    <p className="text-sm">Generate LaTeX to view the live stream</p>
                                    <p className="text-xs text-slate-400">Clean layout, syntax highlighting, and cursor pulse while streaming</p>
                                </div>
                            </div>
                        ) : (
                            <CodeMirror
                                value={latexOutput + (isStreamingLatex && showCursor ? '|' : '')}
                                theme={vscodeDark}
                                height="100%"
                                editable={false}
                                extensions={[]}
                                className="w-full h-full"
                                basicSetup={{
                                    lineNumbers: true,
                                    foldGutter: true,
                                    dropCursor: false,
                                    allowMultipleSelections: false,
                                    indentOnInput: false,
                                    bracketMatching: true,
                                    closeBrackets: false,
                                    autocompletion: false,
                                    rectangularSelection: false,
                                    highlightSelectionMatches: false,
                                    searchKeymap: false,
                                    lintKeymap: false,
                                }}
                                style={{
                                    fontSize: '13px',
                                    fontFamily: 'Fira Code, monospace',
                                }}
                            />
                        )
                    ) : (
                        <div className="flex-1 w-full h-full bg-[#0c1428] overflow-auto flex justify-center p-6">
                            {pdfUrl ? (
                                <Document
                                    file={pdfUrl}
                                    className="max-w-full shadow-2xl shadow-black/40 border border-white/5 rounded-xl overflow-hidden"
                                    loading={
                                        <div className="flex items-center justify-center h-64">
                                            <Loader2 className="w-8 h-8 animate-spin text-white" />
                                        </div>
                                    }
                                    error={
                                        <div className="flex items-center justify-center h-64 text-red-200">
                                            <p>Failed to load PDF</p>
                                        </div>
                                    }
                                >
                                    <Page
                                        pageNumber={1}
                                        renderTextLayer={false}
                                        renderAnnotationLayer={false}
                                        width={640}
                                        className="mb-4"
                                    />
                                </Document>
                            ) : (
                                <div className="flex items-center justify-center h-full text-slate-200">
                                    <div className="text-center bg-white/5 border border-white/10 rounded-2xl px-10 py-12 backdrop-blur">
                                        {isCompiling ? (
                                            <>
                                                <Loader2 className="w-12 h-12 mx-auto mb-4 animate-spin opacity-50" />
                                                <p>Compiling PDF...</p>
                                            </>
                                        ) : (
                                            <>
                                                <Play className="w-12 h-12 mx-auto mb-4 opacity-50" />
                                                <p>Click "Compile PDF" to generate preview</p>
                                            </>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default LaTeXAssignmentPrep;
