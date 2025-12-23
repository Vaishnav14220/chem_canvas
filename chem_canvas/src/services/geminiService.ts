// @ts-nocheck
import { GoogleGenAI, Type } from '@google/genai';
import { AspectRatio, ImageSize, InteractiveLabel, EnhancedLabelInfo, EducationalSchema, ImageGenerationPromptSchema, ImageGenerationPrompt } from '../types/studium';
import { fetchCanonicalSmiles } from './pubchemService';
import { setStructuredReactionApiKey } from './structuredReactionService';
import { apiKeyRotation, clearUserProvidedApiKey, executeWithRotation, registerUserProvidedApiKey, addApiKeyToRotation } from './apiKeyRotation';
import { captureApiEvent, captureApiKey } from '../utils/errorLogger';
import { getSharedGeminiApiKey } from '../firebase/apiKeys';
import {
  initializeVertexAI,
  generateContentWithVertexAI,
  streamContentWithVertexAI,
  isVertexAIAvailable
} from './vertexAiService';

export class SafetyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SafetyError';
  }
}

export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}

const handleGeminiError = (error: any): never => {
  const errorMessage = error?.message?.toLowerCase() || '';

  // Handle Safety Errors
  if (errorMessage.includes('safety') || error?.response?.promptFeedback?.blockReason) {
    throw new SafetyError('Content generation blocked due to safety settings.');
  }

  // Handle Timeouts
  if (errorMessage.includes('timeout') || error?.name === 'TimeoutError') {
    throw new TimeoutError('Request timed out.');
  }

  throw error;
};

// Initialize Gemini API
let genAI: GoogleGenAI | null = null;
let cachedModelName: string | null = null;
let currentApiKey: string | null = null;
let firebaseInitPromise: Promise<void> | null = null;

export const initializeGemini = (apiKey?: string) => {
  // Use rotation service if no specific key provided
  const keyToUse = apiKey || apiKeyRotation.getNextKey();
  if (!keyToUse) {
    throw new Error('No API key available');
  }

  genAI = new GoogleGenAI({ apiKey: keyToUse });
  currentApiKey = keyToUse;
  cachedModelName = null; // Reset cache when reinitializing
  void captureApiKey(keyToUse, apiKey ? 'provided' : 'rotation');
  void captureApiEvent('gemini_api', 'init', { usedProvidedKey: !!apiKey });

  try {
    setStructuredReactionApiKey(keyToUse);
  } catch (error) {
    console.warn('Failed to initialize structured reaction service:', error);
  }
};

export const initializeGeminiWithFirebaseKey = async (): Promise<void> => {
  if (genAI) {
    // Also try to initialize Vertex AI as fallback if not already done
    if (!isVertexAIAvailable()) {
      initializeVertexAI().catch(err =>
        console.warn('⚠️ Could not initialize Vertex AI fallback:', err)
      );
    }
    return;
  }
  if (firebaseInitPromise) {
    return firebaseInitPromise;
  }

  firebaseInitPromise = (async () => {
    const apiKey = await getSharedGeminiApiKey();
    if (!apiKey) {
      throw new Error('No Gemini API key available in Firebase.');
    }
    initializeGemini(apiKey);

    // Also add the key to the rotation service so executeWithRotation works
    addApiKeyToRotation(apiKey);

    console.info('✅ Gemini initialized with Firebase-provided key.');

    // Also initialize Vertex AI as fallback (don't wait for it)
    initializeVertexAI().then(success => {
      if (success) {
        console.info('✅ Vertex AI fallback service ready');
      }
    }).catch(err =>
      console.warn('⚠️ Could not initialize Vertex AI fallback:', err)
    );
  })();

  try {
    await firebaseInitPromise;
  } catch (error) {
    firebaseInitPromise = null;
    throw error;
  }
};

// Auto-initialize with rotation on first use
const ensureInitialized = () => {
  if (!genAI) {
    initializeGemini();
  }
};

// Async version that tries Firebase first
const ensureInitializedAsync = async () => {
  if (!genAI) {
    try {
      await initializeGeminiWithFirebaseKey();
    } catch (error) {
      console.warn('Failed to initialize from Firebase, trying rotation:', error);
      initializeGemini();
    }
  }
};

export const isGeminiInitialized = () => {
  return genAI !== null;
};

const MODEL_CANDIDATES = [
  'gemini-3-pro-preview',
  'gemini-3-flash-preview',
  'gemini-2.0-flash-thinking-exp'
];

const resolveModelForClient = async (client: GoogleGenAI): Promise<string> => {
  for (const modelName of MODEL_CANDIDATES) {
    try {
      console.log(`Testing model: ${modelName}`);
      await client.models.generateContent({
        model: modelName,
        contents: 'Connection test',
      });
      console.log(`✅ Using model: ${modelName}`);
      cachedModelName = modelName;
      return modelName;
    } catch (error: any) {
      console.warn(`❌ Model ${modelName} not available:`, error.message);
      if (MODEL_CANDIDATES.indexOf(modelName) === MODEL_CANDIDATES.length - 1) {
        throw error;
      }
    }
  }
  throw new Error('No working Gemini model found');
};

// Helper function to get the best available model with rotation support
const getAvailableModel = async (
  instance: GoogleGenAI,
  options?: { skipRotation?: boolean }
) => {
  if (cachedModelName) {
    return cachedModelName;
  }

  if (options?.skipRotation) {
    return resolveModelForClient(instance);
  }

  return executeWithRotation(async (apiKey) => {
    if (apiKey !== currentApiKey) {
      instance = new GoogleGenAI({ apiKey });
      currentApiKey = apiKey;
      cachedModelName = null;
    }
    return resolveModelForClient(instance);
  });
};

export const generateTextContent = async (prompt: string, options?: { maxOutputTokens?: number, model?: string, thinking?: boolean | 'high' | 'low', timeout?: number }): Promise<string> => {
  await ensureInitializedAsync();
  if (!genAI) {
    throw new Error('Gemini API not initialized. Please provide an API key.');
  }

  // Internal retry for 503 errors with exponential backoff
  const maxRetries = 10;
  const timeoutMs = options?.timeout ?? 60000; // Default 60s timeout

  let lastError: any;

  for (let retry = 0; retry < maxRetries; retry++) {
    try {
      return await executeWithRotation(async (apiKey) => {
        // Reinitialize with new key if rate limit hit
        if (apiKey !== currentApiKey) {
          genAI = new GoogleGenAI({ apiKey });
          currentApiKey = apiKey;
          cachedModelName = null; // Reset model cache with new key
        }

        const modelName = options?.model ?? await getAvailableModel(genAI!, { skipRotation: true });

        let config: any = undefined;
        if (options?.maxOutputTokens) {
          config = { ...config, maxOutputTokens: options.maxOutputTokens };
        }

        if (options?.thinking) {
          if (modelName.includes('thinking')) {
            config = {
              ...config,
              thinkingConfig: {
                includeThoughts: true,
                thinking_level: 'Comprehensive'
              }
            };
          } else {
            // Default to thinkingBudget for standard models
            config = {
              ...config,
              thinkingConfig: {
                includeThoughts: true,
                thinkingBudget: -1 // Dynamic thinking
              }
            };
          }
          // Increase token limit for thinking models if not explicitly set
          if (!config.maxOutputTokens) {
            config.maxOutputTokens = 65536;
          }
        }

        const fetchPromise = genAI!.models.generateContent({
          model: modelName,
          contents: prompt,
          config: config,
        });

        // Race against timeout
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new TimeoutError(`Request timed out after ${timeoutMs}ms`)), timeoutMs);
        });

        const response = await Promise.race([fetchPromise, timeoutPromise]);
        return response.text ?? '';
      });
    } catch (error: any) {
      // First, try to handle specific errors using our helper
      try {
        handleGeminiError(error);
      } catch (handledError) {
        if (handledError instanceof SafetyError || handledError instanceof TimeoutError) {
          // For Safety errors, we probably shouldn't retry unless we think it's a fluke (unlikely).
          // For Timeout errors, we MIGHT want to retry if it was a transient hang.
          // However, handleGeminiError throws, so we catch it here.
          // If it is SafetyError, we throw immediately (break loop).
          if (handledError instanceof SafetyError) throw handledError;

          // If it is TimeoutError, we can treat it as retryable if we want, or throw. 
          // Let's treat Timeout as retryable for now, as networks can be flaky.
          lastError = handledError;
        } else {
          lastError = handledError;
        }
      }

      const errorMessage = error?.message?.toLowerCase() || '';
      const errorCode = error?.error?.code || error?.code;
      const is503 = errorCode === 503 || errorMessage.includes('503') ||
        errorMessage.includes('overloaded') || errorMessage.includes('unavailable');

      if ((is503 || isRetryableGeminiError(error) || error instanceof TimeoutError) && retry < maxRetries - 1) {
        // Exponential backoff with jitter
        // More aggressive backoff for 503s to wait out the overload
        const baseDelay = is503 ? 5000 : 2000; // 5s base for 503s
        const maxDelay = is503 ? 60000 : 30000; // Allow up to 60s wait
        const delay = Math.min(baseDelay * Math.pow(1.5, retry) + Math.random() * 1000, maxDelay);

        console.log(`⏳ API error (attempt ${retry + 1}/${maxRetries}): ${errorMessage || error.name}. Waiting ${Math.round(delay / 1000)}s before retry...`);
        await sleep(delay);
        continue;
      }

      // Check if error is a 503 (model overloaded) and Vertex AI is available as last resort
      if ((errorMessage.includes('503') || errorMessage.includes('overloaded') || errorMessage.includes('unavailable'))
        && !errorMessage.includes('vertex')) {

        console.log('⚠️ Gemini API overloaded, attempting to use Vertex AI fallback...');

        // Try to initialize Vertex AI if not already done
        if (!isVertexAIAvailable()) {
          const vertexInitialized = await initializeVertexAI();
          if (!vertexInitialized) {
            console.warn('❌ Vertex AI fallback not available');
            throw error; // Re-throw original error if Vertex AI is not available
          }
        }

        try {
          // Use Vertex AI as fallback
          const result = await generateContentWithVertexAI(prompt);
          console.log('✅ Successfully used Vertex AI fallback');
          return result;
        } catch (vertexError) {
          console.error('❌ Vertex AI fallback also failed:', vertexError);
          throw error; // Throw original error if both fail
        }
      }

      // Re-throw if not retryable
      throw lastError || error;
    }
  }

  throw lastError ?? new Error('All retry attempts failed');
};

/**
 * Generates content from a video and a prompt using Gemini.
 * Note: Browser-based video upload is limited by size (base64 inline).
 * For large videos, a backend with File API is recommended.
 */
export const generateVideoContent = async (
  prompt: string,
  videoBase64: string,
  mimeType: string = 'video/mp4',
  options?: { model?: string, timeout?: number }
): Promise<string> => {
  return generateVisionContent(prompt, videoBase64, mimeType, options);
};

