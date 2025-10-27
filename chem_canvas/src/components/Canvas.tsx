import { useRef, useEffect, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { ZoomIn, ZoomOut, Grid3x3, RotateCcw, CheckCircle, AlertCircle, Loader2, Trash2, Brain, Sparkles, Atom, Beaker, Moon, Sun, Lightbulb, FlaskConical, Gem, Scan, ExternalLink } from 'lucide-react';
import { analyzeCanvasWithLLM, getStoredAPIKey, type Correction, type CanvasAnalysisResult } from '../services/canvasAnalyzer';
import { convertCanvasToChemistry } from '../services/chemistryConverter';
import MineralSearch from './MineralSearch';
import ReagentSearch from './ReagentSearch';
import ProteinSearch from './ProteinSearch';
import { type MoleculeData, parseSDF, type ParsedSDF, getMolViewUrl, getMolViewUrlFromSmiles, getMoleculeByCID } from '../services/pubchemService';
import { type PDBProteinData, fetchPDBStructure } from '../services/pdbService';
import ChemistryToolbar from './ChemistryToolbar';
import ChemistryStructureViewer from './ChemistryStructureViewer';
import InlineMoleculeSearch from './InlineMoleculeSearch';
import PDBViewerEmbedded from './PDBViewerEmbedded';

const MIN_TOOLBAR_WIDTH = 280;
const MAX_TOOLBAR_WIDTH = 480;
const DEFAULT_MOLECULE_3D_ROTATION = { x: -25, y: 35 } as const;
const ATOM_COLORS: Record<string, string> = {
  C: '#e2e8f0',
  H: '#94a3b8',
  N: '#38bdf8',
  O: '#f87171',
  S: '#facc15',
  P: '#a855f7',
  Cl: '#34d399',
  Br: '#f472b6',
  F: '#22d3ee',
  I: '#a78bfa'
};

const DEFAULT_ANNOTATION_LABELS = [
  'Active center',
  'Leaving group',
  'Nucleophilic center',
  'Electrophilic center',
  'Transition state',
  'Intermediate',
  'Catalyst'
];

interface MoleculeAnnotation {
  id: string;
  atomIndex: number;
  label: string;
  color: string;
}

interface CanvasProps {
  currentTool: string;
  strokeWidth: number;
  strokeColor: string;
  onOpenCalculator?: () => void;
  onOpenMolView?: () => void;
  onOpenPeriodicTable?: () => void;
  onMoleculeInserted?: (moleculeData: any) => void;
}

export default function Canvas({
  currentTool,
  strokeWidth,
  strokeColor,
  onOpenCalculator,
  onOpenMolView,
  onOpenPeriodicTable,
  onMoleculeInserted
}: CanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [lastX, setLastX] = useState(0);
  const [lastY, setLastY] = useState(0);
  const [showGrid, setShowGrid] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [showCorrections, setShowCorrections] = useState(false);
  const [corrections, setCorrections] = useState<Correction[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<CanvasAnalysisResult | null>(null);
  const [showChemistryToolbar, setShowChemistryToolbar] = useState(true);
  const [isToolbarCollapsed, setIsToolbarCollapsed] = useState(false);
  const [toolbarWidth, setToolbarWidth] = useState(360);
  const [isResizingToolbar, setIsResizingToolbar] = useState(false);
  const toolbarResizeStateRef = useRef<{ startX: number; startWidth: number }>({ startX: 0, startWidth: 360 });
  const [chemistryTool, setChemistryTool] = useState('draw');
  const [chemistryColor, setChemistryColor] = useState('#3b82f6');
  const [chemistryStrokeColor, setChemistryStrokeColor] = useState('#3b82f6');
  const [chemistrySize, setChemistrySize] = useState(2);
  const [chemistryFillEnabled, setChemistryFillEnabled] = useState(true);
  const [chemistryFillColor, setChemistryFillColor] = useState('#3b82f6');
  const [showChemistryViewer, setShowChemistryViewer] = useState(false);
  const [chemistryStructure, setChemistryStructure] = useState<any>(null);
  const [isConverting, setIsConverting] = useState(false);
  const [canvasBackground, setCanvasBackground] = useState<'dark' | 'white'>('dark');
  const [showMineralSearch, setShowMineralSearch] = useState(false);
  const [showReagentSearch, setShowReagentSearch] = useState(false);
  const [showProteinSearch, setShowProteinSearch] = useState(false);
  const [forceRedraw, setForceRedraw] = useState(0); // New state for forcing redraw
  const [showChemistryWidgetPanel, setShowChemistryWidgetPanel] = useState(false);
  const [showPDBViewer, setShowPDBViewer] = useState(false);
  const [pdbViewerData, setPdbViewerData] = useState<{ pdbId: string; title?: string } | null>(null);
  const [annotationLabelOptions, setAnnotationLabelOptions] = useState<string[]>(() => [...DEFAULT_ANNOTATION_LABELS]);
  const [annotationLabel, setAnnotationLabel] = useState(DEFAULT_ANNOTATION_LABELS[0]);
  const [customAnnotationLabel, setCustomAnnotationLabel] = useState('');
  const [annotationColor, setAnnotationColor] = useState('#f97316');
  const [annotationMode, setAnnotationMode] = useState<{
    shapeId: string;
    label: string;
    color: string;
  } | null>(null);
  const [annotationHint, setAnnotationHint] = useState<string | null>(null);

  const addCustomAnnotationLabel = () => {
    const trimmed = customAnnotationLabel.trim();
    if (!trimmed) {
      return;
    }

    setAnnotationLabel(trimmed);
    setAnnotationLabelOptions(prev => {
      if (prev.some(option => option.toLowerCase() === trimmed.toLowerCase())) {
        return prev;
      }
      return [...prev, trimmed];
    });
    setCustomAnnotationLabel('');
  };

  // Arrow drawing state - single resizable arrow
  const [arrowState, setArrowState] = useState<{
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    isDrawing: boolean;
  } | null>(null);
  const imageDataRef = useRef<ImageData | null>(null);

  // Cache for rendered molecule images
  const moleculeImageCacheRef = useRef<Map<number, HTMLImageElement>>(new Map());

  // Cache for parsed SDF structures
  const sdfCacheRef = useRef<Map<string, ParsedSDF>>(new Map());

  // Cache for projected atom positions on canvas for annotation placement
  const moleculeProjectionRef = useRef<Map<string, Array<{ atomIndex: number; x: number; y: number }>>>(new Map());

  // Shape tracking for repositioning
  interface Shape {
    id: string;
    type: 'arrow' | 'circle' | 'square' | 'triangle' | 'hexagon' | 'plus' | 'minus' | 'molecule' | 'protein';
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    color: string;
    strokeColor?: string;
    fillColor?: string;
    fillEnabled?: boolean;
    size: number;
    rotation: number;  // Rotation in degrees (0-360)
    maintainAspect?: boolean;
    aspectRatio?: number;
    originalWidth?: number;
    originalHeight?: number;
    // Molecule-specific properties
    moleculeData?: MoleculeData & {
      displayName?: string;
    };
    // PDB Protein-specific properties
    proteinData?: PDBProteinData;
    use3D?: boolean;
    rotation3D?: {
      x: number;
      y: number;
    };
    annotations?: MoleculeAnnotation[];
  }

  const [shapes, setShapes] = useState<Shape[]>([]);
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);
  const selectedShape = selectedShapeId ? shapes.find(shape => shape.id === selectedShapeId) ?? null : null;
  const has3DStructure = Boolean(
    selectedShape &&
      selectedShape.type === 'molecule' &&
      selectedShape.moleculeData?.sdf3DData
  );
  const selectedMoleculeCid = (() => {
    if (!selectedShape || selectedShape.type !== 'molecule' || !selectedShape.moleculeData) {
      return null;
    }

    const { cid } = selectedShape.moleculeData;
    if (cid === undefined || cid === null) {
      return null;
    }

    const normalized = typeof cid === 'number' ? cid.toString() : `${cid}`.trim();
    return normalized.length ? normalized : null;
  })();
  const [isDraggingShape, setIsDraggingShape] = useState(false);
  const [isRotatingShape, setIsRotatingShape] = useState(false);
  const [isRotating3DShape, setIsRotating3DShape] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const canvasHistoryRef = useRef<Shape[]>([]);
  const rotate3DStateRef = useRef<{
    startClientX: number;
    startClientY: number;
    baseX: number;
    baseY: number;
  } | null>(null);

  // Resizing state - Canva-like
  const [isResizing, setIsResizing] = useState(false);
  const [resizeHandle, setResizeHandle] = useState<'tl' | 'tr' | 'bl' | 'br' | 't' | 'b' | 'l' | 'r' | null>(null);
  const [areaEraseSelection, setAreaEraseSelection] = useState<{
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
    isActive: boolean;
  } | null>(null);

  // Lasso selection state for free-hand eraser
  const [lassoSelection, setLassoSelection] = useState<{
    points: { x: number; y: number }[];
    isActive: boolean;
  }>({
    points: [],
    isActive: false
  });

  const FILLABLE_SHAPES = new Set(['circle', 'square', 'triangle', 'hexagon']);

  const handleChemistryStrokeColorChange = (color: string) => {
    setChemistryStrokeColor(color);
    setChemistryColor(color);
  };

  const updateShapeById = (id: string, updater: (shape: Shape) => Shape) => {
    let didUpdate = false;
    const updated = canvasHistoryRef.current.map(shape => {
      if (shape.id === id) {
        didUpdate = true;
        return updater(shape);
      }
      return shape;
    });

    if (didUpdate) {
      canvasHistoryRef.current = updated;
      setShapes(updated);
    }
  };

  const openSelectedMoleculeIn3D = () => {
    if (!selectedShape || selectedShape.type !== 'molecule' || !selectedShape.moleculeData) {
      return;
    }

    const { cid, smiles, displayName, name } = selectedShape.moleculeData;
    let viewerUrl: string | null = null;

    if (typeof cid === 'number' && !Number.isNaN(cid)) {
      viewerUrl = getMolViewUrl(cid, 'balls');
    } else if (smiles && smiles.trim().length > 0) {
      viewerUrl = getMolViewUrlFromSmiles(smiles, 'balls');
    }

    if (!viewerUrl) {
      console.warn('No MolView URL available for molecule', displayName ?? name ?? cid);
      return;
    }

    window.open(viewerUrl, '_blank', 'noopener,noreferrer');

    if (onOpenMolView) {
      onOpenMolView();
    }
  };

  const openArViewer = () => {
    if (typeof window === 'undefined' || !selectedMoleculeCid) {
      return;
    }

    const targetUrl = `${window.location.origin}/ar/${encodeURIComponent(selectedMoleculeCid)}`;
    window.open(targetUrl, '_blank', 'noopener,noreferrer');
  };

  const toggleSelectedMolecule3D = (enabled: boolean) => {
    if (!selectedShapeId || selectedShape?.type !== 'molecule') {
      return;
    }

    updateShapeById(selectedShapeId, shape => ({
      ...shape,
      use3D: enabled,
      rotation3D: enabled
        ? shape.rotation3D ?? { ...DEFAULT_MOLECULE_3D_ROTATION }
        : shape.rotation3D
    }));

    if (!enabled) {
      setAnnotationMode(prev => (prev && prev.shapeId === selectedShapeId ? null : prev));
      setAnnotationHint(null);
    }
  };

  const resetSelectedMolecule3DOrientation = () => {
    if (!selectedShapeId || selectedShape?.type !== 'molecule') {
      return;
    }

    updateShapeById(selectedShapeId, shape => ({
      ...shape,
      rotation3D: { ...DEFAULT_MOLECULE_3D_ROTATION }
    }));
  };

  const removeAnnotation = (shapeId: string, annotationId: string) => {
    updateShapeById(shapeId, shape => ({
      ...shape,
      annotations: (shape.annotations ?? []).filter(annotation => annotation.id !== annotationId)
    }));
  };

  // Intelligent color picker based on canvas background
  const getOptimalPenColor = () => {
    return canvasBackground === 'dark' ? '#0ea5e9' : '#000000';
  };

  // Update pen color when canvas background changes
  useEffect(() => {
    const optimalColor = getOptimalPenColor();
    setChemistryColor(optimalColor);
    setChemistryStrokeColor(optimalColor);
    setChemistryFillColor(optimalColor);
  }, [canvasBackground]);

  useEffect(() => {
    setAnnotationHint(null);
    setAnnotationMode(prev => (prev && prev.shapeId !== selectedShapeId ? null : prev));
  }, [selectedShapeId]);

  useEffect(() => {
    if (!isResizingToolbar) {
      return;
    }

    const handleMouseMove = (event: MouseEvent) => {
      const delta = event.clientX - toolbarResizeStateRef.current.startX;
      const proposedWidth = toolbarResizeStateRef.current.startWidth + delta;
      const clampedWidth = Math.min(Math.max(proposedWidth, MIN_TOOLBAR_WIDTH), MAX_TOOLBAR_WIDTH);
      setToolbarWidth(clampedWidth);
    };

    const handleMouseUp = () => {
      setIsResizingToolbar(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingToolbar]);

  useEffect(() => {
    if (!showChemistryToolbar) {
      setIsResizingToolbar(false);
    }
  }, [showChemistryToolbar]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    // Fill canvas with background color
    ctx.fillStyle = canvasBackground === 'dark' ? '#0f172a' : '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw grid if enabled
    if (showGrid) {
      drawGrid(ctx, canvas.width, canvas.height);
    }

    // Redraw all saved shapes
    redrawAllShapes(ctx);

    if (areaEraseSelection?.isActive) {
      drawAreaEraseOverlay(ctx, areaEraseSelection);
    }

    // Draw lasso selection if active
    if (lassoSelection.isActive && lassoSelection.points.length > 0) {
      drawLassoOverlay(ctx, lassoSelection.points);
    }
  }, [showGrid, canvasBackground, shapes, forceRedraw, areaEraseSelection, lassoSelection]);

  // Delete selected shape
  const deleteSelectedShape = () => {
    if (!selectedShape) return;

    const updatedShapes = canvasHistoryRef.current.filter(shape => shape.id !== selectedShape.id);
    setShapes(updatedShapes);
    canvasHistoryRef.current = updatedShapes;
    setSelectedShapeId(null);
    setSelectedShape(null);

    // Clean up molecule projection cache if it was a molecule
    if (selectedShape.type === 'molecule') {
      moleculeProjectionRef.current.delete(selectedShape.id);
    }

    console.log('🗑️ Shape deleted:', selectedShape.id);
  };

  // Handle keyboard events for deletion
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only handle delete/backspace if a shape is selected and we're not typing in an input
      if ((event.key === 'Delete' || event.key === 'Backspace') && selectedShape) {
        // Check if we're not in an input field or textarea
        const target = event.target as HTMLElement;
        if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA' && !target.isContentEditable) {
          event.preventDefault();
          deleteSelectedShape();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedShape]);

  const drawGrid = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    // Adjust grid color based on canvas background
    ctx.strokeStyle = canvasBackground === 'dark' ? '#1e293b' : '#e5e7eb';
    ctx.lineWidth = 0.5;
    
    const gridSize = 20;
    
    for (let x = 0; x <= width; x += gridSize) {
        ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    
    for (let y = 0; y <= height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
        ctx.stroke();
      }
  };

  const getShapeBounds = (shape: Shape) => {
    const minX = Math.min(shape.startX, shape.endX);
    const maxX = Math.max(shape.startX, shape.endX);
    const minY = Math.min(shape.startY, shape.endY);
    const maxY = Math.max(shape.startY, shape.endY);
    return { minX, minY, maxX, maxY };
  };

  const doesShapeIntersectRect = (
    shape: Shape,
    rect: { minX: number; minY: number; maxX: number; maxY: number }
  ) => {
    const bounds = getShapeBounds(shape);
    return !(
      bounds.maxX < rect.minX ||
      bounds.minX > rect.maxX ||
      bounds.maxY < rect.minY ||
      bounds.minY > rect.maxY
    );
  };

  const isPointWithinShape = (shape: Shape, x: number, y: number) => {
    const bounds = getShapeBounds(shape);
    return x >= bounds.minX && x <= bounds.maxX && y >= bounds.minY && y <= bounds.maxY;
  };

  // Ray casting algorithm to check if a point is inside a polygon (lasso)
  const isPointInPolygon = (point: { x: number; y: number }, polygon: { x: number; y: number }[]) => {
    if (polygon.length < 3) return false;

    let inside = false;
    let p1x = polygon[0].x;
    let p1y = polygon[0].y;

    for (let i = 1; i <= polygon.length; i++) {
      const p2x = polygon[i % polygon.length].x;
      const p2y = polygon[i % polygon.length].y;

      if (point.y > Math.min(p1y, p2y)) {
        if (point.y <= Math.max(p1y, p2y)) {
          if (point.x <= Math.max(p1x, p2x)) {
            if (p1y !== p2y) {
              const xinters = (point.y - p1y) * (p2x - p1x) / (p2y - p1y) + p1x;
              if (p1x === p2x || point.x <= xinters) {
                inside = !inside;
              }
            }
          }
        }
      }
      p1x = p2x;
      p1y = p2y;
    }

    return inside;
  };

  const isPointInRect = (
    point: { x: number; y: number },
    rect: { minX: number; minY: number; maxX: number; maxY: number }
  ) => {
    return (
      point.x >= rect.minX &&
      point.x <= rect.maxX &&
      point.y >= rect.minY &&
      point.y <= rect.maxY
    );
  };

  const orientation = (
    p: { x: number; y: number },
    q: { x: number; y: number },
    r: { x: number; y: number }
  ) => {
    const val = (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y);
    if (Math.abs(val) < 0.000001) return 0;
    return val > 0 ? 1 : 2; // 1: clockwise, 2: counterclockwise
  };

  const onSegment = (
    p: { x: number; y: number },
    q: { x: number; y: number },
    r: { x: number; y: number }
  ) => {
    return (
      q.x <= Math.max(p.x, r.x) &&
      q.x >= Math.min(p.x, r.x) &&
      q.y <= Math.max(p.y, r.y) &&
      q.y >= Math.min(p.y, r.y)
    );
  };

  const segmentsIntersect = (
    p1: { x: number; y: number },
    q1: { x: number; y: number },
    p2: { x: number; y: number },
    q2: { x: number; y: number }
  ) => {
    const o1 = orientation(p1, q1, p2);
    const o2 = orientation(p1, q1, q2);
    const o3 = orientation(p2, q2, p1);
    const o4 = orientation(p2, q2, q1);

    if (o1 !== o2 && o3 !== o4) {
      return true;
    }

    if (o1 === 0 && onSegment(p1, p2, q1)) return true;
    if (o2 === 0 && onSegment(p1, q2, q1)) return true;
    if (o3 === 0 && onSegment(p2, p1, q2)) return true;
    if (o4 === 0 && onSegment(p2, q1, q2)) return true;

    return false;
  };

  const doesPolygonIntersectRect = (
    polygon: { x: number; y: number }[],
    rect: { minX: number; minY: number; maxX: number; maxY: number }
  ) => {
    if (polygon.length < 3) return false;

    for (const point of polygon) {
      if (isPointInRect(point, rect)) {
        return true;
      }
    }

    const rectCorners = [
      { x: rect.minX, y: rect.minY },
      { x: rect.maxX, y: rect.minY },
      { x: rect.maxX, y: rect.maxY },
      { x: rect.minX, y: rect.maxY }
    ];

    for (const corner of rectCorners) {
      if (isPointInPolygon(corner, polygon)) {
        return true;
      }
    }

    const rectEdges: [
      { x: number; y: number },
      { x: number; y: number }
    ][] = [
      [rectCorners[0], rectCorners[1]],
      [rectCorners[1], rectCorners[2]],
      [rectCorners[2], rectCorners[3]],
      [rectCorners[3], rectCorners[0]]
    ];

    for (let i = 0; i < polygon.length; i++) {
      const p1 = polygon[i];
      const p2 = polygon[(i + 1) % polygon.length];

      for (const [r1, r2] of rectEdges) {
        if (segmentsIntersect(p1, p2, r1, r2)) {
          return true;
        }
      }
    }

    return false;
  };

  const getSvgAspectRatio = (svgContent?: string | null) => {
    if (!svgContent) return 1;

    const viewBoxMatch = svgContent.match(/viewBox="([^"]+)"/i);
    if (viewBoxMatch) {
      const parts = viewBoxMatch[1].trim().split(/\s+/).map(Number);
      if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
        return parts[2] / parts[3];
      }
    }

    const widthMatch = svgContent.match(/width="([\d.]+)(px)?"/i);
    const heightMatch = svgContent.match(/height="([\d.]+)(px)?"/i);
    if (widthMatch && heightMatch) {
      const width = parseFloat(widthMatch[1]);
      const height = parseFloat(heightMatch[1]);
      if (!Number.isNaN(width) && !Number.isNaN(height) && height > 0) {
        return width / height;
      }
    }

  return 1;
  };

  const ensureCompleteMoleculeData = async (data: MoleculeData): Promise<MoleculeData> => {
    const needsHydration = !data.svgData || !data.sdfData || !data.sdf3DData;
    if (!needsHydration) {
      return data;
    }

    try {
      const refreshed = await getMoleculeByCID(data.cid);
      if (!refreshed) {
        console.warn('?? Reagent hydration returned null for CID', data.cid);
        return data;
      }

      const hydrated = {
        ...refreshed,
        // Preserve any enhanced/sanitised fields from the original payload
        name: data.name || refreshed.name,
        svgData: data.svgData ?? refreshed.svgData,
        sdfData: data.sdfData ?? refreshed.sdfData,
        sdf3DData: data.sdf3DData ?? refreshed.sdf3DData,
        role: data.role ?? refreshed.role,
        sourceQuery: data.sourceQuery ?? refreshed.sourceQuery,
        displayName: data.displayName ?? refreshed.displayName,
      };

      console.log(
        '? Hydrated molecule',
        hydrated.cid,
        {
          hasSVG: Boolean(hydrated.svgData),
          hasSDF2D: Boolean(hydrated.sdfData),
          hasSDF3D: Boolean(hydrated.sdf3DData),
          role: hydrated.role,
        }
      );
      return hydrated;
    } catch (error) {
      console.warn('?? Failed to hydrate molecule assets from PubChem, using existing payload', error);
      return data;
    }
  };

  const insertMoleculeToCanvas = async (incomingData: MoleculeData) => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const moleculeData = await ensureCompleteMoleculeData(incomingData);

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    let aspectRatio = getSvgAspectRatio(moleculeData.svgData);
    if (!aspectRatio || !Number.isFinite(aspectRatio) || aspectRatio <= 0) {
      const parsed = moleculeData.sdfData ? parseSDF(moleculeData.sdfData) : null;
      if (parsed && parsed.atoms.length > 0) {
        const bounds = parsed.atoms.reduce(
          (acc, atom) => ({
            minX: Math.min(acc.minX, atom.x),
            maxX: Math.max(acc.maxX, atom.x),
            minY: Math.min(acc.minY, atom.y),
            maxY: Math.max(acc.maxY, atom.y),
          }),
          {
            minX: Number.POSITIVE_INFINITY,
            maxX: Number.NEGATIVE_INFINITY,
            minY: Number.POSITIVE_INFINITY,
            maxY: Number.NEGATIVE_INFINITY,
          }
        );
        const width = Math.max(1, bounds.maxX - bounds.minX);
        const height = Math.max(1, bounds.maxY - bounds.minY);
        aspectRatio = width / height || 1;
      }
    }

    if (!aspectRatio || !Number.isFinite(aspectRatio) || aspectRatio <= 0) {
      aspectRatio = 1;
    }

    const baseHeight = 180;
    const baseWidth = baseHeight * aspectRatio;
    const startX = centerX - baseWidth / 2;
    const startY = centerY - baseHeight / 2;
    const endX = centerX + baseWidth / 2;
    const endY = centerY + baseHeight / 2;

    const baseDisplayName =
      moleculeData.displayName ?? moleculeData.name ?? `CID ${moleculeData.cid}`;

    const displayName =
      moleculeData.role === 'reagent' &&
      baseDisplayName &&
      !baseDisplayName.toLowerCase().includes('reagent')
        ? `${baseDisplayName} (Reagent)`
        : baseDisplayName;

    const has3DSDF = Boolean(moleculeData.sdf3DData && moleculeData.sdf3DData.trim().length > 0);

    const newMolecule: Shape = {
      id: `molecule-${Date.now()}`,
      type: 'molecule',
      startX,
      startY,
      endX,
      endY,
      color: chemistryColor,
      strokeColor: chemistryStrokeColor,
      size: Math.max(baseWidth, baseHeight),
      rotation: 0,
      maintainAspect: true,
      aspectRatio,
      originalWidth: baseWidth,
      originalHeight: baseHeight,
      use3D: has3DSDF,
      rotation3D: { ...DEFAULT_MOLECULE_3D_ROTATION },
      moleculeData: {
        ...moleculeData,
        displayName,
      },
    };

    const updatedShapes = [...canvasHistoryRef.current, newMolecule];
    setShapes(updatedShapes);
    canvasHistoryRef.current = updatedShapes;
    setSelectedShapeId(newMolecule.id);
    setChemistryTool('move');

    if (onMoleculeInserted) {
      onMoleculeInserted(moleculeData);
    }

    console.log('? Molecule added to canvas:', newMolecule);
  };

  const insertProteinToCanvas = async (proteinData: PDBProteinData) => {
    const canvas = canvasRef.current;
    if (!canvas) {
      console.error('Canvas not available for protein insertion');
      return;
    }

    // Validate protein data
    if (!proteinData || !proteinData.entryId) {
      console.error('Invalid protein data provided:', proteinData);
      return;
    }

    // Fetch the PDB structure data
    try {
      const pdbStructure = await fetchPDBStructure(proteinData.entryId, 'pdb');
      if (!pdbStructure) {
        throw new Error('Failed to fetch PDB structure');
      }

      proteinData.pdbData = pdbStructure;
    } catch (error) {
      console.warn('Failed to fetch PDB structure, proceeding without it:', error);
    }

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    // For PDB proteins, use a fixed aspect ratio and size
    const aspectRatio = 1.5; // Typical protein structure aspect ratio
    const baseHeight = 200;
    const baseWidth = baseHeight * aspectRatio;
    const startX = centerX - baseWidth / 2;
    const startY = centerY - baseHeight / 2;
    const endX = centerX + baseWidth / 2;
    const endY = centerY + baseHeight / 2;

    const newProtein: Shape = {
      id: `protein-${Date.now()}`,
      type: 'protein',
      startX,
      startY,
      endX,
      endY,
      color: '#f97316', // Orange color for proteins
      strokeColor: '#f97316',
      size: Math.max(baseWidth, baseHeight),
      rotation: 0,
      maintainAspect: true,
      aspectRatio,
      originalWidth: baseWidth,
      originalHeight: baseHeight,
      use3D: true, // PDB structures are always 3D
      rotation3D: { ...DEFAULT_MOLECULE_3D_ROTATION },
      proteinData,
    };

    const updatedShapes = [...canvasHistoryRef.current, newProtein];
    setShapes(updatedShapes);
    canvasHistoryRef.current = updatedShapes;
    setSelectedShapeId(newProtein.id);
    setChemistryTool('move');

    console.log('🧬 PDB Protein added to canvas:', newProtein);
  };

  const drawAreaEraseOverlay = (
    ctx: CanvasRenderingContext2D,
    selection: { startX: number; startY: number; currentX: number; currentY: number }
  ) => {
    const minX = Math.min(selection.startX, selection.currentX);
    const minY = Math.min(selection.startY, selection.currentY);
    const width = Math.abs(selection.currentX - selection.startX);
    const height = Math.abs(selection.currentY - selection.startY);

    ctx.save();
    ctx.strokeStyle = '#f87171';
    ctx.fillStyle = 'rgba(248, 113, 113, 0.15)';
    ctx.setLineDash([6, 6]);
    ctx.lineWidth = 1.5;
    ctx.strokeRect(minX, minY, width, height);
    ctx.fillRect(minX, minY, width, height);
    ctx.restore();
  };

  // Draw lasso selection path
  const drawLassoOverlay = (ctx: CanvasRenderingContext2D, points: { x: number; y: number }[]) => {
    if (points.length < 2) return;

    ctx.save();
    
    // Draw lasso path line
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 4]);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.stroke();

    // Draw semi-transparent fill inside lasso
    if (points.length >= 3) {
      ctx.fillStyle = 'rgba(251, 191, 36, 0.1)';
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
      }
      ctx.closePath();
      ctx.fill();
    }

    // Draw start point indicator
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.arc(points[0].x, points[0].y, 4, 0, 2 * Math.PI);
    ctx.fill();

    ctx.restore();
  };

  // Helper function to detect which resize handle is being clicked
  const detectResizeHandle = (
    x: number,
    y: number,
    shape: Shape
  ): 'tl' | 'tr' | 'bl' | 'br' | 't' | 'b' | 'l' | 'r' | null => {
    const handleSize = 12;
    const { minX, minY, maxX, maxY } = getShapeBounds(shape);

    // Define handle positions using normalized bounds
    const handles = {
      tl: { x: minX, y: minY },
      tr: { x: maxX, y: minY },
      bl: { x: minX, y: maxY },
      br: { x: maxX, y: maxY },
      t: { x: (minX + maxX) / 2, y: minY },
      b: { x: (minX + maxX) / 2, y: maxY },
      l: { x: minX, y: (minY + maxY) / 2 },
      r: { x: maxX, y: (minY + maxY) / 2 }
    };

    // Check which handle is closest to the click
    for (const [handleName, handlePos] of Object.entries(handles)) {
      const dist = Math.sqrt(
        Math.pow(x - handlePos.x, 2) + Math.pow(y - handlePos.y, 2)
      );
      if (dist < handleSize) {
        return handleName as 'tl' | 'tr' | 'bl' | 'br' | 't' | 'b' | 'l' | 'r';
      }
    }
    return null;
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / zoom;
    const y = (e.clientY - rect.top) / zoom;

    // Check if clicking on empty canvas space (not on shapes) for deselection
    let clickedOnShape = false;
    for (let i = canvasHistoryRef.current.length - 1; i >= 0; i--) {
      const shape = canvasHistoryRef.current[i];
      const bounds = getShapeBounds(shape);
      if (x >= bounds.minX && x <= bounds.maxX && y >= bounds.minY && y <= bounds.maxY) {
        clickedOnShape = true;
        break;
      }
    }

    // If not clicking on a shape, deselect current selection
    if (!clickedOnShape) {
      setSelectedShapeId(null);
      setSelectedShape(null);
      // Don't return here - allow other logic to run if needed
    }

    if (annotationMode && annotationMode.shapeId === selectedShapeId && e.button === 0) {
      e.preventDefault();
      const projections = moleculeProjectionRef.current.get(annotationMode.shapeId) || [];
      if (projections.length === 0) {
        setAnnotationHint('No molecular coordinates available yet. Try again after the structure renders.');
        setAnnotationMode(null);
        return;
      }

      let nearest = { index: -1, distance: Number.POSITIVE_INFINITY };
      projections.forEach(point => {
        const dist = Math.hypot(point.x - x, point.y - y);
        if (dist < nearest.distance) {
          nearest = { index: point.atomIndex, distance: dist };
        }
      });

      const MAX_DISTANCE = 48;
      if (nearest.index === -1 || nearest.distance > MAX_DISTANCE) {
        setAnnotationHint('Click closer to the atom you want to annotate.');
        return;
      }

      updateShapeById(annotationMode.shapeId, shape => ({
        ...shape,
        annotations: [
          ...(shape.annotations ?? []),
          {
            id: `annotation-${Date.now()}`,
            atomIndex: nearest.index,
            label: annotationMode.label.trim() || 'Annotation',
            color: annotationMode.color,
          }
        ]
      }));

      setAnnotationHint('Annotation added.');
      setAnnotationMode(null);
      setIsDrawing(false);
      return;
    }

    const activeTool = showChemistryToolbar ? chemistryTool : currentTool;

    // Lasso selection for eraser (free-hand lasso mode with Ctrl key)
    if (activeTool === 'eraser' && e.ctrlKey) {
      console.log('Lasso selection started at:', { x, y });
      setLassoSelection({
        points: [{ x, y }],
        isActive: true
      });
      setIsDrawing(false);
      return;
    }

    if (activeTool === 'eraser' && e.shiftKey) {
      setAreaEraseSelection({
        startX: x,
        startY: y,
        currentX: x,
        currentY: y,
        isActive: true
      });
      setIsDrawing(false);
      return;
    }

    // Handle Rotate tool - supports 3D orbit (left drag) and 2D rotation (right drag)
    if (activeTool === 'rotate') {
      for (let i = canvasHistoryRef.current.length - 1; i >= 0; i--) {
        const shape = canvasHistoryRef.current[i];
        const dx = shape.endX - shape.startX;
        const dy = shape.endY - shape.startY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const centerX = shape.startX + dx / 2;
        const centerY = shape.startY + dy / 2;
        const tolerance = Math.max(distance / 2 + 10, 20);
        const distToShape = Math.hypot(x - centerX, y - centerY);

        if (distToShape < tolerance) {
          setSelectedShapeId(shape.id);

          const has3DData =
            shape.type === 'molecule' &&
            shape.moleculeData?.sdf3DData &&
            shape.use3D;

          if (has3DData && e.button === 0 && !e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            setIsRotating3DShape(true);
            rotate3DStateRef.current = {
              startClientX: e.clientX,
              startClientY: e.clientY,
              baseX: shape.rotation3D?.x ?? -25,
              baseY: shape.rotation3D?.y ?? 35
            };
            return;
          }

          if (e.button === 2 || e.ctrlKey) {
            e.preventDefault();
            setIsRotatingShape(true);
            setDragOffset({ x: x - centerX, y: y - centerY });
            return;
          }

          break;
        }
      }

      // If rotate tool was used without qualifying click, do nothing further
      return;
    }

    // Handle Move/Select tool - move and resize existing shapes
    if (activeTool === 'move') {
      for (let i = canvasHistoryRef.current.length - 1; i >= 0; i--) {
        const shape = canvasHistoryRef.current[i];
        const bounds = getShapeBounds(shape);
        const centerX = bounds.minX + (bounds.maxX - bounds.minX) / 2;
        const centerY = bounds.minY + (bounds.maxY - bounds.minY) / 2;
        const isWithinBounds =
          x >= bounds.minX &&
          x <= bounds.maxX &&
          y >= bounds.minY &&
          y <= bounds.maxY;

        // If shape already selected, check for resize handle interaction first
        if (selectedShapeId === shape.id) {
          const handle = detectResizeHandle(x, y, shape);
          if (handle) {
            setResizeHandle(handle);
            setIsResizing(true);
            return;
          }
        }

        if (isWithinBounds) {
          setSelectedShapeId(shape.id);
          setIsDraggingShape(true);
          setDragOffset({ x: x - centerX, y: y - centerY });
          return;
        }
      }

      setSelectedShapeId(null);
      return;
    }

    // Special handling for shape tools - create resizable single shape
    const shapeTools = ['arrow', 'circle', 'square', 'triangle', 'hexagon', 'plus', 'minus'];
    if (shapeTools.includes(activeTool)) {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      // Save current canvas state for redrawing
      imageDataRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height);
      
      setArrowState({
        startX: x,
        startY: y,
        endX: x,
        endY: y,
        isDrawing: true
      });
      return;
    }

    // Normal drawing for other tools
    setIsDrawing(true);
    setLastX(x);
    setLastY(y);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / zoom;
    const y = (e.clientY - rect.top) / zoom;

    if (annotationMode && annotationMode.shapeId === selectedShapeId) {
      return;
    }

    if (isRotating3DShape && selectedShapeId && rotate3DStateRef.current) {
      const start = rotate3DStateRef.current;
      const deltaX = e.clientX - start.startClientX;
      const deltaY = e.clientY - start.startClientY;
      const sensitivity = 0.45;

      const nextRotationX = start.baseX + deltaY * sensitivity;
      const nextRotationY = start.baseY + deltaX * sensitivity;

      updateShapeById(selectedShapeId, shape => ({
        ...shape,
        rotation3D: {
          x: Math.max(-180, Math.min(180, nextRotationX)),
          y: ((nextRotationY % 360) + 360) % 360
        }
      }));

      return;
    }

    // Handle lasso selection for eraser
    if (lassoSelection.isActive) {
      console.log('Lasso point added:', { x, y }, 'Total points:', lassoSelection.points.length + 1);
      setLassoSelection(prev => ({
        ...prev,
        points: [...prev.points, { x, y }]
      }));
      return;
    }

    if (areaEraseSelection?.isActive) {
      setAreaEraseSelection(prev =>
        prev ? { ...prev, currentX: x, currentY: y } : prev
      );
      return;
    }

    const activeTool = showChemistryToolbar ? chemistryTool : currentTool;
    const activeStrokeColor = showChemistryToolbar ? chemistryStrokeColor : strokeColor;
  const activeFillColor = showChemistryToolbar ? chemistryFillColor : activeStrokeColor;
  const activeFillEnabled = showChemistryToolbar ? chemistryFillEnabled : true;
    const activeSize = showChemistryToolbar ? chemistrySize : strokeWidth;
    const fillConfig = {
      fillColor: activeFillColor,
      fillEnabled: activeFillEnabled && FILLABLE_SHAPES.has(activeTool),
    };

    // Handle moving existing shape
    if (isDraggingShape && selectedShapeId) {
      // Update shape position
      const updatedShapes = canvasHistoryRef.current.map(shape => {
        if (shape.id === selectedShapeId) {
          const newCenterX = x - dragOffset.x;
          const newCenterY = y - dragOffset.y;
          const dx = shape.endX - shape.startX;
          const dy = shape.endY - shape.startY;
          
          return {
            ...shape,
            startX: newCenterX - dx / 2,
            startY: newCenterY - dy / 2,
            endX: newCenterX + dx / 2,
            endY: newCenterY + dy / 2
          };
        }
        return shape;
      });
      
      setShapes(updatedShapes);
      canvasHistoryRef.current = updatedShapes;
      return;
    }

    // Handle rotating existing shape
    if (isRotatingShape && selectedShapeId) {
      // Calculate rotation angle from center
      const shape = canvasHistoryRef.current.find(s => s.id === selectedShapeId);
      if (shape) {
        const dx = shape.endX - shape.startX;
        const dy = shape.endY - shape.startY;
        const centerX = shape.startX + dx / 2;
        const centerY = shape.startY + dy / 2;

        // Calculate angle from center to current mouse position
        const angle = Math.atan2(y - centerY, x - centerX) * (180 / Math.PI);
        
        // Update shape rotation
        const updatedShapes = canvasHistoryRef.current.map(s => {
          if (s.id === selectedShapeId) {
            return {
              ...s,
              rotation: (angle + 90) % 360  // Adjust angle so 0 is up
            };
          }
          return s;
        });
        
        setShapes(updatedShapes);
        canvasHistoryRef.current = updatedShapes;
      }
      return;
    }

    // Handle resizing existing shape
    if (isResizing && selectedShapeId && resizeHandle) {
      const shapeIndex = canvasHistoryRef.current.findIndex(s => s.id === selectedShapeId);
      if (shapeIndex >= 0) {
        const shape = canvasHistoryRef.current[shapeIndex];
        const bounds = getShapeBounds(shape);
        let newMinX = bounds.minX;
        let newMaxX = bounds.maxX;
        let newMinY = bounds.minY;
        let newMaxY = bounds.maxY;
        const MIN_SIZE = 16;

        if (resizeHandle.includes('l')) {
          newMinX = Math.min(x, newMaxX - MIN_SIZE);
        }
        if (resizeHandle.includes('r')) {
          newMaxX = Math.max(x, newMinX + MIN_SIZE);
        }
        if (resizeHandle.includes('t')) {
          newMinY = Math.min(y, newMaxY - MIN_SIZE);
        }
        if (resizeHandle.includes('b')) {
          newMaxY = Math.max(y, newMinY + MIN_SIZE);
        }

        if (resizeHandle === 'l') {
          newMaxX = bounds.maxX;
        } else if (resizeHandle === 'r') {
          newMinX = bounds.minX;
        }

        if (resizeHandle === 't') {
          newMaxY = bounds.maxY;
        } else if (resizeHandle === 'b') {
          newMinY = bounds.minY;
        }

        // Recompute width/height ensuring minimum size
        let finalMinX = Math.min(newMinX, newMaxX);
        let finalMaxX = Math.max(newMinX, newMaxX);
        let finalMinY = Math.min(newMinY, newMaxY);
        let finalMaxY = Math.max(newMinY, newMaxY);
        let width = Math.max(MIN_SIZE, finalMaxX - finalMinX);
        let height = Math.max(MIN_SIZE, finalMaxY - finalMinY);

        if (shape.maintainAspect && shape.aspectRatio) {
          const aspect = shape.aspectRatio;
          const horizontalHandle = resizeHandle.includes('l') ? 'l' : resizeHandle.includes('r') ? 'r' : null;
          const verticalHandle = resizeHandle.includes('t') ? 't' : resizeHandle.includes('b') ? 'b' : null;

          if (resizeHandle === 't' || resizeHandle === 'b') {
            width = Math.max(MIN_SIZE, height * aspect);
          } else if (resizeHandle === 'l' || resizeHandle === 'r') {
            height = Math.max(MIN_SIZE, width / aspect);
          } else {
            const heightFromWidth = width / aspect;
            const widthFromHeight = height * aspect;
            if (heightFromWidth > height) {
              height = Math.max(MIN_SIZE, heightFromWidth);
            } else {
              width = Math.max(MIN_SIZE, widthFromHeight);
            }
          }

          if (!horizontalHandle) {
            const centerX = (finalMinX + finalMaxX) / 2;
            finalMinX = centerX - width / 2;
            finalMaxX = centerX + width / 2;
          } else if (horizontalHandle === 'l') {
            finalMaxX = Math.max(finalMaxX, finalMinX);
            finalMinX = finalMaxX - width;
          } else if (horizontalHandle === 'r') {
            finalMinX = Math.min(finalMinX, finalMaxX);
            finalMaxX = finalMinX + width;
          }

          if (!verticalHandle) {
            const centerY = (finalMinY + finalMaxY) / 2;
            finalMinY = centerY - height / 2;
            finalMaxY = centerY + height / 2;
          } else if (verticalHandle === 't') {
            finalMaxY = Math.max(finalMaxY, finalMinY);
            finalMinY = finalMaxY - height;
          } else if (verticalHandle === 'b') {
            finalMinY = Math.min(finalMinY, finalMaxY);
            finalMaxY = finalMinY + height;
          }
        }

        finalMinX = Math.min(finalMinX, finalMaxX);
        finalMaxX = Math.max(finalMinX, finalMaxX);
        finalMinY = Math.min(finalMinY, finalMaxY);
        finalMaxY = Math.max(finalMinY, finalMaxY);
        width = Math.max(MIN_SIZE, finalMaxX - finalMinX);
        height = Math.max(MIN_SIZE, finalMaxY - finalMinY);

        const updatedShape: Shape = {
          ...shape,
          startX: finalMinX,
          startY: finalMinY,
          endX: finalMaxX,
          endY: finalMaxY,
          size: Math.max(width, height)
        };

        const updatedShapes = [...canvasHistoryRef.current];
        updatedShapes[shapeIndex] = updatedShape;
        canvasHistoryRef.current = updatedShapes;
        setShapes(updatedShapes);
      }
      return;
    }

    // Handle shape preview while dragging (arrow, circle, square, triangle, hexagon, plus, minus)
    const shapeTools = ['arrow', 'circle', 'square', 'triangle', 'hexagon', 'plus', 'minus'];
    if (shapeTools.includes(activeTool) && arrowState && arrowState.isDrawing && imageDataRef.current) {
      // Restore previous canvas state
      ctx.putImageData(imageDataRef.current, 0, 0);
      
      // Redraw grid if needed
      if (showGrid) {
        drawGrid(ctx, canvas.width, canvas.height);
      }
      
      // Update shape end position
      setArrowState({
        ...arrowState,
        endX: x,
        endY: y
      });
      
      // Calculate size based on distance from start to end
      const dx = x - arrowState.startX;
      const dy = y - arrowState.startY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const centerX = arrowState.startX + dx / 2;
      const centerY = arrowState.startY + dy / 2;
      
      // Draw preview based on active tool
      if (activeTool === 'arrow') {
        drawArrow(ctx, arrowState.startX, arrowState.startY, x, y, activeSize, activeStrokeColor);
      } else if (activeTool === 'circle') {
        drawCircle(ctx, centerX, centerY, distance / 2, activeStrokeColor, fillConfig);
      } else if (activeTool === 'square') {
        drawSquare(ctx, centerX, centerY, distance, activeStrokeColor, fillConfig);
      } else if (activeTool === 'triangle') {
        drawTriangle(ctx, centerX, centerY, distance, activeStrokeColor, fillConfig);
      } else if (activeTool === 'hexagon') {
        drawHexagon(ctx, centerX, centerY, distance / 2, activeStrokeColor, fillConfig);
      } else if (activeTool === 'plus') {
        drawPlus(ctx, centerX, centerY, distance / 2, activeSize, activeStrokeColor);
      } else if (activeTool === 'minus') {
        drawMinus(ctx, centerX, centerY, distance / 2, activeSize, activeStrokeColor);
      }
      return;
    }

    // Normal drawing for other tools
    if (!isDrawing) return;

    // Use chemistry tool settings if chemistry toolbar is active
    const activeColorNormal = activeStrokeColor;
    const activeSizeNormal = showChemistryToolbar ? chemistrySize : strokeWidth;
    const activeToolNormal = showChemistryToolbar ? chemistryTool : currentTool;
    const fillConfigNormal = {
      fillColor: activeFillColor,
      fillEnabled: activeFillEnabled && FILLABLE_SHAPES.has(activeToolNormal),
    };

    if (activeToolNormal === 'pen' || activeToolNormal === 'draw') {
      ctx.strokeStyle = activeColorNormal;
      ctx.lineWidth = activeSizeNormal;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

      ctx.lineTo(x, y);
      ctx.stroke();
    } else if (activeToolNormal === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineWidth = activeSizeNormal * 2;
      ctx.lineCap = 'round';
      
      ctx.lineTo(x, y);
      ctx.stroke();
      
      ctx.globalCompositeOperation = 'source-over';
    } else if (activeToolNormal === 'atom') {
      drawAtom(ctx, x, y, activeSizeNormal, activeColorNormal);
    } else if (activeToolNormal === 'bond') {
      drawBond(ctx, lastX, lastY, x, y, activeSizeNormal, activeColorNormal);
    } else if (activeToolNormal === 'electron') {
      drawElectron(ctx, x, y, activeSizeNormal, activeColorNormal);
    } else if (activeToolNormal === 'circle') {
      drawCircle(ctx, x, y, activeSizeNormal * 3, activeColorNormal, fillConfigNormal);
    } else if (activeToolNormal === 'square') {
      drawSquare(ctx, x, y, activeSizeNormal * 3, activeColorNormal, fillConfigNormal);
    } else if (activeToolNormal === 'triangle') {
      drawTriangle(ctx, x, y, activeSizeNormal * 3, activeColorNormal, fillConfigNormal);
    } else if (activeToolNormal === 'hexagon') {
      drawHexagon(ctx, x, y, activeSizeNormal * 3, activeColorNormal, fillConfigNormal);
    }

    setLastX(x);
    setLastY(y);
  };

  // Chemistry drawing functions
  interface ShapeDrawOptions {
    fillColor?: string;
    fillEnabled?: boolean;
    strokeWidth?: number;
  }

  const drawAtom = (ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, size * 2, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();
  };

  const drawBond = (ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, size: number, color: string) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = size;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  };

  const drawArrow = (ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, size: number, color: string) => {
    const headlen = Math.max(size * 8, 15); // Proportional arrowhead
    const angle = Math.atan2(y2 - y1, x2 - x1);
    
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    // Draw arrow line
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    
    // Draw filled arrowhead (triangle)
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - headlen * Math.cos(angle - Math.PI / 6), y2 - headlen * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(x2 - headlen * Math.cos(angle + Math.PI / 6), y2 - headlen * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  };

  const drawElectron = (ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, size / 2, 0, 2 * Math.PI);
    ctx.fill();
  };

  const drawCircle = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    radius: number,
    color: string,
    options?: ShapeDrawOptions
  ) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = options?.strokeWidth ?? 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, 2 * Math.PI);
    if (options?.fillEnabled !== false) {
      ctx.fillStyle = options?.fillColor ?? color;
      ctx.fill();
    }
    ctx.stroke();
  };

  const drawSquare = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    color: string,
    options?: ShapeDrawOptions
  ) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = options?.strokeWidth ?? 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.rect(x - size/2, y - size/2, size, size);
    if (options?.fillEnabled !== false) {
      ctx.fillStyle = options?.fillColor ?? color;
      ctx.fill();
    }
    ctx.stroke();
  };

  const drawTriangle = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    color: string,
    options?: ShapeDrawOptions
  ) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = options?.strokeWidth ?? 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y - size/2);
    ctx.lineTo(x - size/2, y + size/2);
    ctx.lineTo(x + size/2, y + size/2);
    ctx.closePath();
    if (options?.fillEnabled !== false) {
      ctx.fillStyle = options?.fillColor ?? color;
      ctx.fill();
    }
    ctx.stroke();
  };

  const drawHexagon = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    color: string,
    options?: ShapeDrawOptions
  ) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = options?.strokeWidth ?? 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = (i * Math.PI) / 3;
      const px = x + size * Math.cos(angle);
      const py = y + size * Math.sin(angle);
      if (i === 0) {
        ctx.moveTo(px, py);
      } else {
        ctx.lineTo(px, py);
      }
    }
    ctx.closePath();
    if (options?.fillEnabled !== false) {
      ctx.fillStyle = options?.fillColor ?? color;
      ctx.fill();
    }
    ctx.stroke();
  };

  const drawPlus = (ctx: CanvasRenderingContext2D, x: number, y: number, size: number, strokeWidth: number, color: string) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = strokeWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Vertical line
    ctx.beginPath();
    ctx.moveTo(x, y - size);
    ctx.lineTo(x, y + size);
    ctx.stroke();

    // Horizontal line
    ctx.beginPath();
    ctx.moveTo(x - size, y);
    ctx.lineTo(x + size, y);
    ctx.stroke();
  };

  const drawMinus = (ctx: CanvasRenderingContext2D, x: number, y: number, size: number, strokeWidth: number, color: string) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = strokeWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Horizontal line
    ctx.beginPath();
    ctx.moveTo(x - size, y);
    ctx.lineTo(x + size, y);
    ctx.stroke();
  };

  const drawMolecule = (ctx: CanvasRenderingContext2D, shape: Shape) => {
    const data = shape.moleculeData;
    if (!data) {
      console.warn('Molecule data not available for shape:', shape);
      return;
    }

    const width = Math.abs(shape.endX - shape.startX);
    const height = Math.abs(shape.endY - shape.startY);
    const centerX = shape.startX + width / 2;
    const centerY = shape.startY + height / 2;
    const rotation = (shape.rotation ?? 0) * (Math.PI / 180);
    const is3DMode = Boolean(shape.use3D && data.sdf3DData);
    const cosRotation = Math.cos(rotation);
    const sinRotation = Math.sin(rotation);

    const storeProjection = (projected: Array<{ atomIndex: number; x: number; y: number }>) => {
      if (!projected.length) {
        moleculeProjectionRef.current.delete(shape.id);
        return;
      }

      const globalPoints = projected.map(point => ({
        atomIndex: point.atomIndex,
        x: centerX + point.x * cosRotation - point.y * sinRotation,
        y: centerY + point.x * sinRotation + point.y * cosRotation
      }));

      moleculeProjectionRef.current.set(shape.id, globalPoints);
    };

    const renderAnnotationsOverlay = () => {
      const annotations = shape.annotations ?? [];
      if (!annotations.length) return;

      const projection = moleculeProjectionRef.current.get(shape.id);
      if (!projection || projection.length === 0) return;

      ctx.save();
      annotations.forEach(annotation => {
        const target = projection.find(point => point.atomIndex === annotation.atomIndex);
        if (!target) return;

        const markerRadius = 7;
        const labelPadding = 6;
        const labelHeight = 18;
        const labelOffsetX = 14;
        const labelOffsetY = -22;
        const labelText = annotation.label || 'Annotation';

        ctx.fillStyle = annotation.color;
        ctx.beginPath();
        ctx.arc(target.x, target.y, markerRadius, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 2;
        ctx.stroke();

        const labelX = target.x + labelOffsetX;
        const labelY = target.y + labelOffsetY;
        ctx.font = '12px "Inter", sans-serif';
        const metrics = ctx.measureText(labelText);
        const labelWidth = metrics.width + labelPadding * 2;

        ctx.beginPath();
        ctx.moveTo(target.x + markerRadius, target.y);
        ctx.lineTo(labelX, labelY + labelHeight / 2);
        ctx.strokeStyle = annotation.color;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
        ctx.fillRect(labelX, labelY, labelWidth, labelHeight);
        ctx.strokeStyle = annotation.color;
        ctx.lineWidth = 1;
        ctx.strokeRect(labelX, labelY, labelWidth, labelHeight);

        ctx.fillStyle = '#e2e8f0';
        ctx.textBaseline = 'middle';
        ctx.fillText(labelText, labelX + labelPadding, labelY + labelHeight / 2);
      });
      ctx.restore();
    };

    const render2DStructure = (parsed: ParsedSDF) => {
      if (!parsed.atoms.length) return;

      const atomBounds = parsed.atoms.reduce(
        (acc, atom) => ({
          minX: Math.min(acc.minX, atom.x),
          maxX: Math.max(acc.maxX, atom.x),
          minY: Math.min(acc.minY, atom.y),
          maxY: Math.max(acc.maxY, atom.y)
        }),
        {
          minX: Number.POSITIVE_INFINITY,
          maxX: Number.NEGATIVE_INFINITY,
          minY: Number.POSITIVE_INFINITY,
          maxY: Number.NEGATIVE_INFINITY
        }
      );

      const structureWidth = Math.max(1, atomBounds.maxX - atomBounds.minX);
      const structureHeight = Math.max(1, atomBounds.maxY - atomBounds.minY);
      const padding = Math.min(width, height) * 0.1;
      const availableWidth = Math.max(10, width - padding * 2);
      const availableHeight = Math.max(10, height - padding * 2);
      const scale = Math.min(availableWidth / structureWidth, availableHeight / structureHeight);

      const centerAtomX = (atomBounds.minX + atomBounds.maxX) / 2;
      const centerAtomY = (atomBounds.minY + atomBounds.maxY) / 2;
      const bondStrokeWidth = Math.max(1.2, Math.min(width, height) * 0.02);
      const multipleBondOffset = bondStrokeWidth;
      const atomRadius = Math.max(3, Math.min(width, height) * 0.04);

      const project = (atom: { x: number; y: number }) => ({
        x: (atom.x - centerAtomX) * scale,
        y: (centerAtomY - atom.y) * scale
      });

      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(rotation);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      const projectedAtoms = parsed.atoms.map((atom, index) => ({
        atomIndex: index,
        ...project(atom)
      }));

      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = bondStrokeWidth;

      parsed.bonds.forEach(bond => {
        const atom1 = projectedAtoms[bond.from];
        const atom2 = projectedAtoms[bond.to];
        if (!atom1 || !atom2) return;

        const drawBondLine = (offsetX: number, offsetY: number) => {
          ctx.beginPath();
          ctx.moveTo(atom1.x + offsetX, atom1.y + offsetY);
          ctx.lineTo(atom2.x + offsetX, atom2.y + offsetY);
          ctx.stroke();
        };

        drawBondLine(0, 0);

        if (bond.type === 2 || bond.type === 3) {
          const dx = atom2.x - atom1.x;
          const dy = atom2.y - atom1.y;
          const len = Math.hypot(dx, dy) || 1;
          const offsetX = (-dy / len) * multipleBondOffset;
          const offsetY = (dx / len) * multipleBondOffset;

          drawBondLine(offsetX, offsetY);

          if (bond.type === 3) {
            drawBondLine(-offsetX, -offsetY);
          }
        }
      });

      projectedAtoms.forEach(atom => {
        const color = ATOM_COLORS[parsed.atoms[atom.atomIndex].element] || '#cbd5f5';

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(atom.x, atom.y, atomRadius, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 1;
        ctx.stroke();

        const elementSymbol = parsed.atoms[atom.atomIndex].element;
        if (elementSymbol !== 'H') {
          ctx.fillStyle = '#0f172a';
          ctx.font = `${Math.max(10, atomRadius * 1.8)}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(elementSymbol, atom.x, atom.y);
        }
      });

      ctx.restore();

      const projectionPayload = projectedAtoms.map(atom => ({
        atomIndex: atom.atomIndex,
        x: atom.x,
        y: atom.y
      }));
      storeProjection(projectionPayload);
      renderAnnotationsOverlay();
    };

    const render3DStructure = (parsed: ParsedSDF) => {
      if (!parsed.atoms.length) return;

      const bounds = parsed.atoms.reduce(
        (acc, atom) => ({
          minX: Math.min(acc.minX, atom.x),
          maxX: Math.max(acc.maxX, atom.x),
          minY: Math.min(acc.minY, atom.y),
          maxY: Math.max(acc.maxY, atom.y),
          minZ: Math.min(acc.minZ, atom.z),
          maxZ: Math.max(acc.maxZ, atom.z)
        }),
        {
          minX: Number.POSITIVE_INFINITY,
          maxX: Number.NEGATIVE_INFINITY,
          minY: Number.POSITIVE_INFINITY,
          maxY: Number.NEGATIVE_INFINITY,
          minZ: Number.POSITIVE_INFINITY,
          maxZ: Number.NEGATIVE_INFINITY
        }
      );

      const rotation3D = shape.rotation3D ?? { ...DEFAULT_MOLECULE_3D_ROTATION };
      const yaw = (rotation3D.y * Math.PI) / 180;
      const pitch = (rotation3D.x * Math.PI) / 180;
      const cosY = Math.cos(yaw);
      const sinY = Math.sin(yaw);
      const cosX = Math.cos(pitch);
      const sinX = Math.sin(pitch);

      const centerX3D = (bounds.minX + bounds.maxX) / 2;
      const centerY3D = (bounds.minY + bounds.maxY) / 2;
      const centerZ3D = (bounds.minZ + bounds.maxZ) / 2;

      const rotatedAtoms = parsed.atoms.map((atom, index) => {
        const x = atom.x - centerX3D;
        const y = atom.y - centerY3D;
        const z = atom.z - centerZ3D;

        const x1 = x * cosY + z * sinY;
        const z1 = -x * sinY + z * cosY;

        const y1 = y * cosX - z1 * sinX;
        const z2 = y * sinX + z1 * cosX;

        return {
          x: x1,
          y: y1,
          z: z2,
          element: atom.element,
          index
        };
      });

      const rotatedBounds = rotatedAtoms.reduce(
        (acc, atom) => ({
          minX: Math.min(acc.minX, atom.x),
          maxX: Math.max(acc.maxX, atom.x),
          minY: Math.min(acc.minY, atom.y),
          maxY: Math.max(acc.maxY, atom.y),
          minZ: Math.min(acc.minZ, atom.z),
          maxZ: Math.max(acc.maxZ, atom.z)
        }),
        {
          minX: Number.POSITIVE_INFINITY,
          maxX: Number.NEGATIVE_INFINITY,
          minY: Number.POSITIVE_INFINITY,
          maxY: Number.NEGATIVE_INFINITY,
          minZ: Number.POSITIVE_INFINITY,
          maxZ: Number.NEGATIVE_INFINITY
        }
      );

      const structureWidth = Math.max(1, rotatedBounds.maxX - rotatedBounds.minX);
      const structureHeight = Math.max(1, rotatedBounds.maxY - rotatedBounds.minY);
      const padding = Math.min(width, height) * 0.12;
      const availableWidth = Math.max(10, width - padding * 2);
      const availableHeight = Math.max(10, height - padding * 2);
      const scale = Math.min(availableWidth / structureWidth, availableHeight / structureHeight);

      const centerXRotated = (rotatedBounds.minX + rotatedBounds.maxX) / 2;
      const centerYRotated = (rotatedBounds.minY + rotatedBounds.maxY) / 2;

      const projectedAtoms = rotatedAtoms.map(atom => ({
        x: (atom.x - centerXRotated) * scale,
        y: (centerYRotated - atom.y) * scale,
        z: atom.z,
        element: atom.element,
        index: atom.index
      }));

      const minDepth = rotatedBounds.minZ;
      const maxDepth = rotatedBounds.maxZ;
      const depthRange = Math.max(0.0001, maxDepth - minDepth);

      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(rotation);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      const bondsSorted = parsed.bonds
        .map(bond => {
          const atom1 = projectedAtoms[bond.from];
          const atom2 = projectedAtoms[bond.to];
          const depth = ((atom1?.z ?? 0) + (atom2?.z ?? 0)) / 2;
          return { bond, depth };
        })
        .sort((a, b) => a.depth - b.depth);

      bondsSorted.forEach(({ bond }) => {
        const atom1 = projectedAtoms[bond.from];
        const atom2 = projectedAtoms[bond.to];
        if (!atom1 || !atom2) return;

        const avgDepth = (atom1.z + atom2.z) / 2;
        const depthFactor = 1 - (avgDepth - minDepth) / depthRange;
        const bondStrokeWidth = Math.max(1.2, Math.min(width, height) * 0.02) * (0.65 + depthFactor * 0.7);
        const opacity = 0.35 + depthFactor * 0.55;

        const dx = atom2.x - atom1.x;
        const dy = atom2.y - atom1.y;
        const len = Math.hypot(dx, dy) || 1;
        const offsetBase = bondStrokeWidth * 0.8;
        const offsetX = (-dy / len) * offsetBase;
        const offsetY = (dx / len) * offsetBase;

        const drawBondLine = (ox: number, oy: number) => {
          ctx.beginPath();
          ctx.strokeStyle = `rgba(148, 163, 184, ${opacity.toFixed(3)})`;
          ctx.lineWidth = bondStrokeWidth;
          ctx.moveTo(atom1.x + ox, atom1.y + oy);
          ctx.lineTo(atom2.x + ox, atom2.y + oy);
          ctx.stroke();
        };

        drawBondLine(0, 0);

        if (bond.type === 2 || bond.type === 3) {
          drawBondLine(offsetX, offsetY);
          if (bond.type === 3) {
            drawBondLine(-offsetX, -offsetY);
          }
        }
      });

      const atomsSorted = projectedAtoms.slice().sort((a, b) => a.z - b.z);
      atomsSorted.forEach(atom => {
        const depthFactor = 1 - (atom.z - minDepth) / depthRange;
        const radius = Math.max(3, Math.min(width, height) * 0.035) * (0.65 + depthFactor * 0.6);
        const color = ATOM_COLORS[atom.element] || '#cbd5f5';
        const shading = Math.min(0.3 + depthFactor * 0.7, 1);

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(atom.x, atom.y, radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = `rgba(15, 23, 42, ${0.55 + shading * 0.35})`;
        ctx.lineWidth = 1.2;
        ctx.stroke();

        if (atom.element !== 'H') {
          ctx.fillStyle = '#0f172a';
          ctx.font = `${Math.max(10, radius * 1.6)}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(atom.element, atom.x, atom.y);
        }
      });

      ctx.restore();

      const projectionPayload = projectedAtoms.map(atom => ({
        atomIndex: atom.index,
        x: atom.x,
        y: atom.y
      }));
      storeProjection(projectionPayload);
      renderAnnotationsOverlay();
    };

    const sdfSource = (is3DMode ? data.sdf3DData : data.sdfData)?.trim();
    if (sdfSource) {
      const cacheKey = `${data.cid ?? data.name}-${is3DMode ? '3d' : '2d'}`;
      let parsed = sdfCacheRef.current.get(cacheKey);

      if (!parsed) {
        try {
          parsed = parseSDF(sdfSource) ?? undefined;
          if (parsed) {
            sdfCacheRef.current.set(cacheKey, parsed);
          } else {
            console.warn('?? parseSDF returned null for molecule', data.cid, 'mode', is3DMode ? '3D' : '2D');
          }
        } catch (error) {
          console.warn('Error parsing SDF for molecule:', data.name, error);
        }
      }

      if (parsed) {
        if (is3DMode && parsed.atoms.some(atom => Math.abs(atom.z) > 0.0001)) {
          render3DStructure(parsed);
          return;
        }

        render2DStructure(parsed);
        return;
      }

      if (is3DMode && data.sdfData && data.sdfData.trim().length > 0) {
        console.warn('?? Falling back to 2D SDF rendering for molecule', data.cid);
        const cacheKey2D = `${data.cid ?? data.name}-2d`;
        let parsed2D = sdfCacheRef.current.get(cacheKey2D);
        if (!parsed2D) {
          try {
            parsed2D = parseSDF(data.sdfData) ?? undefined;
            if (parsed2D) {
              sdfCacheRef.current.set(cacheKey2D, parsed2D);
            }
          } catch (error) {
            console.warn('Error parsing fallback 2D SDF for molecule:', data.name, error);
          }
        }

        if (parsed2D) {
          render2DStructure(parsed2D);
          return;
        }
      }
    }

    moleculeProjectionRef.current.delete(shape.id);

    const cid = data.cid;
    const cache = moleculeImageCacheRef.current;

    if (cache.has(cid)) {
      const img = cache.get(cid);
      if (img && img.complete) {
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(rotation);
        ctx.drawImage(img, -width / 2, -height / 2, width, height);
        ctx.restore();
        return;
      }
    }

    if (data.svgData) {
      const svg = data.svgData;
      const blob = new Blob([svg], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);

      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        cache.set(cid, img);
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(rotation);
        ctx.drawImage(img, -width / 2, -height / 2, width, height);
        ctx.restore();
        setForceRedraw(prev => prev + 1);
      };
      img.onerror = () => {
        console.warn('Failed to load SVG for molecule:', data.displayName ?? data.name ?? 'Unknown');
        loadMoleculePNG(ctx, shape, centerX, centerY, width, height);
      };
      img.src = url;
    } else {
      loadMoleculePNG(ctx, shape, centerX, centerY, width, height);
    }
  };

  // Helper function to load molecule as PNG (fallback)
  const loadMoleculePNG = (
    ctx: CanvasRenderingContext2D,
    shape: Shape,
    centerX: number,
    centerY: number,
    width: number,
    height: number
  ) => {
    const cid = shape.moleculeData?.cid;
    if (!cid) return;

    const cache = moleculeImageCacheRef.current;
    
    // Check cache first
    if (cache.has(cid)) {
      const img = cache.get(cid);
      if (img && img.complete) {
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate((shape.rotation * Math.PI) / 180);
        ctx.drawImage(img, -width / 2, -height / 2, width, height);
        ctx.restore();
        return;
      }
    }

    // Load PNG from PubChem
    const pngUrl = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/CID/${cid}/PNG?image_size=400x400`;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      cache.set(cid, img);
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate((shape.rotation * Math.PI) / 180);
      ctx.drawImage(img, -width / 2, -height / 2, width, height);
      ctx.restore();
      
      // Trigger redraw to ensure canvas updates
      setForceRedraw(prev => prev + 1);
    };
    img.onerror = () => {
  console.warn('Failed to load molecule PNG:', shape.moleculeData?.displayName ?? shape.moleculeData?.name ?? 'Unknown');
      // Draw placeholder
      ctx.save();
      ctx.fillStyle = '#3b82f6';
      ctx.globalAlpha = 0.3;
      ctx.fillRect(shape.startX, shape.startY, width, height);
      ctx.fillStyle = '#ffffff';
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.globalAlpha = 1;
  ctx.fillText(shape.moleculeData?.molecularFormula || 'Molecule', centerX, centerY);
      ctx.restore();
    };
    img.src = pngUrl;
  };

  const drawProtein = (ctx: CanvasRenderingContext2D, shape: Shape) => {
    const data = shape.proteinData;
    if (!data) {
      console.warn('Protein data not available for shape:', shape);
      return;
    }

    const width = Math.abs(shape.endX - shape.startX);
    const height = Math.abs(shape.endY - shape.startY);
    const centerX = shape.startX + width / 2;
    const centerY = shape.startY + height / 2;

    // If we have PDB data, render a basic 3D representation
    if (data.pdbData) {
      try {
        const pdbAtoms = parsePDBAtoms(data.pdbData);
        if (pdbAtoms.length > 0) {
          renderPDBStructure(ctx, shape, pdbAtoms, centerX, centerY, width, height);
          return;
        }
      } catch (error) {
        console.warn('Failed to parse PDB data:', error);
      }
    }

    // Fallback: Draw placeholder
    ctx.save();
    ctx.fillStyle = '#dc2626'; // Red color for proteins
    ctx.globalAlpha = 0.3;
    ctx.fillRect(shape.startX, shape.startY, width, height);
    ctx.fillStyle = '#ffffff';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.globalAlpha = 1;
    ctx.fillText(data.title || 'Protein Structure', centerX, centerY);
    ctx.restore();
  };

  // PDB parsing and rendering utilities
  interface PDBAtom {
    serial: number;
    name: string;
    altLoc: string;
    resName: string;
    chainID: string;
    resSeq: number;
    iCode: string;
    x: number;
    y: number;
    z: number;
    occupancy: number;
    tempFactor: number;
    element: string;
    charge: string;
  }

  const parsePDBAtoms = (pdbData: string): PDBAtom[] => {
    if (!pdbData || typeof pdbData !== 'string') {
      console.warn('Invalid PDB data provided to parsePDBAtoms');
      return [];
    }

    const atoms: PDBAtom[] = [];
    const lines = pdbData.split('\n');

    for (const line of lines) {
      if (line.startsWith('ATOM') || line.startsWith('HETATM')) {
        try {
          const atom: PDBAtom = {
            serial: parseInt(line.substring(6, 11).trim()) || 0,
            name: line.substring(12, 16).trim(),
            altLoc: line.substring(16, 17).trim(),
            resName: line.substring(17, 20).trim(),
            chainID: line.substring(21, 22).trim(),
            resSeq: parseInt(line.substring(22, 26).trim()) || 0,
            iCode: line.substring(26, 27).trim(),
            x: parseFloat(line.substring(30, 38).trim()) || 0,
            y: parseFloat(line.substring(38, 46).trim()) || 0,
            z: parseFloat(line.substring(46, 54).trim()) || 0,
            occupancy: parseFloat(line.substring(54, 60).trim()) || 1.0,
            tempFactor: parseFloat(line.substring(60, 66).trim()) || 0.0,
            element: line.substring(76, 78).trim(),
            charge: line.substring(78, 80).trim(),
          };

          // Validate that we have valid coordinates
          if (isNaN(atom.x) || isNaN(atom.y) || isNaN(atom.z)) {
            continue; // Skip invalid atoms
          }

          atoms.push(atom);
        } catch (error) {
          console.warn('Failed to parse PDB atom line:', line, error);
        }
      }
    }

    return atoms;
  };

  const renderPDBStructure = (
    ctx: CanvasRenderingContext2D,
    shape: Shape,
    atoms: PDBAtom[],
    centerX: number,
    centerY: number,
    width: number,
    height: number
  ) => {
    if (atoms.length === 0) return;

    // Calculate bounds of the protein structure
    const bounds = atoms.reduce(
      (acc, atom) => ({
        minX: Math.min(acc.minX, atom.x),
        maxX: Math.max(acc.maxX, atom.x),
        minY: Math.min(acc.minY, atom.y),
        maxY: Math.max(acc.maxY, atom.y),
        minZ: Math.min(acc.minZ, atom.z),
        maxZ: Math.max(acc.maxZ, atom.z)
      }),
      {
        minX: Number.POSITIVE_INFINITY,
        maxX: Number.NEGATIVE_INFINITY,
        minY: Number.POSITIVE_INFINITY,
        maxY: Number.NEGATIVE_INFINITY,
        minZ: Number.POSITIVE_INFINITY,
        maxZ: Number.NEGATIVE_INFINITY
      }
    );

    const structureWidth = bounds.maxX - bounds.minX;
    const structureHeight = bounds.maxY - bounds.minY;
    const structureDepth = bounds.maxZ - bounds.minZ;

    // Safety check: ensure we have valid dimensions
    if (structureWidth <= 0 || structureHeight <= 0 || isNaN(structureWidth) || isNaN(structureHeight)) {
      console.warn('Invalid protein structure dimensions, falling back to placeholder');
      return;
    }

    // Calculate scale to fit within the shape bounds
    const padding = Math.min(width, height) * 0.1;
    const availableWidth = width - padding * 2;
    const availableHeight = height - padding * 2;
    const scaleX = availableWidth / structureWidth;
    const scaleY = availableHeight / structureHeight;
    const scale = Math.min(scaleX, scaleY, 2); // Limit max scale

    // Center the structure
    const centerAtomX = (bounds.minX + bounds.maxX) / 2;
    const centerAtomY = (bounds.minY + bounds.maxY) / 2;
    const centerAtomZ = (bounds.minZ + bounds.maxZ) / 2;

    // Apply 3D rotation if available
    const rotation3D = shape.rotation3D ?? { x: -25, y: 35 };
    const yaw = (rotation3D.y * Math.PI) / 180;
    const pitch = (rotation3D.x * Math.PI) / 180;

    ctx.save();
    ctx.translate(centerX, centerY);

    // Group atoms by residue for better visualization
    const residues: Record<string, PDBAtom[]> = {};
    atoms.forEach(atom => {
      const key = `${atom.chainID}-${atom.resSeq}`;
      if (!residues[key]) residues[key] = [];
      residues[key].push(atom);
    });

    // Render backbone atoms (CA, N, C) as connected structure
    const backboneAtoms = atoms.filter(atom =>
      atom.name === 'CA' || atom.name === 'N' || atom.name === 'C'
    );

    // Sort backbone atoms by residue sequence for proper connection
    backboneAtoms.sort((a, b) => {
      if (a.chainID !== b.chainID) return a.chainID.localeCompare(b.chainID);
      return a.resSeq - b.resSeq;
    });

    // Draw backbone connections
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = Math.max(1, scale * 0.5);
    ctx.beginPath();

    for (let i = 0; i < backboneAtoms.length - 1; i++) {
      const atom1 = backboneAtoms[i];
      const atom2 = backboneAtoms[i + 1];

      // Only connect atoms from the same chain and consecutive residues
      if (atom1.chainID === atom2.chainID && Math.abs(atom1.resSeq - atom2.resSeq) === 1) {
        // Apply 3D rotation and projection
        const x1 = (atom1.x - centerAtomX) * scale;
        const y1 = (atom1.y - centerAtomY) * scale;
        const z1 = (atom1.z - centerAtomZ) * scale;

        const x2 = (atom2.x - centerAtomX) * scale;
        const y2 = (atom2.y - centerAtomY) * scale;
        const z2 = (atom2.z - centerAtomZ) * scale;

        // Simple 3D to 2D projection (isometric-like)
        const projX1 = x1 * 0.866 - y1 * 0.866; // cos(30°) and sin(30°)
        const projY1 = x1 * 0.5 + y1 * 0.5 - z1 * 0.707; // cos(45°) for depth

        const projX2 = x2 * 0.866 - y2 * 0.866;
        const projY2 = x2 * 0.5 + y2 * 0.5 - z2 * 0.707;

        if (i === 0) {
          ctx.moveTo(projX1, projY1);
        }
        ctx.lineTo(projX2, projY2);
      }
    }
    ctx.stroke();

    // Draw atoms
    const atomRadius = Math.max(2, Math.min(width, height) * 0.008);

    // Draw CA atoms (alpha carbons) as larger spheres
    backboneAtoms.forEach(atom => {
      if (atom.name === 'CA') {
        const x = (atom.x - centerAtomX) * scale;
        const y = (atom.y - centerAtomY) * scale;
        const z = (atom.z - centerAtomZ) * scale;

        // Simple 3D projection
        const projX = x * 0.866 - y * 0.866;
        const projY = x * 0.5 + y * 0.5 - z * 0.707;

        // Color based on secondary structure (simplified)
        ctx.fillStyle = '#3b82f6'; // Blue for alpha carbons
        ctx.beginPath();
        ctx.arc(projX, projY, atomRadius * 1.5, 0, Math.PI * 2);
        ctx.fill();

        // Add subtle shadow/highlight for 3D effect
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.beginPath();
        ctx.arc(projX - atomRadius * 0.5, projY - atomRadius * 0.5, atomRadius * 0.8, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // Draw side chain atoms as smaller spheres
    const sideChainAtoms = atoms.filter(atom =>
      !['CA', 'N', 'C', 'O'].includes(atom.name) && atom.name !== 'H'
    );

    sideChainAtoms.forEach(atom => {
      const x = (atom.x - centerAtomX) * scale;
      const y = (atom.y - centerAtomY) * scale;
      const z = (atom.z - centerAtomZ) * scale;

      const projX = x * 0.866 - y * 0.866;
      const projY = x * 0.5 + y * 0.5 - z * 0.707;

      // Color based on element
      const color = ATOM_COLORS[atom.element] || '#cbd5f5';
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(projX, projY, atomRadius, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.restore();

    // Draw label
    ctx.fillStyle = '#dc2626';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(shape.proteinData?.title || 'Protein', centerX, shape.startY - 10);
  };

  const stopDrawing = () => {
    // Handle lasso selection for eraser
    if (lassoSelection.isActive && lassoSelection.points.length > 3) {
      console.log('Lasso selection complete with', lassoSelection.points.length, 'points');
      const updatedShapes = canvasHistoryRef.current.filter(shape => {
        const dx = shape.endX - shape.startX;
        const dy = shape.endY - shape.startY;
        const centerX = shape.startX + dx / 2;
        const centerY = shape.startY + dy / 2;
        const bounds = getShapeBounds(shape);

        const centerInside = isPointInPolygon({ x: centerX, y: centerY }, lassoSelection.points);
        const boundsIntersect = doesPolygonIntersectRect(lassoSelection.points, bounds);
        const shouldErase = centerInside || boundsIntersect;

        console.log(
          'Shape at',
          centerX,
          centerY,
          'removed by lasso:',
          shouldErase,
          { centerInside, boundsIntersect }
        );

        return !shouldErase;
      });

      console.log('Shapes before:', canvasHistoryRef.current.length, 'Shapes after:', updatedShapes.length);
      if (updatedShapes.length !== canvasHistoryRef.current.length) {
        setShapes(updatedShapes);
        canvasHistoryRef.current = updatedShapes;
        setSelectedShapeId(null);
      }

      setLassoSelection({ points: [], isActive: false });
      setIsDrawing(false);
      return;
    }

    if (areaEraseSelection?.isActive) {
      const { startX, startY, currentX, currentY } = areaEraseSelection;
      const minX = Math.min(startX, currentX);
      const maxX = Math.max(startX, currentX);
      const minY = Math.min(startY, currentY);
      const maxY = Math.max(startY, currentY);
      const width = maxX - minX;
      const height = maxY - minY;

      let updatedShapes = canvasHistoryRef.current;
      if (width < 5 && height < 5) {
        for (let i = canvasHistoryRef.current.length - 1; i >= 0; i--) {
          const shape = canvasHistoryRef.current[i];
          if (isPointWithinShape(shape, startX, startY)) {
            updatedShapes = canvasHistoryRef.current.filter((_, index) => index !== i);
            break;
          }
        }
      } else {
        const selectionRect = { minX, minY, maxX, maxY };
        updatedShapes = canvasHistoryRef.current.filter(
          (shape) => !doesShapeIntersectRect(shape, selectionRect)
        );
      }

      if (updatedShapes.length !== canvasHistoryRef.current.length) {
        setShapes(updatedShapes);
        canvasHistoryRef.current = updatedShapes;
        setSelectedShapeId(null);
      }

      setAreaEraseSelection(null);
      setIsDrawing(false);
      return;
    }

    // Stop rotating shape
    if (isRotating3DShape) {
      setIsRotating3DShape(false);
      rotate3DStateRef.current = null;
      return;
    }

    if (isRotatingShape) {
      setIsRotatingShape(false);
      return;
    }

    // Stop dragging shape
    if (isDraggingShape) {
      setIsDraggingShape(false);
      return;
    }

    // Stop resizing shape
    if (isResizing) {
      setIsResizing(false);
      setResizeHandle(null);
      // Keep selected for next operation
      return;
    }

    // Save shape if it was being drawn
    if (arrowState && arrowState.isDrawing) {
      const activeTool = showChemistryToolbar ? chemistryTool : currentTool;
      const activeStroke = showChemistryToolbar ? chemistryStrokeColor : strokeColor;
      const activeFill = showChemistryToolbar ? chemistryFillColor : activeStroke;
      const fillEnabled =
        showChemistryToolbar ? chemistryFillEnabled && FILLABLE_SHAPES.has(activeTool) : FILLABLE_SHAPES.has(activeTool);
      const activeSize = showChemistryToolbar ? chemistrySize : strokeWidth;

      // Create shape object
      const newShape: Shape = {
        id: Date.now().toString(),
        type: activeTool as any,
        startX: arrowState.startX,
        startY: arrowState.startY,
        endX: arrowState.endX,
        endY: arrowState.endY,
        color: activeStroke,
        strokeColor: activeStroke,
        fillColor: fillEnabled ? activeFill : undefined,
        fillEnabled,
        size: activeSize,
        rotation: 0 // Default rotation
      };

      // Add to shapes history
      const updatedShapes = [...shapes, newShape];
      setShapes(updatedShapes);
      canvasHistoryRef.current = updatedShapes;

      setArrowState({
        ...arrowState,
        isDrawing: false
      });
      imageDataRef.current = null;
      return;
    }
    
    setIsDrawing(false);
  };

  // Function to redraw all saved shapes
  const redrawAllShapes = (ctx: CanvasRenderingContext2D) => {
    for (const shape of canvasHistoryRef.current) {
      const dx = shape.endX - shape.startX;
      const dy = shape.endY - shape.startY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const centerX = shape.startX + dx / 2;
      const centerY = shape.startY + dy / 2;

      // Apply rotation if shape has rotation
      if (shape.rotation !== 0) {
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate((shape.rotation * Math.PI) / 180);
        ctx.translate(-centerX, -centerY);
      }

      const strokeColor = shape.strokeColor ?? shape.color;
      const shapeSupportsFill = FILLABLE_SHAPES.has(shape.type);
      const fillEnabled = shapeSupportsFill && shape.fillEnabled !== false;
      const fillOptions: ShapeDrawOptions = {
        fillColor: fillEnabled ? shape.fillColor ?? strokeColor : undefined,
        fillEnabled,
      };

      if (shape.type === 'arrow') {
        drawArrow(ctx, shape.startX, shape.startY, shape.endX, shape.endY, shape.size, strokeColor);
      } else if (shape.type === 'circle') {
        drawCircle(ctx, centerX, centerY, distance / 2, strokeColor, fillOptions);
      } else if (shape.type === 'square') {
        drawSquare(ctx, centerX, centerY, distance, strokeColor, fillOptions);
      } else if (shape.type === 'triangle') {
        drawTriangle(ctx, centerX, centerY, distance, strokeColor, fillOptions);
      } else if (shape.type === 'hexagon') {
        drawHexagon(ctx, centerX, centerY, distance / 2, strokeColor, fillOptions);
      } else if (shape.type === 'plus') {
        drawPlus(ctx, centerX, centerY, distance / 2, shape.size, strokeColor);
      } else if (shape.type === 'minus') {
        drawMinus(ctx, centerX, centerY, distance / 2, shape.size, strokeColor);
      } else if (shape.type === 'molecule') {
        drawMolecule(ctx, shape);
      } else if (shape.type === 'protein') {
        drawProtein(ctx, shape);
      }

      // Restore context if rotation was applied
      if (shape.rotation !== 0) {
        ctx.restore();
      }

      // Draw selection indicator if shape is selected
      if (selectedShapeId === shape.id) {
        // Draw selection box
        ctx.strokeStyle = '#0ea5e9';  // Cyan selection color
        ctx.lineWidth = 3;
        ctx.setLineDash([5, 5]);  // Dashed line
        ctx.globalAlpha = 0.8;
        
        const tolerance = Math.max(distance / 2 + 15, 25);
        ctx.beginPath();
        ctx.arc(centerX, centerY, tolerance, 0, 2 * Math.PI);
        ctx.stroke();
        
        ctx.setLineDash([]);  // Reset to solid
        
        // Draw resize handles (corners and edges)
        const handleSize = 12;
        const handlePositions = [
          // Corners
          { x: shape.startX, y: shape.startY },
          { x: shape.endX, y: shape.startY },
          { x: shape.endX, y: shape.endY },
          { x: shape.startX, y: shape.endY },
          // Edges
          { x: (shape.startX + shape.endX) / 2, y: shape.startY },
          { x: shape.endX, y: (shape.startY + shape.endY) / 2 },
          { x: (shape.startX + shape.endX) / 2, y: shape.endY },
          { x: shape.startX, y: (shape.startY + shape.endY) / 2 },
        ];
        
        // Draw each handle
        handlePositions.forEach((pos) => {
          ctx.fillStyle = '#0ea5e9';  // Cyan handles
          ctx.fillRect(
            pos.x - handleSize / 2,
            pos.y - handleSize / 2,
            handleSize,
            handleSize
          );
          
          // White border for contrast
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
          ctx.strokeRect(
            pos.x - handleSize / 2,
            pos.y - handleSize / 2,
            handleSize,
            handleSize
          );
        });
        
        ctx.globalAlpha = 1;
        
        // Draw label
        ctx.fillStyle = '#0ea5e9';
        ctx.font = '12px Arial';
        ctx.fillText('Drag corners to resize', shape.startX, shape.startY - 20);
      }
    }
  };

  // Touch event handlers
  const getTouchPos = (e: React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    return {
      x: (touch.clientX - rect.left) / zoom,
      y: (touch.clientY - rect.top) / zoom
    };
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const { x, y } = getTouchPos(e);

    setIsDrawing(true);
    setLastX(x);
    setLastY(y);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getTouchPos(e);

    // Use chemistry tool settings if chemistry toolbar is active
    const activeStrokeColor = showChemistryToolbar ? chemistryStrokeColor : strokeColor;
    const activeFillColor = showChemistryToolbar ? chemistryFillColor : activeStrokeColor;
    const activeFillEnabled = showChemistryToolbar ? chemistryFillEnabled : true;
    const activeSize = showChemistryToolbar ? chemistrySize : strokeWidth;
    const activeTool = showChemistryToolbar ? chemistryTool : currentTool;
    const fillConfig = {
      fillColor: activeFillColor,
      fillEnabled: activeFillEnabled && FILLABLE_SHAPES.has(activeTool),
    };

    if (activeTool === 'pen' || activeTool === 'draw') {
      ctx.strokeStyle = activeStrokeColor;
      ctx.lineWidth = activeSize;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      ctx.lineTo(x, y);
      ctx.stroke();
    } else if (activeTool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineWidth = activeSize * 2;
      ctx.lineCap = 'round';
      
      ctx.lineTo(x, y);
      ctx.stroke();
      
      ctx.globalCompositeOperation = 'source-over';
    } else if (activeTool === 'atom') {
      drawAtom(ctx, x, y, activeSize, activeStrokeColor);
    } else if (activeTool === 'bond') {
      drawBond(ctx, lastX, lastY, x, y, activeSize, activeStrokeColor);
    } else if (activeTool === 'arrow') {
      drawArrow(ctx, lastX, lastY, x, y, activeSize, activeStrokeColor);
    } else if (activeTool === 'electron') {
      drawElectron(ctx, x, y, activeSize, activeStrokeColor);
    } else if (activeTool === 'circle') {
      drawCircle(ctx, x, y, activeSize * 3, activeStrokeColor, fillConfig);
    } else if (activeTool === 'square') {
      drawSquare(ctx, x, y, activeSize * 3, activeStrokeColor, fillConfig);
    } else if (activeTool === 'triangle') {
      drawTriangle(ctx, x, y, activeSize * 3, activeStrokeColor, fillConfig);
    } else if (activeTool === 'hexagon') {
      drawHexagon(ctx, x, y, activeSize * 3, activeStrokeColor, fillConfig);
    }

    setLastX(x);
    setLastY(y);
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    // Ask for confirmation before clearing
    if (!window.confirm('Are you sure you want to clear the canvas? This will remove all drawings and analysis results.')) {
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    if (showGrid) {
      drawGrid(ctx, canvas.width, canvas.height);
    }

    // Clear any existing corrections and analysis results
    setCorrections([]);
    setShowCorrections(false);
    setAnalysisResult(null);
  };

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 0.1, 3));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 0.1, 0.5));
  };

  const handleResetZoom = () => {
    setZoom(1);
  };

  const analyzeCanvas = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const apiKey = getStoredAPIKey();
    if (!apiKey) {
      alert('Please add your Gemini API key in the settings to use the canvas analysis feature.');
      return;
    }

    setIsAnalyzing(true);
    
    try {
      // Convert canvas to base64 image
      const canvasData = canvas.toDataURL('image/png', 0.8);
      
      // Analyze with LLM
      const result = await analyzeCanvasWithLLM(canvasData, apiKey, 'chemistry');
      
      setAnalysisResult(result);
      setCorrections(result.corrections);
      setShowCorrections(true);
    } catch (error) {
      console.error('Analysis failed:', error);
      alert('Failed to analyze canvas content. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const clearCorrections = () => {
    setCorrections([]);
    setShowCorrections(false);
    setAnalysisResult(null);
  };

  const convertToChemistry = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const apiKey = getStoredAPIKey();
    if (!apiKey) {
      alert('Please add your Gemini API key in settings to use the chemistry conversion feature.');
      return;
    }

    setIsConverting(true);
    try {
      // Convert canvas to base64
      const canvasData = canvas.toDataURL('image/png', 0.8);
      
      // Convert to chemistry structure
      const result = await convertCanvasToChemistry(canvasData, apiKey);
      
      if (result.success && result.structure) {
        setChemistryStructure(result.structure);
        setShowChemistryViewer(true);
      } else {
        alert(result.error || 'Failed to convert to chemistry structure');
      }
    } catch (error) {
      console.error('Chemistry conversion failed:', error);
      alert('Failed to convert to chemistry structure. Please try again.');
    } finally {
      setIsConverting(false);
    }
  };

  const handleToolbarResizeStart = (event: ReactMouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    toolbarResizeStateRef.current = {
      startX: event.clientX,
      startWidth: toolbarWidth,
    };
    setIsResizingToolbar(true);
  };

  return (
    <div className="relative w-full h-full bg-slate-900">
      {/* Chemistry Toolbar Toggle Button */}
      <div className="absolute top-8 left-8 z-10">
        <button
          onClick={() => setShowChemistryToolbar(!showChemistryToolbar)}
          className={`p-2 bg-slate-800/90 backdrop-blur-sm border border-slate-700/50 rounded-xl shadow-lg transition-all ${
            showChemistryToolbar ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-700/50'
          }`}
          title={showChemistryToolbar ? "Hide Chemistry Tools" : "Show Chemistry Tools"}
        >
          <Atom size={18} />
        </button>
      </div>

      {/* Chemistry Toolbar */}
      {showChemistryToolbar && (
        <div className="absolute top-24 left-8 z-10">
          <ChemistryToolbar
            onToolSelect={setChemistryTool}
            currentTool={chemistryTool}
            onColorChange={setChemistryColor}
            onStrokeColorChange={handleChemistryStrokeColorChange}
            strokeColor={chemistryStrokeColor}
            fillEnabled={chemistryFillEnabled}
            onFillToggle={setChemistryFillEnabled}
            fillColor={chemistryFillColor}
            onFillColorChange={setChemistryFillColor}
            currentColor={chemistryColor}
            onSizeChange={setChemistrySize}
            currentSize={chemistrySize}
            onOpenCalculator={onOpenCalculator}
            onOpenMolView={onOpenMolView}
            onOpenPeriodicTable={onOpenPeriodicTable}
            onOpenMoleculeSearch={() => setShowMoleculeSearch(true)}
            onOpenMineralSearch={() => setShowMineralSearch(true)}
            onOpenReagentSearch={() => setShowReagentSearch(true)}
            onOpenArViewer={openArViewer}
            onOpenChemistryWidgets={() => setShowChemistryWidgetPanel(true)}
            isCollapsed={isToolbarCollapsed}
            onToggleCollapse={() => setIsToolbarCollapsed((prev) => !prev)}
            width={toolbarWidth}
            onResizeStart={handleToolbarResizeStart}
            selectedMoleculeCid={selectedMoleculeCid}
          />
        </div>
      )}

      {/* Help Instructions - Bottom Left */}
      <div className="absolute bottom-8 left-8 z-10 max-w-sm rounded-xl border border-slate-700/50 bg-slate-800/90 p-4 shadow-lg backdrop-blur-sm">
        <div className="mb-2">
          <p className="flex items-center gap-2 text-xs font-semibold text-slate-200">
            <Lightbulb className="h-4 w-4 text-amber-300" />
            Shape Controls
          </p>
        </div>
        <div className="space-y-2">
          <div>
            <p className="text-xs text-slate-400 font-semibold text-cyan-400">Move:</p>
            <ol className="text-xs text-slate-400 space-y-0.5 ml-2">
              <li>1. Select Move Tool</li>
              <li>2. Click shape</li>
              <li>3. Drag to position</li>
            </ol>
          </div>
          <div>
            <p className="text-xs text-slate-400 font-semibold text-cyan-400">Rotate:</p>
            <ol className="text-xs text-slate-400 space-y-0.5 ml-2">
              <li>1. Select Rotate Tool</li>
              <li>2. Right-click on shape</li>
              <li>3. Drag to rotate</li>
            </ol>
          </div>
        </div>
      </div>

      {/* Canvas Controls - Clean Header Layout */}
      <div className="absolute top-4 left-1/2 z-10 flex -translate-x-1/2 flex-row items-center gap-4 transform">

        {/* Search Controls Group */}
        <div className="flex items-center gap-2 bg-slate-800/90 backdrop-blur-sm border border-slate-700/50 rounded-xl p-2 shadow-lg">
          <button
            onClick={() => setShowMineralSearch(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-emerald-300 hover:bg-slate-700/50 rounded-lg transition-all"
            title="Search Minerals"
          >
            <Gem size={14} className="text-emerald-400" />
            <span>Minerals</span>
          </button>

          <button
            onClick={() => setShowReagentSearch(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-cyan-300 hover:bg-slate-700/50 rounded-lg transition-all"
            title="Search Reagents"
          >
            <FlaskConical size={14} className="text-cyan-400" />
            <span>Reagents</span>
          </button>

          <button
            onClick={() => setShowProteinSearch(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-rose-300 hover:bg-slate-700/50 rounded-lg transition-all"
            title="Search Proteins"
          >
            <Atom size={14} className="text-rose-400" />
            <span>Proteins</span>
          </button>

          <button
            onClick={openArViewer}
            disabled={!selectedMoleculeCid}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-purple-300 hover:bg-slate-700/50 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            title={selectedMoleculeCid ? 'View selected molecule in AR' : 'Select a molecule on the canvas to enable AR viewer'}
          >
            <Scan size={14} className="text-purple-400" />
            <span>AR</span>
          </button>
        </div>

        {/* Molecule Search */}
        <div className="bg-slate-800/90 backdrop-blur-sm border border-slate-700/50 rounded-xl shadow-lg">
          <InlineMoleculeSearch
            onSelectMolecule={(moleculeData) => {
              void (async () => {
                try {
                  await insertMoleculeToCanvas(moleculeData);
                } catch (error) {
                  console.error('Failed to insert molecule from search:', error);
                }
              })();
            }}
          />
        </div>

      </div>

        {/* Right-side Controls - Consolidated */}
        <div className="absolute right-8 top-1/2 z-10 flex -translate-y-1/2 flex-col items-end gap-3 transform">
          <div className="bg-slate-800/90 backdrop-blur-sm border border-slate-700/50 rounded-xl p-3 shadow-lg space-y-3">

          {/* Grid Toggle */}
          <button
            onClick={() => setShowGrid(!showGrid)}
            className={`w-full p-2 rounded-lg transition-all flex items-center justify-center ${
              showGrid
                ? 'bg-blue-600 text-white'
                : 'text-slate-400 hover:bg-slate-700/50'
            }`}
            title="Toggle Grid"
          >
            <Grid3x3 size={16} />
          </button>

          {/* Background Toggle */}
          <div className="flex flex-col gap-1">
            <button
              onClick={() => setCanvasBackground('dark')}
              className={`p-2 rounded-lg transition-all ${
                canvasBackground === 'dark'
                  ? 'bg-slate-600 text-white'
                  : 'text-slate-400 hover:bg-slate-700/50'
              }`}
              title="Dark Canvas"
            >
              <Moon size={14} />
            </button>
            <button
              onClick={() => setCanvasBackground('white')}
              className={`p-2 rounded-lg transition-all ${
                canvasBackground === 'white'
                  ? 'bg-slate-600 text-white'
                  : 'text-slate-400 hover:bg-slate-700/50'
              }`}
              title="Light Canvas"
            >
              <Sun size={14} />
            </button>
          </div>

          {/* Zoom Controls */}
          <div className="flex flex-col gap-1">
            <button
              onClick={handleZoomIn}
              className="p-2 text-slate-400 hover:bg-slate-700/50 rounded-lg transition-all"
              title="Zoom In"
            >
              <ZoomIn size={14} />
            </button>
            <button
              onClick={handleResetZoom}
              className="p-2 text-slate-400 hover:bg-slate-700/50 rounded-lg transition-all"
              title="Reset Zoom"
            >
              <RotateCcw size={12} />
            </button>
            <button
              onClick={handleZoomOut}
              className="p-2 text-slate-400 hover:bg-slate-700/50 rounded-lg transition-all"
              title="Zoom Out"
            >
              <ZoomOut size={14} />
            </button>
          </div>

          {/* Clear Canvas */}
          <button
            onClick={clearCanvas}
            className="w-full p-2 text-red-400 hover:bg-red-500/20 hover:text-red-300 rounded-lg transition-all"
            title="Clear Canvas"
          >
            <Trash2 size={14} />
          </button>

        </div>

        {/* Chemistry Controls */}
        <div className="bg-slate-800/90 backdrop-blur-sm border border-slate-700/50 rounded-xl p-2 shadow-lg space-y-2">

          {/* Chemistry Conversion Button */}
          <button
            onClick={convertToChemistry}
            disabled={isConverting}
            className={`w-full p-2 rounded-lg transition-all flex items-center justify-center gap-2 ${
              isConverting
                ? 'bg-primary/50 text-primary-foreground cursor-not-allowed'
                : 'bg-primary text-primary-foreground hover:bg-primary/90'
            }`}
            title={isConverting ? "Converting..." : "Convert to Chemistry Structure"}
          >
            {isConverting ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Beaker size={14} />
            )}
          </button>

          {/* Correction Button */}
          <button
            onClick={showCorrections ? clearCorrections : analyzeCanvas}
            disabled={isAnalyzing}
            className={`w-full p-2 rounded-lg transition-all flex items-center justify-center gap-2 ${
              isAnalyzing
                ? 'bg-primary/50 text-primary-foreground cursor-not-allowed'
                : showCorrections
                ? 'bg-accent text-accent-foreground hover:bg-accent/90'
                : 'bg-primary text-primary-foreground hover:bg-primary/90'
            }`}
            title={isAnalyzing ? "Analyzing..." : showCorrections ? "Clear Corrections" : "Check My Work"}
          >
            {isAnalyzing ? (
              <Loader2 size={14} className="animate-spin" />
            ) : showCorrections ? (
              <CheckCircle size={14} />
            ) : (
              <AlertCircle size={14} />
            )}
          </button>

        </div>

      </div>

      {/* Zoom Indicator */}
      <div className="absolute bottom-8 right-8 z-10 rounded-lg border border-slate-700/50 bg-slate-800/90 px-3 py-2 shadow-lg backdrop-blur-sm">
        <span className="text-xs font-medium text-slate-300">
          {Math.round(zoom * 100)}%
        </span>
      </div>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        className="w-full h-full cursor-crosshair touch-none"
        style={{
          transform: `scale(${zoom})`,
          transformOrigin: 'center center',
          touchAction: 'none'
        }}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      />

      {selectedShape?.type === 'molecule' && selectedShape.moleculeData && (
        <div className="absolute top-8 right-8 z-20 flex flex-col gap-3 max-w-xs">
          <div className="rounded-xl border border-slate-700/70 bg-slate-900/90 backdrop-blur-sm p-4 shadow-xl">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Selected Molecule</p>
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-500/20 border border-cyan-400/40">
                <Atom className="text-cyan-300" size={18} />
              </div>
              <div className="flex-1 space-y-1">
                <p className="text-sm font-medium text-slate-200 leading-tight">
                  {selectedShape.moleculeData.displayName || selectedShape.moleculeData.name || `CID ${selectedShape.moleculeData.cid}`}
                </p>
                {selectedShape.moleculeData.molecularFormula && (
                  <p className="text-xs text-slate-400">{selectedShape.moleculeData.molecularFormula}</p>
                )}
              </div>
            </div>

            {has3DStructure ? (
              <div className="mt-3 space-y-3">
                <button
                  type="button"
                  onClick={() => toggleSelectedMolecule3D(!selectedShape.use3D)}
                  className={`w-full rounded-lg px-3 py-2 text-sm font-semibold transition-colors flex items-center justify-center gap-2 ${
                    selectedShape.use3D
                      ? 'bg-cyan-500/90 text-slate-900 hover:bg-cyan-400'
                      : 'bg-slate-800/80 text-slate-200 border border-slate-700/60 hover:bg-slate-800'
                  }`}
                  title={selectedShape.use3D ? 'Disable 3D orbit mode' : 'Enable 3D orbit mode'}
                >
                  <RotateCcw size={16} />
                  {selectedShape.use3D ? 'Disable 3D Orbit' : 'Enable 3D Orbit'}
                </button>

                {selectedShape.use3D && (
                  <>
                    {(() => {
                      const rotation3D = selectedShape.rotation3D ?? { ...DEFAULT_MOLECULE_3D_ROTATION };
                      return (
                        <div className="flex items-center justify-between text-[11px] text-slate-400">
                          <span>Pitch: {Math.round(rotation3D.x)}°</span>
                          <span>Yaw: {Math.round(rotation3D.y)}°</span>
                        </div>
                      );
                    })()}

                    <div className="rounded-lg border border-slate-700/60 bg-slate-800/70 p-3 text-[11px] leading-relaxed text-slate-300">
                      Use the Rotate tool (🔄) and left-drag on the molecule to orbit it in 3D. Right-drag still spins the 2D orientation.
                    </div>

                    <button
                      type="button"
                      onClick={resetSelectedMolecule3DOrientation}
                      className="w-full rounded-lg border border-slate-700/60 bg-slate-800/80 px-3 py-2 text-xs font-semibold text-slate-200 transition-colors hover:bg-slate-800"
                    >
                      Reset 3D Orientation
                    </button>
                  </>
                )}

                {selectedShape.use3D && (
                  <div className="rounded-lg border border-slate-700/60 bg-slate-800/70 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-300 mb-2">Annotations</p>
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <label className="text-[11px] text-slate-400">Label</label>
                        <input
                          type="text"
                          value={annotationLabel}
                          onChange={(event) => setAnnotationLabel(event.target.value)}
                          className="w-full rounded-lg border border-slate-700 bg-slate-900/80 px-2 py-1 text-xs text-slate-200 focus:border-cyan-500 focus:outline-none"
                          placeholder="e.g., Active site"
                        />
                      </div>

                      <div className="space-y-2">
                        <span className="text-[11px] text-slate-400">Quick labels</span>
                        <div className="flex flex-wrap gap-2">
                          {annotationLabelOptions.map(option => (
                            <button
                              key={option}
                              type="button"
                              onClick={() => setAnnotationLabel(option)}
                              className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                                annotationLabel.toLowerCase() === option.toLowerCase()
                                  ? 'bg-cyan-500/90 text-slate-900 border-cyan-400 hover:bg-cyan-400'
                                  : 'bg-slate-900/60 text-slate-200 border-slate-700/60 hover:bg-slate-800'
                              }`}
                            >
                              {option}
                            </button>
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={customAnnotationLabel}
                            onChange={(event) => setCustomAnnotationLabel(event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter') {
                                event.preventDefault();
                                addCustomAnnotationLabel();
                              }
                            }}
                            className="w-full rounded-lg border border-slate-700 bg-slate-900/80 px-2 py-1 text-xs text-slate-200 focus:border-cyan-500 focus:outline-none"
                            placeholder="Add custom label"
                          />
                          <button
                            type="button"
                            onClick={addCustomAnnotationLabel}
                            disabled={!customAnnotationLabel.trim()}
                            className="rounded-lg border border-slate-700/60 bg-slate-900/80 px-3 py-1 text-xs font-semibold text-slate-200 transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Add
                          </button>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <span className="text-[11px] text-slate-400">Color</span>
                        <div className="flex flex-wrap gap-2">
                          {['#f97316', '#facc15', '#38bdf8', '#22d3ee', '#a855f7', '#34d399'].map(color => (
                            <button
                              key={color}
                              type="button"
                              onClick={() => setAnnotationColor(color)}
                              className={`h-6 w-6 rounded-full border-2 ${annotationColor === color ? 'border-white' : 'border-transparent'} shadow-lg`}
                              style={{ backgroundColor: color }}
                              title={color}
                            />
                          ))}
                        </div>
                      </div>

                      <div className="flex flex-col gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            if (!selectedShapeId) return;
                            setAnnotationMode({
                              shapeId: selectedShapeId,
                              label: annotationLabel,
                              color: annotationColor
                            });
                            setAnnotationHint('Click on the atom you want to highlight.');
                          }}
                          className={`w-full rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                            annotationMode?.shapeId === selectedShapeId
                              ? 'bg-cyan-500 text-slate-900 hover:bg-cyan-400'
                              : 'bg-slate-900/80 text-slate-200 border border-slate-700/60 hover:bg-slate-800'
                          }`}
                        >
                          {annotationMode?.shapeId === selectedShapeId ? 'Annotation Mode Active' : 'Mark Active Centre'}
                        </button>
                        {annotationMode?.shapeId === selectedShapeId && (
                          <button
                            type="button"
                            onClick={() => {
                              setAnnotationMode(null);
                              setAnnotationHint(null);
                            }}
                            className="w-full rounded-lg border border-slate-700/60 bg-slate-800/80 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800"
                          >
                            Cancel Annotation
                          </button>
                        )}
                        {annotationHint && (
                          <p className="text-[11px] text-cyan-300">{annotationHint}</p>
                        )}
                      </div>

                      {selectedShape.annotations && selectedShape.annotations.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-[11px] text-slate-400 uppercase tracking-wide">Current highlights</p>
                          <div className="space-y-2 max-h-32 overflow-y-auto pr-1">
                            {selectedShape.annotations.map(annotation => (
                              <div
                                key={annotation.id}
                                className="flex items-center justify-between rounded-lg border border-slate-700/60 bg-slate-900/80 px-2 py-2 text-xs text-slate-200"
                              >
                                <span className="flex items-center gap-2">
                                  <span
                                    className="inline-flex h-3 w-3 rounded-full"
                                    style={{ backgroundColor: annotation.color }}
                                  />
                                  {annotation.label}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => removeAnnotation(selectedShape.id, annotation.id)}
                                  className="text-slate-400 hover:text-red-400"
                                >
                                  Remove
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="mt-3 text-xs text-slate-400">
                3D orbit controls will appear once a 3D structure is available for this molecule.
              </p>
            )}

            <button
              type="button"
              onClick={openSelectedMoleculeIn3D}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-700/60 bg-slate-800/80 px-3 py-2 text-sm font-semibold text-slate-200 transition-colors hover:bg-slate-800"
              title="Open interactive MolView tab"
            >
              View in MolView
            </button>
          </div>
        </div>
      )}

      {/* Selected Protein Display */}
      {selectedShape?.type === 'protein' && selectedShape.proteinData && (
        <div className="absolute top-8 right-8 z-20 flex flex-col gap-3 max-w-xs">
          <div className="rounded-xl border border-slate-700/70 bg-slate-900/90 backdrop-blur-sm p-4 shadow-xl">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Selected Protein</p>
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-500/20 border border-rose-400/40">
                <Atom className="text-rose-300" size={18} />
              </div>
              <div className="flex-1 space-y-1">
                <p className="text-sm font-medium text-slate-200 leading-tight">
                  {selectedShape.proteinData.displayName || `PDB ${selectedShape.proteinData.entryId}`}
                </p>
                <p className="text-xs text-slate-400">{selectedShape.proteinData.title}</p>
                {selectedShape.proteinData.organism && (
                  <p className="text-xs text-slate-500">{selectedShape.proteinData.organism}</p>
                )}
              </div>
            </div>

            <div className="mt-3 space-y-3">
              <button
                type="button"
                onClick={() => {
                  if (selectedShape.proteinData?.entryId && selectedShape.proteinData.entryId.trim() !== '') {
                    try {
                      setPdbViewerData({
                        pdbId: selectedShape.proteinData.entryId.toUpperCase(),
                        title: selectedShape.proteinData.title || `PDB ${selectedShape.proteinData.entryId}`
                      });
                      setShowPDBViewer(true);
                    } catch (error) {
                      console.error('Failed to open PDB viewer:', error);
                    }
                  } else {
                    console.error('No valid protein data or entryId available for 3D viewer');
                  }
                }}
                className="w-full rounded-lg px-3 py-2 text-sm font-semibold transition-colors flex items-center justify-center gap-2 bg-rose-600/90 text-white hover:bg-rose-500"
                title="Open interactive 3D PDB viewer"
              >
                <Database size={16} />
                View 3D Structure
              </button>

              <button
                type="button"
                onClick={() => {
                  window.open(`https://www.rcsb.org/structure/${selectedShape.proteinData!.entryId.toUpperCase()}`, '_blank');
                }}
                className="w-full rounded-lg px-3 py-2 text-sm font-semibold transition-colors flex items-center justify-center gap-2 bg-slate-800/80 text-slate-200 border border-slate-700/60 hover:bg-slate-800"
                title="Open PDB entry page"
              >
                <ExternalLink size={16} />
                PDB Entry Page
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Correction Markers - Simplified */}
      {showCorrections && corrections.map((correction) => (
        <div
          key={correction.id}
          className="absolute z-20 pointer-events-none"
          style={{
            left: correction.x * zoom,
            top: correction.y * zoom,
          }}
        >
          {/* Simple Marker */}
          <div className={`w-3 h-3 rounded-full border-2 ${
            correction.type === 'error' ? 'bg-red-500 border-red-600' :
            correction.type === 'warning' ? 'bg-yellow-500 border-yellow-600' :
            'bg-blue-500 border-blue-600'
          } shadow-lg animate-pulse`} />
        </div>
      ))}

      {/* Analysis Results Panel - Side-by-Side Layout */}
      {showCorrections && analysisResult && (
        <div className="absolute bottom-4 right-4 z-10 bg-slate-800/95 backdrop-blur-sm border border-slate-700/50 rounded-xl shadow-2xl analysis-panel" style={{ width: '1000px', height: '700px' }}>
          {/* Header with Score */}
          <div className="sticky top-0 bg-slate-800/95 backdrop-blur-sm border-b border-slate-700/50 px-6 py-4 rounded-t-xl">
            <div className="flex items-center justify-between">
              <h4 className="text-lg font-bold text-white flex items-center gap-3">
                <AlertCircle size={20} className="text-orange-400" />
                Canvas Analysis Results
              </h4>
              <div className="flex items-center gap-4">
                <div className={`px-4 py-2 rounded-lg text-sm font-bold ${
                  analysisResult.overallScore >= 80 ? 'bg-green-600 text-green-100' :
                  analysisResult.overallScore >= 60 ? 'bg-yellow-600 text-yellow-100' :
                  'bg-red-600 text-red-100'
                }`}>
                  {analysisResult.overallScore}%
                </div>
                <button
                  onClick={clearCorrections}
                  className="px-3 py-2 bg-slate-600 hover:bg-slate-500 text-slate-300 text-sm rounded-lg transition-colors"
                  title="Close Analysis"
                >
                  ✕ Close
                </button>
                <div className="text-xs text-slate-400 mt-2">
                  Analysis Status: {isAnalyzing ? 'Analyzing...' : 'Complete'} | 
                  Corrections: {corrections.length} | 
                  Score: {analysisResult?.overallScore || 0}%
                </div>
              </div>
            </div>
          </div>

          {/* Side-by-Side Content */}
          <div className="flex analysis-content">
            {/* Left Panel - Errors & Corrections */}
            <div className="flex-1 p-8 border-r border-slate-700/50 analysis-sidebar">
              {/* Overall Feedback */}
              {analysisResult.feedback && (
                <div className="mb-8 p-5 bg-gradient-to-r from-slate-700/50 to-slate-600/30 rounded-lg border border-slate-600/30">
                  <h5 className="text-base font-semibold text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <Brain size={18} className="text-blue-400" />
                    Overall Feedback
                  </h5>
                  <p className="text-base text-slate-200 leading-relaxed whitespace-pre-wrap">
                    {analysisResult.feedback}
                  </p>
                </div>
              )}

              {/* Corrections */}
              <div>
                <h5 className="text-base font-semibold text-slate-300 uppercase tracking-wider mb-5 flex items-center gap-2">
                  <AlertCircle size={18} className="text-red-400" />
                  Errors & Corrections ({corrections.length})
                </h5>
                {corrections.length > 0 ? (
                  <div className="space-y-5">
                    {corrections.map((correction) => (
                      <div key={correction.id} className="correction-item p-5 bg-slate-700/30 rounded-lg border border-slate-600/30 hover:bg-slate-700/40 transition-colors">
                        <div className="flex items-center gap-3 mb-4">
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
                            correction.type === 'error' ? 'bg-red-500' :
                            correction.type === 'warning' ? 'bg-yellow-500' :
                            'bg-blue-500'
                          }`}>
                            <span className="text-white text-sm font-bold">
                              {correction.type === 'error' ? '!' : correction.type === 'warning' ? '⚠' : 'i'}
                            </span>
                          </div>
                          <span className={`text-base font-medium px-4 py-2 rounded ${
                            correction.type === 'error' ? 'bg-red-600 text-red-100' :
                            correction.type === 'warning' ? 'bg-yellow-600 text-yellow-100' :
                            'bg-blue-600 text-blue-100'
                          }`}>
                            {correction.type.toUpperCase()}
                          </span>
                          <span className={`text-base px-4 py-2 rounded ${
                            correction.severity === 'high' ? 'bg-red-500/20 text-red-300' :
                            correction.severity === 'medium' ? 'bg-yellow-500/20 text-yellow-300' :
                            'bg-blue-500/20 text-blue-300'
                          }`}>
                            {correction.severity.toUpperCase()}
                          </span>
                        </div>
                        <p className="text-base text-slate-300 leading-relaxed whitespace-pre-wrap">
                          {correction.message}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-5 bg-green-900/20 rounded-lg border border-green-600/30">
                    <div className="flex items-center gap-3 mb-2">
                      <CheckCircle size={18} className="text-green-400" />
                      <span className="text-base font-medium text-green-300">No Errors Found!</span>
                    </div>
                    <p className="text-base text-green-200">
                      Great job! Your chemical formulas and equations appear to be correct.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Right Panel - Suggestions & Tips */}
            <div className="flex-1 p-8 analysis-sidebar">
              {/* Suggestions */}
              {analysisResult.suggestions && analysisResult.suggestions.length > 0 && (
                <div>
                  <h5 className="text-base font-semibold text-slate-300 uppercase tracking-wider mb-5 flex items-center gap-2">
                    <Sparkles size={18} className="text-purple-400" />
                    Study Tips & Suggestions
                  </h5>
                  <div className="space-y-5">
                    {analysisResult.suggestions.map((suggestion, index) => (
                      <div key={index} className="suggestion-item p-5 bg-gradient-to-r from-purple-900/20 to-blue-900/20 rounded-lg border border-purple-600/30 hover:bg-purple-900/30 transition-colors">
                        <div className="flex items-start gap-4">
                          <div className="w-4 h-4 rounded-full bg-purple-400 mt-1 flex-shrink-0" />
                          <p className="text-base text-slate-300 leading-relaxed whitespace-pre-wrap">
                            {suggestion}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Study Guide */}
              <div className="mt-8 p-5 bg-gradient-to-r from-green-900/20 to-emerald-900/20 rounded-lg border border-green-600/30">
                <h6 className="text-base font-semibold text-green-300 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <CheckCircle size={18} className="text-green-400" />
                  Quick Study Guide
                </h6>
                <div className="space-y-4 text-base text-slate-300">
                  <div className="flex items-center gap-4">
                    <span className="w-3 h-3 bg-green-400 rounded-full flex-shrink-0"></span>
                    <span>Review chemical notation and subscript placement</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="w-3 h-3 bg-green-400 rounded-full flex-shrink-0"></span>
                    <span>Practice balancing equations step by step</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="w-3 h-3 bg-green-400 rounded-full flex-shrink-0"></span>
                    <span>Double-check molecular formulas</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Chemistry Structure Viewer */}
      {showChemistryViewer && chemistryStructure && (
        <ChemistryStructureViewer
          structure={chemistryStructure}
          onClose={() => setShowChemistryViewer(false)}
          onRegenerate={convertToChemistry}
        />
      )}



      {showMineralSearch && (
        <MineralSearch
          onClose={() => setShowMineralSearch(false)}
          onSelectMineral={(moleculeData) => {
            void (async () => {
              try {
                await insertMoleculeToCanvas(moleculeData);
              } catch (error) {
                console.error('Failed to insert mineral structure:', error);
              } finally {
                setShowMineralSearch(false);
              }
            })();
          }}
        />
      )}

      {/* Reagent Search Modal */}
      {showReagentSearch && (
        <ReagentSearch
          onClose={() => setShowReagentSearch(false)}
          onSelectReagent={(moleculeData) => {
            void (async () => {
              try {
                await insertMoleculeToCanvas({
                  ...moleculeData,
                  role: 'reagent',
                });
              } catch (error) {
                console.error('Failed to insert reagent molecule:', error);
              } finally {
                setShowReagentSearch(false);
              }
            })();
          }}
        />
      )}

      {/* Protein Search Modal */}
      {showProteinSearch && (
        <ProteinSearch
          onClose={() => setShowProteinSearch(false)}
          onSelectProtein={(proteinData) => {
            void (async () => {
              try {
                await insertProteinToCanvas(proteinData);
              } catch (error) {
                console.error('Failed to insert PDB protein:', error);
              } finally {
                setShowProteinSearch(false);
              }
            })();
          }}
        />
      )}

      {/* Chemistry Widget Panel Modal */}
      {showChemistryWidgetPanel && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-hidden">
            <ChemistryWidgetPanel onClose={() => setShowChemistryWidgetPanel(false)} />
          </div>
        </div>
      )}

      {/* PDB 3D Viewer Modal */}
      {showPDBViewer && pdbViewerData && (
        <PDBViewerEmbedded
          pdbId={pdbViewerData.pdbId}
          title={pdbViewerData.title}
          isOpen={showPDBViewer}
          onClose={() => {
            setShowPDBViewer(false);
            setPdbViewerData(null);
          }}
        />
      )}
    </div>
  );
}
