/**
 * Simulation Service - Handles AI-powered document analysis, concept extraction,
 * and dynamic simulation generation using Gemini API with structured output
 */

import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { apiKeyRotation, executeWithRotation } from './apiKeyRotation';
import type {
  ExtractedConcept,
  Formula,
  Definition,
  SimulationSuggestion,
  SimulationSchema,
  DocumentAnalysisResult,
  InputParameter,
  OutputParameter,
  SimulationLogic,
} from '../types/simulation';

let genAI: GoogleGenerativeAI | null = null;
let cachedModelName: string | null = null;
let currentApiKey: string | null = null;

/**
 * Initialize the Gemini API
 */
export const initializeSimulationService = (apiKey?: string): void => {
  const keyToUse = apiKey || apiKeyRotation.getNextKey();
  if (!keyToUse) {
    throw new Error('No API key available');
  }
  
  genAI = new GoogleGenerativeAI(keyToUse);
  currentApiKey = keyToUse;
  cachedModelName = null; // Reset cache when API key changes
};

// Auto-initialize on first use
const ensureInitialized = () => {
  if (!genAI) {
    initializeSimulationService();
  }
};

/**
 * Helper function to get the best available model with fallback
 */
const getAvailableModel = async (genAI: GoogleGenerativeAI): Promise<string> => {
  // Return cached model if available
  if (cachedModelName) {
    return cachedModelName;
  }

  // Try models in order of preference
  const models = ['gemini-2.5-flash', 'gemini-flash-latest'];
  
  return executeWithRotation(async (apiKey) => {
    // Reinitialize with new key if needed
    if (apiKey !== currentApiKey) {
      genAI = new GoogleGenerativeAI(apiKey);
      currentApiKey = apiKey;
    }
    
    for (const modelName of models) {
      try {
        console.log(`Testing model: ${modelName}`);
        const model = genAI.getGenerativeModel({ model: modelName });
        const testResult = await model.generateContent('test');
        await testResult.response;
        console.log(`✅ Using model: ${modelName}`);
        cachedModelName = modelName;
        return modelName;
      } catch (error: any) {
        console.warn(`❌ Model ${modelName} not available:`, error.message);
        if (models.indexOf(modelName) === models.length - 1) {
          throw error;
        }
        continue;
      }
    }
    
    throw new Error('No working Gemini model found');
  });
};

/**
 * Stage 1: AI-Powered Document Analysis
 * Extracts key topics, formulas, and definitions from document content
 */
