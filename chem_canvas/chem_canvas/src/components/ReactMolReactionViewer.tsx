import React, { Suspense, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { ReactionResolutionResult, ReactionComponentDetails } from '../services/reactionResolver';
import { buildMolElement, stageMeta, tokenizeSmiles, type StageKey } from '../utils/reactMolHelpers';

type ReactMolReactionViewerProps = {
  reactionSmiles?: string | null;
  resolution: ReactionResolutionResult | null;
};

type StageItem = {
  id: string;
  label?: string;
  smiles?: string | null;
  fallbackLabel: string;
};

type StageGroup = {
  key: StageKey;
  label: string;
  colour: string;
  items: StageItem[];
};

const stageLabel = (role: StageKey): string => {
  if (role === 'agent') return 'Agent';
  if (role === 'product') return 'Product';
  return 'Reactant';
};

const splitSegment = (segment: string): string[] =>
  segment
    .split('.')
    .map(token => token.trim())
    .filter(token => token.length > 0);

const buildFallbackComponents = (reactionSmiles?: string | null): Record<StageKey, StageItem[]> => {
  if (!reactionSmiles) {
    return { reactant: [], agent: [], product: [] };
  }

  const sections = reactionSmiles.split('>');
  if (sections.length < 2) {
    return { reactant: [], agent: [], product: [] };
  }

  const reactantSection = sections[0] ?? '';
  const agentSection = sections.length === 2 ? '' : sections[1] ?? '';
  const productSection = sections.length === 2 ? sections[1] ?? '' : sections.slice(2).join('>');

  const toItems = (segment: string, role: StageKey): StageItem[] =>
    splitSegment(segment).map((entry, index) => ({
      id: `${role}-${index}`,
      fallbackLabel: `${stageLabel(role)} ${index + 1}`,
      smiles: entry,
      label: entry
    }));

  return {
    reactant: toItems(reactantSection, 'reactant'),
    agent: toItems(agentSection, 'agent'),
    product: toItems(productSection, 'product')
  };
};

type RotatingMoleculeProps = {
  element: React.ReactElement;
  colour: string;
  speed: number;
};

const RotatingMolecule: React.FC<RotatingMoleculeProps> = ({ element, colour, speed }) => {
  const ref = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (!ref.current) return;
    ref.current.rotation.y += delta * speed;
    ref.current.rotation.x += delta * speed * 0.35;
  });

  return (
    <group ref={ref}>
      <pointLight position={[0, 0, 0]} intensity={0.45} color={colour} distance={6} />
      {element}
    </group>
  );
};

const MoleculeCanvas: React.FC<{ tokens: string[]; colour: string; speed: number }> = ({ tokens, colour, speed }) => {
  const moleculeElement = useMemo(() => buildMolElement(tokens), [tokens]);

  return (
    <div className="h-36 w-full">
      <Canvas camera={{ position: [0, 0, 6], fov: 45 }}>
        <color attach="background" args={['#020617']} />
        <ambientLight intensity={0.6} />
        <spotLight position={[6, 6, 6]} angle={0.45} penumbra={0.5} intensity={0.4} />
        <Suspense fallback={null}>
          <RotatingMolecule element={moleculeElement} colour={colour} speed={speed} />
        </Suspense>
      </Canvas>
    </div>
  );
};

const hasStageContent = (group: StageGroup): boolean => group.items.length > 0;

const contentFromComponent = (
  component: StageItem,
  stageComponents: ReactionComponentDetails[]
): { label?: string; smiles?: string | null } => {
  const match = stageComponents.find(candidate => candidate.label === component.label || candidate.smiles === component.smiles);
  if (match) {
    return {
      label: match.label ?? match.original,
      smiles: match.smiles ?? match.canonicalSmiles ?? match.original
    };
  }

  return {
    label: component.label ?? component.fallbackLabel,
    smiles: component.smiles
  };
};

const ReactMolReactionViewer: React.FC<ReactMolReactionViewerProps> = ({ reactionSmiles, resolution }) => {
  const stageGroups = useMemo<StageGroup[]>(() => {
    const components = resolution?.components ?? [];
    if (components.length > 0) {
      return stageMeta.map(stage => ({
        ...stage,
        items: components
          .filter(component => component.role === stage.key)
          .map((component, index) => ({
            id: `${stage.key}-${index}`,
            label: component.label ?? component.original,
            smiles:
              component.smiles ??
              component.canonicalSmiles ??
              component.label ??
              component.original ??
              null,
            fallbackLabel: `${stageLabel(stage.key)} ${index + 1}`
          }))
      }));
    }

    const fallback = buildFallbackComponents(reactionSmiles);
    return stageMeta.map(stage => ({
      ...stage,
      items: fallback[stage.key]
    }));
  }, [reactionSmiles, resolution]);
  const componentLookup = useMemo(() => {
    const entries = resolution?.components ?? [];
    return {
      reactant: entries.filter(entry => entry.role === 'reactant'),
      agent: entries.filter(entry => entry.role === 'agent'),
      product: entries.filter(entry => entry.role === 'product')
    } as Record<StageKey, ReactionComponentDetails[]>;
  }, [resolution]);

  const hasAnyContent = stageGroups.some(hasStageContent);

  if (!hasAnyContent) {
    return (
      <div className="flex h-full flex-col items-center justify-center rounded-lg border border-slate-200/40 bg-slate-900/60 p-6 text-center text-slate-300">
        <p className="text-sm">Provide a reaction to preview the React Mol simulation.</p>
        <p className="mt-2 text-xs text-slate-500">
          The viewer animates simplified molecular fragments derived from your reaction SMILES.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {stageGroups.map(stage => {
        const stageComponents = componentLookup[stage.key] ?? [];
        return (
          <div
            key={stage.key}
            className="rounded-xl border border-slate-200/40 bg-slate-900/70 p-4 shadow-inner"
          >
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-semibold" style={{ color: stage.colour }}>
                {stage.label}
              </div>
              <span className="text-[11px] uppercase tracking-wide text-slate-400">React Mol</span>
            </div>
            {stage.items.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {stage.items.map((component, index) => {
                  const details = contentFromComponent(component, stageComponents);
                  const tokens = tokenizeSmiles(details.smiles ?? details.label ?? component.fallbackLabel);
                  return (
                    <div
                      key={component.id}
                      className="flex flex-col overflow-hidden rounded-lg border border-slate-700/60 bg-slate-950/80"
                    >
                      <MoleculeCanvas tokens={tokens} colour={stage.colour} speed={0.3 + index * 0.05} />
                      <div className="px-3 py-2 text-xs text-slate-300">
                        <div className="font-medium text-slate-100">
                          {details.label ?? component.fallbackLabel}
                        </div>
                        {details.smiles && (
                          <div className="mt-1 truncate font-mono text-[11px] text-slate-400" title={details.smiles}>
                            {details.smiles}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-slate-700/60 bg-slate-950/50 p-4 text-xs text-slate-400">
                No {stage.label.toLowerCase()} supplied.
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default ReactMolReactionViewer;
