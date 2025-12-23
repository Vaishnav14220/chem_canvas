/**
 * Groq API Service
 * 
 * Handles communication with Groq's API for models like Qwen3-32B
 */

import Groq from 'groq-sdk';

// Storage key for Groq API key
const GROQ_API_KEY_STORAGE = 'groq-api-key';

/**
 * Get stored Groq API key from localStorage
 */
export function getStoredGroqApiKey(): string | null {
    try {
        return localStorage.getItem(GROQ_API_KEY_STORAGE);
    } catch {
        return null;
    }
}

/**
 * Store Groq API key in localStorage
 */
export function storeGroqApiKey(apiKey: string): void {
    try {
        localStorage.setItem(GROQ_API_KEY_STORAGE, apiKey);
    } catch (e) {
        console.warn('Failed to store Groq API key', e);
    }
}

/**
 * Clear stored Groq API key
 */
export function clearGroqApiKey(): void {
    try {
        localStorage.removeItem(GROQ_API_KEY_STORAGE);
    } catch {
        // ignore
    }
}

/**
 * Check if Groq API key is configured
 */
export function isGroqConfigured(): boolean {
    const key = getStoredGroqApiKey();
    return !!key && key.length > 10;
}

export interface GroqStreamOptions {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    reasoningEffort?: 'default' | 'low' | 'high';
    reasoningFormat?: 'raw' | 'parsed' | 'hidden';
}

/**
 * Stream text content from Groq API
 */
export async function streamGroqContent(
    prompt: string,
    onChunk: (chunk: string) => void,
    options: GroqStreamOptions = {}
): Promise<string> {
    const apiKey = getStoredGroqApiKey();

    if (!apiKey) {
        throw new Error('Groq API key not configured. Please enter your Groq API key.');
    }

    const groq = new Groq({
        apiKey,
        dangerouslyAllowBrowser: true // Required for browser usage
    });

    const {
        model = 'qwen/qwen3-32b',
        temperature = 0.6,
        maxTokens = 40960,
        topP = 0.95,
        reasoningEffort = 'default',
        reasoningFormat
    } = options;

    console.log(`🔮 Groq: Using model ${model}`);

    // Construct request options dynamically to avoid sending undefined params
    const requestOptions: any = {
        messages: [
            {
                role: 'user',
                content: prompt
            }
        ],
        model,
        temperature,
        max_completion_tokens: maxTokens,
        top_p: topP,
        stream: true,
        stop: null
    };

    // Only add reasoning parameters if explicitly provided or supported by the model
    if (reasoningEffort) {
        requestOptions.reasoning_effort = reasoningEffort;
    }

    // For Qwen models, reasoning_format is key
    if (reasoningFormat) {
        requestOptions.reasoning_format = reasoningFormat;
    } else if (model.includes('qwen')) {
        // Default to raw for Qwen if not specified, so we can capture thoughts
        requestOptions.reasoning_format = 'raw';
    }

    try {
        const chatCompletion = (await groq.chat.completions.create(requestOptions)) as unknown as AsyncIterable<any>;

        let fullText = '';

        for await (const chunk of chatCompletion) {
            const content = chunk.choices[0]?.delta?.content || '';
            if (content) {
                fullText += content;
                onChunk(content);
            }
        }

        return fullText;
    } catch (error: any) {
        console.error('Groq API error:', error);

        if (error.status === 401) {
            throw new Error('Invalid Groq API key. Please check your API key and try again.');
        }

        if (error.status === 429) {
            throw new Error('Groq rate limit exceeded. Please wait and try again.');
        }

        throw new Error(`Groq API error: ${error.message || 'Unknown error'}`);
    }
}

/**
 * Non-streaming version for simpler use cases
 */
export async function generateGroqContent(
    prompt: string,
    options: GroqStreamOptions = {}
): Promise<string> {
    let result = '';
    await streamGroqContent(prompt, (chunk) => {
        result += chunk;
    }, options);
    return result;
}