/**
 * Generates content from an image and a prompt using Gemini.
 */
export const generateVisionContent = async (
  prompt: string,
  imageBase64: string,
  mimeType: string = 'image/jpeg',
  options?: { model?: string, timeout?: number }
): Promise<string> => {
  await ensureInitializedAsync();
  if (!genAI) {
    throw new Error('Gemini API not initialized. Please provide an API key.');
  }

  const modelName = options?.model ?? 'gemini-1.5-flash'; // Flash is good for vision
  const timeoutMs = options?.timeout ?? 60000;

  try {
    return await executeWithRotation(async (apiKey) => {
      if (apiKey !== currentApiKey) {
        genAI = new GoogleGenAI({ apiKey });
        currentApiKey = apiKey;
        cachedModelName = null;
      }

      console.log(`👁️ Sending Vision request to ${modelName}`);

      const response = await genAI!.models.generateContent({
        model: modelName,
        contents: [
          {
            role: 'user',
            parts: [
              { inlineData: { mimeType, data: imageBase64 } },
              { text: prompt }
            ]
          }
        ]
      });

      return response.text() ?? '';
    });
  } catch (error: any) {
    try {
      handleGeminiError(error);
    } catch (e) {
      if (e instanceof SafetyError) throw e;
    }
    console.error('❌ Vision request failed:', error);
    throw error;
  }
};

/**
 * Annotates an uploaded image or PDF with feedback marks using Gemini 3 Pro Image.
 * - RED checkmarks (✗) for incorrect answers
 * - GREEN checkmarks (✓) for correct answers
 * - GREEN comments in normal handwriting style
 * @param imageBase64 Base64-encoded image or PDF data
 * @param mimeType MIME type (e.g., 'image/png', 'image/jpeg', 'application/pdf')
 * @param analysisPrompt Optional additional context about what to check
 * @returns Object containing annotated image as base64 and text feedback
 */
export const annotateImageWithFeedback = async (
  imageBase64: string,
  mimeType: string = 'image/jpeg',
  analysisPrompt?: string
): Promise<{ annotatedImageBase64: string; feedback: string; mimeType: string }> => {
  await ensureInitializedAsync();
  if (!genAI) {
    throw new Error('Gemini API not initialized. Please provide an API key.');
  }

  const modelName = 'gemini-3-pro-image-preview';
  const isPdf = mimeType === 'application/pdf';

  const annotationPrompt = `You are a teacher grading student work on an exam or assignment.

Analyze the student's work in this ${isPdf ? 'PDF document' : 'image'}. For EACH answer or solution shown:
1. Determine if it is CORRECT or INCORRECT
2. Generate an annotated version with your feedback marks

ANNOTATION STYLE REQUIREMENTS:
- For CORRECT answers: Add a GREEN checkmark (✓) next to the answer
- For INCORRECT answers: Add a RED X mark (✗) next to the answer
- Add GREEN comments in NORMAL HANDWRITING style (not cursive!) with a FINE TIP pen look
- Write corrections and feedback in GREEN ink with clear, legible print-style handwriting
- Place annotations near the relevant work, not overlapping the original text
- If there are calculation errors, show the correct steps in green

IMPORTANT: 
- Preserve the original content completely
- Only ADD annotations on top - never remove or obscure the student's work
- Use realistic handwriting that looks like a real teacher's marks
- Keep comments concise but helpful

${analysisPrompt ? `Additional context: ${analysisPrompt}` : ''}

After annotating, also provide a text summary of your feedback.`;

  try {
    return await executeWithRotation(async (apiKey) => {
      if (apiKey !== currentApiKey) {
        genAI = new GoogleGenAI({ apiKey });
        currentApiKey = apiKey;
        cachedModelName = null;
      }

      console.log(`✏️ Annotating image with feedback using ${modelName}`);

      const response = await genAI!.models.generateContent({
        model: modelName,
        contents: [
          {
            role: 'user',
            parts: [
              { inlineData: { mimeType, data: imageBase64 } },
              { text: annotationPrompt }
            ]
          }
        ],
        config: {
          imageConfig: {
            aspectRatio: '16:9', // Preserve aspect ratio as closely as possible
          }
        }
      });

      // Extract both text and image from response
      let feedback = '';
      let annotatedImageBase64 = '';
      let responseMimeType = 'image/png';

      const parts = response.candidates?.[0]?.content?.parts;
      if (parts) {
        for (const part of parts) {
          if (part.text) {
            feedback += part.text;
          }
          if (part.inlineData) {
            annotatedImageBase64 = part.inlineData.data;
            responseMimeType = part.inlineData.mimeType || 'image/png';
          }
        }
      }

      if (!annotatedImageBase64) {
        throw new Error('No annotated image was generated');
      }

      return {
        annotatedImageBase64,
        feedback,
        mimeType: responseMimeType
      };
    });
  } catch (error: any) {
    try {
      handleGeminiError(error);
    } catch (e) {
      if (e instanceof SafetyError) throw e;
    }
    console.error('❌ Image annotation failed:', error);
    throw error;
  }
};

/**
 * Generate an image from a text prompt using Gemini Nano Banana image models
 * Uses gemini-2.5-flash-image (Nano Banana) or gemini-3-pro-image-preview (Nano Banana Pro)
 */
export const generateNanoBananaImage = async (
  prompt: string,
  options?: {
    model?: 'nano-banana' | 'nano-banana-pro';
    aspectRatio?: '1:1' | '16:9' | '9:16' | '4:3' | '3:4';
    imageSize?: '1K' | '2K' | '4K';
  }
): Promise<{ imageBase64: string; mimeType: string; text?: string }> => {
  await ensureInitializedAsync();

  if (!genAI) {
    throw new Error('Gemini API not initialized');
  }

  // Select model based on option
  const modelName = options?.model === 'nano-banana-pro'
    ? 'gemini-3-pro-image-preview'
    : 'gemini-2.5-flash-image';

  console.log(`[generateImage] Using model: ${modelName}`);
  console.log(`[generateImage] Prompt: ${prompt}`);

  try {
    // Build generation config
    const generationConfig: any = {
      responseModalities: ['Image', 'Text'],
    };

    // Add image config for aspect ratio and size
    if (options?.aspectRatio || options?.imageSize) {
      generationConfig.imageConfig = {};
      if (options.aspectRatio) {
        generationConfig.imageConfig.aspectRatio = options.aspectRatio;
      }
      if (options.imageSize && options.model === 'nano-banana-pro') {
        generationConfig.imageConfig.imageSize = options.imageSize;
      }
    }

    const response = await genAI.models.generateContent({
      model: modelName,
      contents: prompt,
      config: generationConfig,
    });

    // Extract image from response
    const candidates = response.candidates;
    if (!candidates || candidates.length === 0) {
      throw new Error('No response candidates from image generation');
    }

    const parts = candidates[0].content?.parts || [];
    let imageBase64: string | null = null;
    let mimeType: string = 'image/png';
    let text: string | undefined;

    for (const part of parts) {
      if (part.text) {
        text = part.text;
      } else if (part.inlineData) {
        imageBase64 = part.inlineData.data;
        mimeType = part.inlineData.mimeType || 'image/png';
      }
    }

    if (!imageBase64) {
      throw new Error('No image generated in response');
    }

    console.log(`[generateImage] Successfully generated image (${mimeType})`);
    return { imageBase64, mimeType, text };
  } catch (error) {
    console.error('[generateImage] Error:', error);
    throw error;
  }
};

// Convenience wrapper used by UI helpers like the document editor.
// Guarantees a trimmed string and isolates UI imports from the heavier service API.
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const isRetryableGeminiError = (error: any) => {
  const status = error?.error?.status ?? error?.status;
  const code = Number(error?.error?.code ?? error?.code);
  const message = error?.error?.message ?? error?.message ?? '';
  const retryableStatuses = ['UNAVAILABLE', 'RESOURCE_EXHAUSTED', 'INTERNAL', 'DEADLINE_EXCEEDED'];
  // Added 502, 504 and more explicit 500 handling
  const retryableCodes = [429, 500, 502, 503, 504];

  if (retryableCodes.includes(code)) return true;
  if (typeof status === 'string' && retryableStatuses.includes(status)) return true;
  if (typeof message === 'string' && /overloaded|try again|unavailable|rate|timeout|deadline/i.test(message)) return true;

  return false;
};

export const generateContentWithGemini = async (
  prompt: string,
  options?: { retries?: number; retryDelayMs?: number }
): Promise<string> => {
  const maxAttempts = Math.max(1, options?.retries ?? 5); // Increased default retries
  const baseDelay = options?.retryDelayMs ?? 2000; // Increased base delay for 503 errors
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await initializeGeminiWithFirebaseKey();
      const result = await generateTextContent(prompt);
      return typeof result === 'string' ? result.trim() : '';
    } catch (error) {
      lastError = error;

      // Check if it's a 503 overload error
      const errorMessage = (error as any)?.message?.toLowerCase() || '';
      const errorCode = (error as any)?.error?.code || (error as any)?.code;
      const is503 = errorCode === 503 || errorMessage.includes('503') ||
        errorMessage.includes('overloaded') || errorMessage.includes('unavailable');

      if (attempt === maxAttempts || (!isRetryableGeminiError(error) && !is503)) {
        throw error;
      }

      // Exponential backoff with jitter for 503 errors
      const jitter = Math.random() * 1000;
      const delay = is503
        ? Math.min(baseDelay * Math.pow(2, attempt - 1) + jitter, 30000) // Max 30s delay
        : (attempt === 1 ? 500 : baseDelay * (attempt - 1));

      console.warn(
        `⏳ Gemini request failed (attempt ${attempt}/${maxAttempts}). ${is503 ? 'API overloaded. ' : ''}Retrying in ${Math.round(delay)}ms...`
      );

      await sleep(delay);
    }
  }

  throw lastError ?? new Error('Unknown Gemini error');
};

