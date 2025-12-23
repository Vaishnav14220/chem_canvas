// @ts-nocheck
/**
 * Vertex AI Service - Fallback for Gemini API
 * Uses Google Cloud Vertex AI as a more reliable alternative when Gemini API is overloaded
 */

import { GoogleGenAI } from '@google/genai';
import { getVertexAiApiKey } from '../firebase/apiKeys';

let vertexAI: GoogleGenAI | null = null;
let vertexApiKey: string | null = null;
let isVertexInitialized = false;

const VERTEX_MODEL = 'gemini-2.5-flash-preview-09-2025';
const BASE_GENERATION_CONFIG = {
  maxOutputTokens: 65535,
  temperature: 1,
  topP: 0.95,
  safetySettings: [
    {
      category: 'HARM_CATEGORY_HATE_SPEECH',
      threshold: 'OFF'
    },
    {
      category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
      threshold: 'OFF'
    },
    {
      category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
      threshold: 'OFF'
    },
    {
      category: 'HARM_CATEGORY_HARASSMENT',
      threshold: 'OFF'
    }
  ]
};

/**
 * Initialize Vertex AI with API key from Firebase
 */
export async function initializeVertexAI(): Promise<boolean> {
  if (isVertexInitialized && vertexAI) {
    return true;
  }

  try {
    const apiKey = await getVertexAiApiKey();
    if (!apiKey) {
      console.warn('⚠️ Vertex AI not available - no API key');
      return false;
    }

    vertexAI = new GoogleGenAI({
      apiKey: apiKey,
    });
    
    vertexApiKey = apiKey;
    isVertexInitialized = true;
    console.log('✅ Vertex AI initialized successfully as fallback service');
    return true;
  } catch (error) {
    console.error('❌ Failed to initialize Vertex AI:', error);
    return false;
  }
}

/**
 * Generate content using Vertex AI
 * This is the main fallback function when Gemini API fails
 */
export async function generateContentWithVertexAI(
  prompt: string,
  options?: {
    temperature?: number;
    maxOutputTokens?: number;
    topP?: number;
  }
): Promise<string> {
  if (!isVertexInitialized) {
    const initialized = await initializeVertexAI();
    if (!initialized) {
      throw new Error('Vertex AI is not available as fallback');
    }
  }

  if (!vertexAI) {
    throw new Error('Vertex AI not initialized');
  }

  try {
    console.log('🔄 Using Vertex AI as fallback for content generation');

    const config = {
      ...BASE_GENERATION_CONFIG,
      maxOutputTokens: options?.maxOutputTokens ?? BASE_GENERATION_CONFIG.maxOutputTokens,
      temperature: options?.temperature ?? BASE_GENERATION_CONFIG.temperature,
      topP: options?.topP ?? BASE_GENERATION_CONFIG.topP
    };

    const req = {
      model: VERTEX_MODEL,
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }]
        }
      ],
      config
    };

    const streamingResp = await vertexAI.models.generateContentStream(req);
    let fullText = '';

    for await (const chunk of streamingResp) {
      if (chunk.text) {
        fullText += chunk.text;
      } else if (chunk.candidates?.length) {
        const parts = chunk.candidates
          .flatMap(candidate => candidate.content?.parts ?? [])
          .map(part => part.text ?? '')
          .join('');
        fullText += parts;
      }
    }

    console.log('✅ Vertex AI streaming response completed');
    return fullText.trim();
  } catch (error) {
    console.error('❌ Vertex AI generation failed:', error);
    throw error;
  }
}

/**
 * Stream content using Vertex AI with callback
 */
export async function streamContentWithVertexAI(
  prompt: string,
  onChunk: (chunk: string) => void,
  options?: {
    temperature?: number;
    maxOutputTokens?: number;
    topP?: number;
  }
): Promise<string> {
  if (!isVertexInitialized) {
    const initialized = await initializeVertexAI();
    if (!initialized) {
      throw new Error('Vertex AI is not available as fallback');
    }
  }

  if (!vertexAI) {
    throw new Error('Vertex AI not initialized');
  }

  try {
    console.log('🔄 Using Vertex AI streaming as fallback');

    const config = {
      ...BASE_GENERATION_CONFIG,
      maxOutputTokens: options?.maxOutputTokens ?? BASE_GENERATION_CONFIG.maxOutputTokens,
      temperature: options?.temperature ?? BASE_GENERATION_CONFIG.temperature,
      topP: options?.topP ?? BASE_GENERATION_CONFIG.topP
    };

    const req = {
      model: VERTEX_MODEL,
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }]
        }
      ],
      config
    };

    const streamingResp = await vertexAI.models.generateContentStream(req);
    let fullText = '';

    for await (const chunk of streamingResp) {
      let chunkText = '';
      if (chunk.text) {
        chunkText = chunk.text;
      } else if (chunk.candidates?.length) {
        chunkText = chunk.candidates
          .flatMap(candidate => candidate.content?.parts ?? [])
          .map(part => part.text ?? '')
          .join('');
      }

      if (chunkText) {
        fullText += chunkText;
        onChunk(chunkText);
      }
    }

    console.log('✅ Vertex AI streaming completed with callbacks');
    return fullText.trim();
  } catch (error) {
    console.error('❌ Vertex AI streaming failed:', error);
    throw error;
  }
}

/**
 * Check if Vertex AI is available and initialized
 */
export function isVertexAIAvailable(): boolean {
  return isVertexInitialized && vertexAI !== null;
}

/**
 * Reset Vertex AI (useful for testing or re-initialization)
 */
export function resetVertexAI(): void {
  vertexAI = null;
  vertexApiKey = null;
  isVertexInitialized = false;
  console.log('🔄 Vertex AI service reset');
}
