import { Type } from "@google/genai";

export enum View {
    GENERATOR = 'GENERATOR',
    CHAT = 'CHAT',
    ANALYZER = 'ANALYZER'
}

export enum AspectRatio {
    SQUARE = '1:1',
    PORTRAIT_2_3 = '2:3',
    PORTRAIT_3_4 = '3:4',
    PORTRAIT_9_16 = '9:16',
    LANDSCAPE_3_2 = '3:2',
    LANDSCAPE_4_3 = '4:3',
    LANDSCAPE_16_9 = '16:9',
    CINEMATIC_21_9 = '21:9'
}

export enum ImageSize {
    K1 = '1K',
    K2 = '2K',
    K4 = '4K'
}

export interface InteractiveLabel {
    term: string;
    definition: string;
    funFact: string;
}

export interface GroundingChunk {
    web?: {
        uri: string;
        title: string;
    };
}

export interface GroundingSupport {
    segment: {
        startIndex: number;
        endIndex: number;
        text: string;
    };
    groundingChunkIndices: number[];
    confidenceScores: number[];
}

export interface GroundingMetadata {
    groundingChunks: GroundingChunk[];
    groundingSupports: GroundingSupport[];
    webSearchQueries: string[];
}

export interface ChatMessage {
    id: string;
    role: 'user' | 'model';
    text: string;
    sources?: { uri: string; title: string }[];
    groundingMetadata?: GroundingMetadata;
    timestamp: number;
}

export interface GeneratedImage {
    url: string;
    prompt: string;
    labels?: InteractiveLabel[];
}

export const EducationalSchema = {
    type: Type.OBJECT,
    properties: {
        items: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    term: { type: Type.STRING, description: "The term found in the image label" },
                    definition: { type: Type.STRING, description: "A simple educational definition" },
                    funFact: { type: Type.STRING, description: "A short, interesting fact about this part" },
                },
                required: ["term", "definition", "funFact"]
            }
        }
    }
};
