/**
 * Type definitions for the AFFiNE-style Canvas Planner
 */

// Tool types available in the toolbar
export type CanvasTool =
    | 'select'
    | 'pen'
    | 'eraser'
    | 'rectangle'
    | 'roundedRect'
    | 'circle'
    | 'triangle'
    | 'diamond'
    | 'star'
    | 'line'
    | 'arrow'
    | 'text'
    | 'connector'
    | 'frame'
    | 'note'
    | 'pan'
    | 'laser'
    | 'image';

// Shape types
export type ShapeType = 'rectangle' | 'roundedRect' | 'circle' | 'triangle' | 'diamond' | 'star' | 'ellipse' | 'line' | 'arrow';

// Connector types
export type ConnectorType = 'straight' | 'curved' | 'elbow';
export type ConnectorEndStyle = 'none' | 'arrow' | 'dot' | 'diamond';

// Note colors
export type NoteColor = 'yellow' | 'pink' | 'blue' | 'green' | 'purple' | 'orange';

// Base element interface
export interface CanvasElementBase {
    id: string;
    type: 'shape' | 'text' | 'connector' | 'frame' | 'note' | 'pen' | 'image';
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
    locked: boolean;
    visible: boolean;
    zIndex: number;
    groupId?: string;
    createdAt: number;
    updatedAt: number;
}

// Shape element
export interface ShapeElement extends CanvasElementBase {
    type: 'shape';
    shapeType: ShapeType;
    fillColor: string;
    fillOpacity: number;
    strokeColor: string;
    strokeWidth: number;
    strokeStyle: 'solid' | 'dashed' | 'dotted';
    cornerRadius?: number;
}

// Text element
export interface TextElement extends CanvasElementBase {
    type: 'text';
    content: string;
    fontSize: number;
    fontFamily: string;
    fontWeight: 'normal' | 'bold';
    fontStyle: 'normal' | 'italic';
    textAlign: 'left' | 'center' | 'right';
    textColor: string;
    backgroundColor: string;
    padding: number;
}

// Connector element
export interface ConnectorElement extends CanvasElementBase {
    type: 'connector';
    connectorType: ConnectorType;
    startElementId?: string;
    endElementId?: string;
    startPoint: { x: number; y: number };
    endPoint: { x: number; y: number };
    controlPoints?: { x: number; y: number }[];
    strokeColor: string;
    strokeWidth: number;
    startStyle: ConnectorEndStyle;
    endStyle: ConnectorEndStyle;
    label?: string;
    labelPosition?: number; // 0-1 position along the connector
}

// Frame element (for grouping)
export interface FrameElement extends CanvasElementBase {
    type: 'frame';
    title: string;
    backgroundColor: string;
    borderColor: string;
    borderWidth: number;
    childIds: string[];
    collapsed: boolean;
}

// Sticky note element
export interface NoteElement extends CanvasElementBase {
    type: 'note';
    content: string;
    noteColor: NoteColor;
    fontSize: number;
}

// Pen/drawing element
export interface PenElement extends CanvasElementBase {
    type: 'pen';
    points: { x: number; y: number; pressure?: number }[];
    strokeColor: string;
    strokeWidth: number;
    opacity: number;
}

// Image element
export interface ImageElement extends CanvasElementBase {
    type: 'image';
    src: string;
    alt: string;
    objectFit: 'contain' | 'cover' | 'fill';
}

// Union type for all elements
export type CanvasElement =
    | ShapeElement
    | TextElement
    | ConnectorElement
    | FrameElement
    | NoteElement
    | PenElement
    | ImageElement;

// Canvas viewport state
export interface CanvasViewport {
    x: number;
    y: number;
    zoom: number;
    minZoom: number;
    maxZoom: number;
}

// Canvas grid settings
export interface CanvasGrid {
    enabled: boolean;
    size: number;
    snapToGrid: boolean;
    color: string;
    opacity: number;
}

// Canvas state
export interface CanvasState {
    elements: CanvasElement[];
    selectedIds: string[];
    viewport: CanvasViewport;
    grid: CanvasGrid;
    activeTool: CanvasTool;
    history: {
        past: CanvasElement[][];
        future: CanvasElement[][];
    };
    clipboard: CanvasElement[];
    isPresentationMode: boolean;
    presentationFrameIndex: number;
}

// Tool options
export interface ToolOptions {
    strokeColor: string;
    fillColor: string;
    strokeWidth: number;
    fontSize: number;
    fontFamily: string;
    noteColor: NoteColor;
    connectorType: ConnectorType;
    startStyle: ConnectorEndStyle;
    endStyle: ConnectorEndStyle;
}

// Keyboard shortcuts
export interface KeyboardShortcut {
    key: string;
    ctrl?: boolean;
    shift?: boolean;
    alt?: boolean;
    action: string;
}

// Default tool options
export const DEFAULT_TOOL_OPTIONS: ToolOptions = {
    strokeColor: '#3b82f6',
    fillColor: '#3b82f6',
    strokeWidth: 2,
    fontSize: 16,
    fontFamily: 'Inter, sans-serif',
    noteColor: 'yellow',
    connectorType: 'straight',
    startStyle: 'none',
    endStyle: 'arrow',
};

