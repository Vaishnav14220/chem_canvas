
import React, { useRef, useMemo, useState, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, TransformControls, Grid } from '@react-three/drei';
import * as THREE from 'three';
import { useEditorStore, NodeData } from './3d/editorStore';
import { Toolbar } from './3d/Toolbar';
import { AssetLibrary } from './3d/AssetLibrary';
import { RightSidebar } from './3d/RightSidebar';
import { Layers, Edit3 } from 'lucide-react';

// Lazy load the iCraft viewer to avoid loading it when not needed
const ICraftViewer = React.lazy(() => import('./3d/ICraftViewer'));

// --- Primitives ---

const GlowMaterial = ({ color, selected }: { color: string, selected: boolean }) => (
    <>
        <meshStandardMaterial
            color={color}
            metalness={0.6}
            roughness={0.2}
            emissive={selected ? color : '#000000'}
            emissiveIntensity={selected ? 0.5 : 0}
        />
        {selected && (
            <meshBasicMaterial color="white" wireframe transparent opacity={0.3} />
        )}
    </>
);

const NodeMesh = ({ node, selected, onSelect }: { node: NodeData, selected: boolean, onSelect: () => void }) => {
    const meshRef = useRef<THREE.Mesh>(null);
    const { type, color, position, rotation, scale } = node;

    const geometry = useMemo(() => {
        switch (type) {
            case 'cube': return <boxGeometry args={[1, 1, 1]} />;
            case 'sphere': return <sphereGeometry args={[0.6, 32, 32]} />;
            case 'cylinder': return <cylinderGeometry args={[0.5, 0.5, 1, 32]} />;
            case 'cone': return <coneGeometry args={[0.5, 1, 32]} />;
            case 'torus': return <torusGeometry args={[0.5, 0.2, 16, 100]} />;
            case 'plane': return <planeGeometry args={[1, 1]} />;
            case 'server': return <boxGeometry args={[0.8, 1.2, 0.8]} />;
            case 'database': return <cylinderGeometry args={[0.6, 0.6, 1, 32]} />;
            case 'firewall': return <boxGeometry args={[1.5, 1, 0.1]} />;
            case 'router': return <boxGeometry args={[1, 0.3, 0.5]} />;
            case 'cloud': return <sphereGeometry args={[0.8, 16, 16]} />;
            case 'browser': return <planeGeometry args={[1.6, 0.9]} />;
            default: return <boxGeometry args={[1, 1, 1]} />;
        }
    }, [type]);

    return (
        <group position={position} rotation={rotation} scale={scale} onClick={(e) => { e.stopPropagation(); onSelect(); }}>
            <mesh ref={meshRef} castShadow receiveShadow>
                {geometry}
                <GlowMaterial color={color} selected={selected} />
            </mesh>
            {type === 'server' && (
                <mesh position={[0, 0.4, 0.41]}>
                    <sphereGeometry args={[0.05]} />
                    <meshBasicMaterial color="#48bb78" />
                </mesh>
            )}
        </group>
    );
};

const SceneContent = () => {
    const { nodes, selection, selectNode, updateNode, transformMode } = useEditorStore();

    const handleTransformEnd = (e: any) => {
        if (!e?.target?.object) return;
        const obj = e.target.object;
        const id = selection[0];
        if (id) {
            updateNode(id, {
                position: [obj.position.x, obj.position.y, obj.position.z],
                rotation: [obj.rotation.x, obj.rotation.y, obj.rotation.z],
                scale: [obj.scale.x, obj.scale.y, obj.scale.z]
            });
        }
    };

    return (
        <>
            <group onPointerMissed={() => selectNode(null)}>
                {nodes.map(node => (
                    <React.Fragment key={node.id}>
                        {selection.includes(node.id) ? (
                            <TransformControls
                                object={undefined}
                                mode={transformMode}
                                onMouseUp={handleTransformEnd}
                                translationSnap={0.5}
                                rotationSnap={Math.PI / 8}
                            >
                                <NodeMesh
                                    node={node}
                                    selected={true}
                                    onSelect={() => selectNode(node.id)}
                                />
                            </TransformControls>
                        ) : (
                            <NodeMesh
                                node={node}
                                selected={false}
                                onSelect={() => selectNode(node.id)}
                            />
                        )}
                    </React.Fragment>
                ))}
            </group>
        </>
    );
};

type EditorMode = 'custom' | 'icraft';

export default function ThreeDArchitectureEditor() {
    const [mode, setMode] = useState<EditorMode>('icraft');

    return (
        <div className="w-full h-full relative bg-[#111] overflow-hidden">

            {/* Mode Toggle - Top Right */}
            <div className="absolute top-4 right-4 z-50 flex bg-black/70 backdrop-blur-md rounded-lg border border-white/10 p-1">
                <button
                    onClick={() => setMode('custom')}
                    className={`px-3 py-2 rounded-md flex items-center gap-2 text-sm transition-colors ${mode === 'custom'
                            ? 'bg-cyan-500/20 text-cyan-400'
                            : 'text-gray-400 hover:text-white'
                        }`}
                >
                    <Edit3 className="w-4 h-4" />
                    Custom Editor
                </button>
                <button
                    onClick={() => setMode('icraft')}
                    className={`px-3 py-2 rounded-md flex items-center gap-2 text-sm transition-colors ${mode === 'icraft'
                            ? 'bg-cyan-500/20 text-cyan-400'
                            : 'text-gray-400 hover:text-white'
                        }`}
                >
                    <Layers className="w-4 h-4" />
                    iCraft Templates
                </button>
            </div>

            {mode === 'icraft' ? (
                <Suspense fallback={
                    <div className="w-full h-full flex items-center justify-center text-white">
                        Loading iCraft Viewer...
                    </div>
                }>
                    <ICraftViewer />
                </Suspense>
            ) : (
                <>
                    {/* Custom Editor UI Overlay */}
                    <Toolbar />
                    <AssetLibrary />
                    <RightSidebar />

                    {/* 3D Canvas */}
                    <Canvas shadows camera={{ position: [8, 8, 8], fov: 45 }}>
                        <color attach="background" args={['#111']} />
                        <fog attach="fog" args={['#111', 15, 50]} />

                        <ambientLight intensity={0.4} />
                        <pointLight position={[10, 10, 10]} intensity={1} castShadow />
                        <directionalLight position={[-5, 5, -5]} intensity={0.5} />

                        <Grid
                            renderOrder={-1}
                            position={[0, -0.01, 0]}
                            infiniteGrid
                            cellSize={1}
                            sectionSize={5}
                            fadeDistance={30}
                            sectionColor="#4fd1c5"
                            cellColor="#2d3748"
                        />

                        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
                            <planeGeometry args={[100, 100]} />
                            <meshStandardMaterial color="#111" transparent opacity={0.5} roughness={0.8} />
                        </mesh>

                        <SceneContent />

                        <OrbitControls makeDefault minDistance={2} maxDistance={50} />
                    </Canvas>
                </>
            )}
        </div>
    );
}