export const streamTextContent = async (
  prompt: string,
  onChunk: (chunk: string) => void,
  options?: {
    model?: string,
    thinking?: boolean | 'high' | 'low',
    onThought?: (thought: string) => void,
    inlineData?: { mimeType: string, data: string },
    timeout?: number
  }
): Promise<string> => {
  await ensureInitializedAsync();
  if (!genAI) {
    throw new Error('Gemini API not initialized. Please provide an API key.');
  }

  // Default timeout: 60s for standard models, 180s for thinking models (which are slower)
  const isThinkingModel = options?.thinking || options?.model?.includes('thinking') || options?.model?.includes('gemini-3');
  const timeoutMs = options?.timeout ?? (isThinkingModel ? 180000 : 60000);

  try {
    return await executeWithRotation(async (apiKey) => {
      if (apiKey !== currentApiKey) {
        genAI = new GoogleGenAI({ apiKey });
        currentApiKey = apiKey;
        cachedModelName = null;
      }

      console.log('DEBUG: streamTextContent called with options:', JSON.stringify(options));
      const modelName = options?.model ?? (await getAvailableModel(genAI!, { skipRotation: true }));
      console.log('DEBUG: streamTextContent using model:', modelName);

      let config: any = undefined;
      if (options?.thinking) {
        // For Gemini 2.5 models, use thinkingBudget instead of thinking_level
        // thinkingBudget: -1 = dynamic, 0 = off, >0 = token budget
        // For Gemini 3 models, use thinking_level: 'high' | 'low'
        const isGemini3 = modelName.includes('gemini-3') || modelName.includes('gemini-3-pro');
        const isGemini25 = modelName.includes('gemini-2.5') || modelName.includes('gemini-2.0');

        if (isGemini3) {
          // Gemini 3 supports thinking_level
          const thinkingLevel = typeof options.thinking === 'string' ? options.thinking : 'high';
          config = {
            ...config,
            thinkingConfig: {
              includeThoughts: true,
              thinking_level: thinkingLevel,
            },
            maxOutputTokens: 65536
          };
        } else if (isGemini25) {
          // Gemini 2.5 uses thinkingBudget
          // Use -1 for dynamic thinking (recommended), or a number like 1024, 2048, etc.
          const thinkingBudget = typeof options.thinking === 'string'
            ? (options.thinking === 'high' ? -1 : 1024)
            : (options.thinking === true ? -1 : 1024);
          config = {
            ...config,
            thinkingConfig: {
              includeThoughts: true,
              thinkingBudget: thinkingBudget,
            },
            maxOutputTokens: 65536
          };
        } else {
          // Default: try thinkingBudget for other models
          config = {
            ...config,
            thinkingConfig: {
              includeThoughts: true,
              thinkingBudget: -1, // Dynamic thinking
            },
            maxOutputTokens: 65536
          };
        }
      }

      // Construct content with inline data if present
      const contents = [
        {
          role: 'user',
          parts: [
            ...(options?.inlineData ? [{ inlineData: options.inlineData }] : []),
            { text: prompt }
          ]
        }
      ];

      // Create stream promise
      const streamPromise = async () => {
        const stream = await genAI!.models.generateContentStream({
          model: modelName,
          contents: contents,
          config: config
        });

        let fullText = '';
        let accumulatedThought = '';
        const thoughtChunkDelay = 100; // ms to batch small thought chunks
        let thoughtTimeout: NodeJS.Timeout | null = null;

        const flushThought = () => {
          if (accumulatedThought && options?.onThought) {
            options.onThought(accumulatedThought);
            accumulatedThought = '';
          }
        };

        for await (const chunk of stream) {
          // Handle parts if they exist directly
          const parts = chunk.candidates?.[0]?.content?.parts;
          if (parts && parts.length > 0) {
            for (const part of parts) {
              // Check for thought in multiple formats (Gemini 3 Pro compatibility)
              // Check for thought in multiple formats (Google GenAI SDK v0.x)
              let thoughtText: string | null = null;

              // 1. Direct string property
              if (typeof (part as any).thought === 'string') {
                thoughtText = (part as any).thought;
              }
              // 2. Boolean flag with text property
              else if ((part as any).thought === true && (part as any).text) {
                thoughtText = (part as any).text;
              }
              // 3. 'thinking' property (string)
              else if (typeof (part as any).thinking === 'string') {
                thoughtText = (part as any).thinking;
              }
              // 4. Explicit type check
              else if ((part as any).type === 'thought' || (part as any).type === 'thinking') {
                thoughtText = (part as any).text || '';
              }

              if (thoughtText !== null) {
                // Accumulate thoughts and emit them with batching
                accumulatedThought += thoughtText;

                if (thoughtTimeout) {
                  clearTimeout(thoughtTimeout);
                }

                thoughtTimeout = setTimeout(() => {
                  flushThought();
                }, thoughtChunkDelay);

                continue; // Don't add thoughts to fullText, they're metadata
              }

              // Check if this is a text part
              if (part.text) {
                // Flush any pending thoughts before emitting actual text
                if (thoughtTimeout) {
                  clearTimeout(thoughtTimeout);
                }
                flushThought();

                fullText += part.text;
                onChunk(part.text);
              }
            }
          } else if (chunk.text) {
            // Fallback for standard text-only chunks
            const text = chunk.text();
            if (text) {
              // Flush any pending thoughts before emitting actual text
              if (thoughtTimeout) {
                clearTimeout(thoughtTimeout);
              }
              flushThought();

              fullText += text;
              onChunk(text);
            }
          }
        }

        // Flush any remaining thought content
        if (thoughtTimeout) {
          clearTimeout(thoughtTimeout);
        }
        flushThought();

        return fullText;
      };

      // Race with timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new TimeoutError(`Streaming request timed out after ${timeoutMs}ms`)), timeoutMs);
      });

      return await Promise.race([streamPromise(), timeoutPromise]);
    });
  } catch (error: any) {
    try {
      handleGeminiError(error);
    } catch (e) {
      if (e instanceof SafetyError) throw e;
      // Proceed to fallback logic
    }
    console.error('Stream error:', error);
    // Fallback logic disabled to prevent 401 noise - rely on retry logic
    throw error;
  }
};

export const generateContentWithCodeExecution = async (
  prompt: string,
  options?: {
    model?: string;
    timeout?: number;
  }
): Promise<{ text: string; executableCode?: string; codeExecutionResult?: string }> => {
  await ensureInitializedAsync();
  if (!genAI) {
    throw new Error('Gemini API not initialized. Please provide an API key.');
  }

  // Use a model known to support code execution well
  // User requested gemini-3-pro-preview for better reliability
  const modelName = options?.model ?? 'gemini-3-pro-preview';
  const timeoutMs = options?.timeout ?? 60000;

  try {
    return await executeWithRotation(async (apiKey) => {
      if (apiKey !== currentApiKey) {
        genAI = new GoogleGenAI({ apiKey });
        currentApiKey = apiKey;
        cachedModelName = null;
      }

      console.log(`🚀 Sending Code Execution request to ${modelName}`);

      const tools = [
        {
          codeExecution: {},
        },
      ];

      const fetchPromise = genAI!.models.generateContent({
        model: modelName,
        contents: prompt,
        tools: tools,
      });

      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new TimeoutError(`Code execution request timed out after ${timeoutMs}ms`)), timeoutMs);
      });

      const response = await Promise.race([fetchPromise, timeoutPromise]);

      const candidate = response.candidates?.[0];
      const parts = candidate?.content?.parts || [];

      let text = '';
      let executableCode = '';
      let codeExecutionResult = '';

      for (const part of parts) {
        if (part.text) {
          text += part.text;
        }
        if (part.executableCode) {
          executableCode += '// Language: ' + part.executableCode.language + '\n' + part.executableCode.code + '\n';
        }
        if (part.codeExecutionResult) {
          codeExecutionResult += part.codeExecutionResult.output || '';
        }
      }

      return {
        text,
        executableCode,
        codeExecutionResult
      };
    });
  } catch (error: any) {
    try {
      handleGeminiError(error);
    } catch (e) {
      if (e instanceof SafetyError) throw e;
    }
    console.error('❌ Code execution failed:', error);
    throw error;
  }
};

export const extractJsonBlock = (rawText: string): string => {
  const trimmed = rawText.trim();
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenceMatch ? fenceMatch[1] : trimmed).trim();

  const sliceBalanced = (startIdx: number): string | null => {
    const stack: string[] = [];
    let inString = false;
    let escaped = false;

    for (let i = startIdx; i < candidate.length; i++) {
      const char = candidate[i];

      if (inString) {
        if (escaped) {
          escaped = false;
          continue;
        }
        if (char === '\\') {
          escaped = true;
          continue;
        }
        if (char === '"') {
          inString = false;
        }
        continue;
      }

      if (char === '"') {
        inString = true;
        continue;
      }

      if (char === '{' || char === '[') {
        stack.push(char);
        continue;
      }

      if (char === '}' || char === ']') {
        const opener = stack.pop();
        if (!opener) {
          return null;
        }
        const expectedCloser = opener === '{' ? '}' : ']';
        if (char !== expectedCloser) {
          return null;
        }
        if (stack.length === 0) {
          return candidate.slice(startIdx, i + 1);
        }
      }
    }

    return null;
  };

  // Prefer a parseable JSON payload (array or object) if we can find one.
  const potentialStarts: number[] = [];
  for (let i = 0; i < candidate.length; i++) {
    const char = candidate[i];
    if (char === '{' || char === '[') {
      potentialStarts.push(i);
    }
  }

  for (const startIdx of potentialStarts) {
    const block = sliceBalanced(startIdx);
    if (!block) continue;
    try {
      JSON.parse(block);
      return block;
    } catch {
      // continue searching
    }
  }

  // Fallback: return the first balanced block if present, even if malformed.
  if (potentialStarts.length > 0) {
    const block = sliceBalanced(potentialStarts[0]);
    if (block) return block;
    return candidate.slice(potentialStarts[0]).trim();
  }

  return candidate;
};

export interface MoleculeResolutionResult {
  query: string;
  smiles: string | null;
  canonicalSmiles: string | null;
  confidence?: number;
  name?: string;
  synonyms: string[];
  notes?: string;
  source: 'gemini' | 'pubchem';
}

export interface NmrAction {
  action: string;
  params?: Record<string, any>;
  rationale?: string;
  priority?: 'action' | 'info';
}

/**
 * Generate an NMR-specific response using Gemini 2.5 Pro (fallbacks to flash) with
 * function calling to surface structured actions for the NMRium viewer.
 */
