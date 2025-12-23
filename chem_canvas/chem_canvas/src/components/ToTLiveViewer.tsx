import React from 'react';
import { ChevronDown, ChevronRight, Brain, Sparkles, CheckCircle2, XCircle, Zap, Target, MessageSquare } from 'lucide-react';
import { ExamPrepToTResponse, TotNode, buildTreeFromNodes, TotNodeWithChildren } from '../services/examPrepToTService';

interface ToTLiveViewerProps {
    totData: ExamPrepToTResponse | null;
    thoughts: string[];
    isGenerating: boolean;
    stage: 'analyzing' | 'generating' | 'evaluating' | 'selecting' | 'complete';
}

const STAGES = [
    { key: 'analyzing', label: 'Analyzing Problem', icon: '🔍' },
    { key: 'generating', label: 'Generating Branches', icon: '🌱' },
    { key: 'evaluating', label: 'Evaluating Options', icon: '⚖️' },
    { key: 'selecting', label: 'Selecting Best Path', icon: '🎯' },
    { key: 'complete', label: 'Planning Complete', icon: '✅' },
];

/**
 * Get status badge for a node
 */
function getStatusBadge(status: TotNode['status']) {
    switch (status) {
        case 'selected':
            return (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/30 text-emerald-300 border border-emerald-500/50">
                    <CheckCircle2 className="w-3 h-3" />
                    SELECTED
                </span>
            );
        case 'rejected':
            return (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/30 text-red-300 border border-red-500/50">
                    <XCircle className="w-3 h-3" />
                    REJECTED
                </span>
            );
        case 'expanded':
            return (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/30 text-blue-300 border border-blue-500/50">
                    <Zap className="w-3 h-3" />
                    EXPANDED
                </span>
            );
        default:
            return (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-500/30 text-slate-300 border border-slate-500/50">
                    <Target className="w-3 h-3" />
                    CANDIDATE
                </span>
            );
    }
}

function getScoreColor(score: number): string {
    if (score >= 8) return 'text-emerald-400 bg-emerald-500/20';
    if (score >= 6) return 'text-amber-400 bg-amber-500/20';
    if (score >= 4) return 'text-orange-400 bg-orange-500/20';
    return 'text-red-400 bg-red-500/20';
}

/**
 * Render a single node in the tree
 */