export const analyzeDocumentForConcepts = async (
  documentContent: string,
  documentName: string
): Promise<ExtractedConcept> => {
  ensureInitialized();
  if (!genAI) {
    throw new Error('Simulation service not initialized. Please provide an API key.');
  }

  return executeWithRotation(async (apiKey) => {
    // Reinitialize with new key if rate limit hit
    if (apiKey !== currentApiKey) {
      genAI = new GoogleGenerativeAI(apiKey);
      currentApiKey = apiKey;
      cachedModelName = null;
    }
    
    const modelName = await getAvailableModel(genAI!);
    const model = genAI!.getGenerativeModel({
      model: modelName,
      generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          keyTopics: {
            type: SchemaType.ARRAY,
            items: { type: SchemaType.STRING },
            description: 'List of main topics covered in the document',
          },
          coreFormulas: {
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.OBJECT,
              properties: {
                id: { type: SchemaType.STRING },
                latex: { type: SchemaType.STRING },
                description: { type: SchemaType.STRING },
                variables: {
                  type: SchemaType.ARRAY,
                  items: {
                    type: SchemaType.OBJECT,
                    properties: {
                      symbol: { type: SchemaType.STRING },
                      name: { type: SchemaType.STRING },
                      unit: { type: SchemaType.STRING },
                      description: { type: SchemaType.STRING },
                    },
                    required: ['symbol', 'name'],
                  },
                },
              },
              required: ['id', 'latex', 'description', 'variables'],
            },
          },
          keyDefinitions: {
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.OBJECT,
              properties: {
                term: { type: SchemaType.STRING },
                definition: { type: SchemaType.STRING },
                relatedFormulas: {
                  type: SchemaType.ARRAY,
                  items: { type: SchemaType.STRING },
                },
              },
              required: ['term', 'definition'],
            },
          },
        },
        required: ['keyTopics', 'coreFormulas', 'keyDefinitions'],
      },
    },
  });

  const prompt = `Analyze the following document and extract key conceptual information:

Document Name: ${documentName}
Content:
${documentContent}

Please extract:
1. Key Topics - Main subjects, concepts, or theories discussed
2. Core Formulas - Mathematical equations with LaTeX format, variable descriptions, and units
3. Key Definitions - Important terms and their explanations

Provide comprehensive extraction suitable for creating interactive educational simulations.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    return JSON.parse(text) as ExtractedConcept;
  });
};

/**
 * Stage 2: Context-Aware Simulation Suggestion
 * Analyzes extracted concepts and suggests relevant interactive simulations
 */
export const suggestSimulations = async (
  extractedConcepts: ExtractedConcept
): Promise<SimulationSuggestion[]> => {
  if (!genAI) {
    throw new Error('Simulation service not initialized. Please provide an API key.');
  }

  const modelName = await getAvailableModel(genAI);
  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          simulations: {
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.OBJECT,
              properties: {
                id: { type: SchemaType.STRING },
                title: { type: SchemaType.STRING },
                description: { type: SchemaType.STRING },
                domain: { type: SchemaType.STRING },
                relatedFormulas: {
                  type: SchemaType.ARRAY,
                  items: { type: SchemaType.STRING },
                },
                relatedTopics: {
                  type: SchemaType.ARRAY,
                  items: { type: SchemaType.STRING },
                },
                complexity: {
                  type: SchemaType.STRING,
                  format: 'enum',
                  enum: ['basic', 'intermediate', 'advanced'],
                },
                estimatedBuildTime: { type: SchemaType.STRING },
              },
              required: [
                'id',
                'title',
                'description',
                'domain',
                'relatedFormulas',
                'relatedTopics',
                'complexity',
              ],
            },
          },
        },
        required: ['simulations'],
      },
    },
  });

  const formulasText = extractedConcepts.coreFormulas
    .map((f) => `- ${f.description}: ${f.latex}`)
    .join('\n');

  const topicsText = extractedConcepts.keyTopics.join(', ');

  const prompt = `Based on the following extracted concepts, suggest interactive simulations that would help students learn:

Topics: ${topicsText}

Formulas:
${formulasText}

Definitions: ${extractedConcepts.keyDefinitions.map((d) => d.term).join(', ')}

Suggest 3-7 relevant, interactive simulations that can be built from these concepts.
Each simulation should be:
- Domain-agnostic and applicable across physics, chemistry, biology, finance, etc.
- Educational and interactive with clear learning objectives
- Based on the extracted formulas and concepts
- Practical and implementable with input controls (sliders, knobs, switches) and outputs

