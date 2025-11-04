import React, { useState } from 'react';
import { 
  Atom, 
  Beaker, 
  ArrowRight, 
  Plus,
  Minus,
  Equal,
  Type,
  Circle,
  Square,
  Triangle,
  Hexagon,
  Calculator,
  Grid3X3,
  Move,
  RotateCw,
  ChevronDown,
  ChevronUp,
  GripVertical,
  FlaskConical,
  Gem,
  Scan,
  Eraser,
  Pen
} from 'lucide-react';
import ResizeToolbar from './ResizeToolbar';

interface ChemistryToolbarProps {
  onToolSelect: (tool: string) => void;
  currentTool: string;
  onColorChange?: (color: string) => void;
  currentColor?: string;
  onStrokeColorChange: (color: string) => void;
  strokeColor: string;
  onFillToggle: (enabled: boolean) => void;
  fillEnabled: boolean;
  onFillColorChange: (color: string) => void;
  fillColor: string;
  onSizeChange: (size: number) => void;
  currentSize: number;
  onOpenCalculator?: () => void;
  onOpenMolView?: () => void;
  onOpenPeriodicTable?: () => void;
  onOpenReagentSearch?: () => void;
  onOpenMineralSearch?: () => void;
  onOpenArViewer?: () => void;
  onOpenChemistryWidgets?: () => void;
  selectedShape?: {
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    rotation?: number;
  } | null;
  selectedMoleculeCid?: string | null;
  onResize?: (width: number, height: number) => void;
  onRotate?: (angle: number) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  width?: number;
  onResizeStart?: (event: React.MouseEvent<HTMLDivElement>) => void;
}

