/**
 * HandControlled3DMolecule Component
 * Demo component showing 3D molecule viewer with hand gesture controls
 * Uses CSS3D transforms for demonstration (can be connected to Three.js/MolView)
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Hand, RotateCcw, ZoomIn, ZoomOut, Move, Atom, RefreshCw, X, Maximize2, Minimize2 } from 'lucide-react';
import HandGesture3DController, { Gesture3DState, GestureMode } from './HandGesture3DController';
import { HandPosition } from '../services/handTrackingService';

interface HandControlled3DMoleculeProps {
  handPosition: HandPosition | null;
  isHandTrackingActive: boolean;
  moleculeName?: string;
  moleculeCid?: string;
  onClose?: () => void;
}

// Sample molecule data for CSS3D demo
const DEMO_ATOMS = [
  { id: 1, element: 'C', x: 0, y: 0, z: 0, color: '#333333', radius: 30 },
  { id: 2, element: 'H', x: 50, y: 50, z: 20, color: '#ffffff', radius: 20 },
  { id: 3, element: 'H', x: -50, y: 50, z: 20, color: '#ffffff', radius: 20 },
  { id: 4, element: 'H', x: 50, y: -50, z: -20, color: '#ffffff', radius: 20 },
  { id: 5, element: 'H', x: -50, y: -50, z: -20, color: '#ffffff', radius: 20 },
  { id: 6, element: 'O', x: 0, y: -80, z: 0, color: '#ff0000', radius: 28 },
];

const DEMO_BONDS = [
  { from: 1, to: 2 },
  { from: 1, to: 3 },
  { from: 1, to: 4 },
  { from: 1, to: 5 },
  { from: 1, to: 6 },
];

const HandControlled3DMolecule: React.FC<HandControlled3DMoleculeProps> = ({
  handPosition,
  isHandTrackingActive,
  moleculeName = 'Methanol',
  moleculeCid = '887',
  onClose,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [useMolView, setUseMolView] = useState(false);
  const [gestureState, setGestureState] = useState<Gesture3DState>({
    mode: 'idle',
    rotationX: 0,
    rotationY: 0,
    zoom: 1,
    panX: 0,
    panY: 0,
  });

  // For CSS3D demo
  const [rotation, setRotation] = useState({ x: -20, y: 30 });
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  // Handle rotation from gestures
  const handleRotate = useCallback((deltaX: number, deltaY: number) => {
    setRotation(prev => ({
      x: prev.x + deltaY,
      y: prev.y + deltaX,
    }));
  }, []);

  // Handle zoom from gestures
  const handleZoom = useCallback((delta: number) => {
    setZoom(prev => Math.max(0.5, Math.min(3, prev + delta * 0.1)));
  }, []);

  // Handle pan from gestures
  const handlePan = useCallback((deltaX: number, deltaY: number) => {
    setPan(prev => ({
      x: prev.x + deltaX,
      y: prev.y + deltaY,
    }));
  }, []);

  // Reset view
  const resetView = useCallback(() => {
    setRotation({ x: -20, y: 30 });
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  // Calculate 3D position for atoms
  const get3DPosition = (atom: typeof DEMO_ATOMS[0]) => {
    const radX = (rotation.x * Math.PI) / 180;
    const radY = (rotation.y * Math.PI) / 180;

    // Rotate around Y axis
    let x = atom.x * Math.cos(radY) - atom.z * Math.sin(radY);
    let z = atom.x * Math.sin(radY) + atom.z * Math.cos(radY);

    // Rotate around X axis
    let y = atom.y * Math.cos(radX) - z * Math.sin(radX);
    z = atom.y * Math.sin(radX) + z * Math.cos(radX);

    // Apply zoom and pan
    x = x * zoom + pan.x;
    y = y * zoom + pan.y;

    // Calculate depth for z-ordering and size
    const depth = (z + 100) / 200; // normalize to 0-1

    return { x, y, z, depth };
  };

  // Get bond line coordinates
  const getBondCoordinates = (bond: typeof DEMO_BONDS[0]) => {
    const fromAtom = DEMO_ATOMS.find(a => a.id === bond.from)!;
    const toAtom = DEMO_ATOMS.find(a => a.id === bond.to)!;

    const from = get3DPosition(fromAtom);
    const to = get3DPosition(toAtom);

    return { from, to };
  };

  // Auto-rotate when idle
  useEffect(() => {
    if (!isHandTrackingActive || gestureState.mode !== 'idle') return;

    const interval = setInterval(() => {
      setRotation(prev => ({
        ...prev,
        y: prev.y + 0.5,
      }));
    }, 50);

    return () => clearInterval(interval);
  }, [isHandTrackingActive, gestureState.mode]);

  return (
    <div
      ref={containerRef}
      className={`bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl overflow-hidden shadow-2xl relative ${
        isFullscreen ? 'fixed inset-4 z-50' : 'w-full h-[500px]'
      }`}
    >
      {/* Hand Gesture Controller */}
      {isHandTrackingActive && (
        <HandGesture3DController
          handPosition={handPosition}
          isActive={isHandTrackingActive}
          onGestureChange={setGestureState}
          onRotate={handleRotate}
          onZoom={handleZoom}
          onPan={handlePan}
          targetRef={containerRef}
        />
      )}

      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 px-4 py-3 bg-gradient-to-b from-black/50 to-transparent">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <Atom className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h3 className="text-white font-semibold">{moleculeName}</h3>
              <p className="text-gray-400 text-xs">
                {isHandTrackingActive ? '✋ Hand Control Active' : '🖱️ Mouse Control'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={resetView}
              className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
              title="Reset View"
            >
              <RefreshCw className="w-4 h-4 text-white" />
            </button>
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
            >
              {isFullscreen ? (
                <Minimize2 className="w-4 h-4 text-white" />
              ) : (
                <Maximize2 className="w-4 h-4 text-white" />
              )}
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
              >
                <X className="w-4 h-4 text-white" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 3D Molecule View (CSS3D Demo) */}
      {!useMolView && (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ perspective: '1000px' }}
        >
          <div
            className="relative"
            style={{
              width: 300,
              height: 300,
              transformStyle: 'preserve-3d',
            }}
          >
            {/* Bonds */}
            <svg
              className="absolute inset-0 w-full h-full"
              style={{ overflow: 'visible' }}
            >
              {DEMO_BONDS.map((bond, idx) => {
                const { from, to } = getBondCoordinates(bond);
                const avgDepth = (from.depth + to.depth) / 2;
                return (
                  <line
                    key={idx}
                    x1={150 + from.x}
                    y1={150 + from.y}
                    x2={150 + to.x}
                    y2={150 + to.y}
                    stroke={`rgba(100, 150, 200, ${0.3 + avgDepth * 0.7})`}
                    strokeWidth={2 + avgDepth * 3}
                    strokeLinecap="round"
                  />
                );
              })}
            </svg>

            {/* Atoms */}
            {DEMO_ATOMS
              .map(atom => ({ ...atom, pos: get3DPosition(atom) }))
              .sort((a, b) => a.pos.z - b.pos.z)
              .map(atom => (
                <div
                  key={atom.id}
                  className="absolute flex items-center justify-center font-bold text-sm transition-all duration-75"
                  style={{
                    left: 150 + atom.pos.x - (atom.radius * zoom * (0.7 + atom.pos.depth * 0.6)) / 2,
                    top: 150 + atom.pos.y - (atom.radius * zoom * (0.7 + atom.pos.depth * 0.6)) / 2,
                    width: atom.radius * zoom * (0.7 + atom.pos.depth * 0.6),
                    height: atom.radius * zoom * (0.7 + atom.pos.depth * 0.6),
                    backgroundColor: atom.color,
                    borderRadius: '50%',
                    boxShadow: `
                      inset -3px -3px 10px rgba(0,0,0,0.4),
                      inset 3px 3px 10px rgba(255,255,255,0.2),
                      0 0 ${10 + atom.pos.depth * 20}px ${atom.color}40
                    `,
                    color: atom.element === 'C' ? '#fff' : '#333',
                    zIndex: Math.round(atom.pos.depth * 100),
                    opacity: 0.7 + atom.pos.depth * 0.3,
                  }}
                >
                  {atom.element}
                </div>
              ))}
          </div>
        </div>
      )}

      {/* MolView Embed (Optional) */}
      {useMolView && (
        <iframe
          src={`https://embed.molview.org/v1/?mode=balls&cid=${moleculeCid}`}
          className="absolute inset-0 w-full h-full"
          style={{ border: 'none' }}
          title="MolView"
        />
      )}

      {/* Controls Panel */}
      <div className="absolute bottom-4 left-4 right-4 z-10">
        <div className="flex items-center justify-between">
          {/* View mode toggle */}
          <button
            onClick={() => setUseMolView(!useMolView)}
            className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white text-sm transition-colors"
          >
            {useMolView ? 'CSS3D Demo' : 'MolView Mode'}
          </button>

          {/* Gesture hints */}
          {isHandTrackingActive && (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/20 rounded-lg border border-blue-500/50">
                <span className="text-lg">☝️</span>
                <span className="text-blue-400 text-xs">Rotate</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/20 rounded-lg border border-green-500/50">
                <span className="text-lg">🤏</span>
                <span className="text-green-400 text-xs">Zoom</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/20 rounded-lg border border-amber-500/50">
                <span className="text-lg">🖐️</span>
                <span className="text-amber-400 text-xs">Pan</span>
              </div>
            </div>
          )}

          {/* Current state */}
          <div className="flex items-center gap-2 text-white/70 text-sm">
            <span>Zoom: {(zoom * 100).toFixed(0)}%</span>
            <span>•</span>
            <span>Rot: {rotation.y.toFixed(0)}°</span>
          </div>
        </div>
      </div>

      {/* Hand tracking disabled hint */}
      {!isHandTrackingActive && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 px-4 py-2 bg-white/10 rounded-full text-white/70 text-sm flex items-center gap-2">
          <Hand className="w-4 h-4" />
          Enable hand tracking for gesture controls
        </div>
      )}
    </div>
  );
};

export default HandControlled3DMolecule;