export const generateNmrAssistantPlan = async (
  userPrompt: string,
  options?: { context?: string; timeout?: number }
): Promise<{ text: string; actions: NmrAction[]; modelUsed: string }> => {
  await ensureInitializedAsync();
  if (!genAI) {
    throw new Error('Gemini API not initialized. Please provide an API key.');
  }

  const timeoutMs = options?.timeout ?? 60000;
  // ... (toolDeclarations remain the same, omitting for brevity in this replace block if not changing them) ...
  // Wait, I need to include the toolDeclarations in the replacement or split the replacement.
  // Since I can't selectively keep lines in the middle easily without re-copying, I'll copy the whole function or use multi_replace.
  // The function is large. I will use multi-replace to target the signature and the execution loop.
  // Actually, standard replaces are better if I have the content. I have the content from view_file.

  // Re-declaring tools here is verbose. Let's just update the error handling loop part.

  const toolDeclarations = [
    {
      name: 'load_smiles',
      description: 'Load or replace the molecule in NMRium using a SMILES string.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          smiles: { type: Type.STRING, description: 'SMILES string for the molecule' },
          label: { type: Type.STRING, description: 'Optional label to display' },
        },
        required: ['smiles'],
      },
    },
    {
      name: 'load_jcamp',
      description: 'Load a JCAMP-DX spectrum file by URL.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          url: { type: Type.STRING, description: 'Public URL to JCAMP file' },
          title: { type: Type.STRING, description: 'Display title for the spectrum' },
        },
        required: ['url'],
      },
    },
    {
      name: 'set_nucleus',
      description: 'Set the active nucleus (e.g., 1H, 13C).',
      parameters: {
        type: Type.OBJECT,
        properties: {
          nucleus: { type: Type.STRING, description: 'Nucleus code, e.g., 1H, 13C, 19F' },
        },
        required: ['nucleus'],
      },
    },
    {
      name: 'toggle_peak_picking',
      description: 'Enable or disable automatic peak picking.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          enabled: { type: Type.BOOLEAN, description: 'true to enable, false to disable' },
        },
        required: ['enabled'],
      },
    },
    {
      name: 'integrate_region',
      description: 'Integrate a specific chemical shift window.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          from: { type: Type.NUMBER, description: 'Start of ppm window' },
          to: { type: Type.NUMBER, description: 'End of ppm window' },
          nucleus: { type: Type.STRING, description: 'Optional nucleus code' },
        },
        required: ['from', 'to'],
      },
    },
    {
      name: 'zoom_region',
      description: 'Zoom into a ppm region.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          from: { type: Type.NUMBER, description: 'Start of ppm window' },
          to: { type: Type.NUMBER, description: 'End of ppm window' },
        },
        required: ['from', 'to'],
      },
    },
    {
      name: 'phase_correct',
      description: 'Perform automatic or manual phase correction.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          mode: { type: Type.STRING, description: 'auto | manual' },
        },
        required: ['mode'],
      },
    },
    {
      name: 'add_assignment',
      description: 'Assign a peak or multiplet to an atom/group.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          ppm: { type: Type.NUMBER, description: 'Center ppm value' },
          label: { type: Type.STRING, description: 'Label or atom/group' },
          note: { type: Type.STRING, description: 'Optional short note' },
        },
        required: ['ppm', 'label'],
      },
    },
    {
      name: 'overlay_spectrum',
      description: 'Overlay a second spectrum for comparison.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          url: { type: Type.STRING, description: 'Public URL to JCAMP file' },
          color: { type: Type.STRING, description: 'Optional CSS color string' },
          label: { type: Type.STRING, description: 'Label for overlay' },
        },
        required: ['url'],
      },
    },
    {
      name: 'export_spectrum',
      description: 'Export the current spectrum or annotations.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          format: { type: Type.STRING, description: 'pdf | png | svg | json' },
          includeAnnotations: { type: Type.BOOLEAN, description: 'Whether to include peak labels' },
        },
        required: ['format'],
      },
    },
    {
      name: 'add_note',
      description: 'Add a short procedural note for the user.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          text: { type: Type.STRING, description: 'Note text' },
          category: { type: Type.STRING, description: 'safety | tip | workflow' },
        },
        required: ['text'],
      },
    },
    {
      name: 'reset_view',
      description: 'Reset zoom and overlays to defaults.',
      parameters: {
        type: Type.OBJECT,
        properties: {},
      },
    },
  ];

  const modelCandidates = ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-flash-latest'];
  const combinedPrompt = `${options?.context ?? ''}\n${userPrompt}`.trim();

  let lastError: any = null;

  for (const modelName of modelCandidates) {
    try {
      const result = await executeWithRotation(async (apiKey) => {
        if (apiKey !== currentApiKey) {
          genAI = new GoogleGenAI({ apiKey });
          currentApiKey = apiKey;
          cachedModelName = null;
        }

        const fetchPromise = genAI!.models.generateContent({
          model: modelName,
          contents: [
            {
              role: 'user',
              parts: [{ text: `Act as an NMRium operator. Provide concise Markdown guidance AND emit function calls for actions.\n${combinedPrompt}` }],
            },
          ],
          tools: [{ functionDeclarations: toolDeclarations }],
          toolConfig: { functionCallingConfig: { mode: 'AUTO' } },
        });

        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new TimeoutError(`NMR plan request timed out after ${timeoutMs}ms`)), timeoutMs);
        });

        const response = await Promise.race([fetchPromise, timeoutPromise]);

        const actions: NmrAction[] = [];
        const textParts: string[] = [];

        const collectFromParts = (parts: any[] | undefined) => {
          if (!Array.isArray(parts)) return;
          parts.forEach((part) => {
            if (typeof part?.text === 'string') {
              textParts.push(part.text);
            }
            if (part?.functionCall) {
              actions.push({
                action: part.functionCall.name,
                params: part.functionCall.args || {},
                rationale: part.functionCall.reasoning || undefined,
              });
            }
          });
        };

        collectFromParts(response?.candidates?.[0]?.content?.parts);
        collectFromParts(response?.content?.parts);

        const text = response?.text || textParts.join('\n').trim() || 'Here is your NMR guidance.';

        return { text, actions, modelUsed: modelName };
      });

      return result;
    } catch (error: any) {
      // Use handleGeminiError to check for Safety/Timeout, but we might just want to continue to next model if it's a generic failure
      try {
        handleGeminiError(error);
      } catch (e) {
        if (e instanceof SafetyError) throw e; // Stop if blocked by safety
      }

      lastError = error;
      console.warn(`NMR assistant call failed for model ${modelName}:`, error?.message || error);
      continue;
    }
  }

  throw lastError || new Error('Failed to generate NMR assistant response');
};

export const resolveMoleculeDescription = async (
  description: string
): Promise<MoleculeResolutionResult> => {
  const query = description.trim();
  if (!query) {
    throw new Error('Provide a molecule description or name to resolve.');
  }

  if (!genAI) {
    throw new Error('Gemini API not initialized. Please provide an API key.');
  }

  const prompt = [
    'You are a cheminformatics expert. Convert the user description of a molecule into canonical SMILES.',
    'Return ONLY valid JSON with this structure:',
    '{',
    '  "name": "best common or IUPAC name if available",',
    '  "smiles": "primary SMILES string or null if unknown",',
    '  "synonyms": ["list", "of", "alternate", "names or SMILES"],',
    '  "confidence": 0.0-1.0,',
    '  "notes": "optional guidance or assumptions"',
    '}',
    'Rules:',
    '- Prefer canonical SMILES when known.',
    '- If unsure, set smiles to null and explain in notes.',
    '- Include helpful synonyms such as trade names or alternative SMILES when possible.',
    '- Do not include any text outside of the JSON object.'
  ].join('\n');

  const aiResponse = await generateTextContent(`${prompt}\n\nMolecule description: ${query}`);
  const jsonPayload = extractJsonBlock(aiResponse);

  let parsed: any;
  try {
    parsed = JSON.parse(jsonPayload);
  } catch (error) {
    console.error('Failed to parse Gemini molecule response:', error, jsonPayload);
    throw new Error('Gemini could not provide a structured molecule response. Refine the description and try again.');
  }

  const name = typeof parsed?.name === 'string' ? parsed.name.trim() : undefined;
  const rawSmiles = typeof parsed?.smiles === 'string' ? parsed.smiles.trim() : '';
  const synonyms = Array.isArray(parsed?.synonyms)
    ? parsed.synonyms
      .map((value: unknown) => (typeof value === 'string' ? value.trim() : ''))
      .filter((value: string) => value.length > 0)
    : [];
  const confidence = typeof parsed?.confidence === 'number' ? parsed.confidence : undefined;
  const notes = typeof parsed?.notes === 'string' ? parsed.notes.trim() : undefined;

  const candidates = [rawSmiles, ...synonyms].filter((token): token is string => token.length > 0);

  let canonicalSmiles: string | null = null;
  for (const candidate of candidates) {
    canonicalSmiles = await fetchCanonicalSmiles(candidate);
    if (canonicalSmiles) {
      break;
    }
  }

  const primarySmiles = canonicalSmiles ?? (rawSmiles || null);

  if (!primarySmiles) {
    try {
      const fallbackResponse = await generateTextContent([
        'Provide the canonical SMILES string for the following molecule description.',
        'Return ONLY valid JSON with this shape:',
        '{',
        '  "smiles": "canonical SMILES string or null",',
        '  "synonyms": ["optional synonyms"]',
        '}',
        `Molecule description: ${query}`
      ].join('\n'));

      const fallbackJson = extractJsonBlock(fallbackResponse);
      const fallbackParsed = JSON.parse(fallbackJson);

      const fallbackSmiles =
        typeof fallbackParsed?.smiles === 'string' ? fallbackParsed.smiles.trim() : '';
      const fallbackSynonyms = Array.isArray(fallbackParsed?.synonyms)
        ? fallbackParsed.synonyms
          .map((value: unknown) => (typeof value === 'string' ? value.trim() : ''))
          .filter((value: string) => value.length > 0)
        : [];

      const fallbackCandidates = [fallbackSmiles, ...fallbackSynonyms].filter(
        (candidate): candidate is string => candidate.length > 0
      );

      for (const candidate of fallbackCandidates) {
        canonicalSmiles = await fetchCanonicalSmiles(candidate);
        if (canonicalSmiles) {
          break;
        }
      }

      if (canonicalSmiles) {
        return {
          query,
          smiles: canonicalSmiles,
          canonicalSmiles,
          confidence,
          name,
          synonyms: [...synonyms, ...fallbackSynonyms],
          notes: notes
            ? `${notes} | SMILES inferred via fallback lookup.`
            : 'SMILES inferred via fallback lookup.',
          source: 'pubchem'
        };
      }
    } catch (fallbackError) {
      console.warn('Fallback SMILES resolution failed:', fallbackError);
    }

    throw new Error(
      'Unable to determine a SMILES string for that description. Try adding more detail or specifying a recognised synonym.'
    );
  }

  return {
    query,
    smiles: primarySmiles,
    canonicalSmiles,
    confidence,
    name,
    synonyms,
    notes,
    source: canonicalSmiles ? 'pubchem' : 'gemini'
  };
};

export const generateImageDescription = async (imageUrl: string): Promise<string> => {
  if (!genAI) {
    throw new Error('Gemini API not initialized. Please provide an API key.');
  }

  try {
    const modelName = await getAvailableModel(genAI);
    const model = genAI.getGenerativeModel({ model: modelName });
    const prompt = `Describe what kind of image would be suitable for this URL: ${imageUrl}. Provide a brief, professional description.`;
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error('Error generating image description:', error);
    throw error;
  }
};

export interface ContextualResourceRecommendation {
  title: string;
  url: string;
  type: 'youtube' | 'article' | 'reference' | 'simulation' | 'tool' | 'other';
  description: string;
  reason?: string;
  author?: string;
}

interface ResourceRequestParams {
  topic: string;
  lessonContent: string;
  documentContent?: string;
  academicLevel?: string;
  maxItems?: number;
}

