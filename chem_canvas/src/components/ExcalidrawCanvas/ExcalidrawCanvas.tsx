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

// Load export utilities
const loadExportUtils = async () => {
  const module = await import("@excalidraw/excalidraw");
  return {
    exportToBlob: module.exportToBlob,
    exportToCanvas: module.exportToCanvas
  };
};

// Load mermaid-to-excalidraw parser
const loadMermaidParser = async () => {
  const module = await import("@excalidraw/mermaid-to-excalidraw");
  return module.parseMermaidToExcalidraw;
};

// Types for Excalidraw API - use any to avoid strict type conflicts
type ExcalidrawAPI = any;

// Diagram element types for programmatic drawing
export interface DiagramElement {
  type: 'rectangle' | 'ellipse' | 'arrow' | 'line' | 'text';
  x: number;
  y: number;
  width?: number;
  height?: number;
  text?: string;
  endX?: number; // For arrows/lines
  endY?: number;
  strokeColor?: string;
  backgroundColor?: string;
}

type StickyNotePayload = {
  id: string;
  text: string;
  speaker?: 'user' | 'model';
  isFinal?: boolean;
};

export interface ExcalidrawCanvasRef {
  addHandwrittenText: (text: string) => Promise<void>;
  addStickyNote: (payload: StickyNotePayload) => Promise<void>;
  startNewSection: () => void;
  clearCanvas: () => void;
  getElements: () => any[];
  exportToImage: () => Promise<string | null>; // Returns base64 PNG
  drawDiagram: (elements: DiagramElement[]) => Promise<void>; // Draw shapes programmatically
  setActiveTool: (tool: 'freedraw' | 'eraser' | 'text' | 'selection') => void; // Set drawing tool
  setStrokeColor: (color: string) => void; // Set stroke color
  drawMermaid: (mermaidSyntax: string) => Promise<void>; // Draw Mermaid diagram
  loadLibrary: (category: string) => Promise<boolean>; // Load external library
  insertLibraryItem: (itemNameOrKeyword: string) => Promise<boolean>; // Insert library item onto canvas
  generateAndInsertImage: (prompt: string, options?: { model?: 'nano-banana' | 'nano-banana-pro' }) => Promise<boolean>; // Generate AI image and insert onto canvas
  addImageFromBase64: (base64: string, mimeType: string, options?: { width?: number; height?: number; x?: number; y?: number }) => Promise<boolean>; // Add base64 image to canvas
}

interface ExcalidrawCanvasProps {
  isOpen: boolean;
  onClose: () => void;
  className?: string;
  title?: string;
  embedded?: boolean; // When true, renders inline without modal wrapper
  onElementsChange?: (elements: any[], appState: any) => void;
}

// Track position for adding new text elements
let currentYPosition = 50;
const LINE_HEIGHT = 28; // compact for more content
const X_POSITION = 50; // centered start
const MAX_Y_BEFORE_RESET = 3000;
const EXTRA_CHUNK_SPACING = 15; // modest spacing between streamed chunks
const MAX_CHARS_PER_LINE = 100; // wider text to use full canvas width
const MIN_CHARS_PER_LINE = 40;

