/**
 * Concept Network & Misconception Mapper Component
 * 
 * A React Flow-based visualization for showing concept relationships
 * and detected misconceptions during Socratic dialogue.
 * Redesigned for cleaner, more organized layout matching reference design.
 */

import React, { useCallback, useMemo, useEffect } from 'react';
import ReactFlow, {
    Node,
    Edge,
    Background,
    BackgroundVariant,
    NodeProps,
    Handle,
    Position,
    useNodesState,
    useEdgesState,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';

// Node types
export type ConceptNodeType = 'concept' | 'misconception' | 'central' | 'neutral' | 'misconceptionHub' | 'misconceptionDetail';

export interface ConceptNodeData {
    label: string;
    type: ConceptNodeType;
    isCorrect?: boolean;
    isMisconception?: boolean;
}

export interface ConceptNetworkProps {
    nodes: Node<ConceptNodeData>[];
    edges: Edge[];
    understandingLevel: 'Good' | 'Fair' | 'Poor' | 'Unknown';
    hasMisconceptions: boolean;
    onNodeClick?: (node: Node<ConceptNodeData>) => void;
}

// Central node - prominent emerald colored
const CentralNode: React.FC<NodeProps<ConceptNodeData>> = ({ data }) => {
    return (
        <div className="px-6 py-4 rounded-2xl bg-emerald-500 border-2 border-emerald-600 shadow-[0_12px_24px_rgba(16,185,129,0.35)] max-w-[240px]">
            <Handle type="target" position={Position.Top} className="!opacity-0 !w-0 !h-0 !border-0" />
            <Handle type="target" position={Position.Left} className="!opacity-0 !w-0 !h-0 !border-0" />
            <span className="text-white font-semibold text-[12px] text-center block leading-snug">{data.label}</span>
            <Handle type="source" position={Position.Bottom} className="!opacity-0 !w-0 !h-0 !border-0" />
            <Handle type="source" position={Position.Right} className="!opacity-0 !w-0 !h-0 !border-0" />
        </div>
    );
};

// Concept node - clean green with readable text
const ConceptNode: React.FC<NodeProps<ConceptNodeData>> = ({ data }) => {
    return (
        <div className="px-4 py-2 rounded-full bg-emerald-500 border border-emerald-600 shadow-[0_6px_12px_rgba(16,185,129,0.25)] max-w-[200px]">
            <Handle type="target" position={Position.Top} className="!opacity-0 !w-0 !h-0 !border-0" />
            <Handle type="target" position={Position.Left} className="!opacity-0 !w-0 !h-0 !border-0" />
            <span className="text-white font-semibold text-[11px] text-center block leading-snug">{data.label}</span>
            <Handle type="source" position={Position.Bottom} className="!opacity-0 !w-0 !h-0 !border-0" />
            <Handle type="source" position={Position.Right} className="!opacity-0 !w-0 !h-0 !border-0" />
        </div>
    );
};

// Neutral node - warm amber with readable text
const NeutralNode: React.FC<NodeProps<ConceptNodeData>> = ({ data }) => {
    return (
        <div className="px-4 py-2 rounded-full bg-orange-500 border border-orange-600 shadow-[0_6px_12px_rgba(249,115,22,0.25)] max-w-[200px]">
            <Handle type="target" position={Position.Top} className="!opacity-0 !w-0 !h-0 !border-0" />
            <Handle type="target" position={Position.Left} className="!opacity-0 !w-0 !h-0 !border-0" />
            <span className="text-white font-semibold text-[11px] text-center block leading-snug">{data.label}</span>
            <Handle type="source" position={Position.Bottom} className="!opacity-0 !w-0 !h-0 !border-0" />
            <Handle type="source" position={Position.Right} className="!opacity-0 !w-0 !h-0 !border-0" />
        </div>
    );
};

// Misconception hub - orange pill
const MisconceptionHubNode: React.FC<NodeProps<ConceptNodeData>> = ({ data }) => {
    return (
        <div className="px-4 py-2 rounded-full bg-orange-600 border border-orange-700 shadow-[0_6px_12px_rgba(234,88,12,0.25)] max-w-[200px]">
            <Handle type="target" position={Position.Top} className="!opacity-0 !w-0 !h-0 !border-0" />
            <Handle type="target" position={Position.Left} className="!opacity-0 !w-0 !h-0 !border-0" />
            <span className="text-white font-semibold text-[11px] text-center block leading-snug">{data.label}</span>
            <Handle type="source" position={Position.Bottom} className="!opacity-0 !w-0 !h-0 !border-0" />
            <Handle type="source" position={Position.Right} className="!opacity-0 !w-0 !h-0 !border-0" />
        </div>
    );
};

// Misconception detail node - orange card
const MisconceptionDetailNode: React.FC<NodeProps<ConceptNodeData>> = ({ data }) => {
    return (
        <div className="px-4 py-3 rounded-2xl bg-orange-100 border border-orange-300 shadow-md max-w-[240px]">
            <Handle type="target" position={Position.Top} className="!opacity-0 !w-0 !h-0 !border-0" />
            <Handle type="target" position={Position.Left} className="!opacity-0 !w-0 !h-0 !border-0" />
            <span className="text-orange-900 font-medium text-[11px] leading-snug block">{data.label}</span>
            <Handle type="source" position={Position.Bottom} className="!opacity-0 !w-0 !h-0 !border-0" />
            <Handle type="source" position={Position.Right} className="!opacity-0 !w-0 !h-0 !border-0" />
        </div>
    );
};

// Misconception node - red with full readable text (legacy)
const MisconceptionNode: React.FC<NodeProps<ConceptNodeData>> = ({ data }) => {
    return (
        <div className="px-3 py-2 rounded-lg bg-orange-600 border border-orange-700 shadow-md max-w-[200px]">
            <Handle type="target" position={Position.Top} className="!opacity-0 !w-0 !h-0 !border-0" />
            <Handle type="target" position={Position.Left} className="!opacity-0 !w-0 !h-0 !border-0" />
            <span className="text-white font-medium text-[10px] leading-tight block">{data.label}</span>
            <Handle type="source" position={Position.Bottom} className="!opacity-0 !w-0 !h-0 !border-0" />
            <Handle type="source" position={Position.Right} className="!opacity-0 !w-0 !h-0 !border-0" />
        </div>
    );
};

const nodeTypes = {
    concept: ConceptNode,
    central: CentralNode,
    neutral: NeutralNode,
    misconception: MisconceptionNode,
    misconceptionHub: MisconceptionHubNode,
    misconceptionDetail: MisconceptionDetailNode,
};

export const ConceptNetworkGraph: React.FC<ConceptNetworkProps> = ({
    nodes: initialNodes,
    edges: initialEdges,
    understandingLevel,
    hasMisconceptions,
    onNodeClick,
}) => {
    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

    // Sync nodes and edges when props change
    useEffect(() => {
        if (initialNodes.length > 0) {
            setNodes(initialNodes);
        }
    }, [initialNodes, setNodes]);

    useEffect(() => {
        if (initialEdges.length > 0) {
            setEdges(initialEdges);
        }
    }, [initialEdges, setEdges]);

    const handleNodeClick = useCallback(
        (_: React.MouseEvent, node: Node<ConceptNodeData>) => {
            onNodeClick?.(node);
        },
        [onNodeClick]
    );

    const getUnderstandingColor = useMemo(() => {
        switch (understandingLevel) {
            case 'Good':
                return 'text-emerald-600';
            case 'Fair':
                return 'text-amber-500';
            case 'Poor':
                return 'text-red-500';
            default:
                return 'text-slate-500';
        }
    }, [understandingLevel]);

    return (
        <div className="flex flex-col h-full bg-slate-50 rounded-xl border border-slate-200 overflow-hidden shadow-sm">
            {/* Header */}
            <div className="px-5 py-4 bg-white border-b border-slate-200">
                <h3 className="text-lg font-bold text-slate-800">
                    Concept Network &<br />Misconception Mapper
                </h3>
            </div>

            {/* Graph Area */}
            <div className="flex-1 relative bg-white" style={{ minHeight: '400px' }}>
                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onNodeClick={handleNodeClick}
                    nodeTypes={nodeTypes}
                    fitView
                    fitViewOptions={{ padding: 0.4, maxZoom: 1 }}
                    minZoom={0.4}
                    maxZoom={1.2}
                    proOptions={{ hideAttribution: true }}
                    nodesDraggable={true}
                    nodesConnectable={false}
                    elementsSelectable={true}
                    panOnDrag={true}
                    zoomOnScroll={true}
                    defaultEdgeOptions={{
                        type: 'smoothstep',
                        style: { strokeWidth: 2, stroke: '#34a853' }
                    }}
                >
                    <Background variant={BackgroundVariant.Lines} gap={24} size={1} color="#e5e7eb" />
                </ReactFlow>
            </div>

            {/* Status Footer */}
            <div className="px-4 py-3 bg-white border-t border-slate-200">
                <div className="flex items-center justify-center gap-2 text-sm">
                    <span className="text-slate-500">Current Understanding:</span>
                    <span className={`font-bold ${getUnderstandingColor}`}>
                        {understandingLevel}
                    </span>
                    {hasMisconceptions && (
                        <>
                            <span className="text-slate-300 mx-1">|</span>
                            <span className="text-amber-600 flex items-center gap-1 font-medium">
                                <AlertTriangle className="w-4 h-4" />
                                Potential Misconception Detected.
                            </span>
                        </>
                    )}
                    {!hasMisconceptions && understandingLevel === 'Good' && (
                        <>
                            <span className="text-slate-300 mx-1">|</span>
                            <span className="text-emerald-600 flex items-center gap-1 font-medium">
                                <CheckCircle2 className="w-4 h-4" />
                                On track!
                            </span>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

// Helper function to generate structured concept network layout
export const generateConceptNetwork = (
    topic: string,
    correctConcepts: string[],
    misconceptions: string[],
    centralConcept?: string
): { nodes: Node<ConceptNodeData>[]; edges: Edge[] } => {
    const nodes: Node<ConceptNodeData>[] = [];
    const edges: Edge[] = [];

    // Central node - positioned in the center
    const central = centralConcept || topic;
    const centerX = 320;
    const centerY = 210;
    nodes.push({
        id: 'central',
        type: 'central',
        position: { x: centerX, y: centerY },
        data: { label: central, type: 'central', isCorrect: true },
    });

    // Position concepts in a clean grid/arc layout around center
    const conceptCount = correctConcepts.length;

    if (conceptCount <= 4) {
        const slots = [
            { x: centerX - 190, y: 60 },
            { x: centerX + 150, y: 60 },
            { x: centerX + 150, y: 320 },
            { x: centerX - 190, y: 320 },
        ];

        correctConcepts.forEach((concept, index) => {
            const slot = slots[index] || { x: centerX, y: 60 + index * 80 };
            const nodeId = `concept-${index}`;
            const isExample = concept.toLowerCase().includes('example');
            const nodeType = isExample ? 'neutral' : 'concept';
            nodes.push({
                id: nodeId,
                type: nodeType,
                position: { x: slot.x, y: slot.y },
                data: { label: concept, type: nodeType as ConceptNodeType, isCorrect: true },
            });

            edges.push({
                id: `edge-${nodeId}`,
                source: 'central',
                target: nodeId,
                style: { stroke: '#34a853', strokeWidth: 2 },
                type: 'smoothstep',
            });
        });
    } else if (conceptCount <= 6) {
        const topConcepts = correctConcepts.slice(0, Math.ceil(conceptCount / 2));
        const bottomConcepts = correctConcepts.slice(Math.ceil(conceptCount / 2));

        topConcepts.forEach((concept, index) => {
            const spacing = 180;
            const startX = centerX - ((topConcepts.length - 1) * spacing) / 2;
            const x = startX + index * spacing;
            const y = 70;

            const nodeId = `concept-${index}`;
            const isExample = concept.toLowerCase().includes('example');
            nodes.push({
                id: nodeId,
                type: isExample ? 'neutral' : 'concept',
                position: { x, y },
                data: { label: concept, type: isExample ? 'neutral' : 'concept', isCorrect: true },
            });

            edges.push({
                id: `edge-${nodeId}`,
                source: 'central',
                target: nodeId,
                style: { stroke: '#34a853', strokeWidth: 2 },
                type: 'smoothstep',
            });
        });

        bottomConcepts.forEach((concept, index) => {
            const spacing = 180;
            const startX = centerX - ((bottomConcepts.length - 1) * spacing) / 2;
            const x = startX + index * spacing;
            const y = 330;

            const nodeId = `concept-${topConcepts.length + index}`;
            const isExample = concept.toLowerCase().includes('example');
            nodes.push({
                id: nodeId,
                type: isExample ? 'neutral' : 'concept',
                position: { x, y },
                data: { label: concept, type: isExample ? 'neutral' : 'concept', isCorrect: true },
            });

            edges.push({
                id: `edge-${nodeId}`,
                source: 'central',
                target: nodeId,
                style: { stroke: '#34a853', strokeWidth: 2 },
                type: 'smoothstep',
            });
        });
    } else {
        const radius = 190;
        correctConcepts.forEach((concept, index) => {
            const angle = (2 * Math.PI * index) / conceptCount - Math.PI / 2;
            const x = centerX + radius * Math.cos(angle);
            const y = centerY + radius * Math.sin(angle);

            const nodeId = `concept-${index}`;
            const isExample = concept.toLowerCase().includes('example');
            nodes.push({
                id: nodeId,
                type: isExample ? 'neutral' : 'concept',
                position: { x, y },
                data: { label: concept, type: isExample ? 'neutral' : 'concept', isCorrect: true },
            });

            edges.push({
                id: `edge-${nodeId}`,
                source: 'central',
                target: nodeId,
                style: { stroke: '#34a853', strokeWidth: 2 },
                type: 'smoothstep',
            });
        });
    }

    if (misconceptions.length > 0) {
        const hubId = 'misconception-hub';
        const hubX = centerX - 200;
        const hubY = centerY + 80;
        nodes.push({
            id: hubId,
            type: 'misconceptionHub',
            position: { x: hubX, y: hubY },
            data: { label: 'Misconceptions', type: 'misconceptionHub' },
        });

        edges.push({
            id: `edge-${hubId}`,
            source: 'central',
            target: hubId,
            style: { stroke: '#f59e0b', strokeWidth: 2 },
            type: 'smoothstep',
        });

        misconceptions.slice(0, 3).forEach((misconception, index) => {
            const nodeId = `misdetail-${index}`;
            nodes.push({
                id: nodeId,
                type: 'misconceptionDetail',
                position: { x: hubX - 40, y: hubY + 70 + index * 90 },
                data: {
                    label: misconception,
                    type: 'misconceptionDetail',
                    isMisconception: true
                },
            });

            edges.push({
                id: `edge-${nodeId}`,
                source: hubId,
                target: nodeId,
                style: { stroke: '#f59e0b', strokeWidth: 2, strokeDasharray: '6 6' },
                type: 'smoothstep',
            });
        });
    }

    return { nodes, edges };
};

export default ConceptNetworkGraph;
