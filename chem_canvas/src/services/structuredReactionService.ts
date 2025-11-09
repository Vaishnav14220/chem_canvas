import { GoogleGenAI, Type } from '@google/genai';

export type StructuredReactionPayload = {
  "reaction name "?: string;
  "reaction smiles"?: string;
  condition?: string[];
  reactants?: string[];
  products?: string[];
  "reaction smiles with conditions"?: string;
  "Reaction Description"?: string;
};

let client: GoogleGenAI | null = null;
let activeApiKey: string | null = null;

const LOCAL_STORAGE_KEYS = ['gemini_api_key', 'gemini-api-key'];

const loadStoredApiKey = (): string | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  for (const key of LOCAL_STORAGE_KEYS) {
    const value = window.localStorage.getItem(key);
    if (value && value.trim()) {
      return value.trim();
    }
  }

  return null;
};

const ensureClient = (): GoogleGenAI => {
  if (!activeApiKey) {
    const stored = loadStoredApiKey();
    if (stored) {
      activeApiKey = stored;
    } else {
      throw new Error('Gemini API key not configured for structured reactions.');
    }
  }

  if (!client) {
    client = new GoogleGenAI({ apiKey: activeApiKey });
  }

  return client;
};

export const setStructuredReactionApiKey = (apiKey: string): void => {
  activeApiKey = apiKey.trim();
  client = new GoogleGenAI({ apiKey: activeApiKey });
};

const reactionSchema = {
  type: Type.OBJECT,
  required: [
    'reaction name ',
    'reaction smiles',
    'condition',
    'reactants',
    'products',
    'reaction smiles with conditions',
    'Reaction Description'
  ],
  properties: {
    'reaction name ': {
      type: Type.STRING
    },
    'reaction smiles': {
      type: Type.STRING
    },
    condition: {
      type: Type.ARRAY,
      items: {
        type: Type.STRING
      }
    },
    reactants: {
      type: Type.ARRAY,
      items: {
        type: Type.STRING
      }
    },
    products: {
      type: Type.ARRAY,
      items: {
        type: Type.STRING
      }
    },
    'reaction smiles with conditions': {
      type: Type.STRING
    },
    'Reaction Description': {
      type: Type.STRING
    }
  }
} as const;

const buildPrompt = (input: string, mode: 'description' | 'name'): string => {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error('Provide a reaction prompt to request structured output.');
  }

  if (mode === 'name') {
    return `Provide the canonical structured summary for the named reaction "${trimmed}". Include typical reactants, conditions, and products.`;
  }

  return `Resolve the following reaction request into structured data with SMILES and conditions: ${trimmed}`;
};

export const fetchStructuredReaction = async (
  input: string,
  options: { mode: 'description' | 'name' }
): Promise<StructuredReactionPayload> => {
  const ai = ensureClient();
  const prompt = buildPrompt(input, options.mode);

  // List of models to try in order (primary -> fallback)
  const modelsToTry = [
    { name: 'gemini-2.5-pro', supportsThinking: true },
    { name: 'gemini-2.0-flash-exp', supportsThinking: false }
  ];
  
  let lastError: Error | null = null;

  for (const model of modelsToTry) {
    try {
      console.log(`🔄 Attempting structured reaction search with model: ${model.name}`);
      
      // Build config based on model capabilities
      const config: any = {
        responseMimeType: 'application/json',
        responseSchema: reactionSchema
      };
      
      // Only add thinkingConfig if model supports it
      if (model.supportsThinking) {
        config.thinkingConfig = {
          thinkingBudget: -1
        };
      }
      
      // Use generateContentStream as per the official SDK example
      const response = await ai.models.generateContentStream({
        model: model.name,
        config,
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: prompt
              }
            ]
          }
        ]
      });

      // Collect all chunks from the stream
      let fullText = '';
      for await (const chunk of response) {
        // Access text property directly (it's a getter, not a function)
        const chunkText = chunk.text || '';
        fullText += chunkText;
      }

      if (!fullText || !fullText.trim()) {
        throw new Error('Structured Gemini response did not include JSON payload.');
      }

      // Parse the accumulated JSON
      const parsed = JSON.parse(fullText.trim()) as StructuredReactionPayload;
      console.log(`✅ Successfully fetched reaction data using ${model.name}`);
      return parsed;
      
    } catch (error: any) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Check if it's a 503 overload error or 400 invalid argument (thinking not supported)
      const errorMessage = error?.message || JSON.stringify(error);
      const isRetryable = errorMessage.includes('503') || 
                          errorMessage.includes('overloaded') || 
                          errorMessage.includes('UNAVAILABLE') ||
                          errorMessage.includes('400') ||
                          errorMessage.includes('INVALID_ARGUMENT') ||
                          errorMessage.includes('thinking is not supported');
      
      const isLastModel = model.name === modelsToTry[modelsToTry.length - 1].name;
      
      if (isRetryable && !isLastModel) {
        console.warn(`⚠️ Model ${model.name} error, trying fallback model...`);
        continue; // Try next model
      }
      
      // If not retryable or last model, throw the error
      console.error(`❌ Failed to fetch structured reaction with ${model.name}:`, error);
      throw lastError;
    }
  }

  // If we've exhausted all models
  throw lastError || new Error('All Gemini models failed to provide structured reaction data.');
};

const storedKey = loadStoredApiKey();
if (storedKey) {
  try {
    setStructuredReactionApiKey(storedKey);
  } catch (error) {
    console.warn('Failed to initialise structured reaction service with stored key:', error);
  }
}
