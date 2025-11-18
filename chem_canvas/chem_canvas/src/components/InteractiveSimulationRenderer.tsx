/**
 * Interactive Simulation Renderer - Stage 4: Dynamic UI Rendering
 * Renders interactive simulations with knobs, sliders, switches, and real-time calculations
 */

import React, { useState, useEffect, useRef } from 'react';
import { Play, RotateCcw, Info, TrendingUp, Download, Share2, BookOpen, Lightbulb, Target, Zap, Activity } from 'lucide-react';
import { InlineMath, BlockMath } from 'react-katex';
import 'katex/dist/katex.min.css';
import type { SimulationSchema, InputParameter, OutputParameter } from '../types/simulation';
import { executeSimulation } from '../services/simulationService';

interface InteractiveSimulationRendererProps {
  schema: SimulationSchema;
  onClose?: () => void;
}

const InteractiveSimulationRenderer: React.FC<InteractiveSimulationRendererProps> = ({
  schema,
  onClose,
}) => {
  const [inputValues, setInputValues] = useState<{ [key: string]: any }>({});
  const [outputValues, setOutputValues] = useState<{ [key: string]: any }>({});
  const [error, setError] = useState<string | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [activeTab, setActiveTab] = useState<'simulation' | 'explanation'>('simulation');
  const [dataHistory, setDataHistory] = useState<Array<{ inputs: any; outputs: any; timestamp: number }>>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Initialize input values with defaults
  useEffect(() => {
    const initialValues: { [key: string]: any } = {};
    schema.inputs.forEach((input) => {
      initialValues[input.id] = input.defaultValue;
    });
    setInputValues(initialValues);
  }, [schema]);

  // Calculate outputs whenever inputs change
  useEffect(() => {
    if (Object.keys(inputValues).length === 0) return;

    const calculate = async () => {
      setIsCalculating(true);
      setError(null);

      try {
        console.log('Executing simulation with inputs:', inputValues);
        console.log('Implementation code:', schema.logic.implementation);
        const results = executeSimulation(schema, inputValues);
        console.log('Simulation results:', results);
        setOutputValues(results);

        // Track data history for graphs (keep last 50 points)
        setDataHistory((prev) => {
          const newHistory = [
            ...prev,
            { inputs: { ...inputValues }, outputs: { ...results }, timestamp: Date.now() },
          ];
          return newHistory.slice(-50); // Keep last 50 data points
        });
      } catch (err) {
        console.error('Simulation execution error:', err);
        setError((err as Error).message);
      } finally {
        setIsCalculating(false);
      }
    };

    // Debounce calculations
    const timeoutId = setTimeout(calculate, 100);
    return () => clearTimeout(timeoutId);
  }, [inputValues, schema]);

  const handleInputChange = (inputId: string, value: any) => {
    setInputValues((prev) => ({
      ...prev,
      [inputId]: value,
    }));
  };

  const resetToDefaults = () => {
    const defaultValues: { [key: string]: any } = {};
    schema.inputs.forEach((input) => {
      defaultValues[input.id] = input.defaultValue;
    });
    setInputValues(defaultValues);
    setDataHistory([]); // Clear history on reset
  };

  const formatOutputValue = (value: any, output: OutputParameter): string => {
    if (value === null || value === undefined) return 'N/A';

    if (output.type === 'number') {
      const num = Number(value);
      if (isNaN(num)) return 'Invalid';

      const precision = output.precision ?? 2;

      switch (output.format) {
        case 'scientific':
          return num.toExponential(precision);
        case 'percentage':
          return `${(num * 100).toFixed(precision)}%`;
        case 'currency':
          return `$${num.toFixed(precision)}`;
        case 'decimal':
        default:
          return num.toFixed(precision);
      }
    }

    return String(value);
  };

  return (
    <>
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.3);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: linear-gradient(180deg, #06b6d4, #3b82f6);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(180deg, #0891b2, #2563eb);
        }
      `}</style>
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <div className="w-full">
        {/* Header */}
        <div className="bg-white/10 backdrop-blur-lg p-6 mb-4 border-b border-white/20">
          <div className="flex items-start justify-between px-4">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">{schema.title}</h1>
              <p className="text-gray-300 mb-3">{schema.description}</p>
              <div className="flex items-center gap-3 text-sm">
                <span className="px-3 py-1 bg-purple-500/30 text-purple-200 rounded-full border border-purple-400/50">
                  {schema.metadata.domain}
                </span>
                <span className="px-3 py-1 bg-blue-500/30 text-blue-200 rounded-full border border-blue-400/50">
                  {schema.metadata.difficulty}
                </span>
                {schema.metadata.tags.map((tag, idx) => (
                  <span
                    key={idx}
                    className="px-3 py-1 bg-gray-500/30 text-gray-200 rounded-full border border-gray-400/50"
                  >
                    {tag}
                  </span>
                ))}
              </div>
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

          {/* Formula Display */}
          {schema.logic.equation && (
            <div className="mt-4 p-4 bg-black/30 border-t border-b border-purple-400/30">
              <div className="text-gray-300 text-sm mb-2 px-4">Formula:</div>
              <div className="text-white text-lg overflow-x-auto px-4">
                <BlockMath math={schema.logic.equation} />
              </div>
              {schema.logic.explanation && (
                <div className="text-gray-400 text-sm mt-2 px-4">{schema.logic.explanation}</div>
              )}
            </div>
          )}

          {/* How to Use Section */}
          <div className="mt-4 p-4 bg-gradient-to-r from-blue-500/20 to-cyan-500/20 border-y border-blue-400/40">
            <div className="flex items-start gap-3 px-4">
              <Info className="h-5 w-5 text-cyan-300 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="text-cyan-200 font-semibold mb-2">How to Use This Simulation</h3>
                <ul className="text-gray-300 text-sm space-y-1.5">
                  <li>• <span className="text-cyan-200">Adjust the input controls</span> on the left to change simulation parameters</li>
                  <li>• <span className="text-cyan-200">Watch the outputs update</span> in real-time on the right as you make changes</li>
                  <li>• <span className="text-cyan-200">Use sliders and knobs</span> for continuous values, switches for on/off states</li>
                  <li>• <span className="text-cyan-200">Click "Reset"</span> to restore all inputs to their default values</li>
                  <li>• <span className="text-cyan-200">Switch to "Explanation" tab</span> to understand the science behind your results</li>
                </ul>
                {schema.logic.explanation && (
                  <div className="mt-3 pt-3 border-t border-blue-400/30">
                    <p className="text-xs text-gray-400">
                      <span className="text-cyan-300 font-medium">Learning Objective:</span> {schema.logic.explanation}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="mt-6 flex gap-2 border-b border-gray-600/30">
          <button
            onClick={() => setActiveTab('simulation')}
            className={`px-6 py-3 font-semibold transition-all flex items-center gap-2 ${
              activeTab === 'simulation'
                ? 'text-cyan-300 border-b-2 border-cyan-400 bg-cyan-500/10'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            <Play className="h-4 w-4" />
            Interactive Simulation
          </button>
          <button
            onClick={() => setActiveTab('explanation')}
            className={`px-6 py-3 font-semibold transition-all flex items-center gap-2 ${
              activeTab === 'explanation'
                ? 'text-purple-300 border-b-2 border-purple-400 bg-purple-500/10'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            <BookOpen className="h-4 w-4" />
            Explanation & Insights
          </button>
        </div>

        {/* Simulation Tab */}
        {activeTab === 'simulation' && (
        <>
        {/* Main Layout: 2 Columns - Visualizations Left | Controls & Explanation Right */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mt-4 items-start">
          
          {/* LEFT SIDEBAR - Visualizations */}
          <div className="lg:col-span-4 px-2">
            <div className="bg-gradient-to-br from-slate-800/95 via-slate-900/90 to-gray-900/95 backdrop-blur-xl rounded-xl p-4 border border-slate-600/40 shadow-2xl h-[calc(100vh-200px)] overflow-y-auto custom-scrollbar sticky top-2">
              <div className="flex items-center gap-3 mb-5 pb-4 border-b border-slate-600/40">
                <div className="p-2 bg-cyan-500/20 rounded-lg ring-1 ring-cyan-400/30">
                  <Activity className="h-5 w-5 text-cyan-400" />
                </div>
                <h2 className="text-lg font-bold text-white">
                  Live Visualizations
                </h2>
              </div>

              {/* Real-time Graph */}
              {dataHistory.length > 1 && (
                <div className="mb-4">
                  <RealTimeGraph
                    data={dataHistory}
                    inputs={schema.inputs}
                    outputs={schema.outputs}
                  />
                </div>
              )}

              {/* Domain-Specific Visualizations */}
              <div>
                {renderDomainVisualization(schema, inputValues, outputValues)}
              </div>

              {/* Visualization Legend */}
              <div className="mt-4 pt-4 border-t border-slate-600/40">
                <p className="text-xs text-slate-400 leading-relaxed">
                  <span className="text-cyan-400 font-semibold">Real-time updates:</span> Visualizations update automatically as you adjust controls
                </p>
              </div>
            </div>
          </div>

          {/* RIGHT - Input Controls & Explanation Side by Side */}
          <div className="lg:col-span-8 px-2">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-[calc(100vh-200px)]">
              
              {/* Input Controls & Results */}
              <div className="bg-gradient-to-br from-slate-900/95 via-slate-800/90 to-slate-900/85 backdrop-blur-xl rounded-xl p-5 border border-slate-600/40 shadow-2xl overflow-y-auto custom-scrollbar">
              <div className="flex items-center justify-between mb-5 pb-4 border-b border-slate-600/40">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-500/20 rounded-lg ring-1 ring-blue-400/30">
                    <Play className="h-5 w-5 text-blue-400" />
                  </div>
                  <h2 className="text-xl font-bold text-white">
                    Input Controls
                  </h2>
                </div>
                <button
                  onClick={resetToDefaults}
                  className="px-4 py-2 bg-gradient-to-r from-blue-600/30 to-blue-500/20 hover:from-blue-600/40 hover:to-blue-500/30 text-blue-200 rounded-xl border border-blue-400/50 transition-all flex items-center gap-2 text-sm font-medium shadow-lg hover:shadow-blue-500/20"
                >
                  <RotateCcw className="h-4 w-4" />
                  Reset
                </button>
              </div>
              
              <div className="mb-5 pb-4 border-b border-slate-600/40">
                <p className="text-slate-300 text-sm leading-relaxed">
                  Adjust the parameters below to explore how they affect the simulation results.
                  <span className="block text-cyan-400 text-xs mt-1">Changes are calculated in real-time ⚡</span>
                </p>
              </div>

              <div className="space-y-4">
                {schema.inputs.map((input, idx) => (
                  <div 
                    key={input.id} 
                    className="p-4 bg-gradient-to-br from-black/40 to-black/20 rounded-xl border border-slate-600/40 hover:border-cyan-400/40 transition-all shadow-lg"
                    style={{ animationDelay: `${idx * 50}ms` }}
                  >
                    <InputControl
                      input={input}
                      value={inputValues[input.id]}
                      onChange={(value) => handleInputChange(input.id, value)}
                    />
                  </div>
                ))}
              </div>

              {/* Output Display */}
              <div className="mt-6 pt-6 border-t border-slate-600/40">
                <div className="flex items-center gap-3 mb-5">
                  <div className="p-2 bg-purple-500/20 rounded-lg ring-1 ring-purple-400/30">
                    <TrendingUp className="h-5 w-5 text-purple-400" />
                  </div>
                  <h2 className="text-xl font-bold text-white">
                    Results
                  </h2>
                </div>

                <div className="mb-5 pb-4 border-b border-slate-600/40">
                  <p className="text-slate-300 text-sm leading-relaxed">
                    These values are automatically calculated based on your input parameters.
                    {isCalculating && (
                      <span className="inline-flex items-center gap-2 ml-2 text-cyan-400 animate-pulse">
                        <span className="h-2 w-2 bg-cyan-400 rounded-full animate-ping"></span>
                        Calculating...
                      </span>
                    )}
                  </p>
                </div>

                {error && (
                  <div className="mb-4 p-4 bg-gradient-to-r from-red-900/40 to-red-800/30 border border-red-400/50 rounded-xl backdrop-blur-sm">
                    <p className="text-red-200 text-sm flex items-center gap-2">
                      <span className="text-red-400">⚠️</span>
                      Error: {error}
                    </p>
                  </div>
                )}

                <div className="space-y-4">
                  {schema.outputs.map((output, idx) => (
                    <div
                      key={output.id}
                      className="p-5 bg-gradient-to-r from-purple-600/20 via-indigo-600/15 to-blue-600/20 rounded-xl border border-purple-400/40 shadow-lg hover:shadow-purple-500/20 transition-all"
                      style={{ animationDelay: `${idx * 50}ms` }}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex-1">
                          <div className="text-purple-200 font-semibold text-sm">{output.label}</div>
                          {output.description && (
                            <div className="text-slate-400 text-xs mt-1 leading-relaxed">{output.description}</div>
                          )}
                        </div>
                        {output.unit && (
                          <div className="px-3 py-1 bg-purple-500/20 rounded-lg border border-purple-400/30">
                            <span className="text-purple-200 text-xs font-mono font-semibold">{output.unit}</span>
                          </div>
                        )}
                      </div>
                      <div className="mt-3 text-4xl font-bold bg-gradient-to-r from-white via-cyan-100 to-purple-200 bg-clip-text text-transparent">
                        {isCalculating ? (
                          <span className="text-slate-400 text-xl">Calculating...</span>
                        ) : (
                          <>
                            {formatOutputValue(outputValues[output.id], output)}
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Export/Share Actions */}
                <div className="mt-6 pt-5 border-t border-slate-600/40 flex gap-3">
                  <button className="flex-1 px-4 py-3 bg-gradient-to-r from-green-600/30 to-emerald-500/20 hover:from-green-600/40 hover:to-emerald-500/30 text-green-200 rounded-xl border border-green-400/50 transition-all flex items-center justify-center gap-2 font-medium shadow-lg hover:shadow-green-500/20">
                    <Download className="h-4 w-4" />
                    Export Data
                  </button>
                  <button className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600/30 to-cyan-500/20 hover:from-blue-600/40 hover:to-cyan-500/30 text-blue-200 rounded-xl border border-blue-400/50 transition-all flex items-center justify-center gap-2 font-medium shadow-lg hover:shadow-blue-500/20">
                    <Share2 className="h-4 w-4" />
                    Share
                  </button>
                </div>
              </div>
              </div>

              {/* Explanation & Insights Panel */}
              <div className="bg-gradient-to-br from-amber-900/50 via-orange-900/40 to-yellow-800/30 backdrop-blur-xl rounded-xl p-4 border border-amber-600/40 shadow-2xl overflow-y-auto custom-scrollbar">
                <div className="flex items-center gap-3 mb-5 pb-4 border-b border-amber-600/40">
                  <div className="p-2 bg-yellow-500/20 rounded-lg ring-1 ring-yellow-400/30">
                    <Lightbulb className="h-5 w-5 text-yellow-400" />
                  </div>
                  <h2 className="text-lg font-bold text-white">
                    How It Works
                  </h2>
                </div>

                {/* Quick Explanation */}
                <div className="space-y-4">
                  <div className="p-4 bg-gradient-to-br from-blue-600/20 to-purple-600/15 rounded-xl border border-blue-400/30 backdrop-blur-sm">
                    <h3 className="text-sm font-semibold text-blue-200 mb-2 flex items-center gap-2">
                      <Info className="h-4 w-4" />
                      What's Happening
                    </h3>
                    <p className="text-slate-300 text-xs leading-relaxed">
                      {schema.description || "This simulation demonstrates the relationship between the input parameters and calculated outputs. Adjust the controls to see how different values affect the results."}
                    </p>
                  </div>

                  {/* Formula Display */}
                  {schema.logic.equation && (
                    <div className="p-4 bg-gradient-to-br from-purple-600/15 to-pink-600/10 rounded-xl border border-purple-400/30 backdrop-blur-sm">
                      <h3 className="text-sm font-semibold text-purple-200 mb-3">Formula</h3>
                      <div className="bg-black/40 p-3 rounded-lg border border-purple-500/30 overflow-x-auto shadow-inner">
                        <BlockMath math={schema.logic.equation} />
                      </div>
                    </div>
                  )}

                  {/* Input-Output Relationships */}
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-cyan-300 flex items-center gap-2">
                      <span className="h-1 w-1 bg-cyan-400 rounded-full"></span>
                      Key Relationships
                    </h3>
                    {schema.inputs.slice(0, 3).map((input) => (
                      <div key={input.id} className="p-3 bg-gradient-to-r from-black/30 to-black/20 rounded-lg border border-amber-600/40 hover:border-cyan-400/40 transition-all">
                        <p className="text-slate-300 text-xs">
                          <span className="text-cyan-300 font-semibold">{input.label}</span>
                          <span className="text-slate-400 block mt-1.5 flex items-center gap-2">
                            <span className="text-cyan-400">→</span>
                            <span className="px-2 py-0.5 bg-cyan-500/20 rounded border border-cyan-400/30 font-mono">
                              {inputValues[input.id]} {input.unit || ''}
                            </span>
                          </span>
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* What to Try */}
                  <div className="p-4 bg-gradient-to-br from-green-500/15 to-emerald-500/10 rounded-xl border border-green-400/30 backdrop-blur-sm">
                    <h3 className="text-sm font-semibold text-green-200 mb-3 flex items-center gap-2">
                      <Target className="h-4 w-4" />
                      Quick Tips
                    </h3>
                    <ul className="text-xs text-gray-300 space-y-2">
                      <li className="flex items-start gap-2">
                        <span className="text-green-400 mt-0.5">●</span>
                        <span className="text-slate-300">Try minimum and maximum values</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-green-400 mt-0.5">●</span>
                        <span className="text-slate-300">Double a value to see the pattern</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-green-400 mt-0.5">●</span>
                        <span className="text-slate-300">Watch the visualizations update</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-green-400 mt-0.5">●</span>
                        <span className="text-slate-300">Compare different scenarios</span>
                      </li>
                    </ul>
                  </div>

                  {/* Tags */}
                  {schema.metadata.tags && schema.metadata.tags.length > 0 && (
                    <div className="p-4 bg-gradient-to-br from-gray-800/40 to-gray-900/30 rounded-xl border border-amber-600/40 backdrop-blur-sm">
                      <h3 className="text-xs font-semibold text-slate-300 mb-3">Related Topics</h3>
                      <div className="flex flex-wrap gap-2">
                        {schema.metadata.tags.map((tag, idx) => (
                          <span
                            key={idx}
                            className="px-3 py-1.5 bg-gradient-to-r from-purple-500/20 to-pink-500/15 text-purple-200 rounded-lg text-xs border border-purple-400/40 font-medium hover:border-purple-300/60 transition-all cursor-pointer"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </>
        )}

        {/* Explanation Tab */}
        {activeTab === 'explanation' && (
        <div className="mt-4 space-y-4 px-4">
          {/* What's Happening Section */}
          <div className="bg-white/10 backdrop-blur-lg rounded-lg p-6 border border-white/20">
            <div className="flex items-start gap-3 mb-4">
              <Lightbulb className="h-6 w-6 text-yellow-300 flex-shrink-0 mt-1" />
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-white mb-2">Understanding Your Results</h2>
                <p className="text-gray-300">
                  {schema.logic.explanation || 'This simulation demonstrates the relationship between input parameters and calculated outputs.'}
                </p>
              </div>
            </div>

            {/* Current Values Summary */}
            <div className="mt-6 p-4 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-lg border border-blue-400/30">
              <h3 className="text-lg font-semibold text-cyan-200 mb-3">Current State</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-medium text-gray-400 mb-2">Your Inputs:</h4>
                  <ul className="space-y-1">
                    {schema.inputs.map((input) => (
                      <li key={input.id} className="text-sm text-gray-300">
                        <span className="text-cyan-300 font-medium">{input.label}:</span>{' '}
                        {inputValues[input.id]} {input.unit || ''}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-400 mb-2">Calculated Results:</h4>
                  <ul className="space-y-1">
                    {schema.outputs.map((output) => (
                      <li key={output.id} className="text-sm text-gray-300">
                        <span className="text-purple-300 font-medium">{output.label}:</span>{' '}
                        {formatOutputValue(outputValues[output.id], output)} {output.unit || ''}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Why These Results Section */}
          <div className="bg-white/10 backdrop-blur-lg rounded-lg p-6 border border-white/20">
            <div className="flex items-start gap-3 mb-4">
              <Info className="h-6 w-6 text-cyan-300 flex-shrink-0 mt-1" />
              <div>
                <h2 className="text-2xl font-bold text-white mb-3">Why You're Getting These Results</h2>
                
                {/* Formula Explanation */}
                {schema.logic.equation && (
                  <div className="mb-4 p-4 bg-black/30 rounded-lg border border-purple-400/30">
                    <p className="text-gray-300 text-sm mb-2">This simulation uses the following formula:</p>
                    <div className="text-white text-lg overflow-x-auto my-3">
                      <BlockMath math={schema.logic.equation} />
                    </div>
                  </div>
                )}

                {/* Input-Output Relationships */}
                <div className="space-y-3 mt-4">
                  <h3 className="text-lg font-semibold text-purple-300">How Parameters Affect Results:</h3>
                  {schema.inputs.map((input) => (
                    <div key={input.id} className="p-3 bg-black/20 rounded-lg border border-gray-600/30">
                      <p className="text-gray-300 text-sm">
                        <span className="text-cyan-300 font-medium">{input.label}</span>
                        {input.description && (
                          <>
                            : {input.description}
                            {' '}
                          </>
                        )}
                        {!input.description && (
                          <>
                            {' - '}
                            {input.type === 'number' && 'Changing this value directly affects the calculation. '}
                            {input.type === 'boolean' && 'Toggling this switches between different calculation modes. '}
                            {input.type === 'select' && 'Different options apply different parameters to the formula. '}
                          </>
                        )}
                        <span className="text-gray-400">
                          (Current: {inputValues[input.id]} {input.unit || ''})
                        </span>
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* What to Try Next Section */}
          <div className="bg-white/10 backdrop-blur-lg rounded-lg p-6 border border-white/20">
            <div className="flex items-start gap-3">
              <Target className="h-6 w-6 text-green-300 flex-shrink-0 mt-1" />
              <div>
                <h2 className="text-2xl font-bold text-white mb-3">What to Try Next</h2>
                <div className="space-y-3">
                  <div className="p-4 bg-gradient-to-r from-green-500/10 to-emerald-500/10 rounded-lg border border-green-400/30">
                    <h4 className="text-green-300 font-semibold mb-2">🔬 Experiment with Extremes</h4>
                    <p className="text-gray-300 text-sm">
                      Try setting parameters to their minimum and maximum values. Observe how the outputs change dramatically. 
                      This helps you understand the full range of the relationship.
                    </p>
                  </div>
                  
                  <div className="p-4 bg-gradient-to-r from-blue-500/10 to-cyan-500/10 rounded-lg border border-blue-400/30">
                    <h4 className="text-blue-300 font-semibold mb-2">📊 Find Patterns</h4>
                    <p className="text-gray-300 text-sm">
                      Double one input value and see if the output doubles, halves, or changes in another pattern. 
                      This reveals whether relationships are linear, inverse, or more complex.
                    </p>
                  </div>
                  
                  <div className="p-4 bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-lg border border-purple-400/30">
                    <h4 className="text-purple-300 font-semibold mb-2">🎯 Set a Target</h4>
                    <p className="text-gray-300 text-sm">
                      Choose a desired output value and adjust the inputs to achieve it. 
                      This reverse-engineering helps you understand how to control the system.
                    </p>
                  </div>

                  <div className="p-4 bg-gradient-to-r from-orange-500/10 to-yellow-500/10 rounded-lg border border-orange-400/30">
                    <h4 className="text-orange-300 font-semibold mb-2">🔄 Compare Scenarios</h4>
                    <p className="text-gray-300 text-sm">
                      Take note of output values for different input combinations. 
                      Compare them to understand which parameters have the strongest effect on results.
                    </p>
                  </div>
                </div>

                {/* Related Concepts */}
                {schema.metadata.tags && schema.metadata.tags.length > 0 && (
                  <div className="mt-6 p-4 bg-black/30 rounded-lg border border-gray-600/30">
                    <h4 className="text-gray-300 font-medium mb-2">Related Concepts to Explore:</h4>
                    <div className="flex flex-wrap gap-2">
                      {schema.metadata.tags.map((tag, idx) => (
                        <span
                          key={idx}
                          className="px-3 py-1 bg-purple-500/20 text-purple-200 rounded-full border border-purple-400/40 text-sm"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        )}
      </div>
    </div>
    </>
  );
};

/**
 * Real-time Graph Component
 * Shows how outputs change as inputs are adjusted
 */
const RealTimeGraph: React.FC<{
  data: Array<{ inputs: any; outputs: any; timestamp: number }>;
  inputs: InputParameter[];
  outputs: OutputParameter[];
}> = ({ data, inputs, outputs }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || data.length < 2) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size - Increased height for better visibility
    canvas.width = canvas.offsetWidth;
    canvas.height = 500;

    const width = canvas.width;
    const height = canvas.height;
    const padding = 45;

    // Clear canvas with gradient background
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, 'rgba(6, 182, 212, 0.1)');
    gradient.addColorStop(1, 'rgba(6, 182, 212, 0.02)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Get first numeric output for graphing
    const numericOutput = outputs.find((o) => o.type === 'number');
    if (!numericOutput) return;

    const values = data.map((d) => Number(d.outputs[numericOutput.id]) || 0);
    const maxValue = Math.max(...values);
    const minValue = Math.min(...values);
    const range = maxValue - minValue || 1;

    // Draw grid with subtle lines
    ctx.strokeStyle = 'rgba(6, 182, 212, 0.15)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 5; i++) {
      const y = padding + ((height - 2 * padding) * i) / 5;
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(width - padding, y);
      ctx.stroke();
      
      // Grid labels
      const labelValue = maxValue - (range * i) / 5;
      ctx.fillStyle = 'rgba(156, 163, 175, 0.8)';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(labelValue.toFixed(1), padding - 8, y + 3);
    }

    // Draw area under the curve
    const areaGradient = ctx.createLinearGradient(0, padding, 0, height - padding);
    areaGradient.addColorStop(0, 'rgba(6, 182, 212, 0.3)');
    areaGradient.addColorStop(1, 'rgba(6, 182, 212, 0.05)');
    
    ctx.fillStyle = areaGradient;
    ctx.beginPath();
    ctx.moveTo(padding, height - padding);
    
    values.forEach((value, index) => {
      const x = padding + ((width - 2 * padding) * index) / (values.length - 1);
      const y = padding + ((maxValue - value) / range) * (height - 2 * padding);
      if (index === 0) {
        ctx.lineTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    
    ctx.lineTo(width - padding, height - padding);
    ctx.closePath();
    ctx.fill();

    // Draw line graph with glow effect
    ctx.shadowBlur = 10;
    ctx.shadowColor = 'rgba(6, 182, 212, 0.5)';
    ctx.strokeStyle = '#06b6d4';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();

    values.forEach((value, index) => {
      const x = padding + ((width - 2 * padding) * index) / (values.length - 1);
      const y = height - padding - ((value - minValue) / range) * (height - 2 * padding);
      
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.stroke();

    // Draw points with glow
    ctx.shadowBlur = 8;
    ctx.shadowColor = 'rgba(6, 182, 212, 0.8)';
    values.forEach((value, index) => {
      const x = padding + ((width - 2 * padding) * index) / (values.length - 1);
      const y = height - padding - ((value - minValue) / range) * (height - 2 * padding);
      
      // Outer glow
      ctx.fillStyle = 'rgba(6, 182, 212, 0.3)';
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, 2 * Math.PI);
      ctx.fill();
      
      // Inner point
      ctx.fillStyle = '#06b6d4';
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, 2 * Math.PI);
      ctx.fill();
      
      // Highlight last point
      if (index === values.length - 1) {
        ctx.fillStyle = 'rgba(6, 182, 212, 0.2)';
        ctx.beginPath();
        ctx.arc(x, y, 10, 0, 2 * Math.PI);
        ctx.fill();
        
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, 2 * Math.PI);
        ctx.fill();
      }
    });

    // Reset shadow
    ctx.shadowBlur = 0;
    
    // Draw title
    ctx.fillStyle = '#06b6d4';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(numericOutput.label, padding, 20);
    
    ctx.textAlign = 'center';
    ctx.fillText(numericOutput.label, width / 2, height - 10);

  }, [data, outputs]);

  return (
    <div className="bg-gradient-to-br from-cyan-900/20 to-blue-900/10 rounded-xl border border-cyan-400/40 p-4 shadow-lg backdrop-blur-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-cyan-300 font-semibold flex items-center gap-2 text-sm">
          <TrendingUp className="h-4 w-4" />
          Real-time Output Trend
        </h3>
        <div className="px-2 py-1 bg-cyan-500/20 rounded border border-cyan-400/30">
          <span className="text-cyan-300 text-xs font-mono">{data.length} points</span>
        </div>
      </div>
      <div className="bg-black/40 rounded-lg p-2 border border-cyan-500/20">
        <canvas ref={canvasRef} className="w-full" style={{ height: '250px' }} />
      </div>
      <p className="text-gray-400 text-xs mt-3 leading-relaxed">
        <span className="text-cyan-300">●</span> Track how outputs change as you adjust inputs over time
      </p>
    </div>
  );
};

/**
 * Domain-specific visualization renderer
 * Renders circuit diagrams for electrical, molecular structures for chemistry, etc.
 */
const renderDomainVisualization = (
  schema: SimulationSchema,
  inputs: { [key: string]: any },
  outputs: { [key: string]: any }
) => {
  const domain = schema.metadata.domain.toLowerCase();

  // Electrical/Electronics domain - render circuit
  if (domain.includes('electric') || domain.includes('circuit') || domain.includes('ohm')) {
    return <CircuitVisualization inputs={inputs} outputs={outputs} schema={schema} />;
  }

  // Physics domain - render force diagrams or energy visualization
  if (domain.includes('physics') || domain.includes('force') || domain.includes('energy')) {
    return <PhysicsVisualization inputs={inputs} outputs={outputs} schema={schema} />;
  }

  // Chemistry domain - render molecular or reaction visualization
  if (domain.includes('chemistry') || domain.includes('chemical') || domain.includes('reaction')) {
    return <ChemistryVisualization inputs={inputs} outputs={outputs} schema={schema} />;
  }

  // Default - render a simple bar chart
  return <BarChartVisualization inputs={inputs} outputs={outputs} schema={schema} />;
};

/**
 * Circuit Visualization for Electrical simulations
 */
const CircuitVisualization: React.FC<{
  inputs: { [key: string]: any };
  outputs: { [key: string]: any };
  schema: SimulationSchema;
}> = ({ inputs, outputs, schema }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [currentFlow, setCurrentFlow] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = canvas.offsetWidth;
    canvas.height = 550;

    const width = canvas.width;
    const height = canvas.height;

    // Clear
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(0, 0, width, height);

    // Draw circuit elements
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;

    // Battery/Power source (left side)
    const batteryX = 80;
    const batteryY = height / 2;
    ctx.strokeStyle = '#fbbf24';
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.rect(batteryX - 20, batteryY - 30, 40, 60);
    ctx.stroke();
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText('+', batteryX - 35, batteryY - 10);
    ctx.fillText('−', batteryX - 35, batteryY + 20);

    // Get voltage value
    const voltageInput = schema.inputs.find((i) => 
      i.label.toLowerCase().includes('voltage') || i.id.includes('voltage')
    );
    const voltage = voltageInput ? inputs[voltageInput.id] : 0;
    ctx.font = '12px sans-serif';
    ctx.fillStyle = '#fbbf24';
    ctx.textAlign = 'center';
    ctx.fillText(`${voltage}V`, batteryX, batteryY + 50);

    // Resistor (right side)
    const resistorX = width - 100;
    const resistorY = height / 2;
    ctx.strokeStyle = '#06b6d4';
    ctx.lineWidth = 2;
    
    // Zigzag resistor shape
    ctx.beginPath();
    ctx.moveTo(resistorX - 30, resistorY);
    for (let i = 0; i < 6; i++) {
      ctx.lineTo(resistorX - 30 + i * 10, resistorY + (i % 2 === 0 ? -15 : 15));
    }
    ctx.lineTo(resistorX + 30, resistorY);
    ctx.stroke();

    // Resistor label
    const resistanceInput = schema.inputs.find((i) => 
      i.label.toLowerCase().includes('resistance') || i.id.includes('resistance')
    );
    const resistance = resistanceInput ? inputs[resistanceInput.id] : 0;
    ctx.fillStyle = '#06b6d4';
    ctx.textAlign = 'center';
    ctx.font = '12px sans-serif';
    ctx.fillText(`${resistance}Ω`, resistorX, resistorY + 35);

    // Connecting wires
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    
    // Top wire
    ctx.beginPath();
    ctx.moveTo(batteryX + 20, batteryY - 30);
    ctx.lineTo(resistorX - 30, batteryY - 30);
    ctx.lineTo(resistorX - 30, resistorY);
    ctx.stroke();

    // Bottom wire
    ctx.beginPath();
    ctx.moveTo(batteryX + 20, batteryY + 30);
    ctx.lineTo(batteryX + 20, height - 80);
    ctx.lineTo(resistorX + 30, height - 80);
    ctx.lineTo(resistorX + 30, resistorY);
    ctx.stroke();

    // Current flow animation
    const currentOutput = schema.outputs.find((o) => 
      o.label.toLowerCase().includes('current') || o.id.includes('current')
    );
    const current = currentOutput ? Number(outputs[currentOutput.id]) || 0 : 0;

    // Animate current flow with electrons
    const drawElectron = (x: number, y: number) => {
      ctx.fillStyle = '#3b82f6';
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, 2 * Math.PI);
      ctx.fill();
      
      // Electron symbol
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('e⁻', x, y + 3);
    };

    // Draw flowing electrons if current exists
    if (current > 0.01) {
      const offset = (Date.now() / 500) % 100;
      // Top path electrons
      drawElectron(batteryX + 20 + offset, batteryY - 30);
      drawElectron(resistorX - 80 + offset, batteryY - 30);
      
      // Bottom path electrons
      drawElectron(batteryX + 20, height - 80 - offset);
      drawElectron(resistorX - 20, height - 80 - offset);
    }

    // Current indicator
    ctx.fillStyle = '#3b82f6';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`Current: ${current.toFixed(3)}A`, width / 2, 30);

    // Power indicator
    const powerOutput = schema.outputs.find((o) => 
      o.label.toLowerCase().includes('power') || o.id.includes('power')
    );
    if (powerOutput) {
      const power = Number(outputs[powerOutput.id]) || 0;
      ctx.fillStyle = '#f59e0b';
      ctx.fillText(`Power: ${power.toFixed(2)}W`, width / 2, 50);
    }

  }, [inputs, outputs, schema, currentFlow]);

  // Animation loop for electron flow
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentFlow((prev) => prev + 1);
    }, 50);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-gradient-to-br from-yellow-900/20 via-amber-900/10 to-orange-900/5 rounded-xl border border-yellow-400/40 p-4 shadow-lg backdrop-blur-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-yellow-300 font-semibold flex items-center gap-2 text-sm">
          <Zap className="h-4 w-4" />
          Circuit Diagram
        </h3>
        <div className="px-2 py-1 bg-yellow-500/20 rounded border border-yellow-400/30">
          <span className="text-yellow-300 text-xs font-mono">Live</span>
        </div>
      </div>
      <div className="bg-black/50 rounded-lg p-2 border border-yellow-500/20">
        <canvas ref={canvasRef} className="w-full" style={{ height: '300px' }} />
      </div>
      <p className="text-gray-400 text-xs mt-3 leading-relaxed">
        <span className="text-yellow-300">⚡</span> Animated circuit showing real-time current flow
      </p>
    </div>
  );
};

/**
 * Physics Visualization
 */
const PhysicsVisualization: React.FC<{
  inputs: { [key: string]: any };
  outputs: { [key: string]: any };
  schema: SimulationSchema;
}> = ({ inputs, outputs, schema }) => {
  return (
    <div className="bg-black/30 rounded-lg border border-purple-400/30 p-4">
      <h3 className="text-purple-300 font-semibold mb-3">Physics Visualization</h3>
      <div className="h-64 flex items-center justify-center text-gray-400">
        <div className="text-center">
          <Activity className="h-12 w-12 mx-auto mb-2" />
          <p>Dynamic physics visualization</p>
        </div>
      </div>
    </div>
  );
};

/**
 * Chemistry Visualization
 */
const ChemistryVisualization: React.FC<{
  inputs: { [key: string]: any };
  outputs: { [key: string]: any };
  schema: SimulationSchema;
}> = ({ inputs, outputs, schema }) => {
  return (
    <div className="bg-black/30 rounded-lg border border-green-400/30 p-4">
      <h3 className="text-green-300 font-semibold mb-3">Chemical Process</h3>
      <div className="h-64 flex items-center justify-center text-gray-400">
        <div className="text-center">
          <Activity className="h-12 w-12 mx-auto mb-2" />
          <p>Molecular visualization</p>
        </div>
      </div>
    </div>
  );
};

/**
 * Default Bar Chart Visualization
 */
const BarChartVisualization: React.FC<{
  inputs: { [key: string]: any };
  outputs: { [key: string]: any };
  schema: SimulationSchema;
}> = ({ inputs, outputs, schema }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = canvas.offsetWidth;
    canvas.height = 300;

    const width = canvas.width;
    const height = canvas.height;
    const padding = 40;

    // Clear
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(0, 0, width, height);

    // Get numeric outputs
    const numericOutputs = schema.outputs.filter((o) => o.type === 'number');
    const barWidth = (width - 2 * padding) / numericOutputs.length - 10;

    numericOutputs.forEach((output, index) => {
      const value = Number(outputs[output.id]) || 0;
      const maxValue = Math.max(...numericOutputs.map((o) => Number(outputs[o.id]) || 0));
      const barHeight = ((height - 2 * padding) * Math.abs(value)) / (maxValue || 1);
      
      const x = padding + index * (barWidth + 10);
      const y = height - padding - barHeight;

      // Draw bar
      const gradient = ctx.createLinearGradient(x, y, x, height - padding);
      gradient.addColorStop(0, '#06b6d4');
      gradient.addColorStop(1, '#3b82f6');
      ctx.fillStyle = gradient;
      ctx.fillRect(x, y, barWidth, barHeight);

      // Draw value on top
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(value.toFixed(2), x + barWidth / 2, y - 5);

      // Draw label
      ctx.fillStyle = '#9ca3af';
      ctx.font = '10px sans-serif';
      ctx.fillText(output.label, x + barWidth / 2, height - padding + 20);
    });

  }, [inputs, outputs, schema]);

  return (
    <div className="bg-black/30 rounded-lg border border-blue-400/30 p-4">
      <h3 className="text-blue-300 font-semibold mb-3">Output Comparison</h3>
      <canvas ref={canvasRef} className="w-full" style={{ height: '300px' }} />
    </div>
  );
};

/**
 * Individual Input Control Component
 * Renders different control types based on input configuration
 */
const InputControl: React.FC<{
  input: InputParameter;
  value: any;
  onChange: (value: any) => void;
}> = ({ input, value, onChange }) => {
  const renderControl = () => {
    switch (input.controlType) {
      case 'slider':
        return (
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-white font-medium">{input.label}</label>
              <span className="text-cyan-300 font-mono">
                {value}
                {input.unit && ` ${input.unit}`}
              </span>
            </div>
            <input
              type="range"
              min={input.min ?? 0}
              max={input.max ?? 100}
              step={input.step ?? 1}
              value={value ?? input.defaultValue}
              onChange={(e) => onChange(parseFloat(e.target.value))}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>{input.min ?? 0}</span>
              <span>{input.max ?? 100}</span>
            </div>
            {input.description && (
              <p className="text-gray-400 text-xs mt-2">{input.description}</p>
            )}
          </div>
        );

      case 'knob':
        return (
          <div>
            <label className="text-white font-medium mb-2 block">{input.label}</label>
            <div className="flex items-center gap-4">
              <div className="relative w-24 h-24">
                <svg viewBox="0 0 100 100" className="transform -rotate-90">
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="none"
                    stroke="#374151"
                    strokeWidth="8"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="none"
                    stroke="#06b6d4"
                    strokeWidth="8"
                    strokeDasharray={`${
                      ((value - (input.min ?? 0)) / ((input.max ?? 100) - (input.min ?? 0))) *
                      251.2
                    } 251.2`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-white font-bold text-lg">{value}</span>
                </div>
              </div>
              <div className="flex-1">
                <input
                  type="range"
                  min={input.min ?? 0}
                  max={input.max ?? 100}
                  step={input.step ?? 1}
                  value={value ?? input.defaultValue}
                  onChange={(e) => onChange(parseFloat(e.target.value))}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                />
                <div className="text-cyan-300 font-mono text-sm mt-2">
                  {input.unit && `${input.unit}`}
                </div>
              </div>
            </div>
            {input.description && (
              <p className="text-gray-400 text-xs mt-2">{input.description}</p>
            )}
          </div>
        );

      case 'switch':
      case 'toggle':
        return (
          <div>
            <div className="flex items-center justify-between">
              <label className="text-white font-medium">{input.label}</label>
              <button
                onClick={() => onChange(!value)}
                className={`relative w-14 h-7 rounded-full transition-all ${
                  value ? 'bg-green-500' : 'bg-gray-600'
                }`}
              >
                <div
                  className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all ${
                    value ? 'right-1' : 'left-1'
                  }`}
                />
              </button>
            </div>
            {input.description && (
              <p className="text-gray-400 text-xs mt-2">{input.description}</p>
            )}
          </div>
        );

      case 'numberField':
        return (
          <div>
            <label className="text-white font-medium mb-2 block">{input.label}</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={input.min}
                max={input.max}
                step={input.step ?? 0.01}
                value={value ?? input.defaultValue}
                onChange={(e) => onChange(parseFloat(e.target.value))}
                className="flex-1 px-4 py-2 bg-gray-800 text-white rounded-lg border border-gray-600 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none"
              />
              {input.unit && <span className="text-gray-400">{input.unit}</span>}
            </div>
            {input.description && (
              <p className="text-gray-400 text-xs mt-2">{input.description}</p>
            )}
          </div>
        );

      case 'dropdown':
        return (
          <div>
            <label className="text-white font-medium mb-2 block">{input.label}</label>
            <select
              value={value ?? input.defaultValue}
              onChange={(e) => onChange(e.target.value)}
              className="w-full px-4 py-2 bg-gray-800 text-white rounded-lg border border-gray-600 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none"
            >
              {input.options?.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {input.description && (
              <p className="text-gray-400 text-xs mt-2">{input.description}</p>
            )}
          </div>
        );

      default:
        return (
          <div className="text-red-400">
            Unsupported control type: {input.controlType}
          </div>
        );
    }
  };

  return <div>{renderControl()}</div>;
};

export default InteractiveSimulationRenderer;