const ChemistryToolbar: React.FC<ChemistryToolbarProps> = ({
  onToolSelect,
  currentTool,
  onStrokeColorChange,
  strokeColor,
  onFillToggle,
  fillEnabled,
  onFillColorChange,
  fillColor,
  onSizeChange,
  currentSize,
  onOpenCalculator,
  onOpenMolView,
  onOpenPeriodicTable,
  onOpenReagentSearch,
  onOpenMineralSearch,
  onOpenArViewer,
  onOpenChemistryWidgets,
  selectedShape,
  selectedMoleculeCid,
  onResize,
  onRotate,
  isCollapsed = false,
  onToggleCollapse,
  width,
  onResizeStart
}) => {
  const [showShapes, setShowShapes] = useState(false);

  // MolView icon component
  const MolViewIcon = ({ size = 18, className = "" }: { size?: number; className?: string }) => (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="currentColor" 
      className={className}
    >
      <path d="M12 2L2 7L12 12L22 7L12 2Z" />
      <path d="M2 17L12 22L22 17" />
      <path d="M2 12L12 17L22 12" />
    </svg>
  );

  const chemistryTools = [
    { id: 'draw', name: 'Draw', icon: Pen, description: 'Free drawing tool' },
    { id: 'textbox', name: 'Text Box', icon: Type, description: 'Insert text box' },
    { id: 'bond', name: 'Bond', icon: Minus, description: 'Draw chemical bonds' },
    { id: 'arrow', name: 'Arrow', icon: ArrowRight, description: 'Reaction arrows' },
    { id: 'plus', name: 'Plus', icon: Plus, description: 'Plus sign for ions' },
    { id: 'minus', name: 'Minus', icon: Minus, description: 'Minus sign for ions' },
    { id: 'equal', name: 'Equal', icon: Equal, description: 'Equilibrium arrows' },
    { id: 'calculator', name: 'Calculator', icon: Calculator, description: 'Quick calculations', isSpecial: true },
  { id: 'molview', name: '3D Molecules', icon: MolViewIcon, description: '3D molecular viewer', isSpecial: true },
  { id: 'ar', name: 'AR Viewer', icon: Scan, description: 'Place molecules in AR', isSpecial: true },
    { id: 'periodic', name: 'Periodic Table', icon: Grid3X3, description: 'Interactive periodic table', isSpecial: true },
  { id: 'reagents', name: 'Search Reagents', icon: FlaskConical, description: 'Find reagent molecules', isSpecial: true },
  { id: 'minerals', name: 'Search Minerals', icon: Gem, description: 'Pull 3D minerals from COD', isSpecial: true },
    { id: 'widgets', name: 'Chemistry Widgets', icon: Beaker, description: 'Interactive chemistry tools', isSpecial: true },
    { id: 'move', name: 'Move', icon: Move, description: 'Move elements' },
    { id: 'rotate', name: 'Rotate', icon: RotateCw, description: 'Rotate elements' },
  ];

  const shapes = [
    { id: 'circle', name: 'Circle', icon: Circle, description: 'Circular shapes' },
    { id: 'square', name: 'Square', icon: Square, description: 'Square shapes' },
    { id: 'triangle', name: 'Triangle', icon: Triangle, description: 'Triangular shapes' },
    { id: 'hexagon', name: 'Hexagon', icon: Hexagon, description: 'Hexagonal shapes' },
  ];

  const colors = [
    '#1e293b', // Dark slate - Professional
    '#3b82f6', // Professional blue
    '#0ea5e9', // Sky blue
    '#06b6d4', // Cyan (professional)
    '#14b8a6', // Teal
    '#64748b', // Slate gray
    '#94a3b8', // Light gray
    '#ffffff', // White
    '#000000', // Black
    '#475569', // Dark gray
  '#cbd5e1', // Light slate
  '#e2e8f0', // Very light gray
  ];

  const containerStyle = width ? { width } : undefined;
  const widthLabel = typeof width === 'number' ? `${Math.round(width)}px` : null;


  return (
    <div
      className={`relative bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border border-border rounded-xl shadow-lg transition-all duration-300 ${
        isCollapsed ? 'p-3' : 'p-4'
      }`}
      style={containerStyle}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg">
            <Beaker size={16} className="text-white" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Chemistry Tools
            </span>
            <span className="text-xs text-muted-foreground">Drawing Suite</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {widthLabel && !isCollapsed && (
            <span className="text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded-md">{widthLabel}</span>
          )}
          {onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              className="inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-8 w-8"
              title={isCollapsed ? 'Expand toolbar' : 'Collapse toolbar'}
            >
              {isCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
            </button>
          )}
        </div>
      </div>

      <div
        className={`overflow-hidden transition-[max-height,opacity] duration-300 ease-in-out ${
          isCollapsed ? 'max-h-0 opacity-0 pointer-events-none' : 'mt-4 max-h-[4000px] opacity-100'
        }`}
        aria-hidden={isCollapsed}
      >
        <div className="space-y-4">
          {/* Chemistry Tools */}
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-muted">
                <Grid3X3 size={14} className="text-muted-foreground" />
              </div>
              <h3 className="text-sm font-semibold">Tool Palette</h3>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {chemistryTools.map((tool) => (
                <button
                  key={tool.id}
                  onClick={() => {
                    if (tool.isSpecial && tool.id === 'calculator' && onOpenCalculator) {
                      onOpenCalculator();
                    } else if (tool.isSpecial && tool.id === 'molview' && onOpenMolView) {
                      onOpenMolView();
                    } else if (tool.isSpecial && tool.id === 'ar' && onOpenArViewer) {
                      onOpenArViewer();
                    } else if (tool.isSpecial && tool.id === 'periodic' && onOpenPeriodicTable) {
                      onOpenPeriodicTable();
                    } else if (tool.isSpecial && tool.id === 'reagents' && onOpenReagentSearch) {
                      onOpenReagentSearch();
                    } else if (tool.isSpecial && tool.id === 'minerals' && onOpenMineralSearch) {
                      onOpenMineralSearch();
                    } else if (tool.isSpecial && tool.id === 'widgets' && onOpenChemistryWidgets) {
                      onOpenChemistryWidgets();
                    } else {
                      onToolSelect(tool.id);
                    }
                  }}
                  disabled={tool.id === 'ar' && !selectedMoleculeCid}
                  className={`inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-10 px-3 gap-2 ${
                    tool.isSpecial
                      ? 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-md'
                      : currentTool === tool.id
                        ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                        : 'border border-input bg-background hover:bg-accent hover:text-accent-foreground hover:shadow-md'
                  }`}
                  title={tool.description}
                >
                  <tool.icon size={16} />
                  <span className="text-xs">{tool.name}</span>
                </button>
              ))}
            </div>
          </section>

          {/* Shapes Toggle */}
          <section className="space-y-3">
            <button
              onClick={() => setShowShapes(!showShapes)}
              className="inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground hover:shadow-md h-10 px-3 w-full gap-2"
            >
                              <Eraser size={14} />
              <span>{showShapes ? 'Hide' : 'Show'} Shapes</span>
              <ChevronDown size={14} className={`transition-transform duration-200 ${showShapes ? 'rotate-180' : ''}`} />
            </button>

            {showShapes && (
              <div className="grid grid-cols-2 gap-2">
                {shapes.map((shape) => (
                  <button
                    key={shape.id}
                    onClick={() => onToolSelect(shape.id)}
                    className={`inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-10 px-3 gap-2 ${
                      currentTool === shape.id
                        ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                        : 'border border-input bg-background hover:bg-accent hover:text-accent-foreground hover:shadow-md'
                    }`}
                    title={shape.description}
                  >
                    <shape.icon size={16} />
                    <span className="text-xs">{shape.name}</span>
                  </button>
                ))}
              </div>
            )}
          </section>

          {/* Stroke & Fill */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-gradient-to-r from-blue-500 to-purple-500"></div>
              Stroke & Fill
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium uppercase tracking-wide">Stroke</p>
                </div>
                <div className="grid grid-cols-5 gap-1">
                  {colors.slice(0, 10).map((color) => (
                    <button
                      key={`stroke-${color}`}
                      onClick={() => onStrokeColorChange(color)}
                      className={`h-8 w-8 rounded-lg border-2 transition-all duration-200 hover:scale-105 ${
                        strokeColor === color ? 'border-primary shadow-md' : 'border-border hover:border-accent'
                      }`}
                      style={{ backgroundColor: color }}
                      title={`Stroke: ${color}`}
                    />
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium uppercase tracking-wide">Fill</p>
                  <button
                    type="button"
                    onClick={() => onFillToggle(!fillEnabled)}
                    className={`inline-flex items-center justify-center whitespace-nowrap rounded-md text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-6 px-2 ${
                      fillEnabled ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'border border-input bg-background hover:bg-accent hover:text-accent-foreground'
                    }`}
                  >
                    {fillEnabled ? 'On' : 'Off'}
                  </button>
                </div>
                <div className="grid grid-cols-5 gap-1">
                  {colors.slice(0, 10).map((color) => (
                    <button
                      key={`fill-${color}`}
                      onClick={() => onFillColorChange(color)}
                      className={`h-8 w-8 rounded-lg border-2 transition-all duration-200 hover:scale-105 ${
                        fillColor === color ? 'border-primary shadow-md' : 'border-border hover:border-accent'
                      } ${fillEnabled ? '' : 'opacity-50'}`}
                      style={{ backgroundColor: color }}
                      title={`Fill: ${color}`}
                      disabled={!fillEnabled}
                    />
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Brush Size */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-gradient-to-r from-green-500 to-emerald-500"></div>
              Brush Size
            </h3>
            <div className="space-y-3">
              <input
                type="range"
                min="1"
                max="20"
                value={currentSize}
                onChange={(e) => onSizeChange(Number(e.target.value))}
                className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer slider"
              />
              <div className="flex items-center justify-center">
                <span className="text-sm font-medium bg-muted px-3 py-1 rounded-md">
                  {currentSize}px
                </span>
              </div>
            </div>
          </section>

          {/* Resize & Rotate */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-gradient-to-r from-purple-500 to-pink-500"></div>
              Resize & Rotate
            </h3>
            <div className="rounded-lg border border-border bg-muted/50 p-3">
              <ResizeToolbar
                selectedShape={selectedShape ?? null}
                onResize={(width, height) => {
                  if (onResize) {
                    onResize(width, height);
                  }
                }}
                onRotate={(angle) => {
                  if (onRotate) {
                    onRotate(angle);
                  }
                }}
              />
            </div>
          </section>

          {/* Quick Actions */}
          <section className="space-y-3 border-t border-border pt-4">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-gradient-to-r from-orange-500 to-red-500"></div>
              Quick Actions
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => onToolSelect('text')}
                className={`inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-9 px-3 gap-2 ${
                  currentTool === 'text'
                    ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                    : 'border border-input bg-background hover:bg-accent hover:text-accent-foreground hover:shadow-md'
                }`}
              >
                <Type size={14} />
                <span className="text-xs">Text</span>
              </button>
              <button
                onClick={() => onToolSelect('eraser')}
                className={`inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-9 px-3 gap-2 ${
                  currentTool === 'eraser'
                    ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                    : 'border border-input bg-background hover:bg-accent hover:text-accent-foreground hover:shadow-md'
                }`}
              >
                <Eraser size={14} />
                <span className="text-xs">Eraser</span>
              </button>
            </div>
          </section>
        </div>
      </div>

      {onResizeStart && (
        <div
          className="absolute right-[-12px] top-16 bottom-16 hidden w-6 cursor-col-resize items-center justify-center rounded-full border border-slate-600/50 bg-gradient-to-r from-slate-800/90 to-slate-700/80 transition-all duration-200 hover:bg-gradient-to-r hover:from-slate-700/90 hover:to-slate-600/80 hover:border-slate-500/60 hover:shadow-lg hover:shadow-slate-900/30 sm:flex"
          onMouseDown={onResizeStart}
          title="Drag to resize"
          role="presentation"
        >
          <GripVertical size={16} className="text-slate-400" />
        </div>
      )}
    </div>
  );
};

export default ChemistryToolbar;

