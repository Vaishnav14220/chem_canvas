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
      className={`relative bg-gradient-to-br from-slate-900/95 via-slate-800/90 to-slate-900/95 backdrop-blur-xl border border-slate-700/50 rounded-3xl shadow-2xl shadow-slate-900/50 transition-all duration-300 ${
        isCollapsed ? 'p-3' : 'p-4'
      }`}
      style={containerStyle}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 text-slate-200">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-blue-400/40 bg-gradient-to-br from-blue-500/20 to-blue-600/10 shadow-lg shadow-blue-500/10">
            <Beaker size={20} className="text-blue-300 drop-shadow-sm" />
          </div>
          <div className="flex flex-col">
            <span className="text-base font-bold uppercase tracking-wider bg-gradient-to-r from-blue-300 to-cyan-300 bg-clip-text text-transparent">Chemistry Tools</span>
            <span className="text-xs text-slate-400 font-medium">Precision drawing suite</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {widthLabel && !isCollapsed && (
            <span className="hidden text-xs text-slate-400 font-medium sm:inline bg-slate-800/50 px-2 py-1 rounded-lg">{widthLabel}</span>
          )}
          {onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              className="rounded-xl border border-slate-600/50 bg-slate-800/80 p-2.5 text-slate-300 transition-all duration-200 hover:bg-slate-700/80 hover:border-slate-500/50 hover:shadow-lg hover:shadow-slate-900/20"
              title={isCollapsed ? 'Expand toolbar' : 'Collapse toolbar'}
            >
              {isCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
            </button>
          )}
        </div>
      </div>

      <div
        className={`overflow-hidden transition-[max-height,opacity] duration-300 ease-in-out ${
          isCollapsed ? 'max-h-0 opacity-0 pointer-events-none' : 'mt-3 max-h-[4000px] opacity-100'
        }`}
        aria-hidden={isCollapsed}
      >
        <div className="space-y-4">
          {/* Chemistry Tools */}
          <section className="space-y-2">
            <div className="flex items-center gap-2 text-slate-200">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-blue-400/40 bg-gradient-to-br from-blue-500/15 to-blue-600/5 shadow-lg shadow-blue-500/5">
                <Grid3X3 size={18} className="text-blue-300" />
              </div>
              <h3 className="text-base font-bold text-slate-200">Tool Palette</h3>
            </div>
            <div className="grid grid-cols-3 gap-2">
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
                  className={`group relative flex h-8 flex-col items-center justify-center gap-0.5 border px-1 text-xs font-semibold transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:ring-offset-1 focus:ring-offset-slate-900 overflow-hidden ${
                    tool.isSpecial
                      ? 'border-blue-400/60 bg-gradient-to-br from-blue-500/95 via-blue-600/90 to-blue-700/85 text-white shadow-lg shadow-blue-500/30 hover:shadow-blue-400/50 hover:shadow-xl hover:scale-105 hover:border-blue-300/70 active:scale-95 before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/20 before:to-transparent before:translate-x-[-100%] hover:before:translate-x-[100%] before:transition-transform before:duration-700'
                      : currentTool === tool.id
                        ? 'border-blue-400/70 bg-gradient-to-br from-blue-500/90 via-blue-600/85 to-blue-700/80 text-white shadow-lg shadow-blue-500/25 ring-1 ring-blue-400/30'
                        : 'border-slate-600/60 bg-gradient-to-br from-slate-800/90 via-slate-700/80 to-slate-600/70 text-slate-200 hover:border-slate-400/70 hover:bg-gradient-to-br hover:from-slate-700/90 hover:via-slate-600/80 hover:to-slate-500/70 hover:shadow-lg hover:shadow-slate-900/30 hover:scale-102 active:scale-98'
                  }`}
                  title={tool.description}
                >
                  <tool.icon size={8} className={`transition-all duration-300 group-hover:scale-125 group-hover:rotate-3 drop-shadow-sm ${
                    tool.isSpecial || currentTool === tool.id ? 'filter brightness-110' : ''
                  }`} />
                  <span className={`text-[10px] font-medium text-center leading-tight transition-all duration-300 ${
                    tool.isSpecial || currentTool === tool.id ? 'text-white font-semibold' : 'text-slate-200 group-hover:text-white'
                  }`}>
                    {tool.name}
                  </span>
                </button>
              ))}
            </div>
          </section>

          {/* Shapes Toggle */}
          <section className="space-y-2">
            <button
              onClick={() => setShowShapes(!showShapes)}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-600/50 bg-gradient-to-r from-slate-800/80 to-slate-700/60 px-3 py-2 text-xs font-semibold text-slate-200 transition-all duration-200 hover:border-slate-500/60 hover:bg-gradient-to-r hover:from-slate-700/80 hover:to-slate-600/60 hover:shadow-lg hover:shadow-slate-900/20"
            >
              <Square size={18} className="text-blue-300" />
              <span>{showShapes ? 'Hide' : 'Show'} Shapes</span>
              <ChevronDown size={16} className={`text-slate-400 transition-transform duration-200 ${showShapes ? 'rotate-180' : ''}`} />
            </button>
            
            {showShapes && (
              <div className="grid grid-cols-4 gap-1">
                {shapes.map((shape) => (
                  <button
                    key={shape.id}
                    onClick={() => onToolSelect(shape.id)}
                    className={`group relative flex h-4 items-center justify-center rounded-md border transition-all duration-300 overflow-hidden focus:outline-none focus:ring-1 focus:ring-blue-500/50 ${
                      currentTool === shape.id
                        ? 'border-blue-400/70 bg-gradient-to-br from-blue-500/85 to-blue-600/75 text-white shadow-lg shadow-blue-500/25 ring-1 ring-blue-400/30'
                        : 'border-slate-600/60 bg-gradient-to-br from-slate-800/90 to-slate-700/70 text-slate-200 hover:border-slate-400/70 hover:bg-gradient-to-br hover:from-slate-700/90 hover:to-slate-600/70 hover:shadow-lg hover:shadow-slate-900/30 hover:scale-110 active:scale-95'
                    }`}
                    title={shape.description}
                  >
                    <shape.icon size={7} className="drop-shadow-sm" />
                  </button>
                ))}
              </div>
            )}
          </section>

          {/* Stroke & Fill */}
          <section className="space-y-2">
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-1">
              <div className="h-1.5 w-1.5 rounded-full bg-gradient-to-r from-blue-400 to-cyan-400"></div>
              Stroke & Fill
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">Stroke</p>
                <div className="grid grid-cols-6 gap-1">
                  {colors.map((color) => (
                    <button
                      key={`stroke-${color}`}
                      onClick={() => onStrokeColorChange(color)}
                      className={`h-8 w-8 rounded-xl border-2 transition-all duration-200 shadow-sm hover:scale-110 ${
                        strokeColor === color ? 'border-white shadow-lg shadow-white/20' : 'border-slate-600 hover:border-slate-400'
                      }`}
                      style={{ backgroundColor: color }}
                      title={`Stroke: ${color}`}
                    />
                  ))}
                </div>
              </div>
              <div className="space-y-1">
                <p className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-300">
                  <span>Fill</span>
                  <button
                    type="button"
                    onClick={() => onFillToggle(!fillEnabled)}
                    className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase transition-all duration-200 ${
                      fillEnabled ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/30' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    {fillEnabled ? 'On' : 'Off'}
                  </button>
                </p>
                <div className="grid grid-cols-6 gap-1">
                  {colors.map((color) => (
                    <button
                      key={`fill-${color}`}
                      onClick={() => onFillColorChange(color)}
                      className={`h-8 w-8 rounded-xl border-2 transition-all duration-200 shadow-sm hover:scale-110 ${
                        fillColor === color ? 'border-white shadow-lg shadow-white/20' : 'border-slate-600 hover:border-slate-400'
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
          <section className="space-y-2">
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-1">
              <div className="h-1.5 w-1.5 rounded-full bg-gradient-to-r from-green-400 to-emerald-400"></div>
              Brush Size
            </h3>
            <div className="space-y-2">
              <input
                type="range"
                min="1"
                max="20"
                value={currentSize}
                onChange={(e) => onSizeChange(Number(e.target.value))}
                className="slider-thumb h-3 w-full cursor-pointer appearance-none rounded-lg bg-gradient-to-r from-slate-700 to-slate-600 shadow-inner"
              />
              <div className="flex items-center justify-center">
                <span className="text-sm font-bold text-slate-300 bg-slate-800/50 px-3 py-1 rounded-lg border border-slate-600/50">
                  {currentSize}px
                </span>
              </div>
            </div>
          </section>

          {/* Resize Toolbar */}
          <section className="space-y-2">
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-1">
              <div className="h-1.5 w-1.5 rounded-full bg-gradient-to-r from-purple-400 to-pink-400"></div>
              Resize & Rotate
            </h3>
            <div className="rounded-xl border border-slate-600/50 bg-gradient-to-br from-slate-800/60 to-slate-700/40 p-2 shadow-inner">
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
          <section className="space-y-2 border-t border-slate-600/50 pt-3">
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-1">
              <div className="h-1.5 w-1.5 rounded-full bg-gradient-to-r from-orange-400 to-red-400"></div>
              Quick Actions
            </h3>
            <div className="grid grid-cols-2 gap-1">
              <button
                onClick={() => onToolSelect('text')}
                className={`group relative flex h-5 flex-col items-center justify-center gap-0.5 rounded-lg border px-1 text-xs font-semibold transition-all duration-300 overflow-hidden focus:outline-none focus:ring-1 focus:ring-blue-500/50 ${
                  currentTool === 'text'
                    ? 'border-orange-400/70 bg-gradient-to-br from-orange-500/85 to-orange-600/75 text-white shadow-lg shadow-orange-500/25 ring-1 ring-orange-400/30'
                    : 'border-slate-600/60 bg-gradient-to-br from-slate-800/90 to-slate-700/70 text-slate-200 hover:border-slate-400/70 hover:bg-gradient-to-br hover:from-slate-700/90 hover:to-slate-600/70 hover:shadow-lg hover:shadow-slate-900/30 hover:scale-105 active:scale-95'
                }`}
              >
                <Type size={6} className={`transition-all duration-300 group-hover:scale-125 drop-shadow-sm ${
                  currentTool === 'text' ? 'filter brightness-110' : ''
                }`} />
                Text
              </button>
              <button
                onClick={() => onToolSelect('eraser')}
                className={`group relative flex h-5 flex-col items-center justify-center gap-0.5 rounded-lg border px-1 text-xs font-semibold transition-all duration-300 overflow-hidden focus:outline-none focus:ring-1 focus:ring-blue-500/50 ${
                  currentTool === 'eraser'
                    ? 'border-red-400/70 bg-gradient-to-br from-red-500/85 to-red-600/75 text-white shadow-lg shadow-red-500/25 ring-1 ring-red-400/30'
                    : 'border-slate-600/60 bg-gradient-to-br from-slate-800/90 to-slate-700/70 text-slate-200 hover:border-slate-400/70 hover:bg-gradient-to-br hover:from-slate-700/90 hover:to-slate-600/70 hover:shadow-lg hover:shadow-slate-900/30 hover:scale-105 active:scale-95'
                }`}
              >
                <Square size={6} className={`transition-all duration-300 group-hover:scale-125 drop-shadow-sm ${
                  currentTool === 'eraser' ? 'filter brightness-110' : ''
                }`} />
                Eraser
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

