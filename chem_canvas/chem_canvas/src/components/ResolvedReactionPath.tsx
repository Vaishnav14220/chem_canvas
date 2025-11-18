// @ts-nocheck
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { PlayCircle, SkipBack, SkipForward } from 'lucide-react';
import type { ReactionComponentDetails, ReactionResolutionResult, ReactionMechanismStage } from '../services/reactionResolver';
import { fetchSDFBySmiles } from '../services/pubchemService';

const ACCENTS = ['text-cyan-300', 'text-emerald-300', 'text-purple-300', 'text-amber-300'];

type StageDisplay = {
  id: string;
  label: string;
  accent: string;
  description?: string;
  components: ReactionComponentDetails[];
  smilesList: string[];
};

type StageScriptPayload = {
  script: string | null;
  sdfList: string[];
};

const sdfCache = new Map<string, string>();

const sanitizeSdf = (sdf: string): string => {
  const normalized = sdf.replace(/\r\n/g, '\n').trim();
  return normalized.endsWith('$$$$') ? normalized : `${normalized}\n$$$$`;
};

const loadSdfFromSmiles = async (smiles: string): Promise<string | null> => {
  const key = smiles.trim();
  if (!key) {
    return null;
  }

  if (sdfCache.has(key)) {
    return sdfCache.get(key) ?? null;
  }

  const sdf =
    (await fetchSDFBySmiles(key, '3d')) ||
    (await fetchSDFBySmiles(key, '2d'));

  if (sdf) {
    sdfCache.set(key, sdf);
    return sdf;
  }

  sdfCache.set(key, null);
  return null;
};

const buildViewerScript = (sdfs: string[], fallbackSmiles: string[]): string | null => {
  if (sdfs.length === 0 && fallbackSmiles.length === 0) {
    return null;
  }

  const commands: string[] = [];
  if (sdfs.length > 0) {
    commands.push('load data "model"');
    commands.push(sdfs.map(sanitizeSdf).join('\n'));
    commands.push('END "model";');
  }

  if (fallbackSmiles.length > 0) {
    commands.push(`${sdfs.length > 0 ? 'load append' : 'load'} data "smiles"`);
    commands.push(fallbackSmiles.join('.'));
    commands.push('END "smiles";');
  }

  commands.push('select *;');
  commands.push('label %a;');
  commands.push('set fontsize 14;');
  commands.push('color labels white;');
  commands.push('wireframe 0.18;');
  commands.push('spacefill 18%;');
  commands.push('color cpk;');
  commands.push('spin y 3;');

  return commands.join('\n');
};

const buildMorphScript = (startSdfs: string[], endSdfs: string[]): string | null => {
  if (!startSdfs.length || !endSdfs.length) {
    return null;
  }

  return `load data "model"
${startSdfs.map(sanitizeSdf).join('\n')}
END "model";
load append data "model"
${endSdfs.map(sanitizeSdf).join('\n')}
END "model";
select *;
label %a;
set fontsize 14;
color labels white;
frame 1;
morph {1} {2} 30;
animation mode palindrome;
animation fps 12;
animation on;`;
};

const normalizeMechanismStage = (stage: ReactionMechanismStage, index: number): StageDisplay | null => {
  const smilesList = Array.isArray(stage.smiles)
    ? stage.smiles
        .map(value => (typeof value === 'string' ? value.trim() : ''))
        .filter(Boolean)
    : [];

  if (smilesList.length === 0) {
    return null;
  }

  return {
    id: `mechanism-${index}`,
    label: stage.label?.trim() || `Stage ${index + 1}`,
    accent: ACCENTS[index % ACCENTS.length],
    description: stage.description?.trim(),
    components: [],
    smilesList,
  };
};

const fallbackStageDisplays = (resolution: ReactionResolutionResult): StageDisplay[] => {
  const definitions: Array<{ key: ReactionComponentDetails['role']; label: string }> = [
    { key: 'reactant', label: 'Reactants' },
    { key: 'agent', label: 'Reagents & Catalysts' },
    { key: 'product', label: 'Products' },
  ];

  return definitions
    .map((definition, index) => {
      const components = resolution.components.filter(component => component.role === definition.key);
      const smilesList = components
        .map(component => component.smiles ?? component.canonicalSmiles ?? '')
        .map(value => value.trim())
        .filter(Boolean);

      if (components.length === 0 && smilesList.length === 0) {
        return null;
      }

      return {
        id: definition.key,
        label: definition.label,
        accent: ACCENTS[index % ACCENTS.length],
        description: undefined,
        components,
        smilesList,
      } as StageDisplay;
    })
    .filter((stage): stage is StageDisplay => Boolean(stage));
};

