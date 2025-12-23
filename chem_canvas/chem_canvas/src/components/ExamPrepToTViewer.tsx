import React from 'react';
import { ChevronRight, ChevronDown, CheckCircle2, XCircle, Zap, Target, HelpCircle, Sparkles } from 'lucide-react';
import {
    TotNode,
    TotNodeWithChildren,
    ExamPrepToTResponse,
    buildTreeFromNodes
} from '../services/examPrepToTService';

interface ExamPrepToTViewerProps {
    data: ExamPrepToTResponse;
    onExpandNode?: (node: TotNode) => void;
    expandingNodeId?: string | null;
}

interface NodeViewProps {
    node: TotNodeWithChildren;
    level: number;
    selectedId: string;
    onExpandNode?: (node: TotNode) => void;
    expandingNodeId?: string | null;
}

/**
 * Get status badge for a node
 */
function getStatusBadge(status: TotNode['status'], isSelected: boolean) {
    if (isSelected) {
        return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                <CheckCircle2 className="w-3 h-3" />
                Recommended
            </span>
        );
    }

    switch (status) {
        case 'selected':
            return (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    <CheckCircle2 className="w-3 h-3" />
                    Selected
                </span>
            );
        case 'rejected':
            return (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/20 text-red-400 border border-red-500/30">
                    <XCircle className="w-3 h-3" />
                    Rejected
                </span>
            );
        case 'expanded':
            return (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-500/20 text-blue-400 border border-blue-500/30">
                    <Zap className="w-3 h-3" />
                    Expanded
                </span>
            );
        default:
            return (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-500/20 text-slate-400 border border-slate-500/30">
                    <Target className="w-3 h-3" />
                    Candidate
                </span>
            );
    }
}

/**
 * Get score color based on value
 */
function getScoreColor(score: number): string {
    if (score >= 8) return 'text-emerald-400';
    if (score >= 6) return 'text-amber-400';
    if (score >= 4) return 'text-orange-400';
    return 'text-red-400';
}

/**
 * Individual node renderer
 */
