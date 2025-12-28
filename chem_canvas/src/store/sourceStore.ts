import { create } from 'zustand';
import {
    putImmersiveLearningFile,
    getImmersiveLearningFile,
    deleteImmersiveLearningFile
} from '../utils/immersiveLearningFileStore';
import { getCurrentUserId } from '../services/database/userService';

// Define the source type
export interface SourceFile {
    id: string;
    name: string;
    type: 'pdf' | 'text' | 'markdown' | 'html' | 'image' | 'youtube' | 'weblink' | 'document' | 'paste'; // Added 'document', 'paste' for compatibility
    data?: string; // Base64 data for files
    content?: string; // Text content
    url?: string; // URL for web/youtube
    size?: number;
    lastModified?: number;
    mimeType?: string;

    // Legacy/Compatibility fields
    title?: string;
    description?: string;
    thumbnail?: string;
    videoId?: string;
    channelTitle?: string;
    channelSubscribers?: number;
}

interface SourceState {
    sources: SourceFile[];
    activeSourceId: string | null;
    isLoading: boolean;
    error: string | null;

    // Actions
    addSource: (source: Omit<SourceFile, 'id'> & { id?: string }) => Promise<string>;
    removeSource: (id: string) => Promise<void>;
    setActiveSource: (id: string | null) => void;
    initialize: () => Promise<void>;
    getSource: (id: string) => SourceFile | undefined;
}

const generateId = () => Math.random().toString(36).substring(2, 9);

export const useSourceStore = create<SourceState>((set, get) => ({
    sources: [],
    activeSourceId: null,
    isLoading: false,
    error: null,

    addSource: async (newSource) => {
        set({ isLoading: true, error: null });
        try {
            const id = newSource.id || generateId();
            const source: SourceFile = { ...newSource, id };

            // If it's a file with data, persist to IndexedDB
            if (source.data && (source.type === 'pdf' || source.type === 'image')) {
                // Convert base64 to File object for storage if needed, 
                // but immersiveLearningFileStore takes a File object.
                // We'll construct a File-like object or modify store to accept blob/string.
                // For now, let's assume we might need to handle the data conversion if we want to use the existing store utility strictly.

                // NOTE: The immersiveLearningFileStore expects a File object.
                // We'll convert base64 back to Blob/File to reuse that existing utility.
                try {
                    const byteCharacters = atob(source.data);
                    const byteNumbers = new Array(byteCharacters.length);
                    for (let i = 0; i < byteCharacters.length; i++) {
                        byteNumbers[i] = byteCharacters.charCodeAt(i);
                    }
                    const byteArray = new Uint8Array(byteNumbers);
                    const blob = new Blob([byteArray], { type: source.mimeType || 'application/octet-stream' });
                    const file = new File([blob], source.name, { type: source.mimeType, lastModified: Date.now() });

                    const userId = getCurrentUserId() || 'guest'; // Fallback
                    await putImmersiveLearningFile({ userId, fileId: id, file });
                } catch (e) {
                    console.error("Failed to persist to IndexedDB:", e);
                    // Continue even if persistence fails, just keep in memory
                }
            }

            set((state) => ({
                sources: [...state.sources, source],
                activeSourceId: id, // Auto-select new source
                isLoading: false
            }));

            return id;
        } catch (error) {
            console.error('Failed to add source:', error);
            set({ error: 'Failed to add source', isLoading: false });
            return '';
        }
    },

    removeSource: async (id) => {
        set((state) => ({
            sources: state.sources.filter(s => s.id !== id),
            activeSourceId: state.activeSourceId === id ? null : state.activeSourceId
        }));

        // Remove from DB
        try {
            const userId = getCurrentUserId() || 'guest';
            await deleteImmersiveLearningFile({ userId, fileId: id });
        } catch (e) {
            console.error('Failed to remove from DB:', e);
        }
    },

    setActiveSource: (id) => set({ activeSourceId: id }),

    getSource: (id) => get().sources.find(s => s.id === id),

    initialize: async () => {
        // Here we could load strictly saved files from IndexedDB if we had a way to list them.
        // The current immersiveLearningFileStore doesn't explicitly expose a "list all" function easily 
        // without modification, or we iterate known keys. 
        // For now, we start empty or hydrated from session if implemented later.
        // We'll leave this as a placeholder for future 'persistence state initialization'.
        set({ isLoading: false });
    }
}));
