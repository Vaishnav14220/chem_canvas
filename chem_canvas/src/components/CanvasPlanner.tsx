/**
 * AFFiNE-Style Canvas Planner Component
 * A full-featured infinite canvas with planning tools
 */
import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
    MousePointer2,
    Pencil,
    Eraser,
    Square,
    Circle,
    Triangle,
    Type,
    ArrowRight,
    Frame,
    StickyNote,
    ZoomIn,
    ZoomOut,
    Grid3X3,
    Maximize2,
    Download,
    Undo2,
    Redo2,
    Minus,
    Play,
    ChevronLeft,
    ChevronRight,
    X,
    Move,
    MoreHorizontal,
    Palette,
    Diamond,
    Star,
    RectangleHorizontal,
    Pointer,
    Image as ImageIcon,
} from 'lucide-react';
import './canvasPlannerStyles.css';
import {
    CanvasTool,
    CanvasElement,
    ShapeElement,
    TextElement,
    NoteElement,
    FrameElement,
    ConnectorElement,
    PenElement,
    ToolOptions,
    CanvasViewport,
    CanvasGrid,
    DEFAULT_TOOL_OPTIONS,
    NOTE_COLORS,
    NoteColor,
    createShapeElement,
    createTextElement,
    createNoteElement,
    createFrameElement,
    createConnectorElement,
    createPenElement,
    createId,
} from '../types/canvasPlannerTypes';

interface CanvasPlannerProps {
    onClose?: () => void;
}

// Color palette for tools
const COLOR_PALETTE = [
    '#3b82f6', '#60a5fa', '#2563eb', // Blues
    '#8b5cf6', '#a855f7', '#7c3aed', // Purples
    '#ec4899', '#f472b6', '#db2777', // Pinks
    '#ef4444', '#f87171', '#dc2626', // Reds
    '#f97316', '#fb923c', '#ea580c', // Oranges
    '#eab308', '#facc15', '#ca8a04', // Yellows
    '#22c55e', '#4ade80', '#16a34a', // Greens
    '#14b8a6', '#2dd4bf', '#0d9488', // Teals
    '#64748b', '#94a3b8', '#475569', // Grays
    '#ffffff', '#f1f5f9', '#0f172a', // White/Black
];

