/**
 * Type definitions for the Dynamic Document-to-Simulation Generator
 */

export interface ExtractedConcept {
  keyTopics: string[];
  coreFormulas: Formula[];
  keyDefinitions: Definition[];
}

export interface Formula {
  id: string;
  latex: string;
  description: string;
  variables: Variable[];
}

export interface Variable {
  symbol: string;
  name: string;
  unit?: string;
  description?: string;
}

export interface Definition {
  term: string;
  definition: string;
  relatedFormulas?: string[];
}

export interface SimulationSuggestion {
  id: string;
  title: string;
  description: string;
  domain: string; // e.g., "physics", "finance", "biology", "chemistry"
  relatedFormulas: string[];
  relatedTopics: string[];
  complexity: 'basic' | 'intermediate' | 'advanced';
  estimatedBuildTime?: string;
}

export interface SimulationSchema {
  id: string;
  title: string;
  description: string;
  inputs: InputParameter[];
  outputs: OutputParameter[];
  logic: SimulationLogic;
  metadata: SimulationMetadata;
}

export interface InputParameter {
  id: string;
  name: string;
  type: 'number' | 'boolean' | 'select' | 'range';
  label: string;
  description?: string;
  defaultValue: number | boolean | string;
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  options?: { value: string | number; label: string }[]; // for select type
  controlType: 'slider' | 'knob' | 'switch' | 'toggle' | 'numberField' | 'dropdown';
}

export interface OutputParameter {
  id: string;
  name: string;
  type: 'number' | 'string' | 'boolean' | 'array';
  label: string;
  description?: string;
  unit?: string;
  format?: 'decimal' | 'scientific' | 'percentage' | 'currency';
  precision?: number;
  chartType?: 'line' | 'bar' | 'scatter' | 'pie'; // for visualization
}

export interface SimulationLogic {
  formulaId?: string;
  equation?: string; // LaTeX format
  implementation: string; // JavaScript function as string
  explanation?: string;
  constraints?: Constraint[];
}

export interface Constraint {
  parameter: string;
  condition: string;
  errorMessage: string;
}

export interface SimulationMetadata {
  domain: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  tags: string[];
  author?: string;
  version?: string;
  lastModified?: Date;
  relatedConcepts?: string[];
}

export interface SimulationResult {
  outputs: { [key: string]: any };
  visualizations?: VisualizationData[];
  error?: string;
  warnings?: string[];
}

export interface VisualizationData {
  type: 'line' | 'bar' | 'scatter' | 'pie' | 'heatmap';
  title: string;
  data: any;
  xAxis?: { label: string; unit?: string };
  yAxis?: { label: string; unit?: string };
}

// Gemini Structured Output Schema Types
export interface GeminiSimulationPrompt {
  systemInstruction: string;
  userPrompt: string;
  responseSchema: GeminiResponseSchema;
}

export interface GeminiResponseSchema {
  type: 'object';
  properties: {
    [key: string]: GeminiSchemaProperty;
  };
  required: string[];
}

export interface GeminiSchemaProperty {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description?: string;
  items?: GeminiSchemaProperty;
  properties?: { [key: string]: GeminiSchemaProperty };
  enum?: (string | number)[];
}

// UI State Types
export interface SimulationUIState {
  inputValues: { [key: string]: any };
  outputValues: { [key: string]: any };
  isCalculating: boolean;
  error?: string;
  warnings?: string[];
}

export interface DocumentAnalysisResult {
  documentId: string;
  extractedConcepts: ExtractedConcept;
  suggestedSimulations: SimulationSuggestion[];
  analysisTimestamp: Date;
  confidence: number; // 0-1
}
