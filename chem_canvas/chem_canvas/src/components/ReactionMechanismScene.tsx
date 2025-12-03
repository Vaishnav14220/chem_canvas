import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { ReactionResolutionResult, ReactionComponentDetails } from '../services/reactionResolver';
import { stageMeta, type StageKey } from '../utils/reactMolHelpers';
import { generate3DStructure } from '../services/rdkitService';
import { parseSDF, type ParsedSDF } from '../services/pubchemService';

type ReactionMechanismSceneProps = {
  resolution: ReactionResolutionResult | null;
};

const useGroupedComponents = (resolution: ReactionResolutionResult | null) =>
  useMemo(() => {
    const components = resolution?.components ?? [];
    return stageMeta.map(stage => ({
      ...stage,
      items: components.filter(component => component.role === stage.key)
    }));
  }, [resolution]);

type StageStructures = Record<StageKey, StageMolecule[]>;

type StageMolecule = {
  id: string;
  component: ReactionComponentDetails;
  parsed: ParsedSDF;
};

type StageError = {
  component: ReactionComponentDetails;
  message: string;
};

type StageLoadSuccess = {
  id: string;
  component: ReactionComponentDetails;
  parsed: ParsedSDF;
};

type StageLoadFailure = {
  id: string;
  component: ReactionComponentDetails;
  error: string;
};

const isStageLoadSuccess = (value: StageLoadSuccess | StageLoadFailure): value is StageLoadSuccess =>
  'parsed' in value;

const structureCache = new Map<string, ParsedSDF>();

const fetchParsedStructure = async (smiles: string, label?: string): Promise<ParsedSDF> => {
  const cacheKey = smiles.trim();
  if (!cacheKey) {
    throw new Error('Missing SMILES string.');
  }

  const cached = structureCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const rdkitPayload = await generate3DStructure(cacheKey, label);
  if (!rdkitPayload?.sdf) {
    throw new Error('RDKit did not return an SDF payload.');
  }

  const parsed = parseSDF(rdkitPayload.sdf);
  if (!parsed) {
    throw new Error('Unable to parse the RDKit SDF output.');
  }

  const normalized: ParsedSDF = {
    atoms: parsed.atoms,
    bonds: parsed.bonds,
    moleculeName:
      parsed.moleculeName && parsed.moleculeName !== 'Unknown'
        ? parsed.moleculeName
        : label ?? cacheKey
  };

  structureCache.set(cacheKey, normalized);
  return normalized;
};

const emptyStageStructures = (): StageStructures => ({
  reactant: [],
  agent: [],
  product: []
});

const ATOM_COLORS: Record<string, string> = {
  H: '#e2e8f0',
  C: '#94a3b8',
  N: '#60a5fa',
  O: '#f87171',
  S: '#facc15',
  P: '#c084fc',
  F: '#34d399',
  Cl: '#22c55e',
  Br: '#f97316',
  I: '#a855f7'
};

const ATOM_RADII: Record<string, number> = {
  H: 0.18,
  C: 0.24,
  N: 0.22,
  O: 0.22,
  S: 0.28,
  P: 0.27,
  F: 0.2,
  Cl: 0.26,
  Br: 0.28,
  I: 0.32
};

const DEFAULT_ATOM_COLOR = '#cbd5f5';
const DEFAULT_ATOM_RADIUS = 0.22;

type NormalizedAtom = {
  index: number;
  element: string;
  position: [number, number, number];
};

const normalizeStructure = (parsed: ParsedSDF): { atoms: NormalizedAtom[]; bonds: ParsedSDF['bonds'] } => {
  if (!parsed.atoms.length) {
    return { atoms: [], bonds: [] };
  }

  const positions = parsed.atoms.map(atom => new THREE.Vector3(atom.x, atom.y, atom.z));
  const centroid = positions
    .reduce((acc, position) => acc.add(position), new THREE.Vector3())
    .multiplyScalar(1 / positions.length);

  let maxDistance = 0;
  const centered = positions.map(position => {
    const shifted = position.clone().sub(centroid);
    maxDistance = Math.max(maxDistance, shifted.length());
    return shifted;
  });

  const targetRadius = 3.2;
  const scale = maxDistance > 0 ? targetRadius / maxDistance : 1;

  const atoms: NormalizedAtom[] = centered.map((position, index) => {
    const scaled = position.multiplyScalar(scale);
    return {
      index,
      element: parsed.atoms[index].element,
      position: [scaled.x, scaled.y, scaled.z]
    };
  });

  return { atoms, bonds: parsed.bonds };
};

