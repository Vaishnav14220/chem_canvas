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
export type ConceptNodeType = 'concept' | 'misconception' | 'central' | 'neutral';

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
        <div className="px-3 py-2 rounded-xl bg-gradient-to-br from-emerald-100 to-emerald-200 border-2 border-emerald-500 shadow-lg max-w-[160px]">
            <Handle type="target" position={Position.Top} className="!bg-emerald-500 !w-2 !h-2 !border-0" />
            <Handle type="target" position={Position.Left} className="!bg-emerald-500 !w-2 !h-2 !border-0" />
            <span className="text-emerald-900 font-bold text-[11px] text-center block leading-tight">{data.label}</span>
            <Handle type="source" position={Position.Bottom} className="!bg-emerald-500 !w-2 !h-2 !border-0" />
            <Handle type="source" position={Position.Right} className="!bg-emerald-500 !w-2 !h-2 !border-0" />
        </div>
    );
};

// Concept node - clean green with readable text
const ConceptNode: React.FC<NodeProps<ConceptNodeData>> = ({ data }) => {
    return (
        <div className="px-2.5 py-1.5 rounded-lg bg-white border-2 border-green-500 shadow-sm max-w-[180px]">
            <Handle type="target" position={Position.Top} className="!bg-green-500 !w-2 !h-2 !border-0" />
            <Handle type="target" position={Position.Left} className="!bg-green-500 !w-2 !h-2 !border-0" />
            <span className="text-green-800 font-medium text-[10px] text-center block leading-tight">{data.label}</span>
            <Handle type="source" position={Position.Bottom} className="!bg-green-500 !w-2 !h-2 !border-0" />
            <Handle type="source" position={Position.Right} className="!bg-green-500 !w-2 !h-2 !border-0" />
        </div>
    );
};

// Neutral node - warm amber with readable text
const NeutralNode: React.FC<NodeProps<ConceptNodeData>> = ({ data }) => {
    return (
        <div className="px-2.5 py-1.5 rounded-lg bg-white border-2 border-amber-500 shadow-sm max-w-[180px]">
            <Handle type="target" position={Position.Top} className="!bg-amber-500 !w-2 !h-2 !border-0" />
            <Handle type="target" position={Position.Left} className="!bg-amber-500 !w-2 !h-2 !border-0" />
            <span className="text-amber-800 font-medium text-[10px] text-center block leading-tight">{data.label}</span>
            <Handle type="source" position={Position.Bottom} className="!bg-amber-500 !w-2 !h-2 !border-0" />
            <Handle type="source" position={Position.Right} className="!bg-amber-500 !w-2 !h-2 !border-0" />
        </div>
    );
};

// Misconception node - red with full readable text
const MisconceptionNode: React.FC<NodeProps<ConceptNodeData>> = ({ data }) => {
    return (
        <div className="px-2.5 py-1.5 rounded-lg bg-red-50 border-2 border-red-500 shadow-md max-w-[200px]">
            <Handle type="target" position={Position.Top} className="!bg-red-500 !w-2 !h-2 !border-0" />
            <Handle type="target" position={Position.Left} className="!bg-red-500 !w-2 !h-2 !border-0" />
            <div className="flex items-start gap-1">
                <AlertTriangle className="w-3 h-3 text-red-600 flex-shrink-0 mt-0.5" />
                <span className="text-red-800 font-medium text-[10px] leading-tight">{data.label}</span>
            </div>
            <Handle type="source" position={Position.Bottom} className="!bg-red-500 !w-2 !h-2 !border-0" />
            <Handle type="source" position={Position.Right} className="!bg-red-500 !w-2 !h-2 !border-0" />
        </div>
    );
};

