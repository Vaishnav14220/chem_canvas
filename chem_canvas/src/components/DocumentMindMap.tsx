import React, { useMemo } from 'react';
import ReactFlow, {
  Background,
  Controls,
  Edge,
  MarkerType,
  MiniMap,
  Node,
  NodeProps,
  ReactFlowProvider
} from 'reactflow';
import 'reactflow/dist/style.css';

export interface MindMapBranchNode {
  id: string;
  title: string;
  summary?: string;
  concepts?: string[];
  guidingQuestions?: string[];
  examples?: string[];
  children?: MindMapBranchNode[];
}

export interface MindMapData {
  centralIdea: string;
  learningObjectives?: string[];
  branches: MindMapBranchNode[];
}

interface MindMapNodeData {
  title: string;
  summary?: string;
  concepts: string[];
  guidingQuestions: string[];
  examples: string[];
  depth: number;
  gradientClass: string;
}

const GRADIENT_CLASSES = [
  'bg-gradient-to-br from-indigo-500/80 via-sky-500/70 to-purple-500/80',
  'bg-gradient-to-br from-emerald-500/80 via-teal-500/70 to-sky-500/70',
  'bg-gradient-to-br from-rose-500/80 via-orange-500/70 to-amber-500/80',
  'bg-gradient-to-br from-fuchsia-500/80 via-purple-500/70 to-sky-500/70',
  'bg-gradient-to-br from-cyan-500/80 via-blue-500/70 to-indigo-500/70'
] as const;

const MAX_CONCEPTS_PER_NODE = 4;
const MAX_QUESTIONS_PER_NODE = 2;
const MAX_EXAMPLES_PER_NODE = 2;

const clip = (items: string[], limit: number): string[] => items.slice(0, limit);

const DocumentMindMapNode: React.FC<NodeProps<MindMapNodeData>> = ({ data }) => {
  const { title, summary, concepts, guidingQuestions, examples, depth, gradientClass } = data;

  return (
    <div
      className={`relative w-[240px] max-w-[280px] rounded-2xl border border-white/10 px-4 py-4 text-white shadow-[0_20px_60px_rgba(14,23,42,0.45)] backdrop-blur-lg ${gradientClass}`}
    >
      <div className="text-sm font-semibold uppercase tracking-wide text-white/90">{title}</div>
      {summary && <p className="mt-2 text-xs text-white/80">{summary}</p>}

      {concepts.length > 0 && (
        <div className="mt-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-white/70">
            Key ideas
          </p>
          <ul className="mt-1 space-y-1 text-[11px] text-white/85">
            {clip(concepts, MAX_CONCEPTS_PER_NODE).map((concept, index) => (
              <li key={`concept-${depth}-${index}`} className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-white/80" />
                <span className="leading-snug">{concept}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {guidingQuestions.length > 0 && (
        <div className="mt-3 rounded-xl border border-white/15 bg-white/10 p-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-white/80">
            Reflection
          </p>
          <ul className="mt-1 space-y-1 text-[11px] text-white/85">
            {clip(guidingQuestions, MAX_QUESTIONS_PER_NODE).map((question, index) => (
              <li key={`question-${depth}-${index}`}>{question}</li>
            ))}
          </ul>
        </div>
      )}

      {examples.length > 0 && (
        <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-2 text-[11px] text-white/80">
          <p className="font-semibold uppercase tracking-wide text-white/70">Examples</p>
          <ul className="mt-1 space-y-1">
            {clip(examples, MAX_EXAMPLES_PER_NODE).map((example, index) => (
              <li key={`example-${depth}-${index}`}>{example}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

const nodeTypes = {
  documentMindMap: DocumentMindMapNode
};

const buildGraph = (mindMap: MindMapData): { nodes: Node<MindMapNodeData>[]; edges: Edge[] } => {
  const nodes: Node<MindMapNodeData>[] = [];
  const edges: Edge[] = [];

  const rootId = 'mindmap-root';
  nodes.push({
    id: rootId,
    type: 'documentMindMap',
    position: { x: 0, y: 0 },
    data: {
      title: mindMap.centralIdea,
      summary: mindMap.learningObjectives && mindMap.learningObjectives.length > 0 ? mindMap.learningObjectives[0] : undefined,
      concepts: mindMap.learningObjectives ?? [],
      guidingQuestions: [],
      examples: [],
      depth: 0,
      gradientClass: GRADIENT_CLASSES[0]
    }
  });

  const layoutBranches = (
    branches: MindMapBranchNode[],
    depth: number,
    parentId: string,
    startAngle: number,
    endAngle: number
  ) => {
    if (!branches.length) {
      return;
    }

    const total = branches.length;
    const span = endAngle - startAngle;
    const slice = total === 1 ? span : span / total;
    const radius = 240 * depth;

    branches.forEach((branch, index) => {
      const angle = startAngle + slice * (index + 0.5);
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      const nodeId = branch.id;

      nodes.push({
        id: nodeId,
        type: 'documentMindMap',
        position: { x, y },
        data: {
          title: branch.title,
          summary: branch.summary,
          concepts: branch.concepts ?? [],
          guidingQuestions: branch.guidingQuestions ?? [],
          examples: branch.examples ?? [],
          depth,
          gradientClass: GRADIENT_CLASSES[depth % GRADIENT_CLASSES.length]
        }
      });

      edges.push({
        id: `${parentId}-${nodeId}`,
        source: parentId,
        target: nodeId,
        type: 'smoothstep',
        animated: true,
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: '#38bdf8',
          width: 16,
          height: 16
        },
        style: {
          stroke: '#38bdf8',
          strokeWidth: depth === 1 ? 2.2 : 1.6
        }
      });

      if (branch.children && branch.children.length > 0) {
        const childStart = angle - slice / 2;
        const childEnd = angle + slice / 2;
        layoutBranches(branch.children, depth + 1, nodeId, childStart, childEnd);
      }
    });
  };

  layoutBranches(mindMap.branches, 1, rootId, 0, Math.PI * 2);

  return { nodes, edges };
};

interface DocumentMindMapProps {
  mindMap: MindMapData | null;
}

const DocumentMindMap: React.FC<DocumentMindMapProps> = ({ mindMap }) => {
  const graph = useMemo(() => {
    if (!mindMap) {
      return { nodes: [], edges: [] };
    }
    return buildGraph(mindMap);
  }, [mindMap]);

  if (!mindMap) {
    return (
      <div className="flex h-64 items-center justify-center rounded-2xl border border-slate-700/60 bg-slate-900/60 text-sm text-slate-300">
        Select one or more topics and generate a mind map to visualise the connections.
      </div>
    );
  }

  return (
    <div className="relative h-[520px] w-full overflow-hidden rounded-2xl border border-slate-700/60 bg-slate-950/60">
      <ReactFlowProvider>
        <ReactFlow
          key={graph.nodes.length}
          nodes={graph.nodes}
          edges={graph.edges}
          fitView
          fitViewOptions={{ padding: 0.25, minZoom: 0.35, maxZoom: 1.5 }}
          nodeTypes={nodeTypes}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          panOnScroll
          panOnDrag
          zoomOnDoubleClick={false}
          zoomOnPinch
          attributionPosition="bottom-right"
        >
          <MiniMap pannable zoomable nodeColor="#38bdf8" maskColor="rgba(15,23,42,0.75)" />
          <Controls
            showInteractive={false}
            position="top-right"
            className="!bg-slate-900/70 !text-slate-200"
          />
          <Background gap={24} size={1} color="#1f2937" />
        </ReactFlow>
      </ReactFlowProvider>
    </div>
  );
};

export default DocumentMindMap;
