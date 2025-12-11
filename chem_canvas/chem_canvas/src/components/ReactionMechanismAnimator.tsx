import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Loader2, Search, Sparkles, FlaskConical, Beaker, Play, Pause, SkipBack, SkipForward, RotateCcw, Repeat, Square, Eye, EyeOff, Film } from 'lucide-react';
import ReactionMechanismScene from './ReactionMechanismScene';
import { resolveReactionQuery, generateReactionAnimationFrames, buildAnimationScript, type ReactionComponentDetails, type ReactionResolutionResult } from '../services/reactionResolver';
import { findMechanismTemplate } from '../data/mechanismTemplates';


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
  'SN2 reaction of bromomethane with hydroxide',
  'Diels–Alder reaction: cyclopentadiene + maleic anhydride',
  'Aldol condensation between acetone and benzaldehyde'
];

// ChemTube3D-style display modes
type DisplayMode = 'ballstick' | 'spacefill' | 'sticks';

const DISPLAY_MODES: Array<{ id: DisplayMode; label: string; script: string }> = [
  { id: 'ballstick', label: 'Ball & Stick', script: 'select all; spacefill 20%; wireframe 0.15;' },
  { id: 'spacefill', label: 'Spacefill', script: 'select all; spacefill 100%; wireframe off;' },
  { id: 'sticks', label: 'Sticks', script: 'select all; spacefill off; wireframe 0.1;' },
];

