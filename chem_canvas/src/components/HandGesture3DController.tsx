/**
 * HandGesture3DController Component
 * Provides hand gesture-based control for 3D objects (molecules, models)
 * Supports: Rotate, Zoom, Pan gestures
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { HandPosition } from '../services/handTrackingService';
import { RotateCcw, ZoomIn, ZoomOut, Move, Hand, Maximize2, Info } from 'lucide-react';

export type GestureMode = 'rotate' | 'zoom' | 'pan' | 'idle';

export interface Gesture3DState {
  mode: GestureMode;
  rotationX: number;
  rotationY: number;
  zoom: number;
  panX: number;
  panY: number;
}

interface HandGesture3DControllerProps {
  handPosition: HandPosition | null;
  isActive: boolean;
  onGestureChange?: (state: Gesture3DState) => void;
  onRotate?: (deltaX: number, deltaY: number) => void;
  onZoom?: (delta: number) => void;
  onPan?: (deltaX: number, deltaY: number) => void;
  targetRef?: React.RefObject<HTMLElement>;
  sensitivity?: {
    rotation: number;
    zoom: number;
    pan: number;
  };
}

// Gesture detection thresholds
const PINCH_THRESHOLD = 0.06;
const FIST_THRESHOLD = 0.12;
const OPEN_HAND_THRESHOLD = 0.25;
const MOVEMENT_THRESHOLD = 0.01;

const HandGesture3DController: React.FC<HandGesture3DControllerProps> = ({
  handPosition,
  isActive,
  onGestureChange,
  onRotate,
  onZoom,
  onPan,
  targetRef,
  sensitivity = { rotation: 2, zoom: 3, pan: 1.5 },
}) => {
  const [gestureState, setGestureState] = useState<Gesture3DState>({
    mode: 'idle',
    rotationX: 0,
    rotationY: 0,
    zoom: 1,
    panX: 0,
    panY: 0,
  });
  
  const [showTutorial, setShowTutorial] = useState(true);
  const lastPositionRef = useRef<{ x: number; y: number } | null>(null);
  const lastPinchDistanceRef = useRef<number | null>(null);
  const gestureStartRef = useRef<{ x: number; y: number } | null>(null);
  const currentModeRef = useRef<GestureMode>('idle');
  const smoothingRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Detect gesture type based on hand landmarks
  const detectGestureMode = useCallback((position: HandPosition): GestureMode => {
    if (position.isPinching) {
      return 'zoom';
    }
    
    // Check if hand is open (pointing gesture for rotation)
    if (position.isPointing) {
      return 'rotate';
    }
    
    // Default to pan for other gestures
    return 'pan';
  }, []);

  // Apply smoothing to reduce jitter
  const applySmoothing = useCallback((newX: number, newY: number, factor: number = 0.3) => {
    smoothingRef.current.x = smoothingRef.current.x * (1 - factor) + newX * factor;
    smoothingRef.current.y = smoothingRef.current.y * (1 - factor) + newY * factor;
    return { x: smoothingRef.current.x, y: smoothingRef.current.y };
  }, []);

  // Process hand position and update gesture state
  useEffect(() => {
    if (!isActive || !handPosition) {
      if (currentModeRef.current !== 'idle') {
        currentModeRef.current = 'idle';
        setGestureState(prev => ({ ...prev, mode: 'idle' }));
      }
      lastPositionRef.current = null;
      gestureStartRef.current = null;
      return;
    }

    const { x, y, screenX, screenY, isPinching } = handPosition;
    const detectedMode = detectGestureMode(handPosition);
    
    // Update mode if changed
    if (detectedMode !== currentModeRef.current) {
      currentModeRef.current = detectedMode;
      gestureStartRef.current = { x, y };
      lastPositionRef.current = { x, y };
      setGestureState(prev => ({ ...prev, mode: detectedMode }));
    }

    // Process gestures based on mode
    if (lastPositionRef.current) {
      const rawDeltaX = x - lastPositionRef.current.x;
      const rawDeltaY = y - lastPositionRef.current.y;
      
      // Apply smoothing
      const { x: deltaX, y: deltaY } = applySmoothing(rawDeltaX, rawDeltaY);

      // Only process if movement is significant
      if (Math.abs(deltaX) > MOVEMENT_THRESHOLD || Math.abs(deltaY) > MOVEMENT_THRESHOLD) {
        switch (detectedMode) {
          case 'rotate':
            const rotX = deltaX * sensitivity.rotation * 100;
            const rotY = deltaY * sensitivity.rotation * 100;
            onRotate?.(rotX, rotY);
            setGestureState(prev => ({
              ...prev,
              rotationX: prev.rotationX + rotX,
              rotationY: prev.rotationY + rotY,
            }));
            break;

          case 'zoom':
            // For zoom, use vertical movement
            const zoomDelta = -deltaY * sensitivity.zoom;
            onZoom?.(zoomDelta);
            setGestureState(prev => ({
              ...prev,
              zoom: Math.max(0.5, Math.min(3, prev.zoom + zoomDelta)),
            }));
            break;

          case 'pan':
            const panDeltaX = deltaX * sensitivity.pan * 100;
            const panDeltaY = deltaY * sensitivity.pan * 100;
            onPan?.(panDeltaX, panDeltaY);
            setGestureState(prev => ({
              ...prev,
              panX: prev.panX + panDeltaX,
              panY: prev.panY + panDeltaY,
            }));
            break;
        }
      }
    }

    lastPositionRef.current = { x, y };
    onGestureChange?.(gestureState);
  }, [handPosition, isActive, detectGestureMode, applySmoothing, sensitivity, onRotate, onZoom, onPan, onGestureChange, gestureState]);

  // Hide tutorial after 10 seconds
  useEffect(() => {
    if (isActive && showTutorial) {
      const timer = setTimeout(() => setShowTutorial(false), 10000);
      return () => clearTimeout(timer);
    }
  }, [isActive, showTutorial]);

  if (!isActive) return null;

  const getModeColor = (mode: GestureMode) => {
    switch (mode) {
      case 'rotate': return '#3b82f6'; // blue
      case 'zoom': return '#22c55e'; // green
      case 'pan': return '#f59e0b'; // amber
      default: return '#6b7280'; // gray
    }
  };

  const getModeIcon = (mode: GestureMode) => {
    switch (mode) {
      case 'rotate': return <RotateCcw className="w-5 h-5" />;
      case 'zoom': return gestureState.zoom > 1 ? <ZoomIn className="w-5 h-5" /> : <ZoomOut className="w-5 h-5" />;
      case 'pan': return <Move className="w-5 h-5" />;
      default: return <Hand className="w-5 h-5" />;
    }
  };

  const getModeLabel = (mode: GestureMode) => {
    switch (mode) {
      case 'rotate': return 'Rotating';
      case 'zoom': return 'Zooming';
      case 'pan': return 'Panning';
      default: return 'Ready';
    }
  };

  return (
    <>
      {/* Gesture Mode Indicator - Top Left */}
      <div
        className="fixed top-20 left-4 z-[9999] pointer-events-none"
      >
        <div
          className="flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg transition-all duration-200"
          style={{
            backgroundColor: `${getModeColor(gestureState.mode)}20`,
            border: `2px solid ${getModeColor(gestureState.mode)}`,
          }}
        >
          <div
            className="p-2 rounded-lg"
            style={{ backgroundColor: getModeColor(gestureState.mode) }}
          >
            {getModeIcon(gestureState.mode)}
          </div>
          <div className="flex flex-col">
            <span
              className="text-sm font-bold"
              style={{ color: getModeColor(gestureState.mode) }}
            >
              {getModeLabel(gestureState.mode)}
            </span>
            <span className="text-xs text-gray-500">
              {gestureState.mode === 'rotate' && 'Point finger & move'}
              {gestureState.mode === 'zoom' && 'Pinch & move up/down'}
              {gestureState.mode === 'pan' && 'Open hand & drag'}
              {gestureState.mode === 'idle' && 'Make a gesture'}
            </span>
          </div>
        </div>

        {/* Stats Display */}
        <div className="mt-2 px-3 py-2 bg-black/70 rounded-lg text-white text-xs font-mono space-y-1">
          <div className="flex justify-between gap-4">
            <span>Rotation:</span>
            <span>{gestureState.rotationX.toFixed(0)}° / {gestureState.rotationY.toFixed(0)}°</span>
          </div>
          <div className="flex justify-between gap-4">
            <span>Zoom:</span>
            <span>{(gestureState.zoom * 100).toFixed(0)}%</span>
          </div>
          <div className="flex justify-between gap-4">
            <span>Pan:</span>
            <span>{gestureState.panX.toFixed(0)} / {gestureState.panY.toFixed(0)}</span>
          </div>
        </div>
      </div>

      {/* Gesture Tutorial Overlay */}
      {showTutorial && (
        <div className="fixed inset-0 z-[9998] pointer-events-none flex items-center justify-center">
          <div className="bg-black/80 text-white rounded-2xl p-6 max-w-md mx-4 shadow-2xl pointer-events-auto">
            <div className="flex items-center gap-2 mb-4">
              <Info className="w-5 h-5 text-blue-400" />
              <h3 className="text-lg font-bold">3D Gesture Controls</h3>
              <button
                onClick={() => setShowTutorial(false)}
                className="ml-auto p-1 hover:bg-white/20 rounded"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-4">
              {/* Rotate Gesture */}
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-blue-500/20 rounded-xl flex items-center justify-center border-2 border-blue-500">
                  <span className="text-3xl">☝️</span>
                </div>
                <div>
                  <p className="font-semibold text-blue-400">Point & Move = Rotate</p>
                  <p className="text-sm text-gray-400">Point your index finger and move to rotate the molecule</p>
                </div>
              </div>

              {/* Zoom Gesture */}
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-green-500/20 rounded-xl flex items-center justify-center border-2 border-green-500">
                  <span className="text-3xl">🤏</span>
                </div>
                <div>
                  <p className="font-semibold text-green-400">Pinch + Up/Down = Zoom</p>
                  <p className="text-sm text-gray-400">Pinch and move up to zoom in, down to zoom out</p>
                </div>
              </div>

              {/* Pan Gesture */}
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-amber-500/20 rounded-xl flex items-center justify-center border-2 border-amber-500">
                  <span className="text-3xl">🖐️</span>
                </div>
                <div>
                  <p className="font-semibold text-amber-400">Open Hand + Move = Pan</p>
                  <p className="text-sm text-gray-400">Open your hand and move to pan the view</p>
                </div>
              </div>
            </div>

            <p className="text-xs text-gray-500 mt-4 text-center">
              This tutorial will close automatically in a few seconds
            </p>
          </div>
        </div>
      )}

      {/* Gesture Trail Visualization on Target */}
      {handPosition && targetRef?.current && (
        <div
          className="fixed pointer-events-none z-[9997]"
          style={{
            left: targetRef.current.getBoundingClientRect().left,
            top: targetRef.current.getBoundingClientRect().top,
            width: targetRef.current.getBoundingClientRect().width,
            height: targetRef.current.getBoundingClientRect().height,
          }}
        >
          {/* Rotation indicator arc */}
          {gestureState.mode === 'rotate' && (
            <svg className="absolute inset-0 w-full h-full" style={{ overflow: 'visible' }}>
              <defs>
                <linearGradient id="rotateGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity="0" />
                  <stop offset="50%" stopColor="#3b82f6" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                </linearGradient>
              </defs>
              <circle
                cx="50%"
                cy="50%"
                r="40%"
                fill="none"
                stroke="url(#rotateGradient)"
                strokeWidth="3"
                strokeDasharray="10 5"
                style={{
                  transform: `rotate(${gestureState.rotationX}deg)`,
                  transformOrigin: 'center',
                }}
              />
            </svg>
          )}

          {/* Zoom indicator */}
          {gestureState.mode === 'zoom' && (
            <div
              className="absolute inset-0 flex items-center justify-center"
            >
              <div
                className="rounded-full border-4 border-green-500 transition-all duration-150"
                style={{
                  width: `${30 + gestureState.zoom * 20}%`,
                  height: `${30 + gestureState.zoom * 20}%`,
                  opacity: 0.5,
                }}
              />
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default HandGesture3DController;