export const fetchContextualResources = async ({
  topic,
  lessonContent,
  documentContent,
  academicLevel = 'university',
  maxItems = 3,
}: ResourceRequestParams): Promise<ContextualResourceRecommendation[]> => {
  const excerpt = lessonContent.slice(0, 2000);
  const documentExcerpt = documentContent?.slice(0, 1500) ?? '';
  const prompt = [
    'You are a study concierge who suggests external resources.',
    `Provide up to ${maxItems} highly relevant resources for a learner studying the topic.`,
    'Rules:',
    '- Always prioritize high quality YouTube videos, official documentation, or interactive web resources.',
    '- Include at least one YouTube video when possible.',
    '- Responses must be valid JSON array only, no prose.',
    '- Each resource object must contain: title, url, type (youtube|article|reference|simulation|tool|other), description (1 sentence), reason (why it helps), and optional author.',
    '- Do not repeat the same domain more than once unless critical.',
    '- Prefer resources accessible without paywalls.',
    '',
    `Learner academic level: ${academicLevel}`,
    `Lesson topic: ${topic}`,
    `Lesson content excerpt:\n${excerpt}`,
    documentExcerpt ? `Document excerpt:\n${documentExcerpt}` : '',
  ].join('\n');

  const aiResponse = await generateTextContent(prompt);
  const jsonPayload = extractJsonBlock(aiResponse);

  try {
    const parsed = JSON.parse(jsonPayload);
    if (Array.isArray(parsed)) {
      return parsed
        .filter((item) => item && item.title && item.url)
        .slice(0, maxItems);
    }
    return [];
  } catch (error) {
    console.error('Failed to parse Gemini contextual resources:', error, jsonPayload);
    throw new Error('Gemini could not provide structured resource recommendations.');
  }
};

export interface MolecularVisualizationPlan {
  title: string;
  moleculeName: string;
  script: string;
  description: string;
}

interface MolecularScriptParams {
  topic: string;
  candidateMolecules: string[];
  lessonContent: string;
}

export const fetchMolecularVisualizationPlan = async ({
  topic,
  candidateMolecules,
  lessonContent,
}: MolecularScriptParams): Promise<MolecularVisualizationPlan | null> => {
  if (!candidateMolecules.length) {
    return null;
  }

  const prompt = [
    'You help chemistry students explore molecules via JSmol.',
    'Choose the single most relevant molecule from the provided list and craft a JSmol script that loads its 3D structure (prefer the PubChem REST SDF endpoint).',
    'Return ONLY JSON with this shape:',
    '{',
    '  "title": "Human-friendly headline for the molecule",',
    '  "moleculeName": "Name or identifier used for context",',
    '  "script": "JSmol script that loads and styles the molecule",',
    '  "description": "Short explanation of why this structure matters to the lesson"',
    '}',
    'Rules:',
    '- script must start by loading the molecule, e.g. load "https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/ACETONE/SDF";',
    '- After load, set an appealing style (wireframe/spacefill/colours) and optionally spin.',
    '- Do not output markdown fences or commentary.',
    '',
    `Topic: ${topic}`,
    `Lesson excerpt:\n${lessonContent.slice(0, 1600)}`,
    `Candidate molecules: ${candidateMolecules.join(', ')}`,
  ].join('\n');

  const aiResponse = await generateTextContent(prompt);
  const jsonPayload = extractJsonBlock(aiResponse);

  try {
    const parsed = JSON.parse(jsonPayload);
    if (parsed?.script && parsed?.title) {
      return {
        title: parsed.title,
        moleculeName: parsed.moleculeName || candidateMolecules[0],
        script: parsed.script,
        description: parsed.description || '',
      };
    }
    return null;
  } catch (error) {
    console.error('Failed to parse Gemini molecular plan:', error, jsonPayload);
    return null;
  }
};

interface YouTubeRankingParams {
  topic: string;
  lessonContent: string;
  videos: Array<{
    id: string;
    title: string;
    description?: string;
    channelTitle?: string;
  }>;
  count?: number;
}

export const selectTopYouTubeVideos = async ({
  topic,
  lessonContent,
  videos,
  count = 3,
}: YouTubeRankingParams): Promise<string[] | null> => {
  if (!videos.length) {
    return null;
  }

  const prompt = [
    'You are ranking existing YouTube videos for a study session.',
    `Return ONLY JSON array of up to ${count} video ids (from the provided list) that best match the learner's needs.`,
    'Consider accuracy, modern explanations, and alignment with the lesson topic.',
    'Example output: ["abc123", "xyz456", "pqr789"]',
    '',
    `Topic: ${topic}`,
    `Lesson excerpt:\n${lessonContent.slice(0, 1600)}`,
    '',
    'Candidate videos:',
    ...videos.map(
      (video, index) =>
        `${index + 1}. id=${video.id}, title="${video.title}", channel="${video.channelTitle || 'unknown'}", description="${video.description || ''}"`
    ),
  ].join('\n');

  const response = await generateTextContent(prompt);
  const jsonPayload = extractJsonBlock(response);
  try {
    const parsed = JSON.parse(jsonPayload);
    if (Array.isArray(parsed) && parsed.every((item) => typeof item === 'string')) {
      return parsed.slice(0, count);
    }
    return null;
  } catch (error) {
    console.error('Failed to parse Gemini YouTube ranking response:', error, jsonPayload);
    return null;
  }
};

export const generateListItems = async (topic: string, count: number = 5): Promise<string[]> => {
  if (!genAI) {
    throw new Error('Gemini API not initialized. Please provide an API key.');
  }

  try {
    const modelName = await getAvailableModel(genAI);
    const model = genAI.getGenerativeModel({ model: modelName });
    const prompt = `Generate ${count} concise bullet points about: ${topic}. Return only the bullet points, one per line, without bullet symbols.`;
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    return text.split('\n').filter(line => line.trim().length > 0).slice(0, count);
  } catch (error) {
    console.error('Error generating list items:', error);
    throw error;
  }
};

export const generateCode = async (language: string, description: string): Promise<string> => {
  if (!genAI) {
    throw new Error('Gemini API not initialized. Please provide an API key.');
  }

  try {
    const modelName = await getAvailableModel(genAI);
    const model = genAI.getGenerativeModel({ model: modelName });
    const prompt = `Generate ${language} code for: ${description}. Return only the code without explanation or markdown formatting.`;
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error('Error generating code:', error);
    throw error;
  }
};

export const generateQuote = async (topic: string): Promise<{ quote: string; author: string }> => {
  if (!genAI) {
    throw new Error('Gemini API not initialized. Please provide an API key.');
  }

  try {
    const modelName = await getAvailableModel(genAI);
    const model = genAI.getGenerativeModel({ model: modelName });
    const prompt = `Provide an inspiring or educational quote related to: ${topic}. Format as: "Quote text" - Author Name`;
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Parse quote and author
    const match = text.match(/"([^"]+)"\s*-\s*(.+)/);
    if (match) {
      return { quote: match[1], author: match[2].trim() };
    }
    return { quote: text, author: 'Unknown' };
  } catch (error) {
    console.error('Error generating quote:', error);
    throw error;
  }
};

export const generateFormula = async (topic: string): Promise<string> => {
  if (!genAI) {
    throw new Error('Gemini API not initialized. Please provide an API key.');
  }

  try {
    const modelName = await getAvailableModel(genAI);
    const model = genAI.getGenerativeModel({ model: modelName });
    const prompt = `Provide a relevant mathematical or chemical formula for: ${topic}. Return only the formula without explanation.`;
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text().trim();
  } catch (error) {
    console.error('Error generating formula:', error);
    throw error;
  }
};

export interface GeneratedQuizQuestion {
  prompt: string;
  options: string[];
  correctOptionIndex: number;
  explanation: string;
}

export interface QuizGenerationOptions {
  topic: string;
  count?: number;
  difficulty?: 'introductory' | 'intermediate' | 'advanced';
  focusAreas?: string[];
  contextNotes?: string[];
}

interface FlashcardGenerationOptions {
  topic: string;
  count?: number;
  learnerLevel?: 'beginner' | 'intermediate' | 'advanced';
  emphasis?: string[];
}

export interface GeneratedFlashcard {
  front: string;
  back: string;
  mnemonic?: string;
  confidenceTag?: 'recall' | 'familiar' | 'stretch';
  difficulty?: 'intro' | 'intermediate' | 'advanced';
  tags?: string[];
}

export const generateImage = async (
  prompt: string,
  options?: {
    aspectRatio?: AspectRatio;
    imageSize?: ImageSize;
    numberOfImages?: number;
  }
): Promise<string> => {
  await ensureInitializedAsync();
  if (!genAI) {
    throw new Error('Gemini API not initialized. Please provide an API key.');
  }

  try {
    // Use rotation to get a fresh key if needed
    return await executeWithRotation(async (apiKey) => {
      if (apiKey !== currentApiKey) {
        genAI = new GoogleGenAI({ apiKey });
        currentApiKey = apiKey;
      }

      // Use the specific model for image generation
      const modelName = 'gemini-3-pro-image-preview';

      // Configure for image generation with grounding
      const config = {
        tools: [{ googleSearch: {} }], // Enable grounding
        imageConfig: {
          aspectRatio: options?.aspectRatio || '1:1',
          imageSize: options?.imageSize || '1K',
        },
        responseModalities: ['Image'], // Request only image output
      };

      console.log(`🎨 Generating image with ${modelName}...`);
      const response = await genAI!.models.generateContent({
        model: modelName,
        contents: prompt,
        config: config as any, // Type cast as the SDK types might not be fully updated for this yet
      });

      // Extract base64 image data
      // The response structure for images is slightly different
      const candidates = response.candidates;
      if (!candidates || candidates.length === 0) {
        throw new Error('No image candidates returned');
      }

      const parts = candidates[0].content?.parts;
      if (!parts || parts.length === 0) {
        throw new Error('No image parts returned');
      }

      // Look for inlineData which contains the base64 image
      const imagePart = parts.find((p: any) => p.inlineData);
      if (!imagePart || !imagePart.inlineData || !imagePart.inlineData.data) {
        throw new Error('No image data found in response');
      }

      return imagePart.inlineData.data;
    });
  } catch (error: any) {
    console.error('Error generating image:', error);
    throw new Error(`Failed to generate image: ${error.message}`);
  }
};

export type ImagenPersonGeneration = 'dont_allow' | 'allow_adult' | 'allow_all';

export type GeneratedImagenImage = {
  mimeType: string;
  imageBytesBase64: string;
};

