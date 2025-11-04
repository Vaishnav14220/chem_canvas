import React, { Suspense, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { ReactionResolutionResult, ReactionComponentDetails } from '../services/reactionResolver';
import { buildMolElement, stageMeta, tokenizeSmiles } from '../utils/reactMolHelpers';

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

const MoleculeGroup: React.FC<{
  components: ReactionComponentDetails[];
  x: number;
  colour: string;
}> = ({ components, x, colour }) => {
  if (components.length === 0) {
    return null;
  }

  const verticalSpacing = 2.8;
  const start = -((components.length - 1) * verticalSpacing) / 2;

  return (
    <group position={[x, 0, 0]}>
      {components.map((component, index) => {
        const tokens = tokenizeSmiles(component.smiles ?? component.canonicalSmiles ?? component.label);
        const moleculeElement = buildMolElement(tokens);
        const position: [number, number, number] = [0, start + index * verticalSpacing, 0];
        return (
          <RotatingMolecule key={`${component.role}-${index}`} position={position} speed={0.25 + index * 0.05}>
            <pointLight position={[0, 0, 0]} intensity={0.35} color={colour} distance={5} />
            {moleculeElement}
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
          <li key={`${component.role}-${index}`} className="flex flex-col">
            <span className="font-medium text-slate-100">
              {component.label ?? component.original ?? `Component ${index + 1}`}
            </span>
            {component.smiles && (
              <span className="font-mono text-[10px] text-slate-400">{component.smiles}</span>
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

  const hasContent = grouped.some(stage => stage.items.length > 0);

  return (
    <div className="flex w-full flex-col gap-4 rounded-xl border border-slate-200/40 bg-slate-900/60 p-4 shadow-inner">
      <div className="h-[380px] overflow-hidden rounded-lg border border-slate-700/60 bg-slate-950/80">
        {hasContent ? (
          <Canvas camera={{ position: [0, 0, 16], fov: 45 }}>
            <color attach="background" args={['#020617']} />
            <ambientLight intensity={0.6} />
            <pointLight position={[10, 14, 8]} intensity={0.8} />
            <spotLight position={[-8, 12, 6]} angle={0.45} penumbra={0.6} intensity={0.5} />
            <Suspense fallback={null}>
              <group>
                <MoleculeGroup components={grouped[0].items} x={-6.5} colour={grouped[0].colour} />
                <MoleculeGroup components={grouped[1].items} x={0} colour={grouped[1].colour} />
                <MoleculeGroup components={grouped[2].items} x={6.5} colour={grouped[2].colour} />
              </group>
              <ReactionArrow />
            </Suspense>
          </Canvas>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-slate-400">
            Provide a reaction to preview the animated mechanism.
          </div>
        )}
      </div>
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
