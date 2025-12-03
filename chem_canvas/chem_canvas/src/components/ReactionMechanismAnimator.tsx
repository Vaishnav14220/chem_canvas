import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, Search, Sparkles, FlaskConical, Beaker } from 'lucide-react';
import ReactionMechanismScene from './ReactionMechanismScene';
import { resolveReactionQuery, type ReactionComponentDetails, type ReactionResolutionResult } from '../services/reactionResolver';

const STAGE_INFO: Array<{
  key: ReactionComponentDetails['role'];
  label: string;
  colour: string;
}> = [
  { key: 'reactant', label: 'Reactants', colour: '#c084fc' },
  { key: 'agent', label: 'Reagents & catalysts', colour: '#34d399' },
  { key: 'product', label: 'Products', colour: '#38bdf8' }
];

const SAMPLE_PROMPTS = [
  'Friedel-Crafts acylation of benzene with acetyl chloride',
  'Suzuki coupling between bromobenzene and phenylboronic acid',
  'Diels–Alder reaction: cyclopentadiene + maleic anhydride'
];

interface ReactionMechanismAnimatorProps {
  onScriptChange?: (script: string) => void;
  className?: string;
  initialQuery?: string;
  searchTrigger?: number;
  onResolutionChange?: (resolution: ReactionResolutionResult | null) => void;
}

const buildViewerScript = (smiles: string) =>
  `load $${smiles};
wireframe 0.18;
spacefill 18%;
color cpk;
spin y 3;`;

const ReactionMechanismAnimator: React.FC<ReactionMechanismAnimatorProps> = ({
  onScriptChange,
  className,
  initialQuery,
  searchTrigger,
  onResolutionChange,
}) => {
  const [query, setQuery] = useState('');
  const [resolution, setResolution] = useState<ReactionResolutionResult | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [lastPrompt, setLastPrompt] = useState<string | null>(null);

  const isLoading = status === 'loading';

  const groupedComponents = useMemo(
    () =>
      STAGE_INFO.map(stage => ({
        ...stage,
        components: resolution?.components.filter(component => component.role === stage.key) ?? []
      })),
    [resolution]
  );

  const handleSearch = async (prompt?: string) => {
    const value = (prompt ?? query).trim();
    if (!value) {
      setError('Describe a reaction to animate.');
      setResolution(null);
      return;
    }

    setStatus('loading');
    onResolutionChange?.(null);
    setError(null);
    try {
      const result = await resolveReactionQuery(value);
      if (!result) {
        setResolution(null);
        setError('No reaction could be generated. Please refine your description.');
        return;
      }

      setResolution(result);
      onResolutionChange?.(result);
      setLastPrompt(value);
    } catch (err) {
      console.error('Failed to resolve reaction:', err);
      setResolution(null);
      onResolutionChange?.(null);
      setError(err instanceof Error ? err.message : 'Unable to resolve the reaction. Check your Gemini key.');
    } finally {
      setStatus('idle');
    }
  };

  const handleComponentView = (component: ReactionComponentDetails) => {
    if (!onScriptChange) return;
    const smiles = component.smiles ?? component.canonicalSmiles;
    if (!smiles) return;
    onScriptChange(buildViewerScript(smiles.replace(/"/g, '')));
  };

  const containerClassName = className
    ? `${className} space-y-4`
    : 'bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-4';

  useEffect(() => {
    if (!initialQuery) {
      return;
    }
    setQuery(initialQuery);
    void handleSearch(initialQuery);
  }, [initialQuery, searchTrigger]);

  return (
    <div className={containerClassName}>
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-pink-600 to-purple-600 text-white">
          <FlaskConical className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white">AI Reaction Animator</h3>
          <p className="text-xs text-slate-400">
            Uses Gemini-powered reaction search to populate the mechanism viewer with any named or described transformation.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="e.g. Aldol condensation between acetone and benzaldehyde"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void handleSearch();
                }
              }}
            />
          </div>
          <button
            onClick={() => void handleSearch()}
            disabled={isLoading}
            className="inline-flex items-center justify-center rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-purple-500 disabled:opacity-60"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {SAMPLE_PROMPTS.map(sample => (
            <button
              key={sample}
              onClick={() => {
                setQuery(sample);
                void handleSearch(sample);
              }}
              className="rounded-full border border-slate-700/70 px-3 py-1 text-[11px] text-slate-300 hover:border-purple-500 hover:text-white"
            >
              {sample}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-500/60 bg-rose-950/40 px-3 py-2 text-xs text-rose-100">
          {error}
        </div>
      )}

      {resolution ? (
        <div className="space-y-3">
          <ReactionMechanismScene resolution={resolution} />

          <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3 text-xs text-slate-200 space-y-1">
            <div className="flex items-center justify-between text-white text-sm font-semibold">
              <span>{resolution.reactionName ?? 'Resolved reaction'}</span>
              {resolution.confidence !== undefined && (
                <span className="text-slate-400">Confidence {(resolution.confidence * 100).toFixed(0)}%</span>
              )}
            </div>
            {lastPrompt && (
              <p className="text-slate-400">
                Prompt:&nbsp;
                <span className="text-white">{lastPrompt}</span>
              </p>
            )}
            {resolution.notes && <p className="text-amber-200">{resolution.notes}</p>}
            {resolution.conditions && resolution.conditions.length > 0 && (
              <p className="text-slate-300">
                Conditions: {resolution.conditions.join(', ')}
              </p>
            )}
          </div>

          <div className="space-y-3">
            {groupedComponents.map(stage => (
              <div key={stage.key} className="rounded-xl border border-slate-800/80 bg-slate-900/80 p-3">
                <div className="flex items-center gap-2 text-xs font-semibold" style={{ color: stage.colour }}>
                  <Beaker className="h-3.5 w-3.5" />
                  {stage.label}
                </div>
                {stage.components.length === 0 ? (
                  <p className="mt-2 text-[11px] text-slate-400">No entries</p>
                ) : (
                  <ul className="mt-2 space-y-2 text-sm text-white">
                    {stage.components.map((component, index) => (
                      <li key={`${stage.key}-${index}`} className="rounded-lg border border-slate-800/80 bg-slate-950/40 p-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-white">
                              {component.label ?? component.original ?? `Component ${index + 1}`}
                            </p>
                            {component.smiles && (
                              <p className="font-mono text-[11px] text-slate-400 break-all">{component.smiles}</p>
                            )}
                            {!component.smiles && component.notes && (
                              <p className="text-[11px] text-amber-300">{component.notes}</p>
                            )}
                          </div>
                          {component.smiles && onScriptChange && (
                            <button
                              onClick={() => handleComponentView(component)}
                              className="rounded-md border border-slate-700 px-2 py-1 text-[11px] text-slate-200 hover:border-purple-400 hover:text-white"
                            >
                              View in 3D
                            </button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-700/70 bg-slate-900/70 p-6 text-center text-sm text-slate-400">
          Describe a named reaction, reagents + products, or paste reaction SMILES. Gemini will assemble the components and the mechanism view will animate them in 3D.
        </div>
      )}
    </div>
  );
};

export default ReactionMechanismAnimator;
