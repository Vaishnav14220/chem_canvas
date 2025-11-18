// @ts-nocheck
/**
 * Gemini AI Service for Chemistry Analysis
 * Uses structured output to analyze chemical reactions and compounds
 */

import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { executeWithRotation } from './apiKeyRotation';

export interface ReactionAnalysis {
  reaction_name: string;
  reaction_smiles: string;
  condition: string[];
  reactants: string[];
  products: string[];
  reaction_smiles_with_conditions: string;
  reaction_description: string;
}

export interface CompoundAnalysis {
  compound_name: string;
  molecular_formula: string;
  iupac_name: string;
  smiles: string;
  functional_groups: string[];
  properties: {
    molecular_weight?: number;
    boiling_point?: string;
    melting_point?: string;
    solubility?: string;
  };
  hazards: string[];
  uses: string[];
  synthesis_routes: string[];
}

export interface SimulationParameters {
  compound_name: string;
  simulation_type: 'thermodynamic' | 'kinetic' | 'spectroscopic' | 'molecular_dynamics';
  parameters: {
    temperature_range?: [number, number];
    pressure?: number;
    phase?: 'gas' | 'liquid' | 'solid';
    time_range?: [number, number];
  };
  visualization_type: 'graph' | '3d_structure' | 'animation' | 'heatmap';
  data_points: number;
}

/**
 * Analyze a chemical reaction using Gemini with structured output
 */
export const analyzeReaction = async (reactionInput: string): Promise<ReactionAnalysis> => {
  const responseSchema = {
    type: SchemaType.OBJECT as const,
    required: [
      "reaction_name",
      "reaction_smiles",
      "condition",
      "reactants",
      "products",
      "reaction_smiles_with_conditions",
      "reaction_description"
    ],
    properties: {
      reaction_name: {
        type: SchemaType.STRING as const,
        description: "The common or IUPAC name of the reaction"
      },
      reaction_smiles: {
        type: SchemaType.STRING as const,
        description: "SMILES notation of the reaction without conditions"
      },
      condition: {
        type: SchemaType.ARRAY as const,
        items: {
          type: SchemaType.STRING as const,
        },
        description: "Reaction conditions (temperature, catalysts, solvents, etc.)"
      },
      reactants: {
        type: SchemaType.ARRAY as const,
        items: {
          type: SchemaType.STRING as const,
        },
        description: "List of reactant compounds with their SMILES or names"
      },
      products: {
        type: SchemaType.ARRAY as const,
        items: {
          type: SchemaType.STRING as const,
        },
        description: "List of product compounds with their SMILES or names"
      },
      reaction_smiles_with_conditions: {
        type: SchemaType.STRING as const,
        description: "Complete SMILES notation including reaction conditions"
      },
      reaction_description: {
        type: SchemaType.STRING as const,
        description: "Detailed description of the reaction mechanism and significance"
      },
    },
  } as const;

  const prompt = `Analyze the following chemical reaction and provide detailed information:

Reaction: ${reactionInput}

Please provide:
1. The reaction name (common or IUPAC)
2. SMILES notation of the reaction
3. Reaction conditions (temperature, catalysts, solvents)
4. List of reactants with their structures
5. List of products with their structures
6. Complete SMILES with conditions
7. Detailed description of the mechanism and importance

Be specific and accurate with chemical nomenclature and SMILES notation.`;

  try {
    const result = await executeWithRotation(async (apiKey) => {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: 'gemini-1.5-flash-latest',
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: responseSchema,
        },
      });

      const response = await model.generateContent(prompt);
      return JSON.parse(response.response.text());
    });

    return result;
  } catch (error) {
    console.error('[Gemini Chemistry] Error analyzing reaction:', error);
    throw new Error('Failed to analyze reaction. Please try again.');
  }
};

/**
 * Analyze a chemical compound using Gemini
 */
