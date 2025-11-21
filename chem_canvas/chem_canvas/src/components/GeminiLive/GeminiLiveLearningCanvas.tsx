import React, { useCallback, useEffect, useMemo, useState } from 'react';
import katex from 'katex';
import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeRaw from 'rehype-raw';
import rehypeKatex from 'rehype-katex';
import { CheckCircle2, Circle, Image as ImageIcon, Loader2, Sparkles } from 'lucide-react';
import 'katex/dist/katex.min.css';
import { LearningCanvasImage, LearningCanvasParams } from './types';

interface GeminiLiveLearningCanvasProps {
  params: LearningCanvasParams;
  onExpandImage?: (image: LearningCanvasImage) => void;
}

const mergeClassNames = (...classes: (string | undefined)[]) => classes.filter(Boolean).join(' ');

const GeminiLiveLearningCanvas: React.FC<GeminiLiveLearningCanvasProps> = ({ params, onExpandImage }) => {
  const steps = Array.isArray(params.steps) ? params.steps : [];
  const conceptImage = params.image;
  const [visibleCount, setVisibleCount] = useState(0);
  const [stepConfirmations, setStepConfirmations] = useState<boolean[]>([]);
  const remarkPlugins = useMemo(() => [remarkGfm, remarkMath], []);
  const rehypePlugins = useMemo(() => [rehypeRaw, rehypeKatex], []);
  const markdownComponents = useMemo<Components>(() => ({
    h1: ({ node: _node, className, ...props }) => <h1 {...props} className={mergeClassNames('text-2xl font-semibold text-slate-100', className)} />,
    h2: ({ node: _node, className, ...props }) => <h2 {...props} className={mergeClassNames('text-xl font-semibold text-slate-100', className)} />,
    h3: ({ node: _node, className, ...props }) => <h3 {...props} className={mergeClassNames('text-lg font-semibold text-slate-100', className)} />,
    code: ({ node: _node, inline, className, children, ...props }: any) => {
      const codeContent = String(children).replace(/\n$/, '');
      if (inline) {
        return (
          <code
            {...props}
            className={mergeClassNames('px-1 py-0.5 rounded bg-slate-900/70 text-cyan-200', className)}
          >
            {codeContent}
          </code>
        );
      }
      return (
        <pre
          {...props}
          className={mergeClassNames('rounded-2xl border border-slate-800/60 bg-slate-900/60 p-4 text-sm text-slate-200 overflow-auto', className)}
        >
          <code>{codeContent}</code>
        </pre>
      );
    },
    table: ({ node: _node, className, ...props }) => (
      <div className="overflow-x-auto rounded-2xl border border-slate-800/40">
        <table {...props} className={mergeClassNames('w-full text-sm text-left text-slate-200', className)} />
      </div>
    ),
    a: ({ node: _node, className, target, rel, ...props }) => (
      <a
        {...props}
        className={mergeClassNames('text-cyan-300 underline underline-offset-4 hover:text-cyan-200', className)}
        target={target ?? '_blank'}
        rel={rel ?? 'noreferrer noopener'}
      />
    )
  }), []);

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

  useEffect(() => {
    setStepConfirmations(Array.from({ length: steps.length }, () => false));
  }, [steps]);

  const toggleConfirmation = useCallback((index: number) => {
    setStepConfirmations(prev => prev.map((confirmed, idx) => (idx === index ? !confirmed : confirmed)));
  }, []);

  const visibleSteps = useMemo(() => steps.slice(0, visibleCount), [steps, visibleCount]);
  const progress = steps.length ? (visibleCount / steps.length) * 100 : 0;


  const renderConceptImage = () => {
    if (!conceptImage) return null;

    if (conceptImage.status === 'loading') {
      return (
        <div className="relative w-full aspect-video rounded-3xl border border-slate-800/60 bg-gradient-to-br from-slate-900/80 via-slate-900/70 to-slate-950/80 shadow-2xl overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,#0f172a,_#020617)] opacity-70" />
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shadow-sweep" />
          <div className="relative z-10 h-full w-full flex flex-col items-center justify-center gap-4 text-slate-200">
            <div className="flex items-center gap-2 text-cyan-300">
              <Loader2 className="animate-spin" size={20} />
              <span className="text-sm uppercase tracking-[0.4em] text-cyan-200/70">Generating Visual</span>
            </div>
            <div className="w-20 h-20 rounded-full border border-cyan-400/40 shadow-[0_0_35px_rgba(8,145,178,0.35)] flex items-center justify-center">
              <ImageIcon size={34} className="text-cyan-200" />
            </div>
            <p className="text-center text-sm text-slate-400 max-w-xl px-8">
              {conceptImage.prompt || `Creating an illustrative snapshot for ${conceptImage.concept ?? 'this concept'}…`}
            </p>
          </div>
        </div>
      );
    }

    if (conceptImage.status === 'complete' && conceptImage.url) {
      const interactiveProps = onExpandImage
        ? {
            role: 'button' as const,
            tabIndex: 0,
            onClick: () => onExpandImage(conceptImage),
            onKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onExpandImage(conceptImage);
              }
            },
            'aria-label': 'Expand concept image'
          }
        : {};

      return (
        <div
          className={`overflow-hidden rounded-3xl border border-slate-800/60 bg-slate-900/40 shadow-2xl shadow-cyan-950/40 ${
            onExpandImage ? 'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/80 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950' : ''
          }`}
          {...interactiveProps}
        >
          <div className="w-full aspect-video">
            <img
              src={conceptImage.url}
              alt={conceptImage.alt || conceptImage.concept || 'AI generated concept illustration'}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          </div>
          {onExpandImage && <span className="sr-only">Expand concept image</span>}
        </div>
      );
    }

    if (conceptImage.status === 'error') {
      return (
        <div className="rounded-3xl border border-red-500/40 bg-red-950/40 p-6 shadow-lg shadow-red-950/30">
          <p className="text-sm text-red-200 font-semibold">Could not generate the concept image.</p>
          {conceptImage.message && <p className="text-xs text-red-200/80 mt-2">{conceptImage.message}</p>}
        </div>
      );
    }

    return null;
  };

  if (!steps.length && !conceptImage) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gradient-to-b from-slate-900/50 to-slate-950/70 rounded-2xl border border-slate-800/50 p-6">
        <div className="text-center space-y-2">
          <Sparkles className="mx-auto text-slate-500" size={28} />
          <p className="text-slate-400">Waiting for explanation…</p>
          <p className="text-slate-500 text-sm">{params.title}</p>
        </div>
      </div>
    );
  }

  const progressMeta = (
    <div className="text-left sm:text-right">
      <p className="text-[0.65rem] uppercase tracking-[0.25em] text-slate-500">Progress</p>
      <p className="text-sm font-semibold text-white">{visibleCount}/{steps.length} steps</p>
      <div className="mt-1 h-1 w-32 rounded-full bg-slate-900">
        <div
          className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-blue-500 to-violet-500"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );

  return (
    <div className="w-full h-full flex flex-col gap-5 bg-transparent">
      {renderConceptImage()}

      <div className="rounded-3xl border border-slate-800/60 bg-gradient-to-b from-slate-950/60 via-slate-950/30 to-slate-950/60 shadow-2xl shadow-cyan-950/40">
        <div className="flex flex-col gap-2 border-b border-slate-800/60 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-300">{params.title || 'Live Learning Canvas'}</p>
            {params.topic && <p className="text-[0.7rem] text-slate-400">{params.topic}</p>}
          </div>
          {progressMeta}
        </div>
        <div className="px-6 py-6 space-y-6">
          {visibleSteps.length === 0 && (
            <p className="text-sm text-slate-400 italic">Waiting for the tutor to populate the canvas…</p>
          )}
          {visibleSteps.map((step, index) => {
            const isConfirmed = stepConfirmations[index] ?? false;
            return (
              <section key={`${step.title}-${index}`} className="rounded-2xl border border-slate-800/60 bg-slate-950/50 p-5 shadow-inner shadow-black/20">
                <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <span className="text-[0.65rem] uppercase tracking-[0.35em] text-slate-500">Step {index + 1}</span>
                    <h3 className="text-lg font-semibold text-white mt-1">{step.title || `Step ${index + 1}`}</h3>
                  </div>
                  <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-cyan-200">
                    <Sparkles size={14} />
                    Live Canvas
                  </span>
                </header>
                <div className="mt-4 space-y-4">
                  {step.explanation ? (
                    <div className="prose prose-slate dark:prose-invert max-w-none text-sm leading-relaxed">
                      <ReactMarkdown
                        remarkPlugins={remarkPlugins}
                        rehypePlugins={rehypePlugins}
                        components={markdownComponents}
                        skipHtml={false}
                      >
                        {step.explanation}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400 italic">Explanation incoming…</p>
                  )}
                  {step.latex && (
                    <div
                      className="learning-canvas-equation rounded-2xl border border-slate-800/60 bg-slate-950/70 px-4 py-3 text-center"
                      dangerouslySetInnerHTML={{
                        __html: katex.renderToString(step.latex, {
                          throwOnError: false,
                          displayMode: true
                        })
                      }}
                    />
                  )}
                </div>
                <footer className="mt-5 flex flex-col gap-3 border-t border-slate-800/50 pt-4 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2">
                    {isConfirmed ? <CheckCircle2 size={14} className="text-emerald-300" /> : <Circle size={14} className="text-slate-600" />}
                    <div className="text-left">
                      <p className="font-semibold text-slate-200">
                        {isConfirmed ? 'Learner confirmed' : 'Awaiting learner confirmation'}
                      </p>
                      <p className="text-[0.7rem] text-slate-500">{params.topic ?? 'Learning module'}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleConfirmation(index)}
                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[0.7rem] font-semibold transition ${
                      isConfirmed
                        ? 'border-emerald-400/50 bg-emerald-500/10 text-emerald-200'
                        : 'border-slate-700/70 text-slate-300 hover:border-cyan-400/50 hover:text-cyan-200'
                    }`}
                  >
                    {isConfirmed ? 'Mark as pending' : 'Mark confirmed'}
                  </button>
                </footer>
              </section>
            );
          })}
        </div>
      </div>

    </div>
  );
};

export default GeminiLiveLearningCanvas;

