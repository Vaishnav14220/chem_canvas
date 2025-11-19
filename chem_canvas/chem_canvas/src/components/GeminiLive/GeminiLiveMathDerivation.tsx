import React, { useEffect, useRef, useState } from 'react';
import { ChevronUp, ChevronDown, RotateCcw } from 'lucide-react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

interface DerivationStep {
  title: string;
  latex: string;
  explanation?: string;
}

interface MathematicalDerivationParams {
  title: string;
  steps: DerivationStep[];
  topic?: string;
}

interface GeminiLiveMathDerivationProps {
  params: MathematicalDerivationParams;
}

const GeminiLiveMathDerivation: React.FC<GeminiLiveMathDerivationProps> = ({ params }) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const latexContainerRef = useRef<HTMLDivElement>(null);

  // Ensure steps is valid
  const steps = Array.isArray(params.steps) ? params.steps : [];
  
  if (steps.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gradient-to-b from-slate-900/50 to-slate-950/50 rounded-xl border border-slate-700/50 p-6">
        <div className="text-center">
          <p className="text-slate-400 mb-2">No derivation steps provided</p>
          <p className="text-slate-500 text-sm">{params.title}</p>
        </div>
      </div>
    );
  }

  const currentStep = steps[currentStepIndex];

  // Render LaTeX when step changes
  useEffect(() => {
    if (!latexContainerRef.current || !currentStep) return;

    try {
      // Clear previous content
      latexContainerRef.current.innerHTML = '';

      // Render LaTeX using KaTeX
      const html = katex.renderToString(currentStep.latex, {
        throwOnError: false,
        displayMode: true,
        macros: {
          '\\f': '#1f(#2)',
          '\\derive': '\\frac{d}{d#1}',
          '\\partial': '\\frac{\\partial}{\\partial #1}'
        }
      });

      latexContainerRef.current.innerHTML = html;
    } catch (error) {
      console.error('Error rendering LaTeX:', error);
      if (latexContainerRef.current) {
        latexContainerRef.current.textContent = currentStep.latex;
      }
    }
  }, [currentStep]);

  const goToNextStep = () => {
    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
    }
  };

  const goToPreviousStep = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1);
    }
  };

  const resetSteps = () => {
    setCurrentStepIndex(0);
  };

  const progressPercent = ((currentStepIndex + 1) / steps.length) * 100;

  return (
    <div
      ref={containerRef}
      className="w-full h-full flex flex-col bg-gradient-to-b from-slate-900/50 to-slate-950/50 rounded-xl border border-slate-700/50 p-6 overflow-hidden"
    >
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-start justify-between mb-2">
          <div>
            <h3 className="text-lg font-bold text-white mb-1">{params.title}</h3>
            {params.topic && (
              <p className="text-xs text-slate-400">{params.topic}</p>
            )}
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold text-molecule-teal">
              Step {currentStepIndex + 1} of {steps.length}
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-molecule-teal to-molecule-purple transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* LaTeX Display Area */}
      <div className="flex-1 flex items-center justify-center bg-slate-900/30 rounded-lg border border-slate-700/30 p-6 overflow-auto mb-6">
        <div
          ref={latexContainerRef}
          className="text-white text-center max-w-full"
          style={{
            fontSize: '1.5rem',
            lineHeight: '1.8'
          }}
        />
      </div>

      {/* Step Title and Explanation */}
      <div className="mb-6 bg-slate-900/50 rounded-lg border border-slate-700/30 p-4">
        <p className="text-sm font-semibold text-slate-300 mb-2">
          {currentStep.title}
        </p>
        {currentStep.explanation && (
          <p className="text-sm text-slate-400 leading-relaxed">
            {currentStep.explanation}
          </p>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={goToPreviousStep}
          disabled={currentStepIndex === 0}
          className="p-2 rounded-lg bg-slate-800/50 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          title="Previous step"
        >
          <ChevronUp size={20} />
        </button>

        <button
          onClick={resetSteps}
          disabled={currentStepIndex === 0}
          className="px-4 py-2 rounded-lg bg-slate-800/50 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm font-medium flex items-center gap-2"
        >
          <RotateCcw size={16} />
          Reset
        </button>

        <button
          onClick={goToNextStep}
          disabled={currentStepIndex === steps.length - 1}
          className="p-2 rounded-lg bg-slate-800/50 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          title="Next step"
        >
          <ChevronDown size={20} />
        </button>
      </div>

      {/* Step Indicators */}
      <div className="mt-4 flex gap-1 justify-center flex-wrap">
        {steps.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentStepIndex(index)}
            className={`h-2 rounded-full transition-all ${
              index === currentStepIndex
                ? 'w-8 bg-molecule-teal'
                : 'w-2 bg-slate-700 hover:bg-slate-600'
            }`}
            title={`Go to step ${index + 1}`}
          />
        ))}
      </div>
    </div>
  );
};

export default GeminiLiveMathDerivation;