const getAtomColor = (element: string): string => ATOM_COLORS[element] ?? DEFAULT_ATOM_COLOR;
const getAtomRadius = (element: string): number => ATOM_RADII[element] ?? DEFAULT_ATOM_RADIUS;

const getBondColour = (stageColour: string): string => {
  try {
    const base = new THREE.Color(stageColour);
    const neutral = new THREE.Color('#94a3b8');
    const mixed = base.clone().lerp(neutral, 0.35);
    return `#${mixed.getHexString()}`;
  } catch (error) {
    console.warn('Fallback bond colour due to invalid stage colour:', error);
    return '#94a3b8';
  }
};

const useStageStructures = (
  resolution: ReactionResolutionResult | null
): { structures: StageStructures; loading: boolean; errors: StageError[] } => {
  const [structures, setStructures] = useState<StageStructures>(() => emptyStageStructures());
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<StageError[]>([]);

  const signature = useMemo(() => {
    const components = resolution?.components ?? [];
    if (components.length === 0) {
      return 'empty';
    }
    return components
      .map(component =>
        [component.role, component.smiles ?? component.canonicalSmiles ?? component.label ?? component.original ?? ''].join(':')
      )
      .join('|');
  }, [resolution]);

  useEffect(() => {
    const components = resolution?.components ?? [];
    if (components.length === 0) {
      setStructures(emptyStageStructures());
      setErrors([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setStructures(emptyStageStructures());
    setErrors([]);

    const load = async () => {
      const tasks: Array<Promise<StageLoadSuccess | StageLoadFailure>> = components.map(async (component, index) => {
        const identifier = component.smiles ?? component.canonicalSmiles ?? null;
        const id = `${component.role}-${index}`;

        if (!identifier) {
          return { id, component, error: 'No SMILES available for RDKit generation.' };
        }

        try {
          const parsed = await fetchParsedStructure(identifier, component.label ?? component.original);
          return { id, component, parsed };
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to build RDKit structure.';
          return { id, component, error: message };
        }
      });

      const results = await Promise.all(tasks);
      if (cancelled) {
        return;
      }

      const stageStructures = emptyStageStructures();
      const stageErrors: StageError[] = [];

      results.forEach(result => {
        if (isStageLoadSuccess(result)) {
          stageStructures[result.component.role].push({
            id: result.id,
            component: result.component,
            parsed: result.parsed
          });
        } else {
          stageErrors.push({ component: result.component, message: result.error });
        }
      });

      stageMeta.forEach(stage => {
        stageStructures[stage.key].sort((a, b) => {
          const labelA = a.component.label ?? a.component.original ?? '';
          const labelB = b.component.label ?? b.component.original ?? '';
          return labelA.localeCompare(labelB);
        });
      });

      setStructures(stageStructures);
      setErrors(stageErrors);
      setLoading(false);
    };

    load().catch(error => {
      if (cancelled) {
        return;
      }
      console.error('Failed to load RDKit structures:', error);
      setLoading(false);
      setErrors([{
        component: {
          role: 'reactant',
          label: 'RDKit loader',
          original: 'RDKit loader'
        } as ReactionComponentDetails,
        message: 'Failed to initialise RDKit. Check the console for details.'
      }]);
    });

    return () => {
      cancelled = true;
    };
  }, [resolution, signature]);

  return { structures, loading, errors };
};

type RotatingMoleculeProps = React.PropsWithChildren<{
  speed?: number;
  position: [number, number, number];
}>;

const RotatingMolecule = ({ children, speed = 0.35, position }: RotatingMoleculeProps) => {
  const ref = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (!ref.current) return;
    ref.current.rotation.y += delta * speed;
    ref.current.rotation.x += delta * speed * 0.25;
  });

  return (
    <group ref={ref} position={position}>
      {children}
    </group>
  );
};

const ReactionArrow: React.FC = () => {
  const beamRef = useRef<THREE.Mesh>(null);
  const pulseRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (beamRef.current) {
      const material = beamRef.current.material as THREE.MeshStandardMaterial;
      material.opacity = 0.35 + 0.15 * Math.sin(t * 2.2);
    }
    if (pulseRef.current) {
      pulseRef.current.position.x = -5.5 + ((t % 4) / 4) * 11;
      const material = pulseRef.current.material as THREE.MeshStandardMaterial;
      material.emissiveIntensity = 0.5 + 0.3 * Math.sin(t * 3.6);
    }
  });

  return (
    <group position={[0, -3.75, 0]}>
      <mesh ref={beamRef} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.08, 0.08, 11, 32, 1, true]} />
        <meshStandardMaterial color="#38bdf8" transparent opacity={0.4} />
      </mesh>
      <mesh position={[5.8, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <coneGeometry args={[0.28, 0.8, 32]} />
        <meshStandardMaterial color="#38bdf8" emissive="#38bdf8" emissiveIntensity={0.4} />
      </mesh>
      <mesh ref={pulseRef} position={[-5.5, 0, 0]}>
        <sphereGeometry args={[0.22, 18, 18]} />
        <meshStandardMaterial color="#f97316" emissive="#fb923c" emissiveIntensity={0.6} />
      </mesh>
    </group>
  );
};

