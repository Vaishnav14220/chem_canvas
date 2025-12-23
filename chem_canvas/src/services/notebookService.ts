/**
 * Notebook Service - HyperBookLM-inspired features for Immersive Learning
 * 
 * Provides AI-powered research summary, mindmap generation, podcast-style audio,
 * and interactive chat about uploaded sources.
 */

import { generateTextContent, extractJsonBlock, streamTextContent } from './geminiService';
import { generateMultiSpeakerAudio } from './geminiService';
import { ReactFlowData } from './immersiveLearningService';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface NotebookSummary {
    title: string;
    overview: string;
    keyInsights: {
        insight: string;
        importance: 'high' | 'medium' | 'low';
    }[];
    mainTopics: {
        topic: string;
        description: string;
    }[];
    conclusions: string[];
    suggestedQuestions: string[];
}

export interface NotebookChatMessage {
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
}

export interface NotebookContent {
    summary: NotebookSummary | null;
    mindmapData: ReactFlowData | null;
    audioScript: string | null;
    audioBuffer: ArrayBuffer | null;
    chatHistory: NotebookChatMessage[];
}

// ============================================================================
// Summary Generation
// ============================================================================

/**
 * Generate a comprehensive research summary from document text
 * Uses gemini-2.5-flash for fast, accurate summarization
 */
export async function generateNotebookSummary(
    text: string,
    onStream?: (chunk: string) => void
): Promise<NotebookSummary> {
    console.log('📓 Generating notebook summary...');

    const prompt = `You are a research assistant creating a comprehensive summary of the following document.

DOCUMENT:
${text.slice(0, 50000)}

Generate a structured research summary in JSON format:
{
  "title": "Concise title capturing the main topic",
  "overview": "2-3 paragraph executive summary of the entire document",
  "keyInsights": [
    { "insight": "Key finding or insight", "importance": "high|medium|low" }
  ],
  "mainTopics": [
    { "topic": "Topic name", "description": "Brief description of this topic" }
  ],
  "conclusions": ["Main conclusion 1", "Main conclusion 2"],
  "suggestedQuestions": ["Question to explore further", "Another question"]
}

Provide 5-7 key insights, 4-6 main topics, 3-5 conclusions, and 3-5 suggested questions.
Respond with ONLY valid JSON, no markdown code blocks.`;

    try {
        let fullResponse = '';

        if (onStream) {
            await streamTextContent(prompt, (chunk) => {
                fullResponse += chunk;
                onStream(chunk);
            }, { model: 'gemini-2.5-flash' });
        } else {
            fullResponse = await generateTextContent(prompt, {
                model: 'gemini-2.5-flash',
                maxOutputTokens: 4096
            });
        }

        const jsonStr = extractJsonBlock(fullResponse);
        const parsed = JSON.parse(jsonStr);

        console.log('✅ Notebook summary generated successfully');
        return parsed as NotebookSummary;
    } catch (error) {
        console.error('Failed to generate notebook summary:', error);
        throw error;
    }
}

// ============================================================================
// Mindmap Generation
// ============================================================================

/**
 * Generate mindmap data for ReactFlow visualization
 * Creates nodes and edges representing concept relationships
 */
export async function generateNotebookMindmap(text: string): Promise<ReactFlowData> {
    console.log('🧠 Generating notebook mindmap...');

    const prompt = `Analyze this document and create a concept mindmap structure.

DOCUMENT:
${text.slice(0, 30000)}

Generate a mindmap in this JSON format for ReactFlow visualization:
{
  "nodes": [
    { "id": "1", "data": { "label": "Central Topic" }, "position": { "x": 400, "y": 50 }, "type": "input" },
    { "id": "2", "data": { "label": "Subtopic 1" }, "position": { "x": 200, "y": 150 } },
    { "id": "3", "data": { "label": "Subtopic 2" }, "position": { "x": 600, "y": 150 } }
  ],
  "edges": [
    { "id": "e1-2", "source": "1", "target": "2", "animated": true },
    { "id": "e1-3", "source": "1", "target": "3", "animated": true }
  ]
}

Rules:
- Create 1 central node (type: "input") at top center
- Create 4-6 main branch nodes connected to center
- Create 2-3 sub-nodes for each main branch
- Use meaningful, concise labels (3-5 words max)
- Position nodes in a radial layout around center
- Return ONLY valid JSON, no markdown`;

    try {
        const response = await generateTextContent(prompt, {
            model: 'gemini-2.5-flash',
            maxOutputTokens: 4096
        });

        const jsonStr = extractJsonBlock(response);
        const parsed = JSON.parse(jsonStr);

        console.log('✅ Notebook mindmap generated:', parsed.nodes?.length, 'nodes');
        return parsed as ReactFlowData;
    } catch (error) {
        console.error('Failed to generate notebook mindmap:', error);
        throw error;
    }
}