export const CanvasPlanner: React.FC<CanvasPlannerProps> = ({ onClose }) => {
    // State
    const [activeTool, setActiveTool] = useState<CanvasTool>('select');
    const [elements, setElements] = useState<CanvasElement[]>([]);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [viewport, setViewport] = useState<CanvasViewport>({
        x: 0,
        y: 0,
        zoom: 1,
        minZoom: 0.1,
        maxZoom: 5,
    });
    const [grid, setGrid] = useState<CanvasGrid>({
        enabled: true,
        size: 20,
        snapToGrid: false,
        color: '#94a3b8',
        opacity: 0.08,
    });
    const [toolOptions, setToolOptions] = useState<ToolOptions>(DEFAULT_TOOL_OPTIONS);
    const [history, setHistory] = useState<{
        past: CanvasElement[][];
        future: CanvasElement[][];
    }>({ past: [], future: [] });
    const [isPresentationMode, setIsPresentationMode] = useState(false);
    const [presentationFrameIndex, setPresentationFrameIndex] = useState(0);

    // Drawing states
    const [isDrawing, setIsDrawing] = useState(false);
    const [isPanning, setIsPanning] = useState(false);
    const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
    const [currentPenPoints, setCurrentPenPoints] = useState<{ x: number; y: number }[]>([]);
    const [drawingShape, setDrawingShape] = useState<{ startX: number; startY: number } | null>(null);
    const [editingTextId, setEditingTextId] = useState<string | null>(null);

    // UI states
    const [showShapeDropdown, setShowShapeDropdown] = useState(false);
    const [showColorPicker, setShowColorPicker] = useState(false);
    const [showFillColorPicker, setShowFillColorPicker] = useState(false);

    // Refs
    const canvasRef = useRef<HTMLDivElement>(null);
    const elementsRef = useRef<HTMLDivElement>(null);

    // Get frames for presentation mode
    const frames = useMemo(() =>
        elements.filter(el => el.type === 'frame') as FrameElement[],
        [elements]
    );

    // Tool definitions
    const tools: { id: CanvasTool; icon: React.ReactNode; label: string }[] = [
        { id: 'select', icon: <MousePointer2 />, label: 'Select' },
        { id: 'pan', icon: <Move />, label: 'Pan' },
        { id: 'pen', icon: <Pencil />, label: 'Pen' },
        { id: 'eraser', icon: <Eraser />, label: 'Eraser' },
    ];

    const shapeTools: { id: CanvasTool; icon: React.ReactNode; label: string }[] = [
        { id: 'rectangle', icon: <Square />, label: 'Rectangle' },
        { id: 'roundedRect', icon: <RectangleHorizontal />, label: 'Rounded Rectangle' },
        { id: 'circle', icon: <Circle />, label: 'Circle' },
        { id: 'triangle', icon: <Triangle />, label: 'Triangle' },
        { id: 'diamond', icon: <Diamond />, label: 'Diamond' },
        { id: 'star', icon: <Star />, label: 'Star' },
        { id: 'line', icon: <Minus />, label: 'Line' },
        { id: 'arrow', icon: <ArrowRight />, label: 'Arrow' },
    ];

    const extraTools: { id: CanvasTool; icon: React.ReactNode; label: string }[] = [
        { id: 'text', icon: <Type />, label: 'Text' },
        { id: 'connector', icon: <ArrowRight />, label: 'Connector' },
        { id: 'frame', icon: <Frame />, label: 'Frame' },
        { id: 'note', icon: <StickyNote />, label: 'Sticky Note' },
        { id: 'laser', icon: <Pointer />, label: 'Laser Pointer' },
        { id: 'image', icon: <ImageIcon />, label: 'Insert Image' },
    ];

    // History management
    const saveToHistory = useCallback(() => {
        setHistory(prev => ({
            past: [...prev.past.slice(-50), elements],
            future: [],
        }));
    }, [elements]);

    const undo = useCallback(() => {
        setHistory(prev => {
            if (prev.past.length === 0) return prev;
            const previous = prev.past[prev.past.length - 1];
            return {
                past: prev.past.slice(0, -1),
                future: [elements, ...prev.future],
            };
        });
        if (history.past.length > 0) {
            setElements(history.past[history.past.length - 1]);
        }
    }, [elements, history.past]);

    const redo = useCallback(() => {
        setHistory(prev => {
            if (prev.future.length === 0) return prev;
            const next = prev.future[0];
            return {
                past: [...prev.past, elements],
                future: prev.future.slice(1),
            };
        });
        if (history.future.length > 0) {
            setElements(history.future[0]);
        }
    }, [elements, history.future]);

    // Coordinate conversion
    const screenToCanvas = useCallback((screenX: number, screenY: number) => {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return { x: 0, y: 0 };
        return {
            x: (screenX - rect.left - viewport.x) / viewport.zoom,
            y: (screenY - rect.top - viewport.y) / viewport.zoom,
        };
    }, [viewport]);

    // Handle zoom
    const handleZoom = useCallback((delta: number, centerX?: number, centerY?: number) => {
        setViewport(prev => {
            const newZoom = Math.max(prev.minZoom, Math.min(prev.maxZoom, prev.zoom * (1 + delta)));
            if (centerX !== undefined && centerY !== undefined) {
                // Zoom towards cursor position
                const rect = canvasRef.current?.getBoundingClientRect();
                if (rect) {
                    const mouseX = centerX - rect.left;
                    const mouseY = centerY - rect.top;
                    const scale = newZoom / prev.zoom;
                    return {
                        ...prev,
                        zoom: newZoom,
                        x: mouseX - (mouseX - prev.x) * scale,
                        y: mouseY - (mouseY - prev.y) * scale,
                    };
                }
            }
            return { ...prev, zoom: newZoom };
        });
    }, []);

    // Handle wheel events
    const handleWheel = useCallback((e: React.WheelEvent) => {
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            const delta = -e.deltaY * 0.001;
            handleZoom(delta, e.clientX, e.clientY);
        } else if (!isDrawing) {
            setViewport(prev => ({
                ...prev,
                x: prev.x - e.deltaX,
                y: prev.y - e.deltaY,
            }));
        }
    }, [handleZoom, isDrawing]);

    // Handle mouse down
    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        if (e.button !== 0) return;

        const canvasPos = screenToCanvas(e.clientX, e.clientY);

        switch (activeTool) {
            case 'pan':
                setIsPanning(true);
                setDragStart({ x: e.clientX - viewport.x, y: e.clientY - viewport.y });
                break;

            case 'pen':
                setIsDrawing(true);
                setCurrentPenPoints([canvasPos]);
                break;

            case 'rectangle':
            case 'roundedRect':
            case 'circle':
            case 'triangle':
            case 'diamond':
            case 'star':
            case 'line':
            case 'arrow':
                setIsDrawing(true);
                setDrawingShape({ startX: canvasPos.x, startY: canvasPos.y });
                break;

            case 'text':
                saveToHistory();
                const textEl = createTextElement(canvasPos.x, canvasPos.y, '', toolOptions);
                setElements(prev => [...prev, textEl]);
                setSelectedIds([textEl.id]);
                setEditingTextId(textEl.id);
                break;

            case 'note':
                saveToHistory();
                const noteEl = createNoteElement(canvasPos.x, canvasPos.y, toolOptions);
                setElements(prev => [...prev, noteEl]);
                setSelectedIds([noteEl.id]);
                break;

            case 'frame':
                setIsDrawing(true);
                setDrawingShape({ startX: canvasPos.x, startY: canvasPos.y });
                break;

            case 'select':
            default:
                // Check if clicking on an element
                const clickedElement = [...elements].reverse().find(el => {
                    return (
                        canvasPos.x >= el.x &&
                        canvasPos.x <= el.x + el.width &&
                        canvasPos.y >= el.y &&
                        canvasPos.y <= el.y + el.height
                    );
                });

                if (clickedElement) {
                    if (e.shiftKey) {
                        setSelectedIds(prev =>
                            prev.includes(clickedElement.id)
                                ? prev.filter(id => id !== clickedElement.id)
                                : [...prev, clickedElement.id]
                        );
                    } else {
                        setSelectedIds([clickedElement.id]);
                    }
                    setDragStart(canvasPos);
                } else {
                    setSelectedIds([]);
                    // Start selection box
                    setDragStart(canvasPos);
                }
                break;
        }
    }, [activeTool, elements, screenToCanvas, saveToHistory, toolOptions, viewport]);

    // Handle mouse move
    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        const canvasPos = screenToCanvas(e.clientX, e.clientY);

        if (isPanning && dragStart) {
            setViewport(prev => ({
                ...prev,
                x: e.clientX - dragStart.x,
                y: e.clientY - dragStart.y,
            }));
            return;
        }

        if (isDrawing) {
            switch (activeTool) {
                case 'pen':
                    setCurrentPenPoints(prev => [...prev, canvasPos]);
                    break;

                case 'rectangle':
                case 'roundedRect':
                case 'circle':
                case 'triangle':
                case 'diamond':
                case 'star':
                case 'line':
                case 'arrow':
                case 'frame':
                    // Shape preview handled in render
                    break;
            }
        }

        if (activeTool === 'select' && dragStart && selectedIds.length > 0) {
            const dx = canvasPos.x - dragStart.x;
            const dy = canvasPos.y - dragStart.y;

            setElements(prev => prev.map(el => {
                if (selectedIds.includes(el.id)) {
                    return { ...el, x: el.x + dx, y: el.y + dy };
                }
                return el;
            }));
            setDragStart(canvasPos);
        }
    }, [activeTool, dragStart, isDrawing, isPanning, screenToCanvas, selectedIds]);

    // Handle mouse up
    const handleMouseUp = useCallback((e: React.MouseEvent) => {
        const canvasPos = screenToCanvas(e.clientX, e.clientY);

        if (isPanning) {
            setIsPanning(false);
            setDragStart(null);
            return;
        }

        if (isDrawing) {
            switch (activeTool) {
                case 'pen':
                    if (currentPenPoints.length > 1) {
                        saveToHistory();
                        const penEl = createPenElement(currentPenPoints, toolOptions);
                        setElements(prev => [...prev, penEl]);
                    }
                    setCurrentPenPoints([]);
                    break;

                case 'rectangle':
                case 'roundedRect':
                case 'circle':
                case 'triangle':
                case 'diamond':
                case 'star':
                case 'line':
                case 'arrow':
                    if (drawingShape) {
                        const width = Math.abs(canvasPos.x - drawingShape.startX);
                        const height = Math.abs(canvasPos.y - drawingShape.startY);

                        if (width > 5 || height > 5) {
                            saveToHistory();
                            const shapeType = activeTool === 'arrow' ? 'arrow' : activeTool;
                            const shapeEl = createShapeElement(
                                shapeType as any,
                                Math.min(canvasPos.x, drawingShape.startX),
                                Math.min(canvasPos.y, drawingShape.startY),
                                toolOptions
                            );
                            shapeEl.width = width || 100;
                            shapeEl.height = height || 100;
                            setElements(prev => [...prev, shapeEl]);
                            setSelectedIds([shapeEl.id]);
                        }
                    }
                    break;

                case 'frame':
                    if (drawingShape) {
                        const width = Math.abs(canvasPos.x - drawingShape.startX);
                        const height = Math.abs(canvasPos.y - drawingShape.startY);

                        if (width > 20 && height > 20) {
                            saveToHistory();
                            const frameEl = createFrameElement(
                                Math.min(canvasPos.x, drawingShape.startX),
                                Math.min(canvasPos.y, drawingShape.startY),
                                `Frame ${frames.length + 1}`
                            );
                            frameEl.width = width;
                            frameEl.height = height;
                            setElements(prev => [...prev, frameEl]);
                            setSelectedIds([frameEl.id]);
                        }
                    }
                    break;
            }

            setIsDrawing(false);
            setDrawingShape(null);
        }

        if (activeTool === 'select') {
            setDragStart(null);
        }
    }, [activeTool, currentPenPoints, drawingShape, frames.length, isDrawing, isPanning, saveToHistory, screenToCanvas, toolOptions]);

    // Handle key events
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Undo/Redo
            if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
                e.preventDefault();
                if (e.shiftKey) {
                    redo();
                } else {
                    undo();
                }
                return;
            }

            // Delete selected elements
            if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIds.length > 0 && !editingTextId) {
                e.preventDefault();
                saveToHistory();
                setElements(prev => prev.filter(el => !selectedIds.includes(el.id)));
                setSelectedIds([]);
                return;
            }

            // Tool shortcuts
            if (!e.ctrlKey && !e.metaKey && !editingTextId) {
                switch (e.key) {
                    case 'v': setActiveTool('select'); break;
                    case 'h': setActiveTool('pan'); break;
                    case 'p': setActiveTool('pen'); break;
                    case 'e': setActiveTool('eraser'); break;
                    case 'r': setActiveTool('rectangle'); break;
                    case 'o': setActiveTool('circle'); break;
                    case 't': setActiveTool('text'); break;
                    case 'n': setActiveTool('note'); break;
                    case 'f': setActiveTool('frame'); break;
                    case ' ':
                        e.preventDefault();
                        setActiveTool('pan');
                        break;
                }
            }

            // Escape
            if (e.key === 'Escape') {
                setSelectedIds([]);
                setEditingTextId(null);
                setIsPresentationMode(false);
            }
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.key === ' ' && activeTool === 'pan') {
                setActiveTool('select');
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [activeTool, editingTextId, redo, saveToHistory, selectedIds, undo]);

    // Handle text editing
    const handleTextChange = useCallback((id: string, content: string) => {
        setElements(prev => prev.map(el => {
            if (el.id === id && el.type === 'text') {
                return { ...el, content, updatedAt: Date.now() };
            }
            if (el.id === id && el.type === 'note') {
                return { ...el, content, updatedAt: Date.now() };
            }
            return el;
        }));
    }, []);

    // Render shape preview during drawing
    const renderDrawingPreview = () => {
        if (!isDrawing || !drawingShape) return null;

        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return null;

        // We'd need current mouse position, but for simplicity showing outline
        return null;
    };

    // Render pen preview
    const renderPenPreview = () => {
        if (!isDrawing || currentPenPoints.length < 2) return null;

        const pathData = currentPenPoints.reduce((acc, point, index) => {
            if (index === 0) return `M ${point.x} ${point.y}`;
            return `${acc} L ${point.x} ${point.y}`;
        }, '');

        return (
            <svg
                className="canvas-connector"
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    pointerEvents: 'none',
                    overflow: 'visible',
                }}
            >
                <path
                    d={pathData}
                    fill="none"
                    stroke={toolOptions.strokeColor}
                    strokeWidth={toolOptions.strokeWidth}
                />
            </svg>
        );
    };

    // Render single element
    const renderElement = (element: CanvasElement) => {
        const isSelected = selectedIds.includes(element.id);
        const commonStyle: React.CSSProperties = {
            left: element.x,
            top: element.y,
            width: element.width,
            height: element.height,
            transform: `rotate(${element.rotation}deg)`,
            zIndex: element.zIndex,
        };

        switch (element.type) {
            case 'shape': {
                const shape = element as ShapeElement;
                return (
                    <div
                        key={element.id}
                        className={`canvas-element ${isSelected ? 'selected' : ''}`}
                        style={{
                            ...commonStyle,
                            backgroundColor: shape.fillColor,
                            opacity: shape.fillOpacity,
                            border: `${shape.strokeWidth}px ${shape.strokeStyle} ${shape.strokeColor}`,
                            borderRadius: shape.shapeType === 'circle'
                                ? '50%'
                                : shape.shapeType === 'rectangle'
                                    ? (shape.cornerRadius || 0)
                                    : 0,
                        }}
                    />
                );
            }

            case 'text': {
                const text = element as TextElement;
                const isEditing = editingTextId === element.id;
                return (
                    <div
                        key={element.id}
                        className={`canvas-element canvas-text ${isSelected ? 'selected' : ''}`}
                        style={{
                            ...commonStyle,
                            padding: text.padding,
                            backgroundColor: text.backgroundColor,
                        }}
                        onDoubleClick={() => setEditingTextId(element.id)}
                    >
                        {isEditing ? (
                            <textarea
                                className="canvas-text-input"
                                value={text.content}
                                onChange={(e) => handleTextChange(element.id, e.target.value)}
                                onBlur={() => setEditingTextId(null)}
                                autoFocus
                                style={{
                                    fontSize: text.fontSize,
                                    fontFamily: text.fontFamily,
                                    fontWeight: text.fontWeight,
                                    fontStyle: text.fontStyle,
                                    textAlign: text.textAlign,
                                    color: text.textColor,
                                }}
                                placeholder="Type something..."
                            />
                        ) : (
                            <div
                                style={{
                                    fontSize: text.fontSize,
                                    fontFamily: text.fontFamily,
                                    fontWeight: text.fontWeight,
                                    fontStyle: text.fontStyle,
                                    textAlign: text.textAlign,
                                    color: text.textColor,
                                    whiteSpace: 'pre-wrap',
                                    wordBreak: 'break-word',
                                }}
                            >
                                {text.content || 'Double-click to edit'}
                            </div>
                        )}
                    </div>
                );
            }

            case 'note': {
                const note = element as NoteElement;
                return (
                    <div
                        key={element.id}
                        className={`canvas-element canvas-note ${note.noteColor} ${isSelected ? 'selected' : ''}`}
                        style={commonStyle}
                        onDoubleClick={() => setEditingTextId(element.id)}
                    >
                        {editingTextId === element.id ? (
                            <textarea
                                value={note.content}
                                onChange={(e) => handleTextChange(element.id, e.target.value)}
                                onBlur={() => setEditingTextId(null)}
                                autoFocus
                                placeholder="Write a note..."
                                style={{ fontSize: note.fontSize }}
                            />
                        ) : (
                            <div style={{ fontSize: note.fontSize }}>
                                {note.content || 'Double-click to edit'}
                            </div>
                        )}
                    </div>
                );
            }

            case 'frame': {
                const frame = element as FrameElement;
                return (
                    <div
                        key={element.id}
                        className={`canvas-element canvas-frame ${isSelected ? 'selected' : ''}`}
                        style={{
                            ...commonStyle,
                            backgroundColor: frame.backgroundColor,
                            borderColor: frame.borderColor,
                            borderWidth: frame.borderWidth,
                        }}
                    >
                        <div className="canvas-frame-title">{frame.title}</div>
                    </div>
                );
            }

            case 'pen': {
                const pen = element as PenElement;
                const pathData = pen.points.reduce((acc, point, index) => {
                    if (index === 0) return `M ${point.x} ${point.y}`;
                    return `${acc} L ${point.x} ${point.y}`;
                }, '');

                return (
                    <svg
                        key={element.id}
                        className={`canvas-element ${isSelected ? 'selected' : ''}`}
                        style={{
                            position: 'absolute',
                            left: 0,
                            top: 0,
                            width: '100%',
                            height: '100%',
                            pointerEvents: 'none',
                            overflow: 'visible',
                        }}
                    >
                        <path
                            d={pathData}
                            fill="none"
                            stroke={pen.strokeColor}
                            strokeWidth={pen.strokeWidth}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            opacity={pen.opacity}
                            style={{ pointerEvents: 'stroke' }}
                        />
                    </svg>
                );
            }

            default:
                return null;
        }
    };

    // Get current shape tool
    const currentShapeTool = shapeTools.find(t => t.id === activeTool);

    return (
        <div className={`canvas-planner ${isPresentationMode ? 'presentation-mode' : ''}`}>
            {/* Main Toolbar */}
            <div className="canvas-planner-toolbar">
                {/* Basic Tools */}
                {tools.map(tool => (
                    <button
                        key={tool.id}
                        className={`canvas-planner-tool-btn ${activeTool === tool.id ? 'active' : ''}`}
                        onClick={() => setActiveTool(tool.id)}
                        title={tool.label}
                    >
                        {tool.icon}
                    </button>
                ))}

                <div className="canvas-planner-toolbar-divider" />

                {/* Shape Tools Dropdown */}
                <div className="canvas-planner-dropdown">
                    <button
                        className={`canvas-planner-tool-btn ${shapeTools.some(t => t.id === activeTool) ? 'active' : ''}`}
                        onClick={() => setShowShapeDropdown(!showShapeDropdown)}
                        title="Shapes"
                    >
                        {currentShapeTool?.icon || <Square />}
                    </button>
                    <div className={`canvas-planner-dropdown-content ${showShapeDropdown ? '' : 'hidden'}`}>
                        {shapeTools.map(tool => (
                            <button
                                key={tool.id}
                                className={`canvas-planner-tool-btn ${activeTool === tool.id ? 'active' : ''}`}
                                onClick={() => {
                                    setActiveTool(tool.id);
                                    setShowShapeDropdown(false);
                                }}
                                title={tool.label}
                            >
                                {tool.icon}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Extra Tools */}
                {extraTools.map(tool => (
                    <button
                        key={tool.id}
                        className={`canvas-planner-tool-btn ${activeTool === tool.id ? 'active' : ''}`}
                        onClick={() => setActiveTool(tool.id)}
                        title={tool.label}
                    >
                        {tool.icon}
                    </button>
                ))}

                <div className="canvas-planner-toolbar-divider" />

                {/* Stroke Color Picker */}
                <div className="canvas-planner-color-picker">
                    <button
                        className="canvas-planner-tool-btn"
                        onClick={() => {
                            setShowColorPicker(!showColorPicker);
                            setShowFillColorPicker(false);
                        }}
                        title="Stroke Color"
                    >
                        <div
                            className="canvas-planner-color-swatch"
                            style={{ backgroundColor: toolOptions.strokeColor }}
                        />
                    </button>
                    <div className={`canvas-planner-color-palette ${showColorPicker ? '' : 'hidden'}`}>
                        {COLOR_PALETTE.map(color => (
                            <button
                                key={color}
                                className={`canvas-planner-color-option ${toolOptions.strokeColor === color ? 'selected' : ''}`}
                                style={{ backgroundColor: color }}
                                onClick={() => {
                                    setToolOptions(prev => ({ ...prev, strokeColor: color }));
                                    setShowColorPicker(false);
                                }}
                            />
                        ))}
                    </div>
                </div>

                {/* Fill Color Picker */}
                <div className="canvas-planner-color-picker">
                    <button
                        className="canvas-planner-tool-btn"
                        onClick={() => {
                            setShowFillColorPicker(!showFillColorPicker);
                            setShowColorPicker(false);
                        }}
                        title="Fill Color"
                    >
                        <Palette />
                    </button>
                    <div className={`canvas-planner-color-palette ${showFillColorPicker ? '' : 'hidden'}`}>
                        {COLOR_PALETTE.map(color => (
                            <button
                                key={color}
                                className={`canvas-planner-color-option ${toolOptions.fillColor === color ? 'selected' : ''}`}
                                style={{ backgroundColor: color }}
                                onClick={() => {
                                    setToolOptions(prev => ({ ...prev, fillColor: color }));
                                    setShowFillColorPicker(false);
                                }}
                            />
                        ))}
                    </div>
                </div>
            </div>

            {/* Right Actions */}
            <div className="canvas-planner-actions">
                <button
                    className="canvas-planner-action-btn"
                    onClick={undo}
                    disabled={history.past.length === 0}
                    title="Undo (Ctrl+Z)"
                >
                    <Undo2 />
                </button>
                <button
                    className="canvas-planner-action-btn"
                    onClick={redo}
                    disabled={history.future.length === 0}
                    title="Redo (Ctrl+Shift+Z)"
                >
                    <Redo2 />
                </button>

                <div className="canvas-planner-zoom">
                    <button
                        className="canvas-planner-action-btn"
                        onClick={() => handleZoom(-0.2)}
                        title="Zoom Out"
                    >
                        <ZoomOut />
                    </button>
                    <span className="canvas-planner-zoom-level">
                        {Math.round(viewport.zoom * 100)}%
                    </span>
                    <button
                        className="canvas-planner-action-btn"
                        onClick={() => handleZoom(0.2)}
                        title="Zoom In"
                    >
                        <ZoomIn />
                    </button>
                </div>

                <button
                    className={`canvas-planner-action-btn ${grid.enabled ? 'active' : ''}`}
                    onClick={() => setGrid(prev => ({ ...prev, enabled: !prev.enabled }))}
                    title="Toggle Grid"
                >
                    <Grid3X3 />
                </button>

                <button
                    className="canvas-planner-action-btn"
                    onClick={() => {
                        if (frames.length > 0) {
                            setIsPresentationMode(true);
                            setPresentationFrameIndex(0);
                        }
                    }}
                    disabled={frames.length === 0}
                    title="Presentation Mode"
                >
                    <Play />
                </button>

                {onClose && (
                    <button
                        className="canvas-planner-action-btn"
                        onClick={onClose}
                        title="Close"
                    >
                        <X />
                    </button>
                )}
            </div>

            {/* Canvas Area */}
            <div
                ref={canvasRef}
                className={`canvas-planner-canvas tool-${activeTool} ${isPanning ? 'dragging' : ''}`}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onWheel={handleWheel}
            >
                {/* Grid */}
                <div
                    className={`canvas-planner-grid ${grid.enabled ? '' : 'hidden'}`}
                    style={{
                        transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
                        backgroundSize: `${grid.size}px ${grid.size}px`,
                    }}
                />

                {/* Elements */}
                <div
                    ref={elementsRef}
                    className="canvas-planner-elements"
                    style={{
                        transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
                    }}
                >
                    {elements.sort((a, b) => a.zIndex - b.zIndex).map(renderElement)}
                    {renderPenPreview()}
                    {renderDrawingPreview()}
                </div>
            </div>

            {/* Presentation Controls */}
            {isPresentationMode && (
                <div className="canvas-presentation-controls">
                    <div className="canvas-presentation-nav">
                        <button
                            onClick={() => setPresentationFrameIndex(prev => Math.max(0, prev - 1))}
                            disabled={presentationFrameIndex === 0}
                        >
                            <ChevronLeft />
                        </button>
                        <span className="canvas-presentation-progress">
                            {presentationFrameIndex + 1} / {frames.length}
                        </span>
                        <button
                            onClick={() => setPresentationFrameIndex(prev => Math.min(frames.length - 1, prev + 1))}
                            disabled={presentationFrameIndex === frames.length - 1}
                        >
                            <ChevronRight />
                        </button>
                    </div>
                    <button
                        className="canvas-planner-action-btn"
                        onClick={() => setIsPresentationMode(false)}
                        title="Exit Presentation"
                    >
                        <X />
                    </button>
                </div>
            )}
        </div>
    );
};

export default CanvasPlanner;