// Animation mode types
type AnimationMode = 'once' | 'loop' | 'palindrome';

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

  // ChemTube3D-style animation state
  const [isPlaying, setIsPlaying] = useState(false);
  const [animationMode, setAnimationMode] = useState<AnimationMode>('once');
  const [currentStageIndex, setCurrentStageIndex] = useState(0);
  const [displayMode, setDisplayMode] = useState<DisplayMode>('ballstick');
  const [showHydrogens, setShowHydrogens] = useState(true);

  // ChemTube3D mechanism animation state
  const [mechanismAnimating, setMechanismAnimating] = useState(false);
  const [mechanismLoading, setMechanismLoading] = useState(false);

  const isLoading = status === 'loading';

  const groupedComponents = useMemo(
    () =>
      STAGE_INFO.map(stage => ({
        ...stage,
        components: resolution?.components.filter(component => component.role === stage.key) ?? []
      })),
    [resolution]
  );

  // Get all viewable components (those with SMILES)
  const viewableComponents = useMemo(() => {
    if (!resolution?.components) return [];
    return resolution.components.filter(c => c.smiles || c.canonicalSmiles);
  }, [resolution]);

  // ChemTube3D-style animation controls
  const playAnimation = useCallback(() => {
    if (!onScriptChange || viewableComponents.length === 0) return;
    setIsPlaying(true);

    const modeCommand = animationMode === 'loop'
      ? 'anim mode loop 1 2;'
      : animationMode === 'palindrome'
        ? 'anim mode palindrome 1 2;'
        : 'anim mode once;';

    onScriptChange(`${modeCommand} delay 0.5; frame play;`);
  }, [onScriptChange, animationMode, viewableComponents]);

  const stopAnimation = useCallback(() => {
    if (!onScriptChange) return;
    setIsPlaying(false);
    onScriptChange('anim off;');
  }, [onScriptChange]);

  const rewindAnimation = useCallback(() => {
    if (!onScriptChange) return;
    setCurrentStageIndex(0);
    onScriptChange('anim rewind;');

    // Load first component
    if (viewableComponents.length > 0) {
      const smiles = viewableComponents[0].smiles ?? viewableComponents[0].canonicalSmiles;
      if (smiles) {
        onScriptChange(buildViewerScript(smiles.replace(/"/g, '')));
      }
    }
  }, [onScriptChange, viewableComponents]);

  const nextFrame = useCallback(() => {
    if (!onScriptChange || viewableComponents.length === 0) return;
    const nextIndex = Math.min(currentStageIndex + 1, viewableComponents.length - 1);
    setCurrentStageIndex(nextIndex);

    const smiles = viewableComponents[nextIndex].smiles ?? viewableComponents[nextIndex].canonicalSmiles;
    if (smiles) {
      onScriptChange(buildViewerScript(smiles.replace(/"/g, '')));
    }
  }, [onScriptChange, currentStageIndex, viewableComponents]);

  const prevFrame = useCallback(() => {
    if (!onScriptChange || viewableComponents.length === 0) return;
    const prevIndex = Math.max(currentStageIndex - 1, 0);
    setCurrentStageIndex(prevIndex);

    const smiles = viewableComponents[prevIndex].smiles ?? viewableComponents[prevIndex].canonicalSmiles;
    if (smiles) {
      onScriptChange(buildViewerScript(smiles.replace(/"/g, '')));
    }
  }, [onScriptChange, currentStageIndex, viewableComponents]);

  const applyDisplayMode = useCallback((mode: DisplayMode) => {
    if (!onScriptChange) return;
    setDisplayMode(mode);
    const modeConfig = DISPLAY_MODES.find(m => m.id === mode);
    if (modeConfig) {
      onScriptChange(modeConfig.script);
    }
  }, [onScriptChange]);

  const toggleHydrogens = useCallback(() => {
    if (!onScriptChange) return;
    const newValue = !showHydrogens;
    setShowHydrogens(newValue);
    onScriptChange(`select all; set showHydrogens ${newValue ? 'TRUE' : 'FALSE'};`);
  }, [onScriptChange, showHydrogens]);

  // ChemTube3D-style mechanism animation (multi-frame XYZ)
  const playMechanismAnimation = useCallback(async () => {
    if (!onScriptChange || !lastPrompt) {
      setError('Search for a reaction first to generate the mechanism animation.');
      return;
    }

    if (mechanismAnimating) {
      // Stop animation
      setMechanismAnimating(false);
      onScriptChange('anim off;');
      return;
    }

    setMechanismLoading(true);
    setError(null);

    try {
      // FIRST: Check for pre-computed template animations (like ChemTube3D)
      const template = findMechanismTemplate(lastPrompt);

      if (template) {
        console.log('Using pre-computed template:', template.description);
        const script = buildAnimationScript(template.animation);
        setMechanismAnimating(true);
        setMechanismLoading(false);
        onScriptChange(script);
        return;
      }

      // FALLBACK: Try AI-generated animation frames
      const xyzData = await generateReactionAnimationFrames(lastPrompt);

      if (xyzData) {
        const script = buildAnimationScript(xyzData);
        setMechanismAnimating(true);
        onScriptChange(script);
      } else {
        // Final fallback: use JSmol's frame animation on current model
        setMechanismAnimating(true);
        onScriptChange('anim mode palindrome; delay 0.5; frame play;');
        setError('Using basic animation. For best results, try SN2, Diels-Alder, or E2 reactions.');
      }
    } catch (err) {
      console.error('Mechanism animation failed:', err);
      setError('Failed to generate mechanism animation. Try SN2 or Diels-Alder for pre-computed animations.');
    } finally {
      setMechanismLoading(false);
    }
  }, [onScriptChange, lastPrompt, mechanismAnimating]);


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

          {/* ChemTube3D-style Animation Controls */}
          {viewableComponents.length > 0 && (
            <div className="rounded-xl border border-purple-500/40 bg-slate-900/90 p-3 space-y-3">
              {/* Progress Indicator */}
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-400">Stage:</span>
                <span className="text-white font-medium">{currentStageIndex + 1} / {viewableComponents.length}</span>
                <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-300"
                    style={{ width: `${((currentStageIndex + 1) / viewableComponents.length) * 100}%` }}
                  />
                </div>
              </div>

              {/* Playback Controls */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={rewindAnimation}
                  className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white text-[11px]"
                  title="First Frame"
                >
                  <RotateCcw className="h-3 w-3" />
                </button>
                <button
                  onClick={prevFrame}
                  disabled={currentStageIndex === 0}
                  className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white disabled:opacity-40 text-[11px]"
                  title="Previous"
                >
                  <SkipBack className="h-3 w-3" />
                </button>
                <button
                  onClick={isPlaying ? stopAnimation : playAnimation}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium ${isPlaying
                    ? 'bg-amber-600 text-white hover:bg-amber-500'
                    : 'bg-green-600 text-white hover:bg-green-500'
                    }`}
                >
                  {isPlaying ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                  {isPlaying ? 'Pause' : 'Play'}
                </button>
                <button
                  onClick={nextFrame}
                  disabled={currentStageIndex >= viewableComponents.length - 1}
                  className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white disabled:opacity-40 text-[11px]"
                  title="Next"
                >
                  <SkipForward className="h-3 w-3" />
                </button>
                <button
                  onClick={stopAnimation}
                  className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white text-[11px]"
                  title="Stop"
                >
                  <Square className="h-3 w-3" />
                </button>

                {/* Animation Mode Toggle */}
                <div className="flex items-center gap-1 ml-auto">
                  {(['once', 'loop', 'palindrome'] as AnimationMode[]).map(mode => (
                    <button
                      key={mode}
                      onClick={() => setAnimationMode(mode)}
                      className={`px-2 py-1 rounded text-[10px] ${animationMode === mode
                        ? 'bg-purple-600 text-white'
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                        }`}
                    >
                      {mode === 'once' ? 'Once' : mode === 'loop' ? 'Loop' : '↔️'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Display Controls */}
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider">Display:</span>
                {DISPLAY_MODES.map(mode => (
                  <button
                    key={mode.id}
                    onClick={() => applyDisplayMode(mode.id)}
                    className={`px-2 py-1 rounded text-[10px] ${displayMode === mode.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                  >
                    {mode.label}
                  </button>
                ))}
                <button
                  onClick={toggleHydrogens}
                  className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] ml-auto ${showHydrogens ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'
                    }`}
                >
                  {showHydrogens ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                  H
                </button>
              </div>

              {/* ChemTube3D Mechanism Animation */}
              <div className="pt-2 border-t border-slate-800">
                <button
                  onClick={() => void playMechanismAnimation()}
                  disabled={mechanismLoading || !lastPrompt}
                  className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition ${mechanismAnimating
                    ? 'bg-rose-600 text-white hover:bg-rose-500'
                    : mechanismLoading
                      ? 'bg-slate-700 text-slate-400 cursor-wait'
                      : 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-500 hover:to-pink-500'
                    }`}
                >
                  {mechanismLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Generating Animation...
                    </>
                  ) : mechanismAnimating ? (
                    <>
                      <Square className="h-4 w-4" />
                      Stop Mechanism
                    </>
                  ) : (
                    <>
                      <Film className="h-4 w-4" />
                      Play Full Mechanism (ChemTube3D Style)
                    </>
                  )}
                </button>
                <p className="text-[10px] text-slate-500 mt-1 text-center">
                  AI generates multi-frame 3D animation showing reactants approaching → transition state → products
                </p>
              </div>
            </div>
          )}

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
