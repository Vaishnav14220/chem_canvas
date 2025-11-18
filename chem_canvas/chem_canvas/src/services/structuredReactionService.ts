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

  const config: any = {
    thinkingConfig: {
      thinkingBudget: -1,
    },
    imageConfig: {
      imageSize: '1K',
    },
    responseMimeType: 'application/json',
    responseSchema: {
      type: Type.OBJECT,
      required: ["reaction name ", "reaction smiles", "condition", "reactants", "products", "reaction smiles with conditions", "Reaction Description"],
      properties: {
        "reaction name ": {
          type: Type.STRING,
        },
        "reaction smiles": {
          type: Type.STRING,
        },
        condition: {
          type: Type.ARRAY,
          items: {
            type: Type.STRING,
          },
        },
        reactants: {
          type: Type.ARRAY,
          items: {
            type: Type.STRING,
          },
        },
        products: {
          type: Type.ARRAY,
          items: {
            type: Type.STRING,
          },
        },
        "reaction smiles with conditions": {
          type: Type.STRING,
        },
        "Reaction Description": {
          type: Type.STRING,
        },
      },
    },
  };

  const model = 'gemini-2.5-flash';
  const contents = [
    {
      role: 'user',
      parts: [
        {
          text: prompt,
        },
      ],
    },
  ];

  try {
    console.log(`🔄 Fetching structured reaction with ${model}...`);
    
    const response = await ai.models.generateContentStream({
      model,
      config,
      contents,
    });

    // Collect all chunks from the stream
    let fullText = '';
    for await (const chunk of response) {
      const chunkText = chunk.text || '';
      fullText += chunkText;
      console.log(chunkText); // Log each chunk as it arrives
    }

    if (!fullText || !fullText.trim()) {
      throw new Error('Structured Gemini response did not include JSON payload.');
    }

    // Parse the accumulated JSON
    const parsed = JSON.parse(fullText.trim()) as StructuredReactionPayload;
    console.log(`✅ Successfully fetched reaction data using ${model}`);
    console.log('📦 Reaction SMILES:', parsed['reaction smiles']); // Log the SMILES we're getting
    return parsed;
    
  } catch (error: any) {
    console.error(`❌ Failed to fetch structured reaction with ${model}:`, error);
    throw error instanceof Error ? error : new Error(String(error));
  }
};

const storedKey = loadStoredApiKey();
if (storedKey) {
  try {
    setStructuredReactionApiKey(storedKey);
  } catch (error) {
    console.warn('Failed to initialise structured reaction service with stored key:', error);
  }
}
