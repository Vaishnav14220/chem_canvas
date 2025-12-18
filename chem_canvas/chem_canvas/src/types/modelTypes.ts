/**
 * Model Types and Configurations
 * 
 * This file defines the available AI models and their capabilities.
 * Supports multiple providers: Google Gemini, Groq (Qwen), etc.
 */

import type { ThinkingConfig as GoogleThinkingConfig } from '@google/genai';

// Re-export the ThinkingConfig type from @google/genai
export type ThinkingConfig = GoogleThinkingConfig;

// Model provider types
export type ModelProvider = 'gemini' | 'groq';

// Available model IDs (all providers)
export type GeminiModelId =
    | 'gemini-3-flash-preview'
    | 'gemini-3-pro-preview';

// Model capabilities matrix
export interface ModelCapabilities {
    functionCalling: boolean;
    documentProcessing: boolean;
    searchGrounding: boolean;
    thinking: boolean;
    codeExecution: boolean;
    imageGeneration: boolean;
    urlContext: boolean;
    maxInputTokens: number;
    maxOutputTokens: number;
}

// Full model configuration
export interface ModelConfig {
    id: GeminiModelId;
    name: string;
    shortName: string;
    description: string;
    icon: string; // emoji
    tier: 'lite' | 'standard' | 'pro' | 'flagship' | 'external';
    provider: ModelProvider;
    requiresApiKey?: boolean; // If true, requires separate API key input
    capabilities: ModelCapabilities;
    thinkingType: 'level' | 'budget' | 'reasoning'; // Determines which thinking config to use
}

/**
 * Model configurations for all supported providers
 */
export const MODEL_CONFIGS: ModelConfig[] = [
    {
        id: 'gemini-3-flash-preview',
        name: 'Gemini 3 Flash Preview',
        shortName: 'Flash 3',
        description: 'Frontier intelligence built for speed at a fraction of the cost - with Thinking',
        icon: '⚡',
        tier: 'standard',
        provider: 'gemini',
        thinkingType: 'budget',
        capabilities: {
            functionCalling: true,
            documentProcessing: true,
            searchGrounding: true,
            thinking: true,
            codeExecution: true,
            imageGeneration: false,
            urlContext: true,
            maxInputTokens: 1048576,
            maxOutputTokens: 65536,
        },
    },
    {
        id: 'gemini-3-pro-preview',
        name: 'Gemini 3 Pro Preview',
        shortName: '3 Pro',
        description: 'Most powerful multimodal model with best-in-class reasoning and interactivity',
        icon: '✨',
        tier: 'flagship',
        provider: 'gemini',
        thinkingType: 'level',
        capabilities: {
            functionCalling: true,
            documentProcessing: true,
            searchGrounding: true,
            thinking: true,
            codeExecution: true,
            imageGeneration: false,
            urlContext: true,
            maxInputTokens: 1048576,
            maxOutputTokens: 65536,
        },
    },
];

/**
 * Get model configuration by ID
 */
export function getModelConfig(modelId: GeminiModelId): ModelConfig | undefined {
    return MODEL_CONFIGS.find(m => m.id === modelId);
}

/**
 * Get default model ID
 */
export function getDefaultModelId(): GeminiModelId {
    return 'gemini-3-flash-preview';
}

/**
 * Check if a model requires a separate API key
 */
export function modelRequiresApiKey(modelId: GeminiModelId): boolean {
    const config = getModelConfig(modelId);
    return config?.requiresApiKey ?? false;
}

/**
 * Get the provider for a model
 */
export function getModelProvider(modelId: GeminiModelId): ModelProvider {
    const config = getModelConfig(modelId);
    return config?.provider ?? 'gemini';
}

/**
 * Build thinking configuration based on model type
 * Gemini 3 uses thinkingLevel (enum), Gemini 2.5 uses thinkingBudget
 */
export function buildThinkingConfig(modelId: GeminiModelId, options?: {
    level?: 'LOW' | 'HIGH';
    budget?: number;
}): ThinkingConfig | undefined {
    const config = getModelConfig(modelId);
    if (!config?.capabilities.thinking) {
        return undefined;
    }

    // Groq models use their own reasoning config, not Gemini's
    if (config.provider === 'groq') {
        return undefined;
    }

    if (config.thinkingType === 'level') {
        // Gemini 3 Pro uses thinkingLevel - must match the enum from @google/genai
        // The API accepts string literals 'LOW' or 'HIGH' (case sensitive)
        return { thinkingLevel: (options?.level ?? 'HIGH') as any };
    } else {
        // Gemini 2.5 series uses thinkingBudget
        // -1 = dynamic thinking (recommended default)
        return { thinkingBudget: options?.budget ?? -1 };
    }
}