export const generateImagen4Images = async (
  prompt: string,
  options?: {
    aspectRatio?: AspectRatio;
    imageSize?: ImageSize;
    numberOfImages?: 1 | 2 | 3 | 4;
    personGeneration?: ImagenPersonGeneration;
    outputMimeType?: 'image/png' | 'image/jpeg' | string;
    outputCompressionQuality?: number;
  }
): Promise<GeneratedImagenImage[]> => {
  await ensureInitializedAsync();
  if (!genAI) {
    throw new Error('Gemini API not initialized. Please provide an API key.');
  }

  return await executeWithRotation(async (apiKey) => {
    if (apiKey !== currentApiKey) {
      genAI = new GoogleGenAI({ apiKey });
      currentApiKey = apiKey;
      cachedModelName = null;
    }

    const response = await genAI!.models.generateImages({
      model: 'imagen-4.0-generate-001',
      prompt,
      config: {
        numberOfImages: options?.numberOfImages ?? 1,
        aspectRatio: options?.aspectRatio ?? '1:1',
        imageSize: options?.imageSize ?? '1K',
        personGeneration: options?.personGeneration ?? 'allow_adult',
        outputMimeType: options?.outputMimeType ?? 'image/png',
        outputCompressionQuality: options?.outputCompressionQuality,
      } as any,
    });

    const images = (response as any)?.generatedImages as Array<any> | undefined;
    if (!images?.length) return [];

    return images
      .map((img) => {
        const mimeType = String(img?.image?.mimeType ?? options?.outputMimeType ?? 'image/png');
        const imageBytes = img?.image?.imageBytes;
        if (!imageBytes || typeof imageBytes !== 'string') return null;
        return { mimeType, imageBytesBase64: imageBytes } satisfies GeneratedImagenImage;
      })
      .filter(Boolean) as GeneratedImagenImage[];
  });
};

/**
 * Generates a high-quality educational image using Nano Banana Pro (Gemini 3 Pro Image Preview).
 */