const Bond: React.FC<{
  start: [number, number, number];
  end: [number, number, number];
  order: number;
  colour: string;
}> = ({ start, end, order, colour }) => {
  const [sx, sy, sz] = start;
  const [ex, ey, ez] = end;

  const { position, quaternion, length } = useMemo(() => {
    const startVec = new THREE.Vector3(sx, sy, sz);
    const endVec = new THREE.Vector3(ex, ey, ez);
    const center = new THREE.Vector3().addVectors(startVec, endVec).multiplyScalar(0.5);
    const direction = new THREE.Vector3().subVectors(endVec, startVec);
    const segmentLength = direction.length();
    const orientation = new THREE.Quaternion();
    if (segmentLength > 0.0001) {
      orientation.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize());
    }
    return { position: center, quaternion: orientation, length: segmentLength };
  }, [sx, sy, sz, ex, ey, ez]);

  if (length <= 0.0001) {
    return null;
  }

  const radius = order >= 3 ? 0.13 : order === 2 ? 0.1 : 0.08;

  return (
    <mesh position={position} quaternion={quaternion}>
      <cylinderGeometry args={[radius, radius, length, 20, 1]} />
      <meshStandardMaterial color={colour} roughness={0.35} metalness={0.25} />
    </mesh>
  );
};

const MoleculeMesh: React.FC<{ parsed: ParsedSDF; stageColour: string }> = ({ parsed, stageColour }) => {
  const { atoms, bonds } = useMemo(() => normalizeStructure(parsed), [parsed]);
  const bondColour = useMemo(() => getBondColour(stageColour), [stageColour]);

  return (
    <group>
      {bonds.map((bond, index) => {
        const start = atoms[bond.from];
        const end = atoms[bond.to];
        if (!start || !end) {
          return null;
        }
        return (
          <Bond
            key={`bond-${bond.from}-${bond.to}-${index}`}
            start={start.position}
            end={end.position}
            order={bond.type}
            colour={bondColour}
          />
        );
      })}
      {atoms.map(atom => (
        <mesh key={`atom-${atom.index}`} position={atom.position}>
          <sphereGeometry args={[getAtomRadius(atom.element), 32, 32]} />
          <meshStandardMaterial color={getAtomColor(atom.element)} roughness={0.4} metalness={0.12} />
        </mesh>
      ))}
    </group>
  );
};

const MoleculeGroup: React.FC<{
  molecules: StageMolecule[];
  x: number;
  colour: string;
}> = ({ molecules, x, colour }) => {
  if (molecules.length === 0) {
    return null;
  }

  const verticalSpacing = 3.6;
  const start = -((molecules.length - 1) * verticalSpacing) / 2;

  return (
    <group position={[x, 0, 0]}>
      {molecules.map((entry, index) => {
        const position: [number, number, number] = [0, start + index * verticalSpacing, 0];
        return (
          <RotatingMolecule key={entry.id} position={position} speed={0.25 + index * 0.05}>
            <pointLight position={[0, 0, 0]} intensity={0.4} color={colour} distance={6} />
            <MoleculeMesh parsed={entry.parsed} stageColour={colour} />
          </RotatingMolecule>
        );
      })}
    </group>
  );
};

const StageLegend: React.FC<{
  label: string;
  colour: string;
  components: ReactionComponentDetails[];
}> = ({ label, colour, components }) => (
  <div className="space-y-2 rounded-md border border-slate-700/60 bg-slate-900/60 p-3">
    <div className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: colour }}>
      {label}
    </div>
    {components.length > 0 ? (
      <ul className="space-y-1 text-[11px] text-slate-200">
        {components.map((component, index) => (
          <li key={`${component.role}-${index}`} className="flex flex-col gap-0.5">
            <span className="font-medium text-slate-100">
              {component.label ?? component.original ?? `Component ${index + 1}`}
            </span>
            {component.smiles && (
              <span className="font-mono text-[10px] text-slate-400" title={component.smiles}>
                {component.smiles}
              </span>
            )}
            {component.notes && (
              <span className="text-[10px] text-amber-300" title={component.notes}>
                {component.notes}
              </span>
            )}
          </li>
        ))}
      </ul>
    ) : (
      <p className="text-[10px] italic text-slate-400">No components</p>
    )}
  </div>
);

