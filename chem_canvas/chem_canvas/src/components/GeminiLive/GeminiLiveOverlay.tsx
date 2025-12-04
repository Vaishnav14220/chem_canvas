import React, { useState, useRef } from 'react';
import { GripHorizontal } from 'lucide-react';
import { motion, useDragControls } from 'framer-motion';
import { useGeminiLive } from './hooks/useGeminiLive';
import GeminiLiveLearningCanvas from './GeminiLiveLearningCanvas';
import { LearningCanvasImage } from './types';

interface GeminiLiveOverlayProps {
  geminiLiveState: ReturnType<typeof useGeminiLive>;
  onExpandImage: (image: LearningCanvasImage) => void;
}

const GeminiLiveOverlay: React.FC<GeminiLiveOverlayProps> = ({ 
  geminiLiveState, 
  onExpandImage
}) => {
  const dragControls = useDragControls();

  // Resize state for Learning Canvas
  const [size, setSize] = useState({ width: 900, height: 600 });
  const [isResizing, setIsResizing] = useState(false);
  const resizeRef = useRef<{ startX: number; startY: number; startWidth: number; startHeight: number } | null>(null);

  const {
    simulationState,
    error,
    simplifyStep
  } = geminiLiveState;

  // Resize handlers
  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    resizeRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startWidth: size.width,
      startHeight: size.height
    };
    document.addEventListener('mousemove', handleResizeMove);
    document.addEventListener('mouseup', handleResizeEnd);
  };

  const handleResizeMove = (e: MouseEvent) => {
    if (!resizeRef.current) return;
    const deltaX = e.clientX - resizeRef.current.startX;
    const deltaY = e.clientY - resizeRef.current.startY;

    setSize({
      width: Math.max(400, resizeRef.current.startWidth + deltaX),
      height: Math.max(300, resizeRef.current.startHeight + deltaY)
    });
  };

  const handleResizeEnd = () => {
    setIsResizing(false);
    resizeRef.current = null;
    document.removeEventListener('mousemove', handleResizeMove);
    document.removeEventListener('mouseup', handleResizeEnd);
  };

  const shouldShowLearningCanvas =
    simulationState.isActive &&
    simulationState.type === 'LEARNING_CANVAS' &&
    simulationState.learningCanvasParams &&
    simulationState.learningCanvasParams;

  return (
    <>
      {/* Error Toast */}
      {error && (
        <div className="fixed bottom-24 right-6 z-50 pointer-events-auto mb-2 max-w-xs rounded-xl border border-red-500/30 bg-red-950/90 px-4 py-3 text-xs text-red-200 shadow-xl backdrop-blur-md">
          {error}
        </div>
      )}

      {/* Learning Canvas Overlay - Draggable & Resizable */}
      {shouldShowLearningCanvas && (
        <div className="fixed inset-0 z-40 pointer-events-none flex items-center justify-center">
          <motion.div
            drag
            dragListener={false}
            dragControls={dragControls}
            dragMomentum={false}
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            style={{ width: size.width, height: size.height }}
            className="pointer-events-auto relative flex flex-col overflow-hidden rounded-3xl border border-slate-700/50 bg-slate-950/95 shadow-2xl backdrop-blur-xl"
          >
            {/* Minimal Drag Handle - Top Right */}
            <div
              className="absolute top-0 left-0 right-0 h-8 z-10 flex justify-end px-4 py-2 opacity-0 hover:opacity-100 transition-opacity cursor-move"
              onPointerDown={(e) => dragControls.start(e)}
            >
              <div className="flex items-center gap-2 bg-slate-900/80 rounded-full px-2 py-1 backdrop-blur-md border border-slate-700/50">
                <GripHorizontal className="text-slate-400" size={16} />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-0 cursor-default relative" onPointerDown={(e) => e.stopPropagation()}>
              <GeminiLiveLearningCanvas
                params={simulationState.learningCanvasParams!}
                onExpandImage={onExpandImage}
                onRequestSimplification={simplifyStep}
              />
            </div>

            {/* Resize Handle */}
            <div
              className="absolute bottom-0 right-0 h-6 w-6 cursor-se-resize flex items-center justify-center"
              onMouseDown={handleResizeStart}
            >
              <div className="h-2 w-2 rounded-full bg-slate-600/50" />
            </div>
          </motion.div>
        </div>
      )}
    </>
  );
};

export default GeminiLiveOverlay;
