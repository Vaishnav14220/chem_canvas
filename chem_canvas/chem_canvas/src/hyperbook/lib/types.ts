export interface Source {
  id: string;
  url: string;
  title?: string;
  content?: string; // Markdown content
  text?: string; // Plain text content
  addedAt: number;
  status: 'idle' | 'loading' | 'success' | 'error';
  error?: string;
  fileSearchDocumentName?: string; // Gemini File Search document reference
}

export interface Citation {
  startIndex: number;
  endIndex: number;
  source: {
    title?: string;
    uri?: string;
  };
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  citations?: Citation[];
}

export interface Slide {
  title: string;
  bullets: string[];
}

export interface MindmapNode {
  title: string;
  children?: MindmapNode[];
}

