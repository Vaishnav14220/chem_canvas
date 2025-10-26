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
  Microscope,
  ChevronDown,
  ChevronUp,
  GripVertical,
  FlaskConical,
  Gem,
  Scan
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
  onOpenMoleculeSearch?: () => void;
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
  onOpenMoleculeSearch,
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
    { id: 'draw', name: 'Draw', icon: Type, description: 'Free drawing tool' },
    { id: 'atom', name: 'Atom', icon: Atom, description: 'Draw atoms and molecules' },
    { id: 'bond', name: 'Bond', icon: Minus, description: 'Draw chemical bonds' },
    { id: 'arrow', name: 'Arrow', icon: ArrowRight, description: 'Reaction arrows' },
    { id: 'plus', name: 'Plus', icon: Plus, description: 'Plus sign for ions' },
    { id: 'minus', name: 'Minus', icon: Minus, description: 'Minus sign for ions' },
    { id: 'equal', name: 'Equal', icon: Equal, description: 'Equilibrium arrows' },
    { id: 'calculator', name: 'Calculator', icon: Calculator, description: 'Quick calculations', isSpecial: true },
  { id: 'molview', name: '3D Molecules', icon: MolViewIcon, description: '3D molecular viewer', isSpecial: true },
  { id: 'ar', name: 'AR Viewer', icon: Scan, description: 'Place molecules in AR', isSpecial: true },
    { id: 'periodic', name: 'Periodic Table', icon: Grid3X3, description: 'Interactive periodic table', isSpecial: true },
    { id: 'molecules', name: 'Search Molecules', icon: Microscope, description: 'Search molecules from PubChem', isSpecial: true },
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
      className={`relative bg-slate-900/90 backdrop-blur-md border border-slate-700/60 rounded-2xl shadow-2xl transition-all duration-200 ${
        isCollapsed ? 'p-4' : 'p-6'
      }`}
      style={containerStyle}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 text-slate-200">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-blue-500/30 bg-blue-500/20">
            <Beaker size={18} className="text-blue-300" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold uppercase tracking-wide">Chemistry Tools</span>
            <span className="text-xs text-slate-400">Precision drawing kit</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {widthLabel && !isCollapsed && (
            <span className="hidden text-[11px] text-slate-400 sm:inline">{widthLabel}</span>
          )}
          {onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              className="rounded-lg border border-slate-700/60 bg-slate-800/70 p-2 text-slate-300 transition-all hover:bg-slate-700/60"
              title={isCollapsed ? 'Expand toolbar' : 'Collapse toolbar'}
            >
              {isCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
            </button>
          )}
        </div>
      </div>

      <div
        className={`overflow-hidden transition-[max-height,opacity] duration-200 ease-in-out ${
          isCollapsed ? 'max-h-0 opacity-0 pointer-events-none' : 'mt-4 max-h-[4000px] opacity-100'
        }`}
        aria-hidden={isCollapsed}
      >
        <div className="space-y-6">
          {/* Chemistry Tools */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-slate-200">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-blue-500/30 bg-blue-500/15">
                <Grid3X3 size={16} className="text-blue-300" />
              </div>
              <h3 className="text-sm font-semibold text-slate-300">Tool Palette</h3>
            </div>
            <div className="grid grid-cols-3 gap-3">
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
                    } else if (tool.isSpecial && tool.id === 'molecules' && onOpenMoleculeSearch) {
                      onOpenMoleculeSearch();
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
                  className={`group flex h-20 flex-col items-center justify-center gap-2 rounded-xl border border-slate-700/60 px-3 text-[13px] font-medium transition-all disabled:cursor-not-allowed disabled:opacity-60 ${
                    tool.isSpecial
                      ? 'border-primary/60 bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary'
                      : currentTool === tool.id
                        ? 'border-primary/60 bg-primary/80 text-primary-foreground shadow-lg shadow-primary/10'
                        : 'bg-slate-800/60 text-slate-200 hover:bg-slate-700/60 hover:border-slate-500'
                  }`}
                  title={tool.description}
                >
                  <tool.icon size={20} className="transition-transform group-hover:scale-105" />
                  {tool.isSpecial && (
                    <span className="text-[11px] font-medium text-center leading-tight">
                      {tool.name}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </section>

          {/* Shapes Toggle */}
          <section className="space-y-3">
            <button
              onClick={() => setShowShapes(!showShapes)}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-700/60 bg-slate-800/70 px-3 py-3 text-sm font-medium text-slate-200 transition-all hover:bg-slate-700/60"
            >
              <Square size={16} className="text-blue-300" />
              {showShapes ? 'Hide' : 'Show'} Shapes
            </button>
            
            {showShapes && (
              <div className="grid grid-cols-4 gap-3">
                {shapes.map((shape) => (
                  <button
                    key={shape.id}
                    onClick={() => onToolSelect(shape.id)}
                    className={`flex h-12 items-center justify-center rounded-xl border border-slate-700/60 transition-all ${
                      currentTool === shape.id
                        ? 'border-primary/60 bg-primary/80 text-white shadow-lg shadow-primary/20'
                        : 'bg-slate-800/60 text-slate-200 hover:bg-slate-700/60 hover:border-slate-500'
                    }`}
                    title={shape.description}
                  >
                    <shape.icon size={18} />
                  </button>
                ))}
              </div>
            )}
          </section>

          {/* Stroke & Fill */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-300">Stroke &amp; Fill</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Stroke</p>
                <div className="grid grid-cols-6 gap-2">
                  {colors.map((color) => (
                    <button
                      key={`stroke-${color}`}
                      onClick={() => onStrokeColorChange(color)}
                      className={`h-9 w-9 rounded-xl border-2 transition-all shadow-sm ${
                        strokeColor === color ? 'border-white' : 'border-slate-600'
                      }`}
                      style={{ backgroundColor: color }}
                      title={`Stroke: ${color}`}
                    />
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <p className="flex items-center justify-between text-xs font-medium uppercase tracking-wide text-slate-400">
                  <span>Fill</span>
                  <button
                    type="button"
                    onClick={() => onFillToggle(!fillEnabled)}
                    className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase transition-all ${
                      fillEnabled ? 'bg-primary/80 text-white' : 'bg-slate-800/80 text-slate-300'
                    }`}
                  >
                    {fillEnabled ? 'On' : 'Off'}
                  </button>
                </p>
                <div className="grid grid-cols-6 gap-2">
                  {colors.map((color) => (
                    <button
                      key={`fill-${color}`}
                      onClick={() => onFillColorChange(color)}
                      className={`h-9 w-9 rounded-xl border-2 transition-all shadow-sm ${
                        fillColor === color ? 'border-white' : 'border-slate-600'
                      } ${fillEnabled ? '' : 'opacity-40'}`}
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
            <h3 className="text-sm font-semibold text-slate-300">Brush Size</h3>
            <input
              type="range"
              min="1"
              max="20"
              value={currentSize}
              onChange={(e) => onSizeChange(Number(e.target.value))}
              className="slider-thumb h-2 w-full cursor-pointer appearance-none rounded-lg bg-slate-700"
            />
            <div className="mt-1 text-center text-xs text-slate-400">{currentSize}px</div>
          </section>

          {/* Resize Toolbar */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-300">Resize &amp; Rotate</h3>
            <div className="rounded-2xl border border-slate-700/60 bg-slate-800/70 p-3">
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
          <section className="space-y-3 border-t border-slate-700/60 pt-4">
            <h3 className="text-sm font-semibold text-slate-300">Quick Actions</h3>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => onToolSelect('text')}
                className={`flex h-16 flex-col items-center justify-center gap-2 rounded-xl border border-slate-700/60 text-sm font-medium transition-all ${
                  currentTool === 'text'
                    ? 'border-primary/60 bg-primary/80 text-white shadow-lg shadow-primary/20'
                    : 'bg-slate-800/60 text-slate-200 hover:bg-slate-700/60 hover:border-slate-500'
                }`}
              >
                <Type size={16} className="mx-auto" />
                Text
              </button>
              <button
                onClick={() => onToolSelect('eraser')}
                className={`flex h-16 flex-col items-center justify-center gap-2 rounded-xl border border-slate-700/60 text-sm font-medium transition-all ${
                  currentTool === 'eraser'
                    ? 'border-primary/60 bg-primary/80 text-white shadow-lg shadow-primary/20'
                    : 'bg-slate-800/60 text-slate-200 hover:bg-slate-700/60 hover:border-slate-500'
                }`}
              >
                <Square size={16} className="mx-auto" />
                Eraser
              </button>
            </div>
          </section>
        </div>
      </div>

      {onResizeStart && (
        <div
          className="absolute right-[-10px] top-12 bottom-12 hidden w-4 cursor-col-resize items-center justify-center rounded-full border border-slate-700/60 bg-slate-800/70 transition-colors hover:bg-slate-700/70 sm:flex"
          onMouseDown={onResizeStart}
          title="Drag to resize"
          role="presentation"
        >
          <GripVertical size={14} className="text-slate-400" />
        </div>
      )}
    </div>
  );
};

export default ChemistryToolbar;

