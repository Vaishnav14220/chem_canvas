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
    FileText,
    GitBranch,
    Brain,
    Zap,
    TreeDeciduous,
    ChevronDown,
    ChevronUp,
    Star,
    XCircle,
    Target
} from 'lucide-react';
import { extractLatexCode } from '../utils/latexUtils';
import { streamTextContent } from '../services/geminiService';
import { compileLatexWithGemini } from '../services/latexAgentService';
import {
    generateLaTeXPlanTree,
    generateLaTeXWithToTReAct,
    buildLaTeXTree,
    LaTeXToTResponse,
    LaTeXPlanNode,
    LaTeXPlanNodeWithChildren,
    LaTeXSection
} from '../services/latexToTService';
import CodeMirror from '@uiw/react-codemirror';
import { vscodeDark } from '@uiw/codemirror-theme-vscode';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { Reasoning } from './ai-elements/reasoning';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

interface LaTeXAssignmentPrepProps {
}

// Tree Node Component for ToT visualization
const TreeNode: React.FC<{
    node: LaTeXPlanNodeWithChildren;
    depth: number;
    selectedId: string;
    onSelect: (node: LaTeXPlanNode) => void;
}> = ({ node, depth, selectedId, onSelect }) => {
    const [expanded, setExpanded] = useState(true);
    const hasChildren = node.children && node.children.length > 0;
    const isSelected = node.id === selectedId;
    const isRejected = node.status === 'rejected';

    const getStatusColor = () => {
        if (isSelected) return 'bg-emerald-500/20 border-emerald-500';
        if (isRejected) return 'bg-red-500/10 border-red-500/30 opacity-60';
        if (node.status === 'expanded') return 'bg-blue-500/10 border-blue-500/30';
        return 'bg-slate-700/50 border-slate-600';
    };

    const getApproachIcon = () => {
        switch (node.approach) {
            case 'theory-first': return <BookOpen className="w-3.5 h-3.5" />;
            case 'problem-driven': return <Target className="w-3.5 h-3.5" />;
            case 'visual-heavy': return <FileText className="w-3.5 h-3.5" />;
            case 'qa-format': return <Brain className="w-3.5 h-3.5" />;
            case 'hybrid': return <Zap className="w-3.5 h-3.5" />;
            default: return <GitBranch className="w-3.5 h-3.5" />;
        }
    };

    return (
        <div className={`ml-${depth > 0 ? 4 : 0}`} style={{ marginLeft: depth > 0 ? depth * 16 : 0 }}>
            <div
                className={`p-3 rounded-lg border ${getStatusColor()} cursor-pointer transition-all hover:border-white/30 mb-2`}
                onClick={() => !isRejected && onSelect(node)}
            >
                <div className="flex items-start gap-2">
                    {hasChildren && (
                        <button
                            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
                            className="mt-0.5 text-slate-400 hover:text-white"
                        >
                            {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </button>
                    )}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-slate-400">{getApproachIcon()}</span>
                            <span className="text-sm font-medium text-white truncate">{node.title}</span>
                            <div className="flex items-center gap-1 ml-auto flex-shrink-0">
                                {isSelected && <Star className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400" />}
                                {isRejected && <XCircle className="w-3.5 h-3.5 text-red-400" />}
                                <span className={`text-xs px-1.5 py-0.5 rounded ${node.score >= 7 ? 'bg-emerald-500/20 text-emerald-300' :
                                    node.score >= 4 ? 'bg-amber-500/20 text-amber-300' :
                                        'bg-red-500/20 text-red-300'
                                    }`}>
                                    {node.score}/10
                                </span>
                            </div>
                        </div>
                        <p className="text-xs text-slate-400 line-clamp-2">{node.description}</p>
                        {node.pros.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                                {node.pros.slice(0, 2).map((pro, i) => (
                                    <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300">
                                        + {pro}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
            {hasChildren && expanded && (
                <div className="border-l border-slate-600/50 ml-2 pl-2">
                    {node.children.map(child => (
                        <TreeNode
                            key={child.id}
                            node={child}
                            depth={depth + 1}
                            selectedId={selectedId}
                            onSelect={onSelect}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

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
    const [generationMode, setGenerationMode] = useState<'quick' | 'tot'>('tot');
    const [flashThinkingEnabled, setFlashThinkingEnabled] = useState(false);
    const [proThinkingEnabled, setProThinkingEnabled] = useState(true);

    // ToT State
    const [totPlan, setTotPlan] = useState<LaTeXToTResponse | null>(null);
    const [isPlanning, setIsPlanning] = useState(false);
    const [selectedApproachId, setSelectedApproachId] = useState<string | null>(null);
    const [thinkingContent, setThinkingContent] = useState<string>('');
    const [progressMessage, setProgressMessage] = useState<string>('');
    const [progressPercent, setProgressPercent] = useState<number>(0);

    // PDF State
    const [pdfUrl, setPdfUrl] = useState<string | null>(null);
    const [isCompiling, setIsCompiling] = useState(false);
    const [activeTab, setActiveTab] = useState<'planning' | 'code' | 'pdf'>('planning');

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

    // ToT Planning - automatically triggers generation after planning
    const handlePlanWithToT = async () => {
        if (!fileContent && !topic) {
            setError('Please upload a file or enter a topic');
            return;
        }

        setIsPlanning(true);
        setError('');
        setTotPlan(null);
        setThinkingContent('Analyzing topic and exploring document structure approaches...');

        try {
            const plan = await generateLaTeXPlanTree(
                topic || fileContent,
                fileData ? undefined : fileContent, // Pass text content if not binary
                []
            );

            setTotPlan(plan);
            setSelectedApproachId(plan.selectedId);
            setThinkingContent(`Planning complete! Selected approach: ${plan.selectedApproach}\n\nStarting LaTeX generation...`);
            setActiveTab('planning');
            setIsPlanning(false);

            // Brief pause to show the tree, then automatically start generation
            await new Promise(resolve => setTimeout(resolve, 1500));

            // Automatically start LaTeX generation
            await startGenerationWithPlan(plan);

        } catch (err) {
            setError(err instanceof Error ? err.message : 'Planning failed');
            setThinkingContent('');
            setIsPlanning(false);
        }
    };

    // Shared generation logic (can be called from auto-trigger or manual button)
    const startGenerationWithPlan = async (plan: LaTeXToTResponse) => {
        setIsGenerating(true);
        setError('');
        setLatexOutput('');
        setIsStreamingLatex(true);
        setActiveTab('code');

        try {
            await generateLaTeXWithToTReAct(
                topic || fileContent,
                fileData ? undefined : fileContent,
                plan,
                (message, progress) => {
                    setProgressMessage(message);
                    setProgressPercent(progress);
                },
                (chunk) => {
                    setLatexOutput(prev => prev + chunk);
                },
                (thought) => {
                    setThinkingContent(prev => prev + '\n' + thought);
                }
            );

            setIsStreamingLatex(false);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Generation failed');
            setIsStreamingLatex(false);
        } finally {
            setIsGenerating(false);
        }
    };

    // ToT-based generation (manual trigger - also called automatically after planning)
    const handleGenerateWithToT = async () => {
        if (!totPlan) {
            setError('Please run planning first');
            return;
        }
        await startGenerationWithPlan(totPlan);
    };

    // Quick generation (original method)
    const handleQuickGenerate = async () => {
        if (!fileContent && !topic) {
            setError('Please upload a file or enter a topic');
            return;
        }

        setIsGenerating(true);
        setError('');
        setLatexOutput('');
        setIsStreamingLatex(true);
        setActiveTab('code');

        try {
            const prompt_text = `Role: You are an expert University Teaching Assistant. Generate a complete, self-contained LaTeX document.

Material provided:
${fileContent ? `Source: ${fileContent}` : 'No file uploaded'}
${topic ? `Topic/Description: ${topic}` : 'User will provide context through file'}

Generate a comprehensive LaTeX preparation guide with:
1. Theoretical Foundations
2. Worked Examples
3. Practice Questions
4. Formula Sheet & Glossary

Output Requirements:
- Start with \\documentclass{article}
- End with \\end{document}
- NO explanations outside LaTeX
- Must compile in Overleaf`;

            let fullOutput = '';

            await streamTextContent(
                prompt_text,
                (chunk: string) => {
                    fullOutput += chunk;
                    setLatexOutput((prev) => prev + chunk);
                },
                {
                    model: 'gemini-3-flash-preview',
                    thinking: flashThinkingEnabled ? 'low' : undefined,
                    timeout: 300000,
                    onThought: () => { },
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
        setActiveTab('pdf');

        try {
            const cleanLatex = extractLatexCode(latexOutput);
            const result = await compileLatexWithGemini(cleanLatex, 'main.tex');

            if (result.success && result.pdfUrl) {
                setPdfUrl(result.pdfUrl);
            } else {
                setError(result.log || 'Compilation failed');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Compilation failed');
        } finally {
            setIsCompiling(false);
        }
    };

    const handleSelectApproach = (node: LaTeXPlanNode) => {
        setSelectedApproachId(node.id);
        // Update the plan with new selection
        if (totPlan) {
            setTotPlan({
                ...totPlan,
                selectedId: node.id,
                selectedApproach: node.title
            });
        }
    };

    const treeNodes = totPlan ? buildLaTeXTree(totPlan.tree) : [];

    return (
        <div className="flex flex-1 w-full h-full min-h-0 bg-[#eef2f7] overflow-hidden text-slate-900">
            {/* Left Sidebar - Input & Controls */}
            {sidebarOpen && (
                <div className="w-96 flex-shrink-0 border-r border-white/10 flex flex-col overflow-hidden z-20 shadow-[0_20px_60px_rgba(0,0,0,0.35)] h-full" style={{ backgroundColor: '#1F1F1F' }}>
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
                                    accept=".pdf,.txt,.md,image/*"
                                    onChange={handleFileUpload}
                                />
                                {fileContent ? (
                                    <div className="flex flex-col items-center text-slate-100">
                                        <Check className="w-7 h-7 mb-2" />
                                        <span className="text-xs font-medium text-center break-all">{fileContent.substring(0, 50)}...</span>
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
                            <textarea
                                value={topic}
                                onChange={(e) => setTopic(e.target.value)}
                                placeholder="e.g., Board exam quadratic equations, AP & GP practice"
                                className="w-full px-4 py-2 bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:ring-2 focus:ring-[#3b5b8a] focus:border-transparent outline-none transition-all resize-none"
                                rows={4}
                            />
                        </div>

                        {/* Generation Mode */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">3. Generation Mode</label>
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    onClick={() => setGenerationMode('quick')}
                                    className={`px-3 py-2 text-xs font-semibold uppercase tracking-wide transition-all border flex items-center justify-center gap-2 ${generationMode === 'quick'
                                        ? 'bg-[#2c4066] text-white border-transparent'
                                        : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10 hover:text-white'
                                        }`}
                                >
                                    <Zap className="w-3.5 h-3.5" />
                                    Quick
                                </button>
                                <button
                                    onClick={() => setGenerationMode('tot')}
                                    className={`px-3 py-2 text-xs font-semibold uppercase tracking-wide transition-all border flex items-center justify-center gap-2 ${generationMode === 'tot'
                                        ? 'bg-emerald-600 text-white border-transparent'
                                        : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10 hover:text-white'
                                        }`}
                                >
                                    <TreeDeciduous className="w-3.5 h-3.5" />
                                    ToT + ReAct
                                </button>
                            </div>
                            <p className="text-[11px] text-slate-400">
                                {generationMode === 'tot'
                                    ? 'Uses Tree of Thoughts planning and ReAct for iterative, high-quality generation'
                                    : 'Fast single-pass generation for quick results'}
                            </p>
                        </div>

                        {/* Error */}
                        {error && (
                            <div className="flex gap-2 items-start p-3 bg-red-500/10 border border-red-500/30">
                                <AlertCircle className="w-4 h-4 text-red-300 flex-shrink-0 mt-0.5" />
                                <p className="text-xs text-red-100">{error}</p>
                            </div>
                        )}

                        {/* Action Buttons */}
                        {generationMode === 'tot' ? (
                            <div className="space-y-2">
                                {/* Step 1: Plan & Generate */}
                                <button
                                    onClick={handlePlanWithToT}
                                    disabled={isPlanning || isGenerating || (!fileContent && !topic)}
                                    className={`w-full py-3 flex items-center justify-center gap-2 font-semibold text-sm uppercase tracking-wide transition-all ${(isPlanning || isGenerating || (!fileContent && !topic))
                                        ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                                        : 'bg-purple-600 text-white hover:bg-purple-700 active:scale-95'
                                        }`}
                                >
                                    {isPlanning ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            <span className="text-xs">Planning & Generating...</span>
                                        </>
                                    ) : (
                                        <>
                                            <TreeDeciduous className="w-4 h-4" />
                                            <span>Plan & Generate (ToT)</span>
                                        </>
                                    )}
                                </button>

                                {/* Step 2: Regenerate */}
                                {totPlan && (
                                    <button
                                        onClick={handleGenerateWithToT}
                                        disabled={isGenerating || isPlanning}
                                        className={`w-full py-3 flex items-center justify-center gap-2 font-semibold text-sm uppercase tracking-wide transition-all ${(isGenerating || isPlanning)
                                            ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                                            : 'bg-emerald-600 text-white hover:bg-emerald-700 active:scale-95'
                                            }`}
                                    >
                                        {isGenerating ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                <span className="text-xs">Generating ({Math.round(progressPercent)}%)...</span>
                                            </>
                                        ) : (
                                            <>
                                                <Brain className="w-4 h-4" />
                                                <span>Regenerate (ReAct)</span>
                                            </>
                                        )}
                                    </button>
                                )}
                            </div>
                        ) : (
                            <button
                                onClick={handleQuickGenerate}
                                disabled={isGenerating || (!fileContent && !topic)}
                                className={`w-full py-3 flex items-center justify-center gap-2 font-semibold text-sm uppercase tracking-wide transition-all ${(isGenerating || (!fileContent && !topic))
                                    ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                                    : 'bg-[#2c4066] text-white hover:bg-[#34507c] active:scale-95'
                                    }`}
                            >
                                {isGenerating ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        <span className="text-xs">Generating...</span>
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="w-4 h-4" />
                                        <span>Generate</span>
                                    </>
                                )}
                            </button>
                        )}

                        {/* Secondary actions */}
                        {latexOutput && (
                            <div className="space-y-2 border-t border-slate-700 pt-4">
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        onClick={handleCompile}
                                        disabled={!latexOutput || isCompiling}
                                        className={`w-full px-4 py-2.5 text-sm font-medium transition-all flex items-center justify-center gap-2 ${(!latexOutput || isCompiling)
                                            ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                                            : 'bg-[#2c4066] text-white hover:bg-[#34507c]'
                                            }`}
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
                                        className="w-full px-4 py-2.5 bg-white/5 text-slate-300 border border-white/10 hover:bg-white/10 hover:text-white text-sm font-medium transition-all flex items-center justify-center gap-2"
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
                                        className="w-full px-4 py-2.5 bg-white/5 text-slate-300 border border-white/10 hover:bg-white/10 hover:text-white text-sm font-medium transition-all flex items-center justify-center gap-2"
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
                                            setTotPlan(null);
                                            setThinkingContent('');
                                        }}
                                        className="w-full px-4 py-2.5 bg-white/5 text-slate-300 border border-white/10 hover:bg-white/10 hover:text-white text-sm font-medium transition-all flex items-center justify-center gap-2"
                                    >
                                        <RefreshCw className="w-4 h-4" />
                                        Reset & New
                                    </button>
                                </div>
                            </div>
                        )}

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

            {/* Right Panel - Output */}
            <div className="flex-1 bg-[#f6f8fc] w-full h-full max-h-full min-h-0 overflow-hidden flex flex-col relative">
                {!sidebarOpen && (
                    <button
                        onClick={() => setSidebarOpen(true)}
                        className="absolute top-4 left-4 p-2 bg-slate-800 text-white hover:bg-slate-700 transition-colors z-10 shadow-lg"
                        title="Open sidebar"
                    >
                        <ChevronRight className="w-5 h-5 transform rotate-180" />
                    </button>
                )}

                {/* Header Bar */}
                <div className="relative bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div>
                            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Canvas</p>
                            <h3 className="text-lg font-semibold text-slate-900">LaTeX Output</h3>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 bg-slate-100 p-1">
                        <button
                            onClick={() => setActiveTab('planning')}
                            className={`px-3 py-1.5 text-xs font-semibold transition-all flex items-center gap-2 ${activeTab === 'planning'
                                ? 'bg-white text-slate-900 shadow-sm'
                                : 'text-slate-600 hover:text-slate-900'
                                }`}
                        >
                            <TreeDeciduous className="w-3 h-3" />
                            Planning
                        </button>
                        <button
                            onClick={() => setActiveTab('code')}
                            className={`px-3 py-1.5 text-xs font-semibold transition-all flex items-center gap-2 ${activeTab === 'code'
                                ? 'bg-white text-slate-900 shadow-sm'
                                : 'text-slate-600 hover:text-slate-900'
                                }`}
                        >
                            <FileText className="w-3 h-3" />
                            Code
                        </button>
                        <button
                            onClick={() => setActiveTab('pdf')}
                            className={`px-3 py-1.5 text-xs font-semibold transition-all flex items-center gap-2 ${activeTab === 'pdf'
                                ? 'bg-white text-slate-900 shadow-sm'
                                : 'text-slate-600 hover:text-slate-900'
                                }`}
                        >
                            <Play className="w-3 h-3" />
                            Preview PDF
                        </button>
                    </div>

                    <div className="flex items-center gap-3 text-xs">
                        {(isGenerating || isPlanning) && (
                            <div className="flex items-center gap-1 text-slate-600 bg-slate-100 px-3 py-1.5 border border-slate-200">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>{isPlanning ? 'Planning' : progressMessage || 'Generating'}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Output Container */}
                <div className="flex-1 w-full h-full min-h-0 overflow-auto">
                    {activeTab === 'planning' ? (
                        <div className="h-full flex">
                            {/* ToT Tree View */}
                            <div className="w-1/2 h-full overflow-auto p-6 border-r border-slate-200" style={{ backgroundColor: '#1a1a1a' }}>
                                <div className="mb-4">
                                    <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                                        <TreeDeciduous className="w-4 h-4 text-emerald-400" />
                                        Tree of Thoughts
                                    </h4>
                                    <p className="text-xs text-slate-400 mt-1">
                                        {totPlan ? 'Click on a node to select a different approach' : 'Run planning to explore document structure options'}
                                    </p>
                                </div>

                                {isPlanning ? (
                                    <div className="flex flex-col items-center justify-center py-12">
                                        <Loader2 className="w-8 h-8 animate-spin text-purple-400 mb-4" />
                                        <p className="text-sm text-slate-400">Exploring structure approaches...</p>
                                    </div>
                                ) : totPlan && treeNodes.length > 0 ? (
                                    <div className="space-y-2">
                                        {treeNodes.map(node => (
                                            <TreeNode
                                                key={node.id}
                                                node={node}
                                                depth={0}
                                                selectedId={selectedApproachId || totPlan.selectedId}
                                                onSelect={handleSelectApproach}
                                            />
                                        ))}
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center py-12 text-center">
                                        <TreeDeciduous className="w-12 h-12 text-slate-600 mb-4" />
                                        <p className="text-sm text-slate-400">No plan yet</p>
                                        <p className="text-xs text-slate-500 mt-1">Click "Plan Structure" to begin</p>
                                    </div>
                                )}
                            </div>

                            {/* Recommended Structure & Thinking */}
                            <div className="w-1/2 h-full overflow-auto p-6 bg-white">
                                {totPlan && (
                                    <>
                                        <div className="mb-6">
                                            <h4 className="text-sm font-semibold text-slate-800 flex items-center gap-2 mb-3">
                                                <Target className="w-4 h-4 text-blue-500" />
                                                Recommended Structure
                                            </h4>
                                            <div className="space-y-2">
                                                {totPlan.recommendedStructure.map((section, i) => (
                                                    <div key={section.id} className="flex items-center gap-3 p-2 rounded bg-slate-50 border border-slate-200">
                                                        <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-medium flex items-center justify-center">
                                                            {i + 1}
                                                        </span>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-medium text-slate-700 truncate">{section.title}</p>
                                                            <p className="text-xs text-slate-500">{section.type} • {section.priority} priority</p>
                                                        </div>
                                                        <span className={`text-[10px] px-2 py-0.5 rounded ${section.estimatedLength === 'long' ? 'bg-amber-100 text-amber-700' :
                                                            section.estimatedLength === 'medium' ? 'bg-blue-100 text-blue-700' :
                                                                'bg-green-100 text-green-700'
                                                            }`}>
                                                            {section.estimatedLength}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        <div>
                                            <h4 className="text-sm font-semibold text-slate-800 flex items-center gap-2 mb-3">
                                                <Brain className="w-4 h-4 text-purple-500" />
                                                AI Analysis
                                            </h4>
                                            <div className="p-4 rounded-lg bg-purple-50 border border-purple-200">
                                                <p className="text-sm text-slate-700">{totPlan.analysis}</p>
                                            </div>
                                        </div>
                                    </>
                                )}

                                {thinkingContent && (
                                    <div className="mt-6">
                                        <Reasoning isStreaming={isPlanning || isGenerating}>
                                            {thinkingContent}
                                        </Reasoning>
                                    </div>
                                )}

                                {!totPlan && !isPlanning && (
                                    <div className="flex flex-col items-center justify-center h-full text-center">
                                        <Brain className="w-12 h-12 text-slate-300 mb-4" />
                                        <p className="text-sm text-slate-500">Plan structure first to see recommendations</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : activeTab === 'code' ? (
                        !latexOutput ? (
                            <div className="w-full h-full flex flex-col items-center justify-center bg-[#f6f8fc] text-slate-500 px-8 overflow-auto">
                                <div className="flex flex-col items-center gap-6 text-center max-w-xl">
                                    <div className="w-24 h-24 bg-[#e4e9f2] flex items-center justify-center">
                                        <BookOpen className="w-12 h-12 text-[#2c4066]" />
                                    </div>
                                    <div>
                                        <h3 className="text-2xl font-bold text-slate-700 mb-2">Ready to Generate</h3>
                                        <p className="text-slate-500 mb-6">
                                            {generationMode === 'tot'
                                                ? 'Plan your document structure first, then generate with ReAct.'
                                                : 'Upload a file or enter a topic, then generate LaTeX content.'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div ref={latexOutputRef} className="w-full h-full">
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
                            </div>
                        )
                    ) : (
                        <div className="flex-1 w-full h-full bg-[#f6f8fc] overflow-auto flex justify-center p-6">
                            {pdfUrl ? (
                                <Document
                                    file={pdfUrl}
                                    className="max-w-full shadow-2xl shadow-black/20 border border-slate-200 overflow-hidden"
                                    loading={
                                        <div className="flex items-center justify-center h-64">
                                            <Loader2 className="w-8 h-8 animate-spin text-slate-600" />
                                        </div>
                                    }
                                    error={
                                        <div className="flex items-center justify-center h-64 text-red-600">
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
                                <div className="flex items-center justify-center h-full text-slate-500">
                                    <div className="text-center bg-white border border-slate-200 px-10 py-12 shadow-sm">
                                        {isCompiling ? (
                                            <>
                                                <Loader2 className="w-12 h-12 mx-auto mb-4 animate-spin text-slate-600" />
                                                <p className="text-slate-700">Compiling PDF...</p>
                                            </>
                                        ) : (
                                            <>
                                                <Play className="w-12 h-12 mx-auto mb-4 text-slate-400" />
                                                <p className="text-slate-700">Click "Compile PDF" to generate preview</p>
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
