/**
 * Dynamic Simulation Generator - Main Component
 * Manages the 4-stage workflow for document-to-simulation generation
 */

import React, { useState } from 'react';
import {
  FileText,
  Sparkles,
  Loader2,
  Lightbulb,
  Play,
  ArrowRight,
  CheckCircle,
  AlertCircle,
  BookOpen,
  Calculator,
} from 'lucide-react';
import { InlineMath } from 'react-katex';
import 'katex/dist/katex.min.css';
import InteractiveSimulationRenderer from './InteractiveSimulationRenderer';
import {
  analyzeDocumentForConcepts,
  suggestSimulations,
  generateSimulationSchema,
  initializeSimulationService,
} from '../services/simulationService';
import type {
  ExtractedConcept,
  SimulationSuggestion,
  SimulationSchema,
} from '../types/simulation';

interface DynamicSimulationGeneratorProps {
  documentContent: string;
  documentName: string;
  documentId: string;
  apiKey: string;
  onClose?: () => void;
}

type WorkflowStage = 'analysis' | 'suggestions' | 'configuration' | 'simulation';

const DynamicSimulationGenerator: React.FC<DynamicSimulationGeneratorProps> = ({
  documentContent,
  documentName,
  documentId,
  apiKey,
  onClose,
}) => {
  const [currentStage, setCurrentStage] = useState<WorkflowStage>('analysis');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Stage 1: Document Analysis
  const [extractedConcepts, setExtractedConcepts] = useState<ExtractedConcept | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Stage 2: Simulation Suggestions
  const [suggestions, setSuggestions] = useState<SimulationSuggestion[]>([]);
  const [selectedSuggestion, setSelectedSuggestion] = useState<SimulationSuggestion | null>(null);

  // Stage 3: Simulation Configuration
  const [simulationSchema, setSimulationSchema] = useState<SimulationSchema | null>(null);
  const [isGeneratingSchema, setIsGeneratingSchema] = useState(false);

  // Initialize service
  React.useEffect(() => {
    if (apiKey) {
      initializeSimulationService(apiKey);
    }
  }, [apiKey]);

  // Stage 1: Analyze Document
  const handleAnalyzeDocument = async () => {
    setIsAnalyzing(true);
    setError(null);

    try {
      const concepts = await analyzeDocumentForConcepts(documentContent, documentName);
      setExtractedConcepts(concepts);
      setCurrentStage('suggestions');

      // Automatically move to suggestions
      await handleGenerateSuggestions(concepts);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Stage 2: Generate Simulation Suggestions
  const handleGenerateSuggestions = async (concepts: ExtractedConcept) => {
    setIsProcessing(true);
    setError(null);

    try {
      const sims = await suggestSimulations(concepts);
      setSuggestions(sims);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsProcessing(false);
    }
  };

  // Stage 3: Configure Selected Simulation
  const handleConfigureSimulation = async (suggestion: SimulationSuggestion) => {
    setSelectedSuggestion(suggestion);
    setIsGeneratingSchema(true);
    setError(null);

    try {
      if (!extractedConcepts) {
        throw new Error('No extracted concepts available');
      }

      const schema = await generateSimulationSchema(suggestion, extractedConcepts);
      setSimulationSchema(schema);
      setCurrentStage('simulation');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsGeneratingSchema(false);
    }
  };

  // Render different stages
  const renderStage = () => {
    switch (currentStage) {
      case 'analysis':
        return renderAnalysisStage();
      case 'suggestions':
        return renderSuggestionsStage();
      case 'configuration':
        return renderConfigurationStage();
      case 'simulation':
        return renderSimulationStage();
    }
  };

  const renderAnalysisStage = () => (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white/10 backdrop-blur-lg rounded-lg p-8 border border-white/20">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-500/20 rounded-full mb-4">
            <FileText className="h-8 w-8 text-purple-300" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Document Analysis</h2>
          <p className="text-gray-300">
            Extract key concepts, formulas, and definitions from your document
          </p>
        </div>

        <div className="bg-black/30 rounded-lg p-6 mb-6">
          <div className="flex items-center gap-3 mb-3">
            <BookOpen className="h-5 w-5 text-cyan-400" />
            <span className="text-white font-medium">{documentName}</span>
          </div>
          <p className="text-gray-400 text-sm">
            {documentContent.length > 200
              ? documentContent.substring(0, 200) + '...'
              : documentContent}
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/20 border border-red-400/50 rounded-lg flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-300 flex-shrink-0 mt-0.5" />
            <p className="text-red-200 text-sm">{error}</p>
          </div>
        )}

        <button
          onClick={handleAnalyzeDocument}
          disabled={isAnalyzing}
          className="w-full px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:from-gray-600 disabled:to-gray-700 text-white rounded-lg font-medium transition-all flex items-center justify-center gap-2"
        >
          {isAnalyzing ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Analyzing Document...
            </>
          ) : (
            <>
              <Sparkles className="h-5 w-5" />
              Analyze & Extract Concepts
            </>
          )}
        </button>
      </div>
    </div>
  );

  const renderSuggestionsStage = () => (
    <div className="max-w-6xl mx-auto">
      {/* Extracted Concepts Summary */}
      {extractedConcepts && (
        <div className="bg-white/10 backdrop-blur-lg rounded-lg p-6 mb-6 border border-white/20">
          <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-400" />
            Extracted Concepts
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Topics */}
            <div className="bg-black/30 rounded-lg p-4">
              <div className="text-gray-300 font-medium mb-2">Key Topics</div>
              <div className="flex flex-wrap gap-2">
                {extractedConcepts.keyTopics.map((topic, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-1 bg-blue-500/30 text-blue-200 rounded text-xs border border-blue-400/50"
                  >
                    {topic}
                  </span>
                ))}
              </div>
            </div>

            {/* Formulas */}
            <div className="bg-black/30 rounded-lg p-4">
              <div className="text-gray-300 font-medium mb-2">Core Formulas</div>
              <div className="text-gray-400 text-sm">
                {extractedConcepts.coreFormulas.length} formula
                {extractedConcepts.coreFormulas.length !== 1 ? 's' : ''} extracted
              </div>
            </div>

            {/* Definitions */}
            <div className="bg-black/30 rounded-lg p-4">
              <div className="text-gray-300 font-medium mb-2">Key Definitions</div>
              <div className="text-gray-400 text-sm">
                {extractedConcepts.keyDefinitions.length} definition
                {extractedConcepts.keyDefinitions.length !== 1 ? 's' : ''} extracted
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Simulation Suggestions */}
      <div className="bg-white/10 backdrop-blur-lg rounded-lg p-6 border border-white/20">
        <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-yellow-400" />
          Suggested Interactive Simulations
        </h3>

        {isProcessing ? (
          <div className="text-center py-12">
            <Loader2 className="h-12 w-12 animate-spin text-purple-400 mx-auto mb-4" />
            <p className="text-gray-300">Generating simulation suggestions...</p>
          </div>
        ) : suggestions.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {suggestions.map((suggestion) => (
              <div
                key={suggestion.id}
                className="bg-gradient-to-br from-purple-500/10 to-blue-500/10 rounded-lg p-6 border border-purple-400/30 hover:border-purple-400/60 transition-all cursor-pointer group"
                onClick={() => handleConfigureSimulation(suggestion)}
              >
                <div className="flex items-start justify-between mb-3">
                  <h4 className="text-lg font-bold text-white group-hover:text-purple-300 transition-colors">
                    {suggestion.title}
                  </h4>
                  <span
                    className={`px-2 py-1 rounded text-xs ${
                      suggestion.complexity === 'basic'
                        ? 'bg-green-500/30 text-green-200 border border-green-400/50'
                        : suggestion.complexity === 'intermediate'
                        ? 'bg-yellow-500/30 text-yellow-200 border border-yellow-400/50'
                        : 'bg-red-500/30 text-red-200 border border-red-400/50'
                    }`}
                  >
                    {suggestion.complexity}
                  </span>
                </div>

                <p className="text-gray-300 text-sm mb-4">{suggestion.description}</p>

                <div className="flex items-center justify-between text-sm">
                  <span className="px-2 py-1 bg-purple-500/30 text-purple-200 rounded border border-purple-400/50">
                    {suggestion.domain}
                  </span>
                  {suggestion.estimatedBuildTime && (
                    <span className="text-gray-400">⏱️ {suggestion.estimatedBuildTime}</span>
                  )}
                </div>

                <button className="mt-4 w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-all flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                  <Play className="h-4 w-4" />
                  Create Simulation
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-gray-400">
            No suggestions available. Try analyzing the document first.
          </div>
        )}
      </div>

      {error && (
        <div className="mt-6 p-4 bg-red-500/20 border border-red-400/50 rounded-lg flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-300 flex-shrink-0 mt-0.5" />
          <p className="text-red-200 text-sm">{error}</p>
        </div>
      )}
    </div>
  );

  const renderConfigurationStage = () => (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white/10 backdrop-blur-lg rounded-lg p-8 border border-white/20 text-center">
        <Loader2 className="h-16 w-16 animate-spin text-purple-400 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-white mb-2">Configuring Simulation</h2>
        <p className="text-gray-300">
          Generating interactive controls and calculation logic...
        </p>
      </div>
    </div>
  );

  const renderSimulationStage = () => {
    if (!simulationSchema) {
      return (
        <div className="text-center text-gray-400">No simulation schema available</div>
      );
    }

    return (
      <div>
        <div className="mb-6 flex items-center justify-between">
          <button
            onClick={() => {
              setCurrentStage('suggestions');
              setSimulationSchema(null);
              setSelectedSuggestion(null);
            }}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-all flex items-center gap-2"
          >
            <ArrowRight className="h-4 w-4 rotate-180" />
            Back to Suggestions
          </button>
        </div>

        <InteractiveSimulationRenderer schema={simulationSchema} onClose={onClose} />
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-6">
      {/* Header */}
      <div className="max-w-6xl mx-auto mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
              <Calculator className="h-8 w-8 text-purple-400" />
              Dynamic Simulation Generator
            </h1>
            <p className="text-gray-300">
              AI-powered document analysis to interactive simulation
            </p>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-200 rounded-lg border border-red-400/50 transition-all"
            >
              Close
            </button>
          )}
        </div>

        {/* Progress Indicator */}
        <div className="mt-6 flex items-center justify-center gap-4">
          {[
            { stage: 'analysis', label: 'Analysis', icon: FileText },
            { stage: 'suggestions', label: 'Suggestions', icon: Lightbulb },
            { stage: 'configuration', label: 'Configuration', icon: Sparkles },
            { stage: 'simulation', label: 'Simulation', icon: Play },
          ].map((step, idx) => {
            const Icon = step.icon;
            const isActive = currentStage === step.stage;
            const isCompleted =
              ['analysis', 'suggestions', 'configuration', 'simulation'].indexOf(currentStage) >
              ['analysis', 'suggestions', 'configuration', 'simulation'].indexOf(
                step.stage as WorkflowStage
              );

            return (
              <React.Fragment key={step.stage}>
                <div
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all ${
                    isActive
                      ? 'bg-purple-500/30 border-purple-400 text-white'
                      : isCompleted
                      ? 'bg-green-500/20 border-green-400/50 text-green-300'
                      : 'bg-gray-700/30 border-gray-600 text-gray-400'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="text-sm font-medium">{step.label}</span>
                </div>
                {idx < 3 && (
                  <ArrowRight
                    className={`h-4 w-4 ${
                      isCompleted ? 'text-green-400' : 'text-gray-600'
                    }`}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Main Content */}
      {renderStage()}

      {/* Loading Overlay */}
      {isGeneratingSchema && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-lg p-8 border border-purple-400/50">
            <Loader2 className="h-12 w-12 animate-spin text-purple-400 mx-auto mb-4" />
            <p className="text-white text-center">Generating simulation schema...</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default DynamicSimulationGenerator;
