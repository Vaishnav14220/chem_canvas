import {
  Edge,
  EdgeChange,
  NodeChange,
  OnNodesChange,
  OnEdgesChange,
  applyNodeChanges,
  applyEdgeChanges,
  XYPosition,
  Node,
} from 'reactflow';
import { create } from 'zustand';
import { nanoid } from 'nanoid';

export type MindMapNodeData = {
  label: string;
  variant?: 'root' | 'branch' | 'milestone' | 'note' | 'generic';
  milestone?: {
    id: string;
    title: string;
    description: string;
    duration: number;
    difficulty: 'beginner' | 'intermediate' | 'advanced';
    tools: string[];
    prerequisites: string[];
    learningObjectives: string[];
    resources: string[];
    status: 'pending' | 'in-progress' | 'completed';
  };
  note?: {
    content: string;
    color?: string;
  };
};

export type MindMapNode = Node<MindMapNodeData>;

export type MindMapState = {
  nodes: MindMapNode[];
  edges: Edge[];
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  updateNodeLabel: (nodeId: string, label: string) => void;
  addChildNode: (parentNode: Node, position: XYPosition) => void;
  updateNodeData: (nodeId: string, data: Partial<MindMapNodeData>) => void;
  setNodes: (nodes: MindMapNode[]) => void;
  setEdges: (edges: Edge[]) => void;
  resetMindMap: () => void;
};

const useMindMapStore = create<MindMapState>((set, get) => ({
  nodes: [
    {
      id: 'root',
      type: 'mindmap',
      data: { label: 'Adaptive Learning Plan', variant: 'root' },
      position: { x: 0, y: 0 },
      dragHandle: '.dragHandle',
    },
  ],
  edges: [],

  onNodesChange: (changes: NodeChange[]) => {
    set({
      nodes: applyNodeChanges(changes, get().nodes),
    });
  },

  onEdgesChange: (changes: EdgeChange[]) => {
    set({
      edges: applyEdgeChanges(changes, get().edges),
    });
  },

  updateNodeLabel: (nodeId: string, label: string) => {
    set({
      nodes: get().nodes.map((node) => {
        if (node.id === nodeId) {
          return {
            ...node,
            data: { ...node.data, label },
          };
        }
        return node;
      }),
    });
  },

  updateNodeData: (nodeId: string, data: Partial<MindMapNodeData>) => {
    set({
      nodes: get().nodes.map((node) => {
        if (node.id === nodeId) {
          return {
            ...node,
            data: { ...node.data, ...data },
          };
        }
        return node;
      }),
    });
  },

  addChildNode: (parentNode: Node, position: XYPosition) => {
    const newNode: MindMapNode = {
      id: nanoid(),
      type: 'mindmap',
      data: { label: 'New Node' },
      position,
      dragHandle: '.dragHandle',
    };

    const newEdge: Edge = {
      id: nanoid(),
      source: parentNode.id,
      target: newNode.id,
    };

    set({
      nodes: [...get().nodes, newNode],
      edges: [...get().edges, newEdge],
    });
  },

  setNodes: (nodes: MindMapNode[]) => {
    set({ nodes });
  },

  setEdges: (edges: Edge[]) => {
    set({ edges });
  },

  resetMindMap: () => {
    set({
      nodes: [
        {
          id: 'root',
          type: 'mindmap',
          data: { label: 'Adaptive Learning Plan' },
          position: { x: 0, y: 0 },
          dragHandle: '.dragHandle',
        },
      ],
      edges: [],
    });
  },
}));

export default useMindMapStore;