// @ts-nocheck
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
  const [openSections, setOpenSections] = useState({
    symbols: false,
    labs: false,
    transform: false,
    shapes: false,
    stroke: true,
    brush: false,
    resize: false,
    quick: false,
  });
  const toggleSection = (key: keyof typeof openSections) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

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

  const primaryTools = [
    { id: 'draw', name: 'Draw', icon: Pen, description: 'Free drawing tool' },
    { id: 'bond', name: 'Bond', icon: Minus, description: 'Draw chemical bonds' },
    { id: 'arrow', name: 'Arrow', icon: ArrowRight, description: 'Reaction arrows' },
    { id: 'textbox', name: 'Text', icon: Type, description: 'Insert text box' },
  ];

  const toolSections = [
    {
      key: 'symbols',
      title: 'Symbols & Notations',
      description: 'Ions, annotations, quick glyphs',
      tools: [
        { id: 'plus', name: 'Plus', icon: Plus, description: 'Plus sign for ions' },
        { id: 'minus', name: 'Minus', icon: Minus, description: 'Minus sign for ions' },
        { id: 'equal', name: 'Equal', icon: Equal, description: 'Equilibrium arrows' },
      ]
    },
    {
      key: 'labs',
      title: 'Lab Utilities',
      description: 'Reference data & AR tools',
      tools: [
        { id: 'calculator', name: 'Calculator', icon: Calculator, description: 'Quick calculations', action: 'calculator' },
        { id: 'molview', name: '3D Molecules', icon: MolViewIcon, description: '3D molecular viewer', action: 'molview' },
        { id: 'periodic', name: 'Periodic', icon: Grid3X3, description: 'Periodic table', action: 'periodic' },
        { id: 'minerals', name: 'Minerals', icon: Gem, description: 'Mineral explorer', action: 'minerals' },
        { id: 'widgets', name: 'Widgets', icon: Beaker, description: 'Interactive chemistry tools', action: 'widgets' },
        { id: 'ar', name: 'AR Viewer', icon: Scan, description: 'Place molecules in AR', action: 'ar' },
      ]
    },
    {
      key: 'transform',
      title: 'Transform & Arrange',
      description: 'Manipulate existing elements',
      tools: [
        { id: 'move', name: 'Move', icon: Move, description: 'Move elements' },
        { id: 'rotate', name: 'Rotate', icon: RotateCw, description: 'Rotate elements' },
      ]
    }
  ] as const;

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
  const showShapes = openSections.shapes;


  return (
    <div
      className={`relative rounded-2xl border border-slate-700/50 bg-slate-950/90 shadow-2xl ring-1 ring-black/40 transition-all duration-300 ${
        isCollapsed ? 'p-3' : 'p-4'
      }`}
      style={containerStyle}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-800 text-slate-100 ring-1 ring-slate-700">
            <Beaker size={16} />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-slate-100 tracking-tight">
              Chemistry Tools
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {widthLabel && !isCollapsed && (
            <span className="text-[11px] tracking-wide text-slate-300 bg-slate-800/70 px-2 py-1 rounded-md border border-slate-700">
              {widthLabel}
            </span>
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
        <div className="space-y-3">
          <section className="space-y-3 rounded-2xl border border-slate-800/70 bg-slate-900/60 px-3 py-3 shadow-inner">
            <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-muted-foreground">
              <span>Sketch Essentials</span>
              <div className="h-px flex-1 bg-border ml-2" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              {primaryTools.map((tool) => (
                <button
                  key={tool.id}
                  onClick={() => onToolSelect(tool.id)}
                  className={`inline-flex items-center justify-center rounded-lg text-[12px] font-semibold h-9 gap-2 border transition ${
                    currentTool === tool.id
                      ? 'bg-primary text-primary-foreground border-primary/80'
                      : 'bg-slate-950/30 border-slate-800 hover:border-blue-400/60 hover:bg-slate-900/70 hover:text-white'
                  }`}
                >
                  <tool.icon size={14} />
                  {tool.name}
                </button>
              ))}
            </div>
          </section>

          {toolSections.map((section) => (
            <section key={section.key} className="rounded-2xl border border-slate-800/70 bg-slate-900/60 shadow-inner">
              <button
                type="button"
                onClick={() => toggleSection(section.key as keyof typeof openSections)}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground"
              >
                <div>
                  <p>{section.title}</p>
                </div>
                <ChevronDown
                  size={14}
                  className={`transition-transform ${
                    openSections[section.key as keyof typeof openSections] ? 'rotate-180' : ''
                  }`}
                />
              </button>
              <div
                className={`grid grid-cols-2 gap-2 px-3 pb-3 transition-[max-height,opacity] duration-200 ${
                  openSections[section.key as keyof typeof openSections]
                    ? 'max-h-64 opacity-100'
                    : 'max-h-0 opacity-0 pointer-events-none'
                }`}
              >
                {section.tools.map((tool) => {
                  const handleClick = () => {
                    switch (tool.action) {
                      case 'calculator':
                        return onOpenCalculator?.();
                      case 'molview':
                        return onOpenMolView?.();
                      case 'periodic':
                        return onOpenPeriodicTable?.();
                      case 'minerals':
                        return onOpenMineralSearch?.();
                      case 'widgets':
                        return onOpenChemistryWidgets?.();
                      case 'ar':
                        return onOpenArViewer?.();
                      default:
                        return onToolSelect(tool.id);
                    }
                  };

                  return (
                    <button
                      key={tool.id}
                      onClick={handleClick}
                      disabled={tool.id === 'ar' && !selectedMoleculeCid}
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-800/80 bg-slate-950/40 px-2 py-1.5 text-[11px] font-medium transition hover:border-primary/50 hover:bg-accent/30"
                      title={tool.description}
                    >
                      <tool.icon size={13} />
                      <span>{tool.name}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}

          <section className="rounded-2xl border border-slate-800/70 bg-slate-900/60 shadow-inner">
            <button
              onClick={() => toggleSection('shapes')}
              className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground"
            >
              <span>Shape Library</span>
              <ChevronDown
                size={14}
                className={`transition-transform ${showShapes ? 'rotate-180' : ''}`}
              />
            </button>
            <div
              className={`grid grid-cols-2 gap-2 px-3 pb-3 transition-[max-height,opacity] duration-200 ${
                showShapes ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0 pointer-events-none'
              }`}
            >
              {shapes.map((shape) => (
                <button
                  key={shape.id}
                  onClick={() => onToolSelect(shape.id)}
                  className={`inline-flex items-center justify-center gap-2 rounded-lg border border-slate-800/80 bg-slate-950/40 px-2 py-1.5 text-[11px] font-medium transition hover:border-primary/40 ${
                    currentTool === shape.id ? 'bg-primary/20 text-primary' : ''
                  }`}
                  title={shape.description}
                >
                  <shape.icon size={13} />
                  <span>{shape.name}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-800/70 bg-slate-900/60 shadow-inner">
            <button
              onClick={() => toggleSection('stroke')}
              className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground"
            >
              <span>Stroke & Fill</span>
              <ChevronDown
                size={14}
                className={`transition-transform ${openSections.stroke ? 'rotate-180' : ''}`}
              />
            </button>
            <div
              className={`grid grid-cols-2 gap-2 px-3 pb-3 transition-[max-height,opacity] duration-200 ${
                openSections.stroke ? 'max-h-60 opacity-100' : 'max-h-0 opacity-0 pointer-events-none'
              }`}
            >
              <div className="space-y-2">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Stroke</div>
                <div className="grid grid-cols-5 gap-1.5">
                  {colors.slice(0, 10).map((color) => (
                    <button
                      key={`stroke-${color}`}
                      onClick={() => onStrokeColorChange(color)}
                      className={`h-7 w-7 rounded-md border transition ${
                        strokeColor === color ? 'border-primary ring-1 ring-primary/50' : 'border-border/40'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[10px] uppercase tracking-wide text-muted-foreground">
                  <span>Fill</span>
                  <button
                    onClick={() => onFillToggle(!fillEnabled)}
                    className={`relative inline-flex h-5 w-10 items-center rounded-full ${
                      fillEnabled ? 'bg-blue-500/80' : 'bg-slate-600/70'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                        fillEnabled ? 'translate-x-5' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
                <div className="grid grid-cols-5 gap-1.5">
                  {colors.slice(2).map((color) => (
                    <button
                      key={`fill-${color}`}
                      onClick={() => onFillColorChange(color)}
                      className={`h-7 w-7 rounded-md border transition ${
                        fillColor === color ? 'border-blue-400 ring-1 ring-blue-300/60' : 'border-border/40'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-800/70 bg-slate-900/60 shadow-inner">
            <button
              onClick={() => toggleSection('brush')}
              className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground"
            >
              <span>Brush Size</span>
              <ChevronDown
                size={14}
                className={`transition-transform ${openSections.brush ? 'rotate-180' : ''}`}
              />
            </button>
            <div
              className={`space-y-2 px-3 pb-3 transition-[max-height,opacity] duration-200 ${
                openSections.brush ? 'max-h-32 opacity-100' : 'max-h-0 opacity-0 pointer-events-none'
              }`}
            >
              <input
                type="range"
                min="1"
                max="20"
                value={currentSize}
                onChange={(e) => onSizeChange(Number(e.target.value))}
                className="w-full h-1.5 rounded-full bg-muted"
              />
              <div className="text-center text-sm font-semibold">{currentSize}px</div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-800/70 bg-slate-900/60 shadow-inner">
            <button
              onClick={() => toggleSection('resize')}
              className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground"
            >
              <span>Resize & Rotate</span>
              <ChevronDown
                size={14}
                className={`transition-transform ${openSections.resize ? 'rotate-180' : ''}`}
              />
            </button>
            <div
              className={`px-3 pb-3 transition-[max-height,opacity] duration-200 ${
                openSections.resize ? 'max-h-64 opacity-100' : 'max-h-0 opacity-0 pointer-events-none'
              }`}
            >
              <ResizeToolbar
                selectedShape={selectedShape ?? null}
                onResize={(width, height) => onResize?.(width, height)}
                onRotate={(angle) => onRotate?.(angle)}
              />
            </div>
          </section>

          <section className="rounded-2xl border border-slate-800/70 bg-slate-900/60 shadow-inner">
            <button
              onClick={() => toggleSection('quick')}
              className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground"
            >
              <span>Quick Actions</span>
              <ChevronDown
                size={14}
                className={`transition-transform ${openSections.quick ? 'rotate-180' : ''}`}
              />
            </button>
            <div
              className={`grid grid-cols-2 gap-2 px-3 pb-3 transition-[max-height,opacity] duration-200 ${
                openSections.quick ? 'max-h-28 opacity-100' : 'max-h-0 opacity-0 pointer-events-none'
              }`}
            >
              <button
                onClick={() => onToolSelect('text')}
                className={`inline-flex items-center justify-center gap-2 rounded-lg border border-slate-800/80 bg-slate-950/40 px-2 py-1.5 text-[11px] font-medium transition ${
                  currentTool === 'text' ? 'bg-primary/20 text-primary' : ''
                }`}
              >
                <Type size={13} />
                Text
              </button>
              <button
                onClick={() => onToolSelect('eraser')}
                className={`inline-flex items-center justify-center gap-2 rounded-lg border border-slate-800/80 bg-slate-950/40 px-2 py-1.5 text-[11px] font-medium transition ${
                  currentTool === 'eraser' ? 'bg-destructive/20 text-destructive' : ''
                }`}
              >
                <Eraser size={13} />
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
