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
  startNewSection: () => void;
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
const LINE_HEIGHT = 36; // compact but readable
const X_POSITION = 32; // shift left for more usable width
const MAX_Y_BEFORE_RESET = 2200;
const EXTRA_CHUNK_SPACING = 20; // modest spacing between streamed chunks
const MAX_CHARS_PER_LINE = 60; // wrap by characters for stability
const MIN_CHARS_PER_LINE = 24;

// Helper to format LaTeX to readable text
const formatLatex = (text: string): string => {
  let clean = text;

  // 0. Remove artifacts
  clean = clean.replace(/<ctrl\d+>/g, '');

  // 1. Common Math Symbols (Global replacement)
  const replacements: [RegExp, string][] = [
    [/\\sin/g, 'sin'], [/\\cos/g, 'cos'], [/\\tan/g, 'tan'],
    [/\\log/g, 'log'], [/\\ln/g, 'ln'], [/\\lim/g, 'lim'],
    [/\\theta/g, 'θ'], [/\\pi/g, 'π'], [/\\alpha/g, 'α'],
    [/\\beta/g, 'β'], [/\\gamma/g, 'γ'], [/\\delta/g, 'δ'],
    [/\\Delta/g, 'Δ'], [/\\approx/g, '≈'], [/\\neq/g, '≠'],
    [/\\leq/g, '≤'], [/\\geq/g, '≥'], [/\\times/g, '×'],
    [/\\div/g, '÷'], [/\\pm/g, '±'], [/\\rightarrow/g, '→'],
    [/\\leftarrow/g, '←'], [/\\to/g, '→'], [/\\infty/g, '∞'],
    [/\\cdot/g, '⋅'],
  ];

  replacements.forEach(([pattern, replacement]) => {
    clean = clean.replace(pattern, replacement);
  });

  // 2. Fractions: \frac{a}{b} -> (a/b)
  // Handle simple cases first
  clean = clean.replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, '($1/$2)');

  // 3. Subscripts/Superscripts
  // Convert simple numeric subscripts/superscripts to unicode
  const subMap: Record<string, string> = { '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉', '+': '₊', '-': '₋', '=': '₌', '(': '₍', ')': '₎' };
  const supMap: Record<string, string> = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '+': '⁺', '-': '⁻', '=': '₌', '(': '⁽', ')': '⁾', 'n': 'ⁿ' };

  // Handle _{...} for numbers
  clean = clean.replace(/_\{([0-9+\-=()]+)\}/g, (_, m) => m.split('').map((c: string) => subMap[c] || c).join(''));
  // Handle ^{...} for numbers
  clean = clean.replace(/\^\{([0-9+\-=()n]+)\}/g, (_, m) => m.split('').map((c: string) => supMap[c] || c).join(''));

  // Handle single char _1, ^2
  clean = clean.replace(/_([0-9])/g, (_, c) => subMap[c] || c);
  clean = clean.replace(/\^([0-9n])/g, (_, c) => supMap[c] || c);

  // 4. Handle remaining LaTeX structure for non-numeric sub/sup
  // e.g. lim_{x -> 0} -> lim (x -> 0)
  clean = clean.replace(/lim_\{([^{}]+)\}/g, 'lim ($1)');

  // Remove $ delimiters
  clean = clean.replace(/\$/g, '');

  // Cleanup remaining braces { } if they are just grouping simple text
  // e.g. {Δ x} -> Δ x
  clean = clean.replace(/\{([^{}]+)\}/g, '$1');

  return clean;
};

// Helper to wrap text
const wrapText = (text: string, maxChars: number): string => {
  const paragraphs = text.split('\n');
  return paragraphs.map(p => {
    // Check if line is a bullet point or list item
    const isList = /^(\s*[-*•]|\s*\d+\.)/.test(p);

    // If it's a list item, we want to preserve it on its own line
    // and maybe indent subsequent wrapped lines?
    // For now, simple wrapping.

    const words = p.split(' ');
    let currentLine = '';
    const lines: string[] = [];

    words.forEach(word => {
      // If adding the word exceeds max chars
      if ((currentLine + word).length > maxChars) {
        if (currentLine.trim()) lines.push(currentLine.trim());
        // For list items, subsequent lines could be indented, but let's keep it simple
        currentLine = (isList && lines.length === 0 ? '  ' : '') + word + ' ';
      } else {
        currentLine += word + ' ';
      }
    });
    if (currentLine.trim()) lines.push(currentLine.trimEnd());

    return lines.join('\n');
  }).join('\n');
};