const NodeView: React.FC<NodeViewProps> = ({
    node,
    level,
    selectedId,
    onExpandNode,
    expandingNodeId
}) => {
    const [isCollapsed, setIsCollapsed] = React.useState(false);
    const isSelected = node.id === selectedId;
    const hasChildren = node.children.length > 0;
    const isExpanding = expandingNodeId === node.id;
    const canExpand = node.status === 'candidate' && !hasChildren && onExpandNode;

    return (
        <div
            className={`
        relative
        ${level > 0 ? 'ml-6 border-l-2 border-slate-700/50 pl-4' : ''}
      `}
        >
            {/* Node Card */}
            <div
                className={`
          rounded-lg border p-4 mb-3 transition-all
          ${isSelected
                        ? 'bg-emerald-500/10 border-emerald-500/40 ring-1 ring-emerald-500/20'
                        : node.status === 'rejected'
                            ? 'bg-slate-800/30 border-slate-700/30 opacity-60'
                            : 'bg-slate-800/50 border-slate-700/50 hover:border-slate-600/50'
                    }
        `}
            >
                {/* Header */}
                <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                        {hasChildren && (
                            <button
                                onClick={() => setIsCollapsed(!isCollapsed)}
                                className="p-0.5 rounded hover:bg-slate-700/50 transition-colors flex-shrink-0"
                            >
                                {isCollapsed ? (
                                    <ChevronRight className="w-4 h-4 text-slate-400" />
                                ) : (
                                    <ChevronDown className="w-4 h-4 text-slate-400" />
                                )}
                            </button>
                        )}
                        <h4 className="font-semibold text-white text-sm truncate">
                            {node.title}
                        </h4>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                        {getStatusBadge(node.status, isSelected)}
                        <span className={`text-sm font-bold ${getScoreColor(node.score)}`}>
                            {node.score.toFixed(1)}
                        </span>
                    </div>
                </div>

                {/* Summary */}
                <p className="text-slate-300 text-sm mb-3 leading-relaxed">
                    {node.summary}
                </p>

                {/* Pros & Cons */}
                {(node.pros.length > 0 || node.cons.length > 0) && (
                    <div className="grid grid-cols-2 gap-4 mb-3">
                        {node.pros.length > 0 && (
                            <div>
                                <h5 className="text-xs font-medium text-emerald-400 uppercase tracking-wide mb-1.5">
                                    Pros
                                </h5>
                                <ul className="space-y-1">
                                    {node.pros.map((pro, i) => (
                                        <li key={i} className="text-xs text-slate-400 flex items-start gap-1.5">
                                            <span className="text-emerald-500 mt-0.5">+</span>
                                            <span>{pro}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        {node.cons.length > 0 && (
                            <div>
                                <h5 className="text-xs font-medium text-red-400 uppercase tracking-wide mb-1.5">
                                    Cons
                                </h5>
                                <ul className="space-y-1">
                                    {node.cons.map((con, i) => (
                                        <li key={i} className="text-xs text-slate-400 flex items-start gap-1.5">
                                            <span className="text-red-500 mt-0.5">−</span>
                                            <span>{con}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                )}

                {/* Next Questions */}
                {node.nextQuestions.length > 0 && (
                    <div className="border-t border-slate-700/50 pt-2 mt-2">
                        <div className="flex items-center gap-1.5 mb-1">
                            <HelpCircle className="w-3 h-3 text-slate-500" />
                            <span className="text-xs text-slate-500">Questions to explore</span>
                        </div>
                        <ul className="space-y-0.5">
                            {node.nextQuestions.map((q, i) => (
                                <li key={i} className="text-xs text-slate-400 italic">
                                    "{q}"
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* Expand Button */}
                {canExpand && (
                    <button
                        onClick={() => onExpandNode(node)}
                        disabled={isExpanding}
                        className={`
              mt-3 w-full py-2 rounded text-xs font-medium transition-all
              flex items-center justify-center gap-2
              ${isExpanding
                                ? 'bg-blue-500/20 text-blue-400 cursor-wait'
                                : 'bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border border-blue-500/30'
                            }
            `}
                    >
                        {isExpanding ? (
                            <>
                                <div className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                                Expanding...
                            </>
                        ) : (
                            <>
                                <ChevronDown className="w-3 h-3" />
                                Expand this approach
                            </>
                        )}
                    </button>
                )}
            </div>

            {/* Children */}
            {!isCollapsed && hasChildren && (
                <div className="mt-2">
                    {node.children.map(child => (
                        <NodeView
                            key={child.id}
                            node={child}
                            level={level + 1}
                            selectedId={selectedId}
                            onExpandNode={onExpandNode}
                            expandingNodeId={expandingNodeId}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

/**
 * Main ToT Viewer Component
 */
export const ExamPrepToTViewer: React.FC<ExamPrepToTViewerProps> = ({
    data,
    onExpandNode,
    expandingNodeId
}) => {
    const treeRoots = React.useMemo(() => buildTreeFromNodes(data.tree), [data.tree]);

    return (
        <div className="flex flex-col h-full bg-[#1a1a1a] text-white overflow-hidden">
            {/* Header */}
            <div className="flex-shrink-0 p-6 border-b border-slate-700/50 bg-[#1f1f1f]">
                <div className="flex items-start gap-3 mb-4">
                    <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400">
                        <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-white mb-1">
                            Study Plan Analysis
                        </h2>
                        <p className="text-slate-400 text-sm">
                            {data.problem}
                        </p>
                    </div>
                </div>

                {/* Criteria */}
                {data.criteria.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                        {data.criteria.map((criterion, i) => (
                            <span
                                key={i}
                                className="px-2.5 py-1 rounded-full text-xs bg-slate-800 text-slate-300 border border-slate-700"
                            >
                                {criterion}
                            </span>
                        ))}
                    </div>
                )}
            </div>

            {/* Tree View */}
            <div className="flex-1 overflow-y-auto p-6">
                <div className="max-w-3xl mx-auto">
                    {treeRoots.map(root => (
                        <NodeView
                            key={root.id}
                            node={root}
                            level={0}
                            selectedId={data.selectedId}
                            onExpandNode={onExpandNode}
                            expandingNodeId={expandingNodeId}
                        />
                    ))}
                </div>
            </div>

            {/* Final Answer */}
            {data.finalAnswer && (
                <div className="flex-shrink-0 p-6 border-t border-slate-700/50 bg-gradient-to-r from-emerald-500/10 to-blue-500/10">
                    <div className="max-w-3xl mx-auto">
                        <div className="flex items-center gap-2 mb-3">
                            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                            <h3 className="font-bold text-emerald-400">Recommended Study Plan</h3>
                        </div>
                        <p className="text-slate-200 leading-relaxed text-sm">
                            {data.finalAnswer}
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ExamPrepToTViewer;
