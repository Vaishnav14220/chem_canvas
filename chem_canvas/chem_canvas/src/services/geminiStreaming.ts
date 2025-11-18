import { GoogleGenAI } from '@google/genai';
import { assignRandomApiKey, initializeApiKeys, checkApiKeysInitialized } from '../firebase/apiKeys';

// Initialize Gemini AI instance
let genAI: GoogleGenAI | null = null;
let isInitialized = false;
let cachedModelName: string | null = null;

// Helper function to get the best available model
const getAvailableModel = async (): Promise<string> => {
  // Return cached model if available
  if (cachedModelName) {
    return cachedModelName;
  }

  const models = ['gemini-2.5-flash', 'gemini-flash-latest'];
  
  for (const modelName of models) {
    try {
      console.log(`Testing streaming model: ${modelName}`);
      if (!genAI) throw new Error('GenAI not initialized');
      
      // Try a simple test
      const response = await genAI.models.generateContent({
        model: modelName,
        contents: [{ role: 'user', parts: [{ text: 'test' }] }],
      });
      
      if (response) {
        console.log(`✅ Using streaming model: ${modelName}`);
        cachedModelName = modelName;
        return modelName;
      }
    } catch (error: any) {
      console.warn(`❌ Streaming model ${modelName} not available:`, error.message);
      continue;
    }
  }
  
  // Fallback to default if nothing works
  console.warn('⚠️ No model test succeeded, using fallback: gemini-flash-latest');
  cachedModelName = 'gemini-flash-latest';
  return 'gemini-flash-latest';
};

// Initialize the Gemini AI service
export const initializeGeminiStreaming = async (): Promise<void> => {
  try {
    // Check if API keys are initialized in Firebase
    const keysInitialized = await checkApiKeysInitialized();
    
    if (!keysInitialized) {
      console.log('Initializing API keys in Firebase...');
      await initializeApiKeys();
    }

    // Get a random API key from Firebase
    const apiKey = await assignRandomApiKey();
    
    if (!apiKey) {
      throw new Error('No API key available');
    }

    // Initialize the GoogleGenAI instance
    genAI = new GoogleGenAI({
      apiKey: apiKey,
    });

    cachedModelName = null; // Reset cache when reinitializing
    isInitialized = true;
    console.log('✅ Gemini Streaming API initialized successfully!');
  } catch (error) {
    console.error('❌ Failed to initialize Gemini Streaming API:', error);
    throw error;
  }
};

// Check if the service is initialized
export const isGeminiStreamingInitialized = (): boolean => {
  return isInitialized && genAI !== null;
};

// Generate streaming content using Gemini 2.5 Flash
export const generateStreamingContent = async (
  prompt: string,
  onChunk?: (chunk: string) => void,
  onComplete?: (fullResponse: string) => void,
  onError?: (error: Error) => void
): Promise<string> => {
  if (!genAI || !isInitialized) {
    const error = new Error('Gemini Streaming API not initialized');
    onError?.(error);
    throw error;
  }

  try {
    // Add markdown formatting instructions to the prompt
    const formattedPrompt = `${prompt}

Please format your response using proper markdown:
- Use # for main titles, ## for sections, ### for subsections
- Use **bold** for important terms, *italic* for emphasis
- Use bullet points (- or *) for lists
- Use numbered lists (1. 2. 3.) for steps
- Use \`code\` for formulas and technical terms
- Use > for blockquotes when citing sources
- Use tables when comparing data
- Structure your response clearly with headers and proper formatting`;

    const config = {
      thinkingConfig: {
        thinkingBudget: -1,
      },
    };

    const model = await getAvailableModel();
    const contents = [
      {
        role: 'user' as const,
        parts: [
          {
            text: formattedPrompt,
          },
        ],
      },
    ];

    const response = await genAI.models.generateContentStream({
      model,
      config,
      contents,
    });

    let fullResponse = '';
    
    for await (const chunk of response) {
      const chunkText = chunk.text || '';
      fullResponse += chunkText;
      onChunk?.(chunkText);
    }

    onComplete?.(fullResponse);
    return fullResponse;
  } catch (error: any) {
    const errorMessage = `AI Error: ${error.message || 'Failed to get response from AI'}`;
    const aiError = new Error(errorMessage);
    onError?.(aiError);
    throw aiError;
  }
};

