// @ts-nocheck
import { GoogleGenAI, Type } from '@google/genai';
import { AspectRatio, ImageSize, InteractiveLabel, EducationalSchema } from '../types/studium';
import { fetchCanonicalSmiles } from './pubchemService';
import { setStructuredReactionApiKey } from './structuredReactionService';
import { apiKeyRotation, clearUserProvidedApiKey, executeWithRotation, registerUserProvidedApiKey } from './apiKeyRotation';
import { captureApiEvent, captureApiKey } from '../utils/errorLogger';
import { getSharedGeminiApiKey } from '../firebase/apiKeys';
import {
  initializeVertexAI,
  generateContentWithVertexAI,
  streamContentWithVertexAI,
  isVertexAIAvailable
} from './vertexAiService';

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

export const isGeminiInitialized = () => {
  return genAI !== null;
};

const MODEL_CANDIDATES = ['gemini-2.5-flash', 'gemini-flash-latest'];

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

export const generateTextContent = async (prompt: string): Promise<string> => {
  ensureInitialized();
  if (!genAI) {
    throw new Error('Gemini API not initialized. Please provide an API key.');
  }

  // Internal retry for 503 errors with exponential backoff
  const maxRetries = 5;
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

        const modelName = await getAvailableModel(genAI!, { skipRotation: true });
        const response = await genAI!.models.generateContent({
          model: modelName,
          contents: prompt,
        });
        return response.text ?? '';
      });
    } catch (error: any) {
      lastError = error;
      const errorMessage = error?.message?.toLowerCase() || '';
      const errorCode = error?.error?.code || error?.code;
      const is503 = errorCode === 503 || errorMessage.includes('503') ||
        errorMessage.includes('overloaded') || errorMessage.includes('unavailable');

      if (is503 && retry < maxRetries - 1) {
        // Exponential backoff with jitter
        const delay = Math.min(2000 * Math.pow(2, retry) + Math.random() * 1000, 30000);
        console.log(`⏳ API overloaded (attempt ${retry + 1}/${maxRetries}). Waiting ${Math.round(delay / 1000)}s before retry...`);
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

      // Re-throw error if it's not a 503/overloaded error
      throw error;
    }
  }

  throw lastError ?? new Error('All retry attempts failed');
};

// Convenience wrapper used by UI helpers like the document editor.
// Guarantees a trimmed string and isolates UI imports from the heavier service API.
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const isRetryableGeminiError = (error: any) => {
  const status = error?.error?.status ?? error?.status;
  const code = Number(error?.error?.code ?? error?.code);
  const message = error?.error?.message ?? error?.message ?? '';
  const retryableStatuses = ['UNAVAILABLE', 'RESOURCE_EXHAUSTED', 'INTERNAL', 'DEADLINE_EXCEEDED'];
  const retryableCodes = [429, 500, 502, 503, 504];
  if (retryableCodes.includes(code)) return true;
  if (typeof status === 'string' && retryableStatuses.includes(status)) return true;
  if (typeof message === 'string' && /overloaded|try again|unavailable|rate/i.test(message)) return true;
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
  options?: { model?: string }
): Promise<string> => {
  ensureInitialized();
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

      const modelName = options?.model ?? (await getAvailableModel(genAI!, { skipRotation: true }));
      const stream = await genAI!.models.generateContentStream({
        model: modelName,
        contents: prompt,
      });

      let fullText = '';

      for await (const chunk of stream) {
        const text = chunk.text ?? '';
        if (!text) continue;
        fullText += text;
        onChunk(text);
      }

      return fullText;
    });
  } catch (error: any) {
    // Check if error is a 503 (model overloaded) and Vertex AI is available
    const errorMessage = error?.message?.toLowerCase() || '';
    if ((errorMessage.includes('503') || errorMessage.includes('overloaded') || errorMessage.includes('unavailable'))
      && !errorMessage.includes('vertex')) {

      console.log('⚠️ Gemini API streaming overloaded, attempting to use Vertex AI fallback...');

      // Try to initialize Vertex AI if not already done
      if (!isVertexAIAvailable()) {
        const vertexInitialized = await initializeVertexAI();
        if (!vertexInitialized) {
          console.warn('❌ Vertex AI fallback not available for streaming');
          throw error; // Re-throw original error if Vertex AI is not available
        }
      }

      try {
        // Use Vertex AI streaming as fallback
        const result = await streamContentWithVertexAI(prompt, onChunk);
        console.log('✅ Successfully used Vertex AI streaming fallback');
        return result;
      } catch (vertexError) {
        console.error('❌ Vertex AI streaming fallback also failed:', vertexError);
        throw error; // Throw original error if both fail
      }
    }

    // Re-throw error if it's not a 503/overloaded error
    throw error;
  }
};

export const extractJsonBlock = (rawText: string): string => {
  const trimmed = rawText.trim();
  const fenceMatch = trimmed.match(/```(?:json)?([\s\S]*?)```/i);
  if (fenceMatch) {
    return fenceMatch[1].trim();
  }

  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return jsonMatch[0];
  }

  return trimmed;
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

/**
 * Generates a high-quality educational image using Nano Banana Pro (Gemini 3 Pro Image Preview).
 */
export const generateEducationalImage = async (
  topic: string,
  aspectRatio: AspectRatio,
  imageSize: ImageSize
): Promise<string> => {
  ensureInitialized();
  if (!genAI) {
    throw new Error('Gemini API not initialized. Please provide an API key.');
  }

  const prompt = `Create a highly detailed educational diagram of: ${topic}. 
  CRITICAL: The image MUST have clear, legible text labels pointing to the important parts of the subject. 
  The style should be clean, textbook-quality illustration suitable for students. 
  Make it colorful and engaging.`;

  try {
    return await executeWithRotation(async (apiKey) => {
      // Reinitialize with new key if needed
      if (apiKey !== currentApiKey) {
        genAI = new GoogleGenAI({ apiKey });
        currentApiKey = apiKey;
        cachedModelName = null;
      }

      const response = await genAI!.models.generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: {
          parts: [{ text: prompt }],
        },
        config: {
          imageConfig: {
            aspectRatio: aspectRatio,
            imageSize: imageSize,
          },
        },
      });

      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          return `data:image/png;base64,${part.inlineData.data}`;
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
 * Analyzes an image to extract educational content from labels using Gemini 3 Pro.
 */
export const analyzeImageForLearning = async (base64Image: string): Promise<InteractiveLabel[]> => {
  ensureInitialized();
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
              text: "Analyze this educational diagram. Identify all the text labels present in the image. For each label found, provide a simple definition suitable for a student and a fun fact. Return the result as a JSON object."
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
  ensureInitialized();
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
 * General image analysis for uploaded photos.
 */
export const analyzeUploadedImage = async (file: File, prompt: string): Promise<string> => {
  ensureInitialized();
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