export const ExcalidrawCanvas = forwardRef<ExcalidrawCanvasRef, ExcalidrawCanvasProps>(
  ({ isOpen, onClose, className = '', title = 'Gemini Live Canvas' }, ref) => {
    const excalidrawAPIRef = useRef<ExcalidrawAPI | null>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [elementsCount, setElementsCount] = useState(0);

    // Refs for streaming text handling
    const lastTextElementIdRef = useRef<string | null>(null);
    const lastContainerIdRef = useRef<string | null>(null); // Track which container we are writing in
    const currentTextBufferRef = useRef<string>('');
    const elementStartYRef = useRef<number>(50);

    // Reset Y position when canvas opens
    useEffect(() => {
      if (isOpen) {
        currentYPosition = 50;
      }
    }, [isOpen]);

    // Expose methods to parent component
    useImperativeHandle(ref, () => ({
      addHandwrittenText: async (text: string) => {
        console.log('[ExcalidrawCanvas] addHandwrittenText called with:', text.substring(0, 20) + '...');

        if (!excalidrawAPIRef.current) {
          console.warn('[ExcalidrawCanvas] API not ready yet');
          return;
        }

        try {
          console.log('[ExcalidrawCanvas] Loading convertToExcalidrawElements...');
          const convertToExcalidrawElements = await loadConvertToExcalidrawElements();
          console.log('[ExcalidrawCanvas] convertToExcalidrawElements loaded');

          // 1. Detect Target Container
          // Check for selected element first
          const appState = excalidrawAPIRef.current.getAppState();
          const selectedIds = Object.keys(appState.selectedElementIds || {}).filter(id => appState.selectedElementIds[id]);
          const elements = excalidrawAPIRef.current.getSceneElements();

          let containerElement = null;

          if (selectedIds.length === 1) {
            containerElement = elements.find((e: any) => e.id === selectedIds[0]);
          }

          // If no selection, check for recently added container (simple heuristic: last non-text element)
          if (!containerElement || !['rectangle', 'diamond', 'ellipse'].includes(containerElement.type)) {
            // Fallback: look for the last added rectangle/diamond/ellipse
            // We iterate backwards
            for (let i = elements.length - 1; i >= 0; i--) {
              if (['rectangle', 'diamond', 'ellipse'].includes(elements[i].type)) {
                containerElement = elements[i];
                break;
              }
            }
          }

          // If still no valid container, or if the container is too small, fallback to default behavior
          // But user specifically asked for "pre drawn box", so we prioritize it if found.
          // Let's define a "valid" container as one that is not deleted and has reasonable size
          let useContainer = false;
          let containerBounds = { x: X_POSITION, y: currentYPosition, width: 800, height: 0 };
          let currentContainerId = null;

          if (containerElement && !containerElement.isDeleted && containerElement.width > 100 && containerElement.height > 50) {
            useContainer = true;
            currentContainerId = containerElement.id;
            containerBounds = {
              x: containerElement.x,
              y: containerElement.y,
              width: containerElement.width,
              height: containerElement.height
            };
            console.log('[ExcalidrawCanvas] Using container:', containerElement.id);
          } else {
            console.log('[ExcalidrawCanvas] No valid container found, using default positioning');
          }

          // Check if container changed
          const containerChanged = currentContainerId !== lastContainerIdRef.current;
          if (containerChanged) {
            console.log('[ExcalidrawCanvas] Container changed from', lastContainerIdRef.current, 'to', currentContainerId);
          }

          // Check if we should start a new block (e.g. if text has double newline or it's been a while OR container changed)
          // For now, we assume continuous stream unless explicit break
          const isNewBlock = text.includes('\n\n') || containerChanged;
          console.log('[ExcalidrawCanvas] isNewBlock:', isNewBlock, 'containerChanged:', containerChanged);

          let targetElementId = lastTextElementIdRef.current;
          let fullText = '';

          if (isNewBlock || !targetElementId) {
            // Start new element
            currentTextBufferRef.current = text;
            // If using container, start Y at container top + padding
            elementStartYRef.current = useContainer ? containerBounds.y + 20 : currentYPosition;
            fullText = text;
            targetElementId = null; // Force creation

            // Update tracking refs
            lastContainerIdRef.current = currentContainerId;
          } else {
            // Append to existing
            currentTextBufferRef.current += text;
            fullText = currentTextBufferRef.current;
          }

          // Dynamic wrapping based on container width
          // Approx char width ~ 10px for fontSize 18 (Virgil)
          // Padding: 20px on each side
          const availableWidth = useContainer ? containerBounds.width - 40 : 800;
          const estimatedCharWidth = 10;
          const dynamicMaxChars = Math.floor(availableWidth / estimatedCharWidth);

          // Format LaTeX before wrapping
          const formattedText = formatLatex(fullText);

          // Wrap text
          const wrappedText = wrapText(formattedText, dynamicMaxChars);
          const lineCount = wrappedText.split('\n').length;

          // Calculate X position
          const textX = useContainer ? containerBounds.x + 20 : X_POSITION;
          const textY = useContainer ? containerBounds.y + 20 : elementStartYRef.current;

          console.log('[ExcalidrawCanvas] Positioning:', { textX, textY, useContainer, containerBounds });

          if (targetElementId) {
            // Update existing element
            const elementIndex = elements.findIndex((e: any) => e.id === targetElementId);

            if (elementIndex !== -1) {
              // Actually, to get correct path/bounds, we should re-convert
              const tempElements = convertToExcalidrawElements([{
                type: 'text',
                x: textX,
                y: textY, // Always use calculated Y
                text: wrappedText,
                fontSize: 18,
                fontFamily: 1,
                strokeColor: '#1f2937',
                textAlign: 'left',
                // containerId removed to avoid issues
              }]);

              const newElement = { ...tempElements[0], id: targetElementId };
              console.log('[ExcalidrawCanvas] Updating element:', newElement.id);

              const newSceneElements = [...elements];
              newSceneElements[elementIndex] = newElement;

              excalidrawAPIRef.current.updateScene({
                elements: newSceneElements
              });

              // Update Y for NEXT element (only if NOT in a container, or if we want to flow out)
              // If in container, we might just stay there. But for now, let's update global Y just in case.
              if (!useContainer) {
                currentYPosition = elementStartYRef.current + (lineCount * LINE_HEIGHT) + EXTRA_CHUNK_SPACING;
              }

              // Scroll if needed (only if not in container, to avoid jumping around)
              if (!useContainer) {
                excalidrawAPIRef.current.scrollToContent([newElement], {
                  fitToContent: false,
                  animate: false, // Don't animate every character update
                });
              }

              return;
            }
          }

          // Create new element (if not found or new block)
          const newElements = convertToExcalidrawElements([{
            type: 'text',
            x: textX,
            y: textY,
            text: wrappedText,
            fontSize: 18,
            fontFamily: 1,
            strokeColor: '#1f2937',
            textAlign: 'left',
            // containerId removed to avoid issues
          }]);

          const newElement = newElements[0];
          lastTextElementIdRef.current = newElement.id;
          console.log('[ExcalidrawCanvas] Creating new element:', newElement.id);

          // Update Y
          if (!useContainer) {
            currentYPosition = elementStartYRef.current + (lineCount * LINE_HEIGHT) + EXTRA_CHUNK_SPACING;
          }

          excalidrawAPIRef.current.updateScene({
            elements: [...excalidrawAPIRef.current.getSceneElements(), newElement],
          });

          if (!useContainer) {
            excalidrawAPIRef.current.scrollToContent([newElement], {
              fitToContent: false,
              animate: true,
            });
          }

          setElementsCount(prev => prev + 1);
          console.log('[ExcalidrawCanvas] Added/Updated text:', text.substring(0, 50) + '...');
        } catch (error) {
          console.error('[ExcalidrawCanvas] Error adding text:', error);
        }
      },

      startNewSection: () => {
        // Force next text addition to start a new element
        lastTextElementIdRef.current = null;
        currentTextBufferRef.current = '';
        // Add some extra spacing for the new section
        currentYPosition += LINE_HEIGHT * 2;
        console.log('[ExcalidrawCanvas] Starting new section');
      },

      clearCanvas: () => {
        if (excalidrawAPIRef.current) {
          excalidrawAPIRef.current.resetScene();
          currentYPosition = 50;
          setElementsCount(0);
          lastTextElementIdRef.current = null;
          currentTextBufferRef.current = '';
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
            className={`fixed bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-700 ${isFullscreen
              ? 'inset-0 z-[100] rounded-none'
              : 'left-[88px] right-4 top-64 bottom-4 rounded-xl z-40'
              } ${className}`}
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
        )
        }
      </AnimatePresence >
    );
  }
);

ExcalidrawCanvas.displayName = 'ExcalidrawCanvas';

export default ExcalidrawCanvas;
