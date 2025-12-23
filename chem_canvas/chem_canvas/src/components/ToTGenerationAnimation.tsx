import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, GitBranch, CheckCircle2, XCircle, Zap } from 'lucide-react';

interface ToTGenerationAnimationProps {
    isGenerating: boolean;
    stage: 'analyzing' | 'generating' | 'evaluating' | 'selecting' | 'complete';
}

interface AnimatedNode {
    id: string;
    x: number;
    y: number;
    label: string;
    status: 'pending' | 'active' | 'evaluated' | 'selected' | 'rejected';
    score?: number;
    parentId?: string;
    delay: number;
}

const STAGES = [
    { key: 'analyzing', label: 'Analyzing Problem', icon: '🔍', color: '#8b5cf6' },
    { key: 'generating', label: 'Generating Candidates', icon: '🌱', color: '#10b981' },
    { key: 'evaluating', label: 'Evaluating Options', icon: '⚖️', color: '#f59e0b' },
    { key: 'selecting', label: 'Selecting Best Path', icon: '🎯', color: '#3b82f6' },
    { key: 'complete', label: 'Complete', icon: '✅', color: '#22c55e' },
];

export const ToTGenerationAnimation: React.FC<ToTGenerationAnimationProps> = ({
    isGenerating,
    stage
}) => {
    const [animatedNodes, setAnimatedNodes] = useState<AnimatedNode[]>([]);
    const [connections, setConnections] = useState<{ from: string; to: string; active: boolean }[]>([]);
    const [currentStageIndex, setCurrentStageIndex] = useState(0);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animationRef = useRef<number>(0);

    // Generate mock nodes for visualization
    useEffect(() => {
        if (!isGenerating) {
            setAnimatedNodes([]);
            setConnections([]);
            setCurrentStageIndex(0);
            return;
        }

        // Create nodes progressively
        const nodes: AnimatedNode[] = [
            // Root node
            { id: 'root', x: 250, y: 50, label: 'Problem', status: 'active', delay: 0 },
            // First level candidates
            { id: 'a', x: 100, y: 150, label: 'Approach A', status: 'pending', parentId: 'root', delay: 800 },
            { id: 'b', x: 250, y: 150, label: 'Approach B', status: 'pending', parentId: 'root', delay: 1000 },
            { id: 'c', x: 400, y: 150, label: 'Approach C', status: 'pending', parentId: 'root', delay: 1200 },
            // Second level (expanded from best)
            { id: 'b1', x: 180, y: 250, label: 'Strategy 1', status: 'pending', parentId: 'b', delay: 2000 },
            { id: 'b2', x: 320, y: 250, label: 'Strategy 2', status: 'pending', parentId: 'b', delay: 2200 },
        ];

        const conns = [
            { from: 'root', to: 'a', active: false },
            { from: 'root', to: 'b', active: false },
            { from: 'root', to: 'c', active: false },
            { from: 'b', to: 'b1', active: false },
            { from: 'b', to: 'b2', active: false },
        ];

        setAnimatedNodes(nodes);
        setConnections(conns);

        // Animate stages
        const stageTimers = [
            setTimeout(() => setCurrentStageIndex(1), 500),
            setTimeout(() => setCurrentStageIndex(2), 1500),
            setTimeout(() => setCurrentStageIndex(3), 2500),
        ];

        // Animate node appearances
        nodes.forEach((node, idx) => {
            setTimeout(() => {
                setAnimatedNodes(prev =>
                    prev.map(n => n.id === node.id ? { ...n, status: 'active' } : n)
                );
                // Activate connection
                if (node.parentId) {
                    setConnections(prev =>
                        prev.map(c => c.to === node.id ? { ...c, active: true } : c)
                    );
                }
            }, node.delay);
        });

        // Evaluate nodes (show scores)
        setTimeout(() => {
            setAnimatedNodes(prev => prev.map(n => {
                if (n.id === 'a') return { ...n, status: 'evaluated', score: 6.5 };
                if (n.id === 'b') return { ...n, status: 'evaluated', score: 8.5 };
                if (n.id === 'c') return { ...n, status: 'rejected', score: 4.0 };
                return n;
            }));
        }, 1800);

        // Select best path
        setTimeout(() => {
            setAnimatedNodes(prev => prev.map(n => {
                if (n.id === 'b1') return { ...n, status: 'evaluated', score: 7.8 };
                if (n.id === 'b2') return { ...n, status: 'selected', score: 9.2 };
                return n;
            }));
        }, 2800);

        return () => {
            stageTimers.forEach(t => clearTimeout(t));
        };
    }, [isGenerating]);

    // Draw connections on canvas
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const draw = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            connections.forEach(conn => {
                const fromNode = animatedNodes.find(n => n.id === conn.from);
                const toNode = animatedNodes.find(n => n.id === conn.to);

                if (!fromNode || !toNode) return;

                ctx.beginPath();
                ctx.moveTo(fromNode.x, fromNode.y + 20);
                ctx.lineTo(toNode.x, toNode.y - 20);
                ctx.strokeStyle = conn.active ? 'rgba(139, 92, 246, 0.6)' : 'rgba(100, 100, 100, 0.2)';
                ctx.lineWidth = conn.active ? 2 : 1;
                ctx.setLineDash(conn.active ? [] : [5, 5]);
                ctx.stroke();

                // Draw animated pulse on active connections
                if (conn.active) {
                    const progress = (Date.now() % 1000) / 1000;
                    const px = fromNode.x + (toNode.x - fromNode.x) * progress;
                    const py = (fromNode.y + 20) + ((toNode.y - 20) - (fromNode.y + 20)) * progress;

                    ctx.beginPath();
                    ctx.arc(px, py, 4, 0, Math.PI * 2);
                    ctx.fillStyle = '#8b5cf6';
                    ctx.fill();
                }
            });

            if (isGenerating) {
                animationRef.current = requestAnimationFrame(draw);
            }
        };

        draw();

        return () => {
            cancelAnimationFrame(animationRef.current);
        };
    }, [connections, animatedNodes, isGenerating]);

    const getNodeColor = (status: AnimatedNode['status']) => {
        switch (status) {
            case 'selected': return 'bg-emerald-500/30 border-emerald-500 ring-2 ring-emerald-500/50';
            case 'rejected': return 'bg-red-500/20 border-red-500/50 opacity-50';
            case 'evaluated': return 'bg-amber-500/20 border-amber-500/50';
            case 'active': return 'bg-violet-500/20 border-violet-500/50 animate-pulse';
            default: return 'bg-slate-700/50 border-slate-600 opacity-30';
        }
    };

    const getScoreColor = (score: number) => {
        if (score >= 8) return 'text-emerald-400';
        if (score >= 6) return 'text-amber-400';
        return 'text-red-400';
    };

    return (
        <div className="w-full h-full flex flex-col items-center justify-center bg-[#0f0f0f] text-white p-8 overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
                <div className="relative">
                    <div className="absolute inset-0 bg-violet-500 blur-xl opacity-30 animate-pulse"></div>
                    <GitBranch className="w-10 h-10 text-violet-400 relative" />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-white">Tree of Thoughts</h2>
                    <p className="text-sm text-slate-400">Building your study plan...</p>
                </div>
            </div>

            {/* Progress Stages */}
            <div className="flex items-center gap-2 mb-8">
                {STAGES.slice(0, 4).map((s, idx) => (
                    <React.Fragment key={s.key}>
                        <div
                            className={`
                flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-500
                ${idx <= currentStageIndex
                                    ? 'bg-white/10 text-white scale-100'
                                    : 'bg-white/5 text-slate-500 scale-95'
                                }
                ${idx === currentStageIndex ? 'ring-2 ring-violet-500/50' : ''}
              `}
                        >
                            <span>{s.icon}</span>
                            <span className="hidden sm:inline">{s.label}</span>
                        </div>
                        {idx < 3 && (
                            <div
                                className={`w-8 h-0.5 transition-all duration-500 ${idx < currentStageIndex ? 'bg-violet-500' : 'bg-slate-700'
                                    }`}
                            />
                        )}
                    </React.Fragment>
                ))}
            </div>

            {/* Tree Visualization */}
            <div className="relative w-[500px] h-[320px] rounded-2xl bg-slate-900/50 border border-slate-800 overflow-hidden">
                {/* Canvas for connections */}
                <canvas
                    ref={canvasRef}
                    width={500}
                    height={320}
                    className="absolute inset-0"
                />

                {/* Nodes */}
                {animatedNodes.map(node => (
                    <div
                        key={node.id}
                        className={`
              absolute transform -translate-x-1/2 -translate-y-1/2 transition-all duration-500
              ${node.status === 'pending' ? 'scale-0 opacity-0' : 'scale-100 opacity-100'}
            `}
                        style={{ left: node.x, top: node.y }}
                    >
                        <div
                            className={`
                relative px-3 py-1.5 rounded-lg border text-xs font-medium
                ${getNodeColor(node.status)}
              `}
                        >
                            <span className="text-white">{node.label}</span>

                            {/* Score badge */}
                            {node.score !== undefined && (
                                <span
                                    className={`
                    absolute -top-2 -right-2 px-1.5 py-0.5 rounded-full text-[10px] font-bold
                    bg-slate-900 border border-slate-700 ${getScoreColor(node.score)}
                  `}
                                >
                                    {node.score.toFixed(1)}
                                </span>
                            )}

                            {/* Status icon */}
                            {node.status === 'selected' && (
                                <CheckCircle2 className="absolute -bottom-1 -right-1 w-4 h-4 text-emerald-400" />
                            )}
                            {node.status === 'rejected' && (
                                <XCircle className="absolute -bottom-1 -right-1 w-4 h-4 text-red-400" />
                            )}
                        </div>
                    </div>
                ))}

                {/* Floating particles */}
                <div className="absolute inset-0 pointer-events-none overflow-hidden">
                    {[...Array(8)].map((_, i) => (
                        <div
                            key={i}
                            className="absolute w-1 h-1 bg-violet-500/50 rounded-full animate-pulse"
                            style={{
                                left: `${Math.random() * 100}%`,
                                top: `${Math.random() * 100}%`,
                                animationDelay: `${i * 200}ms`,
                                animationDuration: `${1500 + Math.random() * 1000}ms`,
                            }}
                        />
                    ))}
                </div>
            </div>

            {/* Status text */}
            <div className="mt-6 flex items-center gap-2 text-sm text-slate-400">
                <Sparkles className="w-4 h-4 text-violet-400 animate-pulse" />
                <span>
                    {currentStageIndex === 0 && 'Analyzing your topic and constraints...'}
                    {currentStageIndex === 1 && 'Generating multiple study approaches...'}
                    {currentStageIndex === 2 && 'Evaluating pros and cons of each approach...'}
                    {currentStageIndex === 3 && 'Selecting the optimal study path...'}
                </span>
            </div>

            {/* Legend */}
            <div className="mt-6 flex items-center gap-4 text-[10px] text-slate-500">
                <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-violet-500 animate-pulse"></div>
                    <span>Active</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                    <span>Evaluated</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                    <span>Selected</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-red-500 opacity-50"></div>
                    <span>Rejected</span>
                </div>
            </div>
        </div>
    );
};

export default ToTGenerationAnimation;