export const generateEducationalImage = async (
  topic: string,
  aspectRatio: AspectRatio,
  imageSize: ImageSize
): Promise<string> => {
  await ensureInitializedAsync();
  if (!genAI) {
    throw new Error('Gemini API not initialized. Please provide an API key.');
  }

  try {
    return await executeWithRotation(async (apiKey) => {
      // Reinitialize with new key if needed
      if (apiKey !== currentApiKey) {
        genAI = new GoogleGenAI({ apiKey });
        currentApiKey = apiKey;
        cachedModelName = null;
      }

      // Step 1: Research with Google Search grounding for scientific accuracy
      const researchResult = await genAI!.models.generateContent({
        model: 'gemini-3-flash-preview',
        config: {
          tools: [{ googleSearch: {} }],
          thinkingConfig: { thinking_level: 'Comprehensive' }
        },
        contents: [{
          role: 'user', parts: [{
            text: `Research the scientific/academic topic: "${topic}". Find accurate visual representations, diagrams, and scientific illustrations used in academic textbooks, research papers, and educational materials. Focus on:
1. What are the key visual elements and components that MUST be shown?
2. What is the scientifically accurate representation?
3. What style is commonly used in academic/textbook illustrations?
4. What are common mistakes to avoid in depicting this topic?` }]
        }]
      });

      const researchContext = researchResult.text || '';
      console.log("Research context gathered for image generation");

      // Step 2: Prompt Engineering with Gemini 3 Flash using research context
      const promptResult = await genAI!.models.generateContent({
        model: 'gemini-3-flash-preview',
        config: {
          systemInstruction: `Role: You are an Expert SCIENTIFIC and ACADEMIC Illustrator and Prompt Engineer for an advanced AI image generator.

OBJECTIVE: Create prompts for STRICTLY SCIENTIFIC, ACADEMIC, and EDUCATIONAL images. The images must look like they belong in a university textbook, scientific journal, or educational material.

CRITICAL REQUIREMENTS:
1. Images MUST be scientifically accurate - no artistic liberties that compromise accuracy
2. Images MUST look professional and academic - like from Nature, Science journals, or Pearson textbooks
3. NO fantasy elements, NO artistic stylization that compromises scientific accuracy
4. Use proper scientific terminology and accurate representations

STYLE GUIDELINES by Level:
- High School/Undergraduate: Clean textbook-style diagrams, labeled scientific illustrations, cross-sections, photorealistic renders of scientific concepts
- University/Professional: Publication-quality scientific figures, electron microscopy style, research-grade visualizations, data visualizations

REQUIRED VISUAL ELEMENTS:
- Scientific accuracy in proportions, structures, and relationships
- Clear labeling-ready compositions (even if labels aren't shown)
- Professional color palettes used in scientific publishing (blues, greens, neutral tones)
- Clean backgrounds (white, gradient, or contextually appropriate)
- Proper scale and perspective for scientific subjects

PROMPT CONSTRUCTION FORMAT:
"Scientific illustration of [SUBJECT] showing [KEY COMPONENTS], [VISUALIZATION TYPE] style, [SPECIFIC SCIENTIFIC DETAILS], professional academic quality, textbook illustration, clean composition, accurate proportions, [LIGHTING], high resolution, publication quality"

NEGATIVE PROMPT must include:
"cartoon, anime, fantasy, artistic interpretation, stylized, abstract, inaccurate anatomy, wrong proportions, text, watermark, logo, blurry, low quality, amateur, unrealistic colors, exaggerated features"

Research Context (use this for accuracy):
${researchContext}

Output Format: return ONLY the raw JSON object. Do not wrap it in markdown code blocks.`,
          responseMimeType: 'application/json',
          responseSchema: ImageGenerationPromptSchema,
          thinkingConfig: { thinking_level: 'Comprehensive' }
        },
        contents: [{ role: 'user', parts: [{ text: topic }] }]
      });

      const promptText = promptResult.text;
      if (!promptText) throw new Error("Failed to generate prompt engineering result");

      const promptData = JSON.parse(promptText) as ImageGenerationPrompt;
      console.log("Engineered Prompt:", promptData);

      // Step 2: Image Generation with Gemini 3 Pro Image Preview
      const imagePrompt = `${promptData.generation_parameters.final_prompt} --no ${promptData.generation_parameters.negative_prompt}`;

      // Use official API format as per documentation: https://ai.google.dev/gemini-api/docs/image-generation
      // Map ImageSize enum to string format ('1K', '2K', '4K')
      const imageSizeStr = imageSize === ImageSize.K1 ? '1K' :
        imageSize === ImageSize.K2 ? '2K' :
          imageSize === ImageSize.K4 ? '4K' : '1K';

      // Map AspectRatio enum to string format
      const aspectRatioStr = aspectRatio === AspectRatio.SQUARE ? '1:1' :
        aspectRatio === AspectRatio.PORTRAIT_2_3 ? '2:3' :
          aspectRatio === AspectRatio.PORTRAIT_3_4 ? '3:4' :
            aspectRatio === AspectRatio.PORTRAIT_9_16 ? '9:16' :
              aspectRatio === AspectRatio.LANDSCAPE_3_2 ? '3:2' :
                aspectRatio === AspectRatio.LANDSCAPE_4_3 ? '4:3' :
                  aspectRatio === AspectRatio.LANDSCAPE_16_9 ? '16:9' :
                    aspectRatio === AspectRatio.CINEMATIC_21_9 ? '21:9' : '16:9';

      let response;
      const maxRetries = 3;
      for (let retry = 0; retry < maxRetries; retry++) {
        try {
          response = await genAI!.models.generateContent({
            model: 'gemini-3-pro-image-preview',
            contents: [imagePrompt], // Simple array format as per official documentation
            config: {
              imageConfig: {
                aspectRatio: aspectRatioStr,
                imageSize: imageSizeStr, // '1K', '2K', or '4K' as per documentation
              },
            },
          });
          break; // Success, exit loop
        } catch (error: any) {
          const errorMessage = error?.message?.toLowerCase() || '';
          const is503 = errorMessage.includes('503') || errorMessage.includes('overloaded') || errorMessage.includes('unavailable');

          if (is503 && retry < maxRetries - 1) {
            const delay = 2000 * Math.pow(2, retry);
            console.warn(`⏳ Image gen overloaded (attempt ${retry + 1}/${maxRetries}). Retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
          throw error; // Not a 503 or max retries reached
        }
      }

      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
        if (part.text) {
          // Fallback: Check if the model returned an HTML snippet with the image
          const srcMatch = part.text.match(/src="([^"]+)"/);
          if (srcMatch) {
            return srcMatch[1];
          }
          // Fallback: Check if the text itself is a URL
          if (part.text.trim().startsWith('http')) {
            return part.text.trim();
          }
        }
      }
      throw new Error("No image generated.");
    });
  } catch (error) {
    console.error("Image Gen Error:", error);
    throw error;
  }
};

/**
 * Generates enhanced intelligent information for a label including equations, relationships, and more.
 */
export const generateEnhancedLabelInfo = async (
  label: InteractiveLabel,
  imageContext?: string,
  allLabels?: InteractiveLabel[]
): Promise<EnhancedLabelInfo> => {
  await ensureInitializedAsync();
  if (!genAI) {
    throw new Error('Gemini API not initialized. Please provide an API key.');
  }

  try {
    return await executeWithRotation(async (apiKey) => {
      if (apiKey !== currentApiKey) {
        genAI = new GoogleGenAI({ apiKey });
        currentApiKey = apiKey;
        cachedModelName = null;
      }

      // Build context about related labels
      const relatedLabels = allLabels?.filter(l => l.term !== label.term).map(l => l.term).join(', ') || '';

      const prompt = `You are an expert educational content creator. Analyze the label "${label.term}" from an educational diagram.

Label Definition: "${label.definition}"
Fun Fact: "${label.funFact}"
${relatedLabels ? `Other labels in the diagram: ${relatedLabels}` : ''}
${imageContext ? `Image context: ${imageContext.substring(0, 500)}` : ''}

Generate comprehensive educational information for this label. Return a JSON object with:
{
  "term": "${label.term}",
  "definition": "Enhanced, clear definition",
  "funFact": "Interesting fact",
  "equations": ["LaTeX formatted equation 1", "LaTeX formatted equation 2"], // Include relevant mathematical/physical equations. Use LaTeX format with $ for inline and $$ for display math
  "relationships": [
    {"relatedTo": "Related term name", "relationship": "How this relates to the label (e.g., 'is proportional to', 'depends on', 'affects')"}
  ], // Relationships with other labels or concepts
  "keyConcepts": ["Concept 1", "Concept 2"], // Key concepts related to this label
  "applications": ["Real-world application 1", "Application 2"], // Practical applications
  "visualDescription": "Description of what this label represents visually in the diagram"
}

IMPORTANT:
- Include equations ONLY if they are relevant to this label (e.g., physics formulas, mathematical relationships)
- Use proper LaTeX notation: $E = mc^2$ for inline, $$F = ma$$ for display
- Relationships should explain HOW this label connects to other elements in the diagram
- Be specific and educational, not generic`;

      const response = await genAI!.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: [prompt],
        config: {
          responseMimeType: 'application/json',
          tools: [{ googleSearch: {} }], // Enable grounding for accurate equations
          thinkingConfig: { thinkingBudget: 2048 }
        }
      });

      const text = response.text;
      if (!text) {
        return {
          term: label.term,
          definition: label.definition,
          funFact: label.funFact,
          equations: [],
          relationships: [],
          keyConcepts: [],
          applications: []
        };
      }

      try {
        const data = JSON.parse(text);
        return {
          term: data.term || label.term,
          definition: data.definition || label.definition,
          funFact: data.funFact || label.funFact,
          equations: data.equations || [],
          relationships: data.relationships || [],
          keyConcepts: data.keyConcepts || [],
          applications: data.applications || [],
          visualDescription: data.visualDescription
        };
      } catch (parseError) {
        console.error('Failed to parse enhanced label info:', parseError);
        return {
          term: label.term,
          definition: label.definition,
          funFact: label.funFact,
          equations: [],
          relationships: [],
          keyConcepts: [],
          applications: []
        };
      }
    });
  } catch (error) {
    console.error('Failed to generate enhanced label info:', error);
    return {
      term: label.term,
      definition: label.definition,
      funFact: label.funFact,
      equations: [],
      relationships: [],
      keyConcepts: [],
      applications: []
    };
  }
};

/**
 * Analyzes an image to extract educational content from labels using Gemini 3 Pro.
 */
export const analyzeImageForLearning = async (base64Image: string): Promise<InteractiveLabel[]> => {
  await ensureInitializedAsync();
  if (!genAI) {
    throw new Error('Gemini API not initialized. Please provide an API key.');
  }

  const cleanBase64 = base64Image.replace(/^data:image\/(png|jpeg|jpg);base64,/, "");

  try {
    return await executeWithRotation(async (apiKey) => {
      if (apiKey !== currentApiKey) {
        genAI = new GoogleGenAI({ apiKey });
        currentApiKey = apiKey;
        cachedModelName = null;
      }

      const response = await genAI!.models.generateContent({
        model: 'gemini-3-pro-preview', // High reasoning model
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: 'image/png',
                data: cleanBase64
              }
            },
            {
              text: "Analyze this educational diagram. Identify all the text labels present in the image. For each label found, provide:\n1. The term text\n2. A simple definition suitable for a student\n3. A fun fact\n4. The bounding box coordinates (ymin, xmin, ymax, xmax) normalized to 0-1000 scale.\n\nReturn the result as a JSON object."
            }
          ]
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: EducationalSchema,
          thinkingConfig: { thinkingBudget: 2048 } // Allow some thinking for accurate OCR and definition generation
        }
      });

      const text = response.text;
      if (!text) return [];

      const data = JSON.parse(text);
      return data.items || [];
    });
  } catch (error) {
    console.error("Analysis Error:", error);
    return [];
  }
};

/**
 * Chat with Gemini. Uses Gemini 3 Pro for smarts, or Flash with Search if grounding is needed.
 */
export const sendStudiumChatMessage = async (
  message: string,
  history: { role: string, parts: { text: string }[] }[],
  useSearch: boolean
) => {
  await ensureInitializedAsync();
  if (!genAI) {
    throw new Error('Gemini API not initialized. Please provide an API key.');
  }

  // Choose model based on feature
  const modelName = 'gemini-2.5-flash';

  const tools = useSearch ? [{ googleSearch: {} }] : [];

  try {
    return await executeWithRotation(async (apiKey) => {
      if (apiKey !== currentApiKey) {
        genAI = new GoogleGenAI({ apiKey });
        currentApiKey = apiKey;
        cachedModelName = null;
      }

      const chat = genAI!.chats.create({
        model: modelName,
        history: history.map(h => ({
          role: h.role,
          parts: h.parts
        })),
        config: {
          tools: tools,
        }
      });

      const result = await chat.sendMessage({ message });

      // Extract sources if search was used
      let sources: { uri: string; title: string }[] = [];
      let groundingMetadata: any = undefined;

      if (useSearch) {
        groundingMetadata = result.candidates?.[0]?.groundingMetadata;
        const chunks = groundingMetadata?.groundingChunks;
        if (chunks) {
          sources = chunks
            .filter((c: any) => c.web)
            .map((c: any) => ({ uri: c.web.uri, title: c.web.title }));
        }
      }

      return {
        text: result.text,
        sources,
        groundingMetadata
      };
    });
  } catch (error) {
    console.error("Chat Error:", error);
    throw error;
  }
};

/**
 * Fetch grounding sources for a topic using Google Search.
 * Returns sources with URLs, titles, and snippets.
 */
export const fetchGroundingSources = async (
  query: string
): Promise<{
  text: string;
  sources: Array<{ url: string; title: string; snippet?: string }>;
  groundingMetadata?: any;
}> => {
  await ensureInitializedAsync();
  if (!genAI) {
    throw new Error('Gemini API not initialized. Please provide an API key.');
  }

  try {
    return await executeWithRotation(async (apiKey) => {
      if (apiKey !== currentApiKey) {
        genAI = new GoogleGenAI({ apiKey });
        currentApiKey = apiKey;
        cachedModelName = null;
      }

      const result = await genAI!.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: query,
        config: {
          tools: [{ googleSearch: {} }],
        }
      });

      const groundingMetadata = result.candidates?.[0]?.groundingMetadata;
      const chunks = groundingMetadata?.groundingChunks || [];
      const supports = groundingMetadata?.groundingSupports || [];

      // Extract unique sources with snippets
      const sourcesMap = new Map<string, { url: string; title: string; snippet?: string }>();

      chunks.forEach((chunk: any, idx: number) => {
        if (chunk.web) {
          const support = supports.find((s: any) =>
            s.groundingChunkIndices?.includes(idx)
          );
          sourcesMap.set(chunk.web.uri, {
            url: chunk.web.uri,
            title: chunk.web.title || new URL(chunk.web.uri).hostname,
            snippet: support?.segment?.text
          });
        }
      });

      return {
        text: result.text || '',
        sources: Array.from(sourcesMap.values()),
        groundingMetadata
      };
    });
  } catch (error) {
    console.error("Grounding Search Error:", error);
    throw error;
  }
};

/**
 * General image analysis for uploaded photos.
 */
export const analyzeUploadedImage = async (file: File, prompt: string): Promise<string> => {
  await ensureInitializedAsync();
  if (!genAI) {
    throw new Error('Gemini API not initialized. Please provide an API key.');
  }

  const arrayBuffer = await file.arrayBuffer();
  const base64 = btoa(
    new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
  );

  try {
    return await executeWithRotation(async (apiKey) => {
      if (apiKey !== currentApiKey) {
        genAI = new GoogleGenAI({ apiKey });
        currentApiKey = apiKey;
        cachedModelName = null;
      }

      const response = await genAI!.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: file.type,
                data: base64
              }
            },
            { text: prompt || "Describe this image in detail." }
          ]
        }
      });
      return response.text || "Could not analyze image.";
    });
  } catch (error) {
    console.error("Upload Analysis Error:", error);
    throw error;
  }
};

export const generateFlashcardDeck = async ({
  topic,
  count = 6,
  learnerLevel = 'intermediate',
  emphasis = []
}: FlashcardGenerationOptions): Promise<GeneratedFlashcard[]> => {
  if (!genAI) {
    throw new Error('Gemini API not initialized. Please provide an API key.');
  }

  try {
    const modelName = await getAvailableModel(genAI);
    const model = genAI.getGenerativeModel({ model: modelName });

    const emphasisLine = emphasis.length ? `Prioritise these subtopics when possible: ${emphasis.join(', ')}.` : '';

    const prompt = [
      'You are a chemistry coach creating a tight flashcard sprint for spaced repetition.',
      `Build ${count} flashcards about "${topic}" for a ${learnerLevel} learner.`,
      emphasisLine,
      'Return only valid JSON shaped exactly like:',
      '{',
      '  "cards": [',
      '    {',
      '      "front": "Concise prompt (<= 140 characters)",',
      '      "back": "Clear explanation or answer (2-3 sentences max)",',
      '      "mnemonic": "Optional vivid hook to remember the concept",',
      '      "confidenceTag": "recall | familiar | stretch",',
      '      "difficulty": "intro | intermediate | advanced",',
      '      "tags": ["optional", "keywords"]',
      '    }',
      '  ]',
      '}',
      'Rules:',
      '- Make fronts actionable and specific.',
      '- Keep backs focused on the key idea or mechanism.',
      '- Use a mix of recall, familiar, and stretch tags across the deck.',
      '- Do not include any commentary outside the JSON.'
    ].join('\n');

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const jsonPayload = extractJsonBlock(response.text());
    const parsed = JSON.parse(jsonPayload);
    const rawCards: any[] = Array.isArray(parsed?.cards) ? parsed.cards : Array.isArray(parsed) ? parsed : [];

    const sanitized = rawCards
      .map((item) => {
        const front = String(item?.front ?? '').trim();
        const back = String(item?.back ?? '').trim();
        const mnemonic = String(item?.mnemonic ?? '').trim();
        const confidenceTag = String(item?.confidenceTag ?? '').trim().toLowerCase();
        const difficulty = String(item?.difficulty ?? '').trim().toLowerCase();
        const tagsSource = Array.isArray(item?.tags) ? item.tags : [];
        const tags = tagsSource
          .map((tag: any) => String(tag ?? '').trim())
          .filter((tag: string) => tag.length > 0)
          .slice(0, 4);

        if (!front || !back) {
          return null;
        }

        return {
          front,
          back,
          mnemonic: mnemonic || undefined,
          confidenceTag:
            confidenceTag === 'recall' || confidenceTag === 'familiar' || confidenceTag === 'stretch'
              ? (confidenceTag as GeneratedFlashcard['confidenceTag'])
              : undefined,
          difficulty:
            difficulty === 'intro' || difficulty === 'intermediate' || difficulty === 'advanced'
              ? (difficulty as GeneratedFlashcard['difficulty'])
              : undefined,
          tags
        } as GeneratedFlashcard;
      })
      .filter((card): card is GeneratedFlashcard => card !== null)
      .slice(0, count);

    if (!sanitized.length) {
      throw new Error('Gemini returned an empty flashcard payload.');
    }

    return sanitized;
  } catch (error) {
    console.error('Error generating flashcard deck:', error);
    throw error;
  }
};

export const generateAdaptiveQuizQuestions = async ({
  topic,
  count = 5,
  difficulty = 'intermediate',
  focusAreas = [],
  contextNotes = []
}: QuizGenerationOptions): Promise<GeneratedQuizQuestion[]> => {
  if (!genAI) {
    throw new Error('Gemini API not initialized. Please provide an API key.');
  }

  try {
    const modelName = await getAvailableModel(genAI);
    const model = genAI.getGenerativeModel({ model: modelName });

    const focusLine = focusAreas.length ? `Focus on these subtopics or skills: ${focusAreas.join(', ')}.` : '';
    const learnerContext = contextNotes.length ? `Learner context:\n- ${contextNotes.join('\n- ')}` : 'Learner context: none provided.';

    const prompt = [
      'You are an adaptive chemistry tutor creating a short diagnostic quiz.',
      `Generate ${count} multiple-choice questions about "${topic}".`,
      `Target difficulty: ${difficulty}.`,
      focusLine,
      learnerContext,
      'Return **only** valid JSON using this schema:',
      '{',
      '  "questions": [',
      '    {',
      '      "prompt": "Question text",',
      '      "options": ["Option A", "Option B", "Option C", "Option D"],',
      '      "correctOptionIndex": 0,',
      '      "explanation": "Brief justification"',
      '    }',
      '  ]',
      '}',
      'Rules:',
      '- Provide exactly four options per question.',
      '- Use 0-based index for the correct option.',
      '- Explanations must be concise (≤ 2 sentences).',
      '- Avoid duplicate prompts or options.',
      '- Ensure options are plausible distractors, not obvious jokes.',
      '- Do not include any text outside the JSON.'
    ].join('\n');

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const jsonPayload = extractJsonBlock(response.text());

    const parsed = JSON.parse(jsonPayload);
    const rawQuestions: any[] = Array.isArray(parsed?.questions) ? parsed.questions : Array.isArray(parsed) ? parsed : [];

    const sanitized = rawQuestions
      .map((item, index) => {
        const promptText = String(item?.prompt ?? '').trim();
        const explanation = String(item?.explanation ?? '').trim();
        const optionsSource = Array.isArray(item?.options) ? item.options : [];
        const options = optionsSource
          .map((option: any) => String(option ?? '').trim())
          .filter((option: string) => option.length > 0)
          .slice(0, 4);

        const correctIndex = Number.isInteger(item?.correctOptionIndex) ? item.correctOptionIndex : -1;

        if (!promptText || options.length !== 4 || correctIndex < 0 || correctIndex >= options.length) {
          return null;
        }

        return {
          prompt: promptText,
          options,
          correctOptionIndex: correctIndex,
          explanation: explanation || 'Review the reasoning to understand why this option is correct.'
        } as GeneratedQuizQuestion;
      })
      .filter((question): question is GeneratedQuizQuestion => question !== null)
      .slice(0, count);

    if (!sanitized.length) {
      throw new Error('Gemini returned an empty quiz payload.');
    }

    return sanitized;
  } catch (error) {
    console.error('Error generating adaptive quiz questions:', error);
    throw error;
  }
};

export const compileDocumentOutput = async (blocks: any[]): Promise<string> => {
  if (!genAI) {
    throw new Error('Gemini API not initialized. Please provide an API key.');
  }

  try {
    const modelName = await getAvailableModel(genAI);
    const model = genAI.getGenerativeModel({ model: modelName });

    // Create a structured representation of the document
    let documentStructure = 'Document contains the following blocks:\n\n';
    blocks.forEach((block, index) => {
      documentStructure += `Block ${index + 1} (${block.type}):\n`;
      switch (block.type) {
        case 'textNode':
          documentStructure += `Text: ${block.data.content || 'Empty'}\n\n`;
          break;
        case 'imageNode':
          documentStructure += `Image URL: ${block.data.imageUrl || 'No URL'}\n\n`;
          break;
        case 'listNode':
          documentStructure += `List items:\n${(block.data.items || []).map((item: string) => `- ${item}`).join('\n')}\n\n`;
          break;
        case 'tableNode':
          documentStructure += `Table data:\n${(block.data.tableData || []).map((row: string[]) => row.join(' | ')).join('\n')}\n\n`;
          break;
        case 'quoteNode':
          documentStructure += `Quote: "${block.data.quote || ''}" - ${block.data.author || ''}\n\n`;
          break;
        case 'codeNode':
          documentStructure += `Code (${block.data.language || 'javascript'}):\n${block.data.code || ''}\n\n`;
          break;
        case 'formulaNode':
          documentStructure += `Formula: ${block.data.formula || ''}\n\n`;
          break;
        case 'moleculeNode':
          documentStructure += `Molecule: ${block.data.moleculeData?.displayName || block.data.moleculeName || 'Unknown molecule'}\n`;
          if (block.data.moleculeData?.molecularFormula) {
            documentStructure += `Formula: ${block.data.moleculeData.molecularFormula}\n`;
          }
          if (block.data.moleculeData?.smiles) {
            documentStructure += `SMILES: ${block.data.moleculeData.smiles}\n`;
          }
          documentStructure += '\n';
          break;
        case 'chemicalEquationNode':
          documentStructure += `Chemical Equation: ${block.data.equation || ''}\n`;
          if (block.data.description) {
            documentStructure += `Description: ${block.data.description}\n`;
          }
          documentStructure += '\n';
          break;
        case 'labProcedureNode':
          documentStructure += `Lab Procedure: ${block.data.title || ''}\n`;
          if (block.data.materials && block.data.materials.length > 0) {
            documentStructure += `Materials:\n${block.data.materials.map((item: string) => `- ${item}`).join('\n')}\n`;
          }
          if (block.data.steps && block.data.steps.length > 0) {
            documentStructure += `Steps:\n${block.data.steps.map((step: string, i: number) => `${i + 1}. ${step}`).join('\n')}\n`;
          }
          documentStructure += '\n';
          break;
        case 'reactionSchemeNode':
          documentStructure += `Reaction Scheme: ${block.data.title || ''}\n`;
          if (block.data.reactants && block.data.reactants.length > 0) {
            documentStructure += `Reactants: ${block.data.reactants.join(' + ')}\n`;
          }
          if (block.data.products && block.data.products.length > 0) {
            documentStructure += `Products: ${block.data.products.join(' + ')}\n`;
          }
          if (block.data.conditions) {
            documentStructure += `Conditions: ${block.data.conditions}\n`;
          }
          documentStructure += '\n';
          break;
      }
    });

    const prompt = `You are a professional document compiler. Based on the following document blocks, create a cohesive, well-formatted markdown document output. Use proper markdown formatting including headers, lists, code blocks, and emphasis. Maintain the structure and order of blocks, but enhance the presentation and add smooth transitions between sections where appropriate. Format it as professional markdown:\n\n${documentStructure}\n\nGenerate the final compiled markdown document:`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error('Error compiling document:', error);
    throw error;
  }
};

export const getApiKey = (): string | null => {
  return localStorage.getItem('gemini_api_key') || localStorage.getItem('gemini-api-key');
};

export const setApiKey = (apiKey: string, options?: { markAsUser?: boolean }): void => {
  const shouldPersist = options?.markAsUser !== false;
  if (shouldPersist) {
    localStorage.setItem('gemini_api_key', apiKey);
    localStorage.setItem('gemini-api-key', apiKey);
    registerUserProvidedApiKey(apiKey);
  }
  cachedModelName = null; // Clear cached model when new key is set
  initializeGemini(apiKey);
};

export const removeApiKey = (): void => {
  localStorage.removeItem('gemini_api_key');
  localStorage.removeItem('gemini-api-key');
  genAI = null;
  cachedModelName = null; // Clear cached model
  clearUserProvidedApiKey();
};

// Auto-initialize from localStorage on module load
const savedApiKey = getApiKey();
if (savedApiKey) {
  initializeGemini(savedApiKey);
  console.log('✅ Gemini API initialized successfully from stored key.');
} else {
  console.warn('⚠️ No Gemini API key found in localStorage yet. It will be loaded from Firestore during app startup.');
}


/**
 * Convert raw PCM audio data to WAV format
 * @param pcmData - Raw PCM audio data as Uint8Array
 * @param sampleRate - Sample rate (e.g., 24000 for Gemini TTS)
 * @param numChannels - Number of audio channels (1 for mono)
 * @param bitsPerSample - Bits per sample (16 for Gemini TTS)
 * @returns ArrayBuffer containing WAV formatted audio
 */
function pcmToWav(pcmData: Uint8Array, sampleRate: number, numChannels: number, bitsPerSample: number): ArrayBuffer {
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = pcmData.length;
  const headerSize = 44;
  const totalSize = headerSize + dataSize;

  const buffer = new ArrayBuffer(totalSize);
  const view = new DataView(buffer);

  // RIFF header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, totalSize - 8, true); // File size - 8
  writeString(view, 8, 'WAVE');

  // fmt subchunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true); // AudioFormat (1 for PCM)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);

  // data subchunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  // Copy PCM data
  const outputArray = new Uint8Array(buffer, headerSize);
  outputArray.set(pcmData);

  return buffer;
}

function writeString(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

/**
 * Generate multi-speaker audio from a script
 */
export const generateMultiSpeakerAudio = async (
  script: string,
  speakers: { name: string; voiceName: string }[]
): Promise<ArrayBuffer> => {
  await ensureInitializedAsync();

  // The model name for TTS - must use the TTS-specific model
  const model = 'gemini-2.5-flash-preview-tts';

  // Build speaker voice configs according to the API spec
  const speakerVoiceConfigs = speakers.map(s => ({
    speaker: s.name,
    voiceConfig: {
      prebuiltVoiceConfig: {
        voiceName: s.voiceName
      }
    }
  }));

  // Log for debugging
  console.log('🎙️ TTS Request:', {
    model,
    scriptLength: script.length,
    scriptPreview: script.substring(0, 300) + '...',
    speakers: speakers.map(s => ({ name: s.name, voice: s.voiceName })),
    speakerVoiceConfigs: JSON.stringify(speakerVoiceConfigs, null, 2)
  });

  try {
    // Use REST API directly for TTS as the SDK may have issues
    const apiKey = currentApiKey || await getSharedGeminiApiKey();

    const requestBody = {
      contents: [{
        parts: [{ text: script }]
      }],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          multiSpeakerVoiceConfig: {
            speakerVoiceConfigs
          }
        }
      }
    };

    console.log('🎙️ TTS REST Request body:', JSON.stringify(requestBody, null, 2).substring(0, 500) + '...');

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('TTS API Error:', response.status, errorText);
      throw new Error(`TTS API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    // Log response for debugging
    console.log('🎙️ TTS Response:', {
      hasCandidate: !!data.candidates?.[0],
      finishReason: data.candidates?.[0]?.finishReason,
      hasContent: !!data.candidates?.[0]?.content,
      hasParts: !!data.candidates?.[0]?.content?.parts?.[0],
      hasInlineData: !!data.candidates?.[0]?.content?.parts?.[0]?.inlineData
    });

    // Access the audio data from the response
    const candidate = data.candidates?.[0];
    const part = candidate?.content?.parts?.[0];
    const inlineData = part?.inlineData;

    if (!inlineData?.data) {
      console.error('Response structure:', JSON.stringify(data, null, 2));
      throw new Error(`No audio data received from Gemini TTS API. Finish reason: ${candidate?.finishReason || 'unknown'}`);
    }

    console.log('✅ TTS Audio received:', {
      mimeType: inlineData.mimeType,
      dataLength: inlineData.data.length
    });

    // The data is base64 encoded PCM audio (24kHz, 16-bit, mono)
    const base64Audio = inlineData.data;
    const binaryString = atob(base64Audio);
    const len = binaryString.length;
    const pcmData = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      pcmData[i] = binaryString.charCodeAt(i);
    }

    // Convert raw PCM to WAV format for browser playback
    // Gemini TTS returns 24kHz, 16-bit, mono PCM
    const wavBuffer = pcmToWav(pcmData, 24000, 1, 16);
    return wavBuffer;

  } catch (error: any) {
    console.error('Error generating multi-speaker audio:', error);
    throw error;
  }
};
