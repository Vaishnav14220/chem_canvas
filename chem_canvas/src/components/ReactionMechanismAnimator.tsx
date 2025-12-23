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
    ? `${className}`
    : 'bg-[#171717] p-4';

  useEffect(() => {
    if (!initialQuery) {
      return;
    }
    setQuery(initialQuery);
    void handleSearch(initialQuery);
  }, [initialQuery, searchTrigger]);

  return (
    <div className={containerClassName}>
      <div className="flex items-center gap-3 mb-4">
        <div className="flex h-10 w-10 items-center justify-center bg-gradient-to-br from-pink-600 to-purple-600 text-white">
          <FlaskConical className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white">AI Reaction Animator</h3>
        </div>
      </div>

      <div>
        <div className="flex gap-3 mb-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="e.g. Aldol condensation between acetone and benzaldehyde"
              className="w-full bg-slate-800 border border-slate-700 pl-9 pr-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
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
            className="relative inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white transition-all duration-200 overflow-hidden group bg-gradient-to-r from-purple-500 via-purple-600 to-purple-500 shadow-md shadow-purple-500/25 disabled:opacity-60"
          >
            {!isLoading && (
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
            )}
            <span className="relative z-10">
              {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
            </span>
          </button>
        </div>
        <div className="grid grid-cols-1 gap-1">
          {SAMPLE_PROMPTS.map(sample => (
            <button
              key={sample}
              onClick={() => {
                setQuery(sample);
                void handleSearch(sample);
              }}
              className="relative px-3 py-2 text-sm font-medium transition-all duration-200 overflow-hidden group bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 hover:text-purple-200"
            >
              <span className="relative z-10 whitespace-nowrap">{sample}</span>
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className=" bg-rose-950/40 px-3 py-2 text-xs text-rose-100">
          {error}
        </div>
      )}

      {resolution ? (
        <div>
          <ReactionMechanismScene resolution={resolution} />

          {/* ChemTube3D-style Animation Controls */}
          {viewableComponents.length > 0 && (
            <div className="bg-[#171717] p-3">
              {/* Progress Indicator */}
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-400">Stage:</span>
                <span className="text-white font-medium">{currentStageIndex + 1} / {viewableComponents.length}</span>
                <div className="flex-1 h-1.5 bg-slate-700 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-300"
                    style={{ width: `${((currentStageIndex + 1) / viewableComponents.length) * 100}%` }}
                  />
                </div>
              </div>

              {/* Playback Controls */}
              <div className="flex flex-wrap items-center gap-0.5">
                <button
                  onClick={rewindAnimation}
                  className="relative flex items-center gap-1 px-1 py-0.5 text-sm font-medium transition-all duration-200 overflow-hidden group border bg-slate-800/80 hover:bg-slate-700 text-slate-300 border-slate-700/50"
                  title="First Frame"
                >
                  <RotateCcw className="h-2.5 w-2.5 relative z-10" />
                </button>
                <button
                  onClick={prevFrame}
                  disabled={currentStageIndex === 0}
                  className="relative flex items-center gap-1 px-1 py-0.5 text-sm font-medium transition-all duration-200 overflow-hidden group border bg-slate-800/80 hover:bg-slate-700 text-slate-300 border-slate-700/50 disabled:opacity-40"
                  title="Previous"
                >
                  <SkipBack className="h-2.5 w-2.5 relative z-10" />
                </button>
                <button
                  onClick={isPlaying ? stopAnimation : playAnimation}
                  className={`relative flex items-center gap-1 px-1 py-0.5 text-sm font-medium transition-all duration-200 overflow-hidden group border ${isPlaying
                    ? 'bg-amber-600/80 hover:bg-amber-500 text-white '
                    : 'bg-green-600/80 hover:bg-green-500 text-white '
                    }`}
                >
                  {isPlaying ? <Pause className="h-2.5 w-2.5 relative z-10" /> : <Play className="h-2.5 w-2.5 relative z-10" />}
                  <span className="relative z-10 whitespace-nowrap">{isPlaying ? 'Pause' : 'Play'}</span>
                </button>
                <button
                  onClick={nextFrame}
                  disabled={currentStageIndex >= viewableComponents.length - 1}
                  className="relative flex items-center gap-1 px-1 py-0.5 text-sm font-medium transition-all duration-200 overflow-hidden group border bg-slate-800/80 hover:bg-slate-700 text-slate-300 border-slate-700/50 disabled:opacity-40"
                  title="Next"
                >
                  <SkipForward className="h-2.5 w-2.5 relative z-10" />
                </button>
                <button
                  onClick={stopAnimation}
                  className="relative flex items-center gap-1 px-1 py-0.5 text-sm font-medium transition-all duration-200 overflow-hidden group border bg-slate-800/80 hover:bg-slate-700 text-slate-300 border-slate-700/50"
                  title="Stop"
                >
                  <Square className="h-2.5 w-2.5 relative z-10" />
                </button>

                {/* Animation Mode Toggle */}
                <div className="flex items-center gap-0.5 ml-auto">
                  {(['once', 'loop', 'palindrome'] as AnimationMode[]).map(mode => (
                    <button
                      key={mode}
                      onClick={() => setAnimationMode(mode)}
                      className={`relative px-1 py-0.5 text-sm font-medium transition-all duration-200 overflow-hidden group border ${animationMode === mode
                        ? 'bg-gradient-to-r from-purple-500 via-purple-600 to-purple-500 text-white shadow-md shadow-purple-500/25 '
                        : 'bg-slate-800/80 text-slate-300 hover:text-purple-200 hover:bg-slate-700/80 border-slate-700/50'
                        }`}
                    >
                      {animationMode === mode && (
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                      )}
                      <span className="relative z-10 whitespace-nowrap">{mode === 'once' ? 'Once' : mode === 'loop' ? 'Loop' : '↔️'}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Display Controls */}
              <div className="flex flex-wrap items-center gap-0.5 pt-2 border-t border-transparent">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider">Display:</span>
                {DISPLAY_MODES.map(mode => (
                  <button
                    key={mode.id}
                    onClick={() => applyDisplayMode(mode.id)}
                    className={`relative px-1 py-0.5 text-sm font-medium transition-all duration-200 overflow-hidden group border ${displayMode === mode.id
                      ? 'bg-gradient-to-r from-blue-500 via-blue-600 to-blue-500 text-white shadow-md shadow-blue-500/25 '
                      : 'bg-slate-800/80 text-slate-300 hover:text-blue-200 hover:bg-slate-700/80 border-slate-700/50'
                      }`}
                  >
                    {displayMode === mode.id && (
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                    )}
                    <span className="relative z-10 whitespace-nowrap">{mode.label}</span>
                  </button>
                ))}
                <button
                  onClick={toggleHydrogens}
                  className={`relative flex items-center gap-1 px-1 py-0.5 text-sm font-medium transition-all duration-200 overflow-hidden group border ml-auto ${showHydrogens 
                    ? 'bg-gradient-to-r from-emerald-500 via-emerald-600 to-emerald-500 text-white shadow-md shadow-emerald-500/25 '
                    : 'bg-slate-800/80 text-slate-300 hover:text-emerald-200 hover:bg-slate-700/80 border-slate-700/50'
                    }`}
                >
                  {showHydrogens && (
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                  )}
                  {showHydrogens ? <Eye className="h-2.5 w-2.5 relative z-10" /> : <EyeOff className="h-2.5 w-2.5 relative z-10" />}
                  <span className="relative z-10 whitespace-nowrap">H</span>
                </button>
              </div>

              {/* ChemTube3D Mechanism Animation */}
              <div className="pt-2 border-t border-transparent">
                <button
                  onClick={() => void playMechanismAnimation()}
                  disabled={mechanismLoading || !lastPrompt}
                  className={`relative w-full flex items-center justify-center gap-1.5 px-2 py-1 text-sm font-medium transition-all duration-200 overflow-hidden group border ${mechanismAnimating
                    ? 'bg-gradient-to-r from-rose-500 via-rose-600 to-rose-500 text-white shadow-md shadow-rose-500/25 '
                    : mechanismLoading
                      ? 'bg-slate-700/80 text-slate-400 cursor-wait border-slate-700/50'
                      : 'bg-gradient-to-r from-purple-500 via-pink-500 to-purple-500 text-white shadow-md shadow-purple-500/25 '
                    } disabled:opacity-60`}
                >
                  {!mechanismLoading && !mechanismAnimating && (
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                  )}
                  <span className="relative z-10 flex items-center gap-1.5 whitespace-nowrap">
                    {mechanismLoading ? (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Generating Animation...
                      </>
                    ) : mechanismAnimating ? (
                      <>
                        <Square className="h-3 w-3" />
                        Stop Mechanism
                      </>
                    ) : (
                      <>
                        <Film className="h-3 w-3" />
                        Play Full Mechanism
                      </>
                    )}
                  </span>
                </button>
                <p className="text-[10px] text-slate-500 mt-1 text-center">
                  AI generates multi-frame 3D animation showing reactants approaching → transition state → products
                </p>
              </div>
            </div>
          )}

          <div className="bg-[#171717] p-3 text-xs text-slate-200">
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

          <div>
            {groupedComponents.map(stage => (
              <div key={stage.key} className="bg-[#171717] p-3">
                <div className="flex items-center gap-2 text-xs font-semibold" style={{ color: stage.colour }}>
                  <Beaker className="h-3.5 w-3.5" />
                  {stage.label}
                </div>
                {stage.components.length === 0 ? (
                  <p className="mt-2 text-[11px] text-slate-400">No entries</p>
                ) : (
                  <ul className="mt-2 text-sm text-white">
                    {stage.components.map((component, index) => (
                      <li key={`${stage.key}-${index}`} className="bg-[#171717] p-2">
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
                              className="border border-slate-700 px-2 py-1 text-[11px] text-slate-200  hover:text-white"
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
      ) : null}
    </div>
  );
};

export default ReactionMechanismAnimator;
