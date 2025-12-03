export interface DrawingElement {
  type: 'path' | 'text' | 'shape';
  id: string;
  data: any;
}

export interface PathElement extends DrawingElement {
  type: 'path';
  data: {
    points: { x: number; y: number }[];
    color: string;
    width: number;
  };
}

export interface TextElement extends DrawingElement {
  type: 'text';
  data: {
    content: string;
    x: number;
    y: number;
    fontSize: number;
    color: string;
  };
}

export interface CanvasState {
  elements: DrawingElement[];
  backgroundColor: string;
}

export type InteractionMode = 'chat' | 'coach' | 'document';

export type ReactionComponentRole = 'reactant' | 'product' | 'agent';

export interface ReactionComponentSummary {
  role: ReactionComponentRole;
  label?: string;
  smiles?: string | null;
  notes?: string;
}

export interface ReactionMechanismSummary {
  label: string;
  description?: string;
  smiles?: string[];
}

export type AIToolResponse =
  | {
      id: string;
      type: 'molecule';
      title: string;
      summary?: string;
      embedUrl: string;
      formula?: string;
      molecularWeight?: number;
      smiles?: string;
      cid?: number;
      query?: string;
      highlights?: string[];
    }
  | {
      id: string;
      type: 'reaction';
      title: string;
      summary?: string;
      reactionSmiles?: string;
      components?: ReactionComponentSummary[];
      mechanismStages?: ReactionMechanismSummary[];
      notes?: string;
      query?: string;
      reactionSvg?: string;
    }
  | {
      id: string;
      type: 'video';
      title: string;
      summary?: string;
      query?: string;
      videos: Array<{
        id: string;
        title: string;
        url: string;
        channelTitle: string;
        thumbnailUrl: string;
        publishedAt: string;
        description?: string;
      }>;
    }
  | {
      id: string;
      type: 'document';
      title: string;
      summary: string;
      keyTopics: string[];
      essentialConcepts: string[];
      videoQueries?: string[];
      sourceName?: string;
    };

export interface AIInteraction {
  id: string;
  prompt: string;
  response: string;
  timestamp: Date;
  mode: InteractionMode;
  toolResponses?: AIToolResponse[];
}
