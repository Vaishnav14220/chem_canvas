import { create } from 'zustand';

export type NodeType =
    | 'cube' | 'sphere' | 'cylinder' | 'cone' | 'torus' | 'plane' // Primitives
    | 'server' | 'database' | 'firewall' | 'router' | 'cloud' | 'browser' // Icons
    | 'text' | 'group';

export interface NodeData {
    id: string;
    type: NodeType;
    position: [number, number, number];
    rotation: [number, number, number];
    scale: [number, number, number];
    color: string;
    label?: string;
    selected?: boolean;
}

export type TransformMode = 'translate' | 'rotate' | 'scale';

interface EditorState {
    nodes: NodeData[];
    selection: string[]; // IDs of selected nodes
    transformMode: TransformMode;

    // Actions
    addNode: (type: NodeType) => void;
    updateNode: (id: string, data: Partial<NodeData>) => void;
    removeNode: (id: string) => void;
    selectNode: (id: string | null, multi?: boolean) => void;
    setTransformMode: (mode: TransformMode) => void;
}

export const useEditorStore = create<EditorState>((set, get) => ({
    nodes: [],
    selection: [],
    transformMode: 'translate',

    addNode: (type) => {
        const id = Math.random().toString(36).substring(7);
        const newNode: NodeData = {
            id,
            type,
            position: [0, 0, 0],
            rotation: [0, 0, 0],
            scale: [1, 1, 1],
            color: type === 'server' ? '#4fd1c5' : '#63b3ed', // Default colors
            label: type.charAt(0).toUpperCase() + type.slice(1)
        };

        // Offset slightly if multiple nodes
        if (get().nodes.length > 0) {
            newNode.position = [
                (Math.random() - 0.5) * 5,
                type === 'plane' ? 0 : 0.5,
                (Math.random() - 0.5) * 5
            ];
        }

        set(state => ({
            nodes: [...state.nodes, newNode],
            selection: [id] // Auto-select new node
        }));
    },

    updateNode: (id, data) => {
        set(state => ({
            nodes: state.nodes.map(n => n.id === id ? { ...n, ...data } : n)
        }));
    },

    removeNode: (id) => {
        set(state => ({
            nodes: state.nodes.filter(n => n.id !== id),
            selection: state.selection.filter(s => s !== id)
        }));
    },

    selectNode: (id, multi = false) => {
        set(state => {
            if (!id) return { selection: [] };
            if (multi) {
                return {
                    selection: state.selection.includes(id)
                        ? state.selection.filter(s => s !== id)
                        : [...state.selection, id]
                };
            }
            return { selection: [id] };
        });
    },

    setTransformMode: (mode) => set({ transformMode: mode }),
}));