interface ResolvedReactionPathProps {
  resolution: ReactionResolutionResult;
  onScriptChange?: (script: string) => void;
}

const ResolvedReactionPath: React.FC<ResolvedReactionPathProps> = ({ resolution, onScriptChange }) => {
  const [stageScripts, setStageScripts] = useState<Record<string, StageScriptPayload>>({});
  const [morphScript, setMorphScript] = useState<string | null>(null);
  const [scriptsLoading, setScriptsLoading] = useState(false);
  const [scriptError, setScriptError] = useState<string | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  const stageDisplays = useMemo<StageDisplay[]>(() => {
    const mechanismStages = resolution.mechanismStages?.map(normalizeMechanismStage).filter(
      (stage): stage is StageDisplay => Boolean(stage),
    );
    if (mechanismStages && mechanismStages.length >= 2) {
      return mechanismStages;
    }
    return fallbackStageDisplays(resolution);
  }, [resolution]);

  const currentStage = stageDisplays[Math.min(stepIndex, Math.max(stageDisplays.length - 1, 0))];

  useEffect(() => {
    setStepIndex(0);
    setIsAnimating(false);
  }, [resolution]);

  useEffect(() => {
    let cancelled = false;

    const buildScripts = async () => {
      if (stageDisplays.length === 0) {
        setStageScripts({});
        setMorphScript(null);
        setScriptsLoading(false);
        return;
      }

      setScriptsLoading(true);
      setScriptError(null);

      try {
        const payloadEntries: Record<string, StageScriptPayload> = {};

        for (const stage of stageDisplays) {
          const sdfResults: string[] = [];
          const fallbackSmiles: string[] = [];

          for (const smiles of stage.smilesList) {
            const sdf = await loadSdfFromSmiles(smiles);
            if (sdf) {
              sdfResults.push(sdf);
            } else {
              fallbackSmiles.push(smiles);
            }
          }

          payloadEntries[stage.id] = {
            script: buildViewerScript(sdfResults, fallbackSmiles),
            sdfList: sdfResults,
          };
        }

        const firstStage = stageDisplays[0];
        const lastStage = stageDisplays[stageDisplays.length - 1];
        const firstSdfs = payloadEntries[firstStage.id]?.sdfList ?? [];
        const lastSdfs = payloadEntries[lastStage.id]?.sdfList ?? [];
        const morph = buildMorphScript(firstSdfs, lastSdfs);

        if (cancelled) {
          return;
        }

        setStageScripts(payloadEntries);
        setMorphScript(morph);
        setScriptsLoading(false);
      } catch (error) {
        if (cancelled) {
          return;
        }
        console.error('Failed to prepare JSmol structures:', error);
        setStageScripts({});
        setMorphScript(null);
        setScriptError('Unable to prepare the 3D pathway for this reaction.');
        setScriptsLoading(false);
      }
    };

    buildScripts();

    return () => {
      cancelled = true;
    };
  }, [stageDisplays]);

  useEffect(() => {
    if (!currentStage || isAnimating) {
      return;
    }
    const payload = stageScripts[currentStage.id];
    if (payload?.script && onScriptChange) {
      onScriptChange(payload.script);
    }
  }, [currentStage, stageScripts, onScriptChange, isAnimating]);

  const handleStageSwitch = useCallback(
    (index: number) => {
      setStepIndex(index);
      setIsAnimating(false);
      setScriptError(null);
      const stage = stageDisplays[index];
      const payload = stage ? stageScripts[stage.id] : null;
      if (payload?.script && onScriptChange) {
        onScriptChange(payload.script);
      }
    },
    [stageDisplays, stageScripts, onScriptChange],
  );

  const handleAnimateToggle = () => {
    if (isAnimating) {
      setIsAnimating(false);
      setScriptError(null);
      const stage = currentStage;
      const payload = stage ? stageScripts[stage.id] : null;
      if (payload?.script && onScriptChange) {
        onScriptChange(payload.script);
      }
      return;
    }

    if (!morphScript) {
      setScriptError('Need valid 3D data for reactants and products to animate the morph.');
      return;
    }

    setScriptError(null);
    setIsAnimating(true);
    onScriptChange?.(morphScript);
  };

  if (stageDisplays.length === 0) {
    return null;
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white">Reaction Path Visualization</h3>
          <p className="text-xs text-slate-400">
            Stage-by-stage structures driven by the Gemini response, rendered in JSmol.
          </p>
        </div>
        <span className="text-xs text-slate-400">
          Stage {stepIndex + 1} / {stageDisplays.length}
        </span>
      </div>

      {scriptsLoading && (
        <div className="rounded-lg border border-slate-700/70 bg-slate-900/60 px-3 py-2 text-xs text-slate-300">
          Preparing SDF geometries…
        </div>
      )}

      {scriptError && (
        <div className="rounded-lg border border-rose-500/60 bg-rose-950/40 px-3 py-2 text-xs text-rose-100">
          {scriptError}
        </div>
      )}

      <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700">
        <div className="flex items-center justify-between mb-2">
          <div className={`text-sm font-semibold ${currentStage.accent}`}>{currentStage.label}</div>
          <div className="text-xs text-slate-300">{currentStage.smilesList.length} species</div>
        </div>
        {currentStage.description && (
          <p className="text-xs text-slate-300 mb-2">{currentStage.description}</p>
        )}
        {currentStage.components.length > 0 ? (
          <div className="space-y-2">
            {currentStage.components.map((component, idx) => (
              <div
                key={`${currentStage.id}-component-${idx}`}
                className="rounded-lg border border-slate-700/80 bg-slate-950/40 p-2 text-sm text-white"
              >
                <p className="font-medium">
                  {component.label ?? component.original ?? `Component ${idx + 1}`}
                </p>
                {component.smiles && (
                  <p className="mt-1 font-mono text-[11px] text-slate-400 break-all">{component.smiles}</p>
                )}
                {component.notes && (
                  <p className="mt-1 text-[11px] text-slate-300">{component.notes}</p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <ul className="space-y-2 text-[12px] text-slate-200">
            {currentStage.smilesList.map((smiles, idx) => (
              <li
                key={`${currentStage.id}-smiles-${idx}`}
                className="rounded-lg border border-slate-700/80 bg-slate-950/40 p-2 font-mono break-all"
              >
                {smiles}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="bg-slate-800/50 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between text-xs text-slate-300">
          <span>Progress: {(stepIndex / Math.max(1, stageDisplays.length - 1)).toFixed(2)}</span>
          <div className="flex gap-1 text-[11px] text-slate-400">
            <span>{stageDisplays[0].label}</span>
            <span>→</span>
            <span>{stageDisplays[stageDisplays.length - 1].label}</span>
          </div>
        </div>
        <input
          type="range"
          min={0}
          max={stageDisplays.length - 1}
          value={stepIndex}
          onChange={(event) => handleStageSwitch(Number(event.target.value))}
          className="w-full"
        />
        <div className="flex gap-2">
          <button
            onClick={() => handleStageSwitch(0)}
            className="flex-1 px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm text-white flex items-center justify-center gap-2"
          >
            <SkipBack className="h-4 w-4" />
            Start
          </button>
          <button
            onClick={handleAnimateToggle}
            className={`flex-1 px-3 py-2 rounded-lg text-sm flex items-center justify-center gap-2 ${
              isAnimating ? 'bg-rose-600 hover:bg-rose-500 text-white' : 'bg-green-600 hover:bg-green-500 text-white'
            }`}
            disabled={scriptsLoading}
          >
            <PlayCircle className="h-4 w-4" />
            {isAnimating ? 'Stop' : 'Animate'}
          </button>
          <button
            onClick={() => handleStageSwitch(stageDisplays.length - 1)}
            className="flex-1 px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm text-white flex items-center justify-center gap-2"
          >
            <SkipForward className="h-4 w-4" />
            Finish
          </button>
        </div>
        <p className="text-[11px] text-slate-400">
          Stage scripts stream directly into JSmol with atom labels; animate morph blends the first and last stages.
        </p>
        {isAnimating && !morphScript && (
          <p className="text-[11px] text-rose-400">
            Need valid 3D SDF data for both the first and last stage to animate.
          </p>
        )}
      </div>
    </div>
  );
};

export default ResolvedReactionPath;