export const analyzeCompound = async (compoundInput: string): Promise<CompoundAnalysis> => {
  const responseSchema = {
    type: SchemaType.OBJECT as const,
    required: [
      "compound_name",
      "molecular_formula",
      "iupac_name",
      "smiles",
      "functional_groups",
      "properties",
      "hazards",
      "uses",
      "synthesis_routes"
    ],
    properties: {
      compound_name: { type: SchemaType.STRING as const },
      molecular_formula: { type: SchemaType.STRING as const },
      iupac_name: { type: SchemaType.STRING as const },
      smiles: { type: SchemaType.STRING as const },
      functional_groups: {
        type: SchemaType.ARRAY as const,
        items: { type: SchemaType.STRING as const }
      },
      properties: {
        type: SchemaType.OBJECT as const,
        properties: {
          molecular_weight: { type: SchemaType.NUMBER as const },
          boiling_point: { type: SchemaType.STRING as const },
          melting_point: { type: SchemaType.STRING as const },
          solubility: { type: SchemaType.STRING as const },
        }
      },
      hazards: {
        type: SchemaType.ARRAY as const,
        items: { type: SchemaType.STRING as const }
      },
      uses: {
        type: SchemaType.ARRAY as const,
        items: { type: SchemaType.STRING as const }
      },
      synthesis_routes: {
        type: SchemaType.ARRAY as const,
        items: { type: SchemaType.STRING as const }
      },
    },
  } as const;

  const prompt = `Analyze the following chemical compound in detail:

Compound: ${compoundInput}

Provide comprehensive information including:
1. Common and IUPAC names
2. Molecular formula
3. SMILES notation
4. Functional groups present
5. Physical and chemical properties
6. Safety hazards and precautions
7. Common uses and applications
8. Synthesis routes

Be accurate and detailed.`;

  try {
    const result = await executeWithRotation(async (apiKey) => {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: 'gemini-1.5-flash-latest',
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: responseSchema,
        },
      });

      const response = await model.generateContent(prompt);
      return JSON.parse(response.response.text());
    });

    return result;
  } catch (error) {
    console.error('[Gemini Chemistry] Error analyzing compound:', error);
    throw new Error('Failed to analyze compound. Please try again.');
  }
};

/**
 * Generate simulation parameters for a compound using AI
 */
export const generateSimulationParameters = async (
  compoundName: string,
  simulationType: string
): Promise<SimulationParameters> => {
  const responseSchema = {
    type: SchemaType.OBJECT as const,
    required: ["compound_name", "simulation_type", "parameters", "visualization_type", "data_points"],
    properties: {
      compound_name: { type: SchemaType.STRING as const },
      simulation_type: { type: SchemaType.STRING as const },
      parameters: {
        type: SchemaType.OBJECT as const,
        properties: {
          temperature_range: {
            type: SchemaType.ARRAY as const,
            items: { type: SchemaType.NUMBER as const }
          },
          pressure: { type: SchemaType.NUMBER as const },
          phase: { type: SchemaType.STRING as const },
          time_range: {
            type: SchemaType.ARRAY as const,
            items: { type: SchemaType.NUMBER as const }
          },
        }
      },
      visualization_type: { type: SchemaType.STRING as const },
      data_points: { type: SchemaType.NUMBER as const },
    },
  } as const;

  const prompt = `Generate optimal simulation parameters for studying ${compoundName} using ${simulationType} simulation.

Consider:
- Appropriate temperature and pressure ranges
- Phase of matter to study
- Time scale if applicable
- Best visualization method
- Number of data points needed

Provide realistic, scientifically appropriate parameters.`;

  try {
    const result = await executeWithRotation(async (apiKey) => {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: 'gemini-1.5-flash-latest',
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: responseSchema as any,
        },
      });

      const response = await model.generateContent(prompt);
      return JSON.parse(response.response.text());
    });

    return result;
  } catch (error) {
    console.error('[Gemini Chemistry] Error generating simulation parameters:', error);
    throw new Error('Failed to generate simulation parameters.');
  }
};