// Note color palette
export const NOTE_COLORS: Record<NoteColor, { bg: string; border: string }> = {
    yellow: { bg: '#fef3c7', border: '#f59e0b' },
    pink: { bg: '#fce7f3', border: '#ec4899' },
    blue: { bg: '#dbeafe', border: '#3b82f6' },
    green: { bg: '#dcfce7', border: '#22c55e' },
    purple: { bg: '#f3e8ff', border: '#a855f7' },
    orange: { bg: '#ffedd5', border: '#f97316' },
};

// Helper functions
export function createId(): string {
    return `el_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

export function createShapeElement(
    shapeType: ShapeType,
    x: number,
    y: number,
    options: Partial<ToolOptions> = {}
): ShapeElement {
    const now = Date.now();
    return {
        id: createId(),
        type: 'shape',
        shapeType,
        x,
        y,
        width: 100,
        height: shapeType === 'line' || shapeType === 'arrow' ? 0 : 100,
        rotation: 0,
        locked: false,
        visible: true,
        zIndex: now,
        fillColor: options.fillColor || DEFAULT_TOOL_OPTIONS.fillColor,
        fillOpacity: 0.8,
        strokeColor: options.strokeColor || DEFAULT_TOOL_OPTIONS.strokeColor,
        strokeWidth: options.strokeWidth || DEFAULT_TOOL_OPTIONS.strokeWidth,
        strokeStyle: 'solid',
        cornerRadius: shapeType === 'rectangle' ? 8 : undefined,
        createdAt: now,
        updatedAt: now,
    };
}

export function createTextElement(
    x: number,
    y: number,
    content: string = '',
    options: Partial<ToolOptions> = {}
): TextElement {
    const now = Date.now();
    return {
        id: createId(),
        type: 'text',
        x,
        y,
        width: 200,
        height: 40,
        rotation: 0,
        locked: false,
        visible: true,
        zIndex: now,
        content,
        fontSize: options.fontSize || DEFAULT_TOOL_OPTIONS.fontSize,
        fontFamily: options.fontFamily || DEFAULT_TOOL_OPTIONS.fontFamily,
        fontWeight: 'normal',
        fontStyle: 'normal',
        textAlign: 'left',
        textColor: '#ffffff',
        backgroundColor: 'transparent',
        padding: 8,
        createdAt: now,
        updatedAt: now,
    };
}

export function createNoteElement(
    x: number,
    y: number,
    options: Partial<ToolOptions> = {}
): NoteElement {
    const now = Date.now();
    return {
        id: createId(),
        type: 'note',
        x,
        y,
        width: 200,
        height: 150,
        rotation: 0,
        locked: false,
        visible: true,
        zIndex: now,
        content: '',
        noteColor: options.noteColor || DEFAULT_TOOL_OPTIONS.noteColor,
        fontSize: 14,
        createdAt: now,
        updatedAt: now,
    };
}

export function createFrameElement(
    x: number,
    y: number,
    title: string = 'Frame'
): FrameElement {
    const now = Date.now();
    return {
        id: createId(),
        type: 'frame',
        x,
        y,
        width: 400,
        height: 300,
        rotation: 0,
        locked: false,
        visible: true,
        zIndex: now - 1000000, // Frames should be behind other elements
        title,
        backgroundColor: 'rgba(30, 41, 59, 0.5)',
        borderColor: '#475569',
        borderWidth: 2,
        childIds: [],
        collapsed: false,
        createdAt: now,
        updatedAt: now,
    };
}

export function createConnectorElement(
    startPoint: { x: number; y: number },
    endPoint: { x: number; y: number },
    options: Partial<ToolOptions> = {}
): ConnectorElement {
    const now = Date.now();
    const minX = Math.min(startPoint.x, endPoint.x);
    const minY = Math.min(startPoint.y, endPoint.y);
    const maxX = Math.max(startPoint.x, endPoint.x);
    const maxY = Math.max(startPoint.y, endPoint.y);

    return {
        id: createId(),
        type: 'connector',
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
        rotation: 0,
        locked: false,
        visible: true,
        zIndex: now,
        connectorType: options.connectorType || DEFAULT_TOOL_OPTIONS.connectorType,
        startPoint,
        endPoint,
        strokeColor: options.strokeColor || DEFAULT_TOOL_OPTIONS.strokeColor,
        strokeWidth: options.strokeWidth || DEFAULT_TOOL_OPTIONS.strokeWidth,
        startStyle: options.startStyle || DEFAULT_TOOL_OPTIONS.startStyle,
        endStyle: options.endStyle || DEFAULT_TOOL_OPTIONS.endStyle,
        createdAt: now,
        updatedAt: now,
    };
}

export function createPenElement(
    points: { x: number; y: number }[],
    options: Partial<ToolOptions> = {}
): PenElement {
    const now = Date.now();
    const xs = points.map(p => p.x);
    const ys = points.map(p => p.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const maxX = Math.max(...xs);
    const maxY = Math.max(...ys);

    return {
        id: createId(),
        type: 'pen',
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
        rotation: 0,
        locked: false,
        visible: true,
        zIndex: now,
        points,
        strokeColor: options.strokeColor || DEFAULT_TOOL_OPTIONS.strokeColor,
        strokeWidth: options.strokeWidth || DEFAULT_TOOL_OPTIONS.strokeWidth,
        opacity: 1,
        createdAt: now,
        updatedAt: now,
    };
}