For each simulation, determine:
- A clear, descriptive title
- The domain (physics, chemistry, biology, finance, etc.)
- Which formulas and topics it uses
- Complexity level (basic, intermediate, or advanced)
- Estimated build time (e.g., "5 minutes", "10 minutes")`;

  const result = await model.generateContent(prompt);
  const response = await result.response;
  const text = response.text();
  const parsed = JSON.parse(text);

  return parsed.simulations as SimulationSuggestion[];
};

/**
 * Stage 3: Dynamic Simulation Configuration
 * Uses Gemini structured output to create a complete simulation schema
 */
export const generateSimulationSchema = async (
  suggestion: SimulationSuggestion,
  extractedConcepts: ExtractedConcept
): Promise<SimulationSchema> => {
  if (!genAI) {
    throw new Error('Simulation service not initialized. Please provide an API key.');
  }

  const modelName = await getAvailableModel(genAI);
  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          id: { type: SchemaType.STRING },
          title: { type: SchemaType.STRING },
          description: { type: SchemaType.STRING },
          inputs: {
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.OBJECT,
              properties: {
                id: { type: SchemaType.STRING },
                name: { type: SchemaType.STRING },
                type: {
                  type: SchemaType.STRING,
                  format: 'enum',
                  enum: ['number', 'boolean', 'select', 'range'],
                },
                label: { type: SchemaType.STRING },
                description: { type: SchemaType.STRING },
                defaultValue: { type: SchemaType.STRING },
                unit: { type: SchemaType.STRING },
                min: { type: SchemaType.NUMBER },
                max: { type: SchemaType.NUMBER },
                step: { type: SchemaType.NUMBER },
                options: {
                  type: SchemaType.ARRAY,
                  items: {
                    type: SchemaType.OBJECT,
                    properties: {
                      value: { type: SchemaType.STRING },
                      label: { type: SchemaType.STRING },
                    },
                    required: ['value', 'label'],
                  },
                },
                controlType: {
                  type: SchemaType.STRING,
                  format: 'enum',
                  enum: ['slider', 'knob', 'switch', 'toggle', 'numberField', 'dropdown'],
                },
              },
              required: ['id', 'name', 'type', 'label', 'defaultValue', 'controlType'],
            },
          },
          outputs: {
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.OBJECT,
              properties: {
                id: { type: SchemaType.STRING },
                name: { type: SchemaType.STRING },
                type: {
                  type: SchemaType.STRING,
                  format: 'enum',
                  enum: ['number', 'string', 'boolean', 'array'],
                },
                label: { type: SchemaType.STRING },
                description: { type: SchemaType.STRING },
                unit: { type: SchemaType.STRING },
                format: {
                  type: SchemaType.STRING,
                  format: 'enum',
                  enum: ['decimal', 'scientific', 'percentage', 'currency'],
                },
                precision: { type: SchemaType.NUMBER },
              },
              required: ['id', 'name', 'type', 'label'],
            },
          },
          logic: {
            type: SchemaType.OBJECT,
            properties: {
              formulaId: { type: SchemaType.STRING },
              equation: { type: SchemaType.STRING },
              implementation: { type: SchemaType.STRING },
              explanation: { type: SchemaType.STRING },
            },
            required: ['implementation', 'explanation'],
          },
          metadata: {
            type: SchemaType.OBJECT,
            properties: {
              domain: { type: SchemaType.STRING },
              difficulty: {
                type: SchemaType.STRING,
                format: 'enum',
                enum: ['beginner', 'intermediate', 'advanced'],
              },
              tags: {
                type: SchemaType.ARRAY,
                items: { type: SchemaType.STRING },
              },
            },
            required: ['domain', 'difficulty', 'tags'],
          },
        },
        required: ['id', 'title', 'description', 'inputs', 'outputs', 'logic', 'metadata'],
      },
    },
  });

  const relatedFormulas = extractedConcepts.coreFormulas.filter((f) =>
    suggestion.relatedFormulas.includes(f.id)
  );

  const formulasText = relatedFormulas
    .map(
      (f) =>
        `Formula: ${f.description}\nLaTeX: ${f.latex}\nVariables: ${f.variables
          .map((v) => `${v.symbol} (${v.name}${v.unit ? ', ' + v.unit : ''})`)
          .join(', ')}`
    )
    .join('\n\n');

  const prompt = `Create a complete interactive simulation schema for: "${suggestion.title}"

Description: ${suggestion.description}
Domain: ${suggestion.domain}
Complexity: ${suggestion.complexity}

Related Formulas:
${formulasText}

Create a simulation schema with:

1. **Input Parameters**: Define user-controllable inputs with appropriate controls:
   - Use 'slider' or 'knob' for continuous numeric values
   - Use 'switch' or 'toggle' for boolean on/off states
   - Use 'numberField' for precise numeric input
   - Use 'dropdown' for categorical choices (MUST include an 'options' array with {value, label} objects)
   - For dropdowns: set type='select' and provide options array like: [{"value": "option1", "label": "Option 1"}, {"value": "option2", "label": "Option 2"}]
   - Specify realistic min, max, step values and units

