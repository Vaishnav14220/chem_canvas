/**
 * LaserCursor Component
 * Visual laser pointer cursor with magnet effect for better button selection
 * Includes camera feed preview in bottom-right corner
 */

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { HandPosition } from '../services/handTrackingService';
import { X, Video } from 'lucide-react';

interface InteractiveElement {
  element: Element;
  rect: DOMRect;
  centerX: number;
  centerY: number;
  distance: number;
}

interface LaserCursorProps {
  handPosition: HandPosition | null;
  isActive: boolean;
  videoElement: HTMLVideoElement | null;
  color?: string;
  size?: number;
  magnetRadius?: number; // Distance in pixels to activate magnet effect
  magnetStrength?: number; // 0-1, how strongly cursor snaps to elements
}

const LaserCursor: React.FC<LaserCursorProps> = ({
  handPosition,
  isActive,
  videoElement,
  color = '#ff3333',
  size = 20,
  magnetRadius = 80,
  magnetStrength = 0.6,
}) => {
  const [trail, setTrail] = useState<Array<{ x: number; y: number; opacity: number }>>([]);
  const trailRef = useRef<Array<{ x: number; y: number; opacity: number }>>([]);
  const [isPinching, setIsPinching] = useState(false);
  const [magnetTarget, setMagnetTarget] = useState<InteractiveElement | null>(null);
  const [adjustedPosition, setAdjustedPosition] = useState<{ x: number; y: number } | null>(null);
  const [showCameraPreview, setShowCameraPreview] = useState(true);
  const videoPreviewRef = useRef<HTMLVideoElement>(null);

  // Interactive element selectors
  const INTERACTIVE_SELECTORS = 'button, a, [role="button"], input, select, textarea, [tabindex]:not([tabindex="-1"]), .clickable';

  // Find nearest interactive element within magnet radius
  const findNearestInteractiveElement = useCallback((x: number, y: number): InteractiveElement | null => {
    const elements = document.querySelectorAll(INTERACTIVE_SELECTORS);
    let nearest: InteractiveElement | null = null;
    let minDistance = magnetRadius;

    elements.forEach((element) => {
      const rect = element.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      
      // Calculate distance from cursor to element center
      const distance = Math.sqrt(
        Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2)
      );

      if (distance < minDistance) {
        minDistance = distance;
        nearest = { element, rect, centerX, centerY, distance };
      }
    });

    return nearest;
  }, [magnetRadius]);

  // Update video preview source when videoElement changes
  useEffect(() => {
    if (videoPreviewRef.current && videoElement) {
      videoPreviewRef.current.srcObject = videoElement.srcObject;
    }
  }, [videoElement]);

  // Update magnet effect and trail
  useEffect(() => {
    if (!handPosition || !isActive) {
      setTrail([]);
      trailRef.current = [];
      setMagnetTarget(null);
      setAdjustedPosition(null);
      return;
    }

    const { screenX, screenY } = handPosition;
    
    // Find nearest interactive element
    const nearestElement = findNearestInteractiveElement(screenX, screenY);
    setMagnetTarget(nearestElement);

    // Calculate adjusted position with magnet effect
    let finalX = screenX;
    let finalY = screenY;

    if (nearestElement) {
      const magnetFactor = magnetStrength * (1 - nearestElement.distance / magnetRadius);
      finalX = screenX + (nearestElement.centerX - screenX) * magnetFactor;
      finalY = screenY + (nearestElement.centerY - screenY) * magnetFactor;
    }

    setAdjustedPosition({ x: finalX, y: finalY });

    // Update trail
    const newPoint = {
      x: finalX,
      y: finalY,
      opacity: 1,
    };

    trailRef.current = [newPoint, ...trailRef.current.slice(0, 6)];
    trailRef.current = trailRef.current.map((point, index) => ({
      ...point,
      opacity: 1 - index * 0.15,
    }));

    setTrail([...trailRef.current]);
    setIsPinching(handPosition.isPinching);
  }, [handPosition, isActive, findNearestInteractiveElement, magnetStrength, magnetRadius]);

  if (!isActive) return null;

  const displayX = adjustedPosition?.x ?? handPosition?.screenX ?? 0;
  const displayY = adjustedPosition?.y ?? handPosition?.screenY ?? 0;
  const confidence = handPosition?.confidence ?? 0;

  return (
    <>
      {/* Main cursor layer */}
      <div
        className="fixed inset-0 pointer-events-none z-[10000]"
        style={{ overflow: 'hidden' }}
      >
        {handPosition && (
          <>
            {/* Trail effect */}
            {trail.map((point, index) => (
              <div
                key={index}
                className="absolute rounded-full"
                style={{
                  left: point.x - (size * (1 - index * 0.1)) / 2,
                  top: point.y - (size * (1 - index * 0.1)) / 2,
                  width: size * (1 - index * 0.1),
                  height: size * (1 - index * 0.1),
                  backgroundColor: color,
                  opacity: point.opacity * 0.25,
                  filter: `blur(${index * 2}px)`,
                }}
              />
            ))}

            {/* Magnet connection line */}
            {magnetTarget && (
              <svg
                className="absolute inset-0 w-full h-full pointer-events-none"
                style={{ overflow: 'visible' }}
              >
                <line
                  x1={displayX}
                  y1={displayY}
                  x2={magnetTarget.centerX}
                  y2={magnetTarget.centerY}
                  stroke={color}
                  strokeWidth="2"
                  strokeDasharray="4 4"
                  opacity="0.4"
                />
              </svg>
            )}

            {/* Magnet target highlight */}
            {magnetTarget && (
              <div
                className="absolute rounded-lg transition-all duration-100"
                style={{
                  left: magnetTarget.rect.left - 4,
                  top: magnetTarget.rect.top - 4,
                  width: magnetTarget.rect.width + 8,
                  height: magnetTarget.rect.height + 8,
                  border: `2px solid ${color}`,
                  boxShadow: `0 0 15px ${color}60, inset 0 0 10px ${color}20`,
                  opacity: 0.8,
                }}
              />
            )}

            {/* Outer glow */}
            <div
              className="absolute rounded-full transition-all duration-75"
              style={{
                left: displayX - size * 1.5,
                top: displayY - size * 1.5,
                width: size * 3,
                height: size * 3,
                background: `radial-gradient(circle, ${color}50 0%, transparent 70%)`,
                filter: 'blur(8px)',
              }}
            />

            {/* Middle ring - larger when magnetized */}
            <div
              className="absolute rounded-full transition-all duration-150"
              style={{
                left: displayX - size * (magnetTarget ? 1 : 0.75),
                top: displayY - size * (magnetTarget ? 1 : 0.75),
                width: size * (magnetTarget ? 2 : 1.5),
                height: size * (magnetTarget ? 2 : 1.5),
                border: `2px solid ${color}`,
                opacity: magnetTarget ? 0.9 : 0.6,
                boxShadow: `0 0 ${magnetTarget ? 20 : 10}px ${color}, inset 0 0 10px ${color}40`,
              }}
            />

            {/* Main laser dot */}
            <div
              className="absolute rounded-full transition-all duration-100"
              style={{
                left: displayX - size / 2,
                top: displayY - size / 2,
                width: size,
                height: size,
                backgroundColor: color,
                boxShadow: `0 0 20px ${color}, 0 0 40px ${color}, 0 0 60px ${color}80`,
                transform: isPinching ? 'scale(1.8)' : magnetTarget ? 'scale(1.3)' : 'scale(1)',
              }}
            />

            {/* Center bright spot */}
            <div
              className="absolute rounded-full"
              style={{
                left: displayX - size / 6,
                top: displayY - size / 6,
                width: size / 3,
                height: size / 3,
                backgroundColor: '#ffffff',
                boxShadow: `0 0 5px #ffffff`,
              }}
            />

            {/* Pinch indicator (click animation) */}
            {isPinching && (
              <>
                <div
                  className="absolute rounded-full animate-ping"
                  style={{
                    left: displayX - size * 1.5,
                    top: displayY - size * 1.5,
                    width: size * 3,
                    height: size * 3,
                    border: `3px solid ${color}`,
                    opacity: 0.8,
                  }}
                />
                <div
                  className="absolute text-xs font-bold"
                  style={{
                    left: displayX + size + 15,
                    top: displayY - 8,
                    color: '#22c55e',
                    textShadow: '0 0 5px #22c55e',
                  }}
                >
                  CLICK!
                </div>
              </>
            )}

            {/* Status indicator */}
            <div
              className="absolute flex flex-col items-start text-xs font-mono"
              style={{
                left: displayX + size + 15,
                top: displayY + 8,
                color: color,
                textShadow: `0 0 5px ${color}`,
                opacity: 0.8,
              }}
            >
              <span>{Math.round(confidence * 100)}%</span>
              {magnetTarget && (
                <span className="text-yellow-400" style={{ textShadow: '0 0 5px #facc15' }}>
                  🧲 LOCKED
                </span>
              )}
            </div>
          </>
        )}

        {/* No hand detected indicator */}
        {!handPosition && (
          <div
            className="fixed top-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-black/80 text-white rounded-full text-sm flex items-center gap-2"
          >
            <span className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
            Looking for hand...
          </div>
        )}
      </div>

      {/* Camera Preview - Bottom Right Corner */}
      {showCameraPreview && videoElement && (
        <div
          className="fixed bottom-4 right-4 z-[10001] rounded-xl overflow-hidden shadow-2xl border-2 border-white/20"
          style={{
            width: 200,
            height: 150,
          }}
        >
          {/* Video feed */}
          <video
            ref={videoPreviewRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
            style={{ transform: 'scaleX(-1)' }} // Mirror for natural view
          />
          
          {/* Overlay with hand detection indicator */}
          <div className="absolute inset-0 pointer-events-none">
            {/* Detection status bar */}
            <div className="absolute top-0 left-0 right-0 px-2 py-1 bg-black/50 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span
                  className={`w-2 h-2 rounded-full ${handPosition ? 'bg-green-400' : 'bg-yellow-400'} ${handPosition ? '' : 'animate-pulse'}`}
                />
                <span className="text-white text-[10px] font-medium">
                  {handPosition ? 'Hand Detected' : 'Searching...'}
                </span>
              </div>
              <Video className="w-3 h-3 text-white/70" />
            </div>

            {/* Confidence bar */}
            {handPosition && (
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/30">
                <div
                  className="h-full bg-green-400 transition-all duration-150"
                  style={{ width: `${confidence * 100}%` }}
                />
              </div>
            )}
          </div>

          {/* Close button */}
          <button
            onClick={() => setShowCameraPreview(false)}
            className="absolute top-1 right-1 p-1 bg-black/50 hover:bg-black/70 rounded-full transition-colors pointer-events-auto"
          >
            <X className="w-3 h-3 text-white" />
          </button>
        </div>
      )}

      {/* Show camera preview button if hidden */}
      {!showCameraPreview && isActive && (
        <button
          onClick={() => setShowCameraPreview(true)}
          className="fixed bottom-4 right-4 z-[10001] p-3 bg-gray-800 hover:bg-gray-700 rounded-full shadow-lg transition-colors"
        >
          <Video className="w-5 h-5 text-white" />
        </button>
      )}
    </>
  );
};

export default LaserCursor;