// Generate streaming content with chemistry-specific context
export const generateChemistryStreamingContent = async (
  prompt: string,
  canvasImageData?: string,
  documentContent?: string,
  documentName?: string,
  onChunk?: (chunk: string) => void,
  onComplete?: (fullResponse: string) => void,
  onError?: (error: Error) => void
): Promise<string> => {
  if (!genAI || !isInitialized) {
    const error = new Error('Gemini Streaming API not initialized');
    onError?.(error);
    throw error;
  }

  try {
    let fullPrompt = `You are a helpful chemistry assistant for students. The student is working on a chemistry canvas where they can draw molecules, write equations, and take notes.

Student's question: ${prompt}`;

    // Add document context if available
    if (documentContent && documentContent.trim()) {
      fullPrompt += `\n\n📄 **REFERENCE DOCUMENT: "${documentName}"**\n${documentContent.substring(0, 8000)}\n`;
      fullPrompt += `\n**CITATION INSTRUCTIONS:**
- When answering from the document, ALWAYS cite the page number like this: 📄 (Page X)
- Quote directly when relevant
- If information spans multiple pages, cite all relevant pages
- Make it easy for the student to find the information in their document\n`;
    }

    fullPrompt += `\nIMPORTANT MARKDOWN FORMATTING RULES:
1. Use proper markdown headers:
   - # Main Title
   - ## Section Headers
   - ### Subsection Headers

2. Use LaTeX notation for mathematical expressions:
   - Inline math: $expression$ (e.g., $E = mc^2$)
   - Block math: $$expression$$ (e.g., $$\\Delta H = \\sum H_{products} - \\sum H_{reactants}$$)

3. For chemical formulas, write them normally (they will be auto-formatted):
   - Examples: H2O, CO2, CH4, NaCl
   - For states: H2O(l), CO2(g), NaCl(aq), Fe(s)

4. For chemical equations, use the arrow (→ or ->):
   - Example: 2H2 + O2 → 2H2O
   - Example: CH4 + 2O2 → CO2 + 2H2O

5. Use proper markdown formatting:
   - **Bold** for important concepts and key terms
   - *Italic* for emphasis and definitions
   - \`code\` for specific terms, units, or formulas
   - Use bullet points with - or * for lists
   - Use numbered lists with 1. 2. 3. etc.
   - Use > for blockquotes when citing sources

6. Structure your response with clear sections:
   - Start with a brief introduction
   - Use ## headers for main topics
   - Use ### headers for subtopics
   - Include examples in separate sections
   - End with a summary or key takeaways

7. Common chemistry LaTeX expressions:
   - Equilibrium: $K_{eq} = \\frac{[products]}{[reactants]}$
   - pH: $pH = -\\log[H^+]$ 
   - Enthalpy: $\\Delta H$, Entropy: $\\Delta S$, Gibbs: $\\Delta G$
   - Reaction rate: $rate = k[A]^m[B]^n$

8. Always format your response in proper markdown with clear structure, headers, and formatting that makes it easy to read and understand. Use tables when appropriate for data comparison.

Provide a clear, educational response with proper markdown formatting that helps them understand the chemistry concepts. If they're asking about something drawn on the canvas, reference the visual elements in your explanation.`;

    const config = {
      thinkingConfig: {
        thinkingBudget: -1,
      },
    };

    const model = await getAvailableModel();
    const contents: any[] = [
      {
        role: 'user' as const,
        parts: [
          {
            text: fullPrompt,
          },
        ],
      },
    ];

    // Add image data if available
    if (canvasImageData) {
      contents[0].parts.push({
        inlineData: {
          data: canvasImageData.split(',')[1],
          mimeType: 'image/png'
        }
      });
    }

    const response = await genAI.models.generateContentStream({
      model,
      config,
      contents,
    });

    let fullResponse = '';
    
    for await (const chunk of response) {
      const chunkText = chunk.text || '';
      fullResponse += chunkText;
      onChunk?.(chunkText);
    }

    onComplete?.(fullResponse);
    return fullResponse;
  } catch (error: any) {
    if (error.message?.includes('API_KEY_INVALID') || error.message?.includes('API key')) {
      const aiError = new Error('Invalid API key. Please check your Google Gemini API key.');
      onError?.(aiError);
      throw aiError;
    }
    const errorMessage = `AI Error: ${error.message || 'Failed to get response from AI'}`;
    const aiError = new Error(errorMessage);
    onError?.(aiError);
    throw aiError;
  }
};

// Initialize the service when the module loads
initializeGeminiStreaming().catch(error => {
  console.error('Failed to auto-initialize Gemini Streaming:', error);
});
