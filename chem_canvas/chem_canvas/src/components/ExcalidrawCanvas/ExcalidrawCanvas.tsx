import React, { lazy, Suspense, useRef, useEffect, useCallback, useState, forwardRef, useImperativeHandle } from 'react';
import "@excalidraw/excalidraw/index.css";
import { motion, AnimatePresence } from 'framer-motion';
import { X, Maximize2, Minimize2, Eraser, PenTool, Type } from 'lucide-react';

// Lazy load Excalidraw for Vite compatibility (similar to Next.js dynamic import)
const Excalidraw = lazy(async () => {
  const module = await import("@excalidraw/excalidraw");
  return { default: module.Excalidraw };
});

// Also lazy load the convertToExcalidrawElements utility
const loadConvertToExcalidrawElements = async () => {
  const module = await import("@excalidraw/excalidraw");
  return module.convertToExcalidrawElements;
};

// Types for Excalidraw API - use any to avoid strict type conflicts
type ExcalidrawAPI = any;

export interface ExcalidrawCanvasRef {
  addHandwrittenText: (text: string) => Promise<void>;
  clearCanvas: () => void;
  getElements: () => any[];
}

interface ExcalidrawCanvasProps {
  isOpen: boolean;
  onClose: () => void;
  className?: string;
  title?: string;
}

// Track position for adding new text elements
let currentYPosition = 50;
const LINE_HEIGHT = 40;
const X_POSITION = 50;
const MAX_Y_BEFORE_RESET = 800;

export const ExcalidrawCanvas = forwardRef<ExcalidrawCanvasRef, ExcalidrawCanvasProps>(
  ({ isOpen, onClose, className = '', title = 'Gemini Live Canvas' }, ref) => {
    const excalidrawAPIRef = useRef<ExcalidrawAPI | null>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [elementsCount, setElementsCount] = useState(0);

    // Reset Y position when canvas opens
    useEffect(() => {
      if (isOpen) {
        currentYPosition = 50;
      }
    }, [isOpen]);

    // Expose methods to parent component
    useImperativeHandle(ref, () => ({
      addHandwrittenText: async (text: string) => {
        if (!excalidrawAPIRef.current) {
          console.warn('[ExcalidrawCanvas] API not ready yet');
          return;
        }

        try {
          const convertToExcalidrawElements = await loadConvertToExcalidrawElements();
          
          // Split text into lines if too long (max ~60 chars per line for readability)
          const words = text.split(' ');
          const lines: string[] = [];
          let currentLine = '';
          
          for (const word of words) {
            if ((currentLine + ' ' + word).length > 60) {
              if (currentLine) lines.push(currentLine.trim());
              currentLine = word;
            } else {
              currentLine = currentLine ? currentLine + ' ' + word : word;
            }
          }
          if (currentLine) lines.push(currentLine.trim());

          // Create text elements for each line with handwriting style
          const newElements = lines.map((line, index) => ({
            type: 'text' as const,
            x: X_POSITION,
            y: currentYPosition + (index * LINE_HEIGHT),
            text: line,
            fontSize: 24,
            fontFamily: 1, // Virgil (handwriting font)
            strokeColor: '#1e293b', // Dark slate for readability
            textAlign: 'left' as const,
          }));

          // Update Y position for next batch of text
          currentYPosition += lines.length * LINE_HEIGHT + 20;

          // Reset Y if we're getting too far down
          if (currentYPosition > MAX_Y_BEFORE_RESET) {
            currentYPosition = 50;
          }

          // Convert to Excalidraw elements
          const excalidrawElements = convertToExcalidrawElements(newElements);

          // Get existing elements and add new ones
          const existingElements = excalidrawAPIRef.current.getSceneElements();
          const allElements = [...existingElements, ...excalidrawElements];

          // Update scene
          excalidrawAPIRef.current.updateScene({
            elements: allElements,
          });

          // Scroll to show new content
          excalidrawAPIRef.current.scrollToContent(excalidrawElements, {
            fitToContent: false,
            animate: true,
          });

          setElementsCount(allElements.length);
          console.log('[ExcalidrawCanvas] Added text:', text.substring(0, 50) + '...');
        } catch (error) {
          console.error('[ExcalidrawCanvas] Error adding text:', error);
        }
      },

      clearCanvas: () => {
        if (excalidrawAPIRef.current) {
          excalidrawAPIRef.current.resetScene();
          currentYPosition = 50;
          setElementsCount(0);
          console.log('[ExcalidrawCanvas] Canvas cleared');
        }
      },

      getElements: () => {
        return excalidrawAPIRef.current?.getSceneElements() || [];
      },
    }));

    const handleExcalidrawAPIReady = useCallback((api: ExcalidrawAPI) => {
      excalidrawAPIRef.current = api;
      console.log('[ExcalidrawCanvas] Excalidraw API ready');
    }, []);

    return (
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 100 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className={`fixed bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-700 z-40 ${
              isFullscreen
                ? 'left-4 right-4 top-28 bottom-8 rounded-xl'
                : 'right-4 top-28 bottom-24 w-[520px] rounded-xl'
            } max-h-[calc(100vh-8rem)] ${className}`}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 rounded-t-xl">
              <div className="flex items-center gap-2">
                <PenTool className="w-5 h-5 text-cyan-500" />
                <span className="font-medium text-sm text-slate-700 dark:text-slate-200">
                  {title}
                </span>
                {elementsCount > 0 && (
                  <span className="text-xs px-2 py-0.5 bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400 rounded-full">
                    {elementsCount} items
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => ref && 'current' in ref && ref.current?.clearCanvas()}
                  className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                  title="Clear canvas"
                >
                  <Eraser className="w-4 h-4 text-slate-500" />
                </button>
                <button
                  onClick={() => setIsFullscreen(!isFullscreen)}
                  className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                  title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                >
                  {isFullscreen ? (
                    <Minimize2 className="w-4 h-4 text-slate-500" />
                  ) : (
                    <Maximize2 className="w-4 h-4 text-slate-500" />
                  )}
                </button>
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                  title="Close"
                >
                  <X className="w-4 h-4 text-slate-500" />
                </button>
              </div>
            </div>

            {/* Excalidraw Canvas */}
            <div className="flex-1 h-[calc(100%-52px)]">
              <Suspense
                fallback={
                  <div className="flex items-center justify-center h-full bg-slate-50 dark:bg-slate-900">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                      <span className="text-sm text-slate-500">Loading canvas...</span>
                    </div>
                  </div>
                }
              >
                <Excalidraw
                  excalidrawAPI={handleExcalidrawAPIReady}
                  theme="light"
                  initialData={{
                    appState: {
                      viewBackgroundColor: '#ffffff',
                      currentItemFontFamily: 1, // Virgil (handwriting)
                      currentItemFontSize: 24,
                      zenModeEnabled: false,
                      gridSize: undefined,
                    },
                  }}
                  UIOptions={{
                    canvasActions: {
                      loadScene: false,
                      saveToActiveFile: false,
                      export: false,
                    },
                  }}
                />
              </Suspense>
            </div>

            {/* Footer hint */}
            <div className="absolute bottom-2 left-4 right-4 text-center">
              <span className="text-[10px] text-slate-400 dark:text-slate-500">
                ✨ Gemini Live responses appear here as handwritten notes
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  }
);

ExcalidrawCanvas.displayName = 'ExcalidrawCanvas';

export default ExcalidrawCanvas;
