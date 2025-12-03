import React, { useCallback, useEffect, useState } from 'react';
import ReactFlow, {
    useNodesState,
    useEdgesState,
    Controls,
    Background,
    MiniMap,
    Node,
    Edge,
    Position,
    NodeMouseHandler,
} from 'reactflow';
import 'reactflow/dist/style.css';
// @ts-ignore
import dagre from 'dagre/dist/dagre.min.js';
import { ReactFlowData, extendMindMapNode } from '../services/immersiveLearningService';
import { Sparkles, Loader2, X } from 'lucide-react';

interface ReactFlowMindMapProps {
    data: ReactFlowData;
}

const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));

const nodeWidth = 220; // Wider nodes
const nodeHeight = 60; // Taller nodes

const getLayoutedElements = (nodes: Node[], edges: Edge[], direction = 'LR') => {
    const isHorizontal = direction === 'LR';
    dagreGraph.setGraph({
        rankdir: direction,
        ranksep: 150, // Increased rank separation
        nodesep: 80   // Increased node separation
    });

    nodes.forEach((node) => {
        dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
    });

    edges.forEach((edge) => {
        dagreGraph.setEdge(edge.source, edge.target);
    });

    dagre.layout(dagreGraph);

    nodes.forEach((node) => {
        const nodeWithPosition = dagreGraph.node(node.id);
        node.targetPosition = isHorizontal ? Position.Left : Position.Top;
        node.sourcePosition = isHorizontal ? Position.Right : Position.Bottom;

        // We are shifting the dagre node position (anchor=center center) to the top left
        // so it matches the React Flow node anchor point (top left).
        node.position = {
            x: nodeWithPosition.x - nodeWidth / 2,
            y: nodeWithPosition.y - nodeHeight / 2,
        };

        return node;
    });

    return { nodes, edges };
};

const colors = [
    { bg: '#E8F0FE', border: '#4285F4', text: '#1967D2' }, // Level 0 - Blue
    { bg: '#FCE8E6', border: '#EA4335', text: '#C5221F' }, // Level 1 - Red
    { bg: '#FEF7E0', border: '#FBBC04', text: '#B06000' }, // Level 2 - Yellow
    { bg: '#E6F4EA', border: '#34A853', text: '#137333' }, // Level 3 - Green
    { bg: '#F3E8FD', border: '#A142F4', text: '#8430CE' }, // Level 4 - Purple
    { bg: '#E0F2F1', border: '#009688', text: '#00796B' }, // Level 5 - Teal
];

const assignStyles = (nodes: Node[], edges: Edge[]) => {
    const adjacencyList: Record<string, string[]> = {};
    const inDegree: Record<string, number> = {};

    nodes.forEach(n => {
        adjacencyList[n.id] = [];
        inDegree[n.id] = 0;
    });

    edges.forEach(e => {
        if (adjacencyList[e.source]) {
            adjacencyList[e.source].push(e.target);
        }
        inDegree[e.target] = (inDegree[e.target] || 0) + 1;
    });

    const queue: { id: string; level: number }[] = [];
    nodes.forEach(n => {
        if (inDegree[n.id] === 0) {
            queue.push({ id: n.id, level: 0 });
        }
    });

    const nodeLevels: Record<string, number> = {};

    while (queue.length > 0) {
        const { id, level } = queue.shift()!;
        nodeLevels[id] = level;

        if (adjacencyList[id]) {
            adjacencyList[id].forEach(childId => {
                queue.push({ id: childId, level: level + 1 });
            });
        }
    }

    return nodes.map(node => {
        const level = nodeLevels[node.id] !== undefined ? nodeLevels[node.id] : 0;
        const colorScheme = colors[level % colors.length];
        return {
            ...node,
            style: {
                background: '#ffffff', // White background for cleaner look
                border: `2px solid ${colorScheme.bg}`, // Colored border
                borderLeft: `6px solid ${colorScheme.border}`, // Accent on left
                borderRadius: '12px', // More rounded
                padding: '12px 16px',
                fontSize: level === 0 ? '18px' : level === 1 ? '16px' : '14px',
                fontWeight: level === 0 ? '600' : '500',
                color: '#202124', // Dark grey text
                width: nodeWidth,
                textAlign: 'left' as const, // Left align text
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)', // Softer shadow
                fontFamily: '"Google Sans", Roboto, sans-serif',
            },
        };
    });
};

const ReactFlowMindMap: React.FC<ReactFlowMindMapProps> = ({ data }) => {
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [selectedNode, setSelectedNode] = useState<Node | null>(null);
    const [isExpanding, setIsExpanding] = useState(false);

    useEffect(() => {
        if (data && data.nodes.length > 0) {
            const styledNodes = assignStyles(data.nodes, data.edges);
            const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
                styledNodes,
                data.edges
            );
            setNodes(layoutedNodes);
            setEdges(layoutedEdges);
        }
    }, [data, setNodes, setEdges]);

    const onNodeClick: NodeMouseHandler = useCallback((event, node) => {
        setSelectedNode(node);
    }, []);

    const onPaneClick = useCallback(() => {
        setSelectedNode(null);
    }, []);

    const handleExpandNode = async () => {
        if (!selectedNode) return;

        setIsExpanding(true);
        try {
            // Get context from immediate parent (if any) to help AI
            const parentEdge = edges.find(e => e.target === selectedNode.id);
            const parentNode = parentEdge ? nodes.find(n => n.id === parentEdge.source) : null;
            const context = parentNode ? `Parent node: ${parentNode.data.label}` : '';

            const newData = await extendMindMapNode(selectedNode.data.label, context);

            if (newData && newData.nodes.length > 0) {
                // Replace placeholder source ID with actual selected node ID
                const newEdges = newData.edges.map(edge => ({
                    ...edge,
                    source: edge.source === 'original_node_id_placeholder' ? selectedNode.id : edge.source
                }));

                const allNodes = [...nodes, ...newData.nodes];
                const allEdges = [...edges, ...newEdges];

                // Re-apply styles and layout
                const styledNodes = assignStyles(allNodes, allEdges);
                const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
                    styledNodes,
                    allEdges
                );

                setNodes(layoutedNodes);
                setEdges(layoutedEdges);
            }
        } catch (error) {
            console.error("Failed to expand node:", error);
        } finally {
            setIsExpanding(false);
            setSelectedNode(null); // Deselect after expansion
        }
    };

    return (
        <div className="absolute inset-0 w-full h-full relative">
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onNodeClick={onNodeClick}
                onPaneClick={onPaneClick}
                fitView
            >
                <Controls />
                <MiniMap />
                <Background gap={12} size={1} />
            </ReactFlow>

            {/* Floating Action Button for AI Expansion */}
            {selectedNode && (
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-white p-2 rounded-full shadow-lg border border-gray-200 flex items-center gap-2 animate-in fade-in slide-in-from-bottom-4 duration-200 z-50">
                    <span className="pl-3 text-sm font-medium text-gray-700">
                        {selectedNode.data.label}
                    </span>
                    <div className="h-4 w-[1px] bg-gray-300 mx-1" />
                    <button
                        onClick={handleExpandNode}
                        disabled={isExpanding}
                        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-violet-500 text-white rounded-full hover:shadow-md transition-all disabled:opacity-70"
                    >
                        {isExpanding ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>Expanding...</span>
                            </>
                        ) : (
                            <>
                                <Sparkles className="w-4 h-4" />
                                <span>Expand with AI</span>
                            </>
                        )}
                    </button>
                    <button
                        onClick={() => setSelectedNode(null)}
                        className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}
        </div>
    );
};

export default ReactFlowMindMap;