const ReactionMechanismScene: React.FC<ReactionMechanismSceneProps> = ({ resolution }) => {
  const grouped = useGroupedComponents(resolution);
  const { structures, loading, errors } = useStageStructures(resolution);
  const [webglLost, setWebglLost] = useState(false);
  const [canvasCycle, setCanvasCycle] = useState(0);

  const hasComponents = grouped.some(stage => stage.items.length > 0);
  const hasStructures = stageMeta.some(stage => structures[stage.key].length > 0);

  const stagePositions: Record<StageKey, number> = useMemo(() => ({
    reactant: -7.2,
    agent: 0,
    product: 7.2
  }), []);

  const handleCanvasCreated = useCallback(({ gl }: { gl: THREE.WebGLRenderer }) => {
    const canvas = gl.domElement;
    const handleLost = (event: Event) => {
      event.preventDefault();
      setWebglLost(true);
    };
    const handleRestored = () => setWebglLost(false);
    canvas.addEventListener('webglcontextlost', handleLost, false);
    canvas.addEventListener('webglcontextrestored', handleRestored, false);
  }, []);

  const handleRestoreCanvas = () => {
    setWebglLost(false);
    setCanvasCycle(prev => prev + 1);
  };

  return (
    <div className="flex w-full flex-col gap-4 rounded-xl border border-slate-200/40 bg-slate-900/60 p-4 shadow-inner">
      <div className="h-[380px] overflow-hidden rounded-lg border border-slate-700/60 bg-slate-950/80">
        {!hasComponents ? (
          <div className="flex h-full items-center justify-center text-sm text-slate-400">
            Provide a reaction to preview the animated mechanism.
          </div>
        ) : loading && !hasStructures ? (
          <div className="flex h-full items-center justify-center text-sm text-slate-300">
            Generating RDKit geometries…
          </div>
        ) : webglLost ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-sm text-slate-300">
            <p>WebGL context was lost, likely due to GPU resource limits. Reload the viewer to continue.</p>
            <button
              onClick={handleRestoreCanvas}
              className="rounded-md bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500"
            >
              Reload 3D Viewer
            </button>
          </div>
        ) : hasStructures ? (
          <Canvas
            key={canvasCycle}
            camera={{ position: [0, 0, 16], fov: 45 }}
            onCreated={handleCanvasCreated}
          >
            <color attach="background" args={['#020617']} />
            <ambientLight intensity={0.65} />
            <pointLight position={[10, 14, 8]} intensity={0.85} />
            <spotLight position={[-8, 12, 6]} angle={0.45} penumbra={0.6} intensity={0.55} />
            <Suspense fallback={null}>
              <group>
                {stageMeta.map(stage => (
                  <MoleculeGroup
                    key={stage.key}
                    molecules={structures[stage.key]}
                    x={stagePositions[stage.key]}
                    colour={stage.colour}
                  />
                ))}
              </group>
              <ReactionArrow />
            </Suspense>
          </Canvas>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-slate-300">
            RDKit could not derive 3D geometries for the supplied components.
          </div>
        )}
      </div>
      {loading && hasStructures && (
        <div className="rounded-md border border-slate-700/60 bg-slate-900/70 p-3 text-xs text-slate-300">
          Updating RDKit meshes… additional components may appear shortly.
        </div>
      )}
      {errors.length > 0 && (
        <div className="space-y-1 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-100">
          <p className="font-medium text-amber-200">RDKit could not render some components:</p>
          <ul className="space-y-1">
            {errors.map((entry, index) => (
              <li key={`${entry.component.role}-${entry.component.label ?? entry.component.original ?? index}`}>
                <span className="font-medium text-amber-100">
                  {entry.component.label ?? entry.component.original ?? 'Unnamed component'}
                </span>
                {entry.message && <span className="ml-2 text-amber-200/80">{entry.message}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="grid gap-3 md:grid-cols-3">
        {grouped.map(stage => (
          <StageLegend
            key={stage.key}
            label={stage.label}
            colour={stage.colour}
            components={stage.items}
          />
        ))}
      </div>
    </div>
  );
};

export default ReactionMechanismScene;
