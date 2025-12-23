import { useEffect, useRef, useState } from 'react';
import ReactFlow, {
  type Edge,
  Background,
  BackgroundVariant,
  Controls,
  type Node,
  useEdgesState,
  useNodesState,
} from 'reactflow';
import 'reactflow/dist/style.css';

const stableNodeTypes = {};
const stableEdgeTypes = {};

const defaultNodes: Node[] = [
  {
    id: '1',
    position: { x: 0, y: 0 },
    data: { label: 'Research Topic' },
    style: {
      background: '#fff',
      color: '#000',
      border: '1px solid #e5e7eb',
      borderRadius: '8px',
      padding: '10px 20px',
      boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
    },
  },
];

const defaultEdges: Edge[] = [];

export function MindMap(props: { data?: any; nodes?: Node[]; edges?: Edge[] }) {
  const [nodes, setNodes, onNodesChange] = useNodesState(props.nodes ?? defaultNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(props.edges ?? defaultEdges);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hasSize, setHasSize] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const update = () => {
      const rect = el.getBoundingClientRect();
      setHasSize(rect.width > 0 && rect.height > 0);
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!props.data) return;

    const newNodes: Node[] = [];
    const newEdges: Edge[] = [];
    let nodeIdCounter = 1;

    const traverse = (node: any, x: number, y: number, parentId: string | null) => {
      const currentId = `node-${nodeIdCounter++}`;

      newNodes.push({
        id: currentId,
        position: { x, y },
        data: { label: node.title },
        style: {
          background: '#fff',
          color: '#000',
          border: '1px solid #e5e7eb',
          borderRadius: '8px',
          padding: '10px 20px',
          boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
          width: 150,
          fontSize: '12px',
        },
      });

      if (parentId) {
        newEdges.push({
          id: `edge-${parentId}-${currentId}`,
          source: parentId,
          target: currentId,
          type: 'smoothstep',
          style: { stroke: '#9ca3af' },
        });
      }

      if (node.children && node.children.length > 0) {
        const totalWidth = node.children.length * 200;
        let startX = x - totalWidth / 2 + 100;

        node.children.forEach((child: any) => {
          traverse(child, startX, y + 150, currentId);
          startX += 200;
        });
      }
    };

    traverse(props.data, 0, 0, null);

    setNodes(newNodes);
    setEdges(newEdges);
  }, [props.data, setEdges, setNodes]);

  return (
    <div ref={containerRef} className="w-full h-full bg-gray-50 rounded-lg overflow-hidden border border-gray-200">
      {hasSize ? (
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={stableNodeTypes}
          edgeTypes={stableEdgeTypes}
          style={{ width: '100%', height: '100%' }}
          fitView
        >
          <Background color="#9ca3af" gap={40} size={2} variant={BackgroundVariant.Dots} />
          <Controls className="!bg-white !border-gray-200 !text-black [&>button]:!border-gray-200 [&>button:hover]:!bg-gray-100 [&>button]:!fill-black" />
        </ReactFlow>
      ) : null}
    </div>
  );
}