const nodeTypes = {
    concept: ConceptNode,
    central: CentralNode,
    neutral: NeutralNode,
    misconception: MisconceptionNode,
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
                        style: { strokeWidth: 2 }
                    }}
                >
                    <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#cbd5e1" />
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
                            <span className="text-slate-300 mx-1">•</span>
                            <span className="text-amber-600 flex items-center gap-1 font-medium">
                                <AlertTriangle className="w-4 h-4" />
                                Potential Misconception Detected.
                            </span>
                        </>
                    )}
                    {!hasMisconceptions && understandingLevel === 'Good' && (
                        <>
                            <span className="text-slate-300 mx-1">•</span>
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
    nodes.push({
        id: 'central',
        type: 'central',
        position: { x: 300, y: 200 },
        data: { label: central, type: 'central', isCorrect: true },
    });

    // Position concepts in a clean grid/arc layout around center
    const conceptCount = correctConcepts.length;

    if (conceptCount <= 6) {
        // Arrange in two rows: top and bottom
        const topConcepts = correctConcepts.slice(0, Math.ceil(conceptCount / 2));
        const bottomConcepts = correctConcepts.slice(Math.ceil(conceptCount / 2));

        // Top row
        topConcepts.forEach((concept, index) => {
            const spacing = 160; // Increased spacing for wider nodes
            const startX = 300 - ((topConcepts.length - 1) * spacing) / 2;
            const x = startX + index * spacing;
            const y = 50;

            const nodeId = `concept-${index}`;
            nodes.push({
                id: nodeId,
                type: 'concept',
                position: { x, y },
                data: { label: concept, type: 'concept', isCorrect: true },
            });

            edges.push({
                id: `edge-${nodeId}`,
                source: 'central',
                target: nodeId,
                style: { stroke: '#86efac', strokeWidth: 2 },
                type: 'smoothstep',
            });
        });

        // Bottom row
        bottomConcepts.forEach((concept, index) => {
            const spacing = 160; // Increased spacing for wider nodes
            const startX = 300 - ((bottomConcepts.length - 1) * spacing) / 2;
            const x = startX + index * spacing;
            const y = 350;

            const nodeId = `concept-${topConcepts.length + index}`;
            nodes.push({
                id: nodeId,
                type: index === 0 ? 'neutral' : 'concept',
                position: { x, y },
                data: { label: concept, type: index === 0 ? 'neutral' : 'concept', isCorrect: true },
            });

            edges.push({
                id: `edge-${nodeId}`,
                source: 'central',
                target: nodeId,
                style: { stroke: '#86efac', strokeWidth: 2 },
                type: 'smoothstep',
            });
        });
    } else {
        // Circular layout for more concepts
        const radius = 160; // Increased radius
        correctConcepts.forEach((concept, index) => {
            const angle = (2 * Math.PI * index) / conceptCount - Math.PI / 2;
            const x = 300 + radius * Math.cos(angle);
            const y = 200 + radius * Math.sin(angle);

            const nodeId = `concept-${index}`;
            nodes.push({
                id: nodeId,
                type: 'concept',
                position: { x, y },
                data: { label: concept, type: 'concept', isCorrect: true },
            });

            edges.push({
                id: `edge-${nodeId}`,
                source: 'central',
                target: nodeId,
                style: { stroke: '#86efac', strokeWidth: 2 },
                type: 'smoothstep',
            });
        });
    }

    // Add misconception nodes to the right side
    misconceptions.forEach((misconception, index) => {
        const x = 550; // Moved slightly further right
        const y = 180 + index * 90; // Increased vertical spacing

        const nodeId = `misconception-${index}`;
        nodes.push({
            id: nodeId,
            type: 'misconception',
            position: { x, y },
            data: {
                label: misconception,
                type: 'misconception',
                isMisconception: true
            },
        });

        // Connect to nearest concept or central
        const sourceId = nodes.length > 2 ? `concept-${index % (nodes.length - 1)}` : 'central';
        edges.push({
            id: `edge-${nodeId}`,
            source: sourceId,
            target: nodeId,
            style: { stroke: '#f87171', strokeWidth: 2, strokeDasharray: '8,4' },
            type: 'smoothstep',
            animated: true,
        });
    });

    return { nodes, edges };
};

export default ConceptNetworkGraph;