const TreeNodeView: React.FC<{ node: TotNodeWithChildren; level: number; isSelected: boolean }> = ({
    node,
    level,
    isSelected
}) => {
    const [expanded, setExpanded] = React.useState(true);

    return (
        <div className={`${level > 0 ? 'ml-6 border-l-2 border-violet-500/30 pl-4' : ''}`}>
            <div
                className={`
          rounded-lg border p-3 mb-2 transition-all
          ${isSelected
                        ? 'bg-emerald-500/15 border-emerald-500/50 ring-2 ring-emerald-500/30'
                        : node.status === 'rejected'
                            ? 'bg-slate-800/40 border-slate-700/40 opacity-60'
                            : 'bg-slate-800/60 border-slate-700/50'
                    }
        `}
            >
                {/* Header */}
                <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                        {node.children.length > 0 && (
                            <button
                                onClick={() => setExpanded(!expanded)}
                                className="p-0.5 rounded hover:bg-slate-700/50"
                            >
                                {expanded ? (
                                    <ChevronDown className="w-4 h-4 text-slate-400" />
                                ) : (
                                    <ChevronRight className="w-4 h-4 text-slate-400" />
                                )}
                            </button>
                        )}
                        <h4 className="font-semibold text-white text-sm">{node.title}</h4>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                        {getStatusBadge(node.status)}
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${getScoreColor(node.score)}`}>
                            {node.score.toFixed(1)}
                        </span>
                    </div>
                </div>

                {/* Summary */}
                <p className="text-slate-300 text-xs mb-2 leading-relaxed">{node.summary}</p>

                {/* Pros & Cons inline */}
                {(node.pros.length > 0 || node.cons.length > 0) && (
                    <div className="flex gap-4 text-[10px]">
                        {node.pros.length > 0 && (
                            <div className="flex-1">
                                <span className="text-emerald-400 font-bold">PROS: </span>
                                <span className="text-slate-400">{node.pros.join(', ')}</span>
                            </div>
                        )}
                        {node.cons.length > 0 && (
                            <div className="flex-1">
                                <span className="text-red-400 font-bold">CONS: </span>
                                <span className="text-slate-400">{node.cons.join(', ')}</span>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Children */}
            {expanded && node.children.length > 0 && (
                <div className="mt-1">
                    {node.children.map(child => (
                        <TreeNodeView
                            key={child.id}
                            node={child}
                            level={level + 1}
                            isSelected={child.status === 'selected'}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

/**
 * Live ToT Viewer - Shows actual model thoughts and reasoning
 */
export const ToTLiveViewer: React.FC<ToTLiveViewerProps> = ({
    totData,
    thoughts,
    isGenerating,
    stage
}) => {
    const thoughtsEndRef = React.useRef<HTMLDivElement>(null);
    const treeRoots = React.useMemo(() =>
        totData ? buildTreeFromNodes(totData.tree) : [],
        [totData]
    );

    // Auto-scroll thoughts
    React.useEffect(() => {
        thoughtsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [thoughts]);

    const currentStageIndex = STAGES.findIndex(s => s.key === stage);

    return (
        <div className="flex flex-col h-full bg-[#0a0a0a] text-white overflow-hidden">
            {/* Header with Stage Progress */}
            <div className="flex-shrink-0 p-4 border-b border-slate-800 bg-[#111]">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 rounded-lg bg-violet-500/20">
                        <Brain className="w-6 h-6 text-violet-400" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold">Tree of Thoughts Reasoning</h2>
                        <p className="text-xs text-slate-400">
                            {isGenerating ? 'Exploring different approaches...' : 'Planning complete'}
                        </p>
                    </div>
                </div>

                {/* Stage Progress */}
                <div className="flex items-center gap-1 overflow-x-auto pb-2">
                    {STAGES.map((s, idx) => (
                        <React.Fragment key={s.key}>
                            <div
                                className={`
                  flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all
                  ${idx <= currentStageIndex
                                        ? 'bg-violet-500/20 text-violet-300 border border-violet-500/40'
                                        : 'bg-slate-800/50 text-slate-500 border border-slate-700/50'
                                    }
                  ${idx === currentStageIndex && isGenerating ? 'ring-2 ring-violet-500/50 animate-pulse' : ''}
                `}
                            >
                                <span>{s.icon}</span>
                                <span>{s.label}</span>
                            </div>
                            {idx < STAGES.length - 1 && (
                                <div className={`w-4 h-0.5 flex-shrink-0 ${idx < currentStageIndex ? 'bg-violet-500' : 'bg-slate-700'}`} />
                            )}
                        </React.Fragment>
                    ))}
                </div>
            </div>

            {/* Main Content - Split View */}
            <div className="flex-1 flex min-h-0 overflow-hidden">
                {/* Left: Model Thoughts Stream */}
                <div className="w-1/2 border-r border-slate-800 flex flex-col min-h-0">
                    <div className="flex items-center gap-2 px-4 py-2 bg-slate-900/50 border-b border-slate-800">
                        <MessageSquare className="w-4 h-4 text-violet-400" />
                        <span className="text-xs font-bold text-slate-300 uppercase tracking-wide">Model Thinking</span>
                        {isGenerating && (
                            <span className="ml-auto flex items-center gap-1 text-[10px] text-violet-400">
                                <span className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-pulse" />
                                Live
                            </span>
                        )}
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-2 text-xs font-mono">
                        {thoughts.length === 0 ? (
                            <div className="text-slate-500 italic">Waiting for model thoughts...</div>
                        ) : (
                            thoughts.map((thought, i) => (
                                <div
                                    key={i}
                                    className={`
                    p-2 rounded border-l-2 
                    ${thought.startsWith('✅')
                                            ? 'bg-emerald-500/10 border-emerald-500 text-emerald-300'
                                            : thought.startsWith('⚠️')
                                                ? 'bg-amber-500/10 border-amber-500 text-amber-300'
                                                : thought.startsWith('❌')
                                                    ? 'bg-red-500/10 border-red-500 text-red-300'
                                                    : 'bg-slate-800/50 border-violet-500/50 text-slate-300'
                                        }
                  `}
                                >
                                    {thought}
                                </div>
                            ))
                        )}
                        <div ref={thoughtsEndRef} />
                    </div>
                </div>

                {/* Right: ToT Tree View */}
                <div className="w-1/2 flex flex-col min-h-0">
                    <div className="flex items-center gap-2 px-4 py-2 bg-slate-900/50 border-b border-slate-800">
                        <Sparkles className="w-4 h-4 text-amber-400" />
                        <span className="text-xs font-bold text-slate-300 uppercase tracking-wide">Reasoning Tree</span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4">
                        {!totData ? (
                            <div className="flex flex-col items-center justify-center h-full text-slate-500">
                                <Brain className="w-12 h-12 mb-3 opacity-30 animate-pulse" />
                                <p className="text-sm">Generating reasoning tree...</p>
                                <p className="text-xs mt-1">The model is exploring different approaches</p>
                            </div>
                        ) : (
                            <>
                                {/* Problem Statement */}
                                <div className="mb-4 p-3 rounded-lg bg-slate-800/50 border border-slate-700">
                                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Problem</div>
                                    <p className="text-sm text-white">{totData.problem}</p>
                                </div>

                                {/* Criteria */}
                                {totData.criteria.length > 0 && (
                                    <div className="mb-4 flex flex-wrap gap-1">
                                        {totData.criteria.map((c, i) => (
                                            <span key={i} className="px-2 py-0.5 rounded-full text-[10px] bg-slate-800 text-slate-400 border border-slate-700">
                                                {c}
                                            </span>
                                        ))}
                                    </div>
                                )}

                                {/* Tree */}
                                <div className="space-y-2">
                                    {treeRoots.map(root => (
                                        <TreeNodeView
                                            key={root.id}
                                            node={root}
                                            level={0}
                                            isSelected={root.id === totData.selectedId}
                                        />
                                    ))}
                                </div>

                                {/* Final Answer */}
                                {totData.finalAnswer && (
                                    <div className="mt-4 p-3 rounded-lg bg-gradient-to-r from-emerald-500/15 to-blue-500/15 border border-emerald-500/30">
                                        <div className="flex items-center gap-2 mb-2">
                                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                            <span className="text-xs font-bold text-emerald-400 uppercase tracking-wide">Selected Strategy</span>
                                        </div>
                                        <p className="text-sm text-slate-200">{totData.finalAnswer}</p>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ToTLiveViewer;
