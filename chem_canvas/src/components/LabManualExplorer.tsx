/**
 * Lab Manual Explorer - Main Workspace Component
 * 
 * Provides an AI-powered interface for exploring lab manuals:
 * - Upload panel for PDF/DOCX files
 * - Interactive topic map using ReactFlow
 * - Grounded Q&A chat with citations
 * - Experimental schematic generation
 * - Visual Explainer with interactive animated canvases
 */

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import ReactFlow, {
    Node,
    Edge,
    Controls,
    Background,
    BackgroundVariant,
    useNodesState,
    useEdgesState,
    MarkerType,
    Position,
    Handle,
} from 'reactflow';
import 'reactflow/dist/style.css';
import {
    Upload,
    FileText,
    Send,
    Loader2,
    Network,
    MessageSquare,
    Microscope,
    AlertCircle,
    CheckCircle,
    ChevronRight,
    BookOpen,
    Sparkles,
    X,
    RefreshCw,
    Quote,
    FlaskConical,
    AlertTriangle,
    Play,
    Pause,
    Eye,
    Zap,
    ChevronDown,
    ChevronUp,
} from 'lucide-react';
import {
    extractDocumentText,
    analyzeLabManual,
    askManualQuestion,
    generateSchematic,
    generateSuggestedQuestions,
    flattenTopics,
    type TopicOutline,
    type Device,
    type ConceptGraph,
    type ChatMessage,
    type ChatResponse,
    type LabManualAnalysis,
    type Topic,
} from '../services/labManualExplorerService';
import { generateTextContent, extractJsonBlock } from '../services/geminiService';
import { LabManualVisualizer } from './LabManualVisualizer';
import { ConceptMapDrawIO } from './ConceptMapDrawIO';
// ============================================================================
// Types
// ============================================================================

interface LabManualExplorerProps {
    onClose?: () => void;
    uploadedFile?: File;
    topic?: string;
    initialDraft?: LabManualDraftState | null;
    onDraftChange?: (draft: LabManualDraftState) => void;
}

type ExplorerTab = 'topics' | 'chat' | 'schematic' | 'visual';

interface VisualExplainer {
    id: string;
    title: string;
    type: 'formula' | 'graph' | 'process' | 'concept';
    content: string;
    animation?: string;
    variables?: { name: string; value: number; min: number; max: number }[];
}

export type LabManualDraftState = {
    fileLabel?: string;
    documentText?: string;
    analysis?: LabManualAnalysis | null;
    chatMessages?: ChatMessage[];
    schematic?: { imageBase64: string; mimeType: string } | null;
    visualExplainers?: VisualExplainer[];
    expandedExplainer?: string | null;
    activeTab?: ExplorerTab;
    selectedTopicId?: string | null;
};

// ============================================================================
// Custom Node Component with proper handles
// ============================================================================

const TopicNode: React.FC<{ data: { label: string; type: string; summary?: string; onClick?: () => void } }> = ({ data }) => {
    const getBgColor = () => {
        switch (data.type) {
            case 'topic': return 'bg-gradient-to-br from-blue-500 to-blue-600';
            case 'subtopic': return 'bg-gradient-to-br from-indigo-400 to-indigo-500';
            case 'device': return 'bg-gradient-to-br from-amber-500 to-orange-500';
            case 'concept': return 'bg-gradient-to-br from-emerald-400 to-emerald-500';
            default: return 'bg-gradient-to-br from-slate-400 to-slate-500';
        }
    };

    return (
        <div
            onClick={data.onClick}
            className={`px-4 py-2.5 rounded-xl shadow-lg cursor-pointer transition-all hover:scale-105 hover:shadow-xl ${getBgColor()} relative`}
        >
            <Handle type="target" position={Position.Top} className="!bg-slate-400 !w-2 !h-2" />
            <div className="text-white text-sm font-medium text-center max-w-[160px] truncate">
                {data.label}
            </div>
            {data.type === 'device' && (
                <div className="text-white/70 text-[10px] text-center mt-0.5">
                    <FlaskConical className="w-3 h-3 inline mr-1" />
                    Apparatus
                </div>
            )}
            <Handle type="source" position={Position.Bottom} className="!bg-slate-400 !w-2 !h-2" />
        </div>
    );
};

const nodeTypes = {
    topic: TopicNode,
};

// ============================================================================
// Scientific Visualizer Component (HTML/SVG-based)
// ============================================================================

interface ExtendedVisualExplainer extends VisualExplainer {
    formula?: string;
    latex?: string;
    dataPoints?: { x: number; y: number }[];
    steps?: string[];
    xLabel?: string;
    yLabel?: string;
    graphType?: 'linear' | 'exponential' | 'sinusoidal' | 'polynomial';
}