2. **Output Parameters**: Define calculated outputs:
   - Specify appropriate formatting (decimal, scientific, percentage, currency)
   - Include units and precision
   - Add helpful descriptions

3. **Logic Implementation**: CRITICAL - Provide JavaScript code as a STRING:
   - The code should access inputs using: inputs.inputId (e.g., inputs.voltage, inputs.resistance)
   - Calculate the outputs using the formula
   - Return an object with output IDs as keys: { outputId1: calculatedValue1, outputId2: calculatedValue2 }
   - Do NOT include "function(inputs) {" wrapper or closing "}"
   - Do NOT include ANY COMMENTS (no // or /* */ comments)
   - Just provide clean, executable code body as a string
   - Use const for calculations and return an object at the end
   - Write all code on separate lines for clarity

4. **Metadata**: Include domain, difficulty, and relevant tags

EXAMPLE of correct implementation string:
"const current = inputs.voltage / inputs.resistance;
const power = inputs.voltage * current;
return { current: current, power: power };"

INCORRECT examples (DO NOT DO THIS):
- "const coeff = 0.0045; // temperature coefficient" (has a comment - WRONG!)
- "function(inputs) { const x = inputs.y; return {x}; }" (has function wrapper - WRONG!)

Make the simulation interactive, educational, and accurate to the underlying concepts.`;

  const result = await model.generateContent(prompt);
  const response = await result.response;
  const text = response.text();
  const parsed = JSON.parse(text);

  // Parse defaultValue from string to appropriate type
  parsed.inputs = parsed.inputs.map((input: any) => ({
    ...input,
    defaultValue:
      input.type === 'number'
        ? parseFloat(input.defaultValue)
        : input.type === 'boolean'
        ? input.defaultValue === 'true'
        : input.defaultValue,
  }));

  return parsed as SimulationSchema;
};

/**
 * Execute a simulation with given input values
 */
export const executeSimulation = (
  schema: SimulationSchema,
  inputValues: { [key: string]: any }
): { [key: string]: any } => {
  try {
    let implementation = schema.logic.implementation.trim();
    
    // Remove comments that might break the code
    implementation = implementation
      // Remove single-line comments
      .split('\n')
      .map(line => {
        const commentIndex = line.indexOf('//');
        if (commentIndex !== -1) {
          // Keep the code before the comment
          return line.substring(0, commentIndex).trim();
        }
        return line;
      })
      .filter(line => line.length > 0)
      .join('\n');
    
    // Remove any function declaration wrapper if present
    implementation = implementation
      .replace(/^function\s*\([^)]*\)\s*\{/, '')
      .replace(/\}$/, '')
      .trim();
    
    // If it doesn't have a return statement, wrap it
    if (!implementation.includes('return')) {
      implementation = `return ${implementation}`;
    }
    
    console.log('Cleaned implementation:', implementation);
    
    // Create a safe execution context
    const func = new Function('inputs', implementation);

    // Execute the simulation logic
    const result = func(inputValues);
    
    // Validate result
    if (!result || typeof result !== 'object') {
      throw new Error('Simulation must return an object with output values');
    }

    return result;
  } catch (error) {
    console.error('Error executing simulation:', error);
    console.error('Original implementation code:', schema.logic.implementation);
    console.error('Input values:', inputValues);
    throw new Error('Failed to execute simulation: ' + (error as Error).message);
  }
};

/**
 * Complete workflow: Analyze document and generate simulation suggestions
 */
export const analyzeDocumentAndSuggestSimulations = async (
  documentContent: string,
  documentName: string,
  documentId: string
): Promise<DocumentAnalysisResult> => {
  // Stage 1: Extract concepts
  const extractedConcepts = await analyzeDocumentForConcepts(documentContent, documentName);

  // Stage 2: Suggest simulations
  const suggestedSimulations = await suggestSimulations(extractedConcepts);

  return {
    documentId,
    extractedConcepts,
    suggestedSimulations,
    analysisTimestamp: new Date(),
    confidence: 0.85, // This could be calculated based on extraction quality
  };
};