const STICKY_NOTE_WIDTH = 320;
const STICKY_NOTE_MIN_HEIGHT = 140;
const STICKY_NOTE_PADDING = 16;
const STICKY_NOTE_LINE_HEIGHT = 22;
const STICKY_NOTE_GAP = 26;
const STICKY_NOTE_X = 60;
const STICKY_NOTE_START_Y = 60;
const STICKY_NOTE_FONT_SIZE = 16;
const STICKY_NOTE_CHAR_WIDTH = 8;
const STICKY_NOTE_MIN_CHARS_PER_LINE = 22;
const STICKY_NOTE_STYLES = {
  model: { backgroundColor: '#FEF3C7', strokeColor: '#F59E0B', textColor: '#92400E' },
  user: { backgroundColor: '#DBEAFE', strokeColor: '#3B82F6', textColor: '#1E40AF' },
};

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

  // 5. Strip Markdown formatting
  // Bold: **text** or __text__ -> text
  clean = clean.replace(/\*\*([^*]+)\*\*/g, '$1');
  clean = clean.replace(/__([^_]+)__/g, '$1');

  // Italic: *text* or _text_ -> text
  clean = clean.replace(/\*([^*]+)\*/g, '$1');
  clean = clean.replace(/_([^_]+)_/g, '$1');

  // Headers: # Header -> HEADER (with underline effect)
  clean = clean.replace(/^#{1,6}\s*(.+)$/gm, '═══ $1 ═══');

  // Inline code: `code` -> code
  clean = clean.replace(/`([^`]+)`/g, '$1');

  // Links: [text](url) -> text
  clean = clean.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

  // Bullet points: - or * at start of line -> •
  clean = clean.replace(/^[\s]*[-*]\s+/gm, '• ');

  // Clean up extra asterisks that might be leftover
  clean = clean.replace(/\*+/g, '');

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
  ({ isOpen, onClose, className = '', title = 'Gemini Live Canvas', embedded = false, onElementsChange }, ref) => {
    const excalidrawAPIRef = useRef<ExcalidrawAPI | null>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [elementsCount, setElementsCount] = useState(0);

    // Refs for streaming text handling
    const lastTextElementIdRef = useRef<string | null>(null);
    const lastContainerIdRef = useRef<string | null>(null); // Track which container we are writing in
    const currentTextBufferRef = useRef<string>('');
    const elementStartYRef = useRef<number>(50);
    const stickyNotesRef = useRef<Record<string, {
      rectId: string;
      textId: string;
      groupId: string;
      x: number;
      y: number;
      width: number;
      height: number;
      lastText: string;
      speaker: 'user' | 'model';
    }>>({});
    const stickyNoteCursorRef = useRef<{ x: number; y: number }>({
      x: STICKY_NOTE_X,
      y: STICKY_NOTE_START_Y,
    });
    const lastStickyNoteIdRef = useRef<string | null>(null);

    // Reset Y position when canvas opens
    useEffect(() => {
      if (isOpen) {
        currentYPosition = 50;
        stickyNotesRef.current = {};
        stickyNoteCursorRef.current = { x: STICKY_NOTE_X, y: STICKY_NOTE_START_Y };
        lastStickyNoteIdRef.current = null;
      }
    }, [isOpen]);

    const formatStickyNoteText = (text: string, speaker: 'user' | 'model') => {
      const label = speaker === 'user' ? 'You' : 'Gemini';
      return `${label}:\n${text.trim()}`;
    };

    const getStickyNotePosition = (height: number) => {
      const position = { x: stickyNoteCursorRef.current.x, y: stickyNoteCursorRef.current.y };
      stickyNoteCursorRef.current.y = position.y + height + STICKY_NOTE_GAP;
      return position;
    };

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

      addStickyNote: async (payload: StickyNotePayload) => {
        if (!excalidrawAPIRef.current) {
          console.warn('[ExcalidrawCanvas] API not ready yet');
          return;
        }

        const trimmedText = payload.text?.trim();
        if (!trimmedText) {
          return;
        }

        const speaker: 'user' | 'model' = payload.speaker === 'user' ? 'user' : 'model';
        const noteText = formatStickyNoteText(trimmedText, speaker);
        const maxChars = Math.max(
          STICKY_NOTE_MIN_CHARS_PER_LINE,
          Math.floor((STICKY_NOTE_WIDTH - STICKY_NOTE_PADDING * 2) / STICKY_NOTE_CHAR_WIDTH)
        );
        const wrappedText = wrapText(noteText, maxChars);
        const lineCount = wrappedText.split('\n').length;
        const noteHeight = Math.max(
          STICKY_NOTE_MIN_HEIGHT,
          lineCount * STICKY_NOTE_LINE_HEIGHT + STICKY_NOTE_PADDING * 2
        );
        const styles = speaker === 'user' ? STICKY_NOTE_STYLES.user : STICKY_NOTE_STYLES.model;

        const existing = stickyNotesRef.current[payload.id];
        if (existing && existing.lastText === wrappedText && !payload.isFinal) {
          return;
        }

        const rectId = existing?.rectId ?? `sticky-rect-${payload.id}`;
        const textId = existing?.textId ?? `sticky-text-${payload.id}`;
        const groupId = existing?.groupId ?? `sticky-group-${payload.id}`;
        const position = existing ? { x: existing.x, y: existing.y } : getStickyNotePosition(noteHeight);
        const noteX = position.x;
        const noteY = position.y;

        try {
          const convertToExcalidrawElements = await loadConvertToExcalidrawElements();
          const rawElements = [
            {
              id: rectId,
              type: 'rectangle',
              x: noteX,
              y: noteY,
              width: STICKY_NOTE_WIDTH,
              height: noteHeight,
              strokeColor: styles.strokeColor,
              backgroundColor: styles.backgroundColor,
              fillStyle: 'solid',
              strokeWidth: 2,
              roundness: { type: 3, value: 6 },
            },
            {
              id: textId,
              type: 'text',
              x: noteX + STICKY_NOTE_PADDING,
              y: noteY + STICKY_NOTE_PADDING,
              text: wrappedText,
              fontSize: STICKY_NOTE_FONT_SIZE,
              fontFamily: 1,
              strokeColor: styles.textColor,
              textAlign: 'left',
            },
          ];

          const converted = convertToExcalidrawElements(rawElements).map((element: any) => ({
            ...element,
            groupIds: [groupId],
          }));
          const rectElement = converted.find((element: any) => element.id === rectId) || converted[0];
          const textElement = converted.find((element: any) => element.id === textId) || converted[1];

          const sceneElements = excalidrawAPIRef.current.getSceneElements();
          const rectIndex = sceneElements.findIndex((element: any) => element.id === rectId);
          const textIndex = sceneElements.findIndex((element: any) => element.id === textId);
          let nextElements = sceneElements.map((element: any) => {
            if (element.id === rectId) return rectElement;
            if (element.id === textId) return textElement;
            return element;
          });

          if (rectIndex === -1) {
            nextElements = [...nextElements, rectElement];
          }
          if (textIndex === -1) {
            nextElements = [...nextElements, textElement];
          }

          excalidrawAPIRef.current.updateScene({ elements: nextElements });

          stickyNotesRef.current[payload.id] = {
            rectId,
            textId,
            groupId,
            x: noteX,
            y: noteY,
            width: STICKY_NOTE_WIDTH,
            height: noteHeight,
            lastText: wrappedText,
            speaker,
          };

          if (!existing) {
            setElementsCount(prev => prev + 2);
            lastStickyNoteIdRef.current = payload.id;
          }

          if (lastStickyNoteIdRef.current === payload.id) {
            const nextY = noteY + noteHeight + STICKY_NOTE_GAP;
            if (stickyNoteCursorRef.current.y < nextY) {
              stickyNoteCursorRef.current.y = nextY;
            }
          }

          if (!existing || payload.isFinal) {
            excalidrawAPIRef.current.scrollToContent([rectElement], {
              fitToContent: false,
              animate: Boolean(payload.isFinal),
            });
          }
        } catch (error) {
          console.error('[ExcalidrawCanvas] Error adding sticky note:', error);
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
          stickyNotesRef.current = {};
          stickyNoteCursorRef.current = { x: STICKY_NOTE_X, y: STICKY_NOTE_START_Y };
          lastStickyNoteIdRef.current = null;
          console.log('[ExcalidrawCanvas] Canvas cleared');
        }
      },

      getElements: () => {
        return excalidrawAPIRef.current?.getSceneElements() || [];
      },

      exportToImage: async () => {
        if (!excalidrawAPIRef.current) {
          console.warn('[ExcalidrawCanvas] API not ready for export');
          return null;
        }

        try {
          const { exportToBlob } = await loadExportUtils();
          const elements = excalidrawAPIRef.current.getSceneElements();
          const appState = excalidrawAPIRef.current.getAppState();

          if (!elements || elements.length === 0) {
            console.warn('[ExcalidrawCanvas] No elements to export');
            return null;
          }

          const blob = await exportToBlob({
            elements,
            appState: {
              ...appState,
              exportWithDarkMode: false,
              exportBackground: true,
            },
            files: null,
            mimeType: 'image/png',
          });

          // Convert blob to base64
          return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              const result = reader.result as string;
              const base64 = result.split(',')[1]; // Remove data:image/png;base64, prefix
              resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        } catch (error) {
          console.error('[ExcalidrawCanvas] Export to image failed:', error);
          return null;
        }
      },

      // Draw programmatic diagram elements (shapes, arrows, text)
      drawDiagram: async (elements: DiagramElement[]) => {
        if (!excalidrawAPIRef.current) {
          console.warn('[ExcalidrawCanvas] API not ready for drawing');
          return;
        }

        try {
          const convertToExcalidrawElements = await loadConvertToExcalidrawElements();
          const newElements: any[] = [];

          for (const el of elements) {
            const id = `${el.type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

            if (el.type === 'rectangle') {
              newElements.push({
                type: 'rectangle',
                id,
                x: el.x,
                y: el.y,
                width: el.width || 100,
                height: el.height || 50,
                strokeColor: el.strokeColor || '#1e40af',
                backgroundColor: el.backgroundColor || '#dbeafe',
                fillStyle: 'solid',
                strokeWidth: 2,
                roundness: { type: 3, value: 8 },
              });
            } else if (el.type === 'ellipse') {
              newElements.push({
                type: 'ellipse',
                id,
                x: el.x,
                y: el.y,
                width: el.width || 80,
                height: el.height || 60,
                strokeColor: el.strokeColor || '#7c3aed',
                backgroundColor: el.backgroundColor || '#ede9fe',
                fillStyle: 'solid',
                strokeWidth: 2,
              });
            } else if (el.type === 'arrow' && el.endX !== undefined && el.endY !== undefined) {
              newElements.push({
                type: 'arrow',
                id,
                x: el.x,
                y: el.y,
                width: el.endX - el.x,
                height: el.endY - el.y,
                strokeColor: el.strokeColor || '#1f2937',
                strokeWidth: 2,
                points: [[0, 0], [el.endX - el.x, el.endY - el.y]],
              });
            } else if (el.type === 'line' && el.endX !== undefined && el.endY !== undefined) {
              newElements.push({
                type: 'line',
                id,
                x: el.x,
                y: el.y,
                width: el.endX - el.x,
                height: el.endY - el.y,
                strokeColor: el.strokeColor || '#1f2937',
                strokeWidth: 2,
                points: [[0, 0], [el.endX - el.x, el.endY - el.y]],
              });
            } else if (el.type === 'text' && el.text) {
              newElements.push({
                type: 'text',
                id,
                x: el.x,
                y: el.y,
                text: el.text,
                fontSize: 18,
                fontFamily: 1,
                strokeColor: el.strokeColor || '#1f2937',
                textAlign: 'left',
              });
            }
          }

          // Convert and add to scene
          const convertedElements = convertToExcalidrawElements(newElements);
          const existingElements = excalidrawAPIRef.current.getSceneElements();

          excalidrawAPIRef.current.updateScene({
            elements: [...existingElements, ...convertedElements],
          });

          console.log(`[ExcalidrawCanvas] Drew ${elements.length} diagram elements`);
        } catch (error) {
          console.error('[ExcalidrawCanvas] Error drawing diagram:', error);
        }
      },

      // Set the active drawing tool
      setActiveTool: (tool: 'freedraw' | 'eraser' | 'text' | 'selection') => {
        if (!excalidrawAPIRef.current) {
          console.warn('[ExcalidrawCanvas] API not ready for tool change');
          return;
        }
        try {
          excalidrawAPIRef.current.setActiveTool({ type: tool });
          console.log(`[ExcalidrawCanvas] Set active tool to: ${tool}`);
        } catch (error) {
          console.error('[ExcalidrawCanvas] Error setting tool:', error);
        }
      },

      // Set the stroke color
      setStrokeColor: (color: string) => {
        if (!excalidrawAPIRef.current) {
          console.warn('[ExcalidrawCanvas] API not ready for color change');
          return;
        }
        try {
          excalidrawAPIRef.current.updateScene({
            appState: {
              currentItemStrokeColor: color,
            },
          });
          console.log(`[ExcalidrawCanvas] Set stroke color to: ${color}`);
        } catch (error) {
          console.error('[ExcalidrawCanvas] Error setting color:', error);
        }
      },

      // Draw Mermaid diagram
      drawMermaid: async (mermaidSyntax: string) => {
        if (!excalidrawAPIRef.current) {
          console.warn('[ExcalidrawCanvas] API not ready for Mermaid diagram');
          return;
        }
        try {
          console.log('[ExcalidrawCanvas] Parsing Mermaid diagram...');
          const parseMermaidToExcalidraw = await loadMermaidParser();
          const convertToExcalidrawElements = await loadConvertToExcalidrawElements();

          const { elements: skeletonElements, files } = await parseMermaidToExcalidraw(mermaidSyntax, {
            themeVariables: {
              fontSize: '16px',
            },
          });

          console.log(`[ExcalidrawCanvas] Parsed ${skeletonElements.length} skeleton elements from Mermaid`);

          // Debug: Log first element structure
          if (skeletonElements.length > 0) {
            console.log('[ExcalidrawCanvas] First skeleton element:', JSON.stringify(skeletonElements[0], null, 2));
          }

          // Convert skeleton elements to proper Excalidraw elements
          const excalidrawElements = convertToExcalidrawElements(skeletonElements);
          console.log(`[ExcalidrawCanvas] Converted to ${excalidrawElements.length} Excalidraw elements`);

          // Debug: Log first converted element
          if (excalidrawElements.length > 0) {
            const first = excalidrawElements[0] as any;
            console.log(`[ExcalidrawCanvas] First element: type=${first.type}, x=${first.x}, y=${first.y}`);
          }

          // Find bounding box
          let minX = Infinity, minY = Infinity;
          excalidrawElements.forEach((el: any) => {
            if (typeof el.x === 'number' && el.x < minX) minX = el.x;
            if (typeof el.y === 'number' && el.y < minY) minY = el.y;
          });
          console.log(`[ExcalidrawCanvas] Bounds: minX=${minX}, minY=${minY}`);

          // Offset elements to visible position
          const offsetX = 100 - (isFinite(minX) ? minX : 0);
          const offsetY = 100 - (isFinite(minY) ? minY : 0);
          const positionedElements = excalidrawElements.map((el: any) => ({
            ...el,
            x: (el.x || 0) + offsetX,
            y: (el.y || 0) + offsetY,
          }));

          // Update scene with elements and files
          excalidrawAPIRef.current.updateScene({
            elements: positionedElements,
            appState: {
              scrollX: 0,
              scrollY: 0,
              zoom: { value: 1 },
            },
          });

          // Add any files (like images from mermaid)
          if (files && Object.keys(files).length > 0) {
            excalidrawAPIRef.current.addFiles(Object.values(files));
          }

          console.log('[ExcalidrawCanvas] Mermaid diagram rendered successfully');
        } catch (error) {
          console.error('[ExcalidrawCanvas] Error rendering Mermaid diagram:', error);
          throw error;
        }
      },

      // Load external library
      loadLibrary: async (category: string): Promise<boolean> => {
        try {
          const { fetchLibrary } = await import('../../services/excalidrawLibraryService');
          const items = await fetchLibrary(category);
          if (items && excalidrawAPIRef.current) {
            excalidrawAPIRef.current.updateLibrary({
              libraryItems: items,
              merge: true,
            });
            console.log(`[ExcalidrawCanvas] Loaded library: ${category}`);
            return true;
          }
          return false;
        } catch (error) {
          console.error('[ExcalidrawCanvas] Failed to load library:', error);
          return false;
        }
      },

      // Insert library item onto canvas
      insertLibraryItem: async (itemNameOrKeyword: string): Promise<boolean> => {
        if (!excalidrawAPIRef.current) return false;

        try {
          const { findLibraryCategory, fetchLibrary, searchLibrary, createFallbackElements } =
            await import('../../services/excalidrawLibraryService');

          // Find matching category
          const category = findLibraryCategory(itemNameOrKeyword);

          if (category) {
            // Fetch library and find item
            const items = await fetchLibrary(category);
            if (items) {
              const item = searchLibrary(items, itemNameOrKeyword);
              if (item && item.elements) {
                // Position elements at visible location
                const positionedElements = item.elements.map((el: any, i: number) => ({
                  ...el,
                  id: `lib-${Date.now()}-${i}`,
                  x: (el.x || 0) + 100,
                  y: (el.y || 0) + 100,
                }));

                const existingElements = excalidrawAPIRef.current!.getSceneElements();
                excalidrawAPIRef.current!.updateScene({
                  elements: [...existingElements, ...positionedElements],
                });

                console.log(`[ExcalidrawCanvas] Inserted library item: ${item.name || itemNameOrKeyword}`);
                return true;
              }
            }
          }

          // Fallback: create basic elements
          const fallbackElements = createFallbackElements(itemNameOrKeyword);
          if (fallbackElements) {
            const existingElements = excalidrawAPIRef.current.getSceneElements();
            excalidrawAPIRef.current.updateScene({
              elements: [...existingElements, ...fallbackElements],
            });
            console.log('[ExcalidrawCanvas] Used fallback elements');
            return true;
          }

          return false;
        } catch (error) {
          console.error('[ExcalidrawCanvas] Failed to insert library item:', error);
          return false;
        }
      },

      // Generate AI image and insert onto canvas
      generateAndInsertImage: async (prompt: string, options?: { model?: 'nano-banana' | 'nano-banana-pro' }): Promise<boolean> => {
        if (!excalidrawAPIRef.current) return false;

        try {
          console.log(`[ExcalidrawCanvas] Generating image with prompt: ${prompt}`);

          // Import and call generateNanoBananaImage
          const { generateNanoBananaImage } = await import('../../services/geminiService');
          const model = options?.model || 'nano-banana';
          const result = await generateNanoBananaImage(prompt, {
            model,
            aspectRatio: '1:1',
            imageSize: model === 'nano-banana-pro' ? '1K' : undefined,
          });

          // Create a file ID for the image
          const fileId = `ai-image-${Date.now()}`;
          const dataURL = `data:${result.mimeType};base64,${result.imageBase64}`;

          console.log('[ExcalidrawCanvas] Adding file with ID:', fileId);
          console.log('[ExcalidrawCanvas] Data URL length:', dataURL.length);

          // Add the image as a file to Excalidraw - use proper BinaryFileData format
          const imageFile = {
            id: fileId,
            dataURL: dataURL,
            mimeType: result.mimeType as 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp',
            created: Date.now(),
            lastRetrieved: Date.now(),
          };

          excalidrawAPIRef.current.addFiles([imageFile as any]);

          // Create an image element with all required Excalidraw properties
          const now = Date.now();
          const imageElement = {
            id: `img-${now}`,
            type: 'image' as const,
            x: 50,
            y: 50,
            width: 400,
            height: 400,
            angle: 0,
            strokeColor: '#000000',
            backgroundColor: 'transparent',
            fillStyle: 'solid' as const,
            strokeWidth: 1,
            strokeStyle: 'solid' as const,
            roughness: 0,
            opacity: 100,
            groupIds: [] as string[],
            frameId: null,
            roundness: null,
            seed: Math.floor(Math.random() * 2147483647),
            version: 1,
            versionNonce: Math.floor(Math.random() * 2147483647),
            isDeleted: false,
            boundElements: null,
            updated: now,
            link: null,
            locked: false,
            fileId: fileId,
            status: 'saved' as const,
            scale: [1, 1] as [number, number],
          };

          console.log('[ExcalidrawCanvas] Image element:', imageElement);

          const existingElements = excalidrawAPIRef.current.getSceneElements();
          excalidrawAPIRef.current.updateScene({
            elements: [...existingElements, imageElement as any],
          });

          // Scroll to the new image after a delay
          setTimeout(() => {
            if (excalidrawAPIRef.current) {
              excalidrawAPIRef.current.scrollToContent(imageElement as any, {
                fitToContent: true,
                viewportZoomFactor: 0.8
              });
            }
          }, 200);

          console.log('[ExcalidrawCanvas] AI image inserted successfully');
          return true;
        } catch (error) {
          console.error('[ExcalidrawCanvas] Failed to generate/insert AI image:', error);
          return false;
        }
      },

      // Add base64 image directly to canvas (for PDF diagram extraction)
      addImageFromBase64: async (base64: string, mimeType: string, options?: { width?: number; height?: number; x?: number; y?: number }): Promise<boolean> => {
        if (!excalidrawAPIRef.current) return false;

        try {
          console.log('[ExcalidrawCanvas] Adding base64 image to canvas');

          // Create a file ID for the image
          const fileId = `pdf-image-${Date.now()}`;
          const dataURL = `data:${mimeType};base64,${base64}`;

          // Add the image as a file to Excalidraw
          const imageFile = {
            id: fileId,
            dataURL: dataURL,
            mimeType: mimeType as 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp',
            created: Date.now(),
            lastRetrieved: Date.now(),
          };

          excalidrawAPIRef.current.addFiles([imageFile as any]);

          // Create image element with specified or default position/size
          const now = Date.now();
          const imageElement = {
            id: `img-${now}`,
            type: 'image' as const,
            x: options?.x ?? 50,
            y: options?.y ?? 50,
            width: options?.width ?? 500,
            height: options?.height ?? 400,
            angle: 0,
            strokeColor: '#000000',
            backgroundColor: 'transparent',
            fillStyle: 'solid' as const,
            strokeWidth: 1,
            strokeStyle: 'solid' as const,
            roughness: 0,
            opacity: 100,
            groupIds: [] as string[],
            frameId: null,
            roundness: null,
            seed: Math.floor(Math.random() * 2147483647),
            version: 1,
            versionNonce: Math.floor(Math.random() * 2147483647),
            isDeleted: false,
            boundElements: null,
            updated: now,
            link: null,
            locked: false,
            fileId: fileId,
            status: 'saved' as const,
            scale: [1, 1] as [number, number],
          };

          const existingElements = excalidrawAPIRef.current.getSceneElements();
          excalidrawAPIRef.current.updateScene({
            elements: [...existingElements, imageElement as any],
          });

          // Scroll to the new image
          setTimeout(() => {
            if (excalidrawAPIRef.current) {
              excalidrawAPIRef.current.scrollToContent(imageElement as any, {
                fitToContent: true,
                viewportZoomFactor: 0.8
              });
            }
          }, 200);

          console.log('[ExcalidrawCanvas] Base64 image inserted successfully');
          return true;
        } catch (error) {
          console.error('[ExcalidrawCanvas] Failed to add base64 image:', error);
          return false;
        }
      },
    }));

    const handleExcalidrawAPIReady = useCallback((api: ExcalidrawAPI) => {
      excalidrawAPIRef.current = api;
      console.log('[ExcalidrawCanvas] Excalidraw API ready');
    }, []);

    const handleCanvasChange = useCallback((elements: any[], appState: any) => {
      onElementsChange?.(elements, appState);
    }, [onElementsChange]);

    // Shared Excalidraw component
    const ExcalidrawComponent = (
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
          onChange={handleCanvasChange}
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
    );

    // Embedded mode Excalidraw with minimal UI (no toolbar)
    const EmbeddedExcalidrawComponent = (
      <Suspense
        fallback={
          <div className="flex items-center justify-center h-full bg-white">
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-gray-500">Loading canvas...</span>
            </div>
          </div>
        }
      >
        <Excalidraw
          excalidrawAPI={handleExcalidrawAPIReady}
          onChange={handleCanvasChange}
          theme="light"
          initialData={{
            appState: {
              viewBackgroundColor: '#ffffff',
              currentItemFontFamily: 1,
              currentItemFontSize: 24,
              zenModeEnabled: true, // Hide most UI
              gridSize: undefined,
              activeTool: { type: 'freedraw', lastActiveTool: null, locked: false, customType: null },
            },
          }}
          UIOptions={{
            canvasActions: {
              loadScene: false,
              saveToActiveFile: false,
              export: false,
              clearCanvas: false,
              changeViewBackgroundColor: false,
            },
            tools: {
              image: false,
            },
          }}
        />
      </Suspense>
    );

    // Embedded mode: render just the canvas without modal wrapper
    if (embedded && isOpen) {
      return (
        <div className={`w-full h-full ${className}`}>
          {EmbeddedExcalidrawComponent}
        </div>
      );
    }

    // Modal mode: original behavior
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
              {ExcalidrawComponent}
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