const ScientificVisualizer: React.FC<{ explainer: ExtendedVisualExplainer }> = ({ explainer }) => {
    const [variables, setVariables] = useState<{ [key: string]: number }>({});
    const [animationStep, setAnimationStep] = useState(0);
    const [isPlaying, setIsPlaying] = useState(true);

    useEffect(() => {
        const vars: { [key: string]: number } = {};
        explainer.variables?.forEach(v => {
            vars[v.name] = v.value;
        });
        setVariables(vars);
    }, [explainer.variables]);

    // Animation timer
    useEffect(() => {
        if (!isPlaying) return;
        const timer = setInterval(() => {
            setAnimationStep(prev => prev + 1);
        }, 100);
        return () => clearInterval(timer);
    }, [isPlaying]);

    // Generate data points based on formula type
    const generateDataPoints = useCallback(() => {
        const points: { x: number; y: number }[] = [];
        const numPoints = 50;
        const a = variables['a'] || 1;
        const b = variables['b'] || 1;
        const c = variables['c'] || 0;

        for (let i = 0; i <= numPoints; i++) {
            const x = (i / numPoints) * 10 - 5; // -5 to 5
            let y = 0;

            switch (explainer.graphType) {
                case 'linear':
                    y = a * x + b;
                    break;
                case 'exponential':
                    y = a * Math.exp(b * x);
                    break;
                case 'sinusoidal':
                    y = a * Math.sin(b * x + c);
                    break;
                case 'polynomial':
                    y = a * x * x + b * x + c;
                    break;
                default:
                    // Default: parse from content or use simple formula
                    y = a * x + b;
            }

            // Clamp y values for display
            y = Math.max(-10, Math.min(10, y));
            points.push({ x, y });
        }

        return points;
    }, [variables, explainer.graphType]);

    // SVG Graph Renderer
    const renderGraph = () => {
        const width = 400;
        const height = 280;
        const padding = 50;
        const graphWidth = width - padding * 2;
        const graphHeight = height - padding * 2;

        const points = explainer.dataPoints || generateDataPoints();
        const animatedPointCount = Math.min(points.length, Math.floor(animationStep / 2) + 5);

        // Calculate scale
        const xMin = Math.min(...points.map(p => p.x));
        const xMax = Math.max(...points.map(p => p.x));
        const yMin = Math.min(...points.map(p => p.y));
        const yMax = Math.max(...points.map(p => p.y));

        const scaleX = (x: number) => padding + ((x - xMin) / (xMax - xMin || 1)) * graphWidth;
        const scaleY = (y: number) => height - padding - ((y - yMin) / (yMax - yMin || 1)) * graphHeight;

        // Generate path
        const pathData = points
            .slice(0, animatedPointCount)
            .map((p, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(p.x)} ${scaleY(p.y)}`)
            .join(' ');

        // Grid lines
        const gridLines = [];
        for (let i = 0; i <= 4; i++) {
            const y = padding + (i / 4) * graphHeight;
            gridLines.push(<line key={`h${i}`} x1={padding} y1={y} x2={width - padding} y2={y} stroke="#334155" strokeWidth="1" strokeDasharray="4,4" />);
        }
        for (let i = 0; i <= 4; i++) {
            const x = padding + (i / 4) * graphWidth;
            gridLines.push(<line key={`v${i}`} x1={x} y1={padding} x2={x} y2={height - padding} stroke="#334155" strokeWidth="1" strokeDasharray="4,4" />);
        }

        return (
            <svg width={width} height={height} className="w-full" style={{ minHeight: 280 }}>
                <defs>
                    <linearGradient id="graphGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#3b82f6" />
                        <stop offset="100%" stopColor="#8b5cf6" />
                    </linearGradient>
                    <filter id="glow">
                        <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                        <feMerge>
                            <feMergeNode in="coloredBlur" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                </defs>

                {/* Background */}
                <rect width={width} height={height} fill="#0f172a" rx="8" />

                {/* Grid */}
                {gridLines}

                {/* Axes */}
                <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#64748b" strokeWidth="2" />
                <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="#64748b" strokeWidth="2" />

                {/* Axis arrows */}
                <polygon points={`${width - padding},${height - padding} ${width - padding - 8},${height - padding - 4} ${width - padding - 8},${height - padding + 4}`} fill="#64748b" />
                <polygon points={`${padding},${padding} ${padding - 4},${padding + 8} ${padding + 4},${padding + 8}`} fill="#64748b" />

                {/* Data line with glow effect */}
                {pathData && (
                    <>
                        <path d={pathData} fill="none" stroke="url(#graphGradient)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" filter="url(#glow)" />
                        {/* Animated dot at end */}
                        {animatedPointCount > 0 && points[animatedPointCount - 1] && (
                            <circle
                                cx={scaleX(points[animatedPointCount - 1].x)}
                                cy={scaleY(points[animatedPointCount - 1].y)}
                                r="6"
                                fill="#8b5cf6"
                                className="animate-pulse"
                            />
                        )}
                    </>
                )}

                {/* Axis labels */}
                <text x={width / 2} y={height - 10} fill="#94a3b8" fontSize="12" textAnchor="middle">
                    {explainer.xLabel || 'x'}
                </text>
                <text x={15} y={height / 2} fill="#94a3b8" fontSize="12" textAnchor="middle" transform={`rotate(-90, 15, ${height / 2})`}>
                    {explainer.yLabel || 'y'}
                </text>

                {/* Tick labels */}
                <text x={padding} y={height - padding + 15} fill="#64748b" fontSize="10" textAnchor="middle">{xMin.toFixed(1)}</text>
                <text x={width - padding} y={height - padding + 15} fill="#64748b" fontSize="10" textAnchor="middle">{xMax.toFixed(1)}</text>
                <text x={padding - 10} y={height - padding} fill="#64748b" fontSize="10" textAnchor="end">{yMin.toFixed(1)}</text>
                <text x={padding - 10} y={padding + 5} fill="#64748b" fontSize="10" textAnchor="end">{yMax.toFixed(1)}</text>
            </svg>
        );
    };

    // Formula Renderer with styled LaTeX-like display
    const renderFormula = () => {
        const formula = explainer.latex || explainer.formula || explainer.content;

        return (
            <div className="p-6 space-y-6">
                {/* Main Formula Display */}
                <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-6 border border-slate-700">
                    <div className="text-center mb-4">
                        <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider">Formula</span>
                    </div>
                    <div className="text-2xl md:text-3xl font-mono text-white text-center py-4 px-2 bg-slate-800/50 rounded-lg border border-slate-600">
                        {formula.split('\n')[0] || formula}
                    </div>
                </div>

                {/* Variable Visualization */}
                {explainer.variables && explainer.variables.length > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {explainer.variables.map((v, idx) => (
                            <div
                                key={v.name}
                                className="bg-slate-800 rounded-xl p-4 border border-slate-700"
                                style={{ animationDelay: `${idx * 100}ms` }}
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-lg font-bold text-cyan-400 font-mono">{v.name}</span>
                                    <span className="text-xl font-bold text-white">{(variables[v.name] || v.value).toFixed(2)}</span>
                                </div>
                                <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full transition-all duration-300"
                                        style={{ width: `${((variables[v.name] || v.value) - v.min) / (v.max - v.min) * 100}%` }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Description */}
                {explainer.content && explainer.content.split('\n').length > 1 && (
                    <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                        <p className="text-slate-300 text-sm leading-relaxed">
                            {explainer.content.split('\n').slice(1).join(' ')}
                        </p>
                    </div>
                )}
            </div>
        );
    };

    // Process Steps Renderer with animation
    const renderProcess = () => {
        const steps = explainer.steps || explainer.content.split('\n').filter(s => s.trim());
        const activeStep = Math.floor(animationStep / 20) % steps.length;

        return (
            <div className="p-6 space-y-4">
                {steps.slice(0, 6).map((step, idx) => {
                    const isActive = idx === activeStep;
                    const isComplete = idx < activeStep;

                    return (
                        <div
                            key={idx}
                            className={`flex items-start gap-4 p-4 rounded-xl border transition-all duration-500 ${isActive
                                ? 'bg-blue-500/20 border-blue-500 shadow-lg shadow-blue-500/20'
                                : isComplete
                                    ? 'bg-emerald-500/10 border-emerald-500/50'
                                    : 'bg-slate-800/50 border-slate-700'
                                }`}
                        >
                            {/* Step number */}
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all ${isActive
                                ? 'bg-blue-500 text-white scale-110'
                                : isComplete
                                    ? 'bg-emerald-500 text-white'
                                    : 'bg-slate-700 text-slate-400'
                                }`}>
                                {isComplete ? (
                                    <CheckCircle className="w-5 h-5" />
                                ) : (
                                    idx + 1
                                )}
                            </div>

                            {/* Step content */}
                            <div className="flex-1">
                                <p className={`font-medium transition-colors ${isActive ? 'text-white' : isComplete ? 'text-emerald-300' : 'text-slate-400'
                                    }`}>
                                    {step}
                                </p>
                            </div>

                            {/* Active indicator */}
                            {isActive && (
                                <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
                            )}
                        </div>
                    );
                })}
            </div>
        );
    };

    // Concept Map Renderer
    const renderConcept = () => {
        const concepts = explainer.content.split('\n').filter(s => s.trim()).slice(0, 5);
        const mainConcept = concepts[0] || 'Concept';
        const subConcepts = concepts.slice(1);

        return (
            <div className="p-6 relative min-h-[300px]">
                {/* Central concept */}
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10">
                    <div className={`w-32 h-32 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-xl ${isPlaying ? 'animate-pulse' : ''}`}>
                        <span className="text-white font-bold text-center text-sm px-2 leading-tight">
                            {mainConcept.substring(0, 30)}
                        </span>
                    </div>
                </div>

                {/* Orbiting sub-concepts */}
                {subConcepts.map((concept, idx) => {
                    const angle = ((idx / subConcepts.length) * 360 + (isPlaying ? animationStep * 0.5 : 0)) * (Math.PI / 180);
                    const radius = 120;
                    const x = Math.cos(angle) * radius;
                    const y = Math.sin(angle) * radius;
                    const colors = [
                        'from-cyan-500 to-teal-500',
                        'from-amber-500 to-orange-500',
                        'from-pink-500 to-rose-500',
                        'from-emerald-500 to-green-500',
                    ];

                    return (
                        <div
                            key={idx}
                            className="absolute top-1/2 left-1/2 z-0"
                            style={{
                                transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
                                transition: 'transform 0.1s ease-out',
                            }}
                        >
                            <div className={`w-20 h-20 rounded-full bg-gradient-to-br ${colors[idx % colors.length]} flex items-center justify-center shadow-lg`}>
                                <span className="text-white font-medium text-center text-xs px-1 leading-tight">
                                    {concept.substring(0, 20)}
                                </span>
                            </div>
                        </div>
                    );
                })}

                {/* Connection lines (SVG overlay) */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ minHeight: 300 }}>
                    {subConcepts.map((_, idx) => {
                        const angle = ((idx / subConcepts.length) * 360 + (isPlaying ? animationStep * 0.5 : 0)) * (Math.PI / 180);
                        const radius = 75;
                        const x = Math.cos(angle) * radius;
                        const y = Math.sin(angle) * radius;

                        return (
                            <line
                                key={idx}
                                x1="50%"
                                y1="50%"
                                x2={`calc(50% + ${x}px)`}
                                y2={`calc(50% + ${y}px)`}
                                stroke="#64748b"
                                strokeWidth="2"
                                strokeDasharray="4,4"
                                style={{ opacity: 0.5 }}
                            />
                        );
                    })}
                </svg>
            </div>
        );
    };

    return (
        <div className="bg-slate-900 rounded-xl overflow-hidden border border-slate-700 shadow-xl">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-slate-800 to-slate-900 border-b border-slate-700">
                <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${explainer.type === 'formula' ? 'bg-cyan-500/20 text-cyan-400' :
                        explainer.type === 'graph' ? 'bg-purple-500/20 text-purple-400' :
                            explainer.type === 'process' ? 'bg-emerald-500/20 text-emerald-400' :
                                'bg-blue-500/20 text-blue-400'
                        }`}>
                        {explainer.type === 'formula' ? <Zap className="w-4 h-4" /> :
                            explainer.type === 'graph' ? <Eye className="w-4 h-4" /> :
                                explainer.type === 'process' ? <Play className="w-4 h-4" /> :
                                    <Network className="w-4 h-4" />}
                    </div>
                    <div>
                        <span className="text-sm font-semibold text-white">{explainer.title}</span>
                        <span className="ml-2 text-xs text-slate-500 capitalize">• {explainer.type}</span>
                    </div>
                </div>
                <button
                    onClick={() => setIsPlaying(!isPlaying)}
                    className={`p-2 rounded-lg transition-colors ${isPlaying ? 'bg-blue-500/20 text-blue-400' : 'bg-slate-700 text-slate-400'}`}
                >
                    {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </button>
            </div>

            {/* Content */}
            <div className="min-h-[280px]">
                {explainer.type === 'graph' && renderGraph()}
                {explainer.type === 'formula' && renderFormula()}
                {explainer.type === 'process' && renderProcess()}
                {explainer.type === 'concept' && renderConcept()}
            </div>

            {/* Variable Controls */}
            {(explainer.type === 'graph' || explainer.type === 'formula') && explainer.variables && explainer.variables.length > 0 && (
                <div className="px-4 py-3 bg-slate-800 border-t border-slate-700 space-y-3">
                    <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Adjust Variables</div>
                    {explainer.variables.map(v => (
                        <div key={v.name} className="flex items-center gap-3">
                            <span className="text-sm font-mono text-cyan-400 w-16">{v.name}</span>
                            <input
                                type="range"
                                min={v.min}
                                max={v.max}
                                step={(v.max - v.min) / 100}
                                value={variables[v.name] || v.value}
                                onChange={(e) => setVariables(prev => ({ ...prev, [v.name]: parseFloat(e.target.value) }))}
                                className="flex-1 h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                            />
                            <span className="text-sm text-white font-mono w-16 text-right">
                                {(variables[v.name] || v.value).toFixed(2)}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// ============================================================================
// Main Component
// ============================================================================

export const LabManualExplorer: React.FC<LabManualExplorerProps> = ({
    onClose,
    uploadedFile,
    topic,
    initialDraft,
    onDraftChange,
}) => {
    // File upload state
    const [file, setFile] = useState<File | null>(uploadedFile || null);
    const [fileLabel, setFileLabel] = useState<string>(initialDraft?.fileLabel || uploadedFile?.name || '');
    const [documentText, setDocumentText] = useState<string>(initialDraft?.documentText || '');
    const [isExtracting, setIsExtracting] = useState(false);
    const [extractError, setExtractError] = useState<string | null>(null);

    // Analysis state
    const [analysis, setAnalysis] = useState<LabManualAnalysis | null>(initialDraft?.analysis ?? null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisProgress, setAnalysisProgress] = useState({ stage: '', progress: 0 });
    const [analysisError, setAnalysisError] = useState<string | null>(null);

    // Chat state
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>(initialDraft?.chatMessages ?? []);
    const [chatInput, setChatInput] = useState('');
    const [isChatting, setIsChatting] = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);
    const chatContainerRef = useRef<HTMLDivElement>(null);

    // Schematic state
    const [schematic, setSchematic] = useState<{ imageBase64: string; mimeType: string } | null>(initialDraft?.schematic ?? null);
    const [isGeneratingSchematic, setIsGeneratingSchematic] = useState(false);
    const [schematicError, setSchematicError] = useState<string | null>(null);

    // Visual Explainer state
    const [visualExplainers, setVisualExplainers] = useState<VisualExplainer[]>(initialDraft?.visualExplainers ?? []);
    const [isGeneratingVisuals, setIsGeneratingVisuals] = useState(false);
    const [expandedExplainer, setExpandedExplainer] = useState<string | null>(initialDraft?.expandedExplainer ?? null);

    // UI state
    const [activeTab, setActiveTab] = useState<ExplorerTab>(initialDraft?.activeTab ?? 'topics');
    const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);

    useEffect(() => {
        if (analysis?.conceptGraph) {
            generateGraphFromAnalysis(analysis.conceptGraph);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [analysis]);
    const selectedTopicId = selectedTopic?.id || null;
    const fileInputRef = useRef<HTMLInputElement>(null);

    // ReactFlow state
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);

    // ============================================================================
    // File Upload Handler
    // ============================================================================

    const handleFileUpload = useCallback(async (uploadedFile: File) => {
        setFile(uploadedFile);
        setFileLabel(uploadedFile.name);
        setExtractError(null);
        setIsExtracting(true);
        setAnalysis(null);
        setDocumentText('');
        setVisualExplainers([]);

        try {
            const text = await extractDocumentText(uploadedFile);
            setDocumentText(text);

            // Auto-start analysis
            setIsAnalyzing(true);
            setAnalysisProgress({ stage: 'Starting analysis...', progress: 5 });

            const result = await analyzeLabManual(text, (stage, progress) => {
                setAnalysisProgress({ stage, progress });
            });

            setAnalysis(result);
            generateGraphFromAnalysis(result.conceptGraph);

            // Generate suggested questions for chat
            const suggestions = generateSuggestedQuestions(result.outline);
            if (suggestions.length > 0) {
                setChatMessages([{
                    role: 'assistant',
                    content: `I've analyzed your lab manual: "${result.outline.title}". Here are some questions you might want to ask:\n\n${suggestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}`,
                }]);
            }
        } catch (error: any) {
            console.error('Document processing error:', error);
            setExtractError(error.message || 'Failed to process document');
        } finally {
            setIsExtracting(false);
            setIsAnalyzing(false);
        }
    }, []);

    // Handle pre-uploaded file
    useEffect(() => {
        if (uploadedFile && !file && !analysis && !documentText) {
            handleFileUpload(uploadedFile);
        }
    }, [uploadedFile, file, analysis, documentText, handleFileUpload]);

    useEffect(() => {
        if (!initialDraft) return;
        setFileLabel(initialDraft.fileLabel || '');
        setDocumentText(initialDraft.documentText || '');
        setAnalysis(initialDraft.analysis ?? null);
        setChatMessages(initialDraft.chatMessages ?? []);
        setSchematic(initialDraft.schematic ?? null);
        setVisualExplainers(initialDraft.visualExplainers ?? []);
        setExpandedExplainer(initialDraft.expandedExplainer ?? null);
        setActiveTab(initialDraft.activeTab ?? 'topics');
        if (initialDraft.selectedTopicId && initialDraft.analysis?.outline) {
            const topics = flattenTopics(initialDraft.analysis.outline.topics);
            const found = topics.find((topic) => topic.id === initialDraft.selectedTopicId) || null;
            setSelectedTopic(found);
        } else {
            setSelectedTopic(null);
        }
    }, [initialDraft]);

    useEffect(() => {
        if (!onDraftChange) return;
        const hasContent = Boolean(
            fileLabel ||
            documentText ||
            analysis ||
            chatMessages.length > 0 ||
            schematic ||
            visualExplainers.length > 0
        );
        if (!hasContent) return;
        onDraftChange({
            fileLabel,
            documentText,
            analysis,
            chatMessages,
            schematic,
            visualExplainers,
            expandedExplainer,
            activeTab,
            selectedTopicId,
        });
    }, [
        fileLabel,
        documentText,
        analysis,
        chatMessages,
        schematic,
        visualExplainers,
        expandedExplainer,
        activeTab,
        selectedTopicId,
        onDraftChange
    ]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            handleFileUpload(selectedFile);
        }
    };

    // ============================================================================
    // Graph Generation (Fixed edge handling)
    // ============================================================================

    const generateGraphFromAnalysis = useCallback((graph: ConceptGraph) => {
        if (!graph.nodes.length) return;

        // Build a set of valid node IDs
        const validNodeIds = new Set(graph.nodes.map(n => n.id));

        // Layout algorithm - simple hierarchical layout
        const levelMap = new Map<string, number>();

        // Determine levels based on node type
        graph.nodes.forEach(n => levelMap.set(n.id, n.type === 'topic' ? 0 : n.type === 'device' ? 2 : 1));

        const levels: { [key: number]: string[] } = {};
        graph.nodes.forEach(n => {
            const level = levelMap.get(n.id) || 0;
            if (!levels[level]) levels[level] = [];
            levels[level].push(n.id);
        });

        const flowNodes: Node[] = graph.nodes.map((n) => {
            const level = levelMap.get(n.id) || 0;
            const nodesAtLevel = levels[level] || [];
            const indexInLevel = nodesAtLevel.indexOf(n.id);
            const spacing = 220;
            const x = indexInLevel * spacing - ((nodesAtLevel.length - 1) * spacing) / 2 + 400;
            const y = level * 140 + 50;

            return {
                id: n.id,
                type: 'topic',
                position: { x, y },
                sourcePosition: Position.Bottom,
                targetPosition: Position.Top,
                data: {
                    label: n.label,
                    type: n.type,
                    onClick: () => {
                        const topics = analysis ? flattenTopics(analysis.outline.topics) : [];
                        const foundTopic = topics.find(t => t.id === n.id);
                        if (foundTopic) setSelectedTopic(foundTopic);
                    },
                },
            };
        });

        // Filter edges to only include those with valid source and target nodes
        const flowEdges: Edge[] = graph.edges
            .filter(e => validNodeIds.has(e.from) && validNodeIds.has(e.to))
            .map((e, idx) => ({
                id: `e-${idx}`,
                source: e.from,
                target: e.to,
                type: 'smoothstep',
                animated: e.type === 'uses',
                style: {
                    stroke: e.type === 'subtopic' ? '#6366f1' : e.type === 'uses' ? '#f59e0b' : '#94a3b8',
                    strokeWidth: 2,
                },
                markerEnd: {
                    type: MarkerType.ArrowClosed,
                    color: e.type === 'subtopic' ? '#6366f1' : e.type === 'uses' ? '#f59e0b' : '#94a3b8'
                },
            }));

        setNodes(flowNodes);
        setEdges(flowEdges);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [setNodes, setEdges]);

    // ============================================================================
    // Chat Handler
    // ============================================================================

    const handleSendMessage = async () => {
        if (!chatInput.trim() || !documentText || isChatting) return;

        const userMessage: ChatMessage = { role: 'user', content: chatInput.trim() };
        setChatMessages(prev => [...prev, userMessage]);
        setChatInput('');
        setIsChatting(true);

        try {
            const response = await askManualQuestion(documentText, userMessage.content, chatMessages);

            const assistantMessage: ChatMessage = {
                role: 'assistant',
                content: response.foundInManual ? response.answer : "I couldn't find information about this in the uploaded lab manual. Please try asking about topics covered in the document.",
                citations: response.citations,
            };

            setChatMessages(prev => [...prev, assistantMessage]);
        } catch (error: any) {
            console.error('Chat error:', error);
            setChatMessages(prev => [...prev, {
                role: 'assistant',
                content: 'Sorry, I encountered an error processing your question. Please try again.',
            }]);
        } finally {
            setIsChatting(false);
        }
    };

    // Auto-scroll chat
    useEffect(() => {
        if (chatEndRef.current && chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [chatMessages]);

    // ============================================================================
    // Schematic Generation
    // ============================================================================

    const handleGenerateSchematic = async () => {
        if (!analysis?.devices.devices.length) return;

        setIsGeneratingSchematic(true);
        setSchematicError(null);

        try {
            const result = await generateSchematic(
                analysis.devices.devices,
                analysis.outline.title || 'Laboratory Experiment'
            );
            setSchematic(result);
        } catch (error: any) {
            console.error('Schematic generation error:', error);
            setSchematicError(error.message || 'Failed to generate schematic');
        } finally {
            setIsGeneratingSchematic(false);
        }
    };

    // ============================================================================
    // Visual Explainer Generation
    // ============================================================================

    const handleGenerateVisuals = async () => {
        if (!documentText || !analysis) return;

        setIsGeneratingVisuals(true);

        try {
            const prompt = `Analyze this lab manual and extract visual concepts that can be visualized with interactive scientific graphs and formulas.

DOCUMENT:
${documentText.slice(0, 30000)}

TOPICS:
${analysis.outline.topics.map(t => t.name).join(', ')}

Return a JSON array of scientific visualizations. Each item should be a proper scientific concept with real formulas and graph data.

Schema for each item:
{
    "id": "unique-id",
    "title": "Concept Name (e.g., 'Ohm's Law', 'Wave Equation', 'Titration Curve')",
    "type": "formula|graph|process|concept",
    "content": "The main formula or description",
    "graphType": "linear|exponential|sinusoidal|polynomial", // For graph type only
    "xLabel": "X-axis label (e.g., 'Voltage (V)', 'Time (s)')",
    "yLabel": "Y-axis label (e.g., 'Current (A)', 'Concentration (M)')",
    "formula": "The LaTeX-style formula (e.g., 'F = ma', 'E = mc²', 'PV = nRT')",
    "steps": ["Step 1", "Step 2", "Step 3"], // For process type only
    "variables": [
        { "name": "a", "value": 1, "min": 0.1, "max": 5 },
        { "name": "b", "value": 1, "min": -5, "max": 5 }
    ]
}

IMPORTANT: Create scientifically accurate visualizations:
- For FORMULAS: Include the actual mathematical formula from physics/chemistry (e.g., F=ma, V=IR, PV=nRT)
- For GRAPHS: Specify graphType that matches the physics (linear for Ohm's law, exponential for decay, sinusoidal for waves)
- For PROCESS: List the actual experimental steps from the lab manual
- For CONCEPTS: Show the main concept and related sub-concepts

Examples of good graph variables:
- For linear graphs (y = ax + b): a=slope, b=intercept
- For exponential (y = a*e^(bx)): a=amplitude, b=decay constant  
- For sinusoidal (y = a*sin(bx + c)): a=amplitude, b=frequency, c=phase
- For polynomial (y = ax² + bx + c): a,b,c coefficients

Return 4-6 items covering the main scientific concepts from this lab manual.
Return ONLY valid JSON array, no markdown, no extra text.`;

            const response = await generateTextContent(prompt, {
                maxOutputTokens: 6144,
                model: 'gemini-3-pro-preview',
                applyPreferences: false,
            });

            try {
                const jsonStr = extractJsonBlock(response);
                const explainers = JSON.parse(jsonStr) as VisualExplainer[];
                setVisualExplainers(explainers);
            } catch (e) {
                console.error('Failed to parse visual explainers:', response);
                // Create fallback explainers from topics
                const fallback: VisualExplainer[] = analysis.outline.topics.slice(0, 4).map((t, idx) => ({
                    id: `fallback-${idx}`,
                    title: t.name,
                    type: 'concept' as const,
                    content: t.summary,
                }));
                setVisualExplainers(fallback);
            }
        } catch (error) {
            console.error('Visual generation error:', error);
        } finally {
            setIsGeneratingVisuals(false);
        }
    };

    // ============================================================================
    // Render
    // ============================================================================

    const hasDevices = (analysis?.devices?.devices?.length ?? 0) > 0;
    const suggestedQuestions = useMemo(() => {
        if (!analysis) return [];
        return generateSuggestedQuestions(analysis.outline);
    }, [analysis]);

    return (
        <div className="flex flex-col h-full w-full" style={{ backgroundColor: '#0f0f0f' }}>
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/50 flex-shrink-0" style={{ backgroundColor: '#1f1f1f' }}>
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-black flex items-center justify-center shadow-lg">
                        <Microscope className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h1 className="text-lg font-bold text-white">Lab Manual Explorer</h1>
                        <p className="text-xs text-slate-400">
                            {file?.name || fileLabel || 'Upload a lab manual to get started'}
                        </p>
                    </div>
                </div>
                {onClose && (
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg hover:bg-slate-700 transition-colors"
                    >
                        <X className="w-5 h-5 text-slate-400" />
                    </button>
                )}
            </div>

            <div className="flex flex-1 overflow-hidden min-h-0">
                {/* Left Panel - Upload & Analysis Status */}
                <div className="w-80 flex-shrink-0 border-r border-slate-700/50 flex flex-col overflow-hidden" style={{ backgroundColor: '#1f1f1f' }}>
                    <div className="p-4 space-y-4 overflow-y-auto flex-1">
                        {/* File Upload */}
                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                                1. Upload Lab Manual
                            </label>
                            <div
                                onClick={() => fileInputRef.current?.click()}
                                className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition-all ${file
                                    ? 'border-green-600 bg-green-900/20'
                                    : 'border-slate-600 hover:border-amber-500 hover:bg-amber-900/10'
                                    }`}
                            >
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    className="hidden"
                                    accept=".pdf,.docx,.txt,.md"
                                    onChange={handleFileChange}
                                />
                                {isExtracting ? (
                                    <div className="flex flex-col items-center text-amber-600">
                                        <Loader2 className="w-8 h-8 mb-2 animate-spin" />
                                        <span className="text-sm font-medium">Extracting text...</span>
                                    </div>
                                ) : file ? (
                                    <div className="flex flex-col items-center text-green-600">
                                        <CheckCircle className="w-8 h-8 mb-2" />
                                        <span className="text-xs font-medium text-center truncate max-w-full">
                                            {file?.name || fileLabel}
                                        </span>
                                        <span className="text-[10px] text-slate-400 mt-1">Click to replace</span>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center text-slate-400">
                                        <Upload className="w-8 h-8 mb-2" />
                                        <span className="text-sm font-medium">Upload Lab Manual</span>
                                        <span className="text-[10px] mt-1">PDF, DOCX, or TXT</span>
                                    </div>
                                )}
                            </div>
                            {extractError && (
                                <div className="flex items-start gap-2 text-red-400 text-xs bg-red-900/30 p-2 rounded-lg">
                                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                                    <span>{extractError}</span>
                                </div>
                            )}
                        </div>

                        {/* Analysis Progress */}
                        {isAnalyzing && (
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                                    2. Analyzing Document
                                </label>
                                <div className="bg-amber-900/30 rounded-xl p-4 border border-amber-700/50">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Loader2 className="w-4 h-4 text-amber-500 animate-spin" />
                                        <span className="text-sm font-medium text-amber-400">{analysisProgress.stage}</span>
                                    </div>
                                    <div className="w-full bg-amber-900/50 rounded-full h-2">
                                        <div
                                            className="bg-amber-500 h-2 rounded-full transition-all duration-300"
                                            style={{ width: `${analysisProgress.progress}%` }}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Analysis Summary */}
                        {analysis && !isAnalyzing && (
                            <div className="space-y-3">
                                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                                    Analysis Complete
                                </label>

                                <div className="bg-emerald-900/30 rounded-xl p-4 border border-emerald-700/50">
                                    <div className="flex items-center gap-2 mb-3">
                                        <CheckCircle className="w-5 h-5 text-emerald-500" />
                                        <span className="font-semibold text-emerald-400">{analysis.outline.title}</span>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                        <div className="bg-black/40 rounded-lg p-2 text-center">
                                            <div className="text-lg font-bold text-blue-400">{analysis.outline.topics.length}</div>
                                            <div className="text-slate-400">Topics</div>
                                        </div>
                                        <div className="bg-black/40 rounded-lg p-2 text-center">
                                            <div className="text-lg font-bold text-amber-400">{analysis.devices?.devices?.length || 0}</div>
                                            <div className="text-slate-400">Devices</div>
                                        </div>
                                    </div>
                                </div>

                                {/* Device List */}
                                {hasDevices && (
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                                                Detected Apparatus
                                            </span>
                                        </div>
                                        <div className="space-y-1.5 max-h-40 overflow-y-auto">
                                            {(analysis.devices?.devices || []).map((device, idx) => (
                                                <div
                                                    key={idx}
                                                    className="flex items-start gap-2 p-2 bg-amber-900/20 rounded-lg border border-amber-700/30"
                                                >
                                                    <FlaskConical className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-xs font-medium text-slate-200 truncate">{device.name}</div>
                                                        <div className="text-[10px] text-slate-500 truncate">{device.role}</div>
                                                        {device.safety.length > 0 && (
                                                            <div className="flex items-center gap-1 mt-1">
                                                                <AlertTriangle className="w-3 h-3 text-red-500" />
                                                                <span className="text-[9px] text-red-600 truncate">{device.safety[0]}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Tab Navigation */}
                    {analysis && (
                        <div className="border-t border-slate-200 p-2 bg-slate-50 flex-shrink-0">
                            <div className="grid grid-cols-4 gap-1">
                                <button
                                    onClick={() => setActiveTab('topics')}
                                    className={`flex flex-col items-center justify-center gap-0.5 px-2 py-2 rounded-lg text-[10px] font-medium transition-all ${activeTab === 'topics'
                                        ? 'bg-blue-600 text-white shadow-sm'
                                        : 'text-slate-400 hover:bg-slate-800'
                                        }`}
                                >
                                    <Network className="w-4 h-4" />
                                    Map
                                </button>
                                <button
                                    onClick={() => setActiveTab('chat')}
                                    className={`flex flex-col items-center justify-center gap-0.5 px-2 py-2 rounded-lg text-[10px] font-medium transition-all ${activeTab === 'chat'
                                        ? 'bg-blue-600 text-white shadow-sm'
                                        : 'text-slate-400 hover:bg-slate-800'
                                        }`}
                                >
                                    <MessageSquare className="w-4 h-4" />
                                    Chat
                                </button>
                                <button
                                    onClick={() => {
                                        setActiveTab('visual');
                                        if (visualExplainers.length === 0 && !isGeneratingVisuals) {
                                            handleGenerateVisuals();
                                        }
                                    }}
                                    className={`flex flex-col items-center justify-center gap-0.5 px-2 py-2 rounded-lg text-[10px] font-medium transition-all ${activeTab === 'visual'
                                        ? 'bg-blue-600 text-white shadow-sm'
                                        : 'text-slate-400 hover:bg-slate-800'
                                        }`}
                                >
                                    <Eye className="w-4 h-4" />
                                    Visual
                                </button>
                                {hasDevices && (
                                    <button
                                        onClick={() => {
                                            setActiveTab('schematic');
                                            if (!schematic && !isGeneratingSchematic) {
                                                handleGenerateSchematic();
                                            }
                                        }}
                                        className={`flex flex-col items-center justify-center gap-0.5 px-2 py-2 rounded-lg text-[10px] font-medium transition-all ${activeTab === 'schematic'
                                            ? 'bg-blue-600 text-white shadow-sm'
                                            : 'text-slate-400 hover:bg-slate-800'
                                            }`}
                                    >
                                        <Microscope className="w-4 h-4" />
                                        Setup
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Main Content Area */}
                <div className="flex-1 flex flex-col overflow-hidden min-h-0 bg-white">
                    {!analysis && !isAnalyzing && (
                        <div className="flex-1 flex items-center justify-center">
                            <div className="text-center max-w-md p-8">
                                <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-black flex items-center justify-center shadow-xl">
                                    <BookOpen className="w-10 h-10 text-white" />
                                </div>
                                <h2 className="text-2xl font-bold text-slate-900 mb-2">Upload a Lab Manual</h2>
                                <p className="text-slate-500 mb-6">
                                    Upload a PDF or DOCX lab manual to explore topics, ask questions, and generate experimental setup diagrams.
                                </p>
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="px-6 py-3 bg-black text-white font-semibold rounded-xl shadow-lg hover:bg-gray-800 transition-all"
                                >
                                    <Upload className="w-5 h-5 inline mr-2" />
                                    Choose File
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Topics Map Tab - Draw.io Based Concept Map */}
                    {analysis && activeTab === 'topics' && (
                        <div className="flex-1 overflow-hidden">
                            <ConceptMapDrawIO
                                title={analysis.outline.title}
                                topics={analysis.outline.topics.map(t => ({
                                    name: t.name,
                                    summary: t.summary,
                                    keywords: t.keywords || [],
                                    subtopics: t.children?.map((st: Topic) => ({
                                        name: st.name,
                                        summary: st.summary,
                                        keywords: st.keywords || [],
                                    })),
                                }))}
                                devices={analysis.devices.devices.map(d => ({
                                    name: d.name,
                                    role: d.role,
                                }))}
                                onTopicClick={(topic) => {
                                    // Find the full Topic object from analysis
                                    const fullTopic = analysis.outline.topics.find(t => t.name === topic.name);
                                    if (fullTopic) {
                                        setSelectedTopic(fullTopic);
                                    }
                                }}
                            />
                        </div>
                    )}

                    {/* Chat Tab */}
                    {analysis && activeTab === 'chat' && (
                        <div className="flex-1 flex flex-col overflow-hidden min-h-0">
                            {/* Chat Messages - Scrollable container */}
                            <div
                                ref={chatContainerRef}
                                className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0"
                            >
                                {chatMessages.map((msg, idx) => (
                                    <div
                                        key={idx}
                                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                    >
                                        <div
                                            className={`max-w-[80%] rounded-2xl px-4 py-3 ${msg.role === 'user'
                                                ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white'
                                                : 'bg-white border border-slate-200 text-slate-800 shadow-sm'
                                                }`}
                                        >
                                            <p className="text-sm whitespace-pre-wrap">{msg.content}</p>

                                            {/* Citations */}
                                            {msg.citations && msg.citations.length > 0 && (
                                                <div className="mt-3 pt-3 border-t border-slate-200/50 space-y-2">
                                                    <div className="flex items-center gap-1 text-xs text-slate-500">
                                                        <Quote className="w-3 h-3" />
                                                        Citations
                                                    </div>
                                                    {msg.citations.map((citation, cIdx) => (
                                                        <div
                                                            key={cIdx}
                                                            className="text-xs bg-slate-50 p-2 rounded-lg border-l-2 border-blue-400"
                                                        >
                                                            <p className="text-slate-600 italic">"{citation.text}"</p>
                                                            {citation.section && (
                                                                <p className="text-slate-400 mt-1">— {citation.section}</p>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}

                                {isChatting && (
                                    <div className="flex justify-start">
                                        <div className="bg-white border border-slate-200 rounded-2xl px-4 py-3 shadow-sm">
                                            <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                                        </div>
                                    </div>
                                )}

                                <div ref={chatEndRef} />
                            </div>

                            {/* Suggested Questions */}
                            {chatMessages.length <= 1 && suggestedQuestions.length > 0 && (
                                <div className="px-4 pb-2 flex-shrink-0">
                                    <div className="flex flex-wrap gap-2">
                                        {suggestedQuestions.slice(0, 3).map((q, idx) => (
                                            <button
                                                key={idx}
                                                onClick={() => setChatInput(q)}
                                                className="px-3 py-1.5 bg-slate-100 text-slate-700 text-xs font-medium rounded-full hover:bg-slate-200 transition-colors border border-slate-200"
                                            >
                                                {q}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Chat Input */}
                            <div className="p-4 bg-white border-t border-slate-200 flex-shrink-0">
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={chatInput}
                                        onChange={(e) => setChatInput(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                                        placeholder="Ask about the lab manual..."
                                        className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                                        disabled={isChatting}
                                    />
                                    <button
                                        onClick={handleSendMessage}
                                        disabled={!chatInput.trim() || isChatting}
                                        className="px-4 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl font-medium hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <Send className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Visual Explainer Tab - Uses new LabManualVisualizer with MathJax, Canvas, and more */}
                    {analysis && activeTab === 'visual' && (
                        <div className="flex-1 overflow-hidden">
                            <LabManualVisualizer
                                documentText={documentText}
                                topics={analysis.outline.topics.map(t => ({
                                    name: t.name,
                                    summary: t.summary,
                                }))}
                            />
                        </div>
                    )}

                    {/* Schematic Tab */}
                    {analysis && activeTab === 'schematic' && (
                        <div className="flex-1 flex flex-col items-center justify-center p-8 overflow-y-auto">
                            {isGeneratingSchematic && (
                                <div className="text-center">
                                    <Loader2 className="w-12 h-12 text-amber-500 animate-spin mx-auto mb-4" />
                                    <p className="text-lg font-medium text-slate-800">Generating Schematic...</p>
                                    <p className="text-sm text-slate-500">Creating a visual diagram of the experimental setup</p>
                                </div>
                            )}

                            {schematicError && (
                                <div className="text-center max-w-md">
                                    <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                                    <p className="text-lg font-medium text-slate-800 mb-2">Generation Failed</p>
                                    <p className="text-sm text-red-600 mb-4">{schematicError}</p>
                                    <button
                                        onClick={handleGenerateSchematic}
                                        className="px-4 py-2 bg-amber-500 text-white rounded-lg font-medium hover:bg-amber-600 transition-colors"
                                    >
                                        <RefreshCw className="w-4 h-4 inline mr-2" />
                                        Try Again
                                    </button>
                                </div>
                            )}

                            {schematic && !isGeneratingSchematic && (
                                <div className="w-full max-w-4xl">
                                    <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
                                        <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-4 flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <Microscope className="w-6 h-6 text-white" />
                                                <span className="text-lg font-semibold text-white">Experimental Setup</span>
                                            </div>
                                            <button
                                                onClick={handleGenerateSchematic}
                                                className="px-3 py-1.5 bg-white/20 text-white text-sm rounded-lg hover:bg-white/30 transition-colors flex items-center gap-1.5"
                                            >
                                                <RefreshCw className="w-4 h-4" />
                                                Regenerate
                                            </button>
                                        </div>
                                        <div className="p-6">
                                            <img
                                                src={`data:${schematic.mimeType};base64,${schematic.imageBase64}`}
                                                alt="Experimental Setup Diagram"
                                                className="w-full rounded-xl shadow-lg"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {!schematic && !isGeneratingSchematic && !schematicError && (
                                <div className="text-center">
                                    <Microscope className="w-16 h-16 text-amber-500 mx-auto mb-4" />
                                    <p className="text-lg font-medium text-slate-800 mb-4">Ready to Generate Schematic</p>
                                    <button
                                        onClick={handleGenerateSchematic}
                                        className="px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all hover:scale-105"
                                    >
                                        <Sparkles className="w-5 h-5 inline mr-2" />
                                        Generate Setup Diagram
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div >
    );
};

export default LabManualExplorer;