// ============================================================================
// Audio Overview Generation
// ============================================================================

/**
 * Generate a podcast-style script for audio overview
 * Creates natural dialogue between Host and Expert
 */
export async function generateNotebookAudioScript(
    topic: string,
    context: string
): Promise<string> {
    console.log('🎙️ Generating notebook audio script...');

    const prompt = `Create a podcast script between two speakers: "Host" (Male) and "Expert" (Female).

TOPIC: ${topic}
CONTEXT:
${context.slice(0, 20000)}

Instructions:
- Create an engaging, educational conversation about the topic
- Make it sound natural with back-and-forth interaction
- Host asks questions and provides context
- Expert explains concepts clearly with examples
- Length: 600-800 words total
- Format exactly like this:
Host: [dialogue]
Expert: [dialogue]
- NO stage directions, sound effects, or descriptions
- Just pure dialogue with speaker labels`;

    try {
        const script = await generateTextContent(prompt, {
            model: 'gemini-2.5-flash',
            maxOutputTokens: 2048
        });

        console.log('✅ Audio script generated:', script.length, 'chars');
        return script;
    } catch (error) {
        console.error('Failed to generate audio script:', error);
        throw error;
    }
}

/**
 * Generate audio from a podcast script using Gemini TTS
 * Uses gemini-2.5-flash-preview-tts for multi-speaker synthesis
 */
export async function generateNotebookAudio(script: string): Promise<ArrayBuffer> {
    console.log('🔊 Generating notebook audio...');

    const ttsPrompt = `TTS the following conversation between Host and Expert:

${script}`;

    try {
        const audioBuffer = await generateMultiSpeakerAudio(ttsPrompt, [
            { name: 'Host', voiceName: 'Puck' },     // Upbeat, engaging host voice
            { name: 'Expert', voiceName: 'Aoede' }   // Clear, authoritative expert voice
        ]);

        console.log('✅ Audio generated:', audioBuffer.byteLength, 'bytes');
        return audioBuffer;
    } catch (error) {
        console.error('Failed to generate audio:', error);
        throw error;
    }
}

// ============================================================================
// Chat Functionality
// ============================================================================

/**
 * Generate a chat response about the notebook content
 * Provides contextual answers based on the source document
 */
export async function chatAboutNotebook(
    history: NotebookChatMessage[],
    question: string,
    documentContext: string,
    onStream?: (chunk: string) => void
): Promise<string> {
    console.log('💬 Processing notebook chat...');

    // Build conversation history
    const historyText = history
        .slice(-10) // Keep last 10 messages for context
        .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
        .join('\n');

    const prompt = `You are a helpful research assistant. Answer questions about this document.

DOCUMENT CONTEXT:
${documentContext.slice(0, 40000)}

CONVERSATION HISTORY:
${historyText}

USER QUESTION: ${question}

Instructions:
- Answer based on the document content
- Be concise but thorough
- If the answer isn't in the document, say so
- Use examples from the document when helpful
- Format with markdown for readability`;

    try {
        let response = '';

        if (onStream) {
            await streamTextContent(prompt, (chunk) => {
                response += chunk;
                onStream(chunk);
            }, { model: 'gemini-2.5-flash' });
        } else {
            response = await generateTextContent(prompt, {
                model: 'gemini-2.5-flash',
                maxOutputTokens: 2048
            });
        }

        console.log('✅ Chat response generated');
        return response;
    } catch (error) {
        console.error('Failed to generate chat response:', error);
        throw error;
    }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Create an empty notebook content structure
 */
export function createEmptyNotebookContent(): NotebookContent {
    return {
        summary: null,
        mindmapData: null,
        audioScript: null,
        audioBuffer: null,
        chatHistory: []
    };
}
