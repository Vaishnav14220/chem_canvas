import React, { useEffect, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Sparkles } from 'lucide-react';
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
  const steps = Array.isArray(params.steps) ? params.steps : [];
  const [visibleCount, setVisibleCount] = useState(0);

  // Reveal steps sequentially to mimic real-time writing on the canvas
  useEffect(() => {
    if (!steps.length) {
      setVisibleCount(0);
      return;
    }

    let isCancelled = false;
    const timers: number[] = [];
    setVisibleCount(0);

    const reveal = (index: number) => {
      if (isCancelled) return;
      setVisibleCount(prev => Math.max(prev, index + 1));
      if (index + 1 < steps.length) {
        const timerId = window.setTimeout(() => reveal(index + 1), 900);
        timers.push(timerId);
      }
    };

    const startTimer = window.setTimeout(() => reveal(0), 350);
    timers.push(startTimer);

    return () => {
      isCancelled = true;
      timers.forEach(id => window.clearTimeout(id));
    };
  }, [steps]);

  const visibleSteps = useMemo(() => steps.slice(0, visibleCount), [steps, visibleCount]);
  const progress = steps.length ? (visibleCount / steps.length) * 100 : 0;

  if (!steps.length) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gradient-to-b from-slate-900/50 to-slate-950/70 rounded-2xl border border-slate-800/50 p-6">
        <div className="text-center space-y-2">
          <Sparkles className="mx-auto text-slate-500" size={28} />
          <p className="text-slate-400">Waiting for math derivation…</p>
          <p className="text-slate-500 text-sm">{params.title}</p>
        </div>
      </div>
    );
  }

  const renderStepMarkdown = (step: DerivationStep, index: number) => {
    const heading = step.title ? `### ${step.title}` : `### Step ${index + 1}`;
    const explanation = step.explanation ?? '';
    const equation = step.latex ? `\n\n$$${step.latex}$$` : '';
    return `${heading}\n\n${explanation}${equation}`.trim();
  };

  return (
    <div className="w-full h-full flex flex-col bg-gradient-to-b from-slate-950/40 via-slate-900/20 to-slate-950/80 rounded-3xl border border-slate-800/60 overflow-hidden">
      <div className="px-6 pt-6 pb-4 border-b border-slate-800/60 bg-slate-950/40 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-cyan-400/80 mb-1">Live Math Canvas</p>
          <h3 className="text-xl font-semibold text-white flex items-center gap-2">
            <Sparkles size={18} className="text-cyan-300" />
            {params.title}
          </h3>
          {params.topic && <p className="text-xs text-slate-400">{params.topic}</p>}
        </div>
        <div className="text-right">
          <p className="text-sm text-slate-300 font-semibold">{visibleCount}/{steps.length} steps streaming</p>
          <div className="mt-2 w-40 h-1.5 bg-slate-900 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-cyan-400 via-blue-500 to-violet-500 transition-all duration-300"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>
      </div>

      <div className="relative flex-1 overflow-auto">
        <div className="absolute left-10 top-0 bottom-0 w-px bg-gradient-to-b from-cyan-500/40 via-transparent to-blue-500/30 pointer-events-none" />
        <div className="space-y-6 py-8 pr-6 pl-16">
          {visibleSteps.map((step, index) => (
            <div key={`${step.title}-${index}`} className="relative group">
              <div className="absolute -left-10 top-5 w-3 h-3 rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 shadow-[0_0_15px_3px_rgba(14,165,233,0.35)]" />
              <div className="absolute -left-10 top-8 bottom-[-1.5rem] w-px bg-slate-800/40" aria-hidden />
              <div
                className="bg-slate-900/70 border border-slate-700/60 rounded-2xl shadow-xl shadow-cyan-950/20 p-5 backdrop-blur-sm animate-flow-fade"
                style={{ animationDelay: `${index * 0.12}s` }}
              >
                <div className="flex items-center justify-between text-xs uppercase tracking-wide text-slate-400 mb-4">
                  <span>Step {index + 1}</span>
                  <span>{params.topic ?? 'Mathematics'}</span>
                </div>
                <ReactMarkdown
                  remarkPlugins={[remarkGfm, remarkMath]}
                  rehypePlugins={[rehypeKatex]}
                  components={{
                    h3: ({ node: _node, ...props }) => (
                      <h3 className="text-lg font-semibold text-white mb-3" {...props} />
                    ),
                    p: ({ node: _node, ...props }) => (
                      <p className="text-sm text-slate-300 leading-relaxed mb-3" {...props} />
                    ),
                    strong: ({ node: _node, ...props }) => (
                      <strong className="text-white font-semibold" {...props} />
                    ),
                    em: ({ node: _node, ...props }) => (
                      <em className="text-slate-200" {...props} />
                    ),
                    ul: ({ node: _node, ...props }) => (
                      <ul className="list-disc pl-5 text-sm text-slate-300 space-y-1 mb-3" {...props} />
                    ),
                    ol: ({ node: _node, ...props }) => (
                      <ol className="list-decimal pl-5 text-sm text-slate-300 space-y-1 mb-3" {...props} />
                    ),
                    li: ({ node: _node, ...props }) => (
                      <li className="leading-relaxed" {...props} />
                    ),
                    code: ({ node: _node, inline, ...props }: any) => (
                      <code
                        className={`px-1.5 py-0.5 rounded bg-slate-800/60 text-cyan-300 text-xs ${inline ? '' : 'block mt-2'}`}
                        {...props}
                      />
                    ),
                  }}
                >
                  {renderStepMarkdown(step, index)}
                </ReactMarkdown>
              </div>
            </div>
          ))}

          {visibleCount < steps.length && (
            <div className="pl-6 text-slate-500 text-sm italic animate-pulse">…listening for the next mathematical insight</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GeminiLiveMathDerivation;
